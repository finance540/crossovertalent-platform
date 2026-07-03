# Crossover Talent Staging QA Plan

## Release Gate

Do not deploy to production unless:

- All P0 and P1 bugs are fixed.
- Production Vercel build passes.
- Employer, candidate, and admin QA accounts can authenticate.
- Real database records are created, read back, and cleaned up where appropriate.
- Protected Preview access is resolved and the full staging workflow has been tested end to end.

Beta-ready status: **Blocked**.

## Test Accounts

Use timestamped accounts per test run:

- Employer: `qa-employer-{timestamp}@crossovertalent.asia`
- Candidate: `qa-candidate-{timestamp}@crossovertalent.asia`
- Admin: `qa-admin-{timestamp}@crossovertalent.asia`

Admin accounts are limited to `qa-admin...@crossovertalent.asia` and provide read-only aggregate QA metrics.

## Bug Priority

- P0: Blocks core marketplace usage, data loss, auth bypass, or production build failure.
- P1: Blocks a required go-live workflow for employer, candidate, admin, application, review, salary, upload, or AI fallback.
- P2: Important UX, cleanup, observability, or non-core workflow issue.
- P3: Cosmetic, copy, or minor polish issue.

## Test Matrix

| Area | Scenario | Expected Result | Priority If Failed |
| --- | --- | --- | --- |
| Auth | Employer signup/login/logout | Session persists and redirects to employer dashboard | P0 |
| Auth | Candidate signup/login/logout | Session persists and redirects to candidate dashboard | P0 |
| Auth | Admin signup/login/logout | Admin can read aggregate QA metrics only | P1 |
| Auth | Wrong password/missing fields | Clear validation/error message | P1 |
| Employer | Post job | Job stored and visible in employer dashboard | P0 |
| Employer | Edit/publish/unpublish/delete job | State changes persist | P1 |
| Employer | View applications | New candidate applications appear by job | P0 |
| Employer | Change status | Candidate sees updated status | P0 |
| Marketplace | Public jobs | Only active database jobs show | P0 |
| Marketplace | Search/filter | Keyword, sector, location, level, work type filter correctly | P1 |
| Candidate | Save/unsave job | Saved job appears/disappears in dashboard | P1 |
| Candidate | Apply to job | Application stored once; duplicate blocked | P0 |
| Candidate | Resume/preferences | Values save and reload | P1 |
| Reviews | Submit review | Review stored and publicly visible | P1 |
| Reviews | Company email gate | Generic email rejected for review submission | P1 |
| Salary | Submit signal | Signal stored and aggregate displays publicly | P1 |
| Upload | JD/CV TXT/PDF/DOC/DOCX validation | Supported files parse or show safe failure message | P1 |
| AI | JD/CV assistant | Generates safe fallback output if external AI unavailable | P1 |
| UI | Forms/buttons | Every visible button acts or validates | P1 |
| Build | Vercel production build | Build passes | P0 |
| Browser | Console | No major console errors during critical paths | P1 |

## Bug Log

| ID | Priority | Status | Area | Bug | Resolution |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | P1 | Fixed and deployed | Admin QA | No admin account/test surface existed for staging QA. | Added `api/admin.js` read-only QA admin registration/login/metrics endpoint. |

## Executed QA Run

### Supabase Staging Attempt - Blocked By Preview Protection

Run date: July 3, 2026

Requested staging requirements:

- Separate staging environment from production
- Real Supabase database
- Required Vercel environment variables
- Employer, candidate, and admin test users
- Full workflow using real staging records

Result:

- BLOCKED. Infrastructure blocker has moved from missing backend config to Vercel Preview access protection.
- Supabase staging project exists and the SQL schema has been applied.
- Vercel Preview environment now has Supabase URL, anon key, service-role key, session secret, storage driver, and app URL configured.
- Vercel Preview build passes at `https://build-me-a-simple-website-where-ia21mf8qz-cot-s-projects1.vercel.app`.
- Preview API endpoints are not reachable for external workflow QA because Vercel returns protected HTML instead of app API JSON.
- `OPENAI_API_KEY` is still not present in Preview; AI remains in safe fallback mode unless a key is added.

Blocking bugs are recorded in [staging-bug-tracker.md](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/staging-bug-tracker.md).

Fixes completed:

- Added Supabase storage adapter under the existing API layer.
- Added SQL schema: [supabase-staging-schema.sql](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/supabase-staging-schema.sql).
- Added staging preflight script: `npm run staging:preflight`.
- Added staging seed script: `npm run staging:seed`.
- Hardened staging seed script to fail fast on non-JSON/protected Preview responses.
- Added runbook: [staging-infrastructure-runbook.md](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/staging-infrastructure-runbook.md).
- Added `STORAGE_DRIVER=supabase` to `.env.example`.

Release gate result:

- P0 open bugs: 1
- P1 open bugs: 2
- Public deployment: BLOCKED
- Beta-ready status: BLOCKED

Required next actions:

1. Disable Vercel Preview protection temporarily, or share/configure the Preview access password/token with the QA tester.
2. Redeploy the latest Preview build.
3. Open the Preview URL in an incognito browser and confirm access.
4. Run full staging workflow validation:
   - Employer signup/login
   - Employer posts job
   - Public job board shows job
   - Candidate signup/login
   - Candidate saves job
   - Candidate applies with CV
   - Employer sees application
   - Employer updates status
   - Candidate sees updated status
5. Log all failures as P0/P1/P2/P3.
6. Keep release blocked until all P0/P1 bugs are fixed.

### Previous Blob-Backed QA Run

Run date: July 3, 2026

Test accounts created:

- Employer: `qa-employer-1783048804689@crossovertalent.asia`
- Candidate: `qa-candidate-1783048804689@crossovertalent.asia`
- Admin: `qa-admin-1783048804689@crossovertalent.asia`

Executed checks:

- Employer wrong-password and missing-field validation: PASS
- Employer signup/login: PASS
- Employer post/view/publish/unpublish job: PASS
- Public board reads real database jobs: PASS
- Candidate signup/login: PASS
- Candidate save job/apply/duplicate prevention: PASS
- Employer sees application and changes status: PASS
- Candidate tracks updated status: PASS
- Review save and public display: PASS
- Salary signal save and public display: PASS
- JD upload parse: PASS
- CV upload parse: PASS
- AI JD and CV fallback assistants: PASS
- Admin signup/login/read metrics: PASS
- Browser search/filter behavior: PASS
- Browser console errors during marketplace check: PASS, no errors
- Temporary public QA job/review/salary cleanup: PASS
- Production Vercel build: PASS

Release gate result:

- P0 open bugs: 0
- P1 open bugs: 0
- Production build: PASS
- Deployment status: PASS

## Execution Notes

Run local gates before deploy:

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
```

Run live staging workflow after deploy:

1. Create employer, candidate, and admin QA accounts.
2. Create a real job record from employer account.
3. Verify public job board and filters.
4. Save and apply from candidate account.
5. Verify employer can view application and update status.
6. Verify candidate sees updated status.
7. Submit review and salary signal; verify public display.
8. Test JD/CV upload parsing and AI fallback output.
9. Read admin metrics.
10. Clean up temporary public job, review, and salary records.
11. Confirm no P0/P1 bugs remain.
