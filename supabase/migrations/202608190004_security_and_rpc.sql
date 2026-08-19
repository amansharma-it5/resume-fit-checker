revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['profiles','user_consents','account_usage','data_deletion_jobs','resumes','resume_sections','resume_versions','job_descriptions','resume_job_targets','analyses','user_confirmed_facts','ai_generations','cover_letters','resignation_letters','interview_sessions','interview_questions','interview_answers','job_bookmarks','job_applications','teams','team_members','team_invitations','review_requests','review_comments','audit_events','export_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.user_consents, public.resumes, public.resume_sections, public.job_descriptions, public.resume_job_targets, public.analyses, public.user_confirmed_facts, public.cover_letters, public.resignation_letters, public.interview_sessions, public.interview_questions, public.interview_answers, public.job_bookmarks, public.job_applications, public.review_requests, public.review_comments to authenticated;
grant select on public.account_usage, public.data_deletion_jobs, public.resume_versions, public.ai_generations, public.audit_events, public.export_history to authenticated;
grant select, insert, update on public.teams, public.team_members, public.team_invitations to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy consents_owner_all on public.user_consents for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy usage_owner_select on public.account_usage for select to authenticated using (user_id = auth.uid());
create policy data_jobs_owner_select on public.data_deletion_jobs for select to authenticated using (user_id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['resumes','resume_sections','job_descriptions','resume_job_targets','analyses','user_confirmed_facts','cover_letters','resignation_letters','interview_sessions','interview_questions','interview_answers','job_bookmarks','job_applications','review_requests'] loop
    execute format('create policy %I_owner_all on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;
create policy resume_versions_owner_select on public.resume_versions for select to authenticated using (owner_id = auth.uid());
create policy generations_owner_select on public.ai_generations for select to authenticated using (owner_id = auth.uid());
create policy audit_owner_select on public.audit_events for select to authenticated using (owner_id = auth.uid());
create policy exports_owner_select on public.export_history for select to authenticated using (owner_id = auth.uid());
create policy teams_owner_all on public.teams for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy team_members_self_select on public.team_members for select to authenticated using (user_id = auth.uid());
create policy team_invitations_inviter_select on public.team_invitations for select to authenticated using (invited_by = auth.uid());
create policy review_comments_author_all on public.review_comments for all to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());

create or replace function public.permanently_delete_resume(target_resume_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.resumes where id = target_resume_id and owner_id = auth.uid() and status = 'deleted';
  if not found then raise exception 'resume not found or not eligible'; end if;
end; $$;

create or replace function public.import_guest_resumes(guest_resumes jsonb) returns integer language plpgsql security invoker set search_path = '' as $$
declare item jsonb; imported integer := 0; source_id uuid; safe_title text; safe_data jsonb;
begin
  if auth.uid() is null or jsonb_typeof(guest_resumes) <> 'array' or jsonb_array_length(guest_resumes) > 25 then raise exception 'invalid import'; end if;
  for item in select value from jsonb_array_elements(guest_resumes) loop
    source_id := (item ->> 'source_guest_id')::uuid; safe_title := left(trim(coalesce(item ->> 'title', 'Untitled resume')), 160); safe_data := coalesce(item -> 'structured_data', '{"sections":[]}'::jsonb);
    if safe_title = '' or jsonb_typeof(safe_data) <> 'object' then raise exception 'invalid guest resume'; end if;
    insert into public.resumes(owner_id, source_guest_id, title, structured_data, imported_at) values (auth.uid(), source_id, safe_title, safe_data, timezone('utc', now())) on conflict (owner_id, source_guest_id) do nothing;
    imported := imported + case when found then 1 else 0 end;
  end loop;
  return imported;
end; $$;

grant execute on function public.permanently_delete_resume(uuid) to authenticated;
grant execute on function public.import_guest_resumes(jsonb) to authenticated;
