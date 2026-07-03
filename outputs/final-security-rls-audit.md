# Final Security And RLS Audit

Date: July 3, 2026  
Status: **Partially complete; final production RLS verification blocked until production Supabase is configured.**

## Summary

The application has strong server-side checks for the current serverless/API architecture. However, because the current live data path uses `app_records` with the Supabase service role, real business isolation is enforced mainly by API code rather than direct row-level policies on normalized tables.

This is acceptable for controlled Private Beta and production release candidate testing, but final public production should include a production Supabase verification pass and ideally a migration to normalized table access.

## Security Controls Present

- Signed `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
- Password hashing with `scrypt`.
- Same-origin checks for mutating requests.
- Rate limiting on auth, applications, jobs, reviews, salary signals, AI, and telemetry.
- Security headers and CSP in `vercel.json`.
- Service role key used server-side only.
- Email verification required before dashboards.
- Admin-only route checks.
- File type/size/signature checks.
- SVG logo upload disabled by default.
- Audit logging added for sensitive workflows.
- `npm audit --omit=dev` passed with 0 vulnerabilities during hardening.

## RLS Model

Current app runtime:

- Uses `public.app_records`.
- `app_records` should be service-role-only.
- Public/browser direct access to `app_records` should be denied.

Required policy:

- `app_records_service_role_all`
- `app_records_no_anon_access`

Normalized production tables:

- Present in schema instructions.
- Should remain service-role-only until browser/direct access is intentionally designed and audited.

## Access-Control Review

| Requirement | Current Status | Evidence / Notes | Final Production Status |
|---|---|---|---|
| Employer cannot access other employers’ data | Implemented in API | Employer routes use `session.companyId` path prefixes. | Needs production negative test |
| Candidate cannot access other candidates’ data | Implemented in API | Candidate dashboard loads by session email hash. Withdrawal checks application email. | Needs production negative test |
| Public users cannot access private records | Implemented in API/RLS model | Public APIs expose only jobs/reviews/salary aggregates; `app_records` direct access should be denied. | Needs production Supabase RLS test |
| Admin routes are admin-only | Implemented | Admin API checks `session.role === 'admin'` and verified admin record. | Needs production negative test |
| Storage files use safe access controls | Partially implemented | CV/JD buckets intended private; logo bucket public. Signed URL helper exists. | Needs production bucket policy validation |
| Service role key never exposed client-side | Implemented by architecture | Used only in `api/_lib.js`; not in frontend. | Needs production bundle/network/log inspection |

## Required Negative Tests

Run after production env is configured:

1. Employer A attempts to fetch Employer B jobs/applications.
2. Candidate A attempts to view Candidate B dashboard/applications.
3. Anonymous user attempts to access `/api/company`, `/api/applications`, `/api/admin`.
4. Non-admin user attempts `/api/admin`.
5. Browser anon key attempts direct read from `public.app_records`.
6. Direct storage request attempts private CV/JD object download without signed URL.
7. Public logo URL works only for logo bucket.
8. Service role key search across client bundle/network responses returns no match.

## OWASP Review

| Area | Status | Notes |
|---|---|---|
| Broken access control | Partially controlled | API checks present; production negative tests required. |
| Cryptographic failures | Controlled | Passwords hashed; cookies signed; HTTPS required in production. |
| Injection | Low current risk | No raw SQL in API; Supabase REST used. |
| Insecure design | Improving | Audit logs and provider configs added; normalized data migration still recommended. |
| Security misconfiguration | Pending | Production env/domain/storage settings must be verified. |
| Vulnerable components | Pass | `npm audit --omit=dev` passed. |
| Auth failures | Improving | Verification and reset added; production email pending. |
| Data integrity failures | Pending | Backups/restore must be configured. |
| Logging/monitoring failures | Improving | Audit/telemetry added; external monitoring not fully configured. |
| SSRF | Low | App does not fetch arbitrary user URLs except fixed provider APIs. |

## Current Result

Result: **BLOCKED FOR FINAL SIGN-OFF**  
Reason: Production Supabase project, bucket policies, negative access tests, and bundle/network secret checks have not been run against production.

