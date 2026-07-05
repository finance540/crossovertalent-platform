import { del, get, list, put } from '@vercel/blob';
import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, timingSafeEqual, randomBytes, randomUUID, scrypt as scryptCallback } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
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

export const EMPLOYER_STATUSES = ['pending_review', 'approved', 'rejected', 'suspended'];

function configuredStorageDriver() {
  const requested = (process.env.STORAGE_DRIVER || '').toLowerCase();
  if (requested) return requested;
  return configuredSupabaseUrl() && configuredSupabaseAdminKey() ? 'supabase' : 'blob';
}

export function allowStorageFallback() {
  return configuredStorageDriver() !== 'supabase' || (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production');
}

export function exposeVerificationLinks() {
  return process.env.VERCEL_ENV !== 'production' || process.env.EXPOSE_VERIFICATION_LINKS === 'true';
}

export function verificationLinkPayload(pathname) {
  return exposeVerificationLinks() ? { verificationUrl: pathname } : {};
}

export function allowAdminSelfRegistration() {
  return process.env.VERCEL_ENV !== 'production' || process.env.ALLOW_ADMIN_SELF_REGISTRATION === 'true';
}

export function employerStatus(account = {}) {
  const status = account.employer_status || account.employerStatus || '';
  if (EMPLOYER_STATUSES.includes(status)) return status;
  return account.createdAt || account.created_at ? 'approved' : 'pending_review';
}

export function employerStatusMessage(account = {}) {
  const status = employerStatus(account);
  if (status === 'pending_review') return 'Your employer account is under review. You can access the dashboard after an admin validates and approves your company.';
  if (status === 'rejected') return account.rejection_reason ? `Your employer registration was not approved: ${account.rejection_reason}` : 'Your employer registration was not approved. Contact support if you believe this is incorrect.';
  if (status === 'suspended') return 'Your employer account is suspended. Contact support for help.';
  return '';
}

export function configuredSupabaseUrl() {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
}

export function configuredSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
}

export function configuredSupabaseAdminKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
}

export function isSupabaseJwtKey(key = '') {
  return String(key).split('.').length === 3;
}

export function supabaseKeyType(key = '') {
  const value = String(key);
  if (value.startsWith('sb_secret_')) return 'secret';
  if (value.startsWith('sb_publishable_')) return 'publishable';
  if (isSupabaseJwtKey(value)) return 'legacy_jwt';
  return value ? 'unknown' : 'missing';
}

