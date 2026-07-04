import { randomUUID } from 'node:crypto';
import { appUrl, assertSameOrigin, auditLog, configuredSupabaseAdminKey, configuredSupabasePublishableKey, configuredSupabaseUrl, ensureStorage, forbidden, listRecords, methodNotAllowed, probeSupabaseDatabase, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, stableHash, supabaseKeyType, tooManyRequests, writeRecord } from './_lib.js';

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
  return {
    supabaseAuthConfigured: Boolean(configuredSupabaseUrl() && configuredSupabasePublishableKey()),
    providers: {
      google: { configured: process.env.AUTH_GOOGLE_ENABLED === 'true', setupRequired: process.env.AUTH_GOOGLE_ENABLED !== 'true' },
      linkedin: { configured: process.env.AUTH_LINKEDIN_ENABLED === 'true', setupRequired: process.env.AUTH_LINKEDIN_ENABLED !== 'true' },
      phone: { configured: process.env.AUTH_PHONE_OTP_ENABLED === 'true', setupRequired: process.env.AUTH_PHONE_OTP_ENABLED !== 'true' }
    },
    employerApprovalEnforced: true
  };
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
    const authUrl = new URL('/auth/v1/authorize', configuredSupabaseUrl());
    authUrl.searchParams.set('provider', provider === 'linkedin' ? 'linkedin_oidc' : 'google');
    authUrl.searchParams.set('redirect_to', appUrl(`/?auth_callback=1&role=${encodeURIComponent(role)}`));
    return response.redirect(302, authUrl.toString());
  }
  if (request.method !== 'POST') return methodNotAllowed(response);
  if (!assertSameOrigin(request)) return forbidden(response);
  const { action = '', phone = '', role = 'candidate' } = request.body || {};
  if (!['start-phone-otp', 'verify-phone-otp'].includes(action)) return response.status(400).json({ error: 'Choose a valid auth provider action' });
  if (!status.supabaseAuthConfigured || !status.providers.phone.configured) {
    return response.status(503).json({
      error: 'Phone OTP login is prepared but not enabled yet. Configure Supabase Auth phone/SMS provider before activating this login method.',
      ...status
    });
  }
  if (!/^\+[1-9]\d{7,14}$/.test(clean(phone))) return response.status(400).json({ error: 'Enter a phone number in international format, for example +6591234567' });
  await auditLog('auth.phone_otp_requested', { entityType: 'auth_provider', metadata: { role, phoneHash: stableHash(phone) } });
  return response.status(501).json({ error: 'Phone OTP provider is enabled but the app session bridge must be completed and tested before production activation.' });
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
