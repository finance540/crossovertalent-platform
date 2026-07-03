import { del, get, list, put } from '@vercel/blob';
import { createHash, createHmac, timingSafeEqual, randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export const IMPACT_SECTORS = [
  'Climate',
  'Impact Investment',
  'Public Healthcare',
  'Agriculture',
  'Water',
  'Education',
  'Clean Energy',
  'Philanthropic Foundation',
  'Circular Economy',
  'CSR',
  'ESG Consulting'
];

function configuredStorageDriver() {
  const requested = (process.env.STORAGE_DRIVER || '').toLowerCase();
  if (requested) return requested;
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'blob';
}

export function ensureStorage() {
  const driver = configuredStorageDriver();
  if (driver === 'supabase') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase storage is not configured');
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Storage is not configured');
}

export function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

export function assertSameOrigin(request) {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return true;
  const host = request.headers.host;
  const origin = request.headers.origin;
  const referer = request.headers.referer;
  if (!host) return false;
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  if (referer) {
    try { return new URL(referer).host === host; } catch { return false; }
  }
  return true;
}

export async function rateLimit(request, key, limit = 30, windowMs = 60_000) {
  const forwarded = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown';
  const ip = String(forwarded).split(',')[0].trim() || 'unknown';
  const bucket = Math.floor(Date.now() / windowMs);
  const pathname = `rate-limits/${stableHash(`${key}:${ip}:${bucket}`)}.json`;
  const current = await readRecord(pathname).catch(() => null);
  const count = (current?.count || 0) + 1;
  await writeRecord(pathname, { count, key, bucket, updated_at: new Date().toISOString() }, true);
  return count <= limit;
}

export function stableHash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function appUrl(pathname = '/') {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000').replace(/\/$/, '');
  if (/^https?:\/\//i.test(base)) return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  return `https://${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function supabaseUrl(pathname = 'app_records') {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Supabase storage is not configured');
  return new URL(`/rest/v1/${pathname}`, base);
}

function supabaseHeaders(extra = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Supabase storage is not configured');
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
    ...extra
  };
}

function recordType(value = {}) {
  return String(value.recordType || value.role || 'record');
}

async function supabaseRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.error || 'Supabase request failed';
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function readSupabaseRecord(pathname) {
  const url = supabaseUrl();
  url.searchParams.set('select', 'data');
  url.searchParams.set('path', `eq.${pathname}`);
  const rows = await supabaseRequest(url, { headers: supabaseHeaders() });
  return rows?.[0]?.data || null;
}

async function writeSupabaseRecord(pathname, value, overwrite = false) {
  const url = supabaseUrl();
  if (overwrite) url.searchParams.set('on_conflict', 'path');
  const body = JSON.stringify({ path: pathname, data: value, record_type: recordType(value) });
  try {
    await supabaseRequest(url, {
      method: 'POST',
      headers: supabaseHeaders({ prefer: overwrite ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal' }),
      body
    });
  } catch (error) {
    if (!overwrite && error.status === 409) throw new Error('Record already exists');
    throw error;
  }
}

async function deleteSupabaseRecord(pathname) {
  const url = supabaseUrl();
  url.searchParams.set('path', `eq.${pathname}`);
  await supabaseRequest(url, { method: 'DELETE', headers: supabaseHeaders({ prefer: 'return=minimal' }) });
}

async function listSupabaseRecords(prefix) {
  const url = supabaseUrl();
  url.searchParams.set('select', 'data');
  url.searchParams.set('path', `like.${prefix}*`);
  url.searchParams.set('order', 'created_at.desc');
  const rows = await supabaseRequest(url, { headers: supabaseHeaders() });
  return (rows || []).map((row) => row.data).filter(Boolean);
}

export async function readRecord(pathname) {
  if (configuredStorageDriver() === 'supabase') return readSupabaseRecord(pathname);
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).json();
}

export async function writeRecord(pathname, value, overwrite = false) {
  if (configuredStorageDriver() === 'supabase') return writeSupabaseRecord(pathname, value, overwrite);
  return put(pathname, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: overwrite, contentType: 'application/json' });
}

export async function deleteRecord(pathname) {
  if (configuredStorageDriver() === 'supabase') return deleteSupabaseRecord(pathname);
  return del(pathname);
}

export async function listRecords(prefix) {
  if (configuredStorageDriver() === 'supabase') return listSupabaseRecords(prefix);
  const records = [];
  let cursor;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const values = await Promise.all(page.blobs.map((blob) => readRecord(blob.pathname)));
    records.push(...values.filter(Boolean));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return records;
}

export async function auditLog(event, details = {}) {
  const entry = {
    recordType: 'audit_log',
    id: randomUUID(),
    event,
    actorHash: details.actorEmail ? stableHash(String(details.actorEmail).toLowerCase()) : '',
    entityType: details.entityType || '',
    entityId: details.entityId || '',
    metadata: details.metadata || {},
    created_at: new Date().toISOString()
  };
  try {
    await writeRecord(`audit-logs/${entry.created_at.slice(0, 10)}/${entry.id}.json`, entry);
  } catch (error) {
    console.error('audit_log_failed', event, error.message);
  }
  return entry;
}

export async function productEvent(event, details = {}) {
  return auditLog(`product.${event}`, {
    ...details,
    metadata: {
      ...(details.metadata || {}),
      analytics: true
    }
  });
}

function sentryDsnParts() {
  if (!process.env.SENTRY_DSN) return null;
  try {
    const dsn = new URL(process.env.SENTRY_DSN);
    const projectId = dsn.pathname.replace('/', '');
    if (!projectId) return null;
    return {
      key: dsn.username,
      host: dsn.host,
      projectId
    };
  } catch {
    return null;
  }
}

export async function captureException(error, context = {}) {
  await auditLog('server.error', { entityType: 'error', metadata: { message: error.message, context } });
  const sentry = sentryDsnParts();
  if (!sentry) return;
  try {
    await fetch(`https://${sentry.host}/api/${sentry.projectId}/store/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${sentry.key}, sentry_client=crossover-talent/1.0`
      },
      body: JSON.stringify({
        event_id: randomBytes(16).toString('hex'),
        timestamp: new Date().toISOString(),
        platform: 'javascript',
        logger: 'api',
        level: 'error',
        message: error.message,
        extra: context
      })
    });
  } catch (captureError) {
    console.error('sentry_capture_failed', captureError.message);
  }
}

