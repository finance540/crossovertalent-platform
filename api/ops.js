import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { appUrl, assertSameOrigin, auditLog, configuredSupabaseAdminKey, configuredSupabasePublishableKey, configuredSupabaseUrl, createSession, employerStatus, employerStatusMessage, ensureStorage, forbidden, listRecords, methodNotAllowed, probeSupabaseDatabase, productEvent, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, setSessionCookie, stableHash, supabaseKeyType, tooManyRequests, writeRecord } from './_lib.js';

const SUPPORT_TYPES = ['feedback', 'bug', 'support', 'feature'];
const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const VERIFY_SOURCES = [
  { prefix: 'accounts/', label: 'employer' },
  { prefix: 'candidates/', label: 'candidate' },
  { prefix: 'admins/', label: 'admin' }
];

const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to CrossOver Talent',
    purpose: 'Sent after account activation in production onboarding flows.'
  },
  verification: {
    subject: 'Verify your CrossOver Talent email',
    purpose: 'Sent to employer, candidate, and admin users before dashboard access.'
  },
  passwordReset: {
    subject: 'Reset your CrossOver Talent password',
    purpose: 'Sent after password reset request.'
  },
  applicationReceived: {
    subject: 'Application received: {{job_title}}',
    purpose: 'Sent to candidates after application submission.'
  },
  applicationStatusChanged: {
    subject: 'Application status updated: {{job_title}}',
    purpose: 'Sent to candidates when employer changes application status.'
  },
  interviewScheduled: {
    subject: 'Interview update for {{job_title}}',
    purpose: 'Prepared for future interview scheduling workflow.'
  },
  offer: {
    subject: 'Offer update for {{job_title}}',
    purpose: 'Prepared for offer-stage notification workflow.'
  },
  rejection: {
    subject: 'Application update for {{job_title}}',
    purpose: 'Prepared for rejection-stage notification workflow.'
  }
};

function clean(value = '', max = 1000) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function routeName(request) {
  const queryRoute = Array.isArray(request.query?.route) ? request.query.route[0] : request.query?.route;
  if (queryRoute) return clean(queryRoute, 80);
  try {
    const url = new URL(request.url, `https://${request.headers.host || 'localhost'}`);
    return clean(url.searchParams.get('route') || url.pathname.split('/').pop(), 80);
  } catch {
    return '';
  }
}

function publicMessage(role) {
  return `${role === 'employer' ? 'Employer' : role === 'admin' ? 'Admin' : 'Job seeker'} email verified. You can now sign in.`;
}

function supabaseProjectRef() {
  try {
    return new URL(configuredSupabaseUrl() || '').hostname.split('.')[0] || '';
  } catch {
    return '';
  }
}

async function requireAdmin(request, response) {
  const session = readSession(request);
  if (!session || session.role !== 'admin') {
    response.status(401).json({ error: 'Admin sign in required' });
    return null;
  }
  const admin = await readRecord(`admins/${stableHash(session.email)}.json`);
  if (!admin || admin.disabled || !admin.emailVerified) {
    response.status(403).json({ error: 'Verified admin access required' });
    return null;
  }
  return admin;
}

async function health(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  return response.json({
    ok: true,
    status: 'healthy',
    service: 'crossover-talent',
    timestamp: new Date().toISOString()
  });
}

