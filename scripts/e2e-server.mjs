import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import applications from '../api/applications.js';
import assist from '../api/assist.js';
import auth from '../api/auth.js';
import admin from '../api/admin.js';
import candidate from '../api/candidate.js';
import company from '../api/company.js';
import files from '../api/files.js';
import jobs from '../api/jobs.js';
import ops from '../api/ops.js';
import reviews from '../api/reviews.js';
import salarySignals from '../api/salary-signals.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'outputs');
const routes = new Map([
  ['/api/applications', applications],
  ['/api/assist', assist],
  ['/api/auth', auth],
  ['/api/admin', admin],
  ['/api/candidate', candidate],
  ['/api/company', company],
  ['/api/files', files],
  ['/api/jobs', jobs],
  ['/api/reviews', reviews],
  ['/api/salary-signals', salarySignals],
  ['/api/auth-provider', ops, 'auth-provider'],
  ['/api/companies', company, 'companies'],
  ['/api/email-templates', ops, 'email-templates'],
  ['/api/feedback', ops, 'feedback'],
  ['/api/health', ops, 'health'],
  ['/api/ready', ops, 'ready'],
  ['/api/telemetry', ops, 'telemetry'],
  ['/api/verify', ops, 'verify']
]);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2']
]);

function responseAdapter(response) {
  response.status = (status) => {
    response.statusCode = status;
    return response;
  };
  response.json = (body) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(body));
    return response;
  };
  response.text = (body) => {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end(body);
    return response;
  };
  response.redirect = (status, location) => {
    response.statusCode = status;
    response.setHeader('Location', location);
    response.end();
    return response;
  };
}

async function requestBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 10_000_000) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (!length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function serveApi(request, response, url) {
  const route = routes.get(url.pathname);
  if (!route) {
    response.status(404).json({ error: 'Not found' });
    return;
  }
  const [handler, routeName] = Array.isArray(route) ? route : [route, undefined];
  const query = Object.fromEntries(url.searchParams);
  if (routeName) query.route = routeName;
  const adaptedRequest = {
    body: await requestBody(request),
    headers: request.headers,
    method: request.method,
    query,
    url: request.url
  };
  responseAdapter(response);
  await handler(adaptedRequest, response);
  if (!response.writableEnded) response.end();
}

async function serveStatic(response, pathname) {
  const aliases = new Map([
    ['/help', 'help.html'],
    ['/terms', 'terms.html'],
    ['/privacy', 'privacy.html'],
    ['/cookies', 'cookies.html'],
    ['/contact', 'contact.html']
  ]);
  const relativePath = aliases.get(pathname) || (pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1)));
  const filePath = path.resolve(outputRoot, relativePath);
  if (filePath !== outputRoot && !filePath.startsWith(`${outputRoot}${path.sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    await access(filePath);
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }
  response.setHeader('Content-Type', contentTypes.get(path.extname(filePath)) || 'application/octet-stream');
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1:3000'}`);
    if (url.pathname.startsWith('/api/')) {
      await serveApi(request, response, url);
      return;
    }
    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error('E2E server request failed:', error);
    if (!response.headersSent) response.statusCode = error instanceof SyntaxError ? 400 : 500;
    if (!response.writableEnded) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ error: error instanceof SyntaxError ? 'Invalid JSON body' : 'E2E server error' }));
    }
  }
});

await readFile(path.join(outputRoot, 'index.html'));
server.listen(3000, '127.0.0.1', () => console.log('E2E server listening on http://127.0.0.1:3000'));
