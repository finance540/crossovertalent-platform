import { IMPACT_SECTORS, allowStorageFallback, auditLog, assertSameOrigin, configuredSupabaseUrl, ensureStorage, forbidden, hiddenEmployerCompanyIds, isApproved, isProductionSmokeRecord, isPublicJob, jobPublishedAt, listRecords, methodNotAllowed, productEvent, readRecord, requireApprovedEmployerSession, serverError, setSecurityHeaders, uploadPrivateFile, writeRecord } from './_lib.js';
import { randomUUID } from 'node:crypto';

const MAX_LOGO_BYTES = 750_000;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

function clean(value = '') {
  return String(value).trim();
}

function publicProfile(profile = {}, session = {}) {
  profile = profile || {};
  return {
    recordType: 'company_profile',
    companyId: session.companyId || profile.companyId,
    company: profile.company || session.company || '',
    website: profile.website || '',
    sector: profile.sector || '',
    location: profile.location || '',
    description: profile.description || '',
    logo: profile.logo || null,
    updated_at: profile.updated_at || profile.created_at || ''
  };
}

const MISSION_SUMMARY_LENGTH = 220;

function missionSummary(text = '') {
  const value = clean(text).replace(/\s+/g, ' ');
  if (value.length <= MISSION_SUMMARY_LENGTH) return value;
  return `${value.slice(0, MISSION_SUMMARY_LENGTH).replace(/\s+\S*$/, '')}…`;
}

function unique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function publicCompany(companyId, profile, jobs) {
  const name = clean(profile?.company) || clean(jobs[0]?.company);
  const mission = clean(profile?.mission || profile?.description);
  return {
    id: companyId,
    companyId,
    name,
    sectors: unique([profile?.sector, ...(profile?.sectors || []), ...jobs.map((job) => job.sector)]),
    mission,
    missionSummary: missionSummary(mission),
    website: clean(profile?.website),
    location: clean(profile?.location),
    locations: unique([profile?.location, ...jobs.map((job) => job.location)]),
    logoUrl: profile?.logo?.publicUrl || '',
    liveOpenings: jobs.length,
    hasProfile: Boolean(profile),
    updated_at: profile?.updated_at || profile?.created_at || jobs[0]?.created_at || ''
  };
}

async function publicCompanies() {
  const [records, accounts] = await Promise.all([listRecords('companies/'), listRecords('accounts/')]);
  const hiddenCompanyIds = hiddenEmployerCompanyIds(accounts);
  const profiles = new Map();
  const jobsByCompany = new Map();
  records.forEach((record) => {
    if (!record.companyId || hiddenCompanyIds.has(record.companyId)) return;
    if (record.recordType === 'company_profile' && clean(record.company) && isApproved(record) && !isProductionSmokeRecord(record)) profiles.set(record.companyId, record);
    if (isPublicJob(record)) jobsByCompany.set(record.companyId, [...(jobsByCompany.get(record.companyId) || []), record]);
  });
  const companyIds = new Set([...profiles.keys(), ...jobsByCompany.keys()]);
  const companies = [...companyIds].map((companyId) => {
    const jobs = (jobsByCompany.get(companyId) || []).sort((a, b) => jobPublishedAt(b).localeCompare(jobPublishedAt(a)));
    return { company: publicCompany(companyId, profiles.get(companyId), jobs), jobs };
  });
  return companies
    .filter(({ company }) => company.name)
    .sort((a, b) => b.company.liveOpenings - a.company.liveOpenings || a.company.name.localeCompare(b.company.name));
}

async function handlePublicCompanies(request, response) {
  if (request.method !== 'GET') return methodNotAllowed(response);
  const companies = await publicCompanies();
  if (request.query.id) {
    const match = companies.find(({ company }) => company.id === request.query.id);
    if (!match) return response.status(404).json({ error: 'Company not found' });
    return response.json({ company: match.company, jobs: match.jobs });
  }
  return response.json({ companies: companies.map(({ company }) => company) });
}