async function ready(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const isProduction = process.env.VERCEL_ENV === 'production';
  const expectedProductionRef = process.env.SUPABASE_EXPECTED_PROJECT_REF || 'hntvcqahoseizmgswohq';
  const checks = {
    storage: false,
    database: false,
    supabaseProject: !isProduction || supabaseProjectRef() === expectedProductionRef,
    sessionSecret: Boolean(process.env.SESSION_SECRET || process.env.VERCEL_ENV !== 'production'),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL),
    cvBucket: !isProduction || process.env.SUPABASE_CV_BUCKET === 'crossover-cvs-production',
    jdBucket: !isProduction || process.env.SUPABASE_JD_BUCKET === 'crossover-job-descriptions-production',
    logoBucket: !isProduction || process.env.SUPABASE_LOGO_BUCKET === 'crossover-company-logos-production',
    fileBucket: !isProduction || process.env.SUPABASE_FILE_BUCKET === 'crossover-job-descriptions-production'
  };
  const diagnostics = {
    supabaseProjectRef: supabaseProjectRef() || 'missing',
    expectedSupabaseProjectRef: expectedProductionRef,
    adminKeyType: supabaseKeyType(configuredSupabaseAdminKey())
  };
  try {
    ensureStorage();
    checks.storage = true;
    await probeSupabaseDatabase();
    checks.database = true;
  } catch (error) {
    const message = String(error.message || '').toLowerCase();
    const reason = !configuredSupabaseUrl()
      ? 'missing_supabase_url'
      : !configuredSupabaseAdminKey()
        ? 'missing_admin_key'
        : !checks.supabaseProject
          ? 'wrong_project_ref'
          : error.status === 401 || message.includes('invalid api key')
            ? 'invalid_api_key'
            : error.status === 403 || message.includes('permission denied') || message.includes('rls')
              ? 'permission_or_rls_denied'
              : error.status === 404 || message.includes('not found')
                ? 'missing_table_or_rest_schema'
                : 'database_probe_failed';
    return response.status(503).json({
      ok: false,
      status: 'not_ready',
      checks,
      reason,
      diagnostics,
      error: error.message === 'Storage is not configured' ? error.message : 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
  const ok = Object.values(checks).every(Boolean);
  return response.status(ok ? 200 : 503).json({
    ok,
    status: ok ? 'ready' : 'not_ready',
    checks,
    diagnostics,
    timestamp: new Date().toISOString()
  });
}

async function verifyEmail(request, response) {
  ensureStorage();
  if (request.method !== 'GET') return methodNotAllowed(response);
  const token = String(request.query.token || '').trim();
  if (!token || token.length < 16) return response.status(400).json({ error: 'Invalid verification link' });
  for (const source of VERIFY_SOURCES) {
    const records = await listRecords(source.prefix);
    const account = records.find((item) => item.verificationToken === token);
    if (!account) continue;
    const pathname = `${source.prefix}${account.recordKey || account.pathKey || ''}`;
    const path = pathname.endsWith('.json') ? pathname : `${source.prefix}${account.lookupKey || account.emailHash || ''}.json`;
    const stored = await readRecord(path);
    const target = stored?.verificationToken === token ? stored : account;
    const targetPath = stored?.verificationToken === token ? path : `${source.prefix}${target.emailHash}.json`;
    await writeRecord(targetPath, { ...target, emailVerified: true, emailVerifiedAt: new Date().toISOString(), verificationToken: '', updatedAt: new Date().toISOString() }, true);
    await auditLog('auth.email_verified', { actorEmail: target.email, entityType: target.role || source.label, entityId: target.id });
    return response.json({ ok: true, role: target.role || source.label, message: publicMessage(target.role || source.label) });
  }
  return response.status(404).json({ error: 'Verification link was not found or has already been used' });
}

async function feedback(request, response) {
  ensureStorage();

  if (request.method === 'GET') {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    const tickets = (await listRecords('support-tickets/'))
      .filter((item) => item.recordType === 'support_ticket')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return response.json({ tickets });
  }

  if (request.method === 'PATCH') {
    const admin = await requireAdmin(request, response);
    if (!admin) return;
    if (!assertSameOrigin(request)) return forbidden(response);
    const { id = '', status = 'open' } = request.body || {};
    if (!['open', 'triaged', 'closed'].includes(status)) return response.status(400).json({ error: 'Choose a valid support status' });
    const path = `support-tickets/${clean(id, 80)}.json`;
    const ticket = await readRecord(path);
    if (!ticket) return response.status(404).json({ error: 'Support ticket not found' });
    const updated = { ...ticket, status, updated_at: new Date().toISOString(), updatedBy: admin.email };
    await writeRecord(path, updated, true);
    await auditLog('support.ticket_updated', { actorEmail: admin.email, entityType: 'support_ticket', entityId: ticket.id, metadata: { status } });
    return response.json({ ticket: updated });
  }

  if (request.method !== 'POST') return methodNotAllowed(response);
  if (!assertSameOrigin(request)) return forbidden(response);
  if (!(await rateLimit(request, 'feedback', 10, 15 * 60 * 1000))) return tooManyRequests(response);

  const session = readSession(request);
  const { type = 'feedback', name = '', email = '', company = '', subject = '', message = '', priority = 'normal', page = '', userAgent = '' } = request.body || {};
  const ticketType = SUPPORT_TYPES.includes(type) ? type : 'feedback';
  const ticketPriority = SUPPORT_PRIORITIES.includes(priority) ? priority : 'normal';
  const contactEmail = clean(email || session?.email || '', 254).toLowerCase();
  if (!clean(subject, 160) || !clean(message, 4000)) return response.status(400).json({ error: 'Add a subject and message' });
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return response.status(400).json({ error: 'Enter a valid email address' });

  const ticket = {
    recordType: 'support_ticket',
    id: randomUUID(),
    type: ticketType,
    priority: ticketPriority,
    status: 'open',
    name: clean(name || session?.name || session?.company || '', 120),
    email: contactEmail,
    company: clean(company || session?.company || '', 160),
    role: session?.role || 'public',
    subject: clean(subject, 160),
    message: clean(message, 4000),
    page: clean(page, 500),
    userAgent: clean(userAgent, 500),
    ownerHash: contactEmail ? stableHash(contactEmail) : '',
    created_at: new Date().toISOString()
  };

  await writeRecord(`support-tickets/${ticket.id}.json`, ticket);
  await auditLog('support.ticket_created', { actorEmail: contactEmail, entityType: 'support_ticket', entityId: ticket.id, metadata: { type: ticket.type, priority: ticket.priority } });

  if (process.env.SUPPORT_EMAIL) {
    await sendEmail({
      to: process.env.SUPPORT_EMAIL,
      subject: `[${ticket.type}] ${ticket.subject}`,
      html: `<p>New ${ticket.type} ticket from ${ticket.name || ticket.email || 'public user'}.</p><p>${ticket.message}</p><p><a href="${appUrl('/?admin=1')}">Open admin feedback inbox</a></p>`
    });
  }

  return response.status(201).json({ ok: true, ticket: { id: ticket.id, status: ticket.status } });
}

async function telemetry(request, response) {
  if (request.method !== 'POST') return methodNotAllowed(response);
  if (!assertSameOrigin(request)) return forbidden(response);
  if (!(await rateLimit(request, 'telemetry', 120, 60 * 1000))) return tooManyRequests(response);
  const { type = 'client.event', message = '', path = '', detail = {}, metric = '' } = request.body || {};
  await auditLog(`telemetry.${clean(type, 80)}`, {
    entityType: 'telemetry',
    entityId: clean(metric || path || type, 120),
    metadata: {
      message: clean(message),
      path: clean(path, 300),
      detail: typeof detail === 'object' && detail ? detail : {}
    }
  });
  return response.status(202).json({ ok: true });
}

async function emailTemplates(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response);
  return response.json({ templates: EMAIL_TEMPLATES });
}

function authProviderStatus() {
  const linkedInDirectConfigured = Boolean(linkedInClientId() && linkedInClientSecret() && linkedInRedirectUri());
  return {
    supabaseAuthConfigured: Boolean(configuredSupabaseUrl() && configuredSupabasePublishableKey()),
    linkedInDirectConfigured,
    providers: {
      google: { configured: process.env.AUTH_GOOGLE_ENABLED === 'true', setupRequired: process.env.AUTH_GOOGLE_ENABLED !== 'true' },
      linkedin: { configured: process.env.AUTH_LINKEDIN_ENABLED === 'true', setupRequired: process.env.AUTH_LINKEDIN_ENABLED !== 'true' },
      phone: { configured: process.env.AUTH_PHONE_OTP_ENABLED === 'true', setupRequired: process.env.AUTH_PHONE_OTP_ENABLED !== 'true' }
    },
    employerApprovalEnforced: true
  };
}

function linkedInClientId() {
  return process.env.LINKEDIN_CLIENT_ID || '';
}

function linkedInClientSecret() {
  return process.env.LINKEDIN_CLIENT_SECRET || '';
}

function linkedInRedirectUri() {
  return process.env.LINKEDIN_REDIRECT_URI || process.env.LINKEDIN_OAUTH_REDIRECT_URI || 'https://www.crossovertalent.asia';
}

function linkedInDirectEnabled() {
  return process.env.LINKEDIN_DIRECT_OAUTH_ENABLED === 'true' || Boolean(linkedInClientId() && linkedInClientSecret());
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signLinkedInState(role = 'candidate') {
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('LinkedIn OAuth state signing is not configured');
  const payload = base64url(JSON.stringify({
    role: ['employer', 'candidate', 'admin'].includes(role) ? role : 'candidate',
    nonce: randomUUID(),
    createdAt: Date.now(),
    redirectUri: linkedInRedirectUri()
  }));
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyLinkedInState(state = '') {
  const secret = process.env.SESSION_SECRET || '';
  const [payload, signature] = String(state).split('.');
  if (!secret || !payload || !signature) throw Object.assign(new Error('Invalid LinkedIn OAuth state'), { status: 400 });
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw Object.assign(new Error('Invalid LinkedIn OAuth state'), { status: 400 });
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!parsed.createdAt || Date.now() - parsed.createdAt > 10 * 60 * 1000) {
    throw Object.assign(new Error('LinkedIn OAuth state has expired. Try signing in again.'), { status: 400 });
  }
  return parsed;
}

function linkedInAuthorizeUrl(role = 'candidate') {
  if (!linkedInClientId()) throw new Error('LinkedIn OAuth client ID is not configured');
  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', linkedInClientId());
  url.searchParams.set('redirect_uri', linkedInRedirectUri());
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', signLinkedInState(role));
  return url.toString();
}

async function exchangeLinkedInCode(code = '', redirectUri = '') {
  if (!code || code.length < 8) throw Object.assign(new Error('LinkedIn did not return a valid authorization code'), { status: 400 });
  if (!linkedInClientId() || !linkedInClientSecret()) throw Object.assign(new Error('LinkedIn OAuth credentials are not configured'), { status: 503 });
  const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri || linkedInRedirectUri(),
      client_id: linkedInClientId(),
      client_secret: linkedInClientSecret()
    })
  });
  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    const error = new Error(tokenData.error_description || tokenData.error || 'LinkedIn token exchange failed');
    error.status = tokenResponse.status;
    throw error;
  }
  const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok) {
    const error = new Error(profile.error_description || profile.message || 'LinkedIn profile lookup failed');
    error.status = profileResponse.status;
    throw error;
  }
  return {
    id: profile.sub ? `linkedin:${profile.sub}` : `linkedin:${stableHash(profile.email || tokenData.access_token).slice(0, 24)}`,
    email: profile.email || '',
    email_confirmed_at: profile.email_verified ? new Date().toISOString() : '',
    user_metadata: {
      full_name: profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(' '),
      name: profile.name || '',
      picture: profile.picture || ''
    }
  };
}

