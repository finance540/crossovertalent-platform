import { randomUUID } from 'node:crypto';
import { IMPACT_SECTORS, assertSameOrigin, auditLog, deleteRecord, ensureStorage, forbidden, listRecords, methodNotAllowed, rateLimit, readRecord, readSession, serverError, setSecurityHeaders, stableHash, tooManyRequests, writeRecord } from './_lib.js';

const LEVELS = ['Associate', 'Manager', 'Senior Manager', 'Director', 'Executive'];

function clean(value = '') {
  return String(value).trim();
}

function groupKey(signal) {
  return [signal.company, signal.role, signal.location, signal.level].map((value) => String(value || '').toLowerCase()).join('|');
}

function publicSignal(signal) {
  const { ownerHash, ...safeSignal } = signal;
  return safeSignal;
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method === 'GET') {
      const signals = (await listRecords('salary-signals/')).filter((item) => item.recordType === 'salary_signal').sort((a, b) => b.created_at.localeCompare(a.created_at));
      const groups = new Map();
      signals.forEach((signal) => {
        const key = groupKey(signal);
        const group = groups.get(key) || { company: signal.company, role: signal.role, location: signal.location, level: signal.level, sector: signal.sector, currency: signal.currency, count: 0, min: 0, max: 0 };
        group.count += 1;
        group.min += Number(signal.salaryMin || 0);
        group.max += Number(signal.salaryMax || 0);
        groups.set(key, group);
      });
      const aggregates = [...groups.values()].map((group) => ({ ...group, averageMin: Math.round(group.min / group.count), averageMax: Math.round(group.max / group.count) }));
      return response.json({ signals: signals.map(publicSignal), aggregates });
    }
    if (request.method === 'POST') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Sign in before submitting a salary signal' });
      if (!(await rateLimit(request, `salary:${session.email || 'anon'}`, 8, 60 * 60 * 1000))) return tooManyRequests(response);
      const { company = '', role = '', location = '', level = '', sector = '', currency = 'USD', salaryMin = '', salaryMax = '', workType = '', note = '' } = request.body || {};
      const min = Number(salaryMin);
      const max = Number(salaryMax);
      if (![company, role, location, level, sector, currency].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required salary fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (!LEVELS.includes(level)) return response.status(400).json({ error: 'Choose a valid level' });
      if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return response.status(400).json({ error: 'Enter a valid salary range' });
      if (company.length > 120 || role.length > 120 || location.length > 120 || currency.length > 8 || workType.length > 40 || note.length > 500) return response.status(400).json({ error: 'One or more fields are too long' });
      const id = randomUUID();
      const signal = {
        recordType: 'salary_signal',
        id,
        company: clean(company),
        role: clean(role),
        location: clean(location),
        level: clean(level),
        sector: clean(sector),
        currency: clean(currency).toUpperCase(),
        salaryMin: min,
        salaryMax: max,
        workType: clean(workType),
        note: clean(note),
        submittedByRole: session.role || 'candidate',
        ownerHash: stableHash(session.email),
        created_at: new Date().toISOString()
      };
      await writeRecord(`salary-signals/${id}.json`, signal);
      await auditLog('salary_signal.created', { actorEmail: session.email, entityType: 'salary_signal', entityId: id, metadata: { company: signal.company, role: signal.role, location: signal.location } });
      return response.status(201).json({ signal: publicSignal(signal) });
    }
    if (request.method === 'DELETE') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Please sign in' });
      const id = request.query.id || request.body?.id;
      const pathname = `salary-signals/${id}.json`;
      const signal = await readRecord(pathname);
      if (!signal) return response.status(404).json({ error: 'Salary signal not found' });
      if (signal.ownerHash !== stableHash(session.email)) return response.status(403).json({ error: 'You can only delete salary signals you created' });
      await deleteRecord(pathname);
      await auditLog('salary_signal.deleted', { actorEmail: session.email, entityType: 'salary_signal', entityId: id });
      return response.json({ ok: true });
    }
    return methodNotAllowed(response);
  } catch (error) { return serverError(response, error); }
}
