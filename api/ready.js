import { ensureStorage, listRecords, setSecurityHeaders } from './_lib.js';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  setSecurityHeaders(response);
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  const isProduction = process.env.VERCEL_ENV === 'production';
  const checks = {
    storage: false,
    database: false,
    sessionSecret: Boolean(process.env.SESSION_SECRET || process.env.VERCEL_ENV !== 'production'),
    appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL),
    cvBucket: !isProduction || process.env.SUPABASE_CV_BUCKET === 'crossover-cvs-production',
    jdBucket: !isProduction || process.env.SUPABASE_JD_BUCKET === 'crossover-job-descriptions-production',
    logoBucket: !isProduction || process.env.SUPABASE_LOGO_BUCKET === 'crossover-company-logos-production',
    fileBucket: !isProduction || process.env.SUPABASE_FILE_BUCKET === 'crossover-job-descriptions-production'
  };
  try {
    ensureStorage();
    checks.storage = true;
    await listRecords('rate-limits/');
    checks.database = true;
  } catch (error) {
    return response.status(503).json({
      ok: false,
      status: 'not_ready',
      checks,
      error: error.message === 'Storage is not configured' ? error.message : 'Readiness check failed',
      timestamp: new Date().toISOString()
    });
  }
  const ok = Object.values(checks).every(Boolean);
  return response.status(ok ? 200 : 503).json({
    ok,
    status: ok ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
}
