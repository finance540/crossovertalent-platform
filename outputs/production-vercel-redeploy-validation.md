# Production Vercel Redeploy Validation

Date: 2026-07-04

Status: **NO-GO - PRODUCTION REDEPLOY PENDING**

No deployment has been performed. DNS has not been moved.

## Automatic Release Gate Progression Rule

Trigger phrase from product owner/developer:

`Production environment variables have been added`

When that phrase is received, run the remaining validation sequence automatically:

1. Verify Vercel Production environment variable names with `vercel env ls production --scope cot-s-projects1`.
2. Stop immediately if any required Production variable is missing.
3. Redeploy Production only if every required variable name exists.
4. Validate `/api/health`, `/api/ready`, and required API routes.
5. Confirm the live app uses production Supabase project `hntvcqahoseizmgswohq`, production buckets, and no Blob fallback.
6. Run production smoke tests for Employer, Candidate, and Admin workflows.
7. Run security validation for RLS, admin-only routes, private storage, and secret exposure.
8. Update this report with GO/NO-GO for DNS migration.

Rules remain unchanged:

- Never expose secrets or API keys.
- Do not move DNS automatically.
- Do not approve public launch until every validation passes.
- If validation fails at any phase, stop and report exact blockers.

## Current Verified Issue

Production Vercel is not using the verified production Supabase project.

Root causes already verified:

- Vercel Production env only has `BLOB_READ_WRITE_TOKEN`.
- App falls back to old Vercel Blob data.
- Current Production deployment is an old snapshot missing routes such as `/api/health`, `/api/ready`, `/api/company`, `/api/verify`, `/api/feedback`, and `/api/telemetry`.
- `crossovertalent.asia` still points to Wix/Pepyaka.

## Phase 1: Vercel Project Verification

Result: **PASS**

| Check | Result |
|---|---|
| Current Vercel team/scope | `cot-s-projects1` |
| Linked local Vercel project | `build-me-a-simple-website-where` |
| Project ID | `prj_weXVocYHeOcEQjHH1EmdHSrKz4gb` |
| Org/team ID | `team_PiEtp1hNJO1E6hFxLSGHOMF5` |
| Production deployment target | `build-me-a-simple-website-where-gf2966e6q-cot-s-projects1.vercel.app` |
| Production alias | `build-me-a-simple-website-where.vercel.app` |
| Production deployment status | Ready |
| Production branch / commit | Not available through current CLI evidence; local workspace is not a Git repo |
| Git repository connected | Not verified from CLI output |

Conclusion: the CLI is linked to the correct Vercel team and project. The problem is not the local project link.

## Step 1: Exact Vercel Production Env Var Checklist

Add these in:

**Vercel -> Project -> Settings -> Environment Variables -> Production**

Do not paste secrets into chat.