function publicStorageUrl(bucket, objectPath) {
  const base = configuredSupabaseUrl();
  return base ? `${base}/storage/v1/object/public/${bucket}/${objectPath}` : '';
}

async function cleanLogo(logo, session) {
  if (!logo) return null;
  if (logo.remove) return null;
  const type = clean(logo.type).toLowerCase();
  const size = Number(logo.size || 0);
  if (!LOGO_TYPES.includes(type)) throw new Error('Upload a PNG, JPG, WEBP, or SVG logo');
  if (!size || size > MAX_LOGO_BYTES) throw new Error('Logo must be under 750 KB');
  const data = clean(logo.data);
  if (!data || data.length > Math.ceil(MAX_LOGO_BYTES * 1.5)) throw new Error('Logo upload data is invalid');
  if (type === 'image/svg+xml' && process.env.ALLOW_SVG_LOGOS !== 'true') throw new Error('SVG logos are disabled in production. Upload PNG, JPG, or WEBP.');
  const name = clean(logo.name).slice(0, 120);
  const extension = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg');
  const bucket = process.env.SUPABASE_LOGO_BUCKET || 'crossover-company-logos-staging';
  const objectPath = `${session.companyId}/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(data, 'base64');
  try {
    await uploadPrivateFile({ bucket, objectPath, buffer, contentType: type, metadata: { companyId: session.companyId, name, size } });
    return { name, type, size, bucket, objectPath, publicUrl: publicStorageUrl(bucket, objectPath), updated_at: new Date().toISOString() };
  } catch (error) {
    if (!allowStorageFallback()) throw new Error(`Logo upload failed: ${error.message}`);
    await auditLog('logo.inline_fallback', { actorEmail: session.email, entityType: 'company_profile', entityId: session.companyId, metadata: { error: error.message } });
    return { name, type, size, dataUrl: `data:${type};base64,${data}`, storageFallback: true, updated_at: new Date().toISOString() };
  }
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.query.route === 'companies') return handlePublicCompanies(request, response);
    const session = await requireApprovedEmployerSession(request, response);
    if (!session) return;
    const path = `companies/${session.companyId}/profile.json`;
    if (request.method === 'GET') {
      return response.json({ profile: publicProfile(await readRecord(path), session) });
    }
    if (!assertSameOrigin(request)) return forbidden(response);
    if (!['POST', 'PATCH'].includes(request.method)) return methodNotAllowed(response);
    const existing = await readRecord(path);
    const { company = session.company, website = '', sector = '', location = '', description = '', logo } = request.body || {};
    if (clean(company).length < 2) return response.status(400).json({ error: 'Enter a company name' });
    if (website && !/^https?:\/\//i.test(clean(website))) return response.status(400).json({ error: 'Website must start with http:// or https://' });
    if (sector && !IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
    if (company.length > 120 || website.length > 300 || location.length > 120 || description.length > 2000) return response.status(400).json({ error: 'One or more fields are too long' });
    const nextLogo = logo === undefined ? existing?.logo || null : await cleanLogo(logo, session);
    const profile = {
      ...existing,
      recordType: 'company_profile',
      companyId: session.companyId,
      ownerEmail: session.email,
      company: clean(company),
      website: clean(website),
      sector: clean(sector),
      location: clean(location),
      description: clean(description),
      logo: nextLogo,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await writeRecord(path, profile, true);
    await auditLog('company.profile_saved', { actorEmail: session.email, entityType: 'company_profile', entityId: session.companyId });
    await productEvent(existing ? 'company_updated' : 'company_created', { actorEmail: session.email, entityType: 'company_profile', entityId: session.companyId, metadata: { sector: profile.sector, hasLogo: Boolean(profile.logo) } });
    return response.json({ profile: publicProfile(profile, session) });
  } catch (error) {
    if (/Logo|Upload/.test(error.message)) return response.status(400).json({ error: error.message });
    return serverError(response, error);
  }
}
