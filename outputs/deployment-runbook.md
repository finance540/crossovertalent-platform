# Crossover Talent Production Deployment Runbook

Date: July 3, 2026  
Environment: Production Release Candidate

## Preconditions

- Product owner approval captured.
- No open P0/P1 bugs.
- Production Supabase project created.
- Production schema and storage buckets applied.
- Production Vercel environment variables configured.
- Transactional email provider configured and verified.
- Custom domain configured.
- Final security/RLS audit complete.

## Required Vercel Production Environment Variables

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
- `OPENAI_MODEL`
- `SUPABASE_CV_BUCKET`
- `SUPABASE_JD_BUCKET`
- `SUPABASE_LOGO_BUCKET`
- `SUPABASE_FILE_BUCKET`
- `FILE_SCAN_PROVIDER`, if available
- `SENTRY_DSN`, if configured
- `POSTHOG_KEY`, if configured
- `POSTHOG_HOST`
- `GA_MEASUREMENT_ID`, if configured

## Deployment Steps

1. Confirm local checks pass:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
   - `npm run test`
2. Confirm `npm audit --omit=dev` returns no high/critical vulnerabilities.
3. Confirm production Supabase connection from a protected environment.
4. Deploy to Vercel Production.
5. Open the production custom domain in an incognito browser.
6. Run the production smoke test plan.
7. Check Vercel logs, Supabase logs, telemetry audit records, and browser console.
8. Keep release open for at least one hour of monitoring after launch.

## Post-Deployment Checks

- Homepage loads over HTTPS.
- Auth redirects use production domain.
- Verification emails arrive in real inboxes.
- Password reset emails arrive in real inboxes.
- CV/JD/logo uploads store in production Supabase Storage.
- OpenAI works or fallback messaging is clear.
- No major console errors.
- No P0/P1 bugs.