| Variable | Required value / source | Required? | Notes |
|---|---|---:|---|
| `STORAGE_DRIVER` | `supabase` | Yes | Forces Supabase instead of Blob fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hntvcqahoseizmgswohq.supabase.co` | Yes | Production Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase production anon/publishable key | Yes | Public key; still add only from Supabase production project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase production service role key | Yes | Secret. Server-only. Must not be `NEXT_PUBLIC_`. |
| `SESSION_SECRET` | Generate with `openssl rand -base64 48` | Yes | Secret. Unique to production. |
| `NEXT_PUBLIC_APP_URL` | `https://build-me-a-simple-website-where.vercel.app` | Yes | Use this until DNS migration begins. |
| `RESEND_API_KEY` | Resend production API key | Yes for email validation | Secret. |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Crossover Talent <noreply@crossovertalent.asia>` | Yes for email validation | Must match verified Resend domain/sender. |
| `OPENAI_API_KEY` | Production OpenAI API key | Optional | Required only if live AI is required. Omit if fallback AI is accepted. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Recommended | Used when `OPENAI_API_KEY` exists. |
| `ALLOW_SVG_LOGOS` | `false` | Recommended | Production logo bucket allows PNG/JPG/WEBP only. |
| `EMAIL_TIMEOUT_MS` | `8000` | Recommended | Email provider timeout. |

## Important Bucket Env Var Naming

Your requested names:

- `SUPABASE_CVS_BUCKET`
- `SUPABASE_JOB_DESCRIPTIONS_BUCKET`
- `SUPABASE_COMPANY_LOGOS_BUCKET`

are **not currently read by the app**.

The current code expects these exact names:

| App-required variable | Required value |
|---|---|
| `SUPABASE_CV_BUCKET` | `crossover-cvs-production` |
| `SUPABASE_JD_BUCKET` | `crossover-job-descriptions-production` |
| `SUPABASE_LOGO_BUCKET` | `crossover-company-logos-production` |
| `SUPABASE_FILE_BUCKET` | `crossover-job-descriptions-production` |

These are required for `/api/ready` to pass in production. Add the app-required variables above.

Optional alias variables may also be added for documentation consistency, but they will not affect the app unless code aliases are added later:

| Optional alias | Value |
|---|---|
| `SUPABASE_CVS_BUCKET` | `crossover-cvs-production` |
| `SUPABASE_JOB_DESCRIPTIONS_BUCKET` | `crossover-job-descriptions-production` |
| `SUPABASE_COMPANY_LOGOS_BUCKET` | `crossover-company-logos-production` |

## Step 2: Manual Confirmation Gate

Result: **FAILED**

The user confirmed the env vars were added, but `vercel env ls production --scope cot-s-projects1` still shows only:

| Variable | Environments |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Production, Preview, Development |

The required production Supabase/session/email variables are not visible on the Vercel project `cot-s-projects1/build-me-a-simple-website-where`.

Environment-scope audit:

| Variable | Production | Preview | Development | Status |
|---|---:|---:|---:|---|
| `STORAGE_DRIVER` | Missing | Exists | Missing | Wrong environment |
| `NEXT_PUBLIC_SUPABASE_URL` | Missing | Exists | Missing | Wrong environment |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Missing | Exists | Missing | Wrong environment |
| `SUPABASE_SERVICE_ROLE_KEY` | Missing | Exists | Missing | Wrong environment |
| `SUPABASE_CV_BUCKET` | Missing | Missing | Missing | Missing |
| `SUPABASE_JD_BUCKET` | Missing | Missing | Missing | Missing |
| `SUPABASE_LOGO_BUCKET` | Missing | Missing | Missing | Missing |
| `SUPABASE_FILE_BUCKET` | Missing | Missing | Missing | Missing |
| `SESSION_SECRET` | Missing | Exists | Missing | Wrong environment |
| `NEXT_PUBLIC_APP_URL` | Missing | Exists | Missing | Wrong environment |
| `RESEND_API_KEY` | Missing | Missing | Missing | Missing |
| `RESEND_FROM_EMAIL` | Missing | Missing | Missing | Missing |
| `OPENAI_API_KEY` | Missing | Missing | Missing | Optional; missing |
| `BLOB_READ_WRITE_TOKEN` | Exists | Exists | Exists | Legacy/fallback token still present |

Root cause:

The core Supabase/session variables were added to **Preview**, not **Production**. Production still has only the old Blob fallback token.

Before redeploying, product owner/developer must confirm:

- [ ] Vercel Production env vars above were added.
- [ ] Bucket vars use the app-required names.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is Production-only and not public.
- [ ] `SESSION_SECRET` is unique and 32+ bytes.
- [ ] `NEXT_PUBLIC_APP_URL` is currently `https://build-me-a-simple-website-where.vercel.app`.
- [ ] DNS has **not** been moved from Wix yet.

## Step 3: Redeploy Production

Status: **Blocked**

Reason: Vercel Production env var verification failed. Redeploy was intentionally not run because the app would continue using Vercel Blob fallback.

Only after manual confirmation:

```bash
vercel --prod --yes --scope cot-s-projects1
```

