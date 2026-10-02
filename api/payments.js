import { createHmac, timingSafeEqual } from 'node:crypto';
import { appUrl, assertSameOrigin, ensureStorage, methodNotAllowed, productEvent, readRecord, requireApprovedEmployerSession, serverError, setSecurityHeaders, writeRecord } from './_lib.js';

export const config = { api: { bodyParser: false } };

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

function stripeAmount() {
  const amount = Number(process.env.STRIPE_JOB_POSTING_AMOUNT || 9900);
  return Number.isInteger(amount) && amount > 0 ? amount : 9900;
}

function stripeCurrency() {
  return String(process.env.STRIPE_JOB_POSTING_CURRENCY || 'usd').toLowerCase();
}

async function stripeRequest(pathname, params) {
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
  return response.json({ received: true });
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
    if (request.method !== 'POST' || !assertSameOrigin(request)) return response.status(405).json({ error: 'Method not allowed' });
    const body = typeof request.body === 'object' && request.body ? request.body : JSON.parse(await rawBody(request) || '{}');
    const { jobId } = body;
    const job = await readRecord(`companies/${session.companyId}/jobs/${jobId}.json`);
    if (!job) return response.status(404).json({ error: 'Job not found' });
    if (job.companyId !== session.companyId) return response.status(403).json({ error: 'Forbidden' });
    if (job.payment_status === 'paid') return response.json({ paid: true, job });
    if (!process.env.STRIPE_SECRET_KEY) return response.status(503).json({ error: 'Stripe test mode is not configured' });
    const checkout = await createJobCheckoutSession(job, session);
    const updated = { ...job, payment_status: 'pending', stripe_checkout_session_id: checkout.id, updated_at: new Date().toISOString() };
    await writeRecord(`companies/${session.companyId}/jobs/${job.id}.json`, updated, true);
    return response.json({ checkoutUrl: checkout.url, job: updated });
  } catch (error) {
    return serverError(response, error);
  }
}
