# Stripe test-mode billing

Use only Stripe test mode. Configure these server-side variables in Vercel and in local development:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_JOB_POSTING_AMOUNT=9900
STRIPE_JOB_POSTING_CURRENCY=usd
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_PRO=price_...
```

Create recurring Price IDs for all employer plans in the Stripe test catalog. Checkout remains unavailable for plans without a configured Price ID. `STRIPE_JOB_POSTING_AMOUNT` and `STRIPE_JOB_POSTING_CURRENCY` continue to control one-time job posting.

Configure the Stripe test webhook endpoint at:

```text
/api/payments?route=webhook
```

Subscribe the endpoint to `checkout.session.completed` and `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. For local testing, forward Stripe test events with:

```bash
stripe listen --forward-to http://127.0.0.1:3000/api/payments?route=webhook
```

The employer Billing view offers Starter (2 active jobs), Growth (25 active jobs), and Pro (unlimited active jobs). An active or trialing subscription grants the plan entitlements. A paid one-time job posting also grants full candidate details while that job is active. Subscription state is updated only from signature-verified test-mode webhook events, with processed event IDs retained to ignore retries.

Enable the Stripe Customer Portal in test mode and allow the desired subscription changes and cancellations. Employers with a linked Stripe customer can open the portal from Billing.

Use Stripe test card `4242 4242 4242 4242` with any future expiry and CVC. The server rejects live Stripe secret keys and live-mode webhook events. Keep all Stripe keys server-side; never expose them in frontend code or commit them. Public payments remain disabled until production infrastructure, approved policies, and production billing readiness are separately completed.
