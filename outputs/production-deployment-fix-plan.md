# Production Deployment Fix Plan

Date: 2026-07-04

Goal: make the live production deployment use the verified production Supabase infrastructure.

No public launch should be approved until all P0/P1 blockers are closed and revalidated.

## Blocker 1: Missing Vercel Production Env Vars

| Field | Detail |
|---|---|
| Severity | P0 |
| Root cause | Vercel Production currently has only `BLOB_READ_WRITE_TOKEN`; Supabase/session/email/storage vars are missing. |
| Required action | Add production env vars in Vercel. |
| Where | Vercel -> Project -> Settings -> Environment Variables -> Production |
| Expected verification | `vercel env ls production` lists required variable names; `/api/ready` passes after redeploy. |
| Estimated effort | 15-30 minutes |

Required minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `STORAGE_DRIVER=supabase`
- `SUPABASE_CV_BUCKET=crossover-cvs-production`
- `SUPABASE_JD_BUCKET=crossover-job-descriptions-production`
- `SUPABASE_LOGO_BUCKET=crossover-company-logos-production`
- `SUPABASE_FILE_BUCKET=crossover-job-descriptions-production`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Blocker 2: Production Deployment Is Old

| Field | Detail |
|---|---|
| Severity | P0 |
| Root cause | Current production deployment was built from an older snapshot that lacks current API routes and newer `vercel.json` rewrites/headers. |
| Required action | Redeploy Production from the current workspace/code after env vars are set. |
| Where | Vercel CLI or Vercel Dashboard Deployments |
| Expected verification | Deployment JSON includes all current API routes including `api/company`, `api/health`, `api/ready`, `api/feedback`, `api/telemetry`, and `api/verify`. |
| Estimated effort | 10-20 minutes |

Do not deploy until env vars are correct.

## Blocker 3: Health/Ready Routes 404

| Field | Detail |
|---|---|
| Severity | P0 |
| Root cause | Current production deployment does not include `api/health.js` or `api/ready.js`. |
| Required action | Redeploy current code. |
| Where | Vercel production deployment |
| Expected verification | `GET /api/health` returns 200 and `GET /api/ready` returns 200. |
| Estimated effort | Covered by redeploy |

## Blocker 4: Live App Uses Old Blob Data

| Field | Detail |
|---|---|
| Severity | P0 |
| Root cause | `BLOB_READ_WRITE_TOKEN` is present and Supabase vars are missing, so the app falls back to Vercel Blob. |
| Required action | Set `STORAGE_DRIVER=supabase` plus production Supabase vars; redeploy. |
| Where | Vercel Production env |
| Expected verification | Public jobs/reviews no longer show old Blob data; production Supabase starts empty unless real production records are created. |
| Estimated effort | 15 minutes |

## Blocker 5: Custom Domain Points To Wix

| Field | Detail |
|---|---|
| Severity | P0 for commercial launch |
| Root cause | Nameservers are Wix and `www` CNAME points to Wix CDN. |
| Required action | Update DNS to Vercel records when production validation is ready. |
| Where | Current DNS provider / Wix domain DNS panel |
| Expected verification | Vercel domain settings valid; `curl -I` shows Vercel headers; SSL active. |
| Estimated effort | 15-60 minutes plus DNS propagation |

Recommended DNS:

- Apex `A @ 76.76.21.21`
- `www CNAME cname.vercel-dns.com`

## Blocker 6: Commit/Branch Traceability Missing

| Field | Detail |
|---|---|
| Severity | P1 |
| Root cause | Current local workspace is not a Git repo and Vercel CLI did not expose commit SHA/branch. |
| Required action | Connect project to a Git repository or record deployment artifact/source manually. |
| Where | Vercel -> Project -> Settings -> Git, or release process |
| Expected verification | Deployment metadata includes commit SHA/branch for future releases. |
| Estimated effort | 30-60 minutes |

## Execution Order

1. Add Vercel Production env vars.
2. Redeploy Production from current code.
3. Confirm deployment includes all API routes.
4. Run `/api/health`.
5. Run `/api/ready`.
6. Verify public jobs/reviews come from production Supabase.
7. Run full smoke test and security negative tests.
8. Move DNS from Wix to Vercel only after app/API validation passes.
9. Rerun final production validation report.

## Go/No-Go

Current state: **NO-GO**

Next manual action: configure Vercel Production environment variables.

