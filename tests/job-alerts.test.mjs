import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { dispatchQueuedJobAlerts, jobAlertMatches, nextJobAlertDigestAt, normalizeJobAlertPreferences, notifyPublishedJob, publicJobAlertSettings, updateJobAlertPreferences } from '../api/_job-alerts.js';
import { createSession, readRecord, stableHash, writeRecord } from '../api/_lib.js';
import jobAlertsHandler from '../api/job-alerts.js';
import jobsHandler from '../api/jobs.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; return this; },
    send(data) { this.data = data; return this; }
  };
}

test('job alert filters match sector, location, and seniority without changing public settings', () => {
  const alerts = { active: true, sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'] };
  const job = { sector: 'climate', location: 'TOKYO', experience: 'director' };
  assert.equal(jobAlertMatches(job, alerts), true);
  assert.equal(jobAlertMatches({ ...job, location: 'Singapore' }, alerts), false);
  assert.equal(jobAlertMatches({ ...job, sector: 'Education' }, alerts), false);
  assert.equal(jobAlertMatches(job, { ...alerts, levels: ['Associate'] }), false);
  assert.equal(jobAlertMatches(job, { ...alerts, active: false }), false);
  assert.deepEqual(publicJobAlertSettings({ ...alerts, unsubscribeToken: 'private' }), { active: true, sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'instant' });
  assert.throws(() => normalizeJobAlertPreferences({ locations: Array.from({ length: 21 }, () => 'Tokyo') }), /up to 20 locations/);
  assert.throws(() => normalizeJobAlertPreferences({ sectors: Array.from({ length: 21 }, () => 'Climate') }), /up to 20 valid sectors/);
});

test('daily and weekly alert delivery is scheduled for the next 09:00 UTC slot', () => {
  const beforeDaily = new Date('2026-10-02T08:00:00Z');
  const afterDaily = new Date('2026-10-02T10:00:00Z');
  assert.equal(nextJobAlertDigestAt('daily', beforeDaily), '2026-10-02T09:00:00.000Z');
  assert.equal(nextJobAlertDigestAt('daily', afterDaily), '2026-10-03T09:00:00.000Z');
  assert.equal(nextJobAlertDigestAt('weekly', beforeDaily), '2026-10-05T09:00:00.000Z');
  assert.equal(nextJobAlertDigestAt('instant', beforeDaily), '');
});

test('candidate preferences are authenticated, validated, private, and unsubscribe requires confirmation', async () => {
  const storage = await mkdtemp(path.join(tmpdir(), 'crossover-job-alerts-'));
  const keys = ['NODE_ENV', 'VERCEL_ENV', 'STORAGE_DRIVER', 'LOCAL_STORAGE_DIR', 'SESSION_SECRET'];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const email = `alerts-${randomUUID()}@example.test`;
  const candidate = { id: randomUUID(), role: 'candidate', email, emailHash: stableHash(email), emailVerified: true, disabled: false, name: 'Alert Test', jobAlerts: { active: false } };
  let session;
  const request = (method, body = {}, query = {}, cookie = session) => ({ method, body, query, headers: { cookie: cookie ? `rb_session=${cookie}` : '', host: 'alerts.test', origin: 'https://alerts.test' } });

  try {
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'preview';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_DIR = storage;
    process.env.SESSION_SECRET = 'job-alerts-test-session-secret';
    await writeRecord(`candidates/${candidate.emailHash}.json`, candidate);
    session = createSession({ ...candidate, candidateId: candidate.id });

    const unauthorized = response();
    await jobAlertsHandler(request('POST', { sectors: ['Climate'] }, {}, ''), unauthorized);
    assert.equal(unauthorized.statusCode, 401);

    const invalid = response();
    await jobAlertsHandler(request('POST', { sectors: ['Unknown'] }), invalid);
    assert.equal(invalid.statusCode, 400);

    const saved = response();
    await jobAlertsHandler(request('POST', { sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'daily' }), saved);
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.data.jobAlerts, { active: true, sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'daily' });
    const stored = await readRecord(`candidates/${candidate.emailHash}.json`);
    assert.ok(stored.jobAlerts.unsubscribeToken);
    assert.equal(JSON.stringify(saved.data).includes(stored.jobAlerts.unsubscribeToken), false);

    const unsubscribePreview = response();
    await jobAlertsHandler(request('GET', {}, { unsubscribe: stored.jobAlerts.unsubscribeToken }, ''), unsubscribePreview);
    assert.equal(unsubscribePreview.statusCode, 200);
    assert.match(unsubscribePreview.data, /Confirm below to stop receiving/);
    assert.match(unsubscribePreview.data, /method="post"/);
    assert.equal((await readRecord(`candidates/${candidate.emailHash}.json`)).jobAlerts.active, true);

    await writeRecord(`job-alert-queue/${candidate.id}/queued-job.json`, { candidateId: candidate.id, jobId: 'queued-job' });
    const paused = response();
    await jobAlertsHandler(request('POST', { enabled: false }), paused);
    assert.equal(paused.statusCode, 200);
    assert.equal((await readRecord(`candidates/${candidate.emailHash}.json`)).jobAlerts.active, false);
    assert.equal((await readRecord(`job-alert-unsubscribes/${stableHash(stored.jobAlerts.unsubscribeToken)}.json`)).active, false);
    assert.equal(await readRecord(`job-alert-queue/${candidate.id}/queued-job.json`), null);

    const resumed = response();
    await jobAlertsHandler(request('POST', { sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'daily' }), resumed);
    const reenabled = await readRecord(`candidates/${candidate.emailHash}.json`);
    assert.notEqual(reenabled.jobAlerts.unsubscribeToken, stored.jobAlerts.unsubscribeToken);
    const oldLink = response();
    await jobAlertsHandler(request('POST', { action: 'unsubscribe', token: stored.jobAlerts.unsubscribeToken }, { route: 'unsubscribe' }, ''), oldLink);
    assert.equal((await readRecord(`candidates/${candidate.emailHash}.json`)).jobAlerts.active, true);

    const unsubscribed = response();
    await jobAlertsHandler(request('POST', { action: 'unsubscribe', token: reenabled.jobAlerts.unsubscribeToken }, { route: 'unsubscribe' }, ''), unsubscribed);
    assert.equal(unsubscribed.statusCode, 200);
    assert.match(unsubscribed.data, /You will no longer receive/);
    assert.equal((await readRecord(`candidates/${candidate.emailHash}.json`)).jobAlerts.active, false);

    const repeated = response();
    await jobAlertsHandler(request('POST', { action: 'unsubscribe', token: reenabled.jobAlerts.unsubscribeToken }, { route: 'unsubscribe' }, ''), repeated);
    assert.equal(repeated.statusCode, 200);
    assert.match(repeated.data, /already|no longer receive/i);
  } finally {
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    await rm(storage, { recursive: true, force: true });
  }
});

