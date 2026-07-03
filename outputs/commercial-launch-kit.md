# CrossOver Talent Commercial Launch Kit

Date: July 3, 2026  
Product: CrossOver Talent - Impact Career Intelligence  
Launch stage: Controlled commercial launch preparation  
Decision: Do not deploy publicly until manual production infrastructure gates pass.

## Executive Position

CrossOver Talent is commercially ready for a controlled public beta and founder-led sales motion. Engineering is feature complete for Version 1.0. The remaining launch work is operational: production Supabase, transactional email, custom domain, monitoring, final smoke tests, and product-owner go/no-go approval.

This launch kit focuses on commercial readiness: positioning, conversion, onboarding, help center, email templates, customer success, launch communications, investor demo flow, launch metrics, and the 30/90-day operating plan.

## Launch Checklist

### Production Infrastructure Gate

- Production Supabase project created.
- Production schema/migrations applied.
- Production storage buckets configured.
- RLS/security negative tests passed.
- Resend sending domain verified.
- Verification/password reset/employer/candidate notification emails tested.
- OpenAI key configured or fallback-only mode explicitly accepted.
- Vercel production environment variables configured.
- Custom domain and SSL active.
- Sentry/monitoring alert routing confirmed.
- `/api/health` returns healthy.
- `/api/ready` returns ready.
- Production smoke test passes.
- No open P0/P1 bugs.

### Commercial Gate

- Homepage copy approved.
- Pricing placeholders approved.
- Sales target list prepared.
- Support inbox owner assigned.
- Beta invite list prepared.
- Known issues approved for launch.
- Customer onboarding scripts prepared.
- Demo environment seeded.
- Investor demo checklist rehearsed.

## Landing Page Optimization

### Primary Messaging

Recommended headline:

> The career intelligence platform for climate, healthcare, impact capital, and public-good talent.

Recommended subheadline:

> CrossOver Talent helps mission-driven employers post roles, manage applications, understand talent signals, and connect with candidates across climate, impact investment, public healthcare, agriculture, water, education, clean energy, foundations, circular economy, CSR, and ESG consulting.

### Employer Value Proposition

Core promise:
- Post impact-sector roles quickly.
- Manage applicants in one workspace.
- Use AI to draft better job descriptions.
- Receive applications directly.
- Build employer trust through company profiles, reviews, salary signals, and mission context.

Employer CTA:
- Primary: `Post your first impact role`
- Secondary: `Book an employer walkthrough`

### Candidate Value Proposition

Core promise:
- Browse impact jobs across high-growth public-good sectors.
- Save roles and track applications.
- Upload CVs and improve resume positioning.
- Compare company reviews and salary signals.
- Apply directly without losing track of status.

Candidate CTA:
- Primary: `Explore impact jobs`
- Secondary: `Create job seeker profile`

### Social Proof Placeholders

Use only placeholders until real proof exists:
- `Launching with selected employers across climate, health, and impact investing.`
- `Built for mission-driven teams hiring across Asia and global public-good markets.`
- `Private beta partners can be listed here after written approval.`

Avoid fake numbers, fake logos, fake testimonials, or “trusted by” claims without permission.

### FAQ

**Who is CrossOver Talent for?**  
Employers, recruiters, and candidates working in climate, impact investment, public healthcare, agriculture, water, education, clean energy, foundations, circular economy, CSR, and ESG consulting.

**Is this a job board or an intelligence platform?**  
Both. Version 1.0 includes job posting, applications, company profiles, reviews, salary signals, AI helpers, and operational dashboards.

**Can employers manage applicants?**  
Yes. Employers can view applications and update candidate statuses.

**Can candidates track applications?**  
Yes. Candidates can save jobs, apply, withdraw applications, and track status.

**Are reviews anonymous?**  
Users can choose anonymous, display name, or LinkedIn display modes. Reviews are moderated.

**Does AI require an API key?**  
Live AI requires OpenAI configuration. If unavailable, the app provides safe fallback messaging/drafts instead of breaking.

**Is pricing live?**  
Not yet. Version 1.0 uses pricing placeholders while subscription plans are finalized.

### Pricing Placeholders

Free:
- Browse jobs.
- Candidate profile.
- Save/apply to jobs.
- Submit reviews and salary signals.

