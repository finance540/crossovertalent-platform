import { setSecurityHeaders } from './_lib.js';

export default async function handler(request, response) {
  setSecurityHeaders(response);
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  return response.json({
    ok: true,
    status: 'healthy',
    service: 'crossover-talent',
    timestamp: new Date().toISOString()
  });
}

