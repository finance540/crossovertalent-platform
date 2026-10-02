import { ensureStorage, listRecords, methodNotAllowed, readPrivateFile, readRecord, readSession, requireApprovedEmployerSession, requireSession, serverError, setSecurityHeaders, stableHash, createSignedFileUrl, verifyLocalFileToken } from './_lib.js';

const FILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 300;

function downloadName(fileName = '') {
  return String(fileName).replace(/[^\w.-]/g, '_').slice(0, 120) || 'cv-download';
}

function fileContentType(fileName = '') {
  const extension = String(fileName).split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'txt') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
}

async function mayAccessFile(request, response, file) {
  const session = requireSession(request, response);
  if (!session) return false;
  if (session.role === 'candidate') {
    const candidate = await readRecord(`candidates/${stableHash(session.email)}.json`);
    return Boolean(candidate && !candidate.disabled && candidate.emailVerified && candidate.id === session.candidateId && file.kind === 'cv' && file.ownerRole === 'candidate' && file.ownerId === candidate.id);
  }
  if (session.role === 'employer') {
    const employer = await requireApprovedEmployerSession(request, response);
    if (!employer) return false;
    const applications = await listRecords(`companies/${employer.companyId}/applications/`);
    return applications.some((application) => application.cvAttachment?.id === file.id && application.companyId === employer.companyId);
  }
  response.status(403).json({ error: 'A job seeker or approved employer account is required' });
  return false;
}

export default async function handler(request, response) {
  try {
    response.setHeader('Cache-Control', 'private, no-store');
    setSecurityHeaders(response);
    if (request.method !== 'GET') return methodNotAllowed(response);
    ensureStorage();

    if (request.query.token) {
      const token = verifyLocalFileToken(request.query.token);
      if (!token) return response.status(404).json({ error: 'File not found or access link expired' });
      let content;
      try {
        content = await readPrivateFile(token.bucket, token.objectPath);
      } catch (error) {
        if (error.code === 'ENOENT') return response.status(404).json({ error: 'File not found' });
        throw error;
      }
      response.setHeader('Content-Type', fileContentType(token.fileName));
      response.setHeader('Content-Disposition', `attachment; filename="${downloadName(token.fileName)}"`);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      return response.end(content);
    }

    const fileId = String(request.query.id || '');
    if (!FILE_ID_PATTERN.test(fileId)) return response.status(404).json({ error: 'File not found' });
    const file = await readRecord(`uploaded-files/${fileId}.json`);
    if (!file || file.kind !== 'cv' || !file.bucket || !file.objectPath) return response.status(404).json({ error: 'File not found' });
    if (!(await mayAccessFile(request, response, file))) {
      if (!response.writableEnded) return response.status(404).json({ error: 'File not found' });
      return;
    }

    const signed = await createSignedFileUrl(file.bucket, file.objectPath, SIGNED_URL_TTL_SECONDS, file.fileName);
    if (!signed.signedUrl) throw new Error('Signed URL was not created');
    response.setHeader('Referrer-Policy', 'no-referrer');
    return response.redirect(302, signed.signedUrl);
  } catch (error) {
    return serverError(response, error);
  }
}