function providerHeaders(accessToken = '') {
  const key = configuredSupabasePublishableKey();
  const headers = { apikey: key, 'content-type': 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  return headers;
}

async function supabaseAuthRequest(pathname, { accessToken = '', method = 'GET', body } = {}) {
  const base = configuredSupabaseUrl();
  const key = configuredSupabasePublishableKey();
  if (!base || !key) throw new Error('Supabase Auth is not configured');
  const response = await fetch(new URL(pathname, base), {
    method,
    headers: providerHeaders(accessToken),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.msg || data.message || data.error_description || data.error || 'Supabase Auth request failed');
    error.status = response.status;
    throw error;
  }
  return data;
}

async function supabaseUserFromAccessToken(accessToken = '') {
  if (!accessToken || accessToken.length < 20) {
    const error = new Error('Missing Supabase access token');
    error.status = 400;
    throw error;
  }
  return supabaseAuthRequest('/auth/v1/user', { accessToken });
}

function providerDisplayName(user = {}, fallback = '') {
  const metadata = user.user_metadata || user.raw_user_meta_data || {};
  return clean(metadata.full_name || metadata.name || metadata.preferred_username || fallback || user.email || user.phone || 'Crossover Talent user', 120);
}

function providerEmail(user = {}) {
  return clean(user.email || '', 254).toLowerCase();
}

function providerPhone(user = {}) {
  return clean(user.phone || user.user_metadata?.phone || '', 40);
}

function providerInternalEmail(user = {}) {
  const email = providerEmail(user);
  if (email) return email;
  const phone = providerPhone(user);
  return phone ? `phone-${stableHash(phone).slice(0, 24)}@phone.crossovertalent.local` : '';
}

function publicProviderCandidate(candidate) {
  return {
    id: candidate.id,
    role: 'candidate',
    name: candidate.name,
    email: candidate.email,
    linkedin: candidate.linkedin || '',
    resume: candidate.resume || '',
    savedJobs: candidate.savedJobs || [],
    preferences: candidate.preferences || {}
  };
}

function publicProviderEmployer(account) {
  const status = employerStatus(account);
  return { id: account.id, role: 'employer', companyId: account.companyId, email: account.email, company: account.company, employer_status: status, reviewed_at: account.reviewed_at || '', rejection_reason: account.rejection_reason || '', company_validation_notes: account.company_validation_notes || '' };
}

async function completeProviderLogin(request, response, { user, role, provider, company = '', name = '' }) {
  const selectedRole = ['employer', 'candidate', 'admin'].includes(role) ? role : 'candidate';
  const email = providerInternalEmail(user);
  const phone = providerPhone(user);
  if (!email) return response.status(400).json({ error: 'Supabase Auth did not return an email or phone number for this login' });
  const emailHash = stableHash(email);
  const providerMetadata = {
    provider,
    supabaseUserId: user.id || '',
    phoneHash: phone ? stableHash(phone) : '',
    emailVerifiedByProvider: Boolean(user.email_confirmed_at || user.confirmed_at || user.email || phone),
    lastProviderLoginAt: new Date().toISOString()
  };

  if (selectedRole === 'admin') {
    const path = `admins/${emailHash}.json`;
    const admin = await readRecord(path);
    if (!admin) return response.status(403).json({ error: 'Admin account must be created and verified before social login is allowed' });
    if (admin.disabled) return response.status(403).json({ error: 'This admin account has been disabled' });
    const updated = { ...admin, emailVerified: true, emailVerifiedAt: admin.emailVerifiedAt || new Date().toISOString(), authProvider: providerMetadata, updatedAt: new Date().toISOString() };
    await writeRecord(path, updated, true);
    setSessionCookie(response, createSession(updated));
    await auditLog('admin.provider_login', { actorEmail: updated.email, entityType: 'admin', entityId: updated.id, metadata: { provider } });
    return response.json({ admin: { id: updated.id, role: 'admin', name: updated.name, email: updated.email }, redirectTo: '/?admin=1' });
  }

  if (selectedRole === 'candidate') {
    const path = `candidates/${emailHash}.json`;
    const existing = await readRecord(path);
    if (existing?.disabled) return response.status(403).json({ error: 'This account has been disabled by an administrator' });
    const candidate = existing || {
      id: randomUUID(),
      role: 'candidate',
      name: providerDisplayName(user, name),
      email,
      emailHash,
      emailVerified: true,
      emailVerifiedAt: new Date().toISOString(),
      verificationToken: '',
      disabled: false,
      linkedin: '',
      passwordHash: '',
      savedJobs: [],
      resume: '',
      preferences: {},
      phone,
      createdAt: new Date().toISOString()
    };
    const updated = { ...candidate, name: candidate.name || providerDisplayName(user, name), phone: phone || candidate.phone || '', emailVerified: true, emailVerifiedAt: candidate.emailVerifiedAt || new Date().toISOString(), authProvider: providerMetadata, updatedAt: new Date().toISOString() };
    await writeRecord(path, updated, true);
    setSessionCookie(response, createSession({ ...updated, candidateId: updated.id }));
    await auditLog(existing ? 'candidate.provider_login' : 'candidate.provider_registered', { actorEmail: updated.email, entityType: 'candidate', entityId: updated.id, metadata: { provider } });
    await productEvent(existing ? 'candidate_login' : 'candidate_signup', { actorEmail: updated.email, entityType: 'candidate', entityId: updated.id, metadata: { provider } });
    return response.json({ candidate: publicProviderCandidate(updated), applications: [], redirectTo: '/?candidate=dashboard' });
  }

  const path = `accounts/${emailHash}.json`;
  const existing = await readRecord(path);
  if (existing?.disabled) return response.status(403).json({ error: 'This account has been disabled by an administrator' });
  const account = existing || {
    id: randomUUID(),
    role: 'employer',
    companyId: randomUUID(),
    company: clean(company || providerDisplayName(user, name) || 'Company pending review', 120),
    email,
    emailHash,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
    verificationToken: '',
    disabled: false,
    employer_status: 'pending_review',
    reviewed_by: '',
    reviewed_at: '',
    rejection_reason: '',
    company_validation_notes: '',
    passwordHash: '',
    phone,
    createdAt: new Date().toISOString()
  };
  const updated = { ...account, phone: phone || account.phone || '', emailVerified: true, emailVerifiedAt: account.emailVerifiedAt || new Date().toISOString(), authProvider: providerMetadata, updatedAt: new Date().toISOString() };
  await writeRecord(path, updated, true);
  const statusValue = employerStatus(updated);
  await auditLog(existing ? 'auth.provider_login' : 'auth.provider_registered', { actorEmail: updated.email, entityType: 'account', entityId: updated.id, metadata: { provider, employer_status: statusValue } });
  await productEvent(existing ? 'employer_login' : 'employer_signup', { actorEmail: updated.email, entityType: 'account', entityId: updated.id, metadata: { provider, companyId: updated.companyId, employer_status: statusValue } });
  if (statusValue !== 'approved') {
    return response.status(403).json({
      error: employerStatusMessage(updated),
      employer_status: statusValue,
      rejection_reason: updated.rejection_reason || '',
      user: publicProviderEmployer(updated),
      support: 'query@crossovertalent.com'
    });
  }
  setSessionCookie(response, createSession({ ...updated, employer_status: statusValue }));
  return response.json({ user: publicProviderEmployer(updated), redirectTo: '/?dashboard=1' });
}

async function authProvider(request, response) {
  const status = authProviderStatus();
  if (request.method === 'GET') {
    const provider = clean(request.query.provider || '', 30).toLowerCase();
    const role = clean(request.query.role || 'candidate', 30).toLowerCase();
    if (!provider) return response.json(status);
    if (!['google', 'linkedin'].includes(provider)) return response.status(400).json({ error: 'Choose Google or LinkedIn for OAuth login' });
    const providerKey = provider === 'linkedin' ? 'linkedin' : 'google';
    if (!status.supabaseAuthConfigured || !status.providers[providerKey].configured) {
      return response.status(503).json({
        error: `${provider === 'google' ? 'Google' : 'LinkedIn'} login is prepared but not enabled yet. Configure the Supabase Auth provider before activating this login method.`,
        ...status
      });
    }
    if (provider === 'linkedin' && linkedInDirectEnabled()) {
      if (!linkedInClientId() || !linkedInClientSecret()) {
        return response.status(503).json({ error: 'LinkedIn direct OAuth is enabled but credentials are not configured', ...status });
      }
      return response.redirect(302, linkedInAuthorizeUrl(role));
    }
    const authUrl = new URL('/auth/v1/authorize', configuredSupabaseUrl());
    authUrl.searchParams.set('provider', provider === 'linkedin' ? 'linkedin_oidc' : 'google');
    authUrl.searchParams.set('redirect_to', appUrl(`/?auth_callback=1&role=${encodeURIComponent(role)}`));
    return response.redirect(302, authUrl.toString());
  }
  if (request.method !== 'POST') return methodNotAllowed(response);
  if (!assertSameOrigin(request)) return forbidden(response);
  const { action = '', phone = '', token = '', accessToken = '', role = 'candidate', provider = 'oauth', company = '', name = '' } = request.body || {};
  if (action === 'complete-oauth') {
    const user = await supabaseUserFromAccessToken(accessToken);
    return completeProviderLogin(request, response, { user, role: clean(role, 30).toLowerCase(), provider: clean(provider || 'oauth', 30), company, name });
  }
  if (action === 'complete-linkedin') {
    const { code = '', state = '' } = request.body || {};
    const verifiedState = verifyLinkedInState(state);
    const user = await exchangeLinkedInCode(clean(code, 2048), verifiedState.redirectUri || linkedInRedirectUri());
    return completeProviderLogin(request, response, { user, role: clean(verifiedState.role || role, 30).toLowerCase(), provider: 'linkedin', company, name });
  }
  if (!['start-phone-otp', 'verify-phone-otp'].includes(action)) return response.status(400).json({ error: 'Choose a valid auth provider action' });
  if (!status.supabaseAuthConfigured || !status.providers.phone.configured) {
    return response.status(503).json({
      error: 'Phone OTP login is prepared but not enabled yet. Configure Supabase Auth phone/SMS provider before activating this login method.',
      ...status
    });
  }
  const cleanPhone = clean(phone, 40);
  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) return response.status(400).json({ error: 'Enter a phone number in international format, for example +6591234567' });
  if (action === 'start-phone-otp') {
    await supabaseAuthRequest('/auth/v1/otp', { method: 'POST', body: { phone: cleanPhone, create_user: true } });
    await auditLog('auth.phone_otp_requested', { entityType: 'auth_provider', metadata: { role, phoneHash: stableHash(cleanPhone) } });
    return response.status(202).json({ ok: true, message: 'OTP sent. Enter the code to continue.' });
  }
  if (!/^\d{4,10}$/.test(clean(token, 20))) return response.status(400).json({ error: 'Enter the OTP code sent to your phone' });
  const verified = await supabaseAuthRequest('/auth/v1/verify', { method: 'POST', body: { phone: cleanPhone, token: clean(token, 20), type: 'sms' } });
  return completeProviderLogin(request, response, { user: verified.user || { phone: cleanPhone }, role: clean(role, 30).toLowerCase(), provider: 'phone', company, name });
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    const route = routeName(request);
    if (route === 'health') return health(request, response);
    if (route === 'ready') return ready(request, response);
    if (route === 'verify') return verifyEmail(request, response);
    if (route === 'feedback') return feedback(request, response);
    if (route === 'telemetry') return telemetry(request, response);
    if (route === 'auth-provider') return authProvider(request, response);
    if (route === 'email-templates') return emailTemplates(request, response);
    return response.status(404).json({ error: 'Operational route not found' });
  } catch (error) {
    return serverError(response, error);
  }
}
