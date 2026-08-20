create table public.resumes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_guest_id uuid, title text not null default 'Untitled resume' check (char_length(title) between 1 and 160), status public.resume_status not null default 'active',
  structured_data jsonb not null default '{"sections":[]}'::jsonb check (jsonb_typeof(structured_data) = 'object'), imported_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz,
  unique(owner_id, source_guest_id)
);

create table public.resume_sections (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade, section_type text not null, heading text not null, position integer not null check (position >= 0), visible boolean not null default true,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz,
  unique(resume_id, position)
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade, version_number integer not null check (version_number > 0), snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'), reason text,
  created_at timestamptz not null default timezone('utc', now()), unique(resume_id, version_number)
);

create or replace function public.prevent_resume_version_mutation() returns trigger language plpgsql security invoker set search_path = '' as $$ begin raise exception 'resume versions are immutable'; end; $$;
create trigger immutable_resume_versions before update or delete on public.resume_versions for each row execute function public.prevent_resume_version_mutation();

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled job', company text, location text, structured_data jsonb not null default '{}'::jsonb, source_text text,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz
);
create table public.resume_job_targets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade, job_description_id uuid not null references public.job_descriptions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(resume_id, job_description_id)
);
create table public.analyses (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade, job_description_id uuid references public.job_descriptions(id) on delete set null,
  engine_version text not null, overall_score smallint check (overall_score between 0 and 100), summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz
);
create table public.user_confirmed_facts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade, fact_type text not null, fact_value text not null, source_section_id uuid references public.resume_sections(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz
);
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete cascade, purpose text not null, provider text not null, model text not null, status text not null,
  input_fingerprint text, output_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), deleted_at timestamptz
);

create trigger resumes_updated before update on public.resumes for each row execute function public.set_updated_at();
create trigger sections_updated before update on public.resume_sections for each row execute function public.set_updated_at();
create trigger jobs_updated before update on public.job_descriptions for each row execute function public.set_updated_at();
create trigger targets_updated before update on public.resume_job_targets for each row execute function public.set_updated_at();
create trigger analyses_updated before update on public.analyses for each row execute function public.set_updated_at();
create trigger facts_updated before update on public.user_confirmed_facts for each row execute function public.set_updated_at();
create trigger generations_updated before update on public.ai_generations for each row execute function public.set_updated_at();

create index resumes_owner_updated_idx on public.resumes(owner_id, updated_at desc);
create index resume_sections_owner_resume_idx on public.resume_sections(owner_id, resume_id, position);
create index resume_versions_owner_resume_idx on public.resume_versions(owner_id, resume_id, version_number desc);
create index job_descriptions_owner_updated_idx on public.job_descriptions(owner_id, updated_at desc);
create index resume_job_targets_owner_idx on public.resume_job_targets(owner_id);
create index analyses_owner_resume_idx on public.analyses(owner_id, resume_id, created_at desc);
create index facts_owner_resume_idx on public.user_confirmed_facts(owner_id, resume_id);
create index generations_owner_created_idx on public.ai_generations(owner_id, created_at desc);
