import { randomUUID } from 'node:crypto';
import { IMPACT_SECTORS, assertSameOrigin, deleteRecord, ensureStorage, forbidden, listRecords, methodNotAllowed, productEvent, rateLimit, readRecord, requireApprovedEmployerSession, serverError, setSecurityHeaders, tooManyRequests, writeRecord } from './_lib.js';

function isProductionSmokeJob(job = {}) {
  return /^Prod Smoke/i.test(String(job.title || '')) || /^Prod Smoke/i.test(String(job.company || ''));
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method === 'GET' && request.query.public === '1') {
      const jobs = (await listRecords('companies/')).filter((item) => item.recordType === 'job' && item.schemaVersion >= 2 && item.status === 'active' && !isProductionSmokeJob(item) && (!request.query.company || item.companyId === request.query.company)).sort((a, b) => b.created_at.localeCompare(a.created_at));
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
      const { title = '', department = '', location = '', type = '', salary = '', sector = 'Climate', experience = 'Manager', impactArea = '', description = '', sourceAttachment = null, sourceText = '', aiInputs = null } = request.body || {};
      if (![title, department, location, type, description].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (title.length > 120 || department.length > 80 || location.length > 120 || salary.length > 80 || sector.length > 80 || experience.length > 80 || impactArea.length > 160 || description.length > 8000 || sourceText.length > 8000) return response.status(400).json({ error: 'One or more fields are too long' });
      const job = { recordType: 'job', schemaVersion: 2, id: randomUUID(), companyId: session.companyId, company: session.company, title: title.trim(), department: department.trim(), location: location.trim(), type: type.trim(), salary: salary.trim(), sector: sector.trim(), experience: experience.trim(), impactArea: impactArea.trim(), description: description.trim(), sourceAttachment, sourceText: sourceText.trim(), aiInputs, status: 'active', created_at: new Date().toISOString() };
      await writeRecord(`${jobPrefix}${job.id}.json`, job);
      await productEvent('job_posted', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, sector: job.sector, location: job.location, status: job.status } });
      await productEvent('job_published', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, sector: job.sector, location: job.location } });
      return response.status(201).json({ job });
    }
    if (request.method === 'PATCH') {
      const { id, status, title, department, location, type, salary = '', sector = 'Climate', experience = 'Manager', impactArea = '', description, sourceAttachment = null, sourceText = '', aiInputs = null } = request.body || {};
      const pathname = `${jobPrefix}${id}.json`;
      const job = await readRecord(pathname);
      if (!job) return response.status(404).json({ error: 'Job not found' });
      if (status) {
        if (!['active', 'closed'].includes(status)) return response.status(400).json({ error: 'Invalid job status' });
        await writeRecord(pathname, { ...job, status, updated_at: new Date().toISOString() }, true);
        await productEvent(status === 'active' ? 'job_published' : 'job_closed', { actorEmail: session.email, entityType: 'job', entityId: job.id, metadata: { companyId: session.companyId, previousStatus: job.status, status } });
        return response.json({ ok: true });
      }
      if (![title, department, location, type, description].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (title.length > 120 || department.length > 80 || location.length > 120 || salary.length > 80 || sector.length > 80 || experience.length > 80 || impactArea.length > 160 || description.length > 8000 || sourceText.length > 8000) return response.status(400).json({ error: 'One or more fields are too long' });
      const updated = { ...job, schemaVersion: 2, title: title.trim(), department: department.trim(), location: location.trim(), type: type.trim(), salary: salary.trim(), sector: sector.trim(), experience: experience.trim(), impactArea: impactArea.trim(), description: description.trim(), sourceAttachment, sourceText: sourceText.trim(), aiInputs, updated_at: new Date().toISOString() };
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