Professional:
- Employer workspace.
- Job posting.
- Application management.
- Company profile.
- AI job description support.
- Basic analytics.

Enterprise:
- Multi-role hiring teams.
- Employer branding.
- Advanced analytics.
- Talent intelligence.
- Custom support.
- Integrations roadmap.

CTA: `Talk to us about early employer access`

### SEO Copy

Target themes:
- Impact jobs Asia.
- Climate careers.
- Public healthcare jobs.
- Impact investment careers.
- ESG consulting jobs.
- Sustainability jobs.
- Clean energy jobs.
- Climate finance talent.
- Social impact recruiting.

Meta description:

> CrossOver Talent is an impact career intelligence platform for climate, impact investment, public healthcare, clean energy, agriculture, water, education, foundations, circular economy, CSR, and ESG consulting roles.

## Conversion Optimization

### Employer Signup Flow

Current flow:
1. Employer starts signup.
2. Enters company, email, password.
3. Verifies email.
4. Creates company profile.
5. Posts job.

Reduce friction:
- Show a three-step promise before signup: create account, complete profile, post first role.
- Keep company profile optional until first job publish, but prompt strongly.
- Add “Need help posting your first role?” link to support widget.
- Make “Generate JD” visible only after required job inputs are entered.

Recommended activation metric:
- Employer activation = employer posts first job.

### Candidate Signup Flow

Current flow:
1. Candidate creates account.
2. Verifies email.
3. Browses/saves jobs.
4. Uploads CV or applies.

Reduce friction:
- Let candidates browse jobs before signup.
- Trigger signup only on save/apply/review/salary signal.
- Explain why CV upload helps matching.
- Preserve job context through login.

Recommended activation metric:
- Candidate activation = candidate saves or applies to a job.

### Admin Signup Flow

Current flow:
- Admin login/register is available but should be tightly controlled.

Reduce friction:
- Production admins should be created manually.
- Avoid public admin registration in production.
- Provide internal checklist for first admin login and dashboard review.

## Product Tours

### Employer Onboarding Tour

Step 1: Welcome  
> Welcome to your employer workspace. Start by completing your company profile so candidates understand your mission.

Step 2: Company profile  
> Add company name, sector, location, website, description, and logo.

Step 3: Post first job  
> Create a role with title, department, location, work type, level, sector, and description.

Step 4: AI JD assistant  
> Add skills, experience, KPIs, and KRAs to generate a clear first draft.

Step 5: Publish and share  
> Publish the role and copy the public job-board link.

Step 6: Manage applications  
> Review candidates and move them through Applied, Shortlisted, Interview, Offered, Rejected, and Hired.

### Candidate Onboarding Tour

Step 1: Browse jobs  
> Search by keyword, sector, location, level, and work type.

Step 2: Save roles  
> Save interesting jobs to revisit later.

Step 3: Upload CV  
> Upload a text-based PDF/DOCX/TXT CV for parsing and application reuse.

Step 4: Improve CV  
> Use the CV assistant to tailor positioning for the role.

Step 5: Apply  
> Submit application and cover letter.

Step 6: Track status  
> See application history and employer status updates in your dashboard.

### Admin Onboarding Tour

Step 1: Operations dashboard  
> Review active employers, candidates, jobs, applications, activation, and reliability.

Step 2: Feedback inbox  
> Triage bug reports, support messages, feedback, and feature requests.

Step 3: Moderation  
> Hide or restore reviews and unpublish inappropriate jobs.

Step 4: User management  
> Enable or disable users when needed.

Step 5: Reliability  
> Check failed logins, email failures, upload failures, AI failures, latency, error rate, and uptime.

## Help Center

### Employers

**How do I create an employer workspace?**  
Sign up with your work email, verify your email, then complete your company profile.

**How do I post a job?**  
Open the employer dashboard, choose Jobs, create a new role, complete required fields, and publish.

**Can I edit a job after publishing?**  
Yes. Open the job from your dashboard, edit fields, and save.

**Can I pause a job?**  
Yes. Use publish/unpublish controls to close or reopen a role.

**How do I view applications?**  
Open Applications in the employer dashboard. You can update candidate status from there.

**How do I improve my job description?**  
Use the JD assistant with skills, experience, KPIs, KRAs, sector, and location.

### Candidates

