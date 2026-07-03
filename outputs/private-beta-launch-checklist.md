# Crossover Talent Private Beta Launch Checklist

Date: July 3, 2026  
Current Preview URL: https://build-me-a-simple-website-where-fl7bahjhf-cot-s-projects1.vercel.app

## Gate Rules

- Private Beta may start only after the product owner accepts fallback-only AI and the staging email verification workaround.
- Public production remains blocked.
- Do not deploy publicly until production Supabase, production Vercel variables, real email verification, security/RLS audit, and production smoke testing are complete.
- Keep a daily bug triage rhythm during beta.

## Pre-Launch Approval

| Item | Owner | Status |
|---|---|---|
| Product owner accepts fallback-only AI for Private Beta | Product owner | Pending |
| Product owner accepts staging verification-link workaround | Product owner | Pending |
| Beta cohort confirmed | Product owner | Pending |
| QA owner confirmed | Team | Pending |
| Support/bug triage owner confirmed | Team | Pending |
| Rollback owner confirmed | Team | Pending |

## Beta Cohort

Recommended size: 5-10 trusted beta users.

Suggested mix:
- 2-3 employer users from climate, public health, or impact investment organizations.
- 3-5 candidate users with real job-search behavior.
- 1 admin/test operator.
- 1 internal observer for daily QA and feedback review.

## Test Accounts

Create beta accounts using non-production credentials and clearly labeled emails.

Employer account checklist:
- Employer account 1: company profile, logo, at least 2 jobs.
- Employer account 2: company profile, logo, at least 1 job.
- Employer account 3: company profile, at least 1 unpublished draft job.

Candidate account checklist:
- Candidate account 1: completed profile, CV uploaded, saved jobs, applications.
- Candidate account 2: profile with preferences, saved jobs, review/salary submissions.
- Candidate account 3: profile with application withdrawal test.

Admin account checklist:
- Admin can view users, jobs, applications, reviews, and salary signals.
- Admin can hide/delete inappropriate reviews.
- Admin can unpublish inappropriate jobs.
- Admin can disable/enable users if supported.

## Launch-Day Workflow

1. Confirm Preview URL opens the Crossover Talent app without Vercel login protection.
2. Confirm staging Supabase is connected and production Supabase is not being used.
3. Confirm no public production deployment is being promoted.
4. Run final beta smoke:
   - Employer signup/login.
   - Employer company profile and logo update.
   - Employer job creation and publish.
   - Public job board listing, search, filters, and pagination.
   - Candidate signup/login.
   - Candidate save job, apply with CV, withdraw application, and track status.
   - Employer application review and status update.
   - Review create/edit/public display.
   - Salary signal submission and aggregate display.
   - Admin moderation and user management.
   - AI fallback or live AI behavior.
5. Invite the beta cohort.
6. Share feedback form and bug reporting process.
7. Begin daily monitoring.

## Feedback Form

Recommended fields:
- Name
- Email
- Role: employer, candidate, admin, observer
- Page or workflow
- What were you trying to do?
- What happened?
- What did you expect?
- Screenshot or recording upload
- Browser/device
- Severity: blocker, serious issue, minor issue, suggestion
- Permission to contact for follow-up

## Bug Reporting Process

Severity definitions:

| Priority | Definition | Response |
|---|---|---|
| P0 | System unavailable, data loss, security exposure, or core workflow completely blocked | Stop beta workflow, fix immediately, retest before continuing. |
| P1 | Employer/candidate/admin critical workflow broken with no reasonable workaround | Fix before expanding beta cohort. |
| P2 | Important workflow issue with workaround, confusing UX, or non-critical integration issue | Triage daily and schedule promptly. |
| P3 | Polish, copy, layout, minor mobile/accessibility issue, or enhancement request | Batch for planned improvements. |

Bug ticket fields:
- Title
- Priority
- Status
- Reporter
- Environment and URL
- Page/feature
- Steps to reproduce
- Expected result
- Actual result
- Screenshot/video
- Owner
- Fix version or target date

## Daily Monitoring Checklist

Run daily during Private Beta:

- Check Vercel deployment/function errors.
- Check Supabase auth errors.
- Check Supabase database write failures.
- Check Supabase storage upload/download failures.
- Review new applications, reviews, salary signals, and uploaded files.
- Review failed login/signup reports.
- Review AI endpoint behavior and fallback messages.
- Review feedback form submissions.
- Triage all new bugs and assign P0/P1/P2/P3.
- Confirm no accidental public production deployment occurred.
- Capture a daily metrics snapshot:
  - New users
  - New employers
  - New candidates
  - New jobs
  - New applications
  - New reviews
  - New salary signals
  - Upload success/failure count

## Regression Checklist

Before each beta expansion:

- Employer can register, verify, log in, create company, upload logo, post job, and view applications.
- Candidate can register, verify, log in, upload CV, save jobs, apply, withdraw, and track status.
- Public job board shows real database jobs only.
- Search and filters work with pagination.
- Reviews save, edit, moderate, and display publicly.
- Salary signals save and display as aggregate insights.
- Admin-only pages deny non-admin users.
- AI features work live or show safe fallback.
- Forms validate required fields and show success/error messages.
- No major browser console errors.
- Mobile layout remains usable.

## Rollback Plan

Use this if a P0 or severe P1 appears during Private Beta:

1. Pause new beta invitations immediately.
2. Post a short beta status note to testers if user-facing impact exists.
3. Disable or hide the affected workflow if possible.
4. Revert to the previous known-good Vercel Preview deployment if the regression is deployment-related.
5. Preserve Supabase data for debugging before cleanup.
6. Fix the issue in staging.
7. Re-run the full smoke workflow.
8. Resume beta only after the P0/P1 is closed and retested.

## Private Beta Go/No-Go

Current recommendation: **Go for Private Beta only after product owner accepts the two known limitations.**

Current public production recommendation: **No-Go.** Public production remains blocked until production services and final production QA are complete.