export function ensureStorage() {
  const driver = configuredStorageDriver();
  if (driver === 'local') return;
  if (driver === 'supabase') {
    if (!configuredSupabaseUrl() || !configuredSupabaseAdminKey()) throw new Error('Supabase storage is not configured');
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
  const base = configuredSupabaseUrl();
  if (!base) throw new Error('Supabase storage is not configured');
  return new URL(`/rest/v1/${pathname}`, base);
}

function supabaseHeaders(extra = {}) {
  const key = configuredSupabaseAdminKey();
  if (!key) throw new Error('Supabase storage is not configured');
  const headers = {
    apikey: key,
    'content-type': 'application/json',
    ...extra
  };
  if (isSupabaseJwtKey(key)) headers.authorization = `Bearer ${key}`;
  return headers;
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

export async function probeSupabaseDatabase() {
  const url = supabaseUrl();
  url.searchParams.set('select', 'path');
  url.searchParams.set('limit', '1');
  return supabaseRequest(url, { headers: supabaseHeaders() });
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

function localStorageRoot() {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || '.tmp/local-storage');
}

function localPath(pathname) {
  return path.join(localStorageRoot(), pathname);
}

async function readLocalRecord(pathname) {
  try {
    return JSON.parse(await readFile(localPath(pathname), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeLocalRecord(pathname, value, overwrite = false) {
  const target = localPath(pathname);
  await mkdir(path.dirname(target), { recursive: true });
  if (!overwrite) {
    try {
      await stat(target);
      throw new Error('Record already exists');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await writeFile(target, JSON.stringify(value), 'utf8');
}

async function listLocalFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? listLocalFiles(target) : [target];
  }));
  return files.flat();
}

async function listLocalRecords(prefix) {
  const root = localPath(prefix);
  const files = await listLocalFiles(root);
  const records = await Promise.all(files.filter((file) => file.endsWith('.json')).map((file) => readFile(file, 'utf8').then(JSON.parse)));
  return records.filter(Boolean);
}

export async function readRecord(pathname) {
  if (configuredStorageDriver() === 'supabase') return readSupabaseRecord(pathname);
  if (configuredStorageDriver() === 'local') return readLocalRecord(pathname);
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).json();
}

export async function writeRecord(pathname, value, overwrite = false) {
  if (configuredStorageDriver() === 'supabase') return writeSupabaseRecord(pathname, value, overwrite);
  if (configuredStorageDriver() === 'local') return writeLocalRecord(pathname, value, overwrite);
  return put(pathname, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: overwrite, contentType: 'application/json' });
}

export async function deleteRecord(pathname) {
  if (configuredStorageDriver() === 'supabase') return deleteSupabaseRecord(pathname);
  if (configuredStorageDriver() === 'local') return rm(localPath(pathname), { force: true });
  return del(pathname);
}

export async function listRecords(prefix) {
  if (configuredStorageDriver() === 'supabase') return listSupabaseRecords(prefix);
  if (configuredStorageDriver() === 'local') return listLocalRecords(prefix);
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
    return { text: fallback, fallback: true, reason: error.name === 'AbortError' ? 'AI request timed out' : 'AI provider unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

function supabaseStorageBase(bucket, objectPath = '') {
  const base = configuredSupabaseUrl();
  if (!base || !configuredSupabaseAdminKey()) throw new Error('Supabase storage is not configured');
  return new URL(`/storage/v1/object/${bucket}/${objectPath}`.replace(/\/$/, ''), base);
}

let supabaseStorageClient;

const STORAGE_BUCKET_CONFIG = {
  'crossover-cvs-production': {
    public: false,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },
  'crossover-job-descriptions-production': {
    public: false,
    fileSizeLimit: 5_242_880,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]
  },
  'crossover-company-logos-production': {
    public: true,
    fileSizeLimit: 2_097_152,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
  }
};

function supabaseAdminStorage() {
  const base = configuredSupabaseUrl();
  const key = configuredSupabaseAdminKey();
  if (!base || !key) throw new Error('Supabase storage is not configured');
  if (!supabaseStorageClient) {
    supabaseStorageClient = createClient(base, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return supabaseStorageClient;
}

function isMissingBucketError(error) {
  const value = `${error?.message || ''} ${error?.name || ''}`.toLowerCase();
  return value.includes('bucket not found') || value.includes('not found');
}

async function ensureSupabaseBucket(client, bucket) {
  const config = STORAGE_BUCKET_CONFIG[bucket];
  if (!config) return;
  const current = await client.storage.getBucket(bucket);
  if (!current.error) return;
  if (!isMissingBucketError(current.error)) throw new Error(`Supabase Storage bucket check failed: ${current.error.message}`);
  const created = await client.storage.createBucket(bucket, config);
  if (created.error && !/already exists/i.test(created.error.message || '')) throw new Error(`Supabase Storage bucket creation failed: ${created.error.message}`);
}

export async function uploadPrivateFile({ bucket, objectPath, buffer, contentType = 'application/octet-stream', metadata = {} }) {
  if (!bucket || !objectPath) throw new Error('File upload target is missing');
  if (configuredStorageDriver() === 'local') {
    const target = localPath(`files/${bucket}/${objectPath}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    await auditLog('file.uploaded', { entityType: 'uploaded_file', entityId: objectPath, metadata: { bucket, contentType, ...metadata } });
    return { bucket, objectPath };
  }
  const client = supabaseAdminStorage();
  await ensureSupabaseBucket(client, bucket);
  const { error } = await client.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600'
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const downloaded = await client.storage.from(bucket).download(objectPath);
  if (downloaded.error) throw new Error(`Supabase Storage upload verification failed: ${downloaded.error.message}`);

  await auditLog('file.uploaded', { entityType: 'uploaded_file', entityId: objectPath, metadata: { bucket, ...metadata } });
  return { bucket, objectPath };
}

export async function createSignedFileUrl(bucket, objectPath, expiresIn = 600) {
  if (configuredStorageDriver() === 'local') return { signedUrl: `local://${bucket}/${objectPath}`, expiresIn };
  const client = supabaseAdminStorage();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return { signedUrl: data?.signedUrl, expiresIn };
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
  const payload = Buffer.from(JSON.stringify({ id: user.id, role: user.role || 'employer', candidateId: user.candidateId, companyId: user.companyId, email: user.email, name: user.name, company: user.company, employer_status: user.employer_status, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
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

export async function requireApprovedEmployerSession(request, response) {
  const session = requireEmployerSession(request, response);
  if (!session) return null;
  const account = await readRecord(`accounts/${stableHash(session.email)}.json`);
  if (!account) {
    response.status(401).json({ error: 'Employer account not found' });
    return null;
  }
  if (account.disabled) {
    response.status(403).json({ error: 'This account has been disabled by an administrator' });
    return null;
  }
  const status = employerStatus(account);
  if (status !== 'approved') {
    response.status(403).json({
      error: employerStatusMessage(account),
      employer_status: status,
      rejection_reason: account.rejection_reason || '',
      support: 'query@crossovertalent.com'
    });
    return null;
  }
  return { ...session, company: account.company, companyId: account.companyId, employer_status: status };
}

export function setSessionCookie(response, token) {
  const secure = process.env.VERCEL_ENV === 'production';
  response.setHeader('Set-Cookie', `rb_session=${token}; Path=/; HttpOnly${secure ? '; Secure' : ''}; SameSite=Lax; Max-Age=604800`);
}

export function clearSessionCookie(response) {
  const secure = process.env.VERCEL_ENV === 'production';
  response.setHeader('Set-Cookie', `rb_session=; Path=/; HttpOnly${secure ? '; Secure' : ''}; SameSite=Lax; Max-Age=0`);
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
