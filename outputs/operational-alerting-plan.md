# Operational Alerting Plan

Date: July 3, 2026

## Alert Channels

Recommended:
- Sentry for application errors.
- Vercel logs for serverless/API runtime issues.
- Supabase dashboard for database/storage/auth issues.
- Resend dashboard for email delivery.
- Admin dashboard for product/reliability metrics.
- Slack or email for daily alert routing.

## Alert Thresholds

| Alert | Warning | Critical | Source |
|---|---:|---:|---|
| API failures | 3 server errors in 24h | 10 server errors in 24h or any P0 endpoint failure | Sentry/admin dashboard |
| Database failures | 1 readiness failure | 2 consecutive readiness failures | `/api/ready`, Supabase |
| Storage failures | 3 upload failures/day | Upload failure rate above 10% | Admin dashboard |
| Email failures | Success rate below 95% | Success rate below 90% or verification emails failing | Resend/admin dashboard |
| AI failures | Fallback rate above 20% | AI endpoint unavailable for 30+ minutes when paid AI is expected | Admin dashboard |
| High error rate | Error rate above 1% | Error rate above 5% | Admin dashboard/Sentry |
| High latency | Average latency above 1,000 ms | Average latency above 2,000 ms | Client telemetry |
| Authentication failures | Failed logins spike 3x baseline | Credential stuffing or login outage suspected | Audit logs |

## Incident Severity

P0:
- App unavailable.
- Login/signup unavailable.
- Data privacy/security issue.
- Applications cannot be submitted.
- Employers cannot view applications.

P1:
- Email verification failing.
- Uploads failing broadly.
- AI feature crashing instead of falling back.
- Admin moderation unavailable.

P2:
- Search/filter degradation.
- Single file type parsing issue.
- Individual email delivery failures.

P3:
- Copy, styling, minor usability issue.

## On-Call Checklist

1. Check `/api/health`.
2. Check `/api/ready`.
3. Check Sentry.
4. Check Vercel function logs.
5. Check Supabase status and usage.
6. Check Resend delivery logs.
7. Check admin dashboard reliability panel.
8. Decide severity.
9. Communicate status to beta testers when user impact is confirmed.
10. Log incident summary and follow-up action.

## Recommended Automation

Before broader launch:
- Configure Sentry alerts for error spikes.
- Add Vercel cron or external uptime monitor for `/api/health` and `/api/ready`.
- Add Supabase usage threshold alerts.
- Add Resend bounce/failure webhook later.
- Forward support tickets to support inbox or Slack.
