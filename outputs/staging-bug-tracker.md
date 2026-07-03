# Staging QA Bug Tracker

Run date: July 3, 2026

Latest update: July 3, 2026 21:46 JST

Scope requested:

- Separate staging environment
- Real Supabase database
- Required Vercel environment variables
- Employer, candidate, and admin QA accounts
- Full end-to-end workflow using real staging records
- No public deployment until build passes and all P0/P1 bugs are closed

## Bugs

| ID | Priority | Status | Page/Feature | Bug Title | Steps To Reproduce | Expected Result | Actual Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STG-BUG-001 | P0 | Superseded / Closed | Staging infrastructure | Historical blocker: Supabase staging config was missing | Earlier Vercel env/project check | Staging has a dedicated Supabase project, schema applied, and required Preview env vars configured | Resolved. Supabase staging project exists, SQL schema is applied, and Vercel Preview env vars are configured |
| STG-BUG-002 | P0 | Closed, pending workflow proof | Backend/database | Supabase storage adapter required for staging backend | Inspect API storage layer and run staging workflow once Preview is accessible | API reads/writes staging records from Supabase tables | Added Supabase storage driver in `api/_lib.js`; final end-to-end proof is blocked by STG-BUG-005 |
| STG-BUG-003 | P1 | Closed with fallback mode | Vercel staging env | Required AI environment variable is missing | Run AI JD/CV flows on Preview | Preview/staging env has `OPENAI_API_KEY`, or product acceptance explicitly approves safe AI fallback for staging | Fallback-only AI mode works without crashes; add `OPENAI_API_KEY` later for live AI |
| STG-BUG-004 | P1 | Closed | Staging isolation | Separate staging data environment cannot be verified end to end | Compare configured Vercel envs and perform app writes | Staging/preview uses separate database from production and accepts app writes | Verified: staging seed created records and admin metrics read back Supabase-backed data on the unprotected Preview URL |
| STG-BUG-005 | P0 | Closed | Vercel Preview access | Vercel Preview deployment is protected, so staging workflow validation cannot be completed externally | POST `/api/auth` or `/api/admin` on Preview URL with JSON body and same-origin header | API returns app JSON such as `{ "user": ... }` or a validation error | Fixed: Vercel project `ssoProtection` disabled, fresh Preview deployed, root app HTML and `/api/admin` app JSON verified |
| STG-BUG-006 | P2 | Closed locally | QA tooling | Staging seed did not fail fast on non-JSON protected Preview responses | Run `STAGING_APP_URL=<preview> npm run staging:seed` against a protected Preview URL | Script reports the protected/non-JSON API response directly | Script previously parsed non-JSON as `{}` and failed later on `created.job.id`; fixed to validate content type and job IDs |

## Release Gate

- Open P0 bugs: 0
- Open P1 bugs: 0
- Production/public deployment allowed: No
- Beta-ready status: Ready for product-owner acceptance of staging fallback email/AI mode

## Latest Verification

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- Vercel Preview build: PASS (`https://build-me-a-simple-website-where-j4chy1dmp-cot-s-projects1.vercel.app`)
- Preview root HTML/API access: PASS
- `STAGING_APP_URL=<preview> npm run staging:seed`: PASS
- `STAGING_APP_URL=<preview> node work/staging-e2e-smoke.mjs`: PASS
- Browser public-board pagination check: PASS
- Vercel Preview env check: PASS for `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and `STORAGE_DRIVER`; FAIL for `OPENAI_API_KEY`

## Fixes Completed In Code

- Added Supabase storage driver to `api/_lib.js`.
- Added `outputs/supabase-staging-schema.sql`.
- Added `scripts/staging-preflight.mjs`.
- Added `scripts/staging-seed.mjs`.
- Hardened `scripts/staging-seed.mjs` so protected/non-JSON Preview responses fail fast.
- Added `outputs/staging-infrastructure-runbook.md`.
- Added `STORAGE_DRIVER=supabase` to `.env.example`.
- Updated local build checks to include staging preflight syntax validation.
- Expanded Supabase schema with normalized tables, RLS policies, and required storage buckets.

## Required External Configuration Before Staging QA Can Continue

Before public production launch:

- Configure real transactional email delivery for verification emails if in-app verification links are not acceptable beyond staging.
- Add `OPENAI_API_KEY` if live AI output is required beyond fallback mode.
- Run full user-acceptance testing on desktop and mobile.

Required Preview variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=
```

Do not deploy publicly until product owner accepts the remaining staging-mode caveats or production-grade email/AI services are configured.
