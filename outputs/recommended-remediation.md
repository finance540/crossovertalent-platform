# Recommended Remediation

Date: 2026-07-04

## Recommendation

Choose **Option A: Upgrade Vercel to Pro** for the production project/team, then redeploy from Git.

## Why This Is The Best Option

The app is already past the harder production provenance gates:

- GitHub `main` is pushed.
- Vercel is connected to `finance540/crossovertalent-platform`.
- Production branch is `main`.
- The Git-based build reached the current codebase.
- `npm run build` / `npm run check` passed during Vercel build.

The only new blocker is Vercel's Hobby plan Serverless Function count limit.

Upgrading the Vercel plan is lower risk than route consolidation because it:

- Requires no application behavior changes.
- Keeps auth, candidate, employer, admin, AI, upload, telemetry, and support routes separated.
- Avoids rewriting URLs/routing immediately before production validation.
- Preserves observability and operational clarity per endpoint.
- Gives the platform more room for future API growth.

## Recommended Execution

1. Upgrade the Vercel team/project to Pro.
2. Confirm billing/spend controls are configured.
3. Redeploy Production from Git branch `main`.
4. Confirm the deployment references commit:

   `b6eccdfdaa98f2ed8f3db73c4c462df36af2b5b4`

   or a newer approved commit if the recommendation documents are pushed.

5. Validate:

   - `/api/health` returns HTTP 200.
   - `/api/ready` returns HTTP 200.
   - `/api/company` exists.
   - `/api/verify` exists.
   - `/api/feedback` exists.
   - `/api/telemetry` exists.
   - Production Supabase ref is `hntvcqahoseizmgswohq`.
   - `STORAGE_DRIVER=supabase` disables Blob fallback.

6. Run production smoke/security validation.
7. Only then consider DNS migration.

## If Vercel Upgrade Is Not Approved

Use **Option C: consolidate lightweight utility endpoints**.

Recommended grouping:

- Keep core business routes standalone:
  - `auth`
  - `candidate`
  - `company`
  - `jobs`
  - `applications`
  - `admin`
  - `assist`
  - `reviews`
  - `salary-signals`

- Consolidate utility/support routes behind one router:
  - `health`
  - `ready`
  - `telemetry`
  - `email-templates`
  - `verify`
  - `feedback`

Expected result:

- Reduces public endpoint functions from 15 to approximately 10.
- Keeps public URLs unchanged with rewrites.
- Should fit under the reported Hobby limit of 12.

Risks:

- Requires careful route rewrite testing.
- Health/readiness/verification/support workflows must be regression-tested.
- Future API additions may hit the limit again.

## Decision Needed

Product owner/developer must choose:

| Choice | Impact |
|---|---|
| Upgrade to Vercel Pro | Fastest and lowest risk; adds platform cost |
| Approve route consolidation | Avoids cost; adds engineering/regression risk |

## Current Release Gate

**NO-GO**

Remaining blockers:

1. Vercel function-count deployment blocker unresolved.
2. Production Git deployment has not completed.
3. Production API validation has not passed.
4. Supabase production runtime connection has not been validated after successful deploy.
5. Smoke/security validation still pending.
6. DNS must not move yet.