## Step 4: Post-Redeploy Verification

Status: **Blocked**

Required checks:

| Check | Expected | Status |
|---|---|---:|
| `vercel env ls production` | Required env var names present | Pending |
| `GET /api/health` | HTTP 200 | Pending |
| `GET /api/ready` | HTTP 200 and all readiness checks true | Pending |
| `/api/company` | Exists; unauthenticated request returns auth error, not 404 | Pending |
| `/api/verify` | Exists; missing token returns validation error, not 404 | Pending |
| `/api/feedback` | Exists; method/auth behavior correct, not 404 | Pending |
| `/api/telemetry` | Exists; method behavior correct, not 404 | Pending |
| Supabase production connection | Public jobs/reviews come from production Supabase, not Blob | Pending |
| Production Supabase cleanliness | No staging data present; only test records created by smoke test | Pending |

## Step 5: Production Smoke Test

Status: **Blocked**

Reason: Vercel Production env vars are not visible, so redeploy did not proceed.

Required workflow checks:

| Workflow | Status |
|---|---:|
| Employer signup | Pending |
| Email verification | Pending |
| Company profile/logo upload | Pending |
| Job post/publish | Pending |
| Candidate signup | Pending |
| CV upload | Pending |
| Application submit | Pending |
| Employer sees application | Pending |
| Admin dashboard loads | Pending |

## Step 6: DNS Migration Plan

Status: **Blocked**

DNS migration must not begin until:

- Vercel Production env validation passes.
- Production redeploy succeeds.
- `/api/health` and `/api/ready` pass.
- Production smoke test passes.
- Security negative checks pass.

## Current Decisions

| Area | Status |
|---|---:|
| Vercel Production status | NO-GO |
| Supabase connection status | NO-GO until Vercel env + redeploy verified |
| API route status | NO-GO until current code is redeployed |
| DNS migration | NOT READY |
| Public launch approval | NO-GO |

## Latest Validation Evidence

Date: 2026-07-04

| Check | Result | Evidence |
|---|---:|---|
| `npm run check` | PASS | Syntax/build check passed locally. |
| Vercel Production env names | PASS | Required Production variable names are now listed in Vercel. Values were not displayed. |
| Redeploy Production | NOT RUN | Awaiting explicit release-gate trigger phrase before redeploy. |
| `/api/health` | FAIL | HTTP 404 from current Production deployment. Latest code has not been redeployed. |
| `/api/ready` | FAIL | HTTP 404 from current Production deployment. Latest code has not been redeployed. |

## Production Environment Audit: 2026-07-04

Result: **PASS**

Required Production variable names now visible:

| Variable | Production status |
|---|---:|
| `STORAGE_DRIVER` | Exists |
| `NEXT_PUBLIC_SUPABASE_URL` | Exists |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Exists |
| `SUPABASE_SERVICE_ROLE_KEY` | Exists |
| `SUPABASE_CV_BUCKET` | Exists |
| `SUPABASE_JD_BUCKET` | Exists |
| `SUPABASE_LOGO_BUCKET` | Exists |
| `SUPABASE_FILE_BUCKET` | Exists |
| `SESSION_SECRET` | Exists |
| `NEXT_PUBLIC_APP_URL` | Exists |
| `RESEND_API_KEY` | Exists |
| `RESEND_FROM_EMAIL` | Exists |
| `OPENAI_API_KEY` | Exists |

Legacy/fallback variable still visible:

| Variable | Production status | Note |
|---|---:|---|
| `BLOB_READ_WRITE_TOKEN` | Exists | Should not be used when `STORAGE_DRIVER=supabase` is active. Verify after redeploy. |

Next gate:

- Redeploy Production from current codebase.
- Validate `/api/health`, `/api/ready`, required API routes, Supabase production connection, smoke test, and security checks.

## API Endpoint Check: 2026-07-04

Result: **FAIL - REDEPLOY REQUIRED**

