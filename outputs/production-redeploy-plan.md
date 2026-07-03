# Production Redeploy Plan

Date: 2026-07-04

Status: **NO-GO until current codebase is deployed and validated**

## Objective

Deploy the current workspace to Vercel Production so the live artifact includes:

- `api/health`
- `api/ready`
- `api/company`
- `api/verify`
- `api/feedback`
- `api/telemetry`

Do not move DNS until validation passes.

## Current Blocker

Latest Production deployment `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` is a Vercel `redeploy` of an older source snapshot. It is Ready but incomplete.

The Vercel project has no linked Git repository, so the dashboard redeploy action does not pull from a current branch.

## Path A: Fastest Manual Redeploy From Current Workspace

Use this if the current local workspace is the source of truth.

1. Confirm Production env vars still exist:

   ```bash
   vercel env ls production --scope cot-s-projects1
   ```

2. From the current workspace root:

   ```bash
   cd /Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where
   ```

3. Deploy the current local files to Production:

   ```bash
   vercel --prod --yes --scope cot-s-projects1
   ```

4. Record the new deployment ID and URL.

5. Inspect the deployment:

   ```bash
   vercel inspect <new-production-deployment-url> --scope cot-s-projects1
   ```

6. Confirm the build output includes the newer API functions.

7. Validate endpoints:

   ```bash
   curl -i https://build-me-a-simple-website-where.vercel.app/api/health
   curl -i https://build-me-a-simple-website-where.vercel.app/api/ready
   curl -i https://build-me-a-simple-website-where.vercel.app/api/company
   curl -i https://build-me-a-simple-website-where.vercel.app/api/verify
   curl -i https://build-me-a-simple-website-where.vercel.app/api/feedback
   curl -i https://build-me-a-simple-website-where.vercel.app/api/telemetry
   ```

8. Continue the production smoke test only if `/api/health` and `/api/ready` return HTTP 200.

## Path B: Recommended Long-Term Git-Based Deployment

Use this to prevent future provenance drift.

1. Create or select the production Git repository.

2. Initialize Git in the current workspace if needed:

   ```bash
   git init
   git add .
   git commit -m "Prepare Crossover Talent production release candidate"
   ```

3. Add the remote:

   ```bash
   git remote add origin <repository-url>
   git branch -M main
   git push -u origin main
   ```

4. In Vercel:

   `Project -> Settings -> Git`

5. Connect the repository.

6. Set Production branch to `main` or the agreed release branch.

7. Trigger a Production deployment from that branch.

8. Inspect the deployment and verify the commit SHA matches the expected release commit.

## Validation Requirements After Redeploy

| Check | Expected |
|---|---|
| `vercel inspect` | New deployment source is CLI upload or Git deployment from current commit |
| `/api/health` | HTTP 200 |
| `/api/ready` | HTTP 200 |
| `/api/company` | Route exists; unauthenticated request should not be 404 |
| `/api/verify` | Route exists; missing token should not be 404 |
| `/api/feedback` | Route exists; method/auth response should not be 404 |
| `/api/telemetry` | Route exists; method response should not be 404 |
| Supabase target | Production ref `hntvcqahoseizmgswohq` |
| Storage buckets | Production bucket names |
| Blob fallback | Disabled by `STORAGE_DRIVER=supabase` |
| Smoke test | Employer, candidate, admin workflows pass |
| Security validation | RLS/admin/storage/secret checks pass |

## Exact Manual Steps Required Now

Recommended immediate action:

1. Do **not** use Vercel dashboard "Redeploy" on `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS`.
2. Deploy from the current workspace with Vercel CLI:

   ```bash
   vercel --prod --yes --scope cot-s-projects1
   ```

3. Run the validation sequence in `outputs/production-vercel-redeploy-validation.md`.

## Release Decision

Current decision: **NO-GO**

DNS migration can begin only after a new Production deployment from the current source passes API, Supabase, smoke, and security validation.