**Can I browse without signing up?**  
Yes. You can browse public jobs before creating an account.

**When do I need an account?**  
You need an account to save jobs, apply, track applications, submit salary signals, or write reviews.

**How do I upload my CV?**  
Upload a PDF, DOC, DOCX, or TXT file during the application flow.

**Can I withdraw an application?**  
Yes, unless the application has reached Offered or Hired status.

**Can I update my preferences?**  
Yes. Use the candidate dashboard to update company, compensation, designation, location, and ideal role preferences.

### Admins

**How do I monitor launch health?**  
Use the admin dashboard to check registrations, active users, jobs, applications, failures, support tickets, and reliability.

**How do I moderate reviews?**  
Open the admin dashboard and hide or restore reviews.

**How do I handle support tickets?**  
Open the Feedback inbox, triage new tickets, and close resolved tickets.

**What should be escalated immediately?**  
Signup/login failures, application submission failures, data privacy concerns, email verification failures, and production readiness failures.

## Email Templates

### Welcome

Subject: Welcome to CrossOver Talent

Hi {{name}},

Welcome to CrossOver Talent. You are joining a platform built for people and companies working across climate, impact investment, healthcare, clean energy, foundations, ESG, and other public-good markets.

Next step: complete your profile and start exploring roles or posting opportunities.

The CrossOver Talent Team

### Verification

Subject: Verify your CrossOver Talent email

Hi {{name}},

Please verify your email to activate your CrossOver Talent account:

{{verification_link}}

If you did not request this, you can ignore this email.

### Password Reset

Subject: Reset your CrossOver Talent password

Hi {{name}},

We received a password reset request for your account.

Reset your password here:

{{reset_link}}

This link expires soon. If you did not request it, you can ignore this email.

### Application Received

Subject: Application received for {{job_title}}

Hi {{candidate_name}},

Your application for {{job_title}} at {{company_name}} has been received.

You can track status from your CrossOver Talent dashboard.

### Application Status Changed

Subject: Your application status changed: {{job_title}}

Hi {{candidate_name}},

Your application for {{job_title}} at {{company_name}} has moved to:

{{status}}

You can view the latest status from your candidate dashboard.

### Interview Scheduled

Subject: Interview update for {{job_title}}

Hi {{candidate_name}},

{{company_name}} has moved your application for {{job_title}} to interview stage.

Please watch for direct scheduling details from the employer.

### Offer

Subject: Offer update for {{job_title}}

Hi {{candidate_name}},

Good news. Your application for {{job_title}} at {{company_name}} has moved to offer stage.

The employer will contact you with next steps.

### Rejection

Subject: Application update for {{job_title}}

Hi {{candidate_name}},

Thank you for your interest in {{job_title}} at {{company_name}}. The employer has decided not to move forward at this time.

We hope you continue exploring impact opportunities on CrossOver Talent.

## Customer Success Toolkit

### Employer Success Guide

Objective: Get employers to first value within 48 hours.

First value:
- Employer posts first role.
- Employer receives first qualified application.

Customer success checklist:
- Confirm employer can log in.
- Help complete company profile.
- Review first job description.
- Encourage salary/location transparency.
- Share job-board link.
- Check application pipeline after 72 hours.

Success email:
> Your first role is live. We recommend sharing your public job link with your network and checking applications daily during the first week.

### Candidate Success Guide

Objective: Help candidates discover and apply to relevant roles.

First value:
- Candidate saves at least one role.
- Candidate submits first application.

Customer success checklist:
- Encourage profile completion.
- Encourage CV upload.
- Explain save/apply/status tracking.
- Recommend filtering by sector, location, level, and work type.
- Invite review/salary-signal contribution after account activation.

### Recruiter Guide

Objective: Help recruiters use CrossOver Talent as a lightweight impact hiring workspace.

Workflow:
- Create employer workspace.
- Build company profile.
- Post role.
- Use JD assistant.
- Share role link.
- Review applications daily.
- Move candidates through status stages.
- Close job when hiring is complete.

Best practices:
- Use specific impact-area language.
- Include salary range where possible.
- Keep job requirements realistic.
- Update candidate status promptly.

## Launch Kit

### Press Release

Headline:
> CrossOver Talent Launches Career Intelligence Platform for Climate, Healthcare, Impact Capital, and Public-Good Careers

