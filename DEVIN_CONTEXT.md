# Devin Context – Crossover Talent

Quick orientation for AI agents and new contributors working in this repo.

## Tech stack

- **Frontend:** framework-free single-page app (vanilla JS + static HTML/CSS). No bundler/build step.
  - `outputs/index.html` – all screens (landing, auth, public marketplace, employer app, candidate app, admin) and dialogs.
  - `outputs/app.js` – all client logic: global `state`, `render*` functions, `api()` fetch helper, event bindings at the bottom.
  - `outputs/styles.css` – minified-style CSS, later rules override earlier ones.
- **Backend:** Vercel serverless functions in `api/*.js` (Node 20, ESM). Shared helpers in `api/_lib.js` (sessions, rate limiting, storage, email, OpenAI).
- **Data/storage:** Supabase (Postgres + Storage). Records are stored via `readRecord` / `writeRecord` / `listRecords` in `api/_lib.js` (`app_records` table); relational schema lives in `supabase/migrations/`. `STORAGE_DRIVER=local` uses local files for dev/E2E. `prisma/schema.prisma` exists but is not used at runtime.
- **Integrations:** Resend (email), OpenAI (AI assistant, JD/CV parsing, OCR), optional Google/LinkedIn/phone OTP auth, Sentry/PostHog/GA placeholders.
- **Hosting:** Vercel (`vercel.json`: `outputDirectory: outputs`, rewrites for `/api/health`, `/help`, etc.). Production domain: https://crossovertalent.asia
- **Payments:** no Stripe integration exists yet (see `outputs/subscription-architecture.md` for the planned design). Stripe test keys are not configured in `.env.example`.

## Commands

Node 20 (CI uses `actions/setup-node@v4` with Node 20).

| Command | What it does |
|---|---|
| `npm ci` | Install dependencies |
| `npm run lint` / `typecheck` / `build` | All alias `npm run check` (`node --check` on every JS file) |
| `npm test` | Structural QA assertions in `scripts/qa-tests.mjs` (regex checks against source files) |
| `npm run test:e2e` | Playwright E2E (`tests/e2e/`); starts `vercel dev` locally unless `PLAYWRIGHT_BASE_URL` is set; needs Supabase secrets |
| `npm run staging:seed` | Seed staging with demo jobs/applications |

CI: `.github/workflows/release-candidate.yml` runs lint, typecheck, test, build and E2E on every PR.

## Key folders / files

- `api/jobs.js` – public job board (`GET /api/jobs?public=1[&company=<id>]`) and employer job CRUD.
- `api/company.js` – employer company profile + logo upload; also serves the public `GET /api/companies` (list) and `GET /api/companies?id=<companyId>` (profile + live jobs) via a `vercel.json` rewrite to `/api/company?route=companies` (keeps the Hobby plan under 12 functions).
- `api/reviews.js` – public reviews (`GET /api/reviews`), candidate review create/edit (`?mine=1`).
- `api/salary-signals.js` – salary signals + privacy-thresholded aggregates.
- `api/candidate.js`, `api/auth.js`, `api/admin.js` – job seeker, employer and admin auth/dashboards.
- `api/assist.js` – AI assistant and document parsing. `api/ops.js` – health/readiness/feedback/telemetry.
- `outputs/*.md` – historical audits, roadmaps and ticket lists (e.g. `version-1.1-prioritized-backlog.md`, `p1-product-gap-tickets.md`, `production-readiness-ticket-list.md`).

## Marketplace data & empty states

The public marketplace (`/?jobs=1`) has four tabs rendered by `renderMarketplace()` in `outputs/app.js`:
Jobs (`renderPublicJobsList`), Companies (`renderCompaniesList`, derived from jobs + reviews via `marketplaceCompanies()`), Reviews (`renderReviewsList`) and Salary signals (`renderSalariesList`).

At the time of writing, production returns **no data** for all of them:
`/api/jobs?public=1` → `{"jobs":[]}`, `/api/reviews` → `{"reviews":[]}`, `/api/salary-signals` → `{"signals":[],"aggregates":[]}`.
Companies are therefore also empty.

Empty states are produced by `marketplaceEmptyState(kind)`:
- **Filters active** (`hasPublicFilters()`): "No … match these filters" + *Clear filters* (`clearPublicFilters()`).
- **Company-scoped board** (`?company=<id>`) with no jobs: "No open roles at this company right now" + *Browse all jobs*.
- **Marketplace empty:** per-tab copy and CTAs from `MARKETPLACE_EMPTY_STATES` (Join job alerts / Post a job, Create employer workspace / Review a company, Write the first review, Add a salary signal).
- CTA buttons use `data-empty-action` and are handled by a delegated click listener on `#public-market` (`runEmptyStateAction`).

Dashboard empty states use the shared `emptyState(icon, title, copy, action)` helper.

## Ticket list

- Current ticket list: _TODO – add link to the product ticket list (Ticket 1.1 – Empty States, …)._
- Historical backlogs: `outputs/version-1.1-prioritized-backlog.md`, `outputs/p1-product-gap-tickets.md`.
