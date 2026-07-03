-- Crossover Talent staging schema
-- Run this in the Supabase SQL editor for the dedicated staging project.
--
-- This file includes:
-- 1. The app_records service-role table used by the current serverless APIs.
-- 2. Normalized production-equivalent tables for staging QA/reporting.
-- 3. RLS policies.
-- 4. Storage buckets for CVs, job descriptions, and company logos.

create extension if not exists pgcrypto;

-- Current API storage adapter table. Server APIs access this with service role only.
create table if not exists public.app_records (
  path text primary key,
  record_type text not null default 'record',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_records_path_pattern_idx
  on public.app_records (path text_pattern_ops);

create index if not exists app_records_record_type_idx
  on public.app_records (record_type);

create index if not exists app_records_data_gin_idx
  on public.app_records using gin (data);

create or replace function public.set_app_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_records_updated_at on public.app_records;
create trigger app_records_updated_at
before update on public.app_records
for each row
execute function public.set_app_records_updated_at();

alter table public.app_records enable row level security;

drop policy if exists "app_records_service_role_all" on public.app_records;
create policy "app_records_service_role_all"
on public.app_records
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "app_records_no_anon_access" on public.app_records;
create policy "app_records_no_anon_access"
on public.app_records
for select
using (false);

comment on table public.app_records is
  'Staging key-value record store used by Crossover Talent serverless APIs. Access is service-role only; no browser/client direct reads.';

-- Normalized staging tables.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  role text not null check (role in ('admin', 'employer', 'candidate')),
  email text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  company_name text not null,
  company_domain text,
  sector text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobseeker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  linkedin_url text,
  resume_text text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sector text,
  location text,
  website text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.employer_profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  department text,
  location text not null,
  work_type text not null,
  level text,
  sector text,
  salary_range text,
  impact_area text,
  description text not null,
  status text not null default 'active' check (status in ('active', 'closed', 'draft')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  candidate_id uuid references public.jobseeker_profiles(id) on delete set null,
  candidate_email text not null,
  candidate_name text not null,
  linkedin_url text,
  cover_letter text not null,
  cv_file_id uuid,
  status text not null default 'applied' check (status in ('applied', 'shortlisted', 'interview', 'offered', 'rejected', 'hired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_email)
);

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.jobseeker_profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (candidate_id, job_id)
);

create table if not exists public.company_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  sector text,
  role text not null,
  location text not null,
  rating int not null check (rating between 1 and 5),
  headline text not null,
  pros text not null,
  cons text not null,
  advice text,
  display_mode text not null default 'anonymous' check (display_mode in ('anonymous', 'name', 'linkedin')),
  reviewer_label text,
  reviewer_linkedin text,
  verified_domain text,
  created_at timestamptz not null default now()
);

create table if not exists public.salary_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  company_name text not null,
  role text not null,
  location text not null,
  level text not null,
  sector text,
  work_type text,
  currency text not null default 'USD',
  salary_min numeric not null,
  salary_max numeric not null,
  note text,
  created_at timestamptz not null default now(),
  check (salary_min > 0),
  check (salary_max >= salary_min)
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.users(id) on delete set null,
  bucket text not null,
  object_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  parsed_text text,
  created_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users(role);
create index if not exists jobs_status_sector_location_idx on public.jobs(status, sector, location);
create index if not exists jobs_search_gin_idx on public.jobs using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(sector, '') || ' ' || coalesce(location, '')));
create index if not exists applications_job_status_idx on public.applications(job_id, status);
create index if not exists reviews_company_sector_idx on public.company_reviews(company_name, sector);
create index if not exists salary_company_role_idx on public.salary_signals(company_name, role, location, level);

alter table public.users enable row level security;
alter table public.employer_profiles enable row level security;
alter table public.jobseeker_profiles enable row level security;
alter table public.companies enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.company_reviews enable row level security;
alter table public.salary_signals enable row level security;
alter table public.uploaded_files enable row level security;

-- Server-side APIs use the service role. Browser clients should not directly access these staging tables yet.
do $$
declare
  t text;
begin
  foreach t in array array[
    'users',
    'employer_profiles',
    'jobseeker_profiles',
    'companies',
    'jobs',
    'applications',
    'saved_jobs',
    'company_reviews',
    'salary_signals',
    'uploaded_files'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_service_role_all', t);
    execute format(
      'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
      t || '_service_role_all',
      t
    );
  end loop;
end $$;

-- Public read policies for marketplace-safe aggregate data if future browser clients use Supabase directly.
drop policy if exists jobs_public_active_read on public.jobs;
create policy jobs_public_active_read
on public.jobs
for select
using (status = 'active');

drop policy if exists companies_public_read on public.companies;
create policy companies_public_read
on public.companies
for select
using (true);

drop policy if exists reviews_public_read on public.company_reviews;
create policy reviews_public_read
on public.company_reviews
for select
using (true);

drop policy if exists salary_public_read on public.salary_signals;
create policy salary_public_read
on public.salary_signals
for select
using (true);

-- Storage buckets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('crossover-cvs-staging', 'crossover-cvs-staging', false, 5242880, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]),
  ('crossover-job-descriptions-staging', 'crossover-job-descriptions-staging', false, 5242880, array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]),
  ('crossover-company-logos-staging', 'crossover-company-logos-staging', true, 2097152, array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml'
  ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_service_role_all_staging on storage.objects;
create policy storage_service_role_all_staging
on storage.objects
for all
using (
  auth.role() = 'service_role'
  and bucket_id in ('crossover-cvs-staging', 'crossover-job-descriptions-staging', 'crossover-company-logos-staging')
)
with check (
  auth.role() = 'service_role'
  and bucket_id in ('crossover-cvs-staging', 'crossover-job-descriptions-staging', 'crossover-company-logos-staging')
);

drop policy if exists company_logos_public_read_staging on storage.objects;
create policy company_logos_public_read_staging
on storage.objects
for select
using (bucket_id = 'crossover-company-logos-staging');