function emailFrom() {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'Crossover Talent <noreply@crossovertalent.asia>';
}

function textFromHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { ok: false, skipped: true, reason: 'missing_recipient' };
  const provider = String(process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
  const missingProviderKey = (provider === 'sendgrid' && !process.env.SENDGRID_API_KEY) || (provider === 'ses' && !process.env.AWS_SES_ACCESS_KEY_ID) || (provider === 'resend' && !process.env.RESEND_API_KEY);
  if (missingProviderKey) {
    await auditLog('email.fallback', { entityType: 'email', entityId: stableHash(to), metadata: { toHash: stableHash(to), subject, provider } });
    return { ok: false, fallback: true, reason: `${provider} email provider is not configured` };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.EMAIL_TIMEOUT_MS || 8000));
  try {
    const payloadText = text || textFromHtml(html);
    let response;
    if (provider === 'sendgrid') {
      response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: (process.env.EMAIL_FROM_ADDRESS || 'noreply@crossovertalent.asia'), name: 'Crossover Talent' }, subject, content: [{ type: 'text/plain', value: payloadText }, { type: 'text/html', value: html }] })
      });
    } else if (provider === 'ses') {
      throw new Error('AWS SES provider prepared but requires signed AWS SDK transport before production use');
    } else {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: controller.signal,
        headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: emailFrom(), to: [to], subject, html, text: payloadText })
      });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || 'Email provider failed');
    await auditLog('email.sent', { entityType: 'email', entityId: data.id || stableHash(to), metadata: { toHash: stableHash(to), subject, provider } });
    return { ok: true, id: data.id };
  } catch (error) {
    await auditLog('email.failed', { entityType: 'email', entityId: stableHash(to), metadata: { toHash: stableHash(to), subject, provider, error: error.message } });
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

export function verificationEmail(role, url) {
  const label = role === 'candidate' ? 'job seeker' : role;
  return {
    subject: 'Verify your Crossover Talent email',
    html: `<p>Welcome to Crossover Talent.</p><p>Verify your ${label} account to continue:</p><p><a href="${url}">Verify email</a></p><p>If you did not request this, you can ignore this email.</p>`
  };
}

export function passwordResetEmail(role, url) {
  const label = role === 'candidate' ? 'job seeker' : role;
  return {
    subject: 'Reset your Crossover Talent password',
    html: `<p>We received a password reset request for your ${label} account.</p><p><a href="${url}">Reset password</a></p><p>This link is time-limited. If you did not request it, you can ignore this email.</p>`
  };
}

export async function openAiChat({ system, user, fallback, model = process.env.OPENAI_MODEL || 'gpt-4.1-mini', timeoutMs = 12000 }) {
  if (!process.env.OPENAI_API_KEY) return { text: fallback, fallback: true, reason: 'OPENAI_API_KEY missing' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI request failed');
    return { text: data.choices?.[0]?.message?.content?.trim() || fallback, fallback: false, model };
  } catch (error) {
    await auditLog('ai.fallback', { entityType: 'ai_request', metadata: { error: error.message, model } });
    return { text: fallback, fallback: true, reason: error.name === 'AbortError' ? 'AI request timed out' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function supabaseStorageBase(bucket, objectPath = '') {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase storage is not configured');
  return new URL(`/storage/v1/object/${bucket}/${objectPath}`.replace(/\/$/, ''), base);
}

export async function uploadPrivateFile({ bucket, objectPath, buffer, contentType = 'application/octet-stream', metadata = {} }) {
  const url = supabaseStorageBase(bucket, objectPath);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'File upload failed');
  await auditLog('file.uploaded', { entityType: 'uploaded_file', entityId: objectPath, metadata: { bucket, ...metadata } });
  return { bucket, objectPath };
}

export async function createSignedFileUrl(bucket, objectPath, expiresIn = 600) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase storage is not configured');
  const url = new URL(`/storage/v1/object/sign/${bucket}/${objectPath}`, base);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ expiresIn })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || 'Signed URL failed');
  return { signedUrl: data.signedURL || data.signedUrl || data.url, expiresIn };
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const derived = await scrypt(password, salt, 64);
  const storedBuffer = Buffer.from(hash, 'hex');
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

