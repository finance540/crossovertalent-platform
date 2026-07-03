# Vercel Production Audit

Date: 2026-07-04

Mode: Read-only.

## Project

| Field | Value |
|---|---|
| Vercel team/scope | `cot-s-projects1` |
| Project name | `build-me-a-simple-website-where` |
| Project ID | `prj_weXVocYHeOcEQjHH1EmdHSrKz4gb` |
| Root directory | `.` |
| Framework preset | Other |
| Node.js version | 24.x |
| Linked local project file | `.vercel/project.json` |

## Production Deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_AKHXGQfCVW86nBf1UuNHW5zyZPFQ` |
| Deployment URL | `https://build-me-a-simple-website-where-gf2966e6q-cot-s-projects1.vercel.app` |
| Production alias | `https://build-me-a-simple-website-where.vercel.app` |
| Target | Production |
| Ready state | Ready |
| Created | 2026-07-03 12:17:44 JST |
| Region for lambdas | `iad1` |

## Git Branch / Commit

| Field | Status |
|---|---|
| Git branch | Not available from Vercel CLI output |
| Commit SHA | Not available from Vercel CLI output |
| Local workspace Git repo | Not a Git repository |
| Likely deployment source | CLI/local upload snapshot |

Because no commit SHA is exposed and this local workspace is not a Git repository, production cannot currently be traced to a reliable commit. That is a release risk.

## Build Evidence

Production build logs show:

```text
Running "npm run build"
> crossover-talent@1.0.0 build
> npm run check
> node --check outputs/app.js && node --check api/auth.js && node --check api/jobs.js && node --check api/applications.js && node --check api/reviews.js && node --check api/assist.js && node --check api/candidate.js && node --check api/admin.js && node --check api/salary-signals.js && node --check scripts/qa-tests.mjs
```

This is an older build script than the current local codebase, which now also checks:

- `api/company.js`
- `api/verify.js`
- `api/telemetry.js`
- `api/feedback.js`
- `api/email-templates.js`
- `api/health.js`
- `api/ready.js`
- staging scripts

## Functions Deployed

Production deployment JSON includes these lambda routes:

- `api/admin`
- `api/applications`
- `api/assist`
- `api/auth`
- `api/candidate`
- `api/jobs`
- `api/reviews`
- `api/salary-signals`

## API Routes Missing From Production

Local files exist, but current production deployment does not include:

- `api/company`
- `api/email-templates`
- `api/feedback`
- `api/health`
- `api/ready`
- `api/telemetry`
- `api/verify`

Observed endpoint failures:

- `/api/health`: 404
- `/api/ready`: 404
- `/api/company`: 404

## Vercel Project Configuration Risk

Vercel project inspect reports:

```text
Framework Preset: Other
Build Command: `npm run vercel-build` or `npm run build`
Output Directory: `public` if it exists, or `.`
```

Deployment JSON for the current deployment contains `outputDirectory: outputs`, meaning the deployed snapshot had a `vercel.json`, but the Vercel project UI setting is not clearly aligned with the repo configuration. Keep `vercel.json` as the source of truth and ensure the next production deployment includes it.

## Missing Configuration

- Required Production env vars are missing.
- Latest route files are not deployed.
- Health/readiness endpoints are unavailable.
- Custom domain DNS is not configured to Vercel.

## Vercel Audit Decision

**FAIL**

The production Vercel deployment is not a valid release candidate.

