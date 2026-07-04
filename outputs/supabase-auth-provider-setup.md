# Supabase Auth Provider Setup

Date: 2026-07-05

## Current State

The app now has a Supabase Auth to app-session bridge for Google, LinkedIn, and phone OTP. The bridge verifies identity with Supabase Auth, creates or links the correct local app role, issues the existing `rb_session` cookie, and enforces employer approval before dashboard access.

The providers are still disabled unless the following Vercel flags are set:

```env
AUTH_GOOGLE_ENABLED=true
AUTH_LINKEDIN_ENABLED=true
AUTH_PHONE_OTP_ENABLED=true
```

## Required Supabase Dashboard Setup

Open:

Supabase -> Project `hntvcqahoseizmgswohq` -> Authentication -> Providers

Configure:

1. Google provider
   - Enable Google.
   - Add Google OAuth client ID and secret.
   - Add redirect URL:
     - `https://crossovertalent.asia/?auth_callback=1`
     - `https://build-me-a-simple-website-where.vercel.app/?auth_callback=1`

2. LinkedIn provider
   - Enable LinkedIn / LinkedIn OIDC.
   - Add LinkedIn client ID and secret.
   - Add redirect URL:
     - `https://crossovertalent.asia/?auth_callback=1`
     - `https://build-me-a-simple-website-where.vercel.app/?auth_callback=1`

3. Phone OTP
   - Enable phone provider.
   - Configure SMS provider.
   - Confirm OTP rate limits and templates.

## Required Vercel Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://hntvcqahoseizmgswohq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_EXPECTED_PROJECT_REF=hntvcqahoseizmgswohq
AUTH_GOOGLE_ENABLED=false
AUTH_LINKEDIN_ENABLED=false
AUTH_PHONE_OTP_ENABLED=false
```

Set provider flags to `true` only after the matching Supabase provider is configured.

## Validation Steps

1. Enable one provider in Supabase.
2. Enable the matching Vercel flag.
3. Redeploy.
4. Test employer login with that provider.
5. Confirm new employer is `pending_review`.
6. Confirm pending employer cannot access dashboard or post jobs.
7. Admin approves employer.
8. Confirm approved employer can access dashboard.
9. Repeat for candidate login.
10. Confirm admin provider login requires an existing admin account.

## Security Rule

OAuth and phone OTP verify identity only. They do not bypass app role authorization or employer approval.
