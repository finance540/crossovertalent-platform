# Database ERD

## Current Logical Model

The app currently stores records through a storage abstraction. The logical entities are:
- Employer accounts
- Candidate profiles
- Admin accounts
- Company profiles
- Jobs
- Applications
- Reviews
- Salary signals
- Uploaded files
- Audit logs
- Rate-limit buckets

## ERD

```mermaid
erDiagram
  EMPLOYER_ACCOUNT ||--o| COMPANY_PROFILE : owns
  EMPLOYER_ACCOUNT ||--o{ JOB : posts
  COMPANY_PROFILE ||--o{ JOB : has
  JOB ||--o{ APPLICATION : receives
  CANDIDATE_PROFILE ||--o{ APPLICATION : submits
  CANDIDATE_PROFILE ||--o{ SAVED_JOB : saves
  JOB ||--o{ SAVED_JOB : saved_as
  USER_ACCOUNT ||--o{ COMPANY_REVIEW : writes
  USER_ACCOUNT ||--o{ SALARY_SIGNAL : submits
  USER_ACCOUNT ||--o{ UPLOADED_FILE : uploads
  ADMIN_ACCOUNT ||--o{ MODERATION_ACTION : performs
  AUDIT_LOG }o--|| USER_ACCOUNT : records

  EMPLOYER_ACCOUNT {
    uuid id
    string role
    string email
    string emailHash
    boolean emailVerified
    string companyId
    string company
    boolean disabled
    datetime createdAt
  }

  CANDIDATE_PROFILE {
    uuid id
    string role
    string email
    string emailHash
    boolean emailVerified
    boolean disabled
    array savedJobs
    text resume
    json preferences
    datetime createdAt
  }

  COMPANY_PROFILE {
    uuid companyId
    string ownerEmail
    string company
    string website
    string sector
    string location
    text description
    json logo
    datetime created_at
    datetime updated_at
  }

  JOB {
    uuid id
    uuid companyId
    string company
    string title
    string department
    string location
    string type
    string sector
    string experience
    text description
    string status
    datetime created_at
    datetime updated_at
  }

  APPLICATION {
    string id
    uuid job_id
    uuid companyId
    string email
    string name
    string linkedin
    text cover_letter
    text cv_text
    string status
    datetime created_at
    datetime withdrawn_at
  }

  COMPANY_REVIEW {
    uuid id
    string company
    string sector
    string role
    string location
    integer rating
    string headline
    text pros
    text cons
    json reviewer
    string ownerHash
    boolean hidden
    datetime created_at
    datetime updated_at
  }

  SALARY_SIGNAL {
    uuid id
    string company
    string role
    string location
    string level
    string sector
    string currency
    number salaryMin
    number salaryMax
    string ownerHash
    datetime created_at
  }

  UPLOADED_FILE {
    uuid id
    string bucket
    string objectPath
    string kind
    string fileName
    string fileType
    number fileSize
    string virusScanStatus
    datetime created_at
  }

  AUDIT_LOG {
    uuid id
    string event
    string actorHash
    string entityType
    string entityId
    json metadata
    datetime created_at
  }
```

## Production Recommendation

For Version 1.1, move from JSON-record storage to relational Supabase tables for:
- Search/query performance.
- RLS clarity.
- Reporting and analytics.
- Tenant-level permissions.
- Strong foreign-key enforcement.

Critical indexes:
- Jobs: `status`, `sector`, `location`, `companyId`, `created_at`.
- Applications: `companyId`, `job_id`, `email`, `status`.
- Reviews: `company`, `sector`, `hidden`, `ownerHash`.
- Salary signals: `company`, `role`, `location`, `level`, `sector`.
- Audit logs: `event`, `actorHash`, `created_at`.