test('publishing a matching job sends an instant alert, queues a digest, and skips non-matches', async () => {
  const storage = await mkdtemp(path.join(tmpdir(), 'crossover-job-alert-delivery-'));
  const keys = ['NODE_ENV', 'VERCEL_ENV', 'STORAGE_DRIVER', 'LOCAL_STORAGE_DIR', 'SESSION_SECRET', 'RESEND_API_KEY', 'NEXT_PUBLIC_APP_URL', 'CRON_SECRET', 'STRIPE_SECRET_KEY'];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const employerEmail = `employer-${randomUUID()}@example.test`;
  const companyId = randomUUID();
  const instantEmail = `instant-${randomUUID()}@example.test`;
  const digestEmail = `digest-${randomUUID()}@example.test`;
  const otherEmail = `other-${randomUUID()}@example.test`;
  const sent = [];
  let employerSession;
  const request = (body, method = 'POST') => ({ method, query: {}, body, headers: { cookie: `rb_session=${employerSession}`, host: 'alerts.test', origin: 'https://alerts.test' } });

  try {
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'preview';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_DIR = storage;
    process.env.SESSION_SECRET = 'job-alert-delivery-test-secret';
    process.env.RESEND_API_KEY = 're_test_local_fixture';
    process.env.NEXT_PUBLIC_APP_URL = 'https://alerts.test';
    process.env.CRON_SECRET = 'job-alert-cron-test-secret';
    delete process.env.STRIPE_SECRET_KEY;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      sent.push(JSON.parse(options.body));
      return { ok: true, status: 200, json: async () => ({ id: `email-${sent.length}` }) };
    };

    const instant = { id: randomUUID(), role: 'candidate', email: instantEmail, emailHash: stableHash(instantEmail), name: 'Instant Candidate', emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'instant', unsubscribeToken: randomUUID() } };
    const digest = { id: randomUUID(), role: 'candidate', email: digestEmail, emailHash: stableHash(digestEmail), name: 'Digest Candidate', emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Climate'], locations: [], levels: [], frequency: 'daily', nextDigestAt: new Date(Date.now() - 60_000).toISOString(), unsubscribeToken: randomUUID() } };
    const other = { id: randomUUID(), role: 'candidate', email: otherEmail, emailHash: stableHash(otherEmail), emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Education'], locations: [], levels: [], frequency: 'instant', unsubscribeToken: randomUUID() } };
    for (const candidate of [instant, digest, other]) await writeRecord(`candidates/${candidate.emailHash}.json`, candidate);
    await writeRecord(`accounts/${stableHash(employerEmail)}.json`, { recordType: 'account', id: randomUUID(), role: 'employer', email: employerEmail, company: 'Alert Test Co', companyId, employer_status: 'approved', createdAt: new Date().toISOString() });
    employerSession = createSession({ id: randomUUID(), role: 'employer', companyId, company: 'Alert Test Co', email: employerEmail, employer_status: 'approved' });

    const published = response();
    await jobsHandler(request({ title: 'Climate Director', department: 'Leadership', location: 'Tokyo', type: 'Full-time', sector: 'Climate', experience: 'Director', description: 'Lead a climate program.', status: 'active' }), published);
    assert.equal(published.statusCode, 201);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0], instantEmail);
    assert.match(sent[0].html, /Unsubscribe from job alerts/);
    assert.match(sent[0].html, /Climate Director/);

    const job = published.data.job;
    assert.ok(await readRecord(`job-alert-queue/${digest.id}/${job.id}.json`));
    assert.equal(await readRecord(`job-alert-queue/${other.id}/${job.id}.json`), null);
    const duplicate = await notifyPublishedJob(job);
    assert.equal(duplicate.sent, 0);
    assert.equal(sent.length, 1);

    const renewedEmail = `renewed-${randomUUID()}@example.test`;
    const renewedCandidate = { id: randomUUID(), role: 'candidate', email: renewedEmail, emailHash: stableHash(renewedEmail), emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Climate'], locations: ['Tokyo'], levels: ['Director'], frequency: 'instant', unsubscribeToken: randomUUID() } };
    await writeRecord(`candidates/${renewedCandidate.emailHash}.json`, renewedCandidate);
    await writeRecord(`companies/${companyId}/jobs/${job.id}.json`, { ...job, expires_at: new Date(Date.now() - 60_000).toISOString() }, true);
    const renewed = response();
    await jobsHandler(request({ id: job.id, title: job.title, department: job.department, location: job.location, type: job.type, salary: job.salary, sector: job.sector, experience: job.experience, impactArea: job.impactArea, description: job.description, expiresAt: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) }, 'PATCH'), renewed);
    assert.equal(renewed.statusCode, 200);
    assert.ok(sent.some((email) => email.to[0] === renewedEmail));

    await writeRecord(`accounts/${stableHash(employerEmail)}.json`, { recordType: 'account', id: randomUUID(), role: 'employer', email: employerEmail, company: 'Alert Test Co', companyId, employer_status: 'approved', disabled: true, createdAt: new Date().toISOString() }, true);
    const hidden = await notifyPublishedJob({ ...job, id: randomUUID(), published_at: new Date().toISOString() });
    assert.deepEqual(hidden, { matched: 0, sent: 0 });

    const rejectedCron = response();
    await jobAlertsHandler({ method: 'GET', query: { route: 'dispatch' }, headers: { authorization: 'Bearer wrong-secret', host: 'alerts.test' } }, rejectedCron);
    assert.equal(rejectedCron.statusCode, 401);
    const missingBearer = response();
    await jobAlertsHandler({ method: 'GET', query: { route: 'dispatch' }, headers: { authorization: 'job-alert-cron-test-secret', host: 'alerts.test' } }, missingBearer);
    assert.equal(missingBearer.statusCode, 401);
    const cron = response();
    await jobAlertsHandler({ method: 'GET', query: { route: 'dispatch' }, headers: { authorization: 'Bearer job-alert-cron-test-secret', host: 'alerts.test' } }, cron);
    assert.equal(cron.statusCode, 200);
    assert.equal(cron.data.sent, 1);
    assert.equal(sent.length, 3);
    assert.equal(sent[2].to[0], digestEmail);
    assert.match(sent[2].subject, /daily/);
    assert.equal(await readRecord(`job-alert-queue/${digest.id}/${job.id}.json`), null);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    await rm(storage, { recursive: true, force: true });
  }
});

