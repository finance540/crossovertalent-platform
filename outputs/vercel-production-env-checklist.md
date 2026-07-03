# Vercel Production Environment Checklist

Date: 2026-07-04

Status: **Pending manual configuration**

Production Supabase is configured and verified. The next gate is Vercel Production environment configuration.

## Where To Add Variables

Go to:

**Vercel -> Project -> Settings -> Environment Variables -> Production**

Add each variable below to the **Production** environment only unless explicitly needed elsewhere. Do not paste secret values into chat.

After adding or updating variables, trigger a fresh Production redeploy so the runtime receives them.

## Required Variables

| Variable | Required | Value / source | Secret? | Notes |
|---|---:|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://hntvcqahoseizmgswohq.supabase.co` | No | Production Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Production anon/publishable key from Supabase API settings | No | Required by docs/preflight and future client use. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Production service role key from Supabase API settings | Yes | Server-only. Never expose client-side. |
| `SESSION_SECRET` | Yes | Generate with `openssl rand -base64 48` | Yes | Must be unique to production. |
| `NEXT_PUBLIC_APP_URL` | Yes | Final production URL, e.g. `https://crossovertalent.asia` | No | Used for verification/reset links and redirects. |
| `RESEND_API_KEY` | Yes for production email | Resend production API key | Yes | Required for real verification/reset/notification email. |
| `RESEND_FROM_EMAIL` | Yes | `Crossover Talent <noreply@crossovertalent.asia>` or verified sender | No | App now supports this name. |
| `EMAIL_FROM` | Recommended compatibility | Same as `RESEND_FROM_EMAIL` | No | Existing code/docs compatibility. |
| `OPENAI_API_KEY` | Optional | Production OpenAI key if live AI is required | Yes | If omitted, AI features must show fallback. |
| `OPENAI_MODEL` | Recommended | `gpt-4.1-mini` | No | Used when `OPENAI_API_KEY` exists. |
| `STORAGE_DRIVER` | Yes | `supabase` | No | Forces Supabase storage instead of Vercel Blob. |
| `SUPABASE_CV_BUCKET` | Yes | `crossover-cvs-production` | No | Required by `/api/ready` in production. |
| `SUPABASE_JD_BUCKET` | Yes | `crossover-job-descriptions-production` | No | Required by `/api/ready` in production. |
| `SUPABASE_LOGO_BUCKET` | Yes | `crossover-company-logos-production` | No | Required by `/api/ready` in production. |
| `SUPABASE_FILE_BUCKET` | Yes | `crossover-job-descriptions-production` | No | Required by `/api/ready` in production. |
| `EMAIL_PROVIDER` | Optional | `resend` | No | Defaults to Resend if omitted. |
| `EMAIL_TIMEOUT_MS` | Optional | `8000` | No | Email provider timeout. |
| `ALLOW_SVG_LOGOS` | Recommended | `false` | No | Production bucket does not allow SVG logos. |
| `SENTRY_DSN` | Optional | Production Sentry DSN | Secret-ish | Required only if Sentry is enabled. |
| `POSTHOG_KEY` | Optional | Production PostHog key | No | Analytics only if enabled. |
| `GA_MEASUREMENT_ID` | Optional | GA4 measurement ID | No | Analytics only if enabled. |

## Bucket Verification

Production Supabase buckets exist and were verified:

| Bucket | Visibility | App env var |
|---|---|---|
| `crossover-cvs-production` | Private | `SUPABASE_CV_BUCKET` |
| `crossover-job-descriptions-production` | Private | `SUPABASE_JD_BUCKET`, `SUPABASE_FILE_BUCKET` |
| `crossover-company-logos-production` | Public | `SUPABASE_LOGO_BUCKET` |

Important: API code falls back to staging bucket names if bucket env vars are missing. The production readiness endpoint now blocks production readiness unless these exact production bucket variables are configured.

## Expected `/api/ready` Checks

After redeploy, `/api/ready` should return HTTP `200` with:

- `storage: true`
- `database: true`
- `sessionSecret: true`
- `appUrl: true`
- `cvBucket: true`
- `jdBucket: true`
- `logoBucket: true`
- `fileBucket: true`

## Manual Confirmation Needed

Before redeploy, confirm:

- [ ] All required variables are present in Vercel Production.
- [ ] Secret values are not committed to the repo.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is not prefixed with `NEXT_PUBLIC_`.
- [ ] `NEXT_PUBLIC_APP_URL` matches the final production domain.
- [ ] Resend sender/domain is verified.
- [ ] Product owner decided whether `OPENAI_API_KEY` is required for live AI or fallback-only AI is acceptable.

