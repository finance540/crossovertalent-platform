# Staging Infrastructure Runbook

## 1. Create Supabase Staging Project

Create a dedicated Supabase project for staging. Do not reuse production.

Required settings:

- Auth provider: Email/password enabled
- Email confirmation: enable if you want verification testing; disable temporarily only for automated seed runs
- Password reset: enabled in Supabase Auth email templates
- Region: choose the same broad region as the Vercel preview deployment if possible

## 2. Apply Database And Storage Schema

Run [supabase-staging-schema.sql](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/supabase-staging-schema.sql) in the Supabase staging SQL editor.

This creates:

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
- RLS policies
- Storage buckets:
  - `crossover-cvs-staging`
  - `crossover-job-descriptions-staging`
  - `crossover-company-logos-staging`

## 3. Configure Vercel Preview/Staging Env

Set these only for Preview/Staging:

```env
STORAGE_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=
```

Generate `SESSION_SECRET` with at least 32 random bytes:

```bash
openssl rand -base64 48
```

## 4. Validate Staging Infrastructure

```bash
npm run staging:preflight
npm run lint
npm run typecheck
npm run build
```

Current blocker: Vercel Preview deployment is protected, so staging workflow validation cannot be completed externally. The seed script expects JSON responses from `/api/*`; protected Preview HTML responses are a P0 staging blocker.

Before running workflow QA:

1. Disable Vercel Preview protection temporarily, or share/configure the Preview access password/token with the QA tester.
2. Redeploy the latest Preview build.
3. Open the Preview URL in an incognito browser and confirm access.
4. Confirm `/api/*` routes return app JSON instead of Vercel protection HTML.

## 5. Seed Staging Data

Run against the staging URL:

```bash
STAGING_APP_URL=https://your-vercel-preview-url.vercel.app npm run staging:seed
```

The seed creates:

- 1 admin account
- 3 employer accounts
- 10 candidate accounts
- 100 jobs
- 50 applications
- 20 company review records
- 20 salary signal records

## 6. Release Rule

Do not run feature QA or public deployment until:

- `npm run staging:preflight` passes
- Vercel Preview build passes
- Preview `/api/*` routes return app JSON, not Vercel protection HTML
- Seed completes successfully
- Employer signup/login, job posting, public listing, candidate signup/login, save job, CV application, employer application review/status update, and candidate status tracking all pass end to end
- No P0/P1 bugs are open
- The app has not been marked beta-ready while Preview access protection remains unresolved
