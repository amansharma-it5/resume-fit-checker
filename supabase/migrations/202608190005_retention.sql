create or replace function public.purge_soft_deleted_data(cutoff timestamptz default timezone('utc', now()) - interval '30 days') returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb := '{}'::jsonb; affected bigint;
begin
  if current_user not in ('postgres', 'service_role') then raise exception 'not authorized'; end if;
  delete from public.review_comments where deleted_at < cutoff; get diagnostics affected = row_count; result := result || jsonb_build_object('review_comments', affected);
  delete from public.review_requests where deleted_at < cutoff; get diagnostics affected = row_count; result := result || jsonb_build_object('review_requests', affected);
  delete from public.analyses where deleted_at < cutoff; get diagnostics affected = row_count; result := result || jsonb_build_object('analyses', affected);
  delete from public.resumes where deleted_at < cutoff; get diagnostics affected = row_count; result := result || jsonb_build_object('resumes', affected);
  delete from public.profiles where deleted_at < cutoff; get diagnostics affected = row_count; result := result || jsonb_build_object('profiles', affected);
  return result;
end; $$;
revoke all on function public.purge_soft_deleted_data(timestamptz) from public, anon, authenticated;

comment on table public.resume_versions is 'Immutable structured resume snapshots. Clients may read their own versions; only trusted server workflows create them.';
comment on table public.data_deletion_jobs is 'Tracks export and account deletion orchestration. Server-side processing is required to complete jobs.';
comment on function public.purge_soft_deleted_data(timestamptz) is 'Service-only retention helper. Default retention window is 30 days after soft deletion.';