| Endpoint | Expected | Actual | Interpretation |
|---|---:|---:|---|
| `GET /api/health` | HTTP 200 | HTTP 404 | Current Production deployment does not include the health route. |
| `GET /api/ready` | HTTP 200 | HTTP 404 | Current Production deployment does not include the readiness route. |

This is expected until Production is redeployed from the current codebase. The Production env vars now exist, so the next required action is the Production redeploy gate.

## Provided Production Deployment Check: 2026-07-04

Deployment URL checked:

`https://build-me-a-simple-website-where-da8xixfth-cot-s-projects1.vercel.app`

Vercel project ID provided:

`prj_weXVocYHeOcEQjHH1EmdHSrKz4gb`

Vercel inspect result:

| Field | Value |
|---|---|
| Deployment ID | `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` |
| Target | Production |
| Status | Ready |
| Created | 2026-07-04 02:54:03 JST |
| Aliases | `build-me-a-simple-website-where.vercel.app`, `crossovertalent.asia`, `www.crossovertalent.asia`, and project aliases |

API validation result:

| Endpoint | Expected | Actual | Status |
|---|---:|---:|---:|
| `GET /api/health` | HTTP 200 | HTTP 404 | FAIL |
| `GET /api/ready` | HTTP 200 | HTTP 404 | FAIL |
| `GET /api/company` | Exists; auth error acceptable | HTTP 404 | FAIL |
| `GET /api/verify` | Exists; validation error acceptable | HTTP 404 | FAIL |

Build output evidence:

The inspected deployment includes older API functions such as:

- `api/admin`
- `api/applications`
- `api/assist`
- `api/auth`
- `api/candidate`

The inspected deployment does not expose the required newer API routes:

- `api/health`
- `api/ready`
- `api/company`
- `api/verify`
- `api/feedback`
- `api/telemetry`

Interpretation:

The provided deployment is not a valid release candidate. It appears to be built from a source snapshot that does not include the current local codebase API routes. Production environment variables now exist, but the deployed artifact is still incomplete.

Required next action:

Redeploy Production from the current codebase that includes all files in `/api`, then rerun the endpoint checks.

## Deployment Provenance Finding: 2026-07-04

Result: **FAIL - STALE REDEPLOY ARTIFACT**

| Check | Result |
|---|---|
| Local workspace is a Git repository | No |
| Vercel project linked to Git | No |
| Vercel production branch configured | No |
| Latest deployment source | `redeploy` |
| Latest deployment Git metadata | Empty |
| Latest deployment contains current API routes | No |

Root cause:

The latest Production deployment was created by Vercel's redeploy mechanism from an older uploaded source snapshot. Because the project is not Git-linked, dashboard redeploy does not pull the current local workspace files.

Supporting reports:

- `outputs/deployment-source-audit.md`
- `outputs/deployment-commit-comparison.md`
- `outputs/production-redeploy-plan.md`

## Repository-Gated Redeploy Check: 2026-07-04

Result: **NO-GO - CANNOT VERIFY PUSHED HEAD**

The requested controlled redeploy rule requires:

- Current HEAD is pushed.
- Vercel points to the correct repository.
- Vercel points to the correct production branch.

Those conditions are not currently satisfiable.

| Check | Result | Evidence |
|---|---:|---|
| Current Git branch | FAIL | `git branch --show-current` fails because this workspace is not a Git repository. |
| Current HEAD commit SHA | FAIL | `git rev-parse HEAD` fails because this workspace is not a Git repository. |
| Git status clean/dirty | FAIL | `git status --short --branch` fails because this workspace is not a Git repository. |
| Latest commit pushed to origin | FAIL | No Git remote exists in this workspace. |
| Local HEAD equals origin/production branch | FAIL | No local HEAD, origin, or production branch exists. |
| Vercel connected Git repository | FAIL | Vercel project API reports `gitRepository: null`. |
| Vercel production branch | FAIL | No production branch is configured because no Git repository is linked. |
| Latest deployment commit SHA | FAIL | Deployment `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` has source `redeploy`, `gitSource: null`, and empty Git metadata. |
| Required API files exist locally | PASS | `api/health.js`, `api/ready.js`, `api/company.js`, `api/verify.js`, `api/feedback.js`, and `api/telemetry.js` exist. |
| Local syntax/build check | PASS | `npm run check` passed. |

