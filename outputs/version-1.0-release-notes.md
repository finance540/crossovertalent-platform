# Crossover Talent Version 1.0 Release Notes

Date: July 3, 2026  
Status: Release Candidate hardening in progress. Public production is not approved until provider configuration and production smoke testing are complete.

## Highlights

- Production email integration path added through Resend.
- Email verification delivery now attempts provider email when `RESEND_API_KEY` is configured, while preserving safe staging fallback links.
- Password reset API flows added for employer, candidate, and admin accounts.
- Employer and candidate notification emails added for application submission and application status updates.
- Review moderation notification support added through `REVIEW_MODERATION_EMAIL`.
- OpenAI integration path added for JD generation and CV revision with timeout-safe fallback behavior.
- Supabase Storage upload path added for parsed CV/JD files and company logos.
- Audit logging added for auth, verification, applications, reviews, salary signals, admin moderation, AI fallback, file uploads, and telemetry.
- First-party telemetry endpoint added for client errors and navigation performance.
- CSP updated for Supabase object images and optional Resend/OpenAI/Sentry/PostHog/GA endpoints.

## Known Release Candidate Limitations

- Provider keys are not configured by code. Production requires Vercel environment variable setup.
- Virus scanning is marked as not configured unless `FILE_SCAN_PROVIDER` is added and implemented.
- Supabase Storage bucket names must be production bucket names in Vercel Production env.
- Sentry/PostHog/GA are prepared as configuration items, but a full vendor SDK integration is still recommended.
- Current data access still uses the generic `app_records` API store; normalized table migration remains recommended before enterprise scale.

## Production Approval Status

Private Beta: Ready, conditional.  
Public Production: Blocked until production provider configuration and final smoke test pass.

