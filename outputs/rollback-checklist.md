# Crossover Talent Production Rollback Checklist

Date: July 3, 2026

## Rollback Triggers

Rollback immediately if any occur:

- User data exposure.
- Auth/session failure affecting multiple users.
- Applications cannot be submitted or viewed.
- Employer job posting is broken.
- Database writes fail broadly.
- Production deployment causes sustained 5xx errors.
- Incorrect Supabase project or environment variables are used.

## Rollback Steps

1. Pause public launch communications.
2. Assign incident owner.
3. Capture current deployment URL, logs, and error screenshots.
4. Use Vercel rollback to restore the previous known-good deployment.
5. Confirm custom domain points to the restored deployment.
6. Verify homepage, auth, public jobs, applications, and admin access.
7. Check Supabase for partial writes during the incident window.
8. Preserve audit logs and affected record IDs.
9. Notify stakeholders with status and expected next update.
10. Fix forward in staging before redeploying production.

## Data Rollback

- Do not delete production records without a written incident decision.
- Prefer compensating fixes over database restore unless corruption is systemic.
- If restore is required, follow Supabase restore procedure and document exact backup timestamp.

## Recovery Verification

- Production smoke test passes.
- No active P0/P1 bugs remain.
- Incident postmortem is drafted.

