# Business Dashboard Specification

Date: July 3, 2026  
Status: Implemented in admin payload and dashboard UI for Version 1.0 launch operations.

## Dashboard Location

Internal admin dashboard: `/?admin=1`

API source: `GET /api/admin`

## Audience

- Founder/operator
- Customer success
- Moderation/admin team
- Technical support

## Core KPI Cards

| KPI | Definition | Source |
|---|---|---|
| Daily Active Users | Unique users with `product.*` events in last 24 hours | Audit logs |
| Weekly Active Users | Unique users with `product.*` events in last 7 days | Audit logs |
| Monthly Active Users | Unique users with `product.*` events in last 30 days | Audit logs |
| Employers | Total employer accounts | Account records |
| Candidates | Total candidate accounts | Candidate records |
| Jobs | Total job records | Company job records |
| Applications | Total application records | Application records |
| Application Conversion Rate | Applications divided by total jobs | Jobs + applications |
| Employer Activation Rate | Employers with at least one job divided by employers | Employers + jobs |
| Candidate Activation Rate | Candidates with application activity divided by candidates | Candidates + applications |
| AI Usage | AI product events | Product analytics |
| Storage Usage | Upload events | Product analytics + upload audit |
| Email Success Rate | Sent emails divided by sent + failed/fallback emails | Email audit logs |

## Reliability Signals

| Signal | Definition |
|---|---|
| Failed logins | Failed employer/candidate/admin login attempts in last 24 hours |
| Failed AI requests | AI fallback events in last 24 hours |
| Upload failures | Upload parse/storage fallback failures in last 24 hours |
| Email failures | Email failed/fallback events in last 24 hours |
| Server errors 24h | Server error audit events in last 24 hours |
| System health | Healthy when no server errors in last 24 hours, degraded otherwise |

## Dashboard Behavior

- Admin-only access.
- Metrics render above user/job/review moderation tables.
- Values default to `0` or `N/A` so empty launch data does not break the dashboard.
- Metrics are calculated server-side to avoid exposing private records client-side.

## Launch Targets

Controlled Public Beta targets:
- 5-10 employers onboarded.
- 50-100 candidates onboarded.
- Employer activation rate above 50%.
- Candidate activation rate above 20%.
- Email success rate above 95%.
- Server errors: 0 P0/P1 incidents.

Version 1.0 commercial launch targets:
- Employer activation rate above 60%.
- Candidate activation rate above 30%.
- Application conversion trend stable or improving weekly.
- Upload failure rate under 5%.
- AI fallback rate under 10% when OpenAI is configured.

## Future Dashboard Enhancements

- Date-range selector.
- Cohort retention.
- Funnel charts.
- Sector-level supply/demand analysis.
- Revenue metrics after subscription billing is implemented.
- Export CSV for customer success.
