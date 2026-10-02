import { randomUUID } from 'node:crypto';
import { IMPACT_SECTORS, appUrl, deleteRecord, isPublicJob, listRecords, productEvent, readRecord, sendEmail, stableHash, writeRecord } from './_lib.js';

export const JOB_ALERT_LEVELS = ['Associate', 'Manager', 'Senior Manager', 'Director', 'Executive'];
export const JOB_ALERT_FREQUENCIES = ['instant', 'daily', 'weekly'];

function clean(value = '') {
  return String(value).trim();
}

function filterValues(value, allowedValues, label) {
  const values = Array.isArray(value) ? value : [];
  const normalized = [...new Set(values.map((item) => clean(item)).filter(Boolean))];
  if (normalized.length > 20 || normalized.some((item) => !allowedValues.includes(item))) {
    throw new TypeError(`Choose up to 20 valid ${label}`);
  }
  return normalized;
}

function locationValues(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const normalized = [...new Set(values.map((item) => clean(item)).filter(Boolean))];
  if (normalized.length > 20 || normalized.some((item) => item.length > 120)) {
    throw new TypeError('Enter up to 20 locations, each no longer than 120 characters');
  }
  return normalized;
}

export function normalizeJobAlertPreferences(input = {}) {
  const frequency = clean(input.frequency || 'instant').toLowerCase();
  if (!JOB_ALERT_FREQUENCIES.includes(frequency)) throw new TypeError('Choose an instant, daily, or weekly frequency');
  return {
    sectors: filterValues(input.sectors, IMPACT_SECTORS, 'sectors'),
    locations: locationValues(input.locations),
    levels: filterValues(input.levels, JOB_ALERT_LEVELS, 'seniority levels'),
    frequency
  };
}

export function publicJobAlertSettings(alerts = {}) {
  return {
    active: Boolean(alerts.active),
    sectors: alerts.sectors || [],
    locations: alerts.locations || [],
    levels: alerts.levels || [],
    frequency: JOB_ALERT_FREQUENCIES.includes(alerts.frequency) ? alerts.frequency : 'instant'
  };
}

function normalized(value) {
  return clean(value).toLocaleLowerCase();
}

