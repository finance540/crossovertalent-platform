# Crossover Talent Final Production Checklist

Date: July 3, 2026  
Status: Public production remains blocked.

## Launch Gate

Public production can proceed only after all required checks below are complete and the product owner approves launch.

Current blockers:

- Production transactional email provider not configured.
- Production Supabase project not configured/validated.
- Production Vercel environment variables not configured/validated.
- Product owner approval pending.
- Live OpenAI decision pending if AI is marketed as a production feature.

## DNS And Custom Domain

- [ ] Confirm final production domain.
- [ ] Configure DNS records for Vercel.
- [ ] Verify apex/root and `www` behavior.
- [ ] Configure canonical redirect policy.
- [ ] Update `NEXT_PUBLIC_APP_URL` to final production URL.
- [ ] Add production URL to Supabase auth redirect allowlist.

## SSL / HTTPS

- [ ] Confirm Vercel SSL certificate is issued and active.
- [ ] Confirm HTTPS redirects work.
- [ ] Confirm HSTS policy is appropriate for final domain.
- [ ] Confirm no mixed-content warnings.

## Transactional Email

- [ ] Choose provider: Resend, SendGrid, Postmark, AWS SES, or Supabase-compatible SMTP.
- [ ] Configure sender domain and DNS records.
- [ ] Configure verification email template.
- [ ] Configure password reset email template.
- [ ] Configure email rate limits and abuse controls.
- [ ] Test employer verification.
- [ ] Test candidate verification.
- [ ] Test admin verification.
- [ ] Test password reset.

## Monitoring

- [ ] Enable Vercel function logs monitoring.
- [ ] Enable Supabase auth/database/storage monitoring.
- [ ] Add application error reporting.
- [ ] Add uptime checks for homepage and key APIs.
- [ ] Add alert owner and escalation process.
- [ ] Add daily beta/production health dashboard.

## Backups

- [ ] Enable Supabase production backups.
- [ ] Confirm backup retention period.
- [ ] Document restore procedure.
- [ ] Dry-run restore in a safe environment if possible.
- [ ] Export critical configuration checklist.

## Logging

- [ ] Define what is safe to log.
- [ ] Avoid logging passwords, tokens, service-role keys, CV contents, or private profile data.
- [ ] Add request IDs/correlation IDs.
- [ ] Add audit logs for admin moderation actions.
- [ ] Add auth/security event logs.

## Analytics

- [ ] Choose analytics provider.
- [ ] Track privacy-safe events:
  - Signup started/completed
  - Verification completed
  - Job posted
  - Job published
  - Application submitted
  - Review submitted
  - Salary signal submitted
  - Upload parse success/failure
- [ ] Add cookie/privacy notice if required.
- [ ] Confirm analytics does not capture sensitive CV/application text.

## Error Reporting

- [ ] Configure frontend error capture.
- [ ] Configure API/serverless error capture.
- [ ] Add release/deployment tags.
- [ ] Add alert thresholds for P0/P1 workflows.
- [ ] Verify errors are redacted.

## OpenAI

- [ ] Product owner decides whether live AI is required for Version 1.0.
- [ ] If yes, configure `OPENAI_API_KEY` in Vercel Production only.
- [ ] Add usage limits and monitoring.
- [ ] Add model/error fallback behavior.
- [ ] Add AI terms/disclaimer copy.
- [ ] Confirm no private CV/application data is sent without appropriate user consent.
- [ ] Test missing-key fallback in staging.
- [ ] Test live-key behavior in production candidate environment.

## Supabase

- [ ] Create production Supabase project.
- [ ] Apply production schema/migrations.
- [ ] Move APIs to normalized production tables or explicitly approve `app_records` for launch.
- [ ] Enable and review RLS.
- [ ] Configure production storage buckets:
  - CVs
  - Job descriptions
  - Company logos
- [ ] Configure auth email/password.
- [ ] Configure auth redirect URLs.
- [ ] Validate service-role key is server-only.
- [ ] Run negative RLS/authorization tests.

## Vercel

- [ ] Configure Production environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SESSION_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `OPENAI_API_KEY`, if live AI is approved
  - storage-related variables if needed
- [ ] Confirm Preview and Production environments are separate.
- [ ] Confirm Vercel build passes.
- [ ] Confirm deployment protection policy is appropriate.
- [ ] Confirm production domain routes to the correct deployment.
- [ ] Confirm rollback procedure.

## Security

- [ ] Rotate any credentials that were shared outside secure env management.
- [ ] Final RLS audit complete.
- [ ] API authorization negative tests complete.
- [ ] File upload validation reviewed.
- [ ] SVG upload policy decided.
- [ ] CSRF/token strategy reviewed.
- [ ] Rate limiting moved to production-grade store/provider.
- [ ] Dependency audit passes.
- [ ] Security headers verified on production domain.

## QA

- [ ] Production smoke test passes:
  - Employer signup/verify/login
  - Company profile/logo
  - Job create/edit/publish/unpublish/delete
  - Candidate signup/verify/login
  - Save/apply/withdraw/track application
  - Employer status update
  - Public search/filter/pagination
  - Reviews and moderation
  - Salary signals and aggregate display
  - Upload parsing
  - AI live or fallback behavior
  - Admin moderation
- [ ] Desktop browser test complete.
- [ ] Mobile browser test complete.
- [ ] No major console errors.
- [ ] No open P0/P1 bugs.

## Final Launch Approval

- [ ] Engineering sign-off.
- [ ] Product owner sign-off.
- [ ] QA sign-off.
- [ ] Security sign-off.
- [ ] Rollback owner confirmed.
- [ ] Launch communications ready.

