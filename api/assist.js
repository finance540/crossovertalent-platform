import { allowStorageFallback, auditLog, assertSameOrigin, employerStatus, employerStatusMessage, ensureStorage, forbidden, listRecords, openAiChat, productEvent, rateLimit, readRecord, readSession, requireSession, serverError, setSecurityHeaders, stableHash, tooManyRequests, uploadPrivateFile, writeRecord } from './_lib.js';
import mammoth from 'mammoth';
import { randomUUID } from 'node:crypto';

const MAX_UPLOAD_BYTES = 3_000_000;
const PDF_TEXT_MINIMUM = 0.7;
const OCR_TEXT_MINIMUM = 0.64;
const OCR_MAX_PAGES = 3;
const OCR_RENDER_SCALE = 1.35;

function clean(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function truncate(value = '', max = 6000) {
  return clean(value).slice(0, max);
}

function normalizeExtractedText(value = '') {
  return String(value)
    .replace(/\u0000/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\b([A-Za-z])\s+(?=[A-Za-z]\b)/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readabilityScore(value = '') {
  const text = normalizeExtractedText(value);
  if (!text) return 0;
  if (/Adobe\s+UCS|beginbfchar|beginbfrange|\/CIDInit|\/ToUnicode/i.test(text)) return 0;
  const compact = text.replace(/\s/g, '');
  if (!compact) return 0;
  const letters = (compact.match(/[A-Za-z]/g) || []).length;
  const numbers = (compact.match(/[0-9]/g) || []).length;
  const normalPunctuation = (compact.match(/[.,;:!?'"()/%&+\-@#]/g) || []).length;
  const readableChars = letters + numbers + normalPunctuation;
  const charScore = readableChars / compact.length;
  const words = text.split(/\s+/).filter(Boolean);
  const wordScore = words.length ? words.filter((word) => /[A-Za-z]{2,}/.test(word)).length / words.length : 0;
  const longSymbolRuns = (text.match(/[^\w\s.,;:!?'"()/%&+\-@#]{4,}/g) || []).length;
  const symbolPenalty = Math.min(0.35, longSymbolRuns * 0.04);
  return Math.max(0, Math.min(1, (charScore * 0.58) + (wordScore * 0.42) - symbolPenalty));
}

function isReadableExtraction(value = '', minimum = 0.7) {
  const text = normalizeExtractedText(value);
  if (text.length < 12) return false;
  return readabilityScore(text) >= minimum;
}

function parsingConfidence(value = '') {
  const score = readabilityScore(value);
  if (score >= 0.9) return 'high';
  if (score >= 0.78) return 'medium';
  return 'low';
}

function decodeUpload(file = {}) {
  const raw = String(file.data || '').replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) throw new Error('Upload a PDF, DOCX, or TXT file under 3 MB');
  return buffer;
}

function uploadKind(file = {}, fallback = 'document') {
  const purpose = clean(file.purpose || fallback).toLowerCase();
  if (purpose.includes('cv') || purpose.includes('resume')) return 'cv';
  if (purpose.includes('job')) return 'job-description';
  if (purpose.includes('logo')) return 'logo';
  return 'document';
}

function bucketForKind(kind) {
  if (kind === 'cv') return process.env.SUPABASE_CV_BUCKET || 'crossover-cvs-staging';
  if (kind === 'job-description') return process.env.SUPABASE_JD_BUCKET || 'crossover-job-descriptions-staging';
  return process.env.SUPABASE_FILE_BUCKET || 'crossover-job-descriptions-staging';
}

function assertFileSignature(file = {}, buffer) {
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const header = buffer.subarray(0, 8).toString('hex');
  const ascii = buffer.subarray(0, 8).toString('latin1');
  const isPdf = ascii.startsWith('%PDF');
  const isZipDocx = header.startsWith('504b0304');
  const isText = mime.includes('text') || name.endsWith('.txt');
  const isLegacyDoc = mime.includes('msword') || (name.endsWith('.doc') && !name.endsWith('.docx'));
  if (isLegacyDoc) throw new Error('Legacy .doc files cannot be parsed reliably. Export the document as DOCX, PDF, or TXT and upload again.');
  if ((mime.includes('pdf') || name.endsWith('.pdf')) && !isPdf) throw new Error('The uploaded PDF does not look like a valid PDF file');
  if ((mime.includes('openxmlformats') || name.endsWith('.docx')) && !isZipDocx) throw new Error('The uploaded DOCX does not look like a valid DOCX file');
  if (!(isPdf || isZipDocx || isText)) throw new Error('Upload a PDF, DOCX, or TXT file');
}

async function extractDocxText(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch {
    const text = buffer.toString('latin1');
    const matches = [...text.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g)].map((match) => match[1]);
    return matches.join(' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }
}

async function extractPdfText(buffer) {
  let parser;
  const candidates = [];
  try {
    const { PDFParse } = await import('pdf-parse');
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    candidates.push(result.text || '');
  } catch {
    // Fall through to a conservative literal-string fallback below.
  } finally {
    if (parser) await parser.destroy();
  }
  try {
    candidates.push(await extractPdfJsText(buffer));
  } catch {
    candidates.push('');
  }
  try {
    const text = buffer.toString('latin1');
    candidates.push(text
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .match(/\(([^()]{3,})\)/g)?.map((chunk) => chunk.slice(1, -1)).join(' ') || '');
  } catch {
    candidates.push('');
  }
  const readable = candidates
    .map(normalizeExtractedText)
    .filter(Boolean)
    .sort((a, b) => readabilityScore(b) - readabilityScore(a))[0] || '';
  return isReadableExtraction(readable, PDF_TEXT_MINIMUM) ? readable : '';
}

function pdfJsOptions(buffer) {
  return {
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    cMapPacked: true
  };
}

async function loadPdfJsDocument(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument(pdfJsOptions(buffer)).promise;
}

async function extractPdfJsText(buffer) {
  let pdf;
  try {
    pdf = await loadPdfJsDocument(buffer);
    const pages = Math.min(pdf.numPages || 0, 10);
    const chunks = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent({ includeMarkedContent: false, disableNormalization: false });
      chunks.push((content.items || []).map((item) => item.str || '').filter(Boolean).join(' '));
    }
    return chunks.join('\n\n');
  } finally {
    if (pdf) await pdf.destroy();
  }
}

async function renderPdfPagesToImages(buffer) {
  const { createCanvas } = await import('@napi-rs/canvas');
  let pdf;
  try {
    pdf = await loadPdfJsDocument(buffer);
    const pages = Math.min(pdf.numPages || 0, OCR_MAX_PAGES);
    const images = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: OCR_RENDER_SCALE });
      const width = Math.ceil(viewport.width);
      const height = Math.ceil(viewport.height);
      const canvas = createCanvas(width, height);
      const canvasContext = canvas.getContext('2d');
      await page.render({ canvasContext, viewport }).promise;
      images.push({
        page: pageNumber,
        mimeType: 'image/png',
        dataUrl: `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`
      });
    }
    return images;
  } finally {
    if (pdf) await pdf.destroy();
  }
}

async function openAiOcrImages(images = [], file = {}) {
  if (!process.env.OPENAI_API_KEY) {
    return { text: '', fallback: true, reason: 'OPENAI_API_KEY missing' };
  }
  if (!images.length) {
    return { text: '', fallback: true, reason: 'No PDF pages rendered for OCR' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0,
        max_tokens: 3000,
        messages: [
          {
            role: 'system',
            content: 'You extract readable job-description or resume text from document page images. Return only the text visible in the document. Preserve headings and bullets. Do not invent missing words, employers, salaries, dates, or facts.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Extract the readable text from this uploaded ${uploadKind(file)} PDF. If a section is unreadable, omit it instead of guessing.` },
              ...images.map((image) => ({ type: 'image_url', image_url: { url: image.dataUrl, detail: 'high' } }))
            ]
          }
        ]
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { text: '', fallback: true, reason: `OpenAI OCR failed with HTTP ${response.status}${body ? `: ${body.slice(0, 140)}` : ''}` };
    }
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content || '', fallback: false, model: data.model || '' };
  } catch (error) {
    return { text: '', fallback: true, reason: error.name === 'AbortError' ? 'OpenAI OCR timed out' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractPdfWithOcr(buffer, file = {}) {
  try {
    const images = await renderPdfPagesToImages(buffer);
    const result = await openAiOcrImages(images, file);
    const text = truncate(normalizeExtractedText(result.text), 8000);
    return {
      text: isReadableExtraction(text, OCR_TEXT_MINIMUM) ? text : '',
      fallback: result.fallback,
      reason: result.reason || '',
      model: result.model || '',
      pages: images.length
    };
  } catch (error) {
    return { text: '', fallback: true, reason: error.message, pages: 0 };
  }
}

async function extractReadableText(file = {}) {
  const buffer = decodeUpload(file);
  assertFileSignature(file, buffer);
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  let text = '';
  if (mime.includes('pdf') || name.endsWith('.pdf')) text = await extractPdfText(buffer);
  else if (mime.includes('word') || name.endsWith('.docx') || name.endsWith('.doc')) text = (await extractDocxText(buffer)) || buffer.toString('utf8');
  else text = buffer.toString('utf8');
  return { text: truncate(normalizeExtractedText(text), 8000), method: mime.includes('pdf') || name.endsWith('.pdf') ? 'pdf-text' : (mime.includes('word') || name.endsWith('.docx') || name.endsWith('.doc') ? 'docx-text' : 'plain-text') };
}

async function storeUploadedFile(file = {}, buffer, parsedText = '') {
  const kind = uploadKind(file);
  const bucket = bucketForKind(kind);
  const extension = String(file.name || 'upload.txt').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'txt';
  const id = randomUUID();
  const objectPath = `${kind}/${new Date().toISOString().slice(0, 10)}/${id}.${extension}`;
  try {
    await uploadPrivateFile({
      bucket,
      objectPath,
      buffer,
      contentType: file.type || 'application/octet-stream',
      metadata: { kind, name: clean(file.name), size: Number(file.size || buffer.length) }
    });
    const metadata = { recordType: 'uploaded_file', id, bucket, objectPath, kind, fileName: clean(file.name), fileType: clean(file.type), fileSize: Number(file.size || buffer.length), parsedText: truncate(parsedText, 2000), virusScanStatus: process.env.FILE_SCAN_PROVIDER ? 'queued' : 'not_configured', created_at: new Date().toISOString() };
    await writeRecord(`uploaded-files/${id}.json`, metadata);
    return metadata;
  } catch (error) {
    if (!allowStorageFallback()) throw new Error(`File upload failed: ${error.message}`);
    await auditLog('file.storage_fallback', { entityType: 'uploaded_file', metadata: { name: clean(file.name), error: error.message } });
    return { id, kind, fileName: clean(file.name), fileType: clean(file.type), fileSize: Number(file.size || buffer.length), storageFallback: true, virusScanStatus: 'not_configured' };
  }
}

function lines(value = '') {
  return String(value).split(/\n|,/).map(clean).filter(Boolean).slice(0, 8);
}

function roleContext(input = {}) {
  const title = clean(input.title || 'Impact role');
  const department = clean(input.department || '');
  const sector = clean(input.sector || 'Impact');
  const level = clean(input.level || input.experienceLevel || input.experience || '');
  const location = clean(input.location || '');
  const impactArea = clean(input.impactArea || '');
  const context = truncate(input.context || input.sourceText || '', 1200);
  return { title, department, sector, level, location, impactArea, context };
}

function defaultJobMetrics(input = {}) {
  const { title, sector, level, impactArea } = roleContext(input);
  const scope = impactArea || `${sector.toLowerCase()} outcomes`;
  const seniorPrefix = /director|executive|head|lead|senior/i.test(`${title} ${level}`) ? 'strategic ' : '';
  return {
    kpis: [
      `Deliver measurable ${scope} milestones on agreed timelines and quality standards`,
      `Improve stakeholder, partner, or candidate satisfaction through clear communication and follow-through`,
      `Maintain accurate reporting cadence with actionable insights for leadership decision-making`
    ],
    kras: [
      `Own the ${seniorPrefix}delivery plan for the ${title} role across priority workstreams`,
      `Coordinate cross-functional teams, partners, and leadership stakeholders to unblock execution`,
      `Track risks, outcomes, and performance data, then translate findings into practical improvements`
    ]
  };
}

function jobDescription(input = {}) {
  const { title, department, sector, level, location, impactArea, context } = roleContext(input);
  const skillsList = lines(input.skills);
  const skills = skillsList.join(', ') || `${sector} domain knowledge, stakeholder management, analytical problem solving, and structured execution`;
  const experience = clean(input.experience || input.experienceSummary || level || `Relevant experience in ${sector.toLowerCase()} or mission-driven delivery`);
  const suggested = defaultJobMetrics(input);
  const kpis = [...lines(input.kpis), ...suggested.kpis].slice(0, 3);
  const kras = [...lines(input.kras), ...suggested.kras].slice(0, 3);
  if (!title) throw new Error('Add the job title before generating a job description');
  return `About the role
We are hiring a ${title}${department ? ` for ${department}` : ''} to help advance ${sector.toLowerCase()} outcomes across high-impact work${location ? ` in ${location}` : ''}. This person will translate strategy into execution, work across teams and partners, and keep delivery focused on measurable public-good results.${impactArea ? ` The role is especially focused on ${impactArea}.` : ''}

What you will do
${kras.slice(0, 3).map((item) => `- ${item}`).join('\n')}

What success looks like
${kpis.slice(0, 3).map((item) => `- ${item}`).join('\n')}

What you bring
- ${experience}
- Strength in ${skills}
- Comfort working in mission-driven, cross-functional environments
- Ability to communicate clearly with technical and non-technical audiences

${context ? `Source notes from uploaded material\n${context}` : ''}`.trim();
}

function jdPrompt(input = {}) {
  return `Title: ${clean(input.title)}
Department: ${clean(input.department)}
Sector: ${clean(input.sector)}
Location: ${clean(input.location)}
Level: ${clean(input.level || input.experienceLevel || input.experience)}
Impact area: ${clean(input.impactArea)}
Skills: ${clean(input.skills)}
Experience: ${clean(input.experience)}
KPIs: ${clean(input.kpis)}
KRAs: ${clean(input.kras)}
Source notes: ${truncate(input.context || '', 1200)}`;
}

function metricsPrompt(input = {}) {
  return `${jdPrompt(input)}

Task: Suggest exactly three KPIs and exactly three KRAs for this role. Keep them measurable, realistic, sector-relevant, and suitable for a job description. Return JSON only with keys "kpis" and "kras", each an array of three strings.`;
}

function parseMetricsResponse(text = '', input = {}) {
  const fallback = defaultJobMetrics(input);
  try {
    const cleaned = String(text).replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    const kpis = Array.isArray(parsed.kpis) ? parsed.kpis.map(clean).filter(Boolean).slice(0, 3) : [];
    const kras = Array.isArray(parsed.kras) ? parsed.kras.map(clean).filter(Boolean).slice(0, 3) : [];
    return { kpis: kpis.length === 3 ? kpis : fallback.kpis, kras: kras.length === 3 ? kras : fallback.kras };
  } catch {
    return fallback;
  }
}

function revisedCv(input = {}) {
  const target = clean(input.targetRole || 'the target role');
  const skills = lines(input.skills).join(', ');
  const original = truncate(input.cvText || input.profileText || '', 2200);
  return `Professional summary
Impact-focused professional aligned to ${target}, with experience translating complex work into measurable delivery. Brings ${skills || 'cross-functional execution, stakeholder engagement, and analytical problem solving'}.

Selected strengths
- Connects strategy, evidence, and implementation into practical workplans
- Communicates clearly with partners, funders, technical teams, and leadership
- Tracks outcomes through concrete KPIs and improves delivery based on feedback

Suggested CV improvements
- Lead with measurable outcomes and impact metrics, not only responsibilities
- Add sector keywords from the target role near the top of the CV
- Convert broad statements into achievement bullets using action, scope, and result
- Keep the first page focused on the most relevant climate, healthcare, environmental, or investment experience

Draft tailored profile
${original || 'Upload a CV or add LinkedIn/profile notes to generate a more specific rewrite.'}`;
}

function linkedinProfile(input = {}) {
  const url = clean(input.url);
  if (!/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/i.test(url)) throw new Error('Add a valid LinkedIn profile URL such as https://www.linkedin.com/in/name');
  const slug = url.split('/in/')[1]?.split(/[/?#]/)[0] || '';
  const nameGuess = slug.split(/[-_]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
  return {
    linkedin: url,
    name: nameGuess,
    note: 'LinkedIn public scraping is restricted. This profile URL is attached for employer review; upload a CV for full parsing.'
  };
}

function assistantActions(role = 'public', context = {}) {
  const base = [
    { label: 'Browse jobs', href: '/?jobs=1' },
    { label: 'Contact support', href: '/contact.html' }
  ];
  if (role === 'employer') {
    return [
      { label: 'Go to dashboard', href: '/?dashboard=1' },
      { label: 'Post a job', action: 'employer-jobs' },
      { label: 'View applications', action: 'employer-applications' },
      { label: 'Update company profile', action: 'employer-profile' },
      ...base
    ];
  }
  if (role === 'candidate') {
    return [
      { label: 'Candidate dashboard', href: '/?candidate=dashboard' },
      { label: 'Upload CV', action: 'candidate-resume' },
      { label: 'Saved jobs', action: 'candidate-saved' },
      { label: 'Track applications', action: 'candidate-applications' },
      ...base
    ];
  }
  if (role === 'admin') {
    return [
      { label: 'Admin dashboard', href: '/?admin=1' },
      { label: 'Employer approvals', action: 'admin-employers' },
      { label: 'Review moderation', action: 'admin-reviews' },
      { label: 'Feedback inbox', action: 'admin-feedback' },
      { label: 'Platform health', action: 'admin-health' },
      { label: 'Contact support', href: '/contact.html' }
    ];
  }
  if (context.page === 'login') return [{ label: 'Create employer account', href: '/?register=1' }, { label: 'Job seeker sign in', href: '/?candidate=login' }, ...base];
  return [{ label: 'Employer portal', href: '/?login=1' }, { label: 'Job seeker sign in', href: '/?candidate=login' }, ...base];
}

function assistantFallback({ role, message, page, employer, candidate, admin, errorText }) {
  const lower = `${message} ${page} ${errorText}`.toLowerCase();
  const lines = [];
  if (role === 'employer') {
    const status = employer?.status || 'unknown';
    if (status === 'pending_review') {
      lines.push('Your employer account is under review. You can update your company profile, but job posting becomes available after admin approval.');
    } else if (status === 'rejected') {
      lines.push(`Your employer registration was not approved${employer?.rejectionReason ? `: ${employer.rejectionReason}` : '.'} Contact support if you want us to review it again.`);
    } else if (status === 'suspended') {
      lines.push('Your employer account is suspended. Contact support before trying to post jobs or review applicants.');
    } else if (status === 'approved') {
      lines.push('Your employer account is approved. Go to Employer Dashboard, open Jobs, then choose Create Job to post a role.');
    } else {
      lines.push('Sign in or create an employer workspace first. New employer accounts need admin approval before job posting.');
    }
    if (/logo|company|profile/.test(lower)) lines.push('To update your company profile or logo, open Employer Dashboard -> Company profile.');
    if (/applicant|application|candidate|pipeline/.test(lower)) lines.push('To view applicants, open Employer Dashboard -> Applications, then choose a candidate status.');
    if (/consult|pricing|fee|engagement|search|leadership|mapping|partnership/.test(lower)) lines.push('For employer support, use Book a Consultation to discuss executive search, leadership hiring, market mapping, or recruitment partnership options.');
  } else if (role === 'candidate') {
    if (!candidate?.hasResume || /cv|resume|profile/.test(lower)) lines.push('To complete your profile, open Candidate Dashboard -> Resume & preferences, upload or paste your CV, add LinkedIn, and save your preferences.');
    if (/apply|job|filter|discover|find|search/.test(lower)) lines.push('To discover roles, open Find Jobs and filter by keyword, location, function, seniority, work style, and industry. Open a job detail, then use Apply.');
    if (/interview|process|timeline|after|response/.test(lower)) lines.push('After you apply, employers review the application in their dashboard and update status through applied, shortlisted, interview, offered, rejected, hired, or withdrawn.');
    if (/career|support|coach|guide/.test(lower)) lines.push('For career support, keep your CV and LinkedIn current, set preferences, and use the resume assistant for role-focused positioning.');
    if (candidate?.applicationCount) lines.push('You can track submitted applications in Candidate Dashboard -> Applications.');
    else lines.push('Start by browsing jobs, saving roles you like, and uploading your CV.');
  } else if (role === 'admin') {
    lines.push('Use the admin dashboard for guidance only: review pending employers in Employer approval queue, moderate reviews, check feedback inbox, and monitor platform health.');
    if (/approve|employer/.test(lower)) lines.push('To approve an employer, open Admin Dashboard -> Employer approval queue and use Approve, Reject, or Suspend. The assistant cannot make that decision for you.');
  } else {
    lines.push('Welcome to Crossover Talent. Job seekers can find jobs, submit a CV, save roles, and track applications. Employers can hire talent through a workspace or book a consultation.');
    if (/japan|india|asia|executive|saas|ai|fintech/.test(lower)) lines.push('The platform is positioned for Japan, India, and Asia hiring across climate, impact investment, public healthcare, SaaS, AI, fintech, and environmental services.');
    if (/support|help|contact/.test(lower)) lines.push('Use Contact support for account, hiring, or beta issues.');
  }
  if (errorText) lines.push(`Current page message: ${errorText}`);
  lines.push('I can guide navigation, explain workflow status, and point you to the right screen, but I cannot bypass approval gates or perform admin actions.');
  return lines.join('\n\n');
}

async function navigationAssistant(request, input = {}) {
  const session = readSession(request);
  const clientContext = input.context || {};
  let role = session?.role || clean(clientContext.role || 'public', 30).toLowerCase();
  const page = clean(clientContext.page || input.page || '', 80);
  const message = truncate(input.message || input.prompt || 'What should I do next?', 1000);
  const errorText = truncate(clientContext.errorText || '', 500);
  const context = { page };
  let employer = null;
  let candidate = null;
  let admin = null;

  if (session?.role === 'employer') {
    const account = await readRecord(`accounts/${stableHash(session.email)}.json`);
    if (account) {
      const status = employerStatus(account);
      employer = { status, rejectionReason: account.rejection_reason || '', message: employerStatusMessage(account), hasCompany: Boolean(account.company), approved: status === 'approved' };
      role = 'employer';
    }
  } else if (session?.role === 'candidate') {
    const record = await readRecord(`candidates/${stableHash(session.email)}.json`);
    if (record) {
      const applications = (await listRecords('companies/')).filter((item) => item.recordType === 'application' && item.email === record.email);
      candidate = { hasResume: Boolean(record.resume), hasLinkedin: Boolean(record.linkedin), hasPreferences: Boolean(record.preferences?.idealRole || record.preferences?.location), savedJobs: (record.savedJobs || []).length, applicationCount: applications.length };
      role = 'candidate';
    }
  } else if (session?.role === 'admin') {
    const record = await readRecord(`admins/${stableHash(session.email)}.json`);
    if (record && !record.disabled) {
      admin = { verified: Boolean(record.emailVerified) };
      role = 'admin';
    }
  } else if (['employer', 'candidate', 'admin'].includes(clientContext.role)) {
    role = clientContext.role;
  } else {
    role = 'public';
  }

  const fallback = assistantFallback({ role, message, page, employer, candidate, admin, errorText });
  const actions = assistantActions(role, { page });
  const system = [
    'You are the Crossover Talent navigation assistant.',
    'Guide employers, candidates, and admins through workflows using short practical steps.',
    'Never reveal secrets, private records, service role keys, or environment variables.',
    'Do not provide authoritative legal, medical, visa, or financial advice.',
    'Do not perform admin actions, database writes, approvals, or permission bypasses through chat.',
    'Respect employer approval status and route users to support when blocked.'
  ].join(' ');
  const user = JSON.stringify({ role, page, message, employer, candidate, admin, errorText, requestedFormat: 'Return concise guidance with numbered steps and mention relevant buttons/pages.' });
  const generated = await openAiChat({ system, user, fallback, timeoutMs: 9000 });
  await auditLog('ai.navigation_assistant', { actorEmail: session?.email || '', entityType: 'ai_request', metadata: { role, page, fallback: generated.fallback, reason: generated.reason || '' } });
  await productEvent('ai_navigation_assistant', { actorEmail: session?.email || '', entityType: 'ai_request', metadata: { role, page, fallback: generated.fallback } });
  return { reply: generated.text, actions, role, fallback: generated.fallback, fallbackReason: generated.reason || '', guardrails: ['Guidance only', 'No private data', 'No approval bypass', 'No admin actions through chat'] };
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'no-store');
    setSecurityHeaders(response);
    ensureStorage();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed' });
    if (!assertSameOrigin(request)) return forbidden(response);
    if (!(await rateLimit(request, 'assist', 40, 60 * 1000))) return tooManyRequests(response);

    const { action, file, ...input } = request.body || {};
    if (action === 'navigation-assistant') {
      const result = await navigationAssistant(request, input);
      return response.json(result);
    }
    if (action === 'parse-document') {
      const buffer = decodeUpload(file);
      assertFileSignature(file, buffer);
      const mime = String(file?.type || '').toLowerCase();
      const name = String(file?.name || '').toLowerCase();
      const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
      let { text, method } = await extractReadableText({ ...file, data: buffer.toString('base64') });
      let ocr = null;
      if (isPdf && !isReadableExtraction(text, PDF_TEXT_MINIMUM)) {
        ocr = await extractPdfWithOcr(buffer, file);
        if (ocr.text) {
          text = ocr.text;
          method = 'ocr';
        }
        await auditLog('pdf.ocr_attempted', { entityType: 'uploaded_file', metadata: { fileName: clean(file?.name), success: Boolean(ocr.text), reason: ocr.reason || '', pages: ocr.pages || 0, model: ocr.model || '' } });
      }
      if (!isReadableExtraction(text, method === 'ocr' ? OCR_TEXT_MINIMUM : PDF_TEXT_MINIMUM)) {
        const ocrUnavailable = isPdf && ocr?.reason;
        const detail = ocrUnavailable ? ` OCR could not complete: ${ocr.reason}.` : '';
        return response.status(422).json({ error: `The file uploaded, but readable text could not be extracted.${detail} Upload a clearer text-based PDF/DOCX/TXT, try a higher-quality scan, or paste the JD content manually.` });
      }
      const stored = await storeUploadedFile(file, buffer, text);
      await productEvent(uploadKind(file) === 'cv' ? 'cv_uploaded' : 'file_uploaded', { entityType: 'uploaded_file', entityId: stored.id, metadata: { kind: stored.kind, fileType: stored.fileType, fileSize: stored.fileSize, parsed: Boolean(text) } });
      return response.json({ text, file: { name: clean(file?.name), type: clean(file?.type), size: Number(file?.size || 0), storage: stored }, confidence: parsingConfidence(text), readabilityScore: Number(readabilityScore(text).toFixed(2)), extractionMethod: method, ocrFallback: method === 'ocr', ocrPages: ocr?.pages || 0 });
    }
    if (action === 'generate-job-description') {
      const session = requireSession(request, response);
      if (!session) return;
      const fallback = jobDescription(input);
      const suggestedMetrics = defaultJobMetrics(input);
      const generated = await openAiChat({
        system: 'You are a senior impact-sector recruiter. Write concise, realistic job descriptions with inclusive language, clear KPIs, KRAs, skills, and no invented compensation.',
        user: jdPrompt(input),
        fallback
      });
      await auditLog('ai.jd_generated', { actorEmail: session.email, entityType: 'ai_request', metadata: { fallback: generated.fallback, reason: generated.reason || '', model: generated.model || '' } });
      await productEvent('ai_jd_generated', { actorEmail: session.email, entityType: 'ai_request', metadata: { fallback: generated.fallback, model: generated.model || '' } });
      return response.json({ description: generated.text, kpis: lines(input.kpis).length >= 3 ? lines(input.kpis).slice(0, 3) : suggestedMetrics.kpis, kras: lines(input.kras).length >= 3 ? lines(input.kras).slice(0, 3) : suggestedMetrics.kras, generatedBy: generated.fallback ? 'Crossover Talent fallback draft assistant' : 'OpenAI', fallback: generated.fallback, fallbackReason: generated.reason });
    }
    if (action === 'suggest-job-metrics') {
      const session = requireSession(request, response);
      if (!session) return;
      const fallbackMetrics = defaultJobMetrics(input);
      const generated = await openAiChat({
        system: 'You are a senior impact-sector recruiter. Suggest role-specific KPIs and KRAs. Return JSON only.',
        user: metricsPrompt(input),
        fallback: JSON.stringify(fallbackMetrics),
        timeoutMs: 9000
      });
      const metrics = parseMetricsResponse(generated.text, input);
      await auditLog('ai.job_metrics_suggested', { actorEmail: session.email, entityType: 'ai_request', metadata: { fallback: generated.fallback, reason: generated.reason || '', model: generated.model || '' } });
      await productEvent('ai_job_metrics_suggested', { actorEmail: session.email, entityType: 'ai_request', metadata: { fallback: generated.fallback, model: generated.model || '' } });
      return response.json({ ...metrics, generatedBy: generated.fallback ? 'Crossover Talent fallback metrics assistant' : 'OpenAI', fallback: generated.fallback, fallbackReason: generated.reason || '' });
    }
    if (action === 'revise-cv') {
      const fallback = revisedCv(input);
      const generated = await openAiChat({
        system: 'You are a careful CV editor for climate, healthcare, environmental services, public-good, and impact-investment roles. Preserve facts and never invent employers, dates, credentials, or metrics.',
        user: `Target role: ${clean(input.targetRole)}\nSkills: ${clean(input.skills)}\nCV/profile text:\n${truncate(input.cvText || input.profileText || '', 4000)}`,
        fallback
      });
      await auditLog('ai.cv_revised', { entityType: 'ai_request', metadata: { fallback: generated.fallback, reason: generated.reason || '', model: generated.model || '' } });
      await productEvent('ai_cv_revised', { entityType: 'ai_request', metadata: { fallback: generated.fallback, model: generated.model || '' } });
      return response.json({ cv: generated.text, generatedBy: generated.fallback ? 'Crossover Talent fallback CV assistant' : 'OpenAI', fallback: generated.fallback, fallbackReason: generated.reason });
    }
    if (action === 'parse-linkedin') return response.json(linkedinProfile(input));
    return response.status(400).json({ error: 'Choose a valid assistant action' });
  } catch (error) {
    if (/Upload|PDF|DOCX|file/.test(error.message)) await auditLog('upload_failed', { entityType: 'uploaded_file', metadata: { error: error.message } });
    if (/Upload|LinkedIn|Add /.test(error.message)) return response.status(400).json({ error: error.message });
    return serverError(response, error);
  }
}