export function jobAlertMatches(job, alerts) {
  if (!alerts?.active) return false;
  const sectorMatches = !alerts.sectors?.length || alerts.sectors.some((sector) => normalized(sector) === normalized(job.sector));
  const locationMatches = !alerts.locations?.length || alerts.locations.some((location) => normalized(location) === normalized(job.location));
  const level = job.experience || job.level || '';
  const levelMatches = !alerts.levels?.length || alerts.levels.some((item) => normalized(item) === normalized(level));
  return sectorMatches && locationMatches && levelMatches;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function queuePath(candidateId, jobId) {
  return `job-alert-queue/${candidateId}/${jobId}.json`;
}

function deliveryPath(candidateId, jobId) {
  return `job-alert-deliveries/${candidateId}/${jobId}.json`;
}

function jobEmailDetails(job) {
  const url = appUrl(`/?jobs=1&job=${encodeURIComponent(job.id)}`);
  return {
    title: job.title || 'New impact role',
    company: job.company || 'An impact-focused employer',
    location: job.location || '',
    sector: job.sector || '',
    level: job.experience || job.level || '',
    url
  };
}

function jobEmailRow(job) {
  const details = jobEmailDetails(job);
  return `<li><a href="${escapeHtml(details.url)}"><strong>${escapeHtml(details.title)}</strong></a> · ${escapeHtml(details.company)}${details.location ? ` · ${escapeHtml(details.location)}` : ''}${details.sector ? ` · ${escapeHtml(details.sector)}` : ''}${details.level ? ` · ${escapeHtml(details.level)}` : ''}</li>`;
}

function unsubscribeUrl(candidate) {
  return appUrl(`/api/job-alerts?unsubscribe=${encodeURIComponent(candidate.jobAlerts.unsubscribeToken)}`);
}

function alertEmail(candidate, jobs, digest = false) {
  const unsubscribe = unsubscribeUrl(candidate);
  const subject = digest ? `Your ${candidate.jobAlerts.frequency} Crossover Talent job matches` : `New job match: ${jobs[0].title}`;
  const greeting = candidate.name ? `Hi ${escapeHtml(candidate.name)},` : 'Hello,';
  const list = jobs.map(jobEmailRow).join('');
  return {
    to: candidate.email,
    subject,
    html: `<p>${greeting}</p><p>${digest ? 'Here are the new roles matching your job alert preferences:' : 'A new role matches your job alert preferences:'}</p><ul>${list}</ul><p><a href="${escapeHtml(appUrl('/?jobs=1'))}">Browse all jobs</a></p><p><a href="${escapeHtml(unsubscribe)}">Unsubscribe from job alerts</a></p>`,
    text: `${candidate.name ? `Hi ${candidate.name},\n\n` : ''}${digest ? 'New roles matching your job alert preferences:' : 'A new role matches your job alert preferences:'}\n${jobs.map((job) => {
      const details = jobEmailDetails(job);
      return `${details.title} · ${details.company}${details.location ? ` · ${details.location}` : ''}${details.sector ? ` · ${details.sector}` : ''}${details.level ? ` · ${details.level}` : ''}\n${details.url}`;
    }).join('\n\n')}\n\nUnsubscribe: ${unsubscribe}`
  };
}

async function deliverJobs(candidate, jobs, digest = false) {
  if (!jobs.length || !candidate.jobAlerts?.unsubscribeToken) return false;
  const result = await sendEmail(alertEmail(candidate, jobs, digest));
  if (!result.ok) return false;
  const now = new Date().toISOString();
  await Promise.all(jobs.map(async (job) => {
    await writeRecord(deliveryPath(candidate.id, job.id), { recordType: 'job_alert_delivery', candidateId: candidate.id, jobId: job.id, sentAt: now });
    await deleteRecord(queuePath(candidate.id, job.id));
    await productEvent('job_alert_sent', { actorEmail: candidate.email, entityType: 'job', entityId: job.id, metadata: { frequency: digest ? candidate.jobAlerts.frequency : 'instant' } });
  }));
  return true;
}

export async function notifyPublishedJob(job) {
  if (!isPublicJob(job)) return { matched: 0, sent: 0 };
  const candidates = await listRecords('candidates/');
  const matches = candidates.filter((candidate) => candidate.emailVerified && !candidate.disabled && jobAlertMatches(job, candidate.jobAlerts));
  const queued = await Promise.all(matches.map(async (candidate) => {
    const sent = await readRecord(deliveryPath(candidate.id, job.id));
    if (sent) return null;
    const path = queuePath(candidate.id, job.id);
    const existing = await readRecord(path);
    if (!existing) await writeRecord(path, { recordType: 'job_alert_queue', candidateId: candidate.id, candidateHash: stableHash(candidate.email), companyId: job.companyId, jobId: job.id, createdAt: new Date().toISOString() });
    return { candidate, path };
  }));
  const immediate = queued.filter((entry) => entry && entry.candidate.jobAlerts.frequency === 'instant');
  const results = await Promise.allSettled(immediate.map(async ({ candidate }) => deliverJobs(candidate, [job])));
  return { matched: matches.length, sent: results.filter((result) => result.status === 'fulfilled' && result.value).length };
}

export async function dispatchQueuedJobAlerts(now = new Date()) {
  const [candidates, queued] = await Promise.all([listRecords('candidates/'), listRecords('job-alert-queue/')]);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const queuesByCandidate = new Map();
  for (const item of queued) {
    if (!queuesByCandidate.has(item.candidateId)) queuesByCandidate.set(item.candidateId, []);
    queuesByCandidate.get(item.candidateId).push(item);
  }

  let sent = 0;
  let discarded = 0;
  for (const candidate of candidates) {
    const items = queuesByCandidate.get(candidate.id) || [];
    const alerts = candidate.jobAlerts || {};
    if (!alerts.active || !candidate.emailVerified || candidate.disabled) {
      await clearQueuedJobAlerts(candidate.id);
      discarded += items.length;
      continue;
    }
    const eligibleJobs = [];
    for (const item of items) {
      const job = await readRecord(`companies/${item.companyId}/jobs/${item.jobId}.json`);
      if (!job || !isPublicJob(job) || !jobAlertMatches(job, alerts)) {
        await deleteRecord(queuePath(candidate.id, item.jobId));
        discarded += 1;
      } else if (!(await readRecord(deliveryPath(candidate.id, job.id)))) {
        eligibleJobs.push(job);
      } else {
        await deleteRecord(queuePath(candidate.id, item.jobId));
      }
    }
    if (alerts.frequency === 'instant') {
      const results = await Promise.allSettled(eligibleJobs.map((job) => deliverJobs(candidate, [job])));
      sent += results.filter((result) => result.status === 'fulfilled' && result.value).length;
      continue;
    }
    if (!['daily', 'weekly'].includes(alerts.frequency) || !alerts.nextDigestAt || Date.parse(alerts.nextDigestAt) > now.getTime()) continue;
    if (eligibleJobs.length && await deliverJobs(candidate, eligibleJobs, true)) {
      sent += eligibleJobs.length;
      const jobAlerts = { ...alerts, nextDigestAt: nextJobAlertDigestAt(alerts.frequency, now), updatedAt: now.toISOString() };
      await writeRecord(`candidates/${stableHash(candidate.email)}.json`, { ...candidate, jobAlerts, updatedAt: now.toISOString() }, true);
    } else if (!eligibleJobs.length) {
      const jobAlerts = { ...alerts, nextDigestAt: nextJobAlertDigestAt(alerts.frequency, now), updatedAt: now.toISOString() };
      await writeRecord(`candidates/${stableHash(candidate.email)}.json`, { ...candidate, jobAlerts, updatedAt: now.toISOString() }, true);
    }
  }

  for (const [candidateId, items] of queuesByCandidate) {
    if (candidateById.has(candidateId)) continue;
    await Promise.all(items.map((item) => deleteRecord(queuePath(candidateId, item.jobId))));
    discarded += items.length;
  }
  return { sent, discarded };
}

export function nextJobAlertDigestAt(frequency, now = new Date()) {
  if (!['daily', 'weekly'].includes(frequency)) return '';
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (frequency === 'daily') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else {
    const daysUntilMonday = (8 - now.getUTCDay()) % 7;
    next.setUTCDate(now.getUTCDate() + daysUntilMonday);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  }
  return next.toISOString();
}

export async function clearQueuedJobAlerts(candidateId) {
  const queued = await listRecords('job-alert-queue/');
  await Promise.all(queued.filter((item) => item.candidateId === candidateId).map((item) => deleteRecord(`job-alert-queue/${candidateId}/${item.jobId}.json`)));
}

export async function updateJobAlertPreferences(candidate, input) {
  const previous = candidate.jobAlerts || {};
  const enabled = input.enabled !== false;
  const now = new Date().toISOString();
  if (!enabled) {
    const jobAlerts = { ...previous, active: false, nextDigestAt: '', updatedAt: now };
    await writeRecord(`candidates/${stableHash(candidate.email)}.json`, { ...candidate, jobAlerts, updatedAt: now }, true);
    if (previous.unsubscribeToken) {
      const tokenPath = `job-alert-unsubscribes/${stableHash(previous.unsubscribeToken)}.json`;
      const tokenRecord = await readRecord(tokenPath);
      if (tokenRecord?.active) await writeRecord(tokenPath, { ...tokenRecord, active: false, unsubscribedAt: now }, true);
    }
    await clearQueuedJobAlerts(candidate.id);
    return publicJobAlertSettings(jobAlerts);
  }

  const preferences = normalizeJobAlertPreferences(input);
  const unsubscribeToken = previous.active && previous.unsubscribeToken ? previous.unsubscribeToken : randomUUID();
  if (unsubscribeToken !== previous.unsubscribeToken) {
    await writeRecord(`job-alert-unsubscribes/${stableHash(unsubscribeToken)}.json`, {
      recordType: 'job_alert_unsubscribe',
      candidateHash: stableHash(candidate.email),
      active: true,
      createdAt: now
    });
  }
  const frequencyChanged = preferences.frequency !== previous.frequency;
  const jobAlerts = {
    ...preferences,
    active: true,
    unsubscribeToken,
    nextDigestAt: frequencyChanged || !previous.active ? nextJobAlertDigestAt(preferences.frequency) : previous.nextDigestAt || '',
    updatedAt: now
  };
  await writeRecord(`candidates/${stableHash(candidate.email)}.json`, { ...candidate, jobAlerts, updatedAt: now }, true);
  return publicJobAlertSettings(jobAlerts);
}

export async function unsubscribeCandidate(token) {
  const tokenPath = `job-alert-unsubscribes/${stableHash(token)}.json`;
  const tokenRecord = await readRecord(tokenPath);
  if (!tokenRecord) return { found: false, alreadyUnsubscribed: false };
  if (!tokenRecord.active) return { found: true, alreadyUnsubscribed: true };
  const candidatePath = `candidates/${tokenRecord.candidateHash}.json`;
  const candidate = await readRecord(candidatePath);
  if (!candidate) return { found: false, alreadyUnsubscribed: false };
  const now = new Date().toISOString();
  if (candidate.jobAlerts?.unsubscribeToken !== token) {
    await writeRecord(tokenPath, { ...tokenRecord, active: false, unsubscribedAt: now }, true);
    return { found: true, alreadyUnsubscribed: true };
  }
  const jobAlerts = { ...candidate.jobAlerts, active: false, unsubscribeToken: '', nextDigestAt: '', unsubscribedAt: now, updatedAt: now };
  await writeRecord(candidatePath, { ...candidate, jobAlerts, updatedAt: now }, true);
  await writeRecord(tokenPath, { ...tokenRecord, active: false, unsubscribedAt: now }, true);
  await clearQueuedJobAlerts(candidate.id);
  return { found: true, alreadyUnsubscribed: false };
}
