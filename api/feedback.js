import { randomUUID } from 'node:crypto';
import { appUrl, assertSameOrigin, auditLog, ensureStorage, forbidden, listRecords, methodNotAllowed, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, stableHash, tooManyRequests, writeRecord } from './_lib.js';

const TYPES = ['feedback', 'bug', 'support', 'feature'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function clean(value = '', max = 1000) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
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

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
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
    const ticketType = TYPES.includes(type) ? type : 'feedback';
    const ticketPriority = PRIORITIES.includes(priority) ? priority : 'normal';
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
  } catch (error) {
    return serverError(response, error);
  }
}
