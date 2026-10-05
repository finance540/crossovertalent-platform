import { randomUUID } from 'node:crypto';
import { EMPLOYER_STATUSES, IMPACT_SECTORS, JOB_STATUSES, MODERATION_STATUSES, allowAdminSelfRegistration, appUrl, assertSameOrigin, auditLog, clearSessionCookie, createSession, employerStatus, ensureStorage, forbidden, hashPassword, isPublicJob, jobLifecycleStatus, listRecords, methodNotAllowed, moderationStatus, passwordResetEmail, productEvent, rateLimit, readRecord, readSession, resolveJobExpiry, sendEmail, serverError, setSecurityHeaders, setSessionCookie, stableHash, tooManyRequests, verificationEmail, verificationLinkPayload, verifyPassword, writeRecord } from './_lib.js';
import { notifyPublishedJob } from './_job-alerts.js';

function clean(value = '') {
  return String(value).trim();
}

function publicAdmin(admin) {
  return { id: admin.id, role: 'admin', name: admin.name, email: admin.email };
}

function safeUser(item) {
  return { id: item.id, role: item.role, email: item.email, name: item.name || item.company || '', company: item.company || '', companyId: item.companyId || '', emailVerified: Boolean(item.emailVerified), disabled: Boolean(item.disabled), employer_status: item.role === 'employer' ? employerStatus(item) : '', reviewed_by: item.reviewed_by || '', reviewed_at: item.reviewed_at || '', rejection_reason: item.rejection_reason || '', company_validation_notes: item.company_validation_notes || '', createdAt: item.createdAt || item.created_at || '' };
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
    activeJobs: jobs.filter((job) => jobLifecycleStatus(job) === 'active').length,
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

const CONTENT_TYPES = ['job', 'company', 'review', 'salary'];
const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
const LEVELS = ['Associate', 'Manager', 'Senior Manager', 'Director', 'Executive'];

class ContentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function required(fields, names) {
  const missing = names.filter((name) => !clean(fields[name]));
  if (missing.length) throw new ContentError(`Complete the required fields: ${missing.join(', ')}`);
}

function maxLength(fields, limits) {
  const tooLong = Object.entries(limits).filter(([name, limit]) => clean(fields[name]).length > limit).map(([name]) => name);
  if (tooLong.length) throw new ContentError(`These fields are too long: ${tooLong.join(', ')}`);
}

function validSector(value) {
  if (!IMPACT_SECTORS.includes(clean(value))) throw new ContentError('Choose a valid focus sector');
  return clean(value);
}

function validUrl(value) {
  const url = clean(value);
  if (url && !/^https?:\/\//i.test(url)) throw new ContentError('URLs must start with http:// or https://');
  return url;
}

function sectorList(value) {
  const sectors = (Array.isArray(value) ? value : String(value || '').split(',')).map(clean).filter(Boolean);
  sectors.forEach(validSector);
  return [...new Set(sectors)];
}

async function findJob(id) {
  return (await listRecords('companies/')).find((item) => item.recordType === 'job' && item.id === id) || null;
}

async function contentLocation(type, id) {
  if (type === 'company') return { path: `companies/${id}/profile.json`, record: await readRecord(`companies/${id}/profile.json`) };
  if (type === 'review') return { path: `reviews/${id}.json`, record: await readRecord(`reviews/${id}.json`) };
  if (type === 'salary') return { path: `salary-signals/${id}.json`, record: await readRecord(`salary-signals/${id}.json`) };
  const job = await findJob(id);
  return { path: job ? `companies/${job.companyId}/jobs/${job.id}.json` : '', record: job };
}

async function companyName(companyId) {
  const profile = await readRecord(`companies/${companyId}/profile.json`);
  if (profile?.company) return profile.company;
  const account = (await listRecords('accounts/')).find((item) => item.companyId === companyId);
  return account?.company || '';
}

async function buildContent(type, fields, existing, admin) {
  const now = new Date().toISOString();
  const base = { ...existing, updated_at: now, updatedBy: admin.email };
  if (!existing) Object.assign(base, { created_at: now, createdBy: admin.email, source: 'admin' });
  if (type === 'company') {
    required(fields, ['company', 'mission']);
    maxLength(fields, { company: 120, website: 300, location: 120, mission: 600, description: 2000 });
    const sectors = sectorList(fields.sectors);
    return { ...base, recordType: 'company_profile', companyId: existing?.companyId || `co-${randomUUID()}`, company: clean(fields.company), sector: sectors[0] || '', sectors, website: validUrl(fields.website), location: clean(fields.location), mission: clean(fields.mission), description: clean(fields.description), logo: existing?.logo || null };
  }
  if (type === 'job') {
    if (existing) fields = { ...fields, companyId: existing.companyId };
    required(fields, ['companyId', 'title', 'department', 'location', 'type', 'sector', 'experience', 'description']);
    maxLength(fields, { title: 160, department: 120, location: 120, salary: 120, impactArea: 200, description: 8000 });
    if (!JOB_TYPES.includes(clean(fields.type))) throw new ContentError('Choose a valid work type');
    if (!LEVELS.includes(clean(fields.experience))) throw new ContentError('Choose a valid experience level');
    const status = clean(fields.status) || existing?.status || 'active';
    if (!JOB_STATUSES.includes(status)) throw new ContentError('Choose a valid job status');
    const expiry = resolveJobExpiry(fields.expiresAt, existing?.expires_at);
    if (expiry.error) throw new ContentError(expiry.error);
    const publishedAt = status === 'active' ? (existing?.status === 'active' && existing.published_at ? existing.published_at : now) : existing?.published_at || '';
    const companyId = clean(fields.companyId);
    const company = await companyName(companyId);
    if (!company) throw new ContentError('Choose an existing company for this job');
    return { ...base, recordType: 'job', schemaVersion: 2, id: existing?.id || randomUUID(), companyId, company, title: clean(fields.title), department: clean(fields.department), location: clean(fields.location), type: clean(fields.type), salary: clean(fields.salary), sector: validSector(fields.sector), experience: clean(fields.experience), impactArea: clean(fields.impactArea), description: clean(fields.description), status, expires_at: expiry.expires_at, published_at: publishedAt };
  }
  if (type === 'review') {
    required(fields, ['company', 'sector', 'role', 'location', 'rating', 'headline', 'pros', 'cons']);
    maxLength(fields, { company: 120, companyUrl: 500, role: 120, location: 120, salary: 120, headline: 180, pros: 1200, cons: 1200, advice: 1200 });
    const rating = Number(fields.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ContentError('Choose a rating from 1 to 5');
    return { ...base, recordType: 'review', id: existing?.id || randomUUID(), company: clean(fields.company), companyUrl: validUrl(fields.companyUrl), sector: validSector(fields.sector), role: clean(fields.role), location: clean(fields.location), rating, salary: clean(fields.salary), headline: clean(fields.headline), pros: clean(fields.pros), cons: clean(fields.cons), advice: clean(fields.advice), reviewer: existing?.reviewer || { displayMode: 'anonymous', label: 'Crossover Talent editorial', linkedin: '', verifiedDomain: '' }, ownerHash: existing?.ownerHash || stableHash(admin.email) };
  }
  required(fields, ['company', 'role', 'location', 'level', 'sector', 'currency', 'salaryMin', 'salaryMax']);
  maxLength(fields, { company: 120, role: 120, location: 120, currency: 8, workType: 40, note: 500 });
  if (!LEVELS.includes(clean(fields.level))) throw new ContentError('Choose a valid level');
  const salaryMin = Number(fields.salaryMin);
  const salaryMax = Number(fields.salaryMax);
  if (!Number.isFinite(salaryMin) || !Number.isFinite(salaryMax) || salaryMin <= 0 || salaryMax < salaryMin) throw new ContentError('Enter a valid salary range');
  return { ...base, recordType: 'salary_signal', id: existing?.id || randomUUID(), company: clean(fields.company), role: clean(fields.role), location: clean(fields.location), level: clean(fields.level), sector: validSector(fields.sector), currency: clean(fields.currency).toUpperCase(), salaryMin, salaryMax, workType: clean(fields.workType), note: clean(fields.note), submittedByRole: existing?.submittedByRole || 'admin', ownerHash: existing?.ownerHash || stableHash(admin.email) };
}

function recordId(type, record) {
  return type === 'company' ? record.companyId : record.id;
}

function recordPath(type, record) {
  if (type === 'company') return `companies/${record.companyId}/profile.json`;
  if (type === 'job') return `companies/${record.companyId}/jobs/${record.id}.json`;
  if (type === 'review') return `reviews/${record.id}.json`;
  return `salary-signals/${record.id}.json`;
}

async function saveContent(admin, { type, id = '', fields = {}, moderation_status: requestedStatus = '' }) {
  if (!CONTENT_TYPES.includes(type)) throw new ContentError('Choose a valid content type');
  if (requestedStatus && !MODERATION_STATUSES.includes(requestedStatus)) throw new ContentError('Choose approved, pending, or rejected');
  const existing = id ? (await contentLocation(type, clean(id))).record : null;
  if (id && !existing) throw new ContentError('Content not found', 404);
  const record = await buildContent(type, fields || {}, existing, admin);
  record.moderation_status = requestedStatus || (existing ? moderationStatus(existing) : 'pending');
  await writeRecord(recordPath(type, record), record, true);
  if (type === 'job' && !isPublicJob(existing) && isPublicJob(record)) await notifyPublishedJob(record).catch((error) => console.error('job_alert_dispatch_failed', error.message));
  await auditLog(existing ? 'admin.content_updated' : 'admin.content_created', { actorEmail: admin.email, entityType: type, entityId: recordId(type, record), metadata: { moderation_status: record.moderation_status } });
  return record;
}

async function moderateContent(admin, { type, id = '', moderation_status: status = '' }) {
  if (!CONTENT_TYPES.includes(type)) throw new ContentError('Choose a valid content type');
  if (!MODERATION_STATUSES.includes(status)) throw new ContentError('Choose approved, pending, or rejected');
  const { path, record } = await contentLocation(type, clean(id));
  if (!record) throw new ContentError('Content not found', 404);
  const updated = { ...record, moderation_status: status, moderatedBy: admin.email, moderated_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  await writeRecord(path, updated, true);
  if (type === 'job' && !isPublicJob(record) && isPublicJob(updated)) await notifyPublishedJob(updated).catch((error) => console.error('job_alert_dispatch_failed', error.message));
  await auditLog('admin.content_moderated', { actorEmail: admin.email, entityType: type, entityId: clean(id), metadata: { moderation_status: status } });
  await productEvent('content_moderated', { actorEmail: admin.email, entityType: type, entityId: clean(id), metadata: { moderation_status: status } });
  return updated;
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
      if (action === 'employer-approval') {
        const normalizedEmail = clean(email).toLowerCase();
        if (!EMPLOYER_STATUSES.includes(status)) return response.status(400).json({ error: 'Choose a valid employer status' });
        const path = `accounts/${stableHash(normalizedEmail)}.json`;
        const employer = await readRecord(path);
        if (!employer) return response.status(404).json({ error: 'Employer account not found' });
        if (employer.role !== 'employer') return response.status(400).json({ error: 'Only employer accounts can be reviewed' });
        const rejectionReason = clean(request.body?.rejection_reason || request.body?.rejectionReason || '').slice(0, 500);
        const validationNotes = clean(request.body?.company_validation_notes || request.body?.companyValidationNotes || '').slice(0, 1000);
        if (status === 'rejected' && rejectionReason.length < 3) return response.status(400).json({ error: 'Add a rejection reason before rejecting an employer' });
        const updated = {
          ...employer,
          employer_status: status,
          reviewed_by: admin.email,
          reviewed_at: new Date().toISOString(),
          rejection_reason: status === 'rejected' ? rejectionReason : '',
          company_validation_notes: validationNotes || employer.company_validation_notes || '',
          updatedAt: new Date().toISOString()
        };
        await writeRecord(path, updated, true);
        await auditLog('admin.employer_reviewed', { actorEmail: admin.email, entityType: 'account', entityId: employer.id, metadata: { employerEmail: normalizedEmail, status } });
        await productEvent('employer_reviewed', { actorEmail: admin.email, entityType: 'account', entityId: employer.id, metadata: { employerEmail: normalizedEmail, status } });
        return response.json({ ok: true, employer: safeUser(updated) });
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
        const updated = { ...job, status, moderatedBy: admin.email, updated_at: new Date().toISOString() };
        await writeRecord(`companies/${job.companyId}/jobs/${job.id}.json`, updated, true);
        if (!isPublicJob(job) && isPublicJob(updated)) await notifyPublishedJob(updated).catch((error) => console.error('job_alert_dispatch_failed', error.message));
        await auditLog('admin.job_moderated', { actorEmail: admin.email, entityType: 'job', entityId: id, metadata: { status } });
        await productEvent('job_moderated', { actorEmail: admin.email, entityType: 'job', entityId: id, metadata: { status, companyId: job.companyId } });
        return response.json({ ok: true });
      }
      if (action === 'content-save' || action === 'content-moderate') {
        try {
          const record = action === 'content-save' ? await saveContent(admin, request.body) : await moderateContent(admin, request.body);
          return response.json({ ok: true, record });
        } catch (error) {
          if (error instanceof ContentError) return response.status(error.status).json({ error: error.message });
          throw error;
        }
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
