import { appUrl, assertSameOrigin, auditLog, ensureStorage, forbidden, listRecords, methodNotAllowed, productEvent, rateLimit, readRecord, readSession, requireApprovedEmployerSession, requireSession, sendEmail, serverError, setSecurityHeaders, stableHash, tooManyRequests, writeRecord } from './_lib.js';

function clean(value = '') {
  return String(value).trim();
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method === 'POST') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const { jobId, name = '', email = '', phone = '', location = '', linkedin = '', coverLetter = '', cvAttachment = null, cvText = '', revisedCv = '', linkedinNote = '' } = request.body || {};
      const session = readSession(request);
      const candidateSession = session?.role === 'candidate' ? session : null;
      const applicantName = clean(name || candidateSession?.name);
      const applicantEmail = clean(candidateSession?.email || email).toLowerCase();
      if (![applicantName, applicantEmail, coverLetter].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) return response.status(400).json({ error: 'Enter a valid email address' });
      if (applicantName.length > 120 || applicantEmail.length > 254 || phone.length > 60 || location.length > 120 || linkedin.length > 500 || coverLetter.length > 5000 || cvText.length > 8000 || revisedCv.length > 8000 || linkedinNote.length > 500) return response.status(400).json({ error: 'One or more fields are too long' });
      if (linkedin && !/^https?:\/\//i.test(linkedin.trim())) return response.status(400).json({ error: 'Portfolio link must start with http:// or https://' });
      if (!(await rateLimit(request, `apply:${jobId || 'missing'}`, 10, 60 * 60 * 1000))) return tooManyRequests(response);
      const jobs = (await listRecords('companies/')).filter((item) => item.recordType === 'job' && item.id === jobId && item.status === 'active');
      if (!jobs.length) return response.status(404).json({ error: 'This role is no longer accepting applications' });
      const job = jobs[0];
      const applicationId = stableHash(`${job.id}:${applicantEmail}`).slice(0, 32);
      const pathname = `companies/${job.companyId}/applications/${applicationId}.json`;
      if (await readRecord(pathname)) return response.status(409).json({ error: 'You have already applied for this role' });
      const application = { recordType: 'application', id: applicationId, job_id: job.id, companyId: job.companyId, job_title: job.title, name: applicantName, email: applicantEmail, phone: phone.trim(), location: location.trim(), linkedin: linkedin.trim(), linkedin_note: linkedinNote.trim(), cover_letter: coverLetter.trim(), cvAttachment, cv_text: cvText.trim(), revised_cv: revisedCv.trim(), status: 'applied', created_at: new Date().toISOString() };
      await writeRecord(pathname, application);
      const profile = await readRecord(`companies/${job.companyId}/profile.json`).catch(() => null);
      await Promise.all([
        sendEmail({
          to: application.email,
          subject: `Application received: ${job.title}`,
          html: `<p>Your application for <strong>${job.title}</strong> at ${job.company} has been received.</p><p>You can track status from your Crossover Talent candidate dashboard.</p>`
        }),
        profile?.ownerEmail ? sendEmail({
          to: profile.ownerEmail,
          subject: `New application for ${job.title}`,
          html: `<p>${application.name} applied for <strong>${job.title}</strong>.</p><p><a href="${appUrl('/?dashboard=1')}">Open employer dashboard</a></p>`
        }) : Promise.resolve({ ok: false, skipped: true })
      ]);
      await auditLog('application.submitted', { actorEmail: application.email, entityType: 'application', entityId: application.id, metadata: { jobId: job.id, companyId: job.companyId } });
      await productEvent('application_submitted', { actorEmail: application.email, entityType: 'application', entityId: application.id, metadata: { jobId: job.id, companyId: job.companyId, sector: job.sector } });
      return response.status(201).json({ ok: true });
    }
    const session = requireSession(request, response);
    if (!session) return;
    if (request.method !== 'GET' && !assertSameOrigin(request)) return forbidden(response);
    if (request.method === 'PATCH' && session.role === 'candidate') {
      const { id, action } = request.body || {};
      if (action !== 'withdraw') return response.status(400).json({ error: 'Choose a valid application action' });
      const applications = (await listRecords('companies/')).filter((item) => item.recordType === 'application' && item.id === id && item.email === session.email);
      if (!applications.length) return response.status(404).json({ error: 'Application not found' });
      const application = applications[0];
      if (['offered', 'hired', 'offer'].includes(application.status)) return response.status(409).json({ error: 'Applications at Offered or Hired stage cannot be withdrawn online. Contact the employer.' });
      await writeRecord(`companies/${application.companyId}/applications/${application.id}.json`, { ...application, status: 'withdrawn', withdrawn_at: new Date().toISOString() }, true);
      await auditLog('application.withdrawn', { actorEmail: session.email, entityType: 'application', entityId: application.id });
      await productEvent('application_withdrawn', { actorEmail: session.email, entityType: 'application', entityId: application.id, metadata: { jobId: application.job_id, companyId: application.companyId } });
      return response.json({ ok: true });
    }
    const employerSession = await requireApprovedEmployerSession(request, response);
    if (!employerSession) return;
    const prefix = `companies/${employerSession.companyId}/applications/`;
    if (request.method === 'GET') {
      const applications = (await listRecords(prefix)).sort((a, b) => b.created_at.localeCompare(a.created_at));
      return response.json({ applications });
    }
    if (request.method === 'PATCH') {
      const { id, status } = request.body || {};
      if (!['applied', 'shortlisted', 'interview', 'offered', 'rejected', 'hired', 'withdrawn', 'new', 'review', 'offer'].includes(status)) return response.status(400).json({ error: 'Invalid application status' });
      const pathname = `${prefix}${id}.json`;
      const application = await readRecord(pathname);
      if (!application) return response.status(404).json({ error: 'Application not found' });
      await writeRecord(pathname, { ...application, status }, true);
      await sendEmail({
        to: application.email,
        subject: `Application status updated: ${application.job_title}`,
        html: `<p>Your application for <strong>${application.job_title}</strong> has moved to <strong>${status}</strong>.</p><p><a href="${appUrl('/?candidate=dashboard')}">Open candidate dashboard</a></p>`
      });
      await auditLog('application.status_updated', { actorEmail: employerSession.email, entityType: 'application', entityId: application.id, metadata: { status } });
      return response.json({ ok: true });
    }
    return methodNotAllowed(response);
  } catch (error) { return serverError(response, error); }
}
