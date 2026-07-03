import { expect } from '@playwright/test';

export const password = process.env.E2E_TEST_PASSWORD || 'E2eTest12345!';

export function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@crossovertalent.asia`;
}

export async function api(request, path, { method = 'GET', body, cookie = '', baseURL } = {}) {
  const response = await request.fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: baseURL || process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_APP_URL || 'http://127.0.0.1:3000',
      ...(cookie ? { cookie } : {})
    },
    data: body
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { response, data, cookie: response.headers()['set-cookie']?.split(';')[0] || cookie };
}

export async function registerVerifyLogin(request, endpoint, registerBody, loginBody = null) {
  let result = await api(request, endpoint, { method: 'POST', body: registerBody });
  expect([200, 201, 202, 409]).toContain(result.response.status());
  if (result.data.verificationUrl) {
    const verify = await api(request, result.data.verificationUrl, { cookie: result.cookie });
    expect(verify.response.ok()).toBeTruthy();
  }
  result = await api(request, endpoint, { method: 'POST', body: loginBody || { action: 'login', email: registerBody.email, password: registerBody.password } });
  expect(result.response.ok()).toBeTruthy();
  return result;
}

export async function parseTxtUpload(request, text, purpose = 'cv') {
  const payload = {
    action: 'parse-document',
    file: {
      name: `${purpose}.txt`,
      type: 'text/plain',
      size: Buffer.byteLength(text),
      purpose,
      data: Buffer.from(text).toString('base64')
    }
  };
  const result = await api(request, '/api/assist', { method: 'POST', body: payload });
  expect(result.response.ok()).toBeTruthy();
  return result.data;
}

