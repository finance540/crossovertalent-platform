# Crossover Talent Security Audit

Date: July 3, 2026  
Scope: Application code, Supabase staging schema, deployment headers, dependency audit  
Audit type: Planning/audit only. No application code was modified.

## Security Summary

Security posture is acceptable for controlled Private Beta with trusted users, but not yet enterprise-grade or public-production-ready. The strongest current controls are server-side sessions, password hashing, same-origin checks, security headers, and no known production dependency vulnerabilities. The largest production risk is that the running app uses a service-role-backed generic JSON record store, so business authorization is enforced mostly in API code instead of native Supabase RLS over normalized tables.

## Authentication

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Passwords are hashed with `scrypt`. | Good | `api/_lib.js:175-185` | Keep. Consider adding password strength rules and breached-password checks for production. |
| Session cookies are signed and `HttpOnly`, `Secure`, `SameSite=Lax`. | Good | `api/_lib.js:194-197`, cookie set later in `_lib.js` | Keep. Add server-side session revocation/versioning for enterprise accounts. |
| Email verification exists but depends on staging workaround until email provider is configured. | P1 for production | Register routes return `verificationUrl`; verification route is `/api/verify`. | Configure transactional email before public production. |
| Admin registration is restricted to QA-style emails. | P2 | `api/admin.js:12-13`, `api/admin.js:149` | Replace with invite-only admin creation or seeded first admin for production. |

## Authorization

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Employer routes require employer session. | Good | `api/jobs.js:13`, `api/company.js:41` | Keep. Add negative tests for cross-company access. |
| Candidate dashboard checks verified candidate record. | Good | `api/candidate.js` current-candidate logic | Keep. Add tests for disabled/unverified users. |
| Admin routes require admin session for dashboard/moderation. | Good | `api/admin.js:35-54`, `api/admin.js:95-104` | Keep. Add production admin provisioning workflow. |
| Public application submission does not require candidate login. | P2 | `api/applications.js:8-24` | Decide business rule. For production, consider requiring candidate login or explicitly labeling public applications as guest applications. |

## RLS Policies

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Staging schema enables RLS on `app_records`, allowing service role only. | Good for current backend | `outputs/supabase-staging-schema.sql` defines `app_records_service_role_all`. | Accept for staging; document that API code owns authorization. |
| Normalized tables exist but are not used by current API routes. | P1 for production | `api/_lib.js:72-142` reads/writes `app_records`; normalized schema starts in `outputs/supabase-staging-schema.sql`. | Move Version 1.0 APIs to normalized tables so RLS and indexes protect real business data. |
| Public read policies on normalized tables are broad. | P2 | Public read policies for companies, reviews, salaries. | Before browser-direct Supabase usage, review exactly which columns are safe to expose. |

## API Protection

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Mutating routes use same-origin checks. | Good | `api/_lib.js:42-55`; routes call `assertSameOrigin`. | Keep. Add automated CSRF regression tests. |
| Rate limiting exists but is file/record-backed. | P2 | `api/_lib.js:57-65` writes rate-limit records to storage. | Move to Vercel KV/Upstash/Redis or provider-native WAF/rate limiting for production. |
| Public list endpoints have no server-side pagination. | P2 | `api/jobs.js:9-11`, `api/reviews.js`, `api/salary-signals.js`. | Add `limit`, `cursor/page`, and capped responses. |
| Admin payload returns broad operational data. | P2 | `api/admin.js:57-81` returns jobs, applications, users, reviews, salary signals. | Add pagination, audit logs, and least-privilege admin views. |

## Input Validation

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Core forms validate required fields and length limits. | Good | `api/jobs.js:23-45`, `api/applications.js:10-23`, `api/reviews.js`, `api/salary-signals.js`. | Keep. Centralize validators to reduce drift. |
| URLs are minimally validated. | P2 | Website and LinkedIn URL checks are regex/simple protocol checks. | Use URL parsing and stricter host allowlists where relevant. |
| Salary range validation exists. | Good | `api/salary-signals.js` validates min/max. | Keep. Add currency allowlist if needed. |

## File Upload Validation

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Upload parser enforces max decoded size. | Good | `api/assist.js:4`, `api/assist.js:14-18`. | Keep and add request body size controls at platform level. |
| Parser trusts MIME/filename to choose parser and does not verify file magic bytes. | P2 | `api/assist.js:50-58`. | Add magic-byte sniffing for PDF/DOCX/TXT and reject mismatches. |
| CV/JD uploads are parsed but not securely stored as storage objects. | P2 | `api/assist.js` returns parsed text; application/job records store metadata/text. | Store uploaded files in Supabase Storage with private bucket policies and signed download URLs. |
| Logo upload stores base64 data URL inside profile record. | P2 | `api/company.js:24-33`, `api/company.js:65`. | Store logos as objects in Supabase Storage; keep only object path/URL in the profile record. |
| SVG logos are allowed. | P2 | `api/company.js:4` includes `image/svg+xml`; CSP allows `img-src data:`. | Either sanitize SVGs server-side or disallow SVG uploads for production. |

## Secrets Management

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| No secrets are hardcoded in reviewed app files. | Good | Env usage found through `rg`; no secret values in source. | Keep. Rotate any credentials shared outside the env manager. |
| Service role is used only server-side. | Good | `api/_lib.js:78-86`. | Keep service role out of client bundles. |
| `SESSION_SECRET` falls back to development secret outside production. | P2 | `api/_lib.js:188-191`. | Make staging fail closed too, or require `SESSION_SECRET` in all deployed environments. |

## XSS

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Most dynamic rendering uses `escapeHtml()`. | Good | `outputs/app.js:7-9` and many render paths. | Keep. Add lint/testing around unsafe `innerHTML`. |
| App uses extensive `innerHTML`. | P2 | Many render functions in `outputs/app.js`. | Accept for current static app but keep strict escaping discipline; consider component framework or DOM builders for V1. |
| LinkedIn public display link is inserted after API-side validation. | P2 | `api/reviews.js` validates LinkedIn; frontend renders review link. | Also pass through `safeExternalUrl()` in review rendering for defense in depth. |

## CSRF

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Same-origin origin/referer checks exist for mutating requests. | Good | `api/_lib.js:42-55`. | Keep. Add CSRF tests. |
| No explicit anti-CSRF token. | P2 | SameSite and origin checks are the current model. | For production, add per-session CSRF tokens for sensitive account/admin actions. |

## SQL Injection

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Current app uses Supabase REST query params, not raw SQL. | Good | `api/_lib.js:106-142`. | Low SQL injection risk currently. Reassess if adding direct SQL/RPC. |
| Dynamic SQL exists only in staging schema migration block. | Low | `outputs/supabase-staging-schema.sql` loops known table names. | Accept; table list is static. |

## Dependency Vulnerabilities

`npm audit --omit=dev` result: `0 vulnerabilities`.

Production dependencies:

- `@vercel/blob`
- `mammoth`
- `pdf-parse`

Recommendation: keep dependency scanning in CI and monitor parser libraries closely, because file parsing dependencies have a higher risk profile than ordinary UI packages.

## Security Readiness Rating

Private Beta: **Acceptable with controlled users**  
Public Beta: **Needs hardening**  
Production: **Not ready until P1 production security items are complete**

Security score: **72/100**

Top security blockers before production:

1. Configure transactional email.
2. Move production data model to normalized tables with meaningful RLS.
3. Store uploads in secure storage buckets, not inline records.
4. Add server-side pagination and capped public/admin API responses.
5. Add production observability and security event monitoring.

