import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { activeSubscription, billingPlans, candidateAccess, publishAllowance, stripeTestKeyConfigured, subscriptionHasEntitlement } from '../api/_billing.js';
import { createSession, readRecord, stableHash, writeRecord } from '../api/_lib.js';
import jobsHandler from '../api/jobs.js';
import applicationsHandler from '../api/applications.js';
import paymentsHandler from '../api/payments.js';

const future = new Date(Date.now() + 86_400_000).toISOString();
const job = (id, paymentStatus = 'subscription') => ({ recordType: 'job', id, status: 'active', payment_status: paymentStatus });

test('defines three plans with increasing publishing capacity', () => {
  const plans = billingPlans();
  assert.deepEqual(plans.map((plan) => plan.id), ['starter', 'growth', 'pro']);
  assert.deepEqual(plans.map((plan) => plan.maxActiveJobs), [2, 25, null]);
  assert.ok(plans.every((plan) => plan.capabilities.includes('jobs.publish')));
});

test('only active or trialing subscriptions grant plan entitlements', () => {
  const active = { planId: 'starter', status: 'active', currentPeriodEnd: future };
  assert.equal(activeSubscription(active), true);
  assert.equal(subscriptionHasEntitlement(active, 'jobs.publish'), true);
  assert.equal(subscriptionHasEntitlement({ ...active, status: 'past_due' }, 'jobs.publish'), false);
  assert.equal(subscriptionHasEntitlement({ ...active, currentPeriodEnd: new Date(Date.now() - 1000).toISOString() }, 'jobs.publish'), false);
  assert.equal(subscriptionHasEntitlement({ ...active, planId: 'unknown' }, 'jobs.publish'), false);
  assert.equal(subscriptionHasEntitlement({ ...active, status: 'trialing' }, 'applications.view_full'), true);
});

test('enforces active-job limits and permits an existing job update', () => {
  const starter = { planId: 'starter', status: 'active', currentPeriodEnd: future };
  assert.equal(publishAllowance(starter, [job('one')]).allowed, true);
  assert.equal(publishAllowance(starter, [job('one'), job('two')]).allowed, false);
  assert.equal(publishAllowance(starter, [job('one'), job('two')], 'two').allowed, true);
  assert.equal(publishAllowance({ ...starter, status: 'canceled' }, []).reason, 'subscription_required');
  assert.equal(publishAllowance({ ...starter, planId: 'pro' }, Array.from({ length: 150 }, (_, index) => job(String(index)))).allowed, true);
});

test('full candidate details require a subscription or an active paid posting', () => {
  const active = { planId: 'growth', status: 'active', currentPeriodEnd: future };
  assert.equal(candidateAccess(active, []), true);
  assert.equal(candidateAccess({ ...active, status: 'canceled' }, [job('paid', 'paid')]), true);
  assert.equal(candidateAccess(null, [job('unpaid')]), false);
  assert.equal(candidateAccess(null, [{ ...job('closed', 'paid'), status: 'closed' }]), false);
});

