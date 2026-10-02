import { test, expect, request as playwrightRequest } from '@playwright/test';
import { api, parseTxtUpload, password, registerVerifyLogin, uniqueEmail } from './fixtures.js';

async function expectAssistantPrompt(page, prompt) {
  const button = page.locator('#assistant-widget-button');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#assistant-panel')).toBeVisible();
  await expect(page.locator('#assistant-suggestions')).toContainText(prompt);
  await page.locator('#assistant-close').click();
}

async function verifyRegistrationLink(page, selector) {
  const link = page.locator(`${selector} a[href*="/api/verify"]`);
  await expect(link).toBeVisible();
  const popupPromise = page.waitForEvent('popup');
  await link.click();
  const popup = await popupPromise;
  await expect(popup.locator('body')).toContainText(/verified/i);
  await popup.close();
}

async function signInThroughForm(page, role, email) {
  await page.goto(role === 'candidate' ? '/?candidate=login' : '/?login=1');
  const form = role === 'candidate' ? '#candidate-auth-form' : '#auth-form';
  await page.locator(`${form} [name="email"]`).fill(email);
  await page.locator(`${form} [name="password"]`).fill(password);
  await page.locator(`${form} [type="submit"]`).click();
  await expect(page.locator(role === 'candidate' ? '#candidate-app' : '#app')).toBeVisible();
}

