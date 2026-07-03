# API Route Inventory

Date: 2026-07-04

Scope: `api/*.js`

## Summary

| File count | Meaning |
|---|---:|
| Total JS files in `api/` | 16 |
| Shared helper modules | 1 |
| Public/API endpoints | 15 |
| Vercel Hobby function threshold from build error | 12 |
| Minimum reduction needed to stay on Hobby | At least 3 endpoint functions |

`api/_lib.js` is a shared module, not a public route by design, but it lives under `api/` and is imported by route handlers. The Vercel failure is caused by endpoint count, not by `_lib.js` itself.

## Route Inventory

| Route / file | Purpose | Approx. complexity | Must remain standalone? | Could be grouped? |
|---|---|---:|---:|---:|
| `api/admin.js` | Admin auth, moderation, analytics, users, jobs, reviews, feedback inbox | High | Yes | No; broad privileged surface and admin-only controls |
| `api/applications.js` | Candidate applications, duplicate prevention, employer status updates, withdrawal | Medium | Prefer yes | Could group with jobs only with moderate risk |
| `api/assist.js` | AI JD generation, CV parsing/improvement, document parsing | High | Yes | No; heavier dependencies and timeout profile |
| `api/auth.js` | Employer signup/login/logout/password reset/resend verification | Medium | Yes | Could group with candidate/admin auth only with high regression risk |
| `api/candidate.js` | Candidate signup/login/profile/CV/preferences/dashboard | High | Yes | No; distinct candidate domain |
| `api/company.js` | Employer company profile and logo upload/edit | Medium | Prefer yes | Could group with jobs/employer router with moderate risk |
| `api/email-templates.js` | Static production email template definitions | Low | No | Yes; can move to shared module or docs endpoint |
| `api/feedback.js` | Support tickets, feedback, bug reports, admin feedback listing/update | Medium | No | Yes; good candidate for support/ops router |
| `api/health.js` | Liveness check | Low | No | Yes; ideal for utility router |
| `api/jobs.js` | Public jobs, employer job CRUD, publish/unpublish/delete | Medium | Yes | Could group with company/applications only with moderate risk |
| `api/ready.js` | Readiness check for storage/database/env/bucket names | Low | No | Yes; ideal for utility router |
| `api/reviews.js` | Company review create/edit/list/moderation support | Medium | Prefer yes | Could group with salary signals only with moderate risk |
| `api/salary-signals.js` | Salary signal submission and public aggregates | Medium | Prefer yes | Could group with reviews only with moderate risk |
| `api/telemetry.js` | Client telemetry/audit logging | Low | No | Yes; ideal for utility/router consolidation |
| `api/verify.js` | Email verification token flow | Low/Medium | No | Yes; can join auth utility router if public URL is preserved |
| `api/_lib.js` | Shared storage/session/security/email helpers | Shared module | No public endpoint | Should move outside `api/` eventually for clarity, but not required for this blocker |

## Safest Grouping Candidates

If refactoring is chosen, the safest first grouping is the lightweight/utility set:

- `health`
- `ready`
- `telemetry`
- `email-templates`
- Possibly `verify`
- Possibly `feedback`

This could reduce endpoint functions from 15 to 10 or 11 if public URLs are preserved with Vercel rewrites into a single router function.

## Routes To Avoid Consolidating First

Avoid grouping these in the first pass unless necessary:

- `assist.js`: AI/document parsing has heavier dependencies and timeout characteristics.
- `admin.js`: privileged admin surface should remain isolated.
- `candidate.js`: candidate dashboard/profile/CV surface is broad.
- `auth.js`: core login/session flow is high-risk.
- `jobs.js`: core marketplace and employer posting flow is high-value.

## Inventory Conclusion

The current API shape is clean for maintainability but too many functions for the current Hobby deployment gate. The route count can be reduced without changing public URLs, but the lowest-risk resolution is a Vercel plan upgrade.
