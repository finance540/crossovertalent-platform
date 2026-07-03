# Crossover Talent Production Setup Runbook

Date: July 3, 2026  
Status: Manual production setup package. Do not deploy publicly until all gates pass.

## Release Rule

Public production remains **blocked** until:

- Production Supabase is configured and validated.
- Production Vercel environment variables are configured.
- Resend email delivery passes.
- OpenAI live or fallback mode is approved and tested.
- Custom domain and SSL pass.
- Final smoke test passes.
- Final security negative tests pass.
- Product owner approves Go.

## Step 1 - Create Production Supabase Project

1. Open Supabase dashboard.
2. Create a new project named `crossover-talent-production`.
3. Use a production organization/account, not staging.
4. Save these values securely:
   - Project URL
   - Anon/public key
   - Service role key
5. Do not paste secrets into docs or chat.

Pass criteria:

- Production project exists.
- Staging and production projects are separate.
- Project URL and keys are available only in secure env management.

## Step 2 - Apply Production SQL Migrations

1. Open Supabase SQL Editor in the production project.
2. Use [supabase-staging-schema.sql](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/supabase-staging-schema.sql) as the base migration.
3. Before running, replace staging bucket names with production bucket names:
   - `crossover-cvs-staging` -> `crossover-cvs-production`
   - `crossover-job-descriptions-staging` -> `crossover-job-descriptions-production`
   - `crossover-company-logos-staging` -> `crossover-company-logos-production`
4. Run the SQL.
5. Confirm these tables exist:
   - `app_records`
   - `users`
   - `employer_profiles`
   - `jobseeker_profiles`
   - `companies`
   - `jobs`
   - `applications`
   - `saved_jobs`
   - `company_reviews`
   - `salary_signals`
   - `uploaded_files`

Pass criteria:

- SQL executes without errors.
- RLS is enabled.
- Required indexes exist.
- `app_records` is service-role-only.

## Step 3 - Create Production Storage Buckets

Create or verify:

| Bucket | Public | Purpose |
|---|---|---|
| `crossover-cvs-production` | No | Candidate CVs |
| `crossover-job-descriptions-production` | No | JD/source files |
| `crossover-company-logos-production` | Yes | Company logos |

Limits:

- CV/JD buckets: PDF, DOC, DOCX, TXT, max 5 MB.
- Logo bucket: PNG, JPG, WEBP, max 2 MB.
- Keep SVG disabled unless sanitizer is implemented.

Pass criteria:

- Private CV/JD objects cannot be opened publicly.
- Logo objects can be displayed publicly.
- Service role can upload to all three buckets.

## Step 4 - Configure RLS Policies

Required current runtime policy:

- `public.app_records`: service role can read/write.
- Anonymous/browser users cannot directly read `app_records`.
- Normalized tables remain service-role-only unless direct browser access is intentionally added and audited.

Run verification:

1. In Supabase SQL Editor, confirm RLS is enabled:

```sql
select relname, relrowsecurity
from pg_class
where relname in (
  'app_records',
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
);
```

2. Confirm `app_records` has no anonymous public-read policy.

Pass criteria:

- RLS enabled on all listed tables.
- `app_records` direct anon read fails.
- Server APIs still work with service role.

## Step 5 - Create Production Admin User

Recommended process:

1. Open the production app after environment setup.
2. Visit `/?admin=1`.
3. Register a production-approved admin email.
4. Verify through real email.
5. Log in as admin.
6. Confirm admin dashboard loads.
7. Confirm non-admin users cannot access `/api/admin`.

Pass criteria:

- One production admin exists.
- Admin email is verified through Resend.
- Admin can moderate a test review/job.
- Non-admin access is denied.

## Step 6 - Configure Backups

In Supabase:

- [ ] Enable automated backups.
- [ ] Confirm backup retention.
- [ ] Confirm point-in-time recovery availability.
- [ ] Document restore window.
- [ ] Confirm Storage backup/export strategy.

Pass criteria:

- Backup policy is documented.
- Restore procedure is known.
- Product owner knows RPO/RTO limits.

## Step 7 - Configure Vercel Production Environment Variables

In Vercel:

Project -> Settings -> Environment Variables -> Production

Add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_DRIVER=supabase`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REVIEW_MODERATION_EMAIL`
- `OPENAI_API_KEY`, if live AI is approved
- `OPENAI_MODEL=gpt-4.1-mini`
- `SUPABASE_CV_BUCKET=crossover-cvs-production`
- `SUPABASE_JD_BUCKET=crossover-job-descriptions-production`
- `SUPABASE_LOGO_BUCKET=crossover-company-logos-production`
- `SUPABASE_FILE_BUCKET=crossover-job-descriptions-production`
- `EMAIL_TIMEOUT_MS=8000`
- `ALLOW_SVG_LOGOS=false`
- `SENTRY_DSN`, if configured
- `POSTHOG_KEY`, if configured
- `POSTHOG_HOST=https://app.posthog.com`
- `GA_MEASUREMENT_ID`, if configured

Generate `SESSION_SECRET`:

```bash
openssl rand -base64 48
```

Pass criteria:

- Env vars are in Vercel Production only.
- No secrets are committed.
- Production deployment uses production Supabase URL.

## Step 8 - Configure Custom Domain And SSL

1. In Vercel, add the production custom domain.
2. Configure DNS records exactly as Vercel instructs.
3. Wait for DNS propagation.
4. Confirm SSL certificate is issued.
5. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS domain.
6. Add final domain to Supabase auth redirect URLs if Supabase Auth is used.

Pass criteria:

- `https://<production-domain>` loads.
- No SSL warnings.
- No redirect loop.
- Email links use production domain.

## Step 9 - Redeploy Production Candidate

After env vars and domain are configured:

1. Trigger a new Vercel Production deployment.
2. Confirm build passes.
3. Open production domain in incognito.
4. Run final validation checklist.
5. Run final security negative tests.

Pass criteria:

- Build passes.
- Smoke test passes.
- Security tests pass.
- Product owner signs Go.

