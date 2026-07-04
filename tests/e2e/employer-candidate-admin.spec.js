import { test, expect } from '@playwright/test';
import { api, parseTxtUpload, password, registerVerifyLogin, uniqueEmail } from './fixtures.js';

test.describe.serial('Crossover Talent E2E release candidate workflows', () => {
  const stamp = Date.now();
  const employerEmail = uniqueEmail('e2e-employer');
  const candidateEmail = uniqueEmail('e2e-candidate');
  const adminEmail = `qa-admin-e2e-${stamp}@crossovertalent.asia`;
  let employerCookie = '';
  let candidateCookie = '';
  let adminCookie = '';
  let job;
  let applicationId;
  let reviewId;

  test('employer signup, verification, login, company logo, and job lifecycle', async ({ request, page }) => {
    const admin = await registerVerifyLogin(request, '/api/admin', {
      action: 'register',
      name: `E2E Admin ${stamp}`,
      email: adminEmail,
      password
    });
    adminCookie = admin.cookie;

    let employer = await api(request, '/api/auth', {
      method: 'POST',
      body: {
        action: 'register',
        company: `E2E Climate Employer ${stamp}`,
        email: employerEmail,
        password
      }
    });
    expect(employer.response.status()).toBe(202);
    expect(employer.data.employer_status).toBe('pending_review');
    if (employer.data.verificationUrl) {
      const verify = await api(request, employer.data.verificationUrl, { cookie: employer.cookie });
      expect(verify.response.ok()).toBeTruthy();
    }

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

    employer = await api(request, '/api/auth', {
      method: 'POST',
      body: {
        action: 'login',
        email: employerEmail,
        password
      }
    });
    expect(employer.response.ok()).toBeTruthy();
    expect(employer.data.user.employer_status).toBe('approved');
    employerCookie = employer.cookie;

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
      cookie: pendingSession.cookie,
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

    /*
    const employer = await registerVerifyLogin(request, '/api/auth', {
      action: 'register',
      company: `E2E Climate Employer ${stamp}`,
      email: employerEmail,
      password
    });
    employerCookie = employer.cookie;
    */

    const logo = Buffer.from('enterprise logo').toString('base64');
    const company = await api(request, '/api/company', {
      method: 'PATCH',
      cookie: employerCookie,
      body: {
        company: `E2E Climate Employer ${stamp}`,
        website: 'https://crossovertalent.asia',
        sector: 'Climate',
        location: 'Singapore',
        description: 'Enterprise E2E employer profile.',
        logo: { name: 'logo.png', type: 'image/png', size: 64, data: logo }
      }
    });
    expect(company.response.ok()).toBeTruthy();
    expect(company.data.profile.company).toContain('E2E Climate Employer');

    const created = await api(request, '/api/jobs', {
      method: 'POST',
      cookie: employerCookie,
      body: {
        title: `E2E Climate Role ${stamp}`,
        department: 'Climate',
        location: 'Singapore',
        type: 'Full-time',
        salary: '90000 - 120000',
        sector: 'Climate',
        experience: 'Manager',
        impactArea: 'Adaptation finance',
        description: 'Lead enterprise release candidate climate hiring workflow.'
      }
    });
    expect(created.response.status()).toBe(201);
    job = created.data.job;

    const editedJobPayload = {
      id: job.id,
      title: `${job.title} Edited`,
      department: job.department,
      location: job.location,
      type: job.type,
      salary: job.salary,
      sector: job.sector,
      experience: job.experience,
      impactArea: job.impactArea,
      description: `${job.description} Edited.`
    };
    const edited = await api(request, '/api/jobs', {
      method: 'PATCH',
      cookie: employerCookie,
      body: editedJobPayload
    });
    expect(edited.response.ok()).toBeTruthy();
    job = edited.data.job;
    expect(job.title).toContain('Edited');

    const unpublish = await api(request, '/api/jobs', { method: 'PATCH', cookie: employerCookie, body: { id: job.id, status: 'closed' } });
    expect(unpublish.response.ok()).toBeTruthy();
    const publish = await api(request, '/api/jobs', { method: 'PATCH', cookie: employerCookie, body: { id: job.id, status: 'active' } });
    expect(publish.response.ok()).toBeTruthy();

    await page.goto('/?jobs=1');
    await expect(page.getByText(job.title)).toBeVisible();
  });

  test('public search, filters, pagination, company listing, and job detail', async ({ page }) => {
    await page.goto('/?jobs=1');
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

  test('candidate signup, CV upload, save job, apply, withdraw, and track status', async ({ request }) => {
    const candidate = await registerVerifyLogin(request, '/api/candidate', {
      action: 'register',
      name: `E2E Candidate ${stamp}`,
      email: candidateEmail,
      password,
      linkedin: `https://www.linkedin.com/in/e2ecandidate${stamp}`
    });
    candidateCookie = candidate.cookie;

    const parsed = await parseTxtUpload(request, 'Climate finance CV with partnerships and analytics experience.', 'cv');
    expect(parsed.text).toContain('Climate finance CV');

    const saved = await api(request, '/api/candidate', { method: 'POST', cookie: candidateCookie, body: { action: 'save-job', jobId: job.id } });
    expect(saved.response.ok()).toBeTruthy();
    expect(saved.data.candidate.savedJobs).toContain(job.id);

    const applied = await api(request, '/api/applications', {
      method: 'POST',
      cookie: candidateCookie,
      body: {
        jobId: job.id,
        name: `E2E Candidate ${stamp}`,
        email: candidateEmail,
        linkedin: `https://www.linkedin.com/in/e2ecandidate${stamp}`,
        coverLetter: 'I am excited to test this enterprise release candidate workflow.',
        cvText: parsed.text,
        cvAttachment: parsed.file
      }
    });
    expect(applied.response.status()).toBe(201);

    const applications = await api(request, '/api/candidate', { cookie: candidateCookie });
    expect(applications.response.ok()).toBeTruthy();
    const application = applications.data.applications.find((item) => item.job_id === job.id);
    expect(application).toBeTruthy();
    applicationId = application.id;

    const withdraw = await api(request, '/api/applications', { method: 'PATCH', cookie: candidateCookie, body: { action: 'withdraw', id: applicationId } });
    expect(withdraw.response.ok()).toBeTruthy();

    const tracked = await api(request, '/api/candidate', { cookie: candidateCookie });
    expect(tracked.data.applications.find((item) => item.id === applicationId).status).toBe('withdrawn');
  });

  test('employer views applications and updates status', async ({ request }) => {
    const applications = await api(request, '/api/applications', { cookie: employerCookie });
    expect(applications.response.ok()).toBeTruthy();
    expect(applications.data.applications.some((item) => item.id === applicationId)).toBeTruthy();
    const status = await api(request, '/api/applications', { method: 'PATCH', cookie: employerCookie, body: { id: applicationId, status: 'rejected' } });
    expect(status.response.ok()).toBeTruthy();
  });

  test('candidate creates review and salary signal', async ({ request }) => {
    const review = await api(request, '/api/reviews', {
      method: 'POST',
      cookie: candidateCookie,
      body: {
        company: `E2E Climate Employer ${stamp}`,
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

  test('admin login, review moderation, job moderation, and user management', async ({ request }) => {
    if (!adminCookie) {
      const admin = await registerVerifyLogin(request, '/api/admin', {
        action: 'register',
        name: `E2E Admin ${stamp}`,
        email: adminEmail,
        password
      });
      adminCookie = admin.cookie;
    }

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
