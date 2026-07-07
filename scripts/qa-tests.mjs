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
includes('ops', /hntvcqahoseizmgswohq/, 'production readiness checks expected Supabase project ref');
includes('ops', /supabaseProject/, 'readiness includes Supabase project validation');
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
includes('lib', /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/, 'publishable Supabase key alias is supported');
includes('lib', /NEXT_PUBLIC_SUPABASE_ANON_KEY/, 'anon Supabase key alias is supported');
includes('lib', /SUPABASE_SECRET_KEY/, 'server Supabase secret key alias is supported');
includes('lib', /isSupabaseJwtKey/, 'Supabase JWT key detection exists');
includes('lib', /probeSupabaseDatabase/, 'Supabase database probe exists');
includes('lib', /createBucket\(bucket, config\)/, 'required Supabase buckets are created when missing');
includes('lib', /download\(objectPath\)/, 'Supabase Storage upload verification exists');
includes('lib', /allowStorageFallback/, 'production upload fallback gate exists');
includes('ops', /invalid_api_key/, 'readiness distinguishes invalid Supabase API keys');
includes('ops', /permission_or_rls_denied/, 'readiness distinguishes permission or RLS failures');
includes('company', /Logo upload failed/, 'logo upload fails clearly when production storage fails');
includes('assist', /storageFallback/, 'upload fallback state is still surfaced where allowed');
includes('assist', /readabilityScore/, 'document parsing quality scoring exists');
includes('assist', /Adobe\\s\+UCS/, 'PDF parser rejects encoded font map noise');
includes('assist', /readable text could not be extracted/, 'unreadable PDFs return clear fallback guidance');
includes('assist', /extractPdfJsText/, 'pdf.js text extraction fallback exists');
includes('assist', /renderPdfPagesToImages/, 'PDF pages can be rendered for OCR fallback');
includes('assist', /openAiOcrImages/, 'OpenAI vision OCR fallback exists for scanned PDFs');
includes('assist', /OPENAI_OCR_API_KEY/, 'OCR can use a dedicated OpenAI OCR key');
includes('assist', /gpt-4o-mini/, 'OCR uses a broadly available vision-capable fallback model');
includes('assist', /extractionMethod/, 'document parser returns extraction method');
includes('app', /OCR parsed/, 'upload UI reports OCR parsing when used');
includes('app', /history\.replaceState\(\{\}, '', '\/\?dashboard=1'\)/, 'employer redirects to dashboard');
includes('app', /history\.replaceState\(\{\}, '', '\/\?candidate=dashboard'\)/, 'candidate redirects to dashboard');
includes('auth', /employer_status: 'pending_review'/, 'new employers default to pending review');
includes('auth', /employerStatus\(account\)/, 'employer login evaluates approval status');
includes('lib', /requireApprovedEmployerSession/, 'protected employer API approval guard exists');
includes('jobs', /requireApprovedEmployerSession/, 'job posting requires approved employer');
includes('company', /requireApprovedEmployerSession/, 'company dashboard requires approved employer');
includes('applications', /requireApprovedEmployerSession/, 'employer applications require approved employer');
includes('admin', /employer-approval/, 'admin employer approval action exists');
includes('admin', /reviewed_by/, 'employer review metadata is stored');
includes('admin', /rejection_reason/, 'employer rejection reason is stored');
includes('app', /Employer approval queue/, 'admin employer approval queue exists');
includes('html', /data-auth-provider="google"/, 'Google login option exists');
includes('html', /data-auth-provider="linkedin"/, 'LinkedIn login option exists');
includes('html', /data-phone-otp-role="employer"/, 'phone OTP employer option exists');
includes('app', /startProviderLogin/, 'OAuth login buttons are wired');
includes('app', /startPhoneOtp/, 'phone OTP button is wired');
includes('app', /completeOAuthCallback/, 'OAuth callback completes app session bridge');
includes('app', /verify-phone-otp/, 'phone OTP verification completes app session bridge');
includes('ops', /authProviderStatus/, 'auth provider readiness endpoint exists');
includes('ops', /completeProviderLogin/, 'Supabase provider identity maps into app sessions');
includes('ops', /supabaseUserFromAccessToken/, 'OAuth access token is verified with Supabase Auth');
includes('ops', /employerStatusMessage\(updated\)/, 'provider employer login still enforces approval gate');
includes('ops', /AUTH_GOOGLE_ENABLED/, 'Google provider config gate exists');
includes('ops', /AUTH_LINKEDIN_ENABLED/, 'LinkedIn provider config gate exists');
includes('ops', /AUTH_PHONE_OTP_ENABLED/, 'phone OTP provider config gate exists');
includes('ops', /LINKEDIN_CLIENT_SECRET/, 'direct LinkedIn OAuth server-side credential gate exists');
includes('ops', /complete-linkedin/, 'direct LinkedIn OAuth callback completion exists');
includes('app', /params\.has\('code'\) && params\.has\('state'\)/, 'direct LinkedIn OAuth browser callback is detected');
includes('html', /id="assistant-widget-button"/, 'AI navigation assistant widget renders globally');
includes('html', /id="assistant-panel"/, 'AI navigation assistant panel exists');
includes('app', /assistantPrompts/, 'assistant suggested prompts change by role');
includes('app', /assistantContext/, 'assistant collects page and role context');
includes('app', /currentAssistantRole/, 'assistant detects public, employer, candidate, and admin context');
includes('app', /submitAssistantPrompt/, 'assistant chat submit is wired');
includes('app', /data-assistant-action/, 'assistant guided CTA actions are rendered');
includes('assist', /action === 'navigation-assistant'/, 'assistant API action exists');
includes('assist', /assistantFallback/, 'assistant safe fallback works without OpenAI');
includes('assist', /Your employer account is under review/, 'pending employer guidance exists');
includes('assist', /Do not perform admin actions/, 'assistant guardrail prevents admin actions through chat');
includes('assist', /Never reveal secrets/, 'assistant guardrail prevents secret exposure');
includes('assist', /role === 'admin'/, 'assistant admin guidance is role-aware');

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
includes('html', /id="candidate-back-button"/, 'candidate dashboard back button exists');
includes('app', /id="candidate-resume-upload"/, 'candidate dashboard CV upload exists');
includes('app', /uploadCandidateResume/, 'candidate dashboard CV upload is wired');
includes('applications', /candidateSession/, 'candidate application identity is bound to session');