test('Stripe checkout credentials accept test keys and reject live keys', () => {
  const original = process.env.STRIPE_SECRET_KEY;
  try {
    process.env.STRIPE_SECRET_KEY = 'sk_test_local-fixture';
    assert.equal(stripeTestKeyConfigured(), true);
    process.env.STRIPE_SECRET_KEY = 'sk_live_local-fixture';
    assert.equal(stripeTestKeyConfigured(), false);
  } finally {
    if (original === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = original;
  }
});

test('job publishing and candidate access are gated on the server', async () => {
  const storage = await mkdtemp(path.join(tmpdir(), 'crossover-billing-'));
  const envKeys = ['NODE_ENV', 'VERCEL_ENV', 'STORAGE_DRIVER', 'LOCAL_STORAGE_DIR', 'SESSION_SECRET', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STARTER'];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const email = `billing-${randomUUID()}@example.test`;
  const companyId = randomUUID();
  let session;
  const request = (method, body = {}) => ({
    method,
    query: {},
    body,
    headers: { cookie: `rb_session=${session}`, host: 'billing.test', origin: 'https://billing.test' }
  });
  const response = () => ({
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; }
  });

  try {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'preview';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_DIR = storage;
    process.env.SESSION_SECRET = 'billing-test-session-secret';
    process.env.STRIPE_SECRET_KEY = 'sk_live_test-fixture';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    session = createSession({ id: randomUUID(), role: 'employer', companyId, company: 'Billing Test Co', email, employer_status: 'approved' });
    await writeRecord(`accounts/${stableHash(email)}.json`, { recordType: 'account', id: randomUUID(), role: 'employer', email, company: 'Billing Test Co', companyId, employer_status: 'approved', createdAt: new Date().toISOString() });

    const denied = response();
    await jobsHandler(request('POST', { title: 'Climate Lead', department: 'Impact', location: 'Tokyo', type: 'Full-time', description: 'A role for a billing test.', status: 'active' }), denied);
    assert.equal(denied.statusCode, 503);
    assert.equal(denied.data.billingRequired, true);

    process.env.STRIPE_SECRET_KEY = 'sk_test_billing-fixture';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_billing-fixture';
    process.env.STRIPE_PRICE_STARTER = 'price_starter_fixture';
    const locked = response();
    await applicationsHandler(request('GET'), locked);
    assert.equal(locked.statusCode, 402);
    assert.equal(locked.data.upgradeRequired, true);

    await writeRecord(`companies/${companyId}/billing.json`, {
      recordType: 'company_billing',
      companyId,
      stripeCustomerId: 'cus_test_fixture',
      stripeSubscriptionId: 'sub_test_fixture',
      planId: 'starter',
      status: 'active',
      currentPeriodEnd: future
    });
    const published = response();
    await jobsHandler(request('POST', { title: 'Climate Lead', department: 'Impact', location: 'Tokyo', type: 'Full-time', description: 'A role for a billing test.', status: 'active' }), published);
    assert.equal(published.statusCode, 201);
    assert.equal(published.data.job.status, 'active');
    assert.equal(published.data.job.payment_status, 'subscription');

    const unlocked = response();
    await applicationsHandler(request('GET'), unlocked);
    assert.equal(unlocked.statusCode, 200);
    assert.deepEqual(unlocked.data.applications, []);

    const eventCreated = Math.floor(Date.now() / 1000);
    const subscriptionEvent = (id, created, status, livemode = false) => ({
      id,
      type: 'customer.subscription.updated',
      livemode,
      created,
      data: { object: {
        id: 'sub_test_fixture',
        customer: 'cus_test_fixture',
        status,
        current_period_end: eventCreated + 3600,
        cancel_at_period_end: false,
        metadata: { company_id: companyId, plan_id: 'starter' },
        items: { data: [{ price: { id: 'price_starter_fixture' } }] }
      } }
    });
    const signedWebhook = (event) => {
      const body = JSON.stringify(event);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex');
      return { method: 'POST', query: { route: 'webhook' }, body, headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` } };
    };
    const canceledEvent = subscriptionEvent(`evt_${randomUUID().replaceAll('-', '')}`, eventCreated, 'canceled');
    const webhookResult = response();
    await paymentsHandler(signedWebhook(canceledEvent), webhookResult);
    assert.equal(webhookResult.statusCode, 200);
    assert.equal((await readRecord(`companies/${companyId}/billing.json`)).status, 'canceled');

    const duplicateResult = response();
    await paymentsHandler(signedWebhook(canceledEvent), duplicateResult);
    assert.equal(duplicateResult.data.duplicate, true);

    const staleResult = response();
    await paymentsHandler(signedWebhook(subscriptionEvent(`evt_${randomUUID().replaceAll('-', '')}`, eventCreated - 1, 'active')), staleResult);
    assert.equal((await readRecord(`companies/${companyId}/billing.json`)).status, 'canceled');

    const liveResult = response();
    await paymentsHandler(signedWebhook(subscriptionEvent(`evt_${randomUUID().replaceAll('-', '')}`, eventCreated + 1, 'active', true)), liveResult);
    assert.equal(liveResult.statusCode, 400);

    const missingModeEvent = subscriptionEvent(`evt_${randomUUID().replaceAll('-', '')}`, eventCreated + 1, 'active');
    delete missingModeEvent.livemode;
    const missingModeResult = response();
    await paymentsHandler(signedWebhook(missingModeEvent), missingModeResult);
    assert.equal(missingModeResult.statusCode, 400);

    const relocked = response();
    await applicationsHandler(request('GET'), relocked);
    assert.equal(relocked.statusCode, 402);
  } finally {
    await rm(storage, { recursive: true, force: true });
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
