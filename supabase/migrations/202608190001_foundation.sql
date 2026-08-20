create extension if not exists pgcrypto with schema extensions;

create type public.resume_status as enum ('active', 'archived', 'deleted');
create type public.job_status as enum ('interested', 'saved', 'applied', 'recruiter_screen', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived');
create type public.team_role as enum ('owner', 'admin', 'reviewer', 'member');
create type public.request_status as enum ('requested', 'processing', 'completed', 'failed', 'cancelled');

create or replace function public.set_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = timezone('utc', now()); return new; end; $$;

create or replace function public.current_user_owns(owner uuid) returns boolean language sql stable security invoker set search_path = '' as $$
  select auth.uid() is not null and auth.uid() = owner;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  default_page_size text not null default 'letter' check (default_page_size in ('letter', 'a4')),
  default_template text,
  locale text not null default 'en',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('ai_provider', 'resume_storage', 'analytics')),
  granted boolean not null default false, policy_version text not null default '1',
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, consent_type)
);

create table public.account_usage (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null, analyses_count integer not null default 0 check (analyses_count >= 0), ai_generations_count integer not null default 0 check (ai_generations_count >= 0), exports_count integer not null default 0 check (exports_count >= 0),
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now()), unique(user_id, period_start)
);

create table public.data_deletion_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('export', 'delete')), status public.request_status not null default 'requested',
  error_code text, expires_at timestamptz, completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()), updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id, display_name) values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 120)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_user();

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger consents_updated before update on public.user_consents for each row execute function public.set_updated_at();
create trigger usage_updated before update on public.account_usage for each row execute function public.set_updated_at();
create trigger data_jobs_updated before update on public.data_deletion_jobs for each row execute function public.set_updated_at();

create index profiles_active_owner_idx on public.profiles(id) where deleted_at is null;
create index user_consents_owner_idx on public.user_consents(user_id);
create index account_usage_owner_period_idx on public.account_usage(user_id, period_start desc);
create index data_deletion_jobs_owner_created_idx on public.data_deletion_jobs(user_id, created_at desc);
