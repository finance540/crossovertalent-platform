import { randomUUID } from 'node:crypto';
import { appUrl, assertSameOrigin, auditLog, clearSessionCookie, createSession, ensureStorage, forbidden, hashPassword, listRecords, methodNotAllowed, passwordResetEmail, productEvent, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, setSessionCookie, stableHash, tooManyRequests, verificationEmail, verificationLinkPayload, verifyPassword, writeRecord } from './_lib.js';

function clean(value = '') {
  return String(value).trim();
}

function publicCandidate(candidate) {
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

async function candidateApplications(email) {
  return (await listRecords('companies/'))
    .filter((item) => item.recordType === 'application' && item.email === email)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function currentCandidate(request, response) {
  const session = readSession(request);
  if (!session || session.role !== 'candidate') {
    response.status(401).json({ error: 'Job seeker sign in required' });
    return null;
  }
  const candidate = await readRecord(`candidates/${stableHash(session.email)}.json`);
  if (!candidate) {
    response.status(401).json({ error: 'Job seeker sign in required' });
    return null;
  }
  if (candidate.disabled) {
    response.status(403).json({ error: 'This account has been disabled by an administrator' });
    return null;
  }
  if (!candidate.emailVerified) {
    response.status(403).json({ error: 'Verify your email before accessing your dashboard' });
    return null;
  }
  return candidate;
}

function resumeDraft(input = {}) {
  const resume = clean(input.resume);
  const targetRole = clean(input.targetRole || input.preferences?.idealRole || 'impact role');
  const skills = clean(input.skills || input.preferences?.idealRole || 'impact delivery, stakeholder management, and analytical execution');
  return `Professional summary
Mission-driven candidate targeting ${targetRole}, with strengths in ${skills}.

Selected experience
${resume || 'Add or upload resume details to make this section specific.'}

Recommended improvements
- Lead with quantified outcomes, not only responsibilities.
- Add keywords from the target job title and focus sector.
- Include compensation, location, and role preferences in your profile so matching is more accurate.
- Keep the first page focused on the most relevant achievements.`;
}

function chatReply(message = '', candidate = {}) {
  const prefs = candidate.preferences || {};
  return `Based on your profile, focus on ${prefs.idealRole || 'roles that match your target responsibilities'} in ${prefs.location || 'your preferred locations'}. For stronger matches, keep your resume updated, save relevant jobs, and compare expected compensation (${prefs.expectedCompensation || 'not set yet'}) with each role before applying.`;
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
      const candidate = await currentCandidate(request, response);
      if (!candidate) return;
      const applications = await candidateApplications(candidate.email);
      return response.json({ candidate: publicCandidate(candidate), applications });
    }
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!assertSameOrigin(request)) return forbidden(response);
    const { action, email = '', password = '', token = '', name = '', linkedin = '', jobId = '', preferences = {}, resume = '', targetRole = '', skills = '', message = '' } = request.body || {};
    const normalizedEmail = clean(email).toLowerCase();

    if (action === 'resend-verification') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return response.status(400).json({ error: 'Use a valid email address' });
      const path = `candidates/${stableHash(normalizedEmail)}.json`;
      const candidate = await readRecord(path);
      if (!candidate) return response.status(404).json({ error: 'Job seeker account not found' });
      if (candidate.emailVerified) return response.json({ ok: true, message: 'Email is already verified' });
      const verificationToken = randomUUID();
      await writeRecord(path, { ...candidate, verificationToken, updatedAt: new Date().toISOString() }, true);
      await sendEmail({ to: normalizedEmail, ...verificationEmail('candidate', appUrl(`/api/verify?token=${verificationToken}`)) });
      return response.json({ ok: true, message: 'Verification email queued', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
    }

    if (action === 'request-password-reset') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return response.status(400).json({ error: 'Use a valid email address' });
      const path = `candidates/${stableHash(normalizedEmail)}.json`;
      const candidate = await readRecord(path);
      if (candidate) {
        const resetToken = randomUUID();
        await writeRecord(path, { ...candidate, resetToken, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() }, true);
        await sendEmail({ to: normalizedEmail, ...passwordResetEmail('candidate', appUrl(`/?candidate=login&reset=${resetToken}`)) });
        await auditLog('candidate.password_reset_requested', { actorEmail: normalizedEmail, entityType: 'candidate', entityId: candidate.id });
      }
      return response.json({ ok: true, message: 'If a job seeker account exists, a password reset email has been sent.' });
    }

    if (action === 'reset-password') {
      if (!token || token.length < 16 || password.length < 8) return response.status(400).json({ error: 'Use a valid reset link and a password of at least 8 characters' });
      const candidates = await listRecords('candidates/');
      const candidate = candidates.find((item) => item.resetToken === token && new Date(item.resetTokenExpiresAt || 0).getTime() > Date.now());
      if (!candidate) return response.status(404).json({ error: 'Password reset link was not found or has expired' });
      await writeRecord(`candidates/${candidate.emailHash}.json`, { ...candidate, passwordHash: await hashPassword(password), resetToken: '', resetTokenExpiresAt: '', updatedAt: new Date().toISOString() }, true);
      await auditLog('candidate.password_reset_completed', { actorEmail: candidate.email, entityType: 'candidate', entityId: candidate.id });
      return response.json({ ok: true, message: 'Password reset complete. You can sign in now.' });
    }

    if (['register', 'login'].includes(action)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) return response.status(400).json({ error: 'Use a valid email and a password of at least 8 characters' });
      if (!(await rateLimit(request, `candidate:${normalizedEmail}`, 8, 15 * 60 * 1000))) return tooManyRequests(response);
      const path = `candidates/${stableHash(normalizedEmail)}.json`;
      if (action === 'register') {
        if (clean(name).length < 2) return response.status(400).json({ error: 'Enter your name' });
        if (await readRecord(path)) return response.status(409).json({ error: 'A job seeker account already exists for this email' });
        const verificationToken = randomUUID();
        const candidate = { id: randomUUID(), role: 'candidate', name: clean(name), email: normalizedEmail, emailHash: stableHash(normalizedEmail), emailVerified: false, emailVerifiedAt: '', verificationToken, disabled: false, linkedin: clean(linkedin), passwordHash: await hashPassword(password), savedJobs: [], resume: '', preferences: {}, createdAt: new Date().toISOString() };
        await writeRecord(path, candidate);
        await sendEmail({ to: normalizedEmail, ...verificationEmail('candidate', appUrl(`/api/verify?token=${verificationToken}`)) });
        await auditLog('candidate.registered', { actorEmail: normalizedEmail, entityType: 'candidate', entityId: candidate.id });
        await productEvent('candidate_signup', { actorEmail: normalizedEmail, entityType: 'candidate', entityId: candidate.id });
        return response.status(202).json({ verificationRequired: true, message: 'Check your email to verify your job seeker account before signing in.', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
      }
      const candidate = await readRecord(path);
      if (!candidate || !(await verifyPassword(password, candidate.passwordHash))) {
        await auditLog('candidate.login_failed', { actorEmail: normalizedEmail, entityType: 'candidate' });
        return response.status(401).json({ error: 'Incorrect email or password' });
      }
      if (candidate.disabled) return response.status(403).json({ error: 'This account has been disabled by an administrator' });
      if (!candidate.emailVerified) return response.status(403).json({ error: 'Verify your email before signing in', verificationRequired: true, ...(candidate.verificationToken ? verificationLinkPayload(`/api/verify?token=${candidate.verificationToken}`) : {}) });
      setSessionCookie(response, createSession({ ...candidate, candidateId: candidate.id }));
      await auditLog('candidate.login', { actorEmail: candidate.email, entityType: 'candidate', entityId: candidate.id });
      await productEvent('candidate_login', { actorEmail: candidate.email, entityType: 'candidate', entityId: candidate.id });
      return response.json({ candidate: publicCandidate(candidate), applications: await candidateApplications(candidate.email) });
    }

    const candidate = await currentCandidate(request, response);
    if (!candidate) return;
    const path = `candidates/${stableHash(candidate.email)}.json`;
    if (action === 'save-job' || action === 'unsave-job') {
      const saved = new Set(candidate.savedJobs || []);
      if (action === 'save-job') saved.add(clean(jobId));
      else saved.delete(clean(jobId));
      const updated = { ...candidate, savedJobs: [...saved].filter(Boolean), updatedAt: new Date().toISOString() };
      await writeRecord(path, updated, true);
      await productEvent(action === 'save-job' ? 'job_saved' : 'job_unsaved', { actorEmail: candidate.email, entityType: 'job', entityId: clean(jobId), metadata: { candidateId: candidate.id } });
      return response.json({ candidate: publicCandidate(updated) });
    }
    if (action === 'profile') {
      const updated = {
        ...candidate,
        name: clean(name || candidate.name).slice(0, 120),
        linkedin: clean(linkedin || candidate.linkedin).slice(0, 500),
        resume: clean(resume || candidate.resume).slice(0, 10000),
        preferences: {
          company: clean(preferences.company).slice(0, 160),
          currentCompensation: clean(preferences.currentCompensation).slice(0, 80),
          expectedCompensation: clean(preferences.expectedCompensation).slice(0, 80),
          designation: clean(preferences.designation).slice(0, 120),
          location: clean(preferences.location).slice(0, 120),
          idealRole: clean(preferences.idealRole).slice(0, 160)
        },
        updatedAt: new Date().toISOString()
      };
      await writeRecord(path, updated, true);
      if (resume && resume !== candidate.resume) await productEvent('cv_uploaded', { actorEmail: candidate.email, entityType: 'candidate', entityId: candidate.id, metadata: { source: 'profile_resume_text' } });
      return response.json({ candidate: publicCandidate(updated) });
    }
    if (action === 'ai-resume') return response.json({ resume: resumeDraft({ resume: resume || candidate.resume, targetRole, skills, preferences: candidate.preferences }) });
    if (action === 'ai-chat') return response.json({ reply: chatReply(message, candidate) });
    return response.status(400).json({ error: 'Choose a valid job seeker action' });
  } catch (error) { return serverError(response, error); }
}
