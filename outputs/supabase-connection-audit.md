# Supabase Connection Audit

Date: 2026-07-04

Mode: Read-only. No secrets printed.

## Verified Production Supabase

| Field | Value |
|---|---|
| Project name | `crossover-talent-production` |
| Project ref | `hntvcqahoseizmgswohq` |
| URL | `https://hntvcqahoseizmgswohq.supabase.co` |
| Region | `ap-southeast-2` |
| Status | Active/healthy |
| App tables | Present |
| RLS | Enabled |
| Policies | Present |
| Buckets | Present |
| App records | 0 rows after migration |

## Expected Production Buckets

| Bucket | Status in Supabase | Expected app env |
|---|---:|---|
| `crossover-cvs-production` | Present | `SUPABASE_CV_BUCKET` |
| `crossover-job-descriptions-production` | Present | `SUPABASE_JD_BUCKET`, `SUPABASE_FILE_BUCKET` |
| `crossover-company-logos-production` | Present | `SUPABASE_LOGO_BUCKET` |

## Deployed App Supabase Target

| Check | Result |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` in Vercel Production | Missing |
| `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production | Missing |
| `STORAGE_DRIVER` in Vercel Production | Missing |
| Supabase anon key fingerprint | Not available because key is not configured |
| Auth URL target | Not configured in Vercel Production |
| Bucket env target | Not configured in Vercel Production |

## Actual Data Source In Live App

Actual live data source is **not production Supabase**.

Evidence:

- Vercel Production env contains `BLOB_READ_WRITE_TOKEN`.
- Vercel Production env does not contain Supabase URL/service key.
- `/api/jobs?public=1` returns old jobs.
- `/api/reviews` returns old reviews.
- Verified production Supabase app tables had zero rows before validation.

Conclusion: the live app is using Vercel Blob fallback data.

## Target Classification

| Candidate target | Result |
|---|---:|
| Production Supabase `hntvcqahoseizmgswohq` | No |
| Staging Supabase `qpdouyshrbfvqejguqqq` | No direct evidence |
| Another Supabase project | No evidence |
| Vercel Blob / old backend data | Yes |

## Required Fix

In Vercel Production, set:

```env
STORAGE_DRIVER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://hntvcqahoseizmgswohq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon/publishable key>
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
SUPABASE_CV_BUCKET=crossover-cvs-production
SUPABASE_JD_BUCKET=crossover-job-descriptions-production
SUPABASE_LOGO_BUCKET=crossover-company-logos-production
SUPABASE_FILE_BUCKET=crossover-job-descriptions-production
```

Then redeploy Production and verify:

- `/api/ready` returns `database: true`, `storage: true`, and all bucket checks true.
- `/api/jobs?public=1` initially returns `[]` from production Supabase unless production data has been added.
- `/api/reviews` initially returns `[]` from production Supabase unless production reviews have been added.

