# Employer Approval Security Report

Date: 2026-07-05

## Security Objective

Employers may register through email/password, Google, LinkedIn, or phone OTP, but they cannot access employer dashboards or post jobs until an admin approves the employer account.

## Implemented Controls

- `requireApprovedEmployerSession()` checks persisted employer status on protected employer APIs.
- Session claims alone are not trusted for approval state.
- Pending, rejected, and suspended employers receive HTTP 403.
- New email/password employers default to `pending_review`.
- New OAuth/phone employers default to `pending_review`.
- Existing approved employers retain access.

Protected routes:

- `/api/auth`
- `/api/company`
- `/api/jobs`
- employer application listing/status updates in `/api/applications`

Admin-only controls:

- `action: employer-approval`
- Valid statuses:
  - `pending_review`
  - `approved`
  - `rejected`
  - `suspended`
- Rejection requires a reason.
- Reviewer, timestamp, rejection reason, and validation notes are stored.

## Provider Security

- OAuth access tokens are verified against Supabase Auth before local sessions are issued.
- Phone OTP is verified through Supabase Auth before local sessions are issued.
- Provider-created employer accounts are blocked until approved.
- Provider-created admin sessions require an existing admin account.
- Non-admin users cannot approve employers.
- Employer approval cannot be self-assigned.

## Remaining Manual Security Checks

- Confirm Supabase provider redirect allow-list in dashboard.
- Confirm SMS provider rate limits and abuse protection.
- Confirm production Vercel flags are enabled one provider at a time.
- Re-run production smoke/security tests after each provider activation.

## Security Recommendation

Approval gate: **Implemented**

Provider bridge: **Implemented**

Provider activation: **Manual Supabase setup required before live use**
