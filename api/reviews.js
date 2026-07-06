import { randomUUID } from 'node:crypto';
import { IMPACT_SECTORS, appUrl, assertSameOrigin, auditLog, deleteRecord, ensureStorage, forbidden, listRecords, methodNotAllowed, rateLimit, readRecord, readSession, sendEmail, serverError, setSecurityHeaders, stableHash, tooManyRequests, writeRecord } from './_lib.js';

function clean(value = '') {
  return String(value).trim();
}

function isCompanyEmail(email = '') {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  return domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com'].includes(domain);
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();

    if (request.method === 'GET') {
      const session = readSession(request);
      const all = (await listRecords('reviews/')).filter((item) => item.recordType === 'review');
      const reviews = all
        .filter((item) => request.query.mine === '1' && session ? item.ownerHash === stableHash(session.email) : !item.hidden)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((item) => request.query.mine === '1' ? item : (({ ownerHash, ...publicReview }) => publicReview)(item));
      return response.json({ reviews });
    }

    if (request.method === 'POST') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Sign in with a company or job seeker email before writing a review' });
      if (!isCompanyEmail(session.email) && session.role !== 'candidate') return response.status(403).json({ error: 'Use a company email address or a verified job seeker account to write a review' });
      const { company = '', companyUrl = '', sector = '', role = '', location = '', rating = '', salary = '', headline = '', pros = '', cons = '', advice = '', displayMode = 'anonymous', reviewerLinkedin = '' } = request.body || {};
      const score = Number(rating);
      if (![company, sector, role, location, headline, pros, cons].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (!Number.isInteger(score) || score < 1 || score > 5) return response.status(400).json({ error: 'Choose a rating from 1 to 5' });
      if (!['anonymous', 'name', 'linkedin'].includes(displayMode)) return response.status(400).json({ error: 'Choose how to display your review identity' });
      if (companyUrl && !/^https?:\/\//i.test(clean(companyUrl))) return response.status(400).json({ error: 'Company URL must start with http:// or https://' });
      if (displayMode === 'linkedin' && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i.test(reviewerLinkedin.trim())) return response.status(400).json({ error: 'Add a valid LinkedIn profile URL' });
      if (company.length > 120 || companyUrl.length > 500 || sector.length > 80 || role.length > 120 || location.length > 120 || salary.length > 120 || headline.length > 180 || pros.length > 1200 || cons.length > 1200 || advice.length > 1200 || reviewerLinkedin.length > 500) return response.status(400).json({ error: 'One or more fields are too long' });
      if (!(await rateLimit(request, `review:${clean(company).toLowerCase() || 'missing'}`, 6, 60 * 60 * 1000))) return tooManyRequests(response);
      const reviewerName = session.name || session.company || session.email.split('@')[0];

      const review = {
        recordType: 'review',
        id: randomUUID(),
        company: clean(company),
        companyUrl: clean(companyUrl),
        sector: clean(sector),
        role: clean(role),
        location: clean(location),
        rating: score,
        salary: clean(salary),
        headline: clean(headline),
        pros: clean(pros),
        cons: clean(cons),
        advice: clean(advice),
        reviewer: {
          displayMode,
          label: displayMode === 'anonymous' ? 'Anonymous verified reviewer' : reviewerName,
          linkedin: displayMode === 'linkedin' ? clean(reviewerLinkedin) : '',
          verifiedDomain: session.email.split('@')[1] || ''
        },
        ownerHash: stableHash(session.email),
        created_at: new Date().toISOString()
      };
      await writeRecord(`reviews/${review.id}.json`, review);
      if (process.env.REVIEW_MODERATION_EMAIL) {
        await sendEmail({
          to: process.env.REVIEW_MODERATION_EMAIL,
          subject: `New Crossover Talent review: ${review.company}`,
          html: `<p>A new review was submitted for <strong>${review.company}</strong>.</p><p>Headline: ${review.headline}</p><p><a href="${appUrl('/?admin=1')}">Open admin moderation</a></p>`
        });
      }
      await auditLog('review.created', { actorEmail: session.email, entityType: 'review', entityId: review.id, metadata: { company: review.company, sector: review.sector } });
      return response.status(201).json({ review });
    }

    if (request.method === 'DELETE') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Please sign in' });
      const id = request.query.id || request.body?.id;
      const pathname = `reviews/${id}.json`;
      const review = await readRecord(pathname);
      if (!review) return response.status(404).json({ error: 'Review not found' });
      if (review.ownerHash !== stableHash(session.email) && session.role !== 'admin') return response.status(403).json({ error: 'You can only delete reviews you created' });
      await deleteRecord(pathname);
      await auditLog('review.deleted', { actorEmail: session.email, entityType: 'review', entityId: id });
      return response.json({ ok: true });
    }

    if (request.method === 'PATCH') {
      if (!assertSameOrigin(request)) return forbidden(response);
      const session = readSession(request);
      if (!session) return response.status(401).json({ error: 'Please sign in' });
      const { id, hidden, company, companyUrl = '', sector, role, location, rating, salary = '', headline, pros, cons, advice = '', displayMode = 'anonymous', reviewerLinkedin = '' } = request.body || {};
      const pathname = `reviews/${id}.json`;
      const review = await readRecord(pathname);
      if (!review) return response.status(404).json({ error: 'Review not found' });
      if (session.role === 'admin') {
        await writeRecord(pathname, { ...review, hidden: Boolean(hidden), moderatedBy: session.email, updated_at: new Date().toISOString() }, true);
        await auditLog('review.moderated', { actorEmail: session.email, entityType: 'review', entityId: id, metadata: { hidden: Boolean(hidden) } });
        return response.json({ ok: true });
      }
      if (review.ownerHash !== stableHash(session.email)) return response.status(403).json({ error: 'You can only edit reviews you created' });
      const score = Number(rating);
      if (![company, sector, role, location, headline, pros, cons].every((value) => typeof value === 'string' && value.trim())) return response.status(400).json({ error: 'Complete all required fields' });
      if (!IMPACT_SECTORS.includes(sector)) return response.status(400).json({ error: 'Choose a valid focus sector' });
      if (!Number.isInteger(score) || score < 1 || score > 5) return response.status(400).json({ error: 'Choose a rating from 1 to 5' });
      if (!['anonymous', 'name', 'linkedin'].includes(displayMode)) return response.status(400).json({ error: 'Choose how to display your review identity' });
      if (companyUrl && !/^https?:\/\//i.test(clean(companyUrl))) return response.status(400).json({ error: 'Company URL must start with http:// or https://' });
      if (displayMode === 'linkedin' && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i.test(reviewerLinkedin.trim())) return response.status(400).json({ error: 'Add a valid LinkedIn profile URL' });
      if (company.length > 120 || companyUrl.length > 500 || sector.length > 80 || role.length > 120 || location.length > 120 || salary.length > 120 || headline.length > 180 || pros.length > 1200 || cons.length > 1200 || advice.length > 1200 || reviewerLinkedin.length > 500) return response.status(400).json({ error: 'One or more fields are too long' });
      const reviewerName = session.name || session.company || session.email.split('@')[0];
      const updated = {
        ...review,
        company: clean(company),
        companyUrl: clean(companyUrl),
        sector: clean(sector),
        role: clean(role),
        location: clean(location),
        rating: score,
        salary: clean(salary),
        headline: clean(headline),
        pros: clean(pros),
        cons: clean(cons),
        advice: clean(advice),
        reviewer: {
          displayMode,
          label: displayMode === 'anonymous' ? 'Anonymous verified reviewer' : reviewerName,
          linkedin: displayMode === 'linkedin' ? clean(reviewerLinkedin) : '',
          verifiedDomain: session.email.split('@')[1] || ''
        },
        updated_at: new Date().toISOString()
      };
      await writeRecord(pathname, updated, true);
      await auditLog('review.updated', { actorEmail: session.email, entityType: 'review', entityId: id });
      return response.json({ review: updated });
    }

    return methodNotAllowed(response);
  } catch (error) { return serverError(response, error); }
}
