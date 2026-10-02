import { randomUUID } from 'node:crypto';
import { IMPACT_SECTORS, assertSameOrigin, deleteRecord, ensureStorage, forbidden, hiddenEmployerCompanyIds, isJobExpired, isPublicJob, jobPublishedAt, listRecords, methodNotAllowed, productEvent, rateLimit, readRecord, requireApprovedEmployerSession, resolveJobExpiry, serverError, setSecurityHeaders, tooManyRequests, writeRecord } from './_lib.js';
import { createJobCheckoutSession } from './payments.js';

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method === 'GET' && request.query.public === '1') {
      const [records, accounts] = await Promise.all([listRecords('companies/'), listRecords('accounts/')]);
      const hiddenCompanyIds = hiddenEmployerCompanyIds(accounts);
      const jobs = records.filter((item) => isPublicJob(item) && !hiddenCompanyIds.has(item.companyId) && (!request.query.company || item.companyId === request.query.company)).sort((a, b) => jobPublishedAt(b).localeCompare(jobPublishedAt(a)));
      return response.json({ jobs });
    }
    const session = await requireApprovedEmployerSession(request, response);
    if (!session) return;
    if (request.method !== 'GET' && !assertSameOrigin(request)) return forbidden(response);
    if (request.method !== 'GET' && !(await rateLimit(request, `jobs:${session.companyId}`, 60, 60 * 1000))) return tooManyRequests(response);
    const jobPrefix = `companies/${session.companyId}/jobs/`;
    if (request.method === 'GET') {
      const [jobs, applications] = await Promise.all([listRecords(jobPrefix), listRecords(`companies/${session.companyId}/applications/`)]);
      const counts = applications.reduce((result, item) => ({ ...result, [item.job_id]: (result[item.job_id] || 0) + 1 }), {});
      return response.json({ jobs: jobs.sort((a, b) => b.created_at.localeCompare(a.created_at)).map((job) => ({ ...job, application_count: counts[job.id] || 0 })) });
    }
    if (request.method === 'POST') {
      const { title = '', department = '', location = '', type = '', salary = '', sector = 'Climate', experience = 'Manager', impactArea = '', description = '', sourceAttachment = null, sourceText = '', aiInputs = null, status = 'active', expiresAt = '' } = request.body || {};
      if (![title, department, location, type, description].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (title.length > 120 || department.length > 80 || location.length > 120 || salary.length > 80 || sector.length > 80 || experience.length > 80 || impactArea.length > 160 || description.length > 8000 || sourceText.length > 8000) return response.status(400).json({ error: 'One or more fields are too long' });
      if (!['active', 'draft'].includes(status)) return response.status(400).json({ error: 'New jobs can be published or saved as a draft' });
      const expiry = resolveJobExpiry(expiresAt);
      if (expiry.error) return response.status(400).json({ error: expiry.error });
      const now = new Date().toISOString();
      const job = { recordType: 'job', schemaVersion: 2, id: randomUUID(), companyId: session.companyId, company: session.company, title: title.trim(), department: department.trim(), location: location.trim(), type: type.trim(), salary: salary.trim(), sector: sector.trim(), experience: experience.trim(), impactArea: impactArea.trim(), description: description.trim(), sourceAttachment, sourceText: sourceText.trim(), aiInputs, status: status === 'active' ? 'draft' : status, payment_status: 'unpaid', stripe_checkout_session_id: '', stripe_payment_id: '', expires_at: expiry.expires_at, published_at: '', created_at: now };
      await writeRecord(`${jobPrefix}${job.id}.json`, job);
      await productEvent('job_posted', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, sector: job.sector, location: job.location, status: job.status } });
      if (status === 'active' && process.env.STRIPE_SECRET_KEY) {
        const checkout = await createJobCheckoutSession(job, session);
        const pending = { ...job, payment_status: 'pending', stripe_checkout_session_id: checkout.id };
        await writeRecord(`${jobPrefix}${job.id}.json`, pending, true);
        return response.status(201).json({ job: pending, checkoutUrl: checkout.url, paymentRequired: true });
      }
      const published = status === 'active' ? { ...job, status: 'active', payment_status: 'paid', published_at: now } : job;
      if (status === 'active') {
        await writeRecord(`${jobPrefix}${job.id}.json`, published, true);
        await productEvent('job_published', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, sector: job.sector, location: job.location } });
      }
      return response.status(201).json({ job: published });
    }
    if (request.method === 'PATCH') {
      const { id, status, title, department, location, type, salary = '', sector = 'Climate', experience = 'Manager', impactArea = '', description, sourceAttachment = null, sourceText = '', aiInputs = null, expiresAt = '' } = request.body || {};
      const pathname = `${jobPrefix}${id}.json`;
      const job = await readRecord(pathname);
      if (!job) return response.status(404).json({ error: 'Job not found' });
      if (status) {
        if (!['draft', 'active', 'closed'].includes(status)) return response.status(400).json({ error: 'Invalid job status' });
        if (status === 'active' && process.env.STRIPE_SECRET_KEY && job.payment_status !== 'paid') {
          const checkout = await createJobCheckoutSession(job, session);
          const pending = { ...job, status: 'draft', payment_status: 'pending', stripe_checkout_session_id: checkout.id, updated_at: new Date().toISOString() };
          await writeRecord(pathname, pending, true);
          return response.json({ job: pending, checkoutUrl: checkout.url, paymentRequired: true });
        }
        const now = new Date().toISOString();
        const publishing = status === 'active' ? { published_at: job.status === 'active' && job.published_at ? job.published_at : now, expires_at: isJobExpired(job) ? '' : job.expires_at || '' } : {};
        await writeRecord(pathname, { ...job, status, ...publishing, updated_at: now }, true);
        await productEvent(status === 'active' ? 'job_published' : 'job_closed', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, previousStatus: job.status, status } });
        return response.json({ ok: true });
      }
      if (![title, department, location, type, description].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (title.length > 120 || department.length > 80 || location.length > 120 || salary.length > 80 || sector.length > 80 || experience.length > 80 || impactArea.length > 160 || description.length > 8000 || sourceText.length > 8000) return response.status(400).json({ error: 'One or more fields are too long' });
      const expiry = resolveJobExpiry(expiresAt, job.expires_at);
      if (expiry.error) return response.status(400).json({ error: expiry.error });
      const updated = { ...job, schemaVersion: 2, expires_at: expiry.expires_at, title: title.trim(), department: department.trim(), location: location.trim(), type: type.trim(), salary: salary.trim(), sector: sector.trim(), experience: experience.trim(), impactArea: impactArea.trim(), description: description.trim(), sourceAttachment, sourceText: sourceText.trim(), aiInputs, updated_at: new Date().toISOString() };
      await writeRecord(pathname, updated, true);
      return response.json({ job: updated });
    }
    if (request.method === 'DELETE') {
      const id = request.query.id || request.body?.id;
      const pathname = `${jobPrefix}${id}.json`;
      if (!(await readRecord(pathname))) return response.status(404).json({ error: 'Job not found' });
      await deleteRecord(pathname);
      return response.json({ ok: true });
    }
    return methodNotAllowed(response);
  } catch (error) { return serverError(response, error); }
}
