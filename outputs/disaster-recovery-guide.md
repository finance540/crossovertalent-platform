# Crossover Talent Disaster Recovery Guide

Date: July 3, 2026

## Incident Roles

- Incident commander
- Engineering owner
- Product owner
- QA owner
- Communications owner

## Backup Procedure

- Enable Supabase automated backups.
- Record backup retention policy.
- Confirm Storage bucket backup/export policy.
- Export Vercel environment variable inventory without secret values.
- Keep deployment history available in Vercel.

## Restore Procedure

1. Identify incident start time.
2. Decide whether app rollback is enough or database restore is required.
3. If database restore is required, select backup timestamp before incident.
4. Restore into a safe environment first when possible.
5. Validate restored data.
6. Promote/point production only after validation.
7. Run production smoke test.

## Incident Response

1. Triage severity: P0/P1/P2/P3.
2. Stop affected workflow if data/security risk exists.
3. Preserve logs and affected record IDs.
4. Communicate known impact and next update time.
5. Fix in staging.
6. Smoke test.
7. Deploy or rollback.
8. Write postmortem.

## Recovery Objectives

Initial targets:

- RTO: 4 hours for public production.
- RPO: 24 hours or better, depending Supabase backup plan.

These should be tightened after production traffic and customer commitments are known.

