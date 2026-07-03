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
- Employer signup, verification, login, company/logo, job posting, status changes.
- Candidate signup, verification, login, CV upload, save, apply, withdraw.
- Admin login, moderation, user management.
- Public search, filters, company listing, and job detail.

Use a staging or local environment with isolated storage for E2E runs.

## Development Rules

- Do not hardcode secrets.
- Do not bypass email verification in production.
- Do not expose service role keys client-side.
- Keep uploads size/type validated.
- Add product analytics for new commercial funnels.
- Add Playwright coverage for any changed critical workflow.
