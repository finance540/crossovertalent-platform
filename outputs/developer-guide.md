# Developer Guide

## Project Shape

CrossOver Talent is a Vercel serverless application with:
- Static SPA assets in `outputs/`.
- API routes in `api/`.
- Playwright E2E tests in `tests/e2e/`.
- QA and seed scripts in `scripts/`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Run local Vercel dev:

```bash
npx vercel dev --listen 127.0.0.1:3000
```

4. Open:

```text
http://127.0.0.1:3000
```

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_DRIVER`
- `SENTRY_DSN`

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## API Patterns

- All API routes set security headers.
- Mutating requests enforce same-origin checks.
- Auth state uses an HttpOnly session cookie.
- Server routes use `ensureStorage()` before reading/writing records.
- Product analytics use `productEvent()`.
- Security/compliance logs use `auditLog()`.
- Errors use `serverError()` and Sentry capture when configured.

## Testing

E2E tests cover:
- Employer signup, verification, login, company profile, job posting, and application review.
- Candidate signup, verification, login, job saving, applying, and application status tracking.
- Admin login, moderation, user management.
- Public search, filters, company listing, and job detail.

Install the Chromium browser once with `npx playwright install chromium`, then run `npm run test:e2e`. Playwright starts a local Node server with isolated file storage; no Vercel, Supabase, or email-provider credentials are needed. To test a deployed environment instead, set `PLAYWRIGHT_BASE_URL` or `STAGING_APP_URL` to its URL.

## Secure CV Storage

- CV objects are stored in private Supabase Storage buckets in configured deployments. The default buckets are `crossover-cvs-staging` and `crossover-cvs-production`; set `SUPABASE_CV_BUCKET` only when using a different private bucket.
- Provide `NEXT_PUBLIC_SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). The storage service role key must never be exposed to browser code.
- CV object storage is selected separately from the record database. It automatically uses Supabase when Supabase credentials are configured, even if `STORAGE_DRIVER` is set to `blob`; `PRIVATE_FILE_STORAGE_DRIVER=supabase` can make that choice explicit. The default local E2E setup uses local files and signed, expiring tokens.
- Upload metadata is stored with the existing record storage driver. CV downloads go through `/api/files`, which authorizes the candidate owner or an approved employer with an application at their company, then issues an access link that expires within five minutes.
- Existing CV buckets must be private. The server rejects a configured Supabase bucket if it is public. Never make CV buckets public or expose object paths as download links.

## Development Rules

- Do not hardcode secrets.
- Do not bypass email verification in production.
- Do not expose service role keys client-side.
- Keep uploads size/type validated.
- Add product analytics for new commercial funnels.
- Add Playwright coverage for any changed critical workflow.
