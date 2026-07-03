import { assertSameOrigin, auditLog, forbidden, methodNotAllowed, rateLimit, serverError, setSecurityHeaders, tooManyRequests } from './_lib.js';

function clean(value = '', max = 1000) {
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    if (request.method !== 'POST') return methodNotAllowed(response);
    if (!assertSameOrigin(request)) return forbidden(response);
    if (!(await rateLimit(request, 'telemetry', 120, 60 * 1000))) return tooManyRequests(response);
    const { type = 'client.event', message = '', path = '', detail = {}, metric = '' } = request.body || {};
    await auditLog(`telemetry.${clean(type, 80)}`, {
      entityType: 'telemetry',
      entityId: clean(metric || path || type, 120),
      metadata: {
        message: clean(message),
        path: clean(path, 300),
        detail: typeof detail === 'object' && detail ? detail : {}
      }
    });
    return response.status(202).json({ ok: true });
  } catch (error) {
    return serverError(response, error);
  }
}