function secret() {
  const value = process.env.SESSION_SECRET || process.env.BLOB_READ_WRITE_TOKEN;
  if (!value && process.env.VERCEL_ENV === 'production') throw new Error('Session secret is not configured');
  return value || 'development-session-secret';
}

export function createSession(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role || 'employer', candidateId: user.candidateId, companyId: user.companyId, email: user.email, name: user.name, company: user.company, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(request) {
  const cookie = request.headers.cookie || '';
  const token = cookie.split(';').map((value) => value.trim()).find((value) => value.startsWith('rb_session='))?.slice(11);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Date.now() ? session : null;
  } catch { return null; }
}

export function requireSession(request, response) {
  const session = readSession(request);
  if (!session) {
    response.status(401).json({ error: 'Please sign in' });
    return null;
  }
  return session;
}

export function requireEmployerSession(request, response) {
  const session = requireSession(request, response);
  if (!session) return null;
  if (session.role && session.role !== 'employer') {
    response.status(403).json({ error: 'Employer account required' });
    return null;
  }
  return session;
}

export function setSessionCookie(response, token) {
  response.setHeader('Set-Cookie', `rb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}

export function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', 'rb_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
}

export function methodNotAllowed(response) {
  response.status(405).json({ error: 'Method not allowed' });
}

export function forbidden(response, message = 'Request blocked') {
  response.status(403).json({ error: message });
}

export function tooManyRequests(response) {
  response.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
}

export function serverError(response, error) {
  console.error(error);
  captureException(error).catch(() => {});
  response.status(500).json({ error: error.message === 'Storage is not configured' ? error.message : 'Server error. Please try again.' });
}
