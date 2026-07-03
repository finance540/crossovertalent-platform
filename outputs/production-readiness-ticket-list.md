# Crossover Talent Production Readiness Ticket List

Date: July 3, 2026  
Scope: Work required after Private Beta readiness and before public production launch.

## Ticket Summary

| Ticket | Title | Priority | Status |
|---|---|---|---|
| PROD-001 | Configure transactional email provider for real verification emails | P1 for production | Open |
| PROD-002 | Add `OPENAI_API_KEY` for live AI generation, if required | P2/P1 depending product decision | Open |
| PROD-003 | Configure production Supabase project | P1 for production | Open |
| PROD-004 | Configure production Vercel environment variables | P1 for production | Open |
| PROD-005 | Configure custom domain | P2 | Open |
| PROD-006 | Final security and RLS audit | P1 for production | Open |
| PROD-007 | Final production smoke test | P1 for production | Open |
| PROD-008 | Monitoring, logging, and alerting | P2 | Open |
| PROD-009 | Staging data cleanup and seed reset process | P3 | Open |
| PROD-010 | Production rollback and backup procedure | P1 for production | Open |

## PROD-001 - Configure Transactional Email Provider

Priority: P1 for production  
Status: Open

Description:
Configure a real transactional email provider so employer, candidate, and admin users receive verification and password reset emails in their inboxes.

Acceptance criteria:
- Signup sends a verification email to the submitted address.
- Verification link marks the user as verified.
- Unverified users cannot access protected dashboards.
- Resend verification email works.
- Password reset email works.
- Email templates use Crossover Talent branding.
- Production domain is authorized for sending.

QA validation:
- Create employer, candidate, and admin accounts with real inboxes.
- Confirm delivery, link click, verified login, and protected dashboard access.
- Confirm resend verification and password reset flows.

## PROD-002 - Add Live OpenAI Configuration

Priority: P2, or P1 if live AI is required for launch  
Status: Open

Description:
Add `OPENAI_API_KEY` to the correct Vercel environment if product owner wants live AI JD generation, CV parsing, and resume improvement for beta or production.

Acceptance criteria:
- `OPENAI_API_KEY` is configured only in Vercel environment variables.
- JD generator returns live model output.
- CV assistant returns live model output or clear file parsing result.
- Missing/invalid key still produces graceful fallback, not crashes.
- No API key is exposed in client bundles or logs.

QA validation:
- Test AI routes with key present.
- Temporarily test missing-key fallback in a non-production environment.
- Confirm no secret appears in browser console/network payloads.

## PROD-003 - Configure Production Supabase Project

Priority: P1 for production  
Status: Open

Description:
Create and configure a dedicated production Supabase project separate from staging.

Acceptance criteria:
- Production schema and migrations are applied.
- RLS is enabled on all protected tables.
- Storage buckets exist for CVs, job descriptions, and logos.
- Auth email/password is enabled.
- Backups are configured.
- Staging and production data are fully separated.

QA validation:
- Run connection checks against production Supabase.
- Validate auth, CRUD, storage upload/download, and protected data access.
- Confirm staging records are not visible in production.

## PROD-004 - Configure Production Vercel Environment Variables

Priority: P1 for production  
Status: Open

Description:
Populate production Vercel environment variables without hardcoding or committing secrets.

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `OPENAI_API_KEY`, if live AI is approved
- `NEXT_PUBLIC_APP_URL`

Acceptance criteria:
- Variables are configured in Vercel Production environment.
- `SESSION_SECRET` is at least 32 bytes and unique to production.
- Service role key is server-only.
- Production build uses production Supabase and production app URL.

QA validation:
- Deploy to a production candidate build.
- Verify API routes, auth redirects, storage, and database writes use production services.

## PROD-005 - Configure Custom Domain

Priority: P2  
Status: Open

Description:
Configure the production custom domain for Crossover Talent.

Acceptance criteria:
- Domain points to Vercel production deployment.
- HTTPS certificate is active.
- `NEXT_PUBLIC_APP_URL` matches the final production domain.
- Supabase auth redirect URLs include the final production domain.
- No broken canonical links or redirect loops.

QA validation:
- Open the custom domain in desktop and mobile browsers.
- Complete login, logout, verification, and password reset flows using the custom domain.

## PROD-006 - Final Security And RLS Audit

Priority: P1 for production  
Status: Open

Description:
Review database policies, API authorization, storage permissions, and client/server boundaries before public launch.

Acceptance criteria:
- Users can read/write only their allowed records.
- Employers cannot access other employers' private applications.
- Candidates cannot access other candidates' saved jobs, profiles, or applications.
- Admin-only routes deny non-admin users.
- Storage paths prevent unauthorized file access.
- No secrets are exposed in client code, logs, or committed files.

QA validation:
- Run negative access tests across employer, candidate, admin, and anonymous users.
- Review Supabase RLS policies and API service-role usage.

## PROD-007 - Final Production Smoke Test

Priority: P1 for production  
Status: Open

Description:
Run the full smoke workflow against production services before public launch.

Acceptance criteria:
- Employer signup, verification, login, company setup, logo upload, job post, edit, publish, unpublish, delete pass.
- Candidate signup, verification, login, profile setup, CV upload, save job, apply, withdraw, status tracking pass.
- Public job board search, filters, pagination, company pages, and job detail pages pass.
- Reviews and salary signals save and display publicly without exposing private user data.
- Admin moderation and user management pass.
- AI works live or falls back safely according to product decision.

QA validation:
- Run automated smoke tests.
- Complete manual browser validation on desktop and mobile.
- Confirm no major console errors.

## PROD-008 - Monitoring, Logging, And Alerting

Priority: P2  
Status: Open

Description:
Add operational monitoring for beta and production.

Acceptance criteria:
- Vercel function errors are monitored daily.
- Supabase auth/database/storage errors are reviewed daily during beta.
- A bug intake process exists for beta users.
- Critical failures have an owner and response process.

QA validation:
- Trigger a controlled handled error and confirm it appears in monitoring/logs.
- Confirm daily monitoring checklist owner.

## PROD-009 - Staging Data Cleanup And Seed Reset

Priority: P3  
Status: Open

Description:
Create a repeatable cleanup or reset process for staging data generated by QA runs.

Acceptance criteria:
- QA seed data can be identified by stamp or prefix.
- Old QA records can be safely cleaned without touching production.
- Seed scripts remain idempotent enough for repeated runs.

QA validation:
- Run cleanup in staging.
- Re-run seed and smoke test successfully.

## PROD-010 - Production Rollback And Backup Procedure

Priority: P1 for production  
Status: Open

Description:
Document and test a rollback plan before public production launch.

Acceptance criteria:
- Previous Vercel deployment can be restored quickly.
- Database backup/restore approach is documented.
- Emergency disable/maintenance approach is documented.
- Rollback communication owner is assigned.

QA validation:
- Dry-run Vercel rollback procedure in a safe environment.
- Confirm Supabase backup availability and restore process.

