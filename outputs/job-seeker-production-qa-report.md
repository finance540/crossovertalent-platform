# Job Seeker Production QA Report

Generated: 2026-07-06T15:58:41.060Z
Target: https://crossovertalent.asia

## Summary

Executed 20 job seeker journey checks. Open P0/P1 bugs: 1.

Local regression after QA fix:

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npm run build`: PASS
- `npm run test`: PASS
- `npm run test:e2e`: PASS, 6/6

Small local fix implemented after QA: the public marketplace now calls `/api/candidate?optional=1` for optional session restoration, and `/api/candidate` returns HTTP 200 with `{ candidate: null, applications: [] }` for that optional unauthenticated check. This removes the avoidable public-page 401 console noise without weakening protected candidate dashboard access.

## Checks

| Feature | Status | Evidence | Severity |
|---|---:|---|---|
| Health endpoint | PASS | HTTP 200 |  |
| Readiness endpoint | PASS | HTTP 200; ref=hntvcqahoseizmgswohq |  |
| Homepage candidate CTAs | PASS | Find Jobs, Submit CV, candidate guide content present |  |
| No staging ref in homepage HTML | PASS | no staging ref |  |
| Public jobs list | PASS | HTTP 200; jobs=5 |  |
| Public jobs filtered API returns safely | PASS | HTTP 200; jobs=5 |  |
| Candidate dashboard protected without login | PASS | HTTP 401 |  |
| Save job protected without login | PASS | HTTP 401; Job seeker sign in required |  |
| Auth provider status | PASS | {"google":{"configured":true,"setupRequired":false},"linkedin":{"configured":true,"setupRequired":false},"phone":{"configured":false,"setupRequired":true}} |  |
| Candidate Google OAuth start | PASS | HTTP 302; location=https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcrossovertalent.asia%2F%3Fauth_callback%3D1%26role%3Dcandid |  |
| Candidate LinkedIn OAuth start | PASS | HTTP 302; location=https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=linkedin_oidc&redirect_to=https%3A%2F%2Fcrossovertalent.asia%2F%3Fauth_callback%3D1%26role%3 |  |
| Candidate LinkedIn completed OAuth | FAIL | LinkedIn returns redirect_uri mismatch | P1 |
| Candidate phone OTP | BLOCKED | HTTP 503; Phone OTP login is prepared but not enabled yet. Configure Supabase Auth phone/SMS provider before activating this login method. | P2 |
| Candidate email/password signup | PASS | HTTP 202; verificationRequired=true; verificationLinkExposed=false |  |
| Candidate email verification gate | PASS | HTTP 403; Verify your email before signing in |  |
| Verified candidate dashboard journey | BLOCKED | Verification link is not exposed in production response; requires inbox access or existing verified candidate QA credentials. |  |
| Local E2E verified candidate workflow | PASS | Playwright test covers candidate signup, verification helper, CV upload, save job, apply, withdraw, and track status. |  |
| Candidate CV TXT parsing | PASS | HTTP 200; method=plain-text; error= |  |
| Public job application submission | PASS | HTTP 201; job=Chief Agriculture Operations Officer;  |  |
| Duplicate application prevention | PASS | HTTP 409; You have already applied for this role |  |
| AI navigation assistant candidate guidance | PASS | HTTP 200; To complete your profile, open Candidate Dashboard -> Resume & preferences, upload or paste your CV, add LinkedIn, and save your preferences.

To discover roles |  |

## Bugs

| Bug ID | Severity | Feature | Expected | Actual | Fix Plan | Status |
|---|---|---|---|---|---|---|
| LIVE-P1-AUTH-LINKEDIN-001 | P1 | Candidate LinkedIn login | LinkedIn should accept the Supabase callback and show login/consent. | LinkedIn returns redirect_uri does not match the registered value. | Save https://hntvcqahoseizmgswohq.supabase.co/auth/v1/callback in LinkedIn Developer Auth, or create a fresh LinkedIn app that accepts the callback and update Supabase credentials. | Open |

## Blocked Checks

- Verified candidate dashboard, save jobs as logged-in candidate, application tracking, withdrawal, profile update, and AI resume revision require a verified candidate QA account or email inbox access. Production correctly does not expose verification links.
- Completed Google OAuth requires interactive Google credentials.
- Completed LinkedIn OAuth currently fails because LinkedIn does not accept the configured redirect URI.
- The public jobs page 401 console noise is fixed locally but not yet deployed to production.

## Test Data Created

- Candidate signup attempt: qa-jobseeker-20260706155841@crossovertalent.asia
- Public application test email if a job existed: qa-apply-20260706155841@crossovertalent.asia

## Recommendation

Production can remain live for controlled beta. Do not scale job seeker onboarding until:

1. LinkedIn OAuth callback is fixed in LinkedIn Developer or replaced with a fresh LinkedIn app.
2. Scanned PDF OCR quota/billing is fixed for candidate CV uploads and employer JD uploads.
3. The local optional-session console fix is committed and deployed.
4. A verified candidate QA account or inbox access is available for production dashboard validation.
