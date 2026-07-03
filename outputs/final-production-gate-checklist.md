# Final Production Gate Checklist

Date: July 4, 2026  
Product: CrossOver Talent - Impact Career Intelligence  
Scope: Manual production infrastructure gate before controlled public beta.  
Deployment status: Do not deploy publicly from this checklist.

## Current Verified State

| Area | Status |
|---|---|
| Commercial readiness | 95% |
| Product/code controlled beta readiness | Ready |
| Lint/typecheck/test/build | PASS |
| Playwright E2E | PASS, 6/6 |
| Homepage Lighthouse SEO | 100 |
| Public deployment | Not performed |
| Production release | Blocked pending manual checks below |

## 1. Production Supabase

| Check | Required Result | Status |
|---|---|---|
| Production Supabase project created | Dedicated production project exists, separate from staging | Manual verification required |
| SQL migrations applied | All required tables/schema applied successfully | Manual verification required |
| RLS policies applied | Row-level security enabled and policies active | Manual verification required |
| Storage buckets created | CV, JD, logo, and file buckets exist with correct privacy settings | Manual verification required |
| Signed URL access tested | Private files accessible only through authorized signed URLs | Manual verification required |
| Backup configured | Automated backup policy enabled | Manual verification required |
| Restore procedure tested or documented | Restore path confirmed before beta | Manual verification required |
| Production admin user created | Named admin account exists and can access admin dashboard | Manual verification required |

## 2. Email

| Check | Required Result | Status |
|---|---|---|
| Resend production API key added | `RESEND_API_KEY` configured in Vercel Production | Manual verification required |
| Sending domain verified | Production sender domain verified in Resend | Manual verification required |
| DNS records correct | SPF/DKIM/DMARC records pass provider checks | Manual verification required |
| Verification email tested | Employer, candidate, and admin verification emails received | Manual verification required |
| Password reset tested | Reset email received and reset flow succeeds | Manual verification required |
| Employer notification tested | Employer receives new-application notification | Manual verification required |
| Candidate notification tested | Candidate receives application/status notification | Manual verification required |

## 3. Vercel Production

| Check | Required Result | Status |
|---|---|---|
| Production environment variables added | Supabase, session, app URL, email, OpenAI/fallback, monitoring vars configured | Manual verification required |
| Custom domain connected | `crossovertalent.asia` or approved production domain connected | Manual verification required |
| SSL active | HTTPS certificate active and valid | Manual verification required |
| Production build passes | Vercel Production build completes successfully | Manual verification required |
| Health endpoint passes | `/api/health` returns healthy on production domain | Manual verification required |
| Readiness endpoint passes | `/api/ready` returns ready on production domain | Manual verification required |

## 4. OpenAI

| Check | Required Result | Status |
|---|---|---|
| `OPENAI_API_KEY` added if live AI is required | Production key configured only if product owner requires live AI | Manual verification required |
| AI generation tested | JD generation and CV revision work with live key | Manual verification required |
| AI fallback tested | Missing/failed key shows graceful fallback without crashes | Manual verification required |
| Rate limiting tested | AI endpoints rate-limit abusive usage | Manual verification required |

## 5. Security

| Check | Required Result | Status |
|---|---|---|
| Final RLS negative tests | Employer/candidate/public cross-access denied | Manual verification required |
| Admin-only route tests | Non-admin users denied from `/api/admin` and moderation actions | Manual verification required |
| Private file access tests | CV/JD private files cannot be downloaded without authorization | Manual verification required |
| No service role key exposed client-side | Browser source, network responses, and bundles do not expose service role key | Manual verification required |
| npm audit production clean | `npm audit --omit=dev` returns no production vulnerabilities | Previously passed locally; rerun before launch |

## 6. Controlled Beta Launch

| Check | Required Result | Status |
|---|---|---|
| Employer invite list ready | 5-10 employer contacts approved for first wave | Manual verification required |
| Candidate invite list ready | 25-50 candidate contacts approved for first wave | Manual verification required |
| Feedback form ready | Support/feedback widget and admin inbox available | Verified in code; production smoke required |
| Support inbox ready | Admin can view and triage support tickets | Verified in code; production smoke required |
| Monitoring dashboard ready | Admin operations dashboard accessible in production | Verified in code; production smoke required |
| Rollback plan ready | Vercel rollback and incident owner confirmed | Manual verification required |

## Final Gate Decision

**NO-GO for Controlled Public Beta.**

Reason: The product/codebase is ready, but the required manual production infrastructure checks have not been confirmed in this gate. Production Supabase, production email, Vercel production domain/build/health/readiness, OpenAI mode, security negative tests, and launch operations must be manually verified before inviting external beta users.

## Exact Remaining Blockers

| Blocker | Severity | Required Action |
|---|---|---|
| Production Supabase not confirmed | P0 | Confirm production project, schema, RLS, storage, signed URLs, backups, restore, and admin user. |
| Production email not confirmed | P0 | Configure and test Resend key, verified domain, DNS, verification, reset, and notification emails. |
| Vercel Production not confirmed | P0 | Confirm env vars, custom domain, SSL, build, `/api/health`, and `/api/ready`. |
| Production security negative tests not run | P0 | Run RLS, admin-only, private file, and service-role exposure checks. |
| OpenAI production mode not confirmed | P1 | Confirm live AI key or approved fallback-only mode; test generation, fallback, and rate limits. |
| Controlled beta launch list/ops not confirmed | P1 | Confirm invite lists, support owner, monitoring owner, and rollback owner. |

## GO Criteria

Change this gate to **GO for Controlled Public Beta** only when:

- All P0 blockers above are closed.
- All P1 blockers above are closed or explicitly accepted by the product owner.
- Production smoke test passes end to end.
- No new P0/P1 bugs are open.
- Product owner approves controlled beta launch.
