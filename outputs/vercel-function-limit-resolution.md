# Vercel Function Limit Resolution

Date: 2026-07-04

Status: **Implemented - awaiting production deployment validation**

## Root Cause

Git-based Production deployment reached the current codebase, but Vercel rejected the deployment because the project exceeded the Hobby plan Serverless Function count limit.

Exact Vercel error:

```text
No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan. Create a team (Pro plan) to deploy more.
```

This is a **Serverless Function count** limit. It is not a bundle size, Edge Function, syntax, environment variable, or Supabase error.

## Function Count Before

Before remediation:

- 16 JS files existed under `/api`.
- 15 were public endpoint files.
- 1 was shared helper module: `api/_lib.js`.
- Vercel rejected the deployment because the generated serverless function count exceeded the Hobby threshold.

## Options Evaluated

| Option | Result |
|---|---|
| Option A: Upgrade Vercel plan | Lowest technical risk, but requires manual billing/product-owner action outside this workspace. Not available for immediate automated remediation. |
| Option B: Consolidate lightweight utility endpoints | Selected fallback. Preserves public URLs and leaves business-critical endpoints standalone. |
| Option C: Other deployment approach | Higher operational risk than targeted consolidation. Not selected. |

## Solution Implemented

Implemented Option B with the smallest practical API deployment-shape change.

Consolidated lightweight utility/support endpoints into:

- `api/ops.js`

Removed standalone endpoint files:

- `api/health.js`
- `api/ready.js`
- `api/verify.js`
- `api/feedback.js`
- `api/telemetry.js`
- `api/email-templates.js`

Preserved public URLs using Vercel rewrites:

| Public URL | Internal destination |
|---|---|
| `/api/health` | `/api/ops?route=health` |
| `/api/ready` | `/api/ops?route=ready` |
| `/api/verify` | `/api/ops?route=verify` |
| `/api/feedback` | `/api/ops?route=feedback` |
| `/api/telemetry` | `/api/ops?route=telemetry` |
| `/api/email-templates` | `/api/ops?route=email-templates` |

Business-critical routes remain standalone:

- `api/auth.js`
- `api/candidate.js`
- `api/company.js`
- `api/jobs.js`
- `api/applications.js`
- `api/admin.js`
- `api/assist.js`
- `api/reviews.js`
- `api/salary-signals.js`

## Function Count After

After remediation:

- 11 JS files exist under `/api`.
- This includes the shared helper `api/_lib.js`.
- Public endpoint handlers are now below the Vercel Hobby deployment threshold reported by Vercel.

## Behavior Compatibility

No public API URLs were intentionally changed.

Expected behavior remains:

- `/api/health` returns liveness status.
- `/api/ready` checks storage/database/env readiness.
- `/api/verify` verifies employer/candidate/admin email tokens.
- `/api/feedback` supports support tickets and admin feedback inbox operations.
- `/api/telemetry` records client telemetry.
- `/api/email-templates` exposes prepared production email template metadata.

## Local Verification

| Check | Result |
|---|---:|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS |
| `npm run test:e2e` | BLOCKED locally |

Playwright result:

`npm run test:e2e` started local `vercel dev`, but failed because the local dev server did not have storage environment variables configured:

```text
Error: Storage is not configured
```

This is a local environment configuration issue, not a syntax/build failure. Production endpoint validation must run after the Vercel Production deployment because Production env vars are configured there.

## Current Gate

**NO-GO until production deployment and validation pass.**

Next steps:

1. Commit and push this remediation.
2. Trigger Git-based Vercel Production deployment from `main`.
3. Verify deployment succeeds under the function limit.
4. Validate production endpoints and Supabase connection.
5. Keep DNS unchanged until validation passes.
