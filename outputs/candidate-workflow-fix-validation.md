# Candidate Workflow Fix Validation

Date: 2026-07-06

## Scope

Fixed the highest-impact job seeker issues reported after Google login:

- CV upload from the candidate dashboard.
- Save jobs and application tracking after OAuth login.
- Candidate application status tracking and withdrawal error handling.
- Review submission from verified candidate accounts.
- Optional company URL on reviews.
- Candidate dashboard back navigation.

## Changes Made

- Bound signed-in candidate applications to the authenticated candidate session email on the server, even if the application form contains a different email.
- Added a dashboard-level CV upload control in Resume & AI that parses PDF/DOC/DOCX/TXT through the existing `/api/assist` upload route and saves parsed text to the candidate profile.
- Refreshed candidate application state after job application submission so status tracking updates without requiring a manual reload.
- Added a candidate dashboard Back button.
- Allowed verified candidate accounts to create reviews from OAuth/personal email addresses while keeping unauthenticated review submission blocked.
- Added optional Company URL to review creation, editing, and public review display.
- Fixed a client-side withdrawal error path that referenced an undefined variable.

## Validation

Local checks:

- `npm run lint` PASS
- `npm run typecheck` PASS
- `npm run build` PASS
- `npm run test` PASS
- `npm run test:e2e` PASS, 6/6

Playwright coverage confirmed:

- Candidate signup/login.
- CV upload/parse through `/api/assist`.
- Save job.
- Apply to job with authenticated session identity.
- Track application status.
- Withdraw application.
- Candidate review submission.
- Salary signal submission.
- Employer application visibility/status update.
- Admin moderation.

## Security Notes

- No service role keys, OAuth secrets, OpenAI keys, Resend keys, Vercel tokens, or Supabase secrets were added to code.
- Public applicants can still apply without an account.
- Signed-in candidate applications are now safer because the server uses the authenticated candidate email for duplicate prevention and status tracking.
- Review creation still requires a signed-in user.

## Remaining Limitations

- Live Google/LinkedIn OAuth provider behavior depends on Supabase provider configuration and external provider availability.
- Production smoke for a real Google account should be run after deployment using a verified job seeker session.

## Recommendation

GO for controlled production deployment of this candidate workflow fix.
