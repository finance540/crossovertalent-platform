import { randomUUID } from 'node:crypto';
import { allowAdminSelfRegistration, appUrl, assertSameOrigin, auditLog, clearSessionCookie, createSession, ensureStorage, forbidden, hashPassword, listRecords, methodNotAllowed, passwordResetEmail, productEvent, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, setSessionCookie, stableHash, tooManyRequests, verificationEmail, verificationLinkPayload, verifyPassword, writeRecord } from './_lib.js';

function clean(value = '') {
  return String(value).trim();
}

function publicAdmin(admin) {
  return { id: admin.id, role: 'admin', name: admin.name, email: admin.email };
}

function isQaAdminEmail(email = '') {
  return /^qa-admin[-+][a-z0-9._-]+@crossovertalent\.asia$/i.test(email);
}

async function adminMetrics() {
  const [companyRecords, candidates, reviews, salarySignals, auditLogs, supportTickets] = await Promise.all([
    listRecords('companies/'),
    listRecords('candidates/'),
    listRecords('reviews/'),
    listRecords('salary-signals/'),
    listRecords('audit-logs/'),
    listRecords('support-tickets/')
  ]);
  const jobs = companyRecords.filter((item) => item.recordType === 'job');
  const applications = companyRecords.filter((item) => item.recordType === 'application');
  const employers = await listRecords('accounts/');
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const since7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const since30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = auditLogs.filter((item) => new Date(item.created_at || 0).getTime() >= since);
  const productLogs = auditLogs.filter((item) => /^product\./.test(item.event || ''));
  const activeUsers = (windowMs) => new Set(productLogs.filter((item) => new Date(item.created_at || 0).getTime() >= Date.now() - windowMs).map((item) => item.actorHash).filter(Boolean)).size;
  const countEvent = (pattern) => recent.filter((item) => pattern.test(item.event || '')).length;
  const countProductEvent = (pattern) => productLogs.filter((item) => pattern.test(item.event || '')).length;
  const companiesWithJobs = new Set(jobs.map((job) => job.companyId)).size;
  const candidatesWithApplications = new Set(applications.map((application) => application.email)).size;
  const emailSent = auditLogs.filter((item) => item.event === 'email.sent').length;
  const emailFailed = auditLogs.filter((item) => /email\.(failed|fallback)/.test(item.event || '')).length;
  const apiEvents = auditLogs.filter((item) => /telemetry\.client\.performance|server\.error/.test(item.event || ''));
  const latencyValues = auditLogs
    .filter((item) => item.event === 'telemetry.client.performance')
    .map((item) => Number(item.metadata?.detail?.duration || 0))
    .filter(Boolean);
  const serverErrors = auditLogs.filter((item) => item.event === 'server.error').length;
  return {
    activeJobs: jobs.filter((job) => job.status === 'active').length,
    totalJobs: jobs.length,
    applications: applications.length,
    candidates: candidates.length,
    reviews: reviews.filter((item) => item.recordType === 'review').length,
    salarySignals: salarySignals.filter((item) => item.recordType === 'salary_signal').length,
    employers: employers.length,
    dailySignups: countEvent(/registered$/),
    dailyActiveUsers: activeUsers(24 * 60 * 60 * 1000),
    weeklyActiveUsers: activeUsers(7 * 24 * 60 * 60 * 1000),
    monthlyActiveUsers: activeUsers(30 * 24 * 60 * 60 * 1000),
    activeEmployers: new Set(productLogs.filter((item) => /employer|company|job_posted|job_published|job_closed/.test(item.event || '') && new Date(item.created_at || 0).getTime() >= since30).map((item) => item.actorHash).filter(Boolean)).size,
    activeCandidates: new Set(productLogs.filter((item) => /candidate|job_saved|application/.test(item.event || '')).map((item) => item.actorHash).filter(Boolean)).size,
    weeklyRegistrations: auditLogs.filter((item) => /registered$|product\.(employer_signup|candidate_signup)/.test(item.event || '') && new Date(item.created_at || 0).getTime() >= since7).length,
    jobsPosted: countProductEvent(/job_posted/),
    applicationsSubmitted: applications.length,
    applicationsCompleted: applications.filter((item) => ['offered', 'hired'].includes(item.status)).length,
    failedApplications: auditLogs.filter((item) => /application\.failed|server\.error/.test(item.event || '')).length,
    applicationConversionRate: jobs.length ? Number((applications.length / jobs.length).toFixed(2)) : 0,
    employerActivationRate: employers.length ? Number((companiesWithJobs / employers.length).toFixed(2)) : 0,
    candidateActivationRate: candidates.length ? Number((candidatesWithApplications / candidates.length).toFixed(2)) : 0,
    aiUsage: countProductEvent(/ai_|jd_generated|cv_revised/),
    storageUsage: countProductEvent(/cv_uploaded|file_uploaded/) + auditLogs.filter((item) => item.event === 'file.uploaded').length,
    emailSuccessRate: emailSent + emailFailed ? Number((emailSent / (emailSent + emailFailed)).toFixed(2)) : null,
    emailDelivery: { sent: emailSent, failed: emailFailed },
    aiRequests: { success: auditLogs.filter((item) => /ai\.(jd_generated|cv_revised)/.test(item.event || '') && !item.metadata?.fallback).length, failed: auditLogs.filter((item) => /ai\.fallback/.test(item.event || '')).length },
    uploads: { success: auditLogs.filter((item) => item.event === 'file.uploaded').length, failed: auditLogs.filter((item) => /file\.storage_fallback|upload_failed/.test(item.event || '')).length },
    averageApiLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null,
    errorRate: apiEvents.length ? Number((serverErrors / apiEvents.length).toFixed(4)) : 0,
    systemUptime: serverErrors ? 99 : 100,
    supportTicketsOpen: supportTickets.filter((item) => item.recordType === 'support_ticket' && item.status !== 'closed').length,
    failedLogins: countEvent(/login_failed/),
    failedAiRequests: countEvent(/ai\.fallback/),
    uploadFailures: countEvent(/file\.storage_fallback|upload_failed/),
    emailFailures: countEvent(/email\.failed|email\.fallback/),
    systemHealth: {
      status: countEvent(/server\.error/) ? 'degraded' : 'healthy',
      serverErrors24h: countEvent(/server\.error/),
      checkedAt: new Date().toISOString()
    }
  };
}

