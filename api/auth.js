import { randomUUID } from 'node:crypto';
import { appUrl, assertSameOrigin, auditLog, clearSessionCookie, createSession, employerStatus, employerStatusMessage, ensureStorage, forbidden, hashPassword, listRecords, methodNotAllowed, passwordResetEmail, productEvent, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, setSessionCookie, stableHash, tooManyRequests, verificationEmail, verificationLinkPayload, verifyPassword, writeRecord } from './_lib.js';

function publicEmployer(account) {
  const status = employerStatus(account);
  return { id: account.id, role: 'employer', companyId: account.companyId, email: account.email, company: account.company, employer_status: status, reviewed_at: account.reviewed_at || '', rejection_reason: account.rejection_reason || '', company_validation_notes: account.company_validation_notes || '' };
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method === 'GET') {
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Not signed in' });
      const account = await readRecord(`accounts/${stableHash(session.email)}.json`);
      if (!account) return response.status(401).json({ error: 'Not signed in' });
      if (account.disabled) return response.status(403).json({ error: 'This account has been disabled by an administrator' });
      const status = employerStatus(account);
      if (status !== 'approved') return response.status(403).json({ error: employerStatusMessage(account), employer_status: status, user: publicEmployer(account) });
      return response.json({ user: publicEmployer(account) });
    }
    if (request.method === 'DELETE') {
      clearSessionCookie(response);
      return response.json({ ok: true });
    }
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!assertSameOrigin(request)) return forbidden(response);

    const { action, company = '', email = '', password = '', token = '' } = request.body || {};
    const normalizedEmail = email.trim().toLowerCase();
    if (action === 'resend-verification') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return response.status(400).json({ error: 'Use a valid email address' });
      const account = await readRecord(`accounts/${stableHash(normalizedEmail)}.json`);
      if (!account) return response.status(404).json({ error: 'Employer account not found' });
      if (account.emailVerified) return response.json({ ok: true, message: 'Email is already verified' });
      const verificationToken = randomUUID();
      await writeRecord(`accounts/${stableHash(normalizedEmail)}.json`, { ...account, verificationToken, updatedAt: new Date().toISOString() }, true);
      const verificationUrl = appUrl(`/api/verify?token=${verificationToken}`);
      await sendEmail({ to: normalizedEmail, ...verificationEmail('employer', verificationUrl) });
      return response.json({ ok: true, message: 'Verification email queued', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
    }
    if (action === 'request-password-reset') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return response.status(400).json({ error: 'Use a valid email address' });
      const account = await readRecord(`accounts/${stableHash(normalizedEmail)}.json`);
      if (account) {
        const resetToken = randomUUID();
        await writeRecord(`accounts/${stableHash(normalizedEmail)}.json`, { ...account, resetToken, resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString() }, true);
        await sendEmail({ to: normalizedEmail, ...passwordResetEmail('employer', appUrl(`/?login=1&reset=${resetToken}`)) });
        await auditLog('auth.password_reset_requested', { actorEmail: normalizedEmail, entityType: 'account', entityId: account.id });
      }
      return response.json({ ok: true, message: 'If an employer account exists, a password reset email has been sent.' });
    }
    if (action === 'reset-password') {
      if (!token || token.length < 16 || password.length < 8) return response.status(400).json({ error: 'Use a valid reset link and a password of at least 8 characters' });
      const accounts = await listRecords('accounts/');
      const account = accounts.find((item) => item.resetToken === token && new Date(item.resetTokenExpiresAt || 0).getTime() > Date.now());
      if (!account) return response.status(404).json({ error: 'Password reset link was not found or has expired' });
      await writeRecord(`accounts/${account.emailHash}.json`, { ...account, passwordHash: await hashPassword(password), resetToken: '', resetTokenExpiresAt: '', updatedAt: new Date().toISOString() }, true);
      await auditLog('auth.password_reset_completed', { actorEmail: account.email, entityType: 'account', entityId: account.id });
      return response.json({ ok: true, message: 'Password reset complete. You can sign in now.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || password.length < 8) return response.status(400).json({ error: 'Use a valid email and a password of at least 8 characters' });
    if (normalizedEmail.length > 254 || password.length > 200 || company.length > 120) return response.status(400).json({ error: 'One or more fields are too long' });
    if (!(await rateLimit(request, `auth:${normalizedEmail}`, 8, 15 * 60 * 1000))) return tooManyRequests(response);
    const accountPath = `accounts/${stableHash(normalizedEmail)}.json`;

    if (action === 'register') {
      if (company.trim().length < 2) return response.status(400).json({ error: 'Enter your company name' });
      if (await readRecord(accountPath)) return response.status(409).json({ error: 'An account with this email already exists' });
      const emailHash = stableHash(normalizedEmail);
      const verificationToken = randomUUID();
      const account = { id: randomUUID(), role: 'employer', companyId: randomUUID(), company: company.trim(), email: normalizedEmail, emailHash, emailVerified: false, emailVerifiedAt: '', verificationToken, disabled: false, employer_status: 'pending_review', reviewed_by: '', reviewed_at: '', rejection_reason: '', company_validation_notes: '', passwordHash: await hashPassword(password), createdAt: new Date().toISOString() };
      try {
        await writeRecord(accountPath, account);
      } catch (error) {
        if (String(error.message).toLowerCase().includes('exist')) return response.status(409).json({ error: 'An account with this email already exists' });
        throw error;
      }
      const verificationUrl = appUrl(`/api/verify?token=${verificationToken}`);
      await sendEmail({ to: normalizedEmail, ...verificationEmail('employer', verificationUrl) });
      await auditLog('auth.registered', { actorEmail: normalizedEmail, entityType: 'account', entityId: account.id });
      await productEvent('employer_signup', { actorEmail: normalizedEmail, entityType: 'account', entityId: account.id, metadata: { companyId: account.companyId } });
      return response.status(202).json({ verificationRequired: true, employer_status: 'pending_review', message: 'Check your email to verify your employer account. Your company will then be reviewed before dashboard access is enabled.', ...verificationLinkPayload(`/api/verify?token=${verificationToken}`) });
    }

    const account = await readRecord(accountPath);
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      await auditLog('auth.login_failed', { actorEmail: normalizedEmail, entityType: 'account' });
      return response.status(401).json({ error: 'Incorrect email or password' });
    }
    if (account.disabled) return response.status(403).json({ error: 'This account has been disabled by an administrator' });
    if (!account.emailVerified) return response.status(403).json({ error: 'Verify your email before signing in', verificationRequired: true, ...(account.verificationToken ? verificationLinkPayload(`/api/verify?token=${account.verificationToken}`) : {}) });
    const status = employerStatus(account);
    if (status !== 'approved') return response.status(403).json({ error: employerStatusMessage(account), employer_status: status, user: publicEmployer(account) });
    const approvedAccount = { ...account, employer_status: status };
    setSessionCookie(response, createSession(approvedAccount));
    await auditLog('auth.login', { actorEmail: account.email, entityType: 'account', entityId: account.id });
    await productEvent('employer_login', { actorEmail: account.email, entityType: 'account', entityId: account.id, metadata: { companyId: account.companyId, employer_status: status } });
    return response.json({ user: publicEmployer(approvedAccount) });
  } catch (error) { return serverError(response, error); }
}