test.describe.serial('Crossover Talent E2E release candidate workflows', () => {
  let stamp;
  let employerEmail;
  let unrelatedEmployerEmail;
  let candidateEmail;
  let adminEmail;
  let employerCookie = '';
  let unrelatedEmployerCookie = '';
  let candidateCookie = '';
  let adminCookie = '';
  let job;
  let applicationId;
  let cvAttachmentId;
  let reviewId;

  test.beforeAll(({}, testInfo) => {
    stamp = `${Date.now()}-${testInfo.retry}-${Math.random().toString(36).slice(2, 8)}`;
    employerEmail = uniqueEmail('e2e-employer');
    unrelatedEmployerEmail = uniqueEmail('e2e-other-employer');
    candidateEmail = uniqueEmail('e2e-candidate');
    adminEmail = `qa-admin-e2e-${stamp}@crossovertalent.asia`;
    employerCookie = '';
    unrelatedEmployerCookie = '';
    candidateCookie = '';
    adminCookie = '';
    job = undefined;
    applicationId = undefined;
    cvAttachmentId = undefined;
    reviewId = undefined;
  });

  test('employer signup, approval, job posting, and company profile', async ({ request, page }) => {
    const admin = await registerVerifyLogin(request, '/api/admin', {
      action: 'register',
      name: `E2E Admin ${stamp}`,
      email: adminEmail,
      password
    });
    adminCookie = admin.cookie;

    await page.goto('/');
    await page.locator('#landing-start').click();
    await page.locator('#auth-form [name="company"]').fill(`E2E Climate Employer ${stamp}`);
    await page.locator('#auth-form [name="email"]').fill(employerEmail);
    await page.locator('#auth-form [name="password"]').fill(password);
    await page.locator('#auth-submit').click();
    await verifyRegistrationLink(page, '#auth-subtitle');

    const pendingLogin = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: employerEmail, password }
    });
    expect(pendingLogin.response.status()).toBe(403);
    expect(pendingLogin.data.employer_status).toBe('pending_review');

    const approval = await api(request, '/api/admin', {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        action: 'employer-approval',
        email: employerEmail,
        status: 'approved',
        company_validation_notes: 'E2E approval validation.'
      }
    });
    expect(approval.response.ok()).toBeTruthy();

    await page.locator('#auth-switch').click();
    await page.locator('#auth-form [name="email"]').fill(employerEmail);
    await page.locator('#auth-form [name="password"]').fill(password);
    await page.locator('#auth-submit').click();
    await expect(page.locator('#app')).toBeVisible();
    await expectAssistantPrompt(page, 'How do I post my first job?');

    const employer = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: employerEmail, password }
    });
    expect(employer.response.ok()).toBeTruthy();
    expect(employer.data.user.employer_status).toBe('approved');
    employerCookie = employer.cookie;

    const unrelatedRegistration = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'register', company: `Unrelated E2E Employer ${stamp}`, email: unrelatedEmployerEmail, password }
    });
    expect(unrelatedRegistration.response.status()).toBe(202);
    if (unrelatedRegistration.data.verificationUrl) {
      const verification = await api(request, unrelatedRegistration.data.verificationUrl, { cookie: unrelatedRegistration.cookie });
      expect(verification.response.ok()).toBeTruthy();
    }
    const unrelatedApproval = await api(request, '/api/admin', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { action: 'employer-approval', email: unrelatedEmployerEmail, status: 'approved', company_validation_notes: 'E2E unrelated employer validation.' }
    });
    expect(unrelatedApproval.response.ok()).toBeTruthy();
    const unrelatedEmployer = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: unrelatedEmployerEmail, password }
    });
    expect(unrelatedEmployer.response.ok()).toBeTruthy();
    unrelatedEmployerCookie = unrelatedEmployer.cookie;

    const rejectedEmail = uniqueEmail('e2e-rejected-employer');
    const rejected = await api(request, '/api/auth', {
      method: 'POST',
      body: {
        action: 'register',
        company: `Rejected Climate Employer ${stamp}`,
        email: rejectedEmail,
        password
      }
    });
    if (rejected.data.verificationUrl) await api(request, rejected.data.verificationUrl, { cookie: rejected.cookie });
    const rejectedReview = await api(request, '/api/admin', {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        action: 'employer-approval',
        email: rejectedEmail,
        status: 'rejected',
        rejection_reason: 'Company could not be validated.',
        company_validation_notes: 'E2E rejection validation.'
      }
    });
    expect(rejectedReview.response.ok()).toBeTruthy();
    const rejectedLogin = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: rejectedEmail, password }
    });
    expect(rejectedLogin.response.status()).toBe(403);
    expect(rejectedLogin.data.employer_status).toBe('rejected');

    const suspendedEmail = uniqueEmail('e2e-suspended-employer');
    const suspended = await api(request, '/api/auth', {
      method: 'POST',
      body: {
        action: 'register',
        company: `Suspended Climate Employer ${stamp}`,
        email: suspendedEmail,
        password
      }
    });
    if (suspended.data.verificationUrl) await api(request, suspended.data.verificationUrl, { cookie: suspended.cookie });
    const suspendedReview = await api(request, '/api/admin', {
      method: 'PATCH',
      cookie: adminCookie,
      body: {
        action: 'employer-approval',
        email: suspendedEmail,
        status: 'suspended',
        company_validation_notes: 'E2E suspension validation.'
      }
    });
    expect(suspendedReview.response.ok()).toBeTruthy();
    const suspendedLogin = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: suspendedEmail, password }
    });
    expect(suspendedLogin.response.status()).toBe(403);
    expect(suspendedLogin.data.employer_status).toBe('suspended');

    const nonAdminApproval = await api(request, '/api/admin', {
      method: 'PATCH',
      cookie: employerCookie,
      body: {
        action: 'employer-approval',
        email: employerEmail,
        status: 'approved'
      }
    });
    expect([401, 403]).toContain(nonAdminApproval.response.status());

    const pendingEmail = uniqueEmail('e2e-pending-employer');
    const pendingEmployer = await api(request, '/api/auth', {
      method: 'POST',
      body: {
        action: 'register',
        company: `Pending Climate Employer ${stamp}`,
        email: pendingEmail,
        password
      }
    });
    if (pendingEmployer.data.verificationUrl) await api(request, pendingEmployer.data.verificationUrl, { cookie: pendingEmployer.cookie });
    const pendingSession = await api(request, '/api/auth', {
      method: 'POST',
      body: { action: 'login', email: pendingEmail, password }
    });
    const pendingPost = await api(request, '/api/jobs', {
      method: 'POST',
      cookie: pendingSession.cookie || 'rb_session=',
      body: {
        title: 'Should not post',
        department: 'Climate',
        location: 'Singapore',
        type: 'Full-time',
        sector: 'Climate',
        description: 'Pending employer should not post.'
      }
    });
    expect(pendingPost.response.status()).toBe(401);

    const providerStatus = await api(request, '/api/auth-provider');
    expect(providerStatus.response.ok()).toBeTruthy();
    expect(providerStatus.data.employerApprovalEnforced).toBeTruthy();

    const googleStatus = await api(request, '/api/auth-provider?provider=google&role=employer');
    expect([302, 503]).toContain(googleStatus.response.status());
    const phoneStatus = await api(request, '/api/auth-provider', {
      method: 'POST',
      body: { action: 'start-phone-otp', role: 'employer', phone: '+6591234567' }
    });
    expect([501, 503]).toContain(phoneStatus.response.status());

    await page.locator('[data-view="company"]').click();
    await page.locator('#company-name-input').fill(`E2E Climate Employer ${stamp}`);
    await page.locator('#company-website-input').fill('https://crossovertalent.asia');
    await page.locator('#company-sector-input').selectOption('Climate');
    await page.locator('#company-location-input').fill('Singapore');
    await page.locator('#company-description-input').fill('Enterprise E2E employer profile.');
    await page.locator('#save-company-profile').click();
    await expect(page.locator('#toast')).toContainText('Company profile saved');

    await page.locator('#new-job-button').click();
    const jobForm = page.locator('#job-form');
    await jobForm.locator('[name="title"]').fill(`E2E Climate Role ${stamp}`);
    await jobForm.locator('[name="department"]').fill('Climate finance');
    await jobForm.locator('[name="location"]').fill('Singapore');
    await jobForm.locator('[name="salary"]').fill('90000 - 120000');
    await jobForm.locator('[name="sector"]').selectOption('Climate');
    await jobForm.locator('[name="experience"]').selectOption('Manager');
    await jobForm.locator('[name="impactArea"]').fill('Adaptation finance');
    await jobForm.locator('[name="description"]').fill('Lead climate finance hiring and adaptation partnerships.');
    await page.locator('#job-submit').click();
    await expect(page.locator('#job-dialog')).toBeHidden();
    await expect(page.locator('#main-content')).toContainText(`E2E Climate Role ${stamp}`);

    const publicJobs = await api(request, '/api/jobs?public=1');
    job = publicJobs.data.jobs.find((item) => item.title === `E2E Climate Role ${stamp}`);
    expect(job).toBeTruthy();
    expect(job.status).toBe('active');
  });

  test('public search, filters, pagination, company listing, and job detail', async ({ page }) => {
    await page.goto('/?jobs=1');
    await expectAssistantPrompt(page, 'What should I do first?');
    await page.getByPlaceholder('Search jobs, companies, or locations').fill(`E2E Climate Role ${stamp}`);
    await expect(page.getByText(job.title)).toBeVisible();
    await page.getByLabel('Filter by sector').selectOption('Climate');
    await expect(page.getByText(job.title)).toBeVisible();
    await page.getByRole('button', { name: 'View details' }).first().click();
    await expect(page.getByText('Apply now')).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();
    await page.getByPlaceholder('Search jobs, companies, or locations').fill(`E2E Climate Employer ${stamp}`);
    await page.getByRole('button', { name: 'Companies' }).click();
    await expect(page.locator('#public-market').getByText(`E2E Climate Employer ${stamp}`)).toBeVisible();
  });

  test('candidate signup, save a job, and apply through the dashboard', async ({ request, page }) => {
    await page.goto('/');
    await page.locator('#hero-submit-cv').click();
    await page.locator('#candidate-auth-form [name="name"]').fill(`E2E Candidate ${stamp}`);
    await page.locator('#candidate-auth-form [name="email"]').fill(candidateEmail);
    await page.locator('#candidate-auth-form [name="password"]').fill(password);
    await page.locator('#candidate-auth-submit').click();
    await verifyRegistrationLink(page, '#candidate-auth-subtitle');
    await page.locator('#candidate-auth-switch').click();
    await page.locator('#candidate-auth-form [name="email"]').fill(candidateEmail);
    await page.locator('#candidate-auth-form [name="password"]').fill(password);
    await page.locator('#candidate-auth-submit').click();
    await expect(page.locator('#candidate-app')).toBeVisible();
    await expectAssistantPrompt(page, 'How do I upload my CV?');

    const anonymousUpload = await api(request, '/api/assist', {
      method: 'POST',
      body: {
        action: 'parse-document',
        file: { name: 'cv.txt', type: 'text/plain', size: 20, purpose: 'cv', data: Buffer.from('Anonymous CV content').toString('base64') }
      }
    });
    expect(anonymousUpload.response.status()).toBe(401);

    const candidateLogin = await api(request, '/api/candidate', {
      method: 'POST',
      body: { action: 'login', email: candidateEmail, password }
    });
    expect(candidateLogin.response.ok()).toBeTruthy();
    candidateCookie = candidateLogin.cookie;
    const parsed = await parseTxtUpload(request, 'Climate finance CV with partnerships and analytics experience.', 'cv', candidateCookie);
    cvAttachmentId = parsed.file.id;
    expect(parsed.text).toContain('Climate finance CV');
    const savedProfile = await api(request, '/api/candidate', {
      method: 'POST',
      cookie: candidateCookie,
      body: { action: 'profile', resume: parsed.text, resumeAttachmentId: parsed.file.id }
    });
    expect(savedProfile.response.ok()).toBeTruthy();
    expect(savedProfile.data.candidate.resumeAttachment.id).toBe(parsed.file.id);
    const privateFile = await request.get(`/api/files?id=${encodeURIComponent(parsed.file.id)}`, { headers: { cookie: candidateCookie } });
    expect(privateFile.status()).toBe(200);
    expect(await privateFile.text()).toContain('Climate finance CV');
    expect(privateFile.headers()['cache-control']).toBe('private, no-store');
    const signedFileResponse = await request.get(`/api/files?id=${encodeURIComponent(parsed.file.id)}`, {
      headers: { cookie: candidateCookie },
      maxRedirects: 0
    });
    expect(signedFileResponse.status()).toBe(302);
    const signedFileUrl = signedFileResponse.headers().location;
    expect(signedFileUrl).toBeTruthy();
    if (signedFileUrl.startsWith('/api/files?token=')) {
      const signedToken = new URL(signedFileUrl, 'http://127.0.0.1:3000').searchParams.get('token');
      const tamperedToken = `${signedToken[0] === 'a' ? 'b' : 'a'}${signedToken.slice(1)}`;
      const tamperedFile = await request.get(`/api/files?token=${encodeURIComponent(tamperedToken)}`);
      expect(tamperedFile.status()).toBe(404);
    }
    const anonymousRequest = await playwrightRequest.newContext();
    const anonymousFile = await anonymousRequest.get(`/api/files?id=${encodeURIComponent(parsed.file.id)}`);
    expect(anonymousFile.status()).toBe(401);
    await anonymousRequest.dispose();
    const otherCandidateEmail = uniqueEmail('e2e-other-candidate');
    const otherCandidateRegistration = await api(request, '/api/candidate', {
      method: 'POST',
      body: { action: 'register', name: 'Other E2E Candidate', email: otherCandidateEmail, password }
    });
    if (otherCandidateRegistration.data.verificationUrl) {
      await api(request, otherCandidateRegistration.data.verificationUrl, { cookie: otherCandidateRegistration.cookie });
    }
    const otherCandidate = await api(request, '/api/candidate', {
      method: 'POST',
      body: { action: 'login', email: otherCandidateEmail, password }
    });
    expect(otherCandidate.response.ok()).toBeTruthy();
    const foreignCandidateFile = await api(request, `/api/files?id=${encodeURIComponent(parsed.file.id)}`, { cookie: otherCandidate.cookie });
    expect(foreignCandidateFile.response.status()).toBe(404);
    const wrongOwnerUpload = await api(request, '/api/candidate', {
      method: 'POST',
      cookie: candidateCookie,
      body: { action: 'profile', resumeAttachmentId: '00000000-0000-4000-8000-000000000000' }
    });
    expect(wrongOwnerUpload.response.status()).toBe(403);

    await page.reload();
    await expect(page.locator('#candidate-app')).toBeVisible();
    await page.getByRole('link', { name: 'Browse job board' }).click();
    const publicJob = page.locator('.public-job').filter({ hasText: job.title });
    await expect(publicJob).toBeVisible();
    await publicJob.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(publicJob.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();

    await page.goto('/?candidate=dashboard');
    await expect(page.locator('#candidate-app')).toBeVisible();
    await page.locator('[data-candidate-view="saved"]').click();
    const savedJob = page.locator('#candidate-content .public-job').filter({ hasText: job.title });
    await expect(savedJob).toBeVisible();
    await savedJob.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.locator('#apply-form [name="coverLetter"]').fill('I am excited to contribute to this climate finance team.');
    await page.locator('#apply-form [type="submit"]').click();
    await expect(page.locator('#apply-dialog')).toBeHidden();

    await page.locator('[data-candidate-view="applications"]').click();
    const candidateApplication = page.locator('#candidate-content tr').filter({ hasText: job.title });
    await expect(candidateApplication).toContainText('Applied');

    const candidate = await api(request, '/api/candidate', {
      method: 'POST',
      body: { action: 'login', email: candidateEmail, password }
    });
    expect(candidate.response.ok()).toBeTruthy();
    candidateCookie = candidate.cookie;
    const applications = await api(request, '/api/candidate', { cookie: candidateCookie });
    const application = applications.data.applications.find((item) => item.job_id === job.id);
    expect(application).toBeTruthy();
    expect(application.email).toBe(candidateEmail);
    expect(application.cvAttachment.id).toBe(cvAttachmentId);
    applicationId = application.id;
  });

  test('employer reviews an application and both dashboards show its updated status', async ({ page }) => {
    await signInThroughForm(page, 'candidate', candidateEmail);
    await page.locator('[data-candidate-view="applications"]').click();
    const candidateApplication = page.locator('#candidate-content tr').filter({ hasText: job.title });
    await expect(candidateApplication).toContainText('Applied');

    const employerPage = await page.context().browser().newPage();
    await signInThroughForm(employerPage, 'employer', employerEmail);
    await employerPage.locator('[data-view="applications"]').click();
    const employerApplication = employerPage.locator('#main-content tr[data-application]').filter({ hasText: candidateEmail });
    await expect(employerApplication).toContainText(job.title);
    await employerApplication.click();
    await expect(employerPage.locator('#application-dialog')).toBeVisible();
    await employerPage.locator('#application-status').selectOption('shortlisted');
    await employerPage.locator('#save-status').click();
    await expect(employerPage.locator('#application-dialog')).toBeHidden();
    await expect(employerPage.locator('#main-content tr[data-application]').filter({ hasText: candidateEmail })).toContainText('Shortlisted');

    await page.reload();
    await expect(page.locator('#candidate-app')).toBeVisible();
    await page.locator('[data-candidate-view="applications"]').click();
    await expect(page.locator('#candidate-content tr').filter({ hasText: job.title })).toContainText('Shortlisted');
    await employerPage.close();
  });

  test('employer application API includes the candidate application', async ({ request }) => {
    const applications = await api(request, '/api/applications', { cookie: employerCookie });
    expect(applications.response.ok()).toBeTruthy();
    expect(applications.data.applications.some((item) => item.id === applicationId)).toBeTruthy();
    const privateFile = await request.get(`/api/files?id=${encodeURIComponent(cvAttachmentId)}`, { headers: { cookie: employerCookie } });
    expect(privateFile.status()).toBe(200);
    expect(await privateFile.text()).toContain('Climate finance CV');
  });

  test('unrelated employer cannot download a candidate CV', async ({ request }) => {
    const denied = await api(request, `/api/files?id=${encodeURIComponent(cvAttachmentId)}`, { cookie: unrelatedEmployerCookie });
    expect(denied.response.status()).toBe(404);
  });

  test('candidate creates review and salary signal', async ({ request }) => {
    const review = await api(request, '/api/reviews', {
      method: 'POST',
      cookie: candidateCookie,
      body: {
        company: `E2E Climate Employer ${stamp}`,
        companyUrl: 'https://crossovertalent.asia',
        sector: 'Climate',
        role: 'Climate Manager',
        location: 'Singapore',
        rating: '5',
        salary: '90000 - 120000',
        headline: 'Strong enterprise test workflow',
        pros: 'Clear mission and strong hiring process.',
        cons: 'Still in release candidate validation.',
        advice: 'Keep operational dashboards visible.',
        displayMode: 'anonymous'
      }
    });
    expect(review.response.status()).toBe(201);
    reviewId = review.data.review.id;

    const salary = await api(request, '/api/salary-signals', {
      method: 'POST',
      cookie: candidateCookie,
      body: {
        company: `E2E Climate Employer ${stamp}`,
        role: 'Climate Manager',
        location: 'Singapore',
        level: 'Manager',
        sector: 'Climate',
        currency: 'USD',
        salaryMin: '90000',
        salaryMax: '120000',
        workType: 'Full-time'
      }
    });
    expect(salary.response.status()).toBe(201);
  });

  test('admin login, review moderation, job moderation, and user management', async ({ request, page }) => {
    if (!adminCookie) {
      const admin = await registerVerifyLogin(request, '/api/admin', {
        action: 'register',
        name: `E2E Admin ${stamp}`,
        email: adminEmail,
        password
      });
      adminCookie = admin.cookie;
    }
    await page.goto('/?admin=1');
    await page.locator('#admin-email-input').fill(adminEmail);
    await page.locator('#admin-password-input').fill(password);
    await page.locator('#admin-auth-submit').click();
    await expect(page.locator('#admin-screen')).toBeVisible();
    await expectAssistantPrompt(page, 'Where do I approve employers?');

    const hideReview = await api(request, '/api/admin', { method: 'PATCH', cookie: adminCookie, body: { action: 'review-moderation', id: reviewId, hidden: true } });
    expect(hideReview.response.ok()).toBeTruthy();

    const moderateJob = await api(request, '/api/admin', { method: 'PATCH', cookie: adminCookie, body: { action: 'job-moderation', id: job.id, status: 'closed' } });
    expect(moderateJob.response.ok()).toBeTruthy();

    const disableUser = await api(request, '/api/admin', { method: 'PATCH', cookie: adminCookie, body: { action: 'user-status', role: 'candidate', email: candidateEmail, disabled: true } });
    expect(disableUser.response.ok()).toBeTruthy();

    const dashboard = await api(request, '/api/admin', { cookie: adminCookie });
    expect(dashboard.response.ok()).toBeTruthy();
    expect(dashboard.data.metrics).toBeTruthy();
    expect(Number(dashboard.data.metrics.totalJobs || 0)).toBeGreaterThan(0);
  });
});