Body:
CrossOver Talent today announced the controlled public beta of its impact career intelligence platform, designed to help mission-driven employers and candidates connect across climate, impact investment, public healthcare, agriculture, water, education, clean energy, philanthropic foundations, circular economy, CSR, and ESG consulting.

The platform combines job posting, candidate applications, company profiles, anonymous reviews, salary signals, AI-assisted job descriptions, CV support, and operational dashboards in one focused marketplace.

CrossOver Talent is launching with selected employers and candidates before broader public availability.

### Product Hunt Launch Copy

Tagline:
> Impact career intelligence for climate, healthcare, ESG, and public-good work.

Short description:
> CrossOver Talent helps employers post mission-driven roles and candidates discover jobs, company insights, salary signals, reviews, and AI-supported application tools across public-good sectors.

Maker comment:
> We built CrossOver Talent because impact-sector hiring deserves better context than generic job boards. Version 1.0 combines jobs, applications, reviews, salary signals, AI JD/CV helpers, and employer dashboards for climate, impact investment, healthcare, sustainability, and adjacent public-good markets.

### LinkedIn Announcement

We are opening controlled public beta access for CrossOver Talent - an impact career intelligence platform for climate, impact investment, public healthcare, clean energy, agriculture, water, education, foundations, circular economy, CSR, and ESG consulting.

Employers can post roles, manage applications, and build company profiles. Candidates can browse impact jobs, save roles, apply, upload CVs, track applications, and compare workplace and salary signals.

We are starting with a curated group of employers and candidates before broader launch. If you are hiring or exploring work in public-good markets, we would love to hear from you.

### Email Announcement

Subject: CrossOver Talent is opening controlled beta access

Hi {{name}},

CrossOver Talent is opening controlled public beta access.

The platform helps mission-driven employers and candidates connect across climate, impact investment, public healthcare, clean energy, agriculture, water, education, foundations, CSR, ESG consulting, and adjacent public-good sectors.

Employers can post roles and manage applications. Candidates can browse, save, apply, upload CVs, and track status.

Reply to this email if you would like early access.

### Launch FAQ

**Is the platform live?**  
It is ready for controlled public beta after production infrastructure validation.

**Is this open to everyone?**  
Not yet. Access should remain controlled during the first launch wave.

**Who should join first?**  
Employers actively hiring and candidates looking for impact-sector roles.

**Is AI live?**  
AI can run with OpenAI configured. Otherwise safe fallback mode is available.

**Are payments live?**  
No. Pricing is placeholder-only in Version 1.0.

### Known Issues

- Production infrastructure must be manually completed before public access.
- Pricing plans are placeholders; payments are not implemented.
- LinkedIn import is limited to URL attachment, not full profile scraping.
- CV parsing quality depends on text-based files.
- Enterprise team roles and billing are planned for Version 1.1+.
- SEO pages are limited by current SPA architecture.

## Investor Demo Mode

Do not change production code for demo mode before launch. Use a dedicated staging/demo environment with seeded demo records.

### Demo Data Set

Employers:
- GreenGrid Energy
- HealthBridge Asia
- BlueWater Resilience
- Circular Futures Lab
- Impact Capital Partners

Candidates:
- Climate finance analyst
- Public health program lead
- ESG consultant
- Clean energy project manager
- Water resilience specialist

Jobs:
- Climate Finance Associate
- Public Healthcare Partnerships Lead
- Clean Energy Program Manager
- ESG Strategy Consultant
- Water Resilience Analyst

Applications:
- 20-30 applications across statuses: Applied, Shortlisted, Interview, Offered, Rejected, Hired.

Reviews:
- 10 public reviews with different display modes.

Salary signals:
- 20 signals across sectors and levels.

AI demo:
- Show JD generation from skills/KPIs/KRAs.
- Show CV parsing and revision fallback/live AI depending on environment.

Admin demo:
- Show DAU/WAU/MAU placeholders.
- Show application conversion.
- Show feedback inbox.
- Show moderation workflow.

### Investor Demo Checklist

