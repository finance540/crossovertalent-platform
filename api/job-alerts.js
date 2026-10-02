import { timingSafeEqual } from 'node:crypto';
import { assertSameOrigin, ensureStorage, forbidden, methodNotAllowed, rateLimit, readRecord, readSession, serverError, setSecurityHeaders, stableHash, tooManyRequests } from './_lib.js';
import { dispatchQueuedJobAlerts, publicJobAlertSettings, unsubscribeCandidate, updateJobAlertPreferences } from './_job-alerts.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function htmlResponse(response, status, title, message, token = '', complete = false) {
  const form = token && !complete ? `<form method="post" action="/api/job-alerts?route=unsubscribe"><input type="hidden" name="action" value="unsubscribe"><input type="hidden" name="token" value="${escapeHtml(token)}"><button type="submit">Unsubscribe</button></form>` : '';
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Crossover Talent</title><style>body{margin:0;padding:32px;background:#f7f8f5;color:#172b23;font:16px/1.5 Arial,sans-serif}.card{max-width:560px;margin:10vh auto;padding:32px;border:1px solid #dce5dc;border-radius:16px;background:#fff}h1{font-size:25px}button{padding:12px 18px;border:0;border-radius:8px;background:#245c3a;color:#fff;font:inherit;font-weight:700;cursor:pointer}</style><main class="card"><p>CROSSOVER TALENT</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${form}<p><a href="/">Return to Crossover Talent</a></p></main></html>`;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  return response.status(status).send(html);
}

function parseBody(request) {
  if (typeof request.body !== 'string') return request.body || {};
  try { return JSON.parse(request.body); }
  catch { return Object.fromEntries(new URLSearchParams(request.body)); }
}

function validCronRequest(request) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(String(request.headers.authorization || ''));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function candidateFromSession(request, response) {
  const session = readSession(request);
  if (!session || session.role !== 'candidate') {
    response.status(401).json({ error: 'Job seeker sign in required' });
    return null;
  }
  const candidate = await readRecord(`candidates/${stableHash(session.email)}.json`);
  if (!candidate || candidate.disabled || !candidate.emailVerified) {
    response.status(403).json({ error: 'Verify your job seeker account before managing job alerts' });
    return null;
  }
  return candidate;
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();

    if (request.method === 'GET' && request.query.route === 'dispatch') {
      if (!validCronRequest(request)) return response.status(process.env.CRON_SECRET ? 401 : 503).json({ error: process.env.CRON_SECRET ? 'Unauthorized' : 'CRON_SECRET is not configured' });
      return response.json(await dispatchQueuedJobAlerts());
    }

    if (request.method === 'GET' && request.query.unsubscribe) {
      const token = String(request.query.unsubscribe);
      const record = await readRecord(`job-alert-unsubscribes/${stableHash(token)}.json`);
      if (!record) return htmlResponse(response, 404, 'Link unavailable', 'This unsubscribe link is no longer valid.');
      if (!record.active) return htmlResponse(response, 200, 'Alerts stopped', 'You are already unsubscribed.', '', true);
      return htmlResponse(response, 200, 'Unsubscribe from job alerts?', 'Confirm below to stop receiving job alert emails.', token);
    }

    if (request.method === 'GET') {
      const candidate = await candidateFromSession(request, response);
      if (!candidate) return;
      return response.json({ jobAlerts: publicJobAlertSettings(candidate.jobAlerts) });
    }

    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!assertSameOrigin(request)) return forbidden(response);
    const body = parseBody(request);
    if (body.action === 'unsubscribe') {
      const result = await unsubscribeCandidate(String(body.token || ''));
      if (!result.found) return htmlResponse(response, 404, 'Link unavailable', 'This unsubscribe link is no longer valid.');
      return htmlResponse(response, 200, 'Job alerts stopped', 'You will no longer receive job alert emails.', '', true);
    }

    const candidate = await candidateFromSession(request, response);
    if (!candidate) return;
    if (!(await rateLimit(request, `job-alerts:${candidate.id}`, 10, 60_000))) return tooManyRequests(response);
    const jobAlerts = await updateJobAlertPreferences(candidate, body);
    return response.json({ jobAlerts });
  } catch (error) {
    if (error instanceof TypeError) return response.status(400).json({ error: error.message });
    return serverError(response, error);
  }
}