Current deployed commit SHA:

`N/A - latest Production deployment was not built from Git.`

Current repository HEAD SHA:

`N/A - current workspace is not a Git repository.`

Do they match?

`No - no comparable Git SHAs exist.`

Was Production redeployed?

`No - blocked by repository gate.`

API validation:

`FAIL - current Production deployment returns HTTP 404 for required API routes.`

Supabase connection:

`NOT VALIDATED POST-REDEPLOY - Production env vars exist, but the current deployed artifact is stale.`

### Missing Git/Deployment Requirements

There are no "unpushed commits" to list because there is no local Git repository. The missing release-control requirements are:

1. A Git repository containing the current workspace.
2. A pushed release commit.
3. Vercel linked to that repository.
4. A configured production branch.
5. A Production deployment from that commit.

### Exact Git Path To Make Redeploy Eligible

Run these only after choosing the correct production repository URL:

```bash
cd /Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where
git init
git add .
git commit -m "Prepare Crossover Talent production release candidate"
git branch -M main
git remote add origin <production-repository-url>
git push -u origin main
```

Then in Vercel:

1. Open `cot-s-projects1/build-me-a-simple-website-where`.
2. Go to `Settings -> Git`.
3. Connect the repository used above.
4. Set the Production branch to `main` or the agreed release branch.
5. Trigger a Production deployment from that branch.

Alternative if Git is intentionally not used:

```bash
vercel --prod --yes --scope cot-s-projects1
```

That would deploy the current workspace, but it does **not** satisfy the repository-gated rule because there would still be no deployed commit SHA to compare.

### Final Recommendation

**NO-GO - exact remaining blockers**

- Current workspace is not a Git repository.
- Vercel project has no connected Git repository.
- No production branch is configured.
- Latest deployment is a stale Vercel `redeploy` artifact.
- Current Production deployment still lacks required API routes.
- DNS must not move until a deployment from the correct source passes validation.

## Git Repository Initialization: 2026-07-04

Result: **PARTIAL PASS - LOCAL GIT READY, REMOTE PENDING**

The local workspace has now been initialized as a Git repository and committed.

| Check | Result |
|---|---:|
| Local Git repository initialized | PASS |
| Branch name | `main` |
| Local HEAD commit SHA | `16a17949fdb6c07ca34624a009ffe741afa1c33c` |
| Commit message | `Prepare Crossover Talent production release candidate` |
| Working tree status | Clean |
| Git remote | `origin` configured |
| Pushed to GitHub | Pending |
| Vercel Git connection | Pending |
| Git-based Production deployment | Pending |

Commit hygiene:

- `.env`, `.env.local`, `.vercel`, `node_modules`, local caches, local agent skill bundles, test artifacts, and Supabase CLI temp files are ignored.
- `.env.example` is committed as the template.

Next required manual input:

Provide the GitHub repository URL. Do not proceed with `git remote add origin` or `git push` until the URL is provided.

Current release gate:

**NO-GO - GitHub push, Vercel Git connection, and Git-based production deployment are still pending.**

## GitHub Remote Push Attempt: 2026-07-04

Result: **BLOCKED - GITHUB AUTH REQUIRED**

| Check | Result |
|---|---:|
| GitHub repository URL provided | `https://github.com/finance540/crossovertalent-platform` |
| `origin` remote configured | PASS |
| Current branch | `main` |
| Current local HEAD SHA | `c21e6be60c61d7f1feb4f23c73a9a77ddaa82696` |
| Push to `origin/main` | FAIL |
| Failure reason | Git could not read a GitHub username for HTTPS authentication on this machine. |
| GitHub CLI | Not installed (`gh: command not found`) |

Push command attempted:

