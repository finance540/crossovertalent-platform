import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl, assertSameOrigin, ensureStorage, methodNotAllowed, productEvent, readRecord, rateLimit, requireApprovedEmployerSession, serverError, setSecurityHeaders, stableHash, tooManyRequests, writeRecord } from './_lib.js';
import { activeSubscription, billingPlan, billingPlanForPrice, billingPlans, billingEnforced, companySubscription, stripeTestKeyConfigured } from './_billing.js';

export const config = { api: { bodyParser: false } };

export function stripeConfigured() {
  return stripeTestKeyConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeAmount() {
  const amount = Number(process.env.STRIPE_JOB_POSTING_AMOUNT || 9900);
  return Number.isInteger(amount) && amount > 0 ? amount : 9900;
}

function stripeCurrency() {
  return String(process.env.STRIPE_JOB_POSTING_CURRENCY || 'usd').toLowerCase();
}

async function stripeRequest(pathname, params) {
  if (!stripeTestKeyConfigured()) throw new Error('Stripe test mode is not configured');
  const response = await fetch(`https://api.stripe.com/v1/${pathname}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(params)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || 'Stripe request failed');
  return data;
}

export async function createJobCheckoutSession(job, session) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const checkout = await stripeRequest('checkout/sessions', {
    mode: 'payment',
    success_url: appUrl('/?dashboard=1&payment=success'),
    cancel_url: appUrl('/?dashboard=1&payment=cancelled'),
    customer_email: session.email,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': stripeCurrency(),
    'line_items[0][price_data][unit_amount]': String(stripeAmount()),
    'line_items[0][price_data][product_data][name]': 'Crossover Talent job posting',
    'line_items[0][price_data][product_data][description]': `Publish ${job.title}`,
    'metadata[job_id]': job.id,
    'metadata[company_id]': job.companyId,
    'metadata[session_email]': session.email
  });
  return checkout;
}

export async function createSubscriptionCheckoutSession(plan, session, billing) {
  const priceId = process.env[plan.priceEnv];
  if (!priceId) throw new Error(`Stripe test price is not configured for ${plan.name}`);
  const params = {
    mode: 'subscription',
    success_url: appUrl('/?dashboard=1&billing=success'),
    cancel_url: appUrl('/?dashboard=1&billing=cancelled'),
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'metadata[company_id]': session.companyId,
    'metadata[plan_id]': plan.id,
    'subscription_data[metadata][company_id]': session.companyId,
    'subscription_data[metadata][plan_id]': plan.id
  };
  if (billing?.stripeCustomerId) params.customer = billing.stripeCustomerId;
  else params.customer_email = session.email;
  return stripeRequest('checkout/sessions', params);
}

export async function createCustomerPortalSession(billing) {
  if (!billing?.stripeCustomerId) throw new Error('No Stripe customer is linked to this employer');
  return stripeRequest('billing_portal/sessions', {
    customer: billing.stripeCustomerId,
    return_url: appUrl('/?dashboard=1&billing=portal')
  });
}

function signatureParts(header = '') {
  return Object.fromEntries(String(header).split(',').map((part) => part.split('=').map((value) => value.trim())).filter(([key, value]) => key && value));
}

function verifySignature(rawBody, header) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return false;
  const parts = signatureParts(header);
  const timestamp = Number(parts.t);
  const provided = parts.v1 || '';
  if (!timestamp || !provided || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function rawBody(request) {
  if (typeof request.body === 'string') return request.body;
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function handleWebhook(request, response) {
  const body = await rawBody(request);
  if (!verifySignature(body, request.headers['stripe-signature'])) return response.status(400).json({ error: 'Invalid Stripe signature' });
  const event = JSON.parse(body);
  if (!event.id || event.livemode !== false) return response.status(400).json({ error: 'Only signed Stripe test-mode events are accepted' });
  const eventPath = `stripe-events/${stableHash(event.id)}.json`;
  if (await readRecord(eventPath)) return response.json({ received: true, duplicate: true });
  if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
    const checkout = event.data.object;
    const jobId = checkout.metadata?.job_id;
    const companyId = checkout.metadata?.company_id;
    if (jobId && companyId) {
      const pathname = `companies/${companyId}/jobs/${jobId}.json`;
      const job = await readRecord(pathname);
      if (job && job.payment_status !== 'paid') {
        const now = new Date().toISOString();
        const updated = { ...job, status: 'active', payment_status: 'paid', stripe_payment_id: checkout.payment_intent || '', stripe_checkout_session_id: checkout.id, published_at: job.published_at || now, updated_at: now };
        await writeRecord(pathname, updated, true);
        await productEvent('job_payment_completed', { actorEmail: checkout.metadata?.session_email || '', entityType: 'job', entityId: jobId, metadata: { companyId, checkoutSessionId: checkout.id } });
        await productEvent('job_published', { actorEmail: checkout.metadata?.session_email || '', entityType: 'job', entityId: jobId, metadata: { companyId, payment: 'stripe' } });
      }
    }
  }
  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const subscription = event.data?.object;
    const companyId = subscription?.metadata?.company_id;
    if (subscription?.id && companyId) {
      const priceId = subscription.items?.data?.[0]?.price?.id || '';
      const plan = billingPlanForPrice(priceId);
      const current = await companySubscription(companyId);
      const eventCreated = Number(event.created) || 0;
      if (eventCreated >= (Number(current?.lastStripeEventCreated) || 0)) {
        const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || '';
        const periodEnd = Number(subscription.current_period_end);
        const updated = {
          recordType: 'company_billing',
          companyId,
          stripeCustomerId: customer || current?.stripeCustomerId || '',
          stripeSubscriptionId: subscription.id,
          planId: plan?.id || '',
          status: subscription.status || 'canceled',
          currentPeriodEnd: Number.isFinite(periodEnd) && periodEnd > 0 ? new Date(periodEnd * 1000).toISOString() : '',
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          lastStripeEventCreated: eventCreated,
          updatedAt: new Date().toISOString()
        };
        await writeRecord(`companies/${companyId}/billing.json`, updated, true);
        await productEvent('subscription_updated', { actorEmail: '', entityType: 'company', entityId: companyId, metadata: { planId: updated.planId, status: updated.status } });
      }
    }
  }
  await writeRecord(eventPath, { recordType: 'stripe_event', id: event.id, type: event.type, created: event.created || 0, processedAt: new Date().toISOString() });
  return response.json({ received: true });
}

async function handleBillingStatus(session, response) {
  const subscription = await companySubscription(session.companyId);
  const plan = billingPlan(subscription?.planId);
  return response.json({
    plans: billingPlans(),
    billingConfigured: stripeConfigured(),
    billingRequired: billingEnforced(),
    subscription: subscription ? {
      planId: plan?.id || '',
      planName: plan?.name || '',
      status: subscription.status || 'inactive',
      currentPeriodEnd: subscription.currentPeriodEnd || '',
      cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
      active: activeSubscription(subscription),
      canManageBilling: Boolean(subscription.stripeCustomerId)
    } : null
  });
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.query.route === 'webhook') {
      if (request.method !== 'POST') return methodNotAllowed(response);
      return handleWebhook(request, response);
    }
    const session = await requireApprovedEmployerSession(request, response);
    if (!session) return;
    if (request.method === 'GET' && request.query.route === 'status') return handleBillingStatus(session, response);
    if (request.method !== 'POST' || !assertSameOrigin(request)) return response.status(405).json({ error: 'Method not allowed' });
    const body = typeof request.body === 'object' && request.body ? request.body : JSON.parse(await rawBody(request) || '{}');
    if (request.query.route === 'subscription-checkout') {
      if (!(await rateLimit(request, `subscription-checkout:${session.companyId}`, 5, 60_000))) return tooManyRequests(response);
      if (!stripeConfigured()) return response.status(503).json({ error: 'Stripe test-mode billing is not configured' });
      const plan = billingPlan(String(body.planId || ''));
      if (!plan) return response.status(400).json({ error: 'Choose a valid subscription plan' });
      if (!process.env[plan.priceEnv]) return response.status(503).json({ error: `${plan.name} is not configured in Stripe test mode` });
      const current = await companySubscription(session.companyId);
      if (activeSubscription(current)) return response.status(409).json({ error: 'Your subscription is already active. Use billing management to change plans.' });
      const checkout = await createSubscriptionCheckoutSession(plan, session, current);
      return response.json({ checkoutUrl: checkout.url });
    }
    if (request.query.route === 'portal') {
      if (!(await rateLimit(request, `billing-portal:${session.companyId}`, 5, 60_000))) return tooManyRequests(response);
      if (!stripeConfigured()) return response.status(503).json({ error: 'Stripe test-mode billing is not configured' });
      const billing = await companySubscription(session.companyId);
      if (!billing?.stripeCustomerId) return response.status(404).json({ error: 'No billing account is linked yet' });
      const portal = await createCustomerPortalSession(billing);
      return response.json({ portalUrl: portal.url });
    }
    if (request.query.route) return response.status(404).json({ error: 'Unknown billing action' });
    if (!(await rateLimit(request, `job-payment:${session.companyId}`, 10, 60_000))) return tooManyRequests(response);
    const { jobId } = body;
    const job = await readRecord(`companies/${session.companyId}/jobs/${jobId}.json`);
    if (!job) return response.status(404).json({ error: 'Job not found' });
    if (job.companyId !== session.companyId) return response.status(403).json({ error: 'Forbidden' });
    if (job.payment_status === 'paid') return response.json({ paid: true, job });
    if (!stripeConfigured()) return response.status(503).json({ error: 'Stripe test-mode billing is not configured' });
    const checkout = await createJobCheckoutSession(job, session);
    const updated = { ...job, payment_status: 'pending', stripe_checkout_session_id: checkout.id, updated_at: new Date().toISOString() };
    await writeRecord(`companies/${session.companyId}/jobs/${job.id}.json`, updated, true);
    return response.json({ checkoutUrl: checkout.url, job: updated });
  } catch (error) {
    return serverError(response, error);
  }
}
