# Analytics Event Map

Date: July 3, 2026  
Implementation: Server-side events are emitted through `productEvent()`, which writes `product.*` entries to the audit log store. Security and compliance events continue to use the existing `auditLog()` namespace.

## Event Naming

Pattern: `product.<event_name>`

Common fields:
- `event`: Full event name.
- `actorHash`: Hash of actor email when available.
- `entityType`: Primary entity type.
- `entityId`: Primary entity identifier.
- `metadata.analytics`: Always `true`.
- `created_at`: Event timestamp.

## Employer Events

| Event | Trigger | Entity | Key Metadata | Source |
|---|---|---|---|---|
| `product.employer_signup` | Employer registration accepted | `account` | `companyId` | `api/auth.js` |
| `product.employer_login` | Employer login success | `account` | `companyId` | `api/auth.js` |
| `product.company_created` | First company profile save | `company_profile` | `sector`, `hasLogo` | `api/company.js` |
| `product.company_updated` | Existing company profile edit | `company_profile` | `sector`, `hasLogo` | `api/company.js` |
| `product.job_posted` | Job created | `job` | `companyId`, `sector`, `location`, `status` | `api/jobs.js` |
| `product.job_published` | Job created active or reopened | `job` | `companyId`, `sector`, `location` or status transition | `api/jobs.js` |
| `product.job_closed` | Employer closes/unpublishes job | `job` | `companyId`, `previousStatus`, `status` | `api/jobs.js` |

## Candidate Events

| Event | Trigger | Entity | Key Metadata | Source |
|---|---|---|---|---|
| `product.candidate_signup` | Candidate registration accepted | `candidate` | None | `api/candidate.js` |
| `product.candidate_login` | Candidate login success | `candidate` | None | `api/candidate.js` |
| `product.cv_uploaded` | CV document parse or resume profile update | `uploaded_file` or `candidate` | `kind`, `fileType`, `fileSize`, `parsed`, `source` | `api/assist.js`, `api/candidate.js` |
| `product.job_saved` | Candidate saves a job | `job` | `candidateId` | `api/candidate.js` |
| `product.job_unsaved` | Candidate unsaves a job | `job` | `candidateId` | `api/candidate.js` |
| `product.application_submitted` | Candidate application accepted | `application` | `jobId`, `companyId`, `sector` | `api/applications.js` |
| `product.application_withdrawn` | Candidate withdraws application | `application` | `jobId`, `companyId` | `api/applications.js` |

## Admin Events

| Event | Trigger | Entity | Key Metadata | Source |
|---|---|---|---|---|
| `product.admin_login` | Admin login success | `admin` | None | `api/admin.js` |
| `product.review_moderated` | Admin hides/restores review | `review` | `hidden` | `api/admin.js` |
| `product.job_moderated` | Admin changes job status | `job` | `status`, `companyId` | `api/admin.js` |

## AI and Storage Events

| Event | Trigger | Entity | Key Metadata | Source |
|---|---|---|---|---|
| `product.ai_jd_generated` | JD generator returns live or fallback response | `ai_request` | `fallback`, `model` | `api/assist.js` |
| `product.ai_cv_revised` | CV revision returns live or fallback response | `ai_request` | `fallback`, `model` | `api/assist.js` |
| `product.file_uploaded` | Non-CV document parsed and stored/fallback | `uploaded_file` | `kind`, `fileType`, `fileSize`, `parsed` | `api/assist.js` |

## Operational Metrics Derived From Events

| Metric | Calculation |
|---|---|
| Daily active users | Unique `actorHash` on `product.*` events in last 24 hours |
| Weekly active users | Unique `actorHash` on `product.*` events in last 7 days |
| Monthly active users | Unique `actorHash` on `product.*` events in last 30 days |
| Employer activation rate | Employers with at least one job / total employers |
| Candidate activation rate | Candidates with at least one application / total candidates |
| Application conversion rate | Applications / total jobs |
| AI usage | Count of AI product events |
| Storage usage | Count of file/CV upload product events plus file upload audit events |
| Email success rate | `email.sent / (email.sent + email.failed + email.fallback)` |

## Launch Dashboard Owner

Owner: Operations/Admin  
Review cadence: Daily during controlled public beta, weekly after stable launch.
