alter table public.resumes
  add column editor_version integer not null default 0 check (editor_version >= 0);

create index if not exists resumes_owner_editor_version_idx
  on public.resumes(owner_id, id, editor_version);

create or replace function public.save_resume_document(
  target_resume_id uuid,
  expected_editor_version integer,
  next_title text,
  next_structured_data jsonb
) returns public.resumes
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.resumes;
begin
  if jsonb_typeof(next_structured_data) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_DOCUMENT';
  end if;

  update public.resumes
  set title = left(trim(next_title), 160),
      structured_data = next_structured_data,
      editor_version = editor_version + 1,
      updated_at = timezone('utc', now())
  where id = target_resume_id
    and owner_id = auth.uid()
    and editor_version = expected_editor_version
    and deleted_at is null
  returning * into saved;

  if saved.id is null then
    if exists (select 1 from public.resumes where id = target_resume_id and owner_id = auth.uid()) then
      raise exception using errcode = '40001', message = 'SAVE_CONFLICT';
    end if;
    raise exception using errcode = '42501', message = 'RESUME_NOT_FOUND';
  end if;
  return saved;
end;
$$;

create or replace function public.create_resume_version(
  target_resume_id uuid,
  version_label text default null
) returns public.resume_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_resume public.resumes;
  prior public.resume_versions;
  created public.resume_versions;
  next_version integer;
begin
  select * into source_resume from public.resumes
  where id = target_resume_id and owner_id = auth.uid() and deleted_at is null;
  if source_resume.id is null then
    raise exception using errcode = '42501', message = 'RESUME_NOT_FOUND';
  end if;

  select * into prior from public.resume_versions
  where resume_id = target_resume_id and owner_id = auth.uid()
  order by version_number desc limit 1;
  if prior.id is not null and prior.snapshot = source_resume.structured_data then
    return prior;
  end if;

  next_version := coalesce(prior.version_number, 0) + 1;
  insert into public.resume_versions(owner_id, resume_id, version_number, snapshot, reason)
  values (auth.uid(), target_resume_id, next_version, source_resume.structured_data, nullif(left(trim(version_label), 120), ''))
  returning * into created;

  delete from public.resume_versions
  where id in (
    select id from public.resume_versions
    where resume_id = target_resume_id and owner_id = auth.uid()
    order by version_number desc offset 20
  );
  return created;
end;
$$;

revoke all on function public.save_resume_document(uuid, integer, text, jsonb) from public, anon;
grant execute on function public.save_resume_document(uuid, integer, text, jsonb) to authenticated;
revoke all on function public.create_resume_version(uuid, text) from public, anon;
grant execute on function public.create_resume_version(uuid, text) to authenticated;

comment on column public.resumes.editor_version is 'Monotonic optimistic-concurrency token for structured editor writes.';
comment on function public.create_resume_version(uuid, text) is 'Creates a deduplicated immutable snapshot and retains the latest 20 per owned resume.';
