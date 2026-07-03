# Deployment Guide

## Environments

Recommended environments:
- Local
- Vercel Preview / Staging
- Vercel Production

Production must remain blocked until manual infrastructure gates pass.

## Vercel Production Variables

Configure in Vercel Project Settings:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_DRIVER=supabase`
- `SENTRY_DSN`
- `SUPABASE_CV_BUCKET`
- `SUPABASE_JD_BUCKET`
- `SUPABASE_LOGO_BUCKET`

## Supabase Production Setup

1. Create production Supabase project.
2. Apply production SQL migrations.
3. Enable email/password auth.
4. Configure RLS policies.
5. Create storage buckets for CVs, job descriptions, and logos.
6. Configure backup schedule.
7. Create production admin users.
8. Run security negative tests.

## Email Setup

1. Create Resend project.
2. Verify sending domain.
3. Add DNS records.
4. Add `RESEND_API_KEY`.
5. Test verification, password reset, employer notification, and candidate notification emails.

## AI Setup

1. Add `OPENAI_API_KEY`.
2. Confirm JD generation and CV revision work.
3. Confirm fallback behavior by testing without the key in staging.
4. Confirm logs never expose API keys or prompt-sensitive user data.

## Deployment Gate

Before production:
- CI passes.
- Vercel production build passes.
- `/api/health` returns healthy.
- `/api/ready` returns ready.
- Production smoke test passes.
- Security negative tests pass.
- Sentry receives test error.
- Email success rate is confirmed.

## Rollback

If a production issue occurs:
1. Use Vercel rollback to the last passing deployment.
2. Disable public launch traffic if needed.
3. Check Sentry and admin reliability dashboard.
4. Preserve audit logs.
5. Run smoke test after rollback.
