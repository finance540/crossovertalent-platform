# Post Auth Approval Smoke Test Report

Date: 2026-07-05

## Summary

The employer approval gate and Supabase Auth provider bridge have been implemented. Google, LinkedIn, and phone OTP remain disabled until Supabase provider credentials and Vercel flags are configured.

## Automated Checks

| Check | Result |
|---|---:|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS |
| Playwright E2E | PASS, 6/6 |

## Smoke Scope

- Employer registers with `pending_review`.
- Pending employer is blocked from dashboard access.
- Pending employer cannot post jobs.
- Admin can approve employer.
- Approved employer can access protected employer APIs.
- Admin can reject employer with reason.
- Rejected employer is blocked.
- Admin can suspend employer.
- Suspended employer is blocked.
- Non-admin cannot approve employers.
- Google/LinkedIn OAuth route verifies Supabase Auth access token before app session creation.
- Phone OTP verifies Supabase Auth SMS token before app session creation.
- OAuth/phone-created employers still require approval.
- Admin provider login requires existing admin account.

## Manual Provider Validation Required

After provider credentials are configured:

1. Enable one provider flag in Vercel.
2. Redeploy.
3. Test candidate provider login.
4. Test employer provider login.
5. Confirm employer remains pending until admin approval.
6. Approve employer and confirm dashboard access.
7. Repeat for each provider.

## Release Decision

Production deploy of code: **Allowed**

Provider activation: **Blocked until Supabase provider setup is complete**
