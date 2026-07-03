# Resend Production Setup

Date: July 3, 2026  
Status: Manual setup required before public production.

## Goal

Enable real production email delivery for:

- Employer email verification.
- Candidate email verification.
- Admin email verification.
- Password reset.
- Employer new-application notifications.
- Candidate application confirmation.
- Candidate status update notifications.
- Review moderation notifications.

## Step 1 - Create Resend Project

1. Open Resend dashboard.
2. Create/select production project.
3. Create a production API key with email send permission.
4. Store the key securely.
5. Do not paste the key into docs or chat.

## Step 2 - Verify Sending Domain

1. Add the sending domain, for example `crossovertalent.asia`.
2. Configure DNS records shown by Resend:
   - SPF
   - DKIM
   - DMARC
3. Wait for verification.
4. Confirm domain status is verified.

Recommended sender:

`Crossover Talent <noreply@crossovertalent.asia>`

## Step 3 - Add Resend Env Vars To Vercel Production

Add:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REVIEW_MODERATION_EMAIL`
- `EMAIL_TIMEOUT_MS=8000`

Redeploy production candidate after adding env vars.

## Step 4 - Test Verification Email

Employer:

1. Register employer account.
2. Confirm verification email arrives.
3. Click verification link.
4. Confirm verified login works.

Candidate:

1. Register candidate account.
2. Confirm verification email arrives.
3. Click verification link.
4. Confirm verified login works.

Admin:

1. Register production admin account.
2. Confirm verification email arrives.
3. Click verification link.
4. Confirm admin login works.

Pass criteria:

- Emails arrive in real inboxes.
- Links use production domain.
- Unverified accounts cannot access dashboards.
- Verified accounts can access correct dashboards.

## Step 5 - Test Password Reset Email

For employer, candidate, and admin:

1. Request password reset.
2. Confirm reset email arrives.
3. Open reset link.
4. Set new password.
5. Confirm old password fails.
6. Confirm new password works.

Pass criteria:

- Reset email arrives.
- Reset token expires after configured window.
- API response does not expose whether unknown emails exist.

## Step 6 - Test Employer/Candidate Notifications

Application flow:

1. Candidate applies to production test job.
2. Candidate receives application confirmation email.
3. Employer receives new-application email.
4. Employer changes candidate status.
5. Candidate receives status update email.

Pass criteria:

- All notifications arrive.
- Links point to production domain.
- Email content has no sensitive token leakage.

## Step 7 - Test Email Failure Handling

In a non-production environment:

1. Remove or invalidate `RESEND_API_KEY`.
2. Trigger verification email flow.
3. Confirm the app does not crash.
4. Confirm fallback/audit log is created.

Pass criteria:

- User receives clear UI message.
- API remains stable.
- Error is logged without exposing API key.

## Release Gate

Current status: **BLOCKED until Resend setup and tests pass.**