```bash
git push -u origin main
```

Git output:

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

Required next action:

Authenticate GitHub for this machine, then rerun:

```bash
git push -u origin main
```

Supported options:

1. Install/authenticate GitHub CLI, then push:

   ```bash
   gh auth login
   git push -u origin main
   ```

2. Use HTTPS with a GitHub personal access token when Git prompts for credentials.

3. Configure SSH auth, switch the remote, then push:

   ```bash
   git remote set-url origin git@github.com:finance540/crossovertalent-platform.git
   git push -u origin main
   ```

Release gate remains:

**NO-GO - remote push, Vercel Git connection, Git-based production deployment, API validation, and Supabase validation are still pending.**

## GitHub CLI Authentication Attempt: 2026-07-04

Result: **BLOCKED - BROWSER DEVICE APPROVAL NOT COMPLETED**

| Check | Result |
|---|---:|
| System `brew` available | No |
| System `gh` available | No |
| Homebrew install attempted | Failed; macOS admin/sudo access required |
| Local GitHub CLI installed in workspace | PASS |
| Local GitHub CLI version | `2.96.0` |
| Browser/device authentication started | PASS |
| GitHub device approval completed | FAIL / timed out |
| `gh auth status` | Not logged into any GitHub hosts |
| Push retried after auth | Not run; auth did not complete |

Device login attempt:

- URL: `https://github.com/login/device`
- One-time code shown: `0745-3013`

The pending auth process was terminated after no browser approval was detected.

Required next action:

Run this from the project root and complete the browser step promptly:

```bash
work/gh/gh_2.96.0_macOS_arm64/bin/gh auth login --hostname github.com --git-protocol https --web
```

Choose:

- GitHub.com
- HTTPS
- Authenticate with browser
- Yes, configure Git credentials

Then verify and push:

```bash
work/gh/gh_2.96.0_macOS_arm64/bin/gh auth status
git push -u origin main
```

Release gate remains:

**NO-GO - GitHub authentication, GitHub push, Vercel Git connection, Git-based production deployment, and production validation are still pending.**

## Required Correction

Add the required variables to the exact project:

**Vercel -> cot-s-projects1 -> build-me-a-simple-website-where -> Settings -> Environment Variables -> Production**

Manual checklist:

| Variable | Required Production value/source |
|---|---|
| `STORAGE_DRIVER` | `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hntvcqahoseizmgswohq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase service role key, server-only |
| `SUPABASE_CV_BUCKET` | `crossover-cvs-production` |
| `SUPABASE_JD_BUCKET` | `crossover-job-descriptions-production` |
| `SUPABASE_LOGO_BUCKET` | `crossover-company-logos-production` |
| `SUPABASE_FILE_BUCKET` | `crossover-job-descriptions-production` |
| `SESSION_SECRET` | 32+ byte production secret |
| `NEXT_PUBLIC_APP_URL` | `https://build-me-a-simple-website-where.vercel.app` |
| `RESEND_API_KEY` | Resend production API key |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `OPENAI_API_KEY` | Optional if fallback-only AI is accepted |

Then rerun:

```bash
vercel env ls production --scope cot-s-projects1
```

The output must list the required variable names before production redeploy can proceed.

## Latest GO / NO-GO Decision

| Area | Status | Reason |
|---|---:|---|
| Vercel Production | NO-GO | Required vars missing from Production. |
| Supabase connection | NO-GO | Production deployment cannot connect to Supabase without Production env vars. |
| API routes | NO-GO | Current production deployment is still old; redeploy blocked until env passes. |
| DNS migration | NOT READY | DNS must stay on Wix until Vercel production passes validation. |
| Public launch | NO-GO | Production env validation failed. |

## Remaining Blockers

1. Manual Vercel Production env var setup.
2. Production redeploy from current codebase.
3. Health/readiness verification.
4. Supabase production connection verification.
5. Production smoke test.
6. Security negative test.
7. DNS migration plan after Vercel production passes./api

/api/health