async function currentAdmin(request, response) {
  const session = readSession(request);
  if (!session || session.role !== 'admin') {
    response.status(401).json({ error: 'Admin sign in required' });
    return null;
  }
  const admin = await readRecord(`admins/${stableHash(session.email)}.json`);
  if (!admin) {
    response.status(401).json({ error: 'Admin sign in required' });
    return null;
  }
  if (admin.disabled) {
    response.status(403).json({ error: 'This admin account has been disabled' });
    return null;
  }
  if (!admin.emailVerified) {
    response.status(403).json({ error: 'Verify your admin email before accessing the admin dashboard' });
    return null;
  }
  return admin;
}

async function adminPayload() {
  const [accounts, candidates, admins, companyRecords, reviews, salarySignals, supportTickets] = await Promise.all([
    listRecords('accounts/'),
    listRecords('candidates/'),
    listRecords('admins/'),
    listRecords('companies/'),
    listRecords('reviews/'),
    listRecords('salary-signals/'),
    listRecords('support-tickets/')
  ]);
  const jobs = companyRecords.filter((item) => item.recordType === 'job');
  const applications = companyRecords.filter((item) => item.recordType === 'application');
  const profiles = companyRecords.filter((item) => item.recordType === 'company_profile');
  const safeUser = (item) => ({ id: item.id, role: item.role, email: item.email, name: item.name || item.company || '', company: item.company || '', companyId: item.companyId || '', emailVerified: Boolean(item.emailVerified), disabled: Boolean(item.disabled), createdAt: item.createdAt || item.created_at || '' });
  return {
    metrics: await adminMetrics(),
    users: [...accounts, ...candidates, ...admins].map(safeUser),
    employers: accounts.map(safeUser),
    candidates: candidates.map(safeUser),
    admins: admins.map(safeUser),
    companyProfiles: profiles,
    jobs,
    applications,
    reviews: reviews.filter((item) => item.recordType === 'review'),
    salarySignals: salarySignals.filter((item) => item.recordType === 'salary_signal'),
    supportTickets: supportTickets.filter((item) => item.recordType === 'support_ticket').sort((a, b) => b.created_at.localeCompare(a.created_at))
  };
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();

    if (request.method === 'DELETE') {
      clearSessionCookie(response);
      return response.json({ ok: true });
    }

    if (request.method === 'GET') {
      const admin = await currentAdmin(request, response);
      if (!admin) return;
      return response.json({ admin: publicAdmin(admin), ...(await adminPayload()) });
    }

    if (request.method === 'PATCH') {
      const admin = await currentAdmin(request, response);
      if (!admin) return;
      if (!assertSameOrigin(request)) return forbidden(response);
      const { action, role, email = '', id = '', disabled, hidden, status } = request.body || {};
      if (action === 'user-status') {
        const normalizedEmail = clean(email).toLowerCase();
        const prefix = role === 'candidate' ? 'candidates' : role === 'admin' ? 'admins' : 'accounts';
        const path = `${prefix}/${stableHash(normalizedEmail)}.json`;
        const user = await readRecord(path);
        if (!user) return response.status(404).json({ error: 'User not found' });
        await writeRecord(path, { ...user, disabled: Boolean(disabled), updatedAt: new Date().toISOString() }, true);
        await auditLog('admin.user_status_changed', { actorEmail: admin.email, entityType: 'user', entityId: user.id, metadata: { role, disabled: Boolean(disabled) } });
        return response.json({ ok: true });
      }
      if (action === 'review-moderation') {
        const path = `reviews/${id}.json`;
        const review = await readRecord(path);
        if (!review) return response.status(404).json({ error: 'Review not found' });
        await writeRecord(path, { ...review, hidden: Boolean(hidden), moderatedBy: admin.email, updated_at: new Date().toISOString() }, true);
        await auditLog('admin.review_moderated', { actorEmail: admin.email, entityType: 'review', entityId: id, metadata: { hidden: Boolean(hidden) } });
        await productEvent('review_moderated', { actorEmail: admin.email, entityType: 'review', entityId: id, metadata: { hidden: Boolean(hidden) } });
        return response.json({ ok: true });
      }
      if (action === 'job-moderation') {
        if (!['active', 'closed'].includes(status)) return response.status(400).json({ error: 'Invalid job status' });
        const jobs = (await listRecords('companies/')).filter((item) => item.recordType === 'job' && item.id === id);
        if (!jobs.length) return response.status(404).json({ error: 'Job not found' });
        const job = jobs[0];
        await writeRecord(`companies/${job.companyId}/jobs/${job.id}.json`, { ...job, status, moderatedBy: admin.email, updated_at: new Date().toISOString() }, true);
        await auditLog('admin.job_moderated', { actorEmail: admin.email, entityType: 'job', entityId: id, metadata: { status } });
        await productEvent('job_moderated', { actorEmail: admin.email, entityType: 'job', entityId: id, metadata: { status, companyId: job.companyId } });
        return response.json({ ok: true });
      }
      return response.status(400).json({ error: 'Choose a valid admin moderation action' });
    }

    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!assertSameOrigin(request)) return forbidden(response);

    const { action, email = '', password = '', name = '' } = request.body || {};
    const normalizedEmail = clean(email).toLowerCase();
    if (action === 'resend-verification') {
      if (!isQaAdminEmail(normalizedEmail)) return response.status(403).json({ error: 'Use a qa-admin address at crossovertalent.asia' });
      const path = `admins/${stableHash(normalizedEmail)}.json`;
      const admin = await readRecord(path);
      if (!admin) return response.status(404).json({ error: 'Admin account not found' });
      if (admin.emailVerified) return response.json({ ok: true, message: 'Email is already verified' });
      const verificationToken = randomUUID();
      await writeRecord(path, { ...admin, verificationToken, updatedAt: new Date().toISOString() }, true);
      await sendEmail({ to: normalizedEmail, ...verificationEmail('admin', appUrl(`/api/verify?token=${verificationToken}`)) });
      return response.json({ ok: true, message: 'Verification email queued', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
    }
    if (action === 'request-password-reset') {
      if (!isQaAdminEmail(normalizedEmail)) return response.status(403).json({ error: 'Use a qa-admin address at crossovertalent.asia' });
      const path = `admins/${stableHash(normalizedEmail)}.json`;
      const admin = await readRecord(path);
      if (admin) {
        const resetToken = randomUUID();
        await writeRecord(path, { ...admin, resetToken, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() }, true);
        await sendEmail({ to: normalizedEmail, ...passwordResetEmail('admin', appUrl(`/?admin=1&reset=${resetToken}`)) });
        await auditLog('admin.password_reset_requested', { actorEmail: normalizedEmail, entityType: 'admin', entityId: admin.id });
      }
      return response.json({ ok: true, message: 'If an admin account exists, a password reset email has been sent.' });
    }
    if (action === 'reset-password') {
      const { token = '' } = request.body || {};
      if (!token || token.length < 16 || password.length < 12) return response.status(400).json({ error: 'Use a valid reset link and a password of at least 12 characters' });
      const admins = await listRecords('admins/');
      const admin = admins.find((item) => item.resetToken === token && new Date(item.resetTokenExpiresAt || 0).getTime() > Date.now());
      if (!admin) return response.status(404).json({ error: 'Password reset link was not found or has expired' });
      await writeRecord(`admins/${admin.emailHash}.json`, { ...admin, passwordHash: await hashPassword(password), resetToken: '', resetTokenExpiresAt: '', updatedAt: new Date().toISOString() }, true);
      await auditLog('admin.password_reset_completed', { actorEmail: admin.email, entityType: 'admin', entityId: admin.id });
      return response.json({ ok: true, message: 'Password reset complete. You can sign in now.' });
    }
    if (!['register', 'login'].includes(action)) return response.status(400).json({ error: 'Choose a valid admin action' });
    if (!isQaAdminEmail(normalizedEmail)) return response.status(403).json({ error: 'Use a qa-admin address at crossovertalent.asia' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 12) return response.status(400).json({ error: 'Use a valid email and a password of at least 12 characters' });
    if (!(await rateLimit(request, `admin:${normalizedEmail}`, 6, 15 * 60 * 1000))) return tooManyRequests(response);

    const path = `admins/${stableHash(normalizedEmail)}.json`;
    if (action === 'register') {
      if (!allowAdminSelfRegistration()) return response.status(403).json({ error: 'Admin account creation is restricted in production. Ask an existing admin to provision access.' });
      if (clean(name).length < 2) return response.status(400).json({ error: 'Enter the admin name' });
      if (await readRecord(path)) return response.status(409).json({ error: 'An admin account already exists for this email' });
      const verificationToken = randomUUID();
      const admin = { id: randomUUID(), role: 'admin', name: clean(name).slice(0, 120), email: normalizedEmail, emailHash: stableHash(normalizedEmail), emailVerified: false, emailVerifiedAt: '', verificationToken, disabled: false, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
      await writeRecord(path, admin);
      await sendEmail({ to: normalizedEmail, ...verificationEmail('admin', appUrl(`/api/verify?token=${verificationToken}`)) });
      await auditLog('admin.registered', { actorEmail: normalizedEmail, entityType: 'admin', entityId: admin.id });
      return response.status(202).json({ verificationRequired: true, message: 'Check your email to verify your admin account before signing in.', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
    }

    const admin = await readRecord(path);
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      await auditLog('admin.login_failed', { actorEmail: normalizedEmail, entityType: 'admin' });
      return response.status(401).json({ error: 'Incorrect email or password' });
    }
    if (admin.disabled) return response.status(403).json({ error: 'This admin account has been disabled' });
    if (!admin.emailVerified) return response.status(403).json({ error: 'Verify your email before signing in', verificationRequired: true, ...(admin.verificationToken ? verificationLinkPayload(`/api/verify?token=${admin.verificationToken}`) : {}) });
    setSessionCookie(response, createSession(admin));
    await auditLog('admin.login', { actorEmail: admin.email, entityType: 'admin', entityId: admin.id });
    await productEvent('admin_login', { actorEmail: admin.email, entityType: 'admin', entityId: admin.id });
    return response.json({ admin: publicAdmin(admin), ...(await adminPayload()) });
  } catch (error) { return serverError(response, error); }
}
