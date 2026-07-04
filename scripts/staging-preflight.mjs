const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SESSION_SECRET',
  'NEXT_PUBLIC_APP_URL'
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing staging environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const url = new URL('/rest/v1/app_records', process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''));
url.searchParams.set('select', 'path');
url.searchParams.set('limit', '1');

const response = await fetch(url, {
  headers: {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ...(String(process.env.SUPABASE_SERVICE_ROLE_KEY).split('.').length === 3 ? { authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } : {})
  }
});

if (!response.ok) {
  const text = await response.text();
  console.error(`Supabase staging preflight failed (${response.status}): ${text}`);
  process.exit(1);
}

console.log('Supabase staging preflight passed');
