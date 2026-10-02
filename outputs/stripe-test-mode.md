# Stripe test-mode job posting

Set these environment variables in the Vercel project and local environment:

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_JOB_POSTING_AMOUNT=9900
STRIPE_JOB_POSTING_CURRENCY=usd
```

When `STRIPE_SECRET_KEY` is configured, publishing a new employer job creates the job as a draft and returns a Stripe Checkout URL. The job becomes active only after Stripe sends a verified `checkout.session.completed` event with `payment_status=paid` to:

```text
/api/payments?route=webhook
```

For local testing, forward Stripe test events with:

```bash
stripe listen --forward-to http://127.0.0.1:3000/api/payments?route=webhook
```

Use Stripe test card `4242 4242 4242 4242` with any future expiry and CVC. Keep `sk_test_` and `whsec_` values server-side; never expose them in frontend code or commit them.
