# Crossover Talent Production Supabase Setup

Date: July 3, 2026  
Status: **Ready to apply manually; production validation still required.**

## Setup Goal

Create a dedicated production Supabase project separate from staging. Apply the schema, RLS policies, indexes, storage buckets, admin seed process, backup plan, and restore procedure before public production.

## Step 1 - Create Production Project

1. Create a new Supabase project named `crossover-talent-production`.
2. Do not reuse the staging project.
3. Record these values in Vercel Production env only:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Enable Email/Password auth if Supabase Auth will be used directly later.
5. Add production app URL to Auth redirect URLs.

## Step 2 - Apply Tables And Indexes

Use the existing schema in:

`outputs/supabase-staging-schema.sql`

For production, change bucket names from `*-staging` to `*-production` before applying, or set env vars to the staging names only if intentionally testing non-production.

Required live table for current APIs:

- `public.app_records`

Production-equivalent normalized tables included for migration/reporting:

- `public.users`
- `public.employer_profiles`
- `public.jobseeker_profiles`
- `public.companies`
- `public.jobs`
- `public.applications`
- `public.saved_jobs`
- `public.company_reviews`
- `public.salary_signals`
- `public.uploaded_files`

Recommended additional production audit table:

```sql
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  actor_hash text,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_event_created_idx
  on public.audit_logs(event, created_at desc);
```

Note: The current app writes audit logs into `app_records/audit-logs/...`; the normalized `audit_logs` table is recommended for the next migration step.

## Step 3 - RLS Policies

Current live API model:

- Serverless APIs use `SUPABASE_SERVICE_ROLE_KEY`.
- `public.app_records` should allow service role only.
- Browser users should not directly access `app_records`.

Required policy:

```sql
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
```

Normalized tables should keep service-role-only policies until direct Supabase browser access is intentionally implemented and audited.

## Step 4 - Storage Buckets

Create production buckets:

| Bucket | Public | Purpose |
|---|---|---|
| `crossover-cvs-production` | No | Candidate CV uploads |
| `crossover-job-descriptions-production` | No | JD/source uploads |
| `crossover-company-logos-production` | Yes | Public company logos |

Apply MIME and size limits:

- CV/JD: PDF, DOC, DOCX, TXT; 5 MB max.
- Logos: PNG, JPG, WEBP; 2 MB max.
- SVG should remain disabled unless an SVG sanitizer is implemented.

Service-role storage policy:

```sql
drop policy if exists storage_service_role_all_production on storage.objects;
create policy storage_service_role_all_production
on storage.objects
for all
using (
  auth.role() = 'service_role'
  and bucket_id in ('crossover-cvs-production', 'crossover-job-descriptions-production', 'crossover-company-logos-production')
)
with check (
  auth.role() = 'service_role'
  and bucket_id in ('crossover-cvs-production', 'crossover-job-descriptions-production', 'crossover-company-logos-production')
);
```

Public logo read policy:

```sql
drop policy if exists company_logos_public_read_production on storage.objects;
create policy company_logos_public_read_production
on storage.objects
for select
using (bucket_id = 'crossover-company-logos-production');
```

## Step 5 - Seed/Admin Setup

Recommended production admin setup:

1. Create one initial admin through the app using a controlled admin email pattern or temporary admin-creation process.
2. Verify the admin email through Resend.
3. Log in to `/ ?admin=1`.
4. Disable temporary admin-registration access if a stricter invite-only flow is implemented.

Production admin account checklist:

- [ ] Admin account created.
- [ ] Admin email verified through real inbox.
- [ ] Admin login works.
- [ ] Non-admin access denied.
- [ ] Admin can moderate test review/job.

## Step 6 - Backup Configuration

- [ ] Enable Supabase automated backups.
- [ ] Confirm retention period.
- [ ] Confirm point-in-time recovery availability for plan tier.
- [ ] Document backup schedule.
- [ ] Export schema after production setup.
- [ ] Confirm Storage backup/export strategy.

## Step 7 - Restore Procedure

1. Identify incident time and desired restore timestamp.
2. Restore to a separate recovery project first if possible.
3. Validate app records, users, jobs, applications, reviews, salary signals, and uploaded files.
4. If valid, restore/replace production according to Supabase plan capabilities.
5. Update Vercel env vars only if project URL/keys change.
6. Run full production smoke test.
7. Record incident and restore timeline.

## Production Supabase Gate Result

Current result: **BLOCKED**  
Reason: Production Supabase project/buckets/backups have not been verified from this workspace.

