# Controlled Public Beta Operations Dashboard Spec

Date: July 3, 2026  
Goal: Support the first 100 employers and 5,000 candidates during the 30-day controlled public beta.

## Dashboard Location

Internal admin dashboard: `/?admin=1`  
Primary API: `GET /api/admin`

## Implemented Operational Metrics

| Metric | Purpose | Source |
|---|---|---|
| Active employers | Track engaged employer supply | `product.employer_*`, company/job events |
| Active candidates | Track engaged candidate demand | `product.candidate_*`, saved job/application events |
| New registrations daily | Detect onboarding velocity | Auth/candidate/admin registration audit logs |
| New registrations weekly | Track beta growth trend | Audit logs |
| Jobs posted | Supply creation | `product.job_posted` |
| Applications submitted | Demand conversion | Application records |
| Applications completed | Late-stage outcomes | Applications with `offered` or `hired` |
| Failed applications | Application reliability proxy | Application/server error logs |
| Email delivery success/failure | Verify verification and notification reliability | Email audit logs |
| AI request success/failure | Track OpenAI/fallback health | AI audit logs |
| Upload success/failure | Track CV/JD/logo upload reliability | File audit logs |
| API latency | User-visible performance proxy | Client performance telemetry |
| Error rate | Reliability trend | Server error audit logs / API telemetry |
| System uptime | Operational health estimate | Server error audit logs |
| Open support tickets | Customer operations load | Support ticket records |

## Dashboard Sections

1. Core platform totals:
- Employers
- Candidates
- Jobs
- Applications

2. Beta operations:
- Active employers
- Active candidates
- Weekly registrations
- Open support tickets

3. Engagement:
- DAU
- WAU
- MAU
- Daily signups

4. Marketplace health:
- Jobs posted
- Applications submitted
- Applications completed
- Failed applications

5. Conversion:
- Application conversion rate
- Employer activation rate
- Candidate activation rate
- Email success rate

6. Reliability:
- API latency
- Error rate
- Uptime
- AI success/failure
- Upload success/failure
- Email sent/failure
- Server errors in last 24 hours

7. Feedback inbox:
- Feedback
- Bugs
- Support requests
- Feature requests
- Status: open, triaged, closed

## Daily Operating Rhythm

Morning:
- Check health/readiness.
- Review open support tickets.
- Review failed logins, upload failures, email failures, and AI failures.
- Confirm no P0/P1 tickets.

Midday:
- Review employer activation and new job posts.
- Follow up with employers that registered but did not post a job.

Evening:
- Review applications submitted and failed applications.
- Review beta feedback themes.
- Add backlog items for repeated issues.

## Beta Thresholds

Healthy:
- Email success rate above 95%.
- Upload failure rate below 5%.
- Server errors 24h below 3.
- Average API latency below 1,000 ms.
- P0/P1 support tickets: 0 open.

Needs attention:
- Email success rate 90-95%.
- Upload failure rate 5-10%.
- Server errors 24h between 3 and 10.
- Average API latency 1,000-2,000 ms.

Incident:
- Email success rate below 90%.
- Upload failure rate above 10%.
- Server errors 24h above 10.
- Average API latency above 2,000 ms.
- Any P0 user-blocking workflow failure.
