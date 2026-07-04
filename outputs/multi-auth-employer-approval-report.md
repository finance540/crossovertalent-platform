# Multi-Auth and Employer Approval Report

Date: 2026-07-05

## Status

Overall status: **Implemented, provider activation requires Supabase Dashboard configuration**

The employer approval gate is implemented in the current serverless auth model. Email/password login is live. Google, LinkedIn, and phone OTP now have a Supabase Auth bridge into the app session model, but they remain disabled until the Supabase provider credentials and Vercel feature flags are configured.

## Auth Architecture Review

- Employer accounts are stored under `accounts/`.
- Candidate accounts are stored under `candidates/`.
- Admin accounts are stored under `admins/`.
- Sessions use the signed `rb_session` cookie created by `api/_lib.js`.
- Supabase is the production database/storage backend.
- Supabase Auth is used as the external identity verifier for Google, LinkedIn, and phone OTP.
- Provider identities are mapped back into the app's own role/session model before dashboard access is granted.

## Implemented

- Employer statuses:
  - `pending_review`
  - `approved`
  - `rejected`
  - `suspended`
- New employer registrations default to `pending_review`.
- Legacy employer accounts remain compatible.
- Protected employer APIs require approved employer status:
  - `/api/auth`
  - `/api/company`
  - `/api/jobs`
  - employer-side `/api/applications`
- Admin moderation supports approve, reject, suspend, and validation notes.
- Login UI includes:
  - Email/password
  - Google
  - LinkedIn
  - Phone OTP
- `/api/auth-provider` supports:
  - provider readiness
  - OAuth redirect
  - OAuth callback completion from a Supabase access token
  - phone OTP start
  - phone OTP verification
- Provider-created employer accounts default to `pending_review`.
- Provider-created candidate accounts can access the candidate dashboard.
- Admin provider login requires a pre-existing admin account.

## Activation Requirements

Google, LinkedIn, and phone OTP should remain disabled until the Supabase providers are configured and tested.

Vercel flags to enable only after provider setup:

```env
AUTH_GOOGLE_ENABLED=true
AUTH_LINKEDIN_ENABLED=true
AUTH_PHONE_OTP_ENABLED=true
```

## Verification

Required checks:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- Playwright E2E

## Release Gate

Code gate: **Ready for validation**

Provider activation gate: **Manual Supabase provider setup required**
