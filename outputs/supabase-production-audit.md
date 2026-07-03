# Supabase Production Audit

Date: 2026-07-04

Mode: Production configuration changed only as requested. No staging data was copied. No public deployment was performed.

## Executive Status

**Production Supabase status: GO for infrastructure**

The production Supabase project is now configured with the required application schema, indexes, foreign keys, RLS policies, storage buckets, and migration history.

Overall product release remains gated by non-Supabase production checks: Vercel production environment variables, Resend/email verification, backup/restore dashboard confirmation, and final production smoke/security tests.

## Project Inventory

| Environment | Project name | Project ref | Region | Organization | Status | Database |
|---|---|---|---|---|---|---|
| Staging | `crossovertalent-staging` | `qpdouyshrbfvqejguqqq` | `ap-south-1` | `isksatgrglrlzrlmdojh` | `ACTIVE_HEALTHY` | Postgres 17.6.1.141 |
| Production | `crossover-talent-production` | `hntvcqahoseizmgswohq` | `ap-southeast-2` | `isksatgrglrlzrlmdojh` | `ACTIVE_HEALTHY` | Postgres 17.6.1.141 |

## Migration Applied

Local migration:

- `supabase/migrations/20260703162517_production_app_schema.sql`

Migration history:

| Local | Remote | Status |
|---|---|---|
| `20260703162517` | `20260703162517` | Applied |

Note: `supabase db push --dry-run` hung during login initialization, so the reviewed migration SQL was applied with `supabase db query --linked --file`, then migration history was repaired with `supabase migration repair --linked --status applied 20260703162517`.

## Production Tables

Verified `public` app tables:

- `app_records`
- `applications`
- `companies`
- `company_reviews`
- `employer_profiles`
- `jobs`
- `jobseeker_profiles`
- `salary_signals`
- `saved_jobs`
- `uploaded_files`
- `users`

## No Data Copied

Verified production row counts:

| Table | Rows |
|---|---:|
| `app_records` | 0 |
| `applications` | 0 |
| `companies` | 0 |
| `company_reviews` | 0 |
| `employer_profiles` | 0 |
| `jobs` | 0 |
| `jobseeker_profiles` | 0 |
| `salary_signals` | 0 |
| `saved_jobs` | 0 |
| `uploaded_files` | 0 |
| `users` | 0 |

Auth users: `0`.

## RLS Status

RLS is enabled on all production app tables:

- `app_records`
- `applications`
- `companies`
- `company_reviews`
- `employer_profiles`
- `jobs`
- `jobseeker_profiles`
- `salary_signals`
- `saved_jobs`
- `uploaded_files`
- `users`

Storage-managed tables also have RLS enabled.

## Policies

Verified app policies:

- `app_records_no_anon_access`
- `app_records_service_role_all`
- `applications_service_role_all`
- `companies_public_read`
- `companies_service_role_all`
- `company_reviews_service_role_all`
- `reviews_public_read`
- `employer_profiles_service_role_all`
- `jobs_public_active_read`
- `jobs_service_role_all`
- `jobseeker_profiles_service_role_all`
- `salary_public_read`
- `salary_signals_service_role_all`
- `saved_jobs_service_role_all`
- `uploaded_files_service_role_all`
- `users_service_role_all`

Verified storage policies:

- `storage_service_role_all_production`
- `company_logos_public_read_production`

## Foreign Keys

Verified production FKs:

- `applications.candidate_id -> jobseeker_profiles.id` on delete set null
- `applications.job_id -> jobs.id` on delete cascade
- `company_reviews.company_id -> companies.id` on delete set null
- `employer_profiles.user_id -> users.id` on delete cascade
- `jobs.company_id -> companies.id` on delete set null
- `jobs.employer_id -> employer_profiles.id` on delete set null
- `jobseeker_profiles.user_id -> users.id` on delete cascade
- `salary_signals.company_id -> companies.id` on delete set null
- `saved_jobs.candidate_id -> jobseeker_profiles.id` on delete cascade
- `saved_jobs.job_id -> jobs.id` on delete cascade
- `uploaded_files.owner_user_id -> users.id` on delete set null

## Indexes

Verified production indexes include:

- `app_records_data_gin_idx`
- `app_records_path_pattern_idx`
- `app_records_record_type_idx`
- `applications_job_status_idx`
- `jobs_search_gin_idx`
- `jobs_status_sector_location_idx`
- `reviews_company_sector_idx`
- `salary_company_role_idx`
- `users_role_idx`
- Primary and unique indexes for app tables

## Storage Buckets

Verified production buckets:

| Bucket | Public | File size limit | MIME types |
|---|---:|---:|---|
| `crossover-company-logos-production` | true | 2 MB | `image/png`, `image/jpeg`, `image/webp` |
| `crossover-cvs-production` | false | 5 MB | PDF, DOC, DOCX, TXT |
| `crossover-job-descriptions-production` | false | 5 MB | PDF, DOC, DOCX, TXT |

Production intentionally excludes SVG logos because the application has `ALLOW_SVG_LOGOS=false` by default.

## Edge Functions

Production Edge Functions:

```json
[]
```

Accepted if Vercel API routes remain the backend runtime.

## Extensions

Verified production extensions:

- `pg_stat_statements` 1.11
- `pgcrypto` 1.3
- `plpgsql` 1.0
- `supabase_vault` 0.3.1
- `uuid-ossp` 1.1

## Authentication Providers

Database-side auth state verified:

- Auth users: `0`

Dashboard-only checks still required:

- Email/password enabled
- Email verification enabled
- Password reset URLs
- Site URL and redirect URLs
- SMTP/Resend integration if Supabase Auth email will use a custom sender

## Backup Configuration

Backup/PITR settings are not exposed through the CLI/SQL checks used here. Confirm in Supabase Dashboard before launch.

## Vercel Production Environment Values

Configure these in Vercel Production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hntvcqahoseizmgswohq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon or publishable key>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key if used>
SUPABASE_SERVICE_ROLE_KEY=<production service role key, server-only>
SUPABASE_CV_BUCKET=crossover-cvs-production
SUPABASE_JD_BUCKET=crossover-job-descriptions-production
SUPABASE_LOGO_BUCKET=crossover-company-logos-production
SUPABASE_FILE_BUCKET=crossover-job-descriptions-production
STORAGE_DRIVER=supabase
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` client-side.

## Release Gate Decision

**Supabase infrastructure: GO**

**Overall production release: NO-GO until remaining production gates pass.**

