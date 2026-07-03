import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  app: await readFile('outputs/app.js', 'utf8'),
  html: await readFile('outputs/index.html', 'utf8'),
  lib: await readFile('api/_lib.js', 'utf8'),
  assist: await readFile('api/assist.js', 'utf8'),
  auth: await readFile('api/auth.js', 'utf8'),
  jobs: await readFile('api/jobs.js', 'utf8'),
  applications: await readFile('api/applications.js', 'utf8'),
  admin: await readFile('api/admin.js', 'utf8'),
  company: await readFile('api/company.js', 'utf8'),
  ops: await readFile('api/ops.js', 'utf8'),
  candidate: await readFile('api/candidate.js', 'utf8'),
  reviews: await readFile('api/reviews.js', 'utf8'),
  salaries: await readFile('api/salary-signals.js', 'utf8')
};
files.vercel = await readFile('vercel.json', 'utf8');
files.seed = await readFile('scripts/staging-seed.mjs', 'utf8');

function includes(file, pattern, label) {
  assert.match(files[file], pattern, label);
}

includes('auth', /action === 'register'/, 'employer signup route exists');
includes('auth', /verifyPassword\(password, account\.passwordHash\)/, 'employer login route exists');
includes('candidate', /action === 'register'/, 'job seeker signup route exists');
includes('candidate', /\['register', 'login'\]\.includes\(action\)/, 'job seeker login route exists');
includes('admin', /role: 'admin'/, 'admin account route exists');
includes('admin', /adminMetrics/, 'admin QA metrics route exists');
includes('admin', /systemHealth/, 'admin operational system health metrics exist');
includes('admin', /failedLogins/, 'admin failed login metrics exist');
includes('app', /Reliability and usage/, 'admin operational dashboard renders reliability metrics');
includes('admin', /supportTickets/, 'admin feedback inbox data exists');
includes('ops', /support_ticket/, 'support ticket API stores feedback records');
includes('html', /id="support-widget-button"/, 'support widget button exists');
includes('html', /id="support-form"/, 'support form exists');
includes('app', /support-dialog/, 'support widget is wired');
includes('app', /updateSupportTicket/, 'admin can update support tickets');
includes('app', /notification-panel/, 'notification center is wired');
includes('app', /skeleton-card/, 'skeleton loading state exists');
includes('app', /Employer onboarding tour/, 'employer onboarding tour exists');
includes('app', /Candidate onboarding tour/, 'candidate onboarding tour exists');
includes('app', /Admin onboarding tour/, 'admin onboarding tour exists');
includes('html', /og:title/, 'Open Graph metadata exists');
includes('html', /twitter:card/, 'Twitter card metadata exists');
includes('html', /application\/ld\+json/, 'structured data exists');
includes('html', /id="pricing"/, 'pricing placeholders are integrated');
includes('html', /id="faq"/, 'FAQ content is integrated');
includes('html', /href="\/privacy\.html"/, 'privacy link exists');
includes('ops', /applicationStatusChanged/, 'commercial email templates exist');
includes('vercel', /sitemap\.xml/, 'sitemap route exists');
includes('vercel', /robots\.txt/, 'robots route exists');
includes('ops', /verificationToken/, 'email verification endpoint exists');
includes('auth', /resend-verification/, 'employer verification resend exists');
includes('candidate', /resend-verification/, 'candidate verification resend exists');
includes('admin', /resend-verification/, 'admin verification resend exists');
includes('company', /company_profile/, 'company profile route exists');
includes('company', /MAX_LOGO_BYTES/, 'company logo upload validation exists');
includes('lib', /createClient\(base, key/, 'Supabase Storage client is used for uploads');
includes('lib', /createBucket\(bucket, config\)/, 'required Supabase buckets are created when missing');
includes('lib', /download\(objectPath\)/, 'Supabase Storage upload verification exists');
includes('lib', /allowStorageFallback/, 'production upload fallback gate exists');
includes('company', /Logo upload failed/, 'logo upload fails clearly when production storage fails');
includes('assist', /storageFallback/, 'upload fallback state is still surfaced where allowed');
includes('app', /history\.replaceState\(\{\}, '', '\/\?dashboard=1'\)/, 'employer redirects to dashboard');
includes('app', /history\.replaceState\(\{\}, '', '\/\?candidate=dashboard'\)/, 'candidate redirects to dashboard');

includes('jobs', /request\.method === 'POST'/, 'job posting route exists');
includes('jobs', /request\.method === 'PATCH'/, 'job edit and publish route exists');
includes('jobs', /request\.method === 'DELETE'/, 'job delete route exists');
includes('app', /data-job-toggle/, 'publish/unpublish control exists');
includes('app', /data-job-share/, 'copy job board link control exists');

includes('applications', /status: 'applied'/, 'applications default to Applied status');
includes('applications', /shortlisted/, 'shortlisted status is accepted');
includes('applications', /withdrawn/, 'candidate withdrawal status is accepted');
includes('app', /data-withdraw-application/, 'candidate withdrawal control exists');
includes('app', /openJobDetail/, 'public job detail flow exists');
includes('app', /toggleSaveJob/, 'saved jobs flow exists');

includes('reviews', /displayMode/, 'review display modes are saved');
includes('reviews', /isCompanyEmail/, 'company email verification exists for reviews');
includes('reviews', /request\.method === 'PATCH'/, 'review edit route exists');
includes('admin', /review-moderation/, 'admin review moderation exists');
includes('admin', /job-moderation/, 'admin job moderation exists');
includes('admin', /user-status/, 'admin user status management exists');
includes('salaries', /recordType: 'salary_signal'/, 'salary signal records are stored separately');
includes('salaries', /aggregates/, 'salary aggregates are returned publicly');
includes('app', /paginationControls/, 'pagination controls exist');
includes('app', /renderAdminDashboard/, 'admin dashboard UI exists');
includes('seed', /for \(let i = 0; i < 100; i \+= 1\)/, 'staging seed creates 100 jobs');
includes('seed', /for \(let i = 0; i < 50; i \+= 1\)/, 'staging seed creates 50 applications');

includes('html', /id="job-attachment"/, 'JD upload control exists');
includes('html', /id="cv-attachment"/, 'CV upload control exists');
includes('app', /generate-job-description/, 'AI JD assistant is wired');
includes('app', /generateCandidateResume/, 'AI CV assistant is wired');

includes('html', /id="level-filter"/, 'level filter exists');
includes('html', /id="type-filter"/, 'work type filter exists');
includes('app', /publicMatches/, 'marketplace filters are wired');

console.log('QA structural tests passed');
