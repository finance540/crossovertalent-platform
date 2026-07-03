const base = process.env.STAGING_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
if (!base) {
  console.error('Set STAGING_APP_URL or NEXT_PUBLIC_APP_URL to the Vercel staging URL.');
  process.exit(1);
}

const stamp = Date.now();
const password = process.env.STAGING_TEST_PASSWORD || 'StagingSeed123!';
const sectors = ['Climate', 'Impact Investment', 'Public Healthcare', 'Agriculture', 'Water', 'Education', 'Clean Energy', 'Philanthropic Foundation', 'Circular Economy', 'CSR', 'ESG Consulting'];
const locations = ['Singapore', 'Tokyo', 'Delhi', 'Jakarta', 'Remote', 'Bangkok', 'Manila', 'Mumbai'];
const levels = ['Associate', 'Manager', 'Senior Manager', 'Director', 'Executive'];
const workTypes = ['Full-time', 'Contract', 'Part-time', 'Internship'];

function jar() {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    set(response) {
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
    }
  };
}

async function api(path, { method = 'GET', body, session } = {}) {
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: base.replace(/\/$/, ''),
      ...(session?.cookie ? { cookie: session.cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  session?.set(response);
  if (!contentType.includes('application/json')) {
    throw new Error(`${method} ${path} ${response.status}: expected JSON API response, received ${contentType || 'unknown content type'} (${text.slice(0, 120).replace(/\s+/g, ' ')})`);
  }
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${path} ${response.status}: ${data.error || 'failed'}`);
  return data;
}

async function verifyAndLogin(path, session, body) {
  const created = await api(path, { method: 'POST', session, body });
  if (created.verificationUrl) await api(created.verificationUrl, { session });
  await api(path, { method: 'POST', session, body: { action: 'login', email: body.email, password: body.password } });
}

function pick(items, index) {
  return items[index % items.length];
}

const admin = jar();
await verifyAndLogin('/api/admin', admin, {
  action: 'register',
  name: 'Staging Admin',
  email: `qa-admin-seed-${stamp}@crossovertalent.asia`,
  password
});
/*
await api('/api/admin', {
  method: 'POST',
  session: admin,
  body: {
    action: 'register',
    name: 'Staging Admin',
    email: `qa-admin-seed-${stamp}@crossovertalent.asia`,
    password
  }
});
*/

const employers = [];
for (let i = 0; i < 3; i += 1) {
  const session = jar();
  const email = `qa-employer-seed-${i}-${stamp}@crossovertalent.asia`;
  await verifyAndLogin('/api/auth', session, { action: 'register', company: `Seed Employer ${i + 1}`, email, password });
  employers.push({ session, email });
}

const candidates = [];
for (let i = 0; i < 10; i += 1) {
  const session = jar();
  const email = `qa-candidate-seed-${i}-${stamp}@crossovertalent.asia`;
  await verifyAndLogin('/api/candidate', session, { action: 'register', name: `Seed Candidate ${i + 1}`, email, password, linkedin: `https://www.linkedin.com/in/seedcandidate${i + 1}` });
  candidates.push({ session, email, name: `Seed Candidate ${i + 1}` });
}

const jobs = [];
for (let i = 0; i < 100; i += 1) {
  const employer = pick(employers, i);
  const sector = pick(sectors, i);
  const location = pick(locations, i);
  const level = pick(levels, i);
  const workType = pick(workTypes, i);
  const created = await api('/api/jobs', {
    method: 'POST',
    session: employer.session,
    body: {
      title: `${sector} ${level} Role ${i + 1}`,
      department: sector,
      location,
      type: workType,
      salary: `${70000 + i * 500} - ${95000 + i * 500}`,
      sector,
      experience: level,
      impactArea: `${sector} implementation`,
      description: `Seed staging role ${i + 1} focused on ${sector.toLowerCase()} outcomes in ${location}.`
    }
  });
  if (!created.job?.id) throw new Error(`POST /api/jobs did not return a job id for seed job ${i + 1}`);
  jobs.push(created.job);
}

for (let i = 0; i < 50; i += 1) {
  const candidate = pick(candidates, i);
  const job = jobs[i];
  await api('/api/applications', {
    method: 'POST',
    session: candidate.session,
    body: {
      jobId: job.id,
      name: candidate.name,
      email: candidate.email,
      linkedin: `https://www.linkedin.com/in/seedcandidate${(i % 10) + 1}`,
      coverLetter: `Seed application ${i + 1} for ${job.title}.`,
      cvText: `Seed CV text ${i + 1} with ${job.sector} experience.`
    }
  });
}

for (let i = 0; i < 20; i += 1) {
  const candidate = pick(candidates, i);
  const company = `Seed Company ${i + 1}`;
  const sector = pick(sectors, i);
  const location = pick(locations, i);
  await api('/api/reviews', {
    method: 'POST',
    session: candidate.session,
    body: {
      company,
      sector,
      role: `${sector} Specialist`,
      location,
      rating: String((i % 5) + 1),
      salary: `${80000 + i * 1000} - ${105000 + i * 1000}`,
      headline: `Seed review for ${company}`,
      pros: 'Clear mission, practical work, and strong learning environment.',
      cons: 'Priorities can change quickly.',
      advice: 'Keep hiring goals transparent.',
      displayMode: 'anonymous'
    }
  });
  await api('/api/salary-signals', {
    method: 'POST',
    session: candidate.session,
    body: {
      company,
      role: `${sector} Specialist`,
      location,
      level: pick(levels, i),
      sector,
      currency: 'USD',
      salaryMin: String(80000 + i * 1000),
      salaryMax: String(105000 + i * 1000),
      workType: pick(workTypes, i)
    }
  });
}

const metrics = await api('/api/admin', { session: admin });
console.log(JSON.stringify({
  ok: true,
  stamp,
  created: {
    admins: 1,
    employers: employers.length,
    candidates: candidates.length,
    jobs: jobs.length,
    applications: 50,
    companiesViaReviewsAndSignals: 20,
    reviews: 20,
    salarySignals: 20
  },
  adminMetrics: metrics.metrics
}, null, 2));
