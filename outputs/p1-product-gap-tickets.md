# CrossOver Talent P1 Product Gap Tickets

Created: July 3, 2026

Release status: **PRIVATE BETA READY PENDING PRODUCT OWNER ACCEPTANCE OF FALLBACK EMAIL/AI MODE**

The Vercel Preview protection P0 is fixed and the new Preview URL is externally reachable:

- `https://build-me-a-simple-website-where-j4chy1dmp-cot-s-projects1.vercel.app`

All previously open P1 workflows now have implemented and validated staging paths. Two staging-mode caveats remain documented below: email delivery uses an in-app verification-link fallback because no transactional email provider is configured, and AI is fallback-only unless `OPENAI_API_KEY` is added.

## P1-001 Email Verification Workflow

Status: **Fixed with staging fallback**

Problem:

- Employer, candidate, and admin registration now create unverified accounts and return a verification link.
- Login/dashboard access is blocked until verification succeeds.
- Resend verification actions exist for employer, candidate, and admin.
- Staging does not have a transactional email provider configured, so the verification URL is surfaced in the UI/API for QA.

Required fix:

- Configure a real email provider before public launch if actual inbox delivery is required.

QA validation:

- Register employer with a real email.
- Confirm account is pending verification.
- Open verification link.
- Confirm employer can log in and post only after verification.
- Repeat for candidate registration.
- Test expired/invalid token errors.
- Test resend verification.

## P1-002 Company Profile And Logo Workflow

Status: **Fixed**

Problem:

- Employer company profile API/UI added.
- Fields include company name, website, sector, location, description, and logo.
- Logo upload, preview, replace, and remove are implemented with type/size validation.

Required fix:

- Add company profile create/edit endpoint and UI.
- Store company mission, sector, location, website, logo, and profile metadata.
- Implement logo upload with file type/size validation.
- Display company profile publicly with jobs/reviews/salary signals.

QA validation:

- Employer registers.
- Employer creates/edits company profile.
- Employer uploads PNG/JPG/SVG logo.
- Invalid file type/oversized logo is rejected.
- Public company profile shows updated company data and logo.

## P1-003 Candidate Application Withdrawal

Status: **Fixed**

Problem:

- Candidate-owned application withdrawal added.
- Withdrawal is blocked for `offered`/`hired`.
- Employer and candidate dashboards read the same `withdrawn` status.

Required fix:

- Add candidate-owned withdraw action.
- Preserve application history while changing status to `withdrawn`, or delete only if product policy allows.
- Prevent employer status changes after withdrawal unless policy allows reopening.

QA validation:

- Candidate applies to a job.
- Candidate withdraws application.
- Candidate dashboard shows `Withdrawn`.
- Employer dashboard shows withdrawn status.
- Candidate cannot withdraw another candidate's application.
- Duplicate apply behavior after withdrawal follows product policy.

## P1-004 Pagination On List/Search Pages

Status: **Fixed**

Problem:

- Pagination controls added for public jobs, companies, reviews, salary signals, employer jobs, employer applications, candidate applications, and admin users.
- Search/filter state is preserved while paging.

Required fix:

- Add pagination controls and page-size handling for public jobs, companies, reviews, salaries, employer jobs/applications, and admin lists.
- Support filtered result counts.
- Keep search/filter state while changing pages.

QA validation:

- Seed more than one page of jobs.
- Verify next/previous page works.
- Verify search/filter then paginate.
- Verify empty states when filters remove all results.
- Verify mobile pagination controls.

## P1-005 Review Editing Workflow

Status: **Fixed**

Problem:

- Owner-only review edit added.
- Admin review hide/restore moderation added.
- Public reviews no longer expose owner hashes.

Required fix:

- Add owner-only review edit endpoint/UI.
- Preserve reviewer display mode rules.
- Revalidate company email and LinkedIn display fields.
- Add audit timestamp such as `updated_at`.

QA validation:

- User creates review.
- User edits headline/pros/cons/advice/display mode.
- Public review listing updates.
- Different user cannot edit the review.
- Invalid LinkedIn display input is rejected.

## P1-006 Admin Moderation And User Management

Status: **Fixed**

Problem:

- Admin dashboard route added at `?admin=1`.
- Admin APIs now return users, employers, candidates, jobs, applications, reviews, salary signals, and metrics.
- Admin can disable/enable users, unpublish/restore jobs, and hide/restore reviews.

Required fix:

- Add admin dashboard UI.
- Add user search/list/suspend/restore workflow.
- Add job moderation: view, unpublish, restore/delete.
- Add review moderation: view, hide, restore/delete.
- Add analytics dashboard for users, jobs, applications, reviews, salaries, and conversion metrics.
- Protect all admin endpoints with admin-only access.

QA validation:

- Admin logs in.
- Admin lists users and views details.
- Admin suspends/restores user.
- Admin moderates job.
- Admin moderates review.
- Non-admin cannot access admin APIs.
- Analytics counts match seeded records.

## P1-007 AI Production Configuration

Status: **Fixed / fallback-only mode**

Problem:

- AI endpoints return safe deterministic fallback output.
- Upload parsing and CV/JD assistant flows do not crash when `OPENAI_API_KEY` is missing.
- Staging is currently fallback-only unless `OPENAI_API_KEY` is configured.

Required fix:

- Add `OPENAI_API_KEY` to Vercel Preview if real AI generation is required for Private Beta.
- Otherwise explicitly approve fallback-only AI behavior for staging/private beta.

QA validation:

- With key configured: JD generator and resume improvement return AI output.
- Without key configured: UI shows clear fallback and does not break.
- Upload parsing errors are clear and recoverable.

## Current QA Passes After P0 Fix

Live Preview smoke passed:

- Employer register/verify/login/session
- Company profile and logo update
- Employer create/edit/publish/unpublish/delete job
- Public board shows active job
- Candidate register/verify/login/profile/save/apply
- Duplicate application blocked
- Employer sees application
- Employer updates candidate status
- Candidate withdraws application
- Candidate sees updated status
- JD generator/fallback endpoint
- TXT upload parsing
- Resume improvement fallback
- Anonymous review create
- Review owner edit
- Public review listing
- Salary signal submit
- Salary aggregate listing
- Admin register/verify/login, metrics, review moderation, and user disable

Latest evidence:

- Preview URL: `https://build-me-a-simple-website-where-fl7bahjhf-cot-s-projects1.vercel.app`
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- `npm run staging:seed`: PASS
- `node work/staging-e2e-smoke.mjs`: PASS
- Browser pagination check: 10 public jobs rendered on page 1 of 21 across 201 records
