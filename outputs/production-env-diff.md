# Production Environment Variable Diff

Date: 2026-07-04

Mode: Read-only. No secrets printed.

## Actual Vercel Production Env Vars

Command:

```bash
vercel env ls production --scope cot-s-projects1
```

Actual result:

| Variable | Status |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Present, encrypted |

## Expected Vercel Production Env Vars

| Variable | Expected | Actual | Status |
|---|---|---|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hntvcqahoseizmgswohq.supabase.co` | Missing | P0 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon/publishable key | Missing | P0 |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key, server-only | Missing | P0 |
| `SESSION_SECRET` | 32+ byte production secret | Missing | P0 |
| `NEXT_PUBLIC_APP_URL` | Final production URL | Missing | P0 |
| `STORAGE_DRIVER` | `supabase` | Missing | P0 |
| `SUPABASE_CV_BUCKET` | `crossover-cvs-production` | Missing | P0 |
| `SUPABASE_JD_BUCKET` | `crossover-job-descriptions-production` | Missing | P0 |
| `SUPABASE_LOGO_BUCKET` | `crossover-company-logos-production` | Missing | P0 |
| `SUPABASE_FILE_BUCKET` | `crossover-job-descriptions-production` | Missing | P0 |
| `RESEND_API_KEY` | Production Resend API key | Missing | P1 |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Crossover Talent <noreply@crossovertalent.asia>` | Missing | P1 |
| `EMAIL_FROM` | Compatibility sender value | Missing | P2 |
| `OPENAI_API_KEY` | Required only if live AI is required | Missing | Product decision |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Missing | P2 |
| `ALLOW_SVG_LOGOS` | `false` | Missing | P2 |
| `EMAIL_TIMEOUT_MS` | `8000` | Missing | P3 |

## Incorrect / Deprecated / Risky Vars

| Variable | Finding | Recommendation |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Present in Production, Preview, Development. This causes the app to use Vercel Blob fallback when Supabase vars are missing. | Keep only if needed for fallback, but production must set `STORAGE_DRIVER=supabase` and Supabase vars. Consider removing after Supabase production smoke passes. |

## Why Old Jobs/Reviews Appear

The app chooses storage driver using this logic:

```js
if STORAGE_DRIVER is set, use it.
otherwise, if NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist, use Supabase.
otherwise, use Vercel Blob.
```

Because production has `BLOB_READ_WRITE_TOKEN` but no Supabase vars, the live app is reading Vercel Blob data. That explains old jobs/reviews despite production Supabase tables being empty.

## Env Diff Decision

**FAIL**

Production env is not configured for the verified production Supabase project.

