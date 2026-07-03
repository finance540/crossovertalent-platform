# Crossover Talent Codebase Audit Report

Date: July 3, 2026  
Scope: `api/`, `outputs/`, `scripts/`, `work/`, `package.json`, `vercel.json`  
Audit type: Planning/audit only. No application code was modified.

## Executive Finding

The application is functional enough for a controlled Private Beta, but it is not yet Version 1.0 production-grade. The core issue is not missing UI; it is that the app is still a compact static frontend plus serverless JSON-record backend. That has been useful for rapid delivery, but Version 1.0 should harden data modeling, pagination, file storage, email delivery, observability, and production operations.

## Current Architecture

- Static frontend served from `outputs/index.html`, `outputs/app.js`, and `outputs/styles.css`.
- Vercel serverless API routes under `api/`.
- Generic storage abstraction in `api/_lib.js`.
- Staging Supabase uses `public.app_records` as a key-value JSON store accessed with the service role.
- Normalized Supabase tables exist in `outputs/supabase-staging-schema.sql`, but the application APIs currently use `app_records` rather than those normalized tables.
- QA scripts exist for syntax/structural tests, staging seed, and staging E2E smoke.

## What Is In Good Shape

- Core employer, candidate, public marketplace, reviews, salary signals, admin, upload parsing, and fallback AI workflows are implemented.
- Security headers are configured in `vercel.json`.
- Dynamic HTML output mostly passes through `escapeHtml()` before rendering.
- Passwords are hashed with `scrypt`.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- CSRF-style same-origin checks exist for mutating requests.
- `npm audit --omit=dev` returned `0 vulnerabilities`.
- Test scripts exist and have already passed in the release-gate flow.

## Dead Code / Stale Code

| Priority | Finding | Evidence | Recommendation |
|---|---|---|---|
| P3 | Hardcoded production origin remains in frontend for `file://` fallback. | `outputs/app.js:1` defines `LIVE_ORIGIN = 'https://build-me-a-simple-website-where.vercel.app'`. | Replace with build-time config or remove local-file fallback before Version 1.0. |
| P3 | Seed script contains a commented-out old admin registration block. | `scripts/staging-seed.mjs` contains a disabled block after `verifyAndLogin('/api/admin', ...)`. | Remove commented legacy block once seed flow is stable. |
| P3 | Structural tests are regex-based, not behavioral unit/integration tests. | `scripts/qa-tests.mjs` verifies code patterns rather than executing API logic. | Keep as smoke coverage, but add real integration tests for V1. |

## Duplicate Logic

| Priority | Finding | Evidence | Recommendation |
|---|---|---|---|
| P2 | Auth flows are repeated across employer, candidate, and admin routes. | `api/auth.js`, `api/candidate.js`, and `api/admin.js` each implement register/login/resend/verification handling. | Extract shared account helpers for validation, verification token generation, password verification, and disabled-user checks. |
| P2 | Public list filtering/pagination is duplicated in the frontend. | `outputs/app.js` has separate render paths for jobs, companies, reviews, salaries, admin lists, and candidate/employer lists. | Move common list state, filtering, and pagination helpers into a small module or component abstraction if the app stays frameworkless. |
| P3 | Sector lists are duplicated in API and HTML/JS. | `api/_lib.js:7-19`; `outputs/index.html` and `outputs/app.js` repeat the same sectors. | Generate sectors from one source or expose a small `/api/config` endpoint. |

## Unused / Underused API Routes

No obviously unused API route was found. All routes are referenced by the frontend or QA scripts:

- `/api/auth`
- `/api/candidate`
- `/api/admin`
- `/api/company`
- `/api/jobs`
- `/api/applications`
- `/api/reviews`
- `/api/salary-signals`
- `/api/assist`
- `/api/verify`

## Unused / Misleading Environment Variables

| Priority | Finding | Evidence | Recommendation |
|---|---|---|---|
| P2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` is required by staging preflight/docs but not used by the current API runtime. | `scripts/staging-preflight.mjs` requires it; `api/_lib.js` uses only service role for Supabase REST. | Keep it only if future direct Supabase client usage is planned; otherwise mark as reserved. |
| P2 | `OPENAI_API_KEY` is documented but not used by current AI route. | `api/assist.js` uses deterministic helper functions and never reads `OPENAI_API_KEY`. | Either implement live OpenAI integration or rename current behavior as "AI-style assistant fallback." |
| P2 | `BLOB_READ_WRITE_TOKEN` remains as fallback storage driver. | `api/_lib.js:21-33`. | Decide whether Vercel Blob remains supported for production or remove fallback to reduce configuration ambiguity. |

## Security Risks

Detailed security findings are in `security-audit.md`. Main codebase-level risks:

- Generic `app_records` service-role backend means RLS is not enforcing business rules for the live app.
- Public APIs return full lists without server-side pagination.
- File uploads are parsed but not stored as secure storage objects.
- Logo upload stores base64 data inline in company profile records.
- No production email provider yet.
- No observability/error reporting integration yet.

## Performance Bottlenecks

Detailed recommendations are in `performance-report.md`. Main risks:

- `listRecords('companies/')` scans every company-related record for public jobs and applications.
- Admin dashboard loads all users, jobs, applications, reviews, and salary signals.
- Client-side pagination means full datasets are downloaded before paging.
- Inline base64 logos inflate JSON payloads.
- Single large frontend JS file limits lazy-loading opportunities.

## Accessibility Issues

Detailed review is in `ux-review.md`. Main risks:

- Some icon-only symbols and decorative glyphs may be noisy for screen readers.
- Dialog focus management depends on native `<dialog>` but does not explicitly restore focus.
- Toasts are short-lived and may disappear before some users can read them.
- Some form validation relies on toast messaging rather than field-level errors.
- Table-heavy dashboards need stronger mobile alternatives for small screens.

## Mobile Responsiveness Issues

- The CSS includes responsive breakpoints and mobile sidebars, which is good.
- Tables are horizontally scrollable, but candidate/employer/admin workflows would benefit from card views on mobile.
- Dialogs can be dense on small screens, especially job posting, review, salary, and application forms.

## SEO Issues

- The app is a single static document with query-string state, so individual job/company/review pages are not crawlable as unique pages.
- There is only one title and description.
- No Open Graph/Twitter metadata.
- No structured data for jobs.
- No sitemap or robots policy.

## Technical Debt

| Priority | Technical Debt | Why It Matters |
|---|---|---|
| P1 for production | Generic JSON record store instead of production relational tables | Slows queries, weakens RLS value, complicates reporting and migrations. |
| P1 for production | Real email verification not configured | Production auth trust cannot rely on staging verification links. |
| P2 | Fallback-only AI | Product promise and user expectation may exceed actual capability. |
| P2 | Inline files/logos in JSON records | Increases payload size and data exposure risk. |
| P2 | No observability stack | Production incidents will be harder to detect and debug. |
| P3 | Frameworkless frontend is growing large | The single JS file is becoming hard to maintain. |

## Recommended Version 1.0 Engineering Work

1. Move core entities from `app_records` into normalized Supabase tables.
2. Use Supabase Storage for CVs, JDs, and logos instead of inline payloads.
3. Add server-side pagination/search/filtering to list APIs.
4. Configure real transactional email.
5. Decide and implement live OpenAI integration or re-label fallback features.
6. Add monitoring, error reporting, analytics, and production smoke tests.
7. Add deeper automated tests for real API behavior, permissions, and data boundaries.

