# Data Quality Audit

Date: July 3, 2026

## Scope

Reviewed logical data model and current app behavior for beta data quality risks:
- Users
- Companies
- Jobs
- Applications
- Reviews
- Salary signals
- Uploads
- Analytics events
- Support tickets

## Findings

### Duplicate Users

Current protection:
- Employer and candidate records are keyed by hashed normalized email.
- Duplicate registration returns conflict.

Residual risk:
- Same person can create employer and candidate accounts with the same email because account types are separate.

Recommendation:
- Accept for beta.
- In Version 1.1, add a global identity table.

### Duplicate Companies

Current protection:
- Company profile is tied to employer workspace/company ID.

Risk:
- Two employer accounts can create the same company name.

Recommendation:
- Add admin duplicate-company review queue before broad launch.
- Version 1.1: add organization claiming and domain verification.

### Duplicate Jobs

Current protection:
- Jobs have unique UUIDs.

Risk:
- Employers can accidentally post the same job multiple times.

Recommendation:
- Beta operations should check duplicate titles/company/location weekly.
- Version 1.1: warn when title/location/company matches an active job.

### Orphaned Applications

Current protection:
- Applications are stored under company and reference `job_id`.
- Public application submission checks active job exists.

Risk:
- Deleting a job can leave applications historically tied to deleted job IDs.

Recommendation:
- Prefer closing jobs over deleting once applications exist.
- Version 1.1: prevent deletion when applications exist or archive instead.

### Broken References

Risk areas:
- Saved jobs can reference closed/deleted jobs.
- Application records can reference deleted jobs.
- Uploaded file metadata can reference fallback or missing storage object.

Recommendation:
- Weekly data quality script should report:
  - Saved job IDs not found.
  - Applications with missing job.
  - Uploaded file metadata without storage object.

### Missing Uploads

Current behavior:
- Uploads validate size/type.
- Storage failure falls back and logs `file.storage_fallback`.

Recommendation:
- Monitor upload fallback count daily.
- Configure production storage and signed URL tests before expansion.
- Add orphan cleanup job in Version 1.1.

### Invalid Analytics Events

Current protection:
- Product events are server-side through `productEvent()`.

Risk:
- Client telemetry events are flexible and may vary.

Recommendation:
- Keep product funnel metrics server-side.
- Version 1.1: introduce event schema validation and export pipeline.

## Cleanup Recommendations

Daily:
- Review support tickets and failed workflow logs.
- Review upload and email failure counts.

Weekly:
- Duplicate company review.
- Duplicate job review.
- Orphaned applications report.
- Saved-job broken reference report.
- Upload fallback report.
- Analytics event schema review.

Before expanding beyond controlled beta:
- Add automated cleanup/report script.
- Convert critical entities to relational Supabase tables with foreign keys.
- Add archive semantics for jobs instead of hard delete.
