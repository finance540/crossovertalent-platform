# Subscription and Entitlement Architecture

Date: October 2, 2026
Goal: Provide a test-mode subscription and entitlement path while keeping production payments disabled.

## Test-mode implementation

The employer plans are Starter (2 active jobs), Growth (25 active jobs), and Pro (unlimited active jobs). Stripe Checkout creates subscriptions from test-mode recurring Price IDs configured as `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, and `STRIPE_PRICE_PRO`.

The server stores the current Stripe subscription and customer under `companies/{companyId}/billing.json`. Only signature-verified, test-mode subscription webhook events update this record. Webhook event IDs are recorded to ignore duplicate deliveries, and older subscription events do not overwrite newer state.

Publishing and full candidate access are checked on the server. An active or trialing subscription grants plan capabilities; a successfully paid one-time job post also grants full candidate details while that job is active. Plan job limits are enforced before a subscribed employer publishes another role. If the subscription limit is reached, an employer can use one-time checkout for the additional job.

Production billing must remain disabled until production infrastructure is live, Terms/privacy/refund policies are approved, the entitlement rules are tested, and Stripe production webhooks are secured and replay-safe.

## Recommendation

Add a plan/entitlement layer before adding Stripe or another payment provider. The app should check capabilities through server-side entitlement rules instead of scattering plan checks across UI code.

## Plan capability reference

| Capability | Starter | Growth | Pro |
|---|---:|---:|---:|
| Active jobs | 2 | 25 | Unlimited |
| Team seats | 1 | 5 | 10 |
| Full application details | Yes | Yes | Yes |
| AI JD generation | No | Yes | Yes |
| Candidate search/intelligence | No | No | Yes |
| Employer branding | No | No | Yes |
| Analytics | No | Yes | Yes |

## Data Model Additions

Recommended tables/records:
- `organizations`
- `organization_members`
- `subscriptions`
- `plans`
- `entitlements`
- `usage_events`
- `invoices` after payment provider integration

## Entitlement Model

Each request should evaluate:
- `organizationId`
- `actorId`
- `role`
- `plan`
- `usageCount`
- `capability`

Example capabilities:
- `jobs.create`
- `jobs.publish`
- `applications.view_full`
- `ai.jd_generate`
- `ai.cv_revise`
- `analytics.view`
- `team.invite`
- `branding.edit`

## API Pattern

Server-side guard:

```text
requireEntitlement(session, "jobs.publish")
```

The guard should:
- Load organization subscription.
- Check plan capability.
- Check usage limits.
- Return a clear upgrade message if blocked.
- Emit `billing.entitlement_blocked` audit event.

## Billing Provider Readiness

Recommended provider: Stripe.

Integration points:
- Checkout session for paid upgrades.
- Customer portal for plan changes.
- Webhooks for subscription status.
- Metered usage events for AI and high-volume postings.

## Follow-up work

1. Validate Checkout and Customer Portal using Stripe test credentials and Price IDs.
2. Add production billing only after the readiness conditions above are met.
3. Add usage metering for AI and high-volume postings if product policy requires it.