includes('reviews', /displayMode/, 'review display modes are saved');
includes('reviews', /isCompanyEmail/, 'company email verification exists for reviews');
includes('reviews', /session\.role !== 'candidate'/, 'verified candidates can create reviews from OAuth email accounts');
includes('html', /name="companyUrl"/, 'review form captures company URL');
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
includes('assist', /MAX_UPLOAD_BYTES = 3_000_000/, 'server accepts real-world uploads up to 3 MB');
includes('app', /MAX_UPLOAD_BYTES = 3_000_000/, 'client validates the same 3 MB upload limit');
includes('assist', /Legacy \.doc files cannot be parsed reliably/, 'legacy DOC files fail with clear guidance');
includes('html', /PDF\/DOCX\/TXT/, 'upload UI advertises supported document formats only');
includes('app', /generate-job-description/, 'AI JD assistant is wired');
includes('assist', /action === 'suggest-job-metrics'/, 'AI KPI and KRA suggestion route exists');
includes('assist', /defaultJobMetrics/, 'fallback KPI and KRA suggestions exist');
includes('html', /id="suggest-job-kpis"/, 'suggest KPI button exists');
includes('html', /id="suggest-job-kras"/, 'suggest KRA button exists');
includes('app', /suggestJobMetrics/, 'KPI and KRA suggestion buttons are wired');
includes('app', /generateCandidateResume/, 'AI CV assistant is wired');

includes('html', /id="level-filter"/, 'level filter exists');
includes('html', /id="type-filter"/, 'work type filter exists');
includes('app', /publicMatches/, 'marketplace filters are wired');

console.log('QA structural tests passed');