1. Open homepage and explain impact-sector wedge.
2. Browse public jobs and filters.
3. Open company profile and reviews.
4. Show salary signals.
5. Employer login.
6. Post/edit/publish a job.
7. Generate JD with AI.
8. Candidate login.
9. Save and apply to a job.
10. Upload/parse CV.
11. Employer updates application status.
12. Candidate sees status.
13. Admin dashboard shows analytics, operations, moderation, and support.
14. Explain expansion path: AI matching, employer branding, subscriptions, ATS integrations.

## Sales Enablement

### Ideal Customer Profile

Initial employers:
- Climate startups.
- Impact funds.
- Public healthcare organizations.
- ESG/CSR consulting firms.
- Foundations and philanthropic platforms.
- Clean energy and water organizations.

Buyer personas:
- Founder/CEO.
- Head of Talent.
- Program Director.
- Investment Partner.
- HR/People Lead.
- Executive search/recruiting partner.

### Sales Narrative

Problem:
- Generic job boards do not capture the context, credibility, and talent signals needed for impact-sector hiring.

Solution:
- CrossOver Talent combines job posting, company intelligence, candidate workflows, reviews, salary signals, and AI support in one focused platform.

Why now:
- Climate, health, ESG, and impact capital markets need specialized talent pipelines.

Differentiation:
- Sector-specific focus.
- Employer and candidate dashboards.
- Reviews and salary intelligence.
- AI support for job descriptions and CVs.
- Designed for public-good markets rather than generic hiring.

### Discovery Questions

- What roles are hardest for you to hire?
- Which sectors/geographies matter most?
- How do candidates currently discover your roles?
- How do you track applicants?
- What makes your company compelling to mission-driven candidates?
- Would employer branding, salary context, or AI job-description help improve applicant quality?

## Customer Onboarding

### Employer Day 0

- Create account.
- Verify email.
- Complete company profile.
- Upload logo.
- Post first job.
- Share job link.

### Employer Day 3

- Review application count.
- Improve job description if low engagement.
- Add salary range if missing.
- Share role again.

### Employer Day 7

- Review pipeline statuses.
- Ask for feedback.
- Identify upsell interest: branding, analytics, recruiter seats.

### Candidate Day 0

- Create account.
- Verify email.
- Browse jobs.
- Save at least one role.
- Upload CV.

### Candidate Day 3

- Apply to one or more roles.
- Update preferences.
- Try CV assistant.

### Candidate Day 7

- Track application status.
- Submit salary signal or review if appropriate.

## Success Metrics

30-day targets:
- 100 employers invited.
- 50 employers activated.
- 5,000 candidates invited.
- 1,000 candidates activated.
- 100 jobs posted.
- 300 applications submitted.
- Employer activation above 50%.
- Candidate activation above 20%.
- Email success above 95%.
- Upload failure below 5%.
- 0 open P0/P1 bugs.
- 10 employer feedback calls.
- 100 candidate feedback responses.

## 30-Day Launch Plan

Week 1:
- Validate production infrastructure.
- Invite first 10 employers.
- Invite first 250 candidates.
- Monitor support daily.
- Fix any P0/P1 immediately.

Week 2:
- Expand to 25 employers.
- Expand to 1,000 candidates.
- Publish launch announcement softly on LinkedIn.
- Begin employer feedback calls.

Week 3:
- Expand to 50 employers.
- Expand to 2,500 candidates.
- Review activation metrics.
- Prioritize top support/backlog themes.

Week 4:
- Expand toward 100 employers and 5,000 candidates if reliability is stable.
- Run NPS placeholder survey.
- Decide whether to expand beyond controlled beta.

## 90-Day Roadmap

Days 1-30:
- Controlled public beta.
- Production stability.
- Employer/candidate activation.
- Support feedback collection.

Days 31-60:
- Structured CV parsing improvements.
- Employer branding pages.
- SEO job/company pages.
- Data quality automation.
- Organization/member model design.

Days 61-90:
- AI matching pilot.
- Entitlement layer.
- Recruiter collaboration foundation.
- Subscription plan validation.
- ATS integration discovery.

## Final Recommendation

Commercial motion: Ready for controlled commercial beta.  
Public production: Blocked until manual infrastructure gates pass.  
Enterprise launch: Not ready until organization roles, subscriptions, stronger reporting, and production compliance controls are implemented.

The next move should be disciplined: launch with a small, curated group, monitor every day, learn from real employer/candidate behavior, and avoid adding major features until the first 30-day signal is clear.
