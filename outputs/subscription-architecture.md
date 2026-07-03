# Subscription Architecture

Date: July 3, 2026  
Goal: Prepare CrossOver Talent for Free, Professional, and Enterprise plans without implementing payments in Version 1.0.

## Recommendation

Add a plan/entitlement layer before adding Stripe or another payment provider. The app should check capabilities through server-side entitlement rules instead of scattering plan checks across UI code.

## Proposed Plans

| Capability | Free | Professional | Enterprise |
|---|---:|---:|---:|
| Employer workspace | 1 | 1 | Multiple |
| Active jobs | 1-2 | 10-25 | Custom |
| Applications visible | Limited | Full | Full |
| AI JD generation | Limited fallback/live quota | Higher quota | Custom quota |
| Candidate search/intelligence | No | Basic | Advanced |
| Employer branding | Basic | Enhanced | Custom |
| Admin/recruiter seats | 1 | 3-5 | Custom |
| Analytics | Basic | Standard | Advanced |
| Support | Community/email | Priority | Dedicated |

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

## Version 1.0 Position

No payments should be enabled until:
- Production infrastructure is live.
- Terms/privacy/refund policies are approved.
- Subscription entitlements are tested.
- Stripe webhooks are secured and replay-safe.

## Version 1.1 Implementation Path

1. Add organization and entitlement schema.
2. Add read-only plan display in admin.
3. Add server-side entitlement checks.
4. Add Stripe checkout and webhook.
5. Add usage metering and billing dashboard.
