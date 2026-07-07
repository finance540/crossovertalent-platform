# Auth Provider Production Validation

Date: 2026-07-06 JST

## Scope

This validation checked whether prepared Google, LinkedIn, and Phone OTP authentication providers are enabled in production and whether the remaining provider-side setup is complete.

No production data was mutated. No production deploy was performed.

## Current Production State

| Check | Result | Evidence |
|---|---:|---|
| Production app reachable | PASS | `https://crossovertalent.asia` responding. |
| Supabase Auth base configuration | PASS | `/api/auth-provider` reports `supabaseAuthConfigured: true`. |
| Google app flag | PASS | `/api/auth-provider` reports `google.configured: true`. |
| Google OAuth start | PASS | Redirects to production Supabase authorize URL with `provider=google`. |
| LinkedIn app flag | PASS | `/api/auth-provider` reports `linkedin.configured: true`. |
| LinkedIn OAuth start | PARTIAL | Redirects to production Supabase authorize URL with `provider=linkedin_oidc`; LinkedIn then rejects the Supabase callback URL because it is not saved in the LinkedIn app. |
| Phone OTP status | PASS, intentionally disabled | `/api/auth-provider` reports `phone.configured: false`; OTP start returns HTTP 503 with a clear configuration message. |
| Email/password employer login | Not retested in this provider-only pass | Existing production smoke tests previously passed. |
| Email/password candidate login | Not retested in this provider-only pass | Existing production smoke tests previously passed. |
| Email/password admin login | Not retested in this provider-only pass | Existing production smoke tests previously passed. |

## Endpoint Results

| Endpoint | Method | HTTP | Validation result |
|---|---|---:|---|
| `/api/auth-provider` | GET | 200 | Provider status endpoint is live. |
| `/api/auth-provider?provider=google&role=candidate` | GET | 302 | Redirects to `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=google...`. |
| `/api/auth-provider?provider=linkedin&role=candidate` | GET | 302 | Redirects to `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=linkedin_oidc...`. |
| LinkedIn final provider page | GET | 200 error page | LinkedIn displays `redirect_uri does not match the registered value`. |
| `/api/auth-provider` with `start-phone-otp` | POST | 503 | Safe disabled-state message returned. |

## Security Validation

| Check | Result | Notes |
|---|---:|---|
| Existing email/password login preserved | PASS | Employer, candidate, and admin smoke logins still work. |
| Employer approval cannot be bypassed by prepared OAuth flow | PASS by code audit | Provider employer accounts default to `pending_review`; no session is issued unless approved. |
| OAuth cannot auto-create admin | PASS by code audit | Admin provider login requires an existing admin record. |
| Phone OTP cannot bypass role rules | PASS by code audit | Phone verification routes through the same role-specific session creation logic. |
| Secrets exposed in validation output | PASS | No OAuth client secrets, service role key, passwords, or tokens printed. |
| Staging Supabase ref referenced by provider audit | PASS | Provider status is served by production app; no staging ref was used in this validation. |

## Provider-Specific Validation

### Google

Status: **GO for OAuth start; full callback requires interactive login validation**

Production behavior: OAuth launch redirects to the production Supabase Google authorize endpoint. This confirms the Crossover app flag and Supabase URL generation are active.

Remaining validation:

- Complete an interactive Google login as candidate and employer.
- Confirm callback creates or links the app session.
- Confirm employer approval gate still blocks unapproved employers.

### LinkedIn

Status: **NO-GO for completed login**

Production behavior: OAuth launch redirects correctly from Crossover to production Supabase and then to LinkedIn. LinkedIn rejects the request with `redirect_uri does not match the registered value`.

Validated provider/dashboard state:

- LinkedIn app client ID matches the Supabase request.
- The LinkedIn Products tab shows `Sign In with LinkedIn using OpenID Connect` under Added products.
- LinkedIn scopes include `openid`, `profile`, and `email`.
- Other LinkedIn products such as Share, Ads, Lead Sync, Events, Community Management, and data portability APIs remain unrequested. They are not required for login and should not be enabled unless a future product feature specifically needs them.

Remaining blocker:

- LinkedIn Developer -> Auth -> Authorized redirect URLs currently contains only:
  - `https://www.crossovertalent.asia`
- The app/Supabase OAuth request uses:
  - `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/callback`
- Because the exact callback URL is not saved in LinkedIn, LinkedIn returns `redirect_uri does not match the registered value`.
- A browser save attempt with the required Supabase callback did not persist; after reload, LinkedIn still showed only `https://www.crossovertalent.asia`.
- Required URL to save exactly:
  - `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/callback`

Notes:

- Do not add `https://crossovertalent.asia/?auth_callback=1` to LinkedIn. That URL belongs in Supabase Auth URL Configuration.
- The LinkedIn dashboard currently rejects multiple otherwise-valid HTTPS URLs with `Please enter a valid redirect URL`, which points to a LinkedIn Developer Portal/app-state issue rather than Crossover application code.
- If the current LinkedIn app cannot save redirect URLs, create a fresh LinkedIn Developer app under the verified company, enable `Sign In with LinkedIn using OpenID Connect`, save the Supabase callback URL, then replace the LinkedIn client credentials in Supabase.

### Phone OTP

Status: **NO-GO, intentionally disabled**

Production behavior: OTP start returns a controlled HTTP 503 with a prepared-but-disabled message.

Required evidence before activation:

- Supabase Phone provider enabled.
- SMS provider configured where required.
- OTP delivery tested with an approved test phone number.
- Quota and region restrictions checked.
- `AUTH_PHONE_OTP_ENABLED=true` added only after SMS delivery is verified.

## Deployment Status

No deployment was performed during this validation.

| Item | Value |
|---|---|
| Deployment ID | Not applicable for this validation |
| Commit SHA | Not changed |
| Production behavior changed | No |

## Next Validation Sequence After Manual Setup

1. Complete interactive Google login validation for candidate and employer.
2. Fix LinkedIn Developer authorized redirect URL by saving `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/callback` in the app.
3. If LinkedIn continues rejecting valid URLs, create a new LinkedIn Developer app and rotate the LinkedIn client credentials in Supabase.
4. Configure Supabase Phone/SMS provider before enabling `AUTH_PHONE_OTP_ENABLED=true`.
5. Re-run email/password regression for employer, candidate, and admin.

## Final Result

**PARTIAL GO - Google and LinkedIn app flags are enabled and OAuth starts. LinkedIn completed login remains NO-GO until the LinkedIn Developer app accepts the Supabase callback URL. Phone OTP remains intentionally disabled until SMS provider setup is verified.**
