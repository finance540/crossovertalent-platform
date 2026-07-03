import { auditLog, ensureStorage, listRecords, methodNotAllowed, readRecord, serverError, setSecurityHeaders, writeRecord } from './_lib.js';

const SOURCES = [
  { prefix: 'accounts/', label: 'employer' },
  { prefix: 'candidates/', label: 'candidate' },
  { prefix: 'admins/', label: 'admin' }
];

function publicMessage(role) {
  return `${role === 'employer' ? 'Employer' : role === 'admin' ? 'Admin' : 'Job seeker'} email verified. You can now sign in.`;
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method !== 'GET') return methodNotAllowed(response);
    const token = String(request.query.token || '').trim();
    if (!token || token.length < 16) return response.status(400).json({ error: 'Invalid verification link' });
    for (const source of SOURCES) {
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
  } catch (error) { return serverError(response, error); }
}