test('digest dispatches candidates concurrently and preserves a pause during delivery', async () => {
  const storage = await mkdtemp(path.join(tmpdir(), 'crossover-job-alert-concurrency-'));
  const keys = ['NODE_ENV', 'VERCEL_ENV', 'STORAGE_DRIVER', 'LOCAL_STORAGE_DIR', 'SESSION_SECRET', 'RESEND_API_KEY', 'NEXT_PUBLIC_APP_URL'];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const companyId = randomUUID();
  const jobId = randomUUID();
  const now = new Date();
  const candidateEmail = (name) => `${name}-${randomUUID()}@example.test`;
  const firstEmail = candidateEmail('first');
  const secondEmail = candidateEmail('second');
  const first = { id: randomUUID(), role: 'candidate', email: firstEmail, emailHash: stableHash(firstEmail), emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Climate'], locations: [], levels: [], frequency: 'daily', nextDigestAt: new Date(now.getTime() - 60_000).toISOString(), unsubscribeToken: randomUUID() } };
  const second = { id: randomUUID(), role: 'candidate', email: secondEmail, emailHash: stableHash(secondEmail), emailVerified: true, disabled: false, jobAlerts: { active: true, sectors: ['Climate'], locations: [], levels: [], frequency: 'daily', nextDigestAt: new Date(now.getTime() - 60_000).toISOString(), unsubscribeToken: randomUUID() } };
  let inFlight = 0;
  let maxInFlight = 0;
  let paused = false;

  try {
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = 'preview';
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_DIR = storage;
    process.env.SESSION_SECRET = 'job-alert-concurrency-test-secret';
    process.env.RESEND_API_KEY = 're_test_local_fixture';
    process.env.NEXT_PUBLIC_APP_URL = 'https://alerts.test';
    globalThis.fetch = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (!paused) {
        paused = true;
        await updateJobAlertPreferences(first, { enabled: false });
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return { ok: true, status: 200, json: async () => ({ id: randomUUID() }) };
    };

    const job = { recordType: 'job', schemaVersion: 2, id: jobId, companyId, company: 'Alert Test Co', title: 'Climate Director', location: 'Tokyo', sector: 'Climate', experience: 'Director', status: 'active', moderation_status: 'approved', expires_at: new Date(now.getTime() + 86_400_000).toISOString() };
    await writeRecord(`candidates/${first.emailHash}.json`, first);
    await writeRecord(`candidates/${second.emailHash}.json`, second);
    await writeRecord(`companies/${companyId}/jobs/${jobId}.json`, job);
    for (const candidate of [first, second]) await writeRecord(`job-alert-queue/${candidate.id}/${jobId}.json`, { candidateId: candidate.id, companyId, jobId });

    const result = await dispatchQueuedJobAlerts(now);
    assert.equal(result.sent, 2);
    assert.equal(maxInFlight, 2);
    const pausedCandidate = await readRecord(`candidates/${first.emailHash}.json`);
    assert.equal(pausedCandidate.jobAlerts.active, false);
    assert.equal(pausedCandidate.jobAlerts.nextDigestAt, '');
    const deliveredCandidate = await readRecord(`candidates/${second.emailHash}.json`);
    assert.notEqual(deliveredCandidate.jobAlerts.nextDigestAt, second.jobAlerts.nextDigestAt);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
    await rm(storage, { recursive: true, force: true });
  }
});
