# Supabase Schema Diagram

Date: 2026-07-04

Status: Expected and now production-verified application schema. Production contains these application tables after migration `20260703162517`.

Source: [supabase-staging-schema.sql](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/supabase-staging-schema.sql)

## Expected Entity Relationship Diagram

```mermaid
erDiagram
  users {
    uuid id PK
    uuid auth_user_id
    text role
    text email UK
    text name
    timestamptz created_at
    timestamptz updated_at
  }

  employer_profiles {
    uuid id PK
    uuid user_id FK
    text company_name
    text company_domain
    text sector
    text location
    timestamptz created_at
    timestamptz updated_at
  }

  jobseeker_profiles {
    uuid id PK
    uuid user_id FK
    text linkedin_url
    text resume_text
    jsonb preferences
    timestamptz created_at
    timestamptz updated_at
  }

  companies {
    uuid id PK
    text name
    text sector
    text location
    text website
    text description
    timestamptz created_at
    timestamptz updated_at
  }

  jobs {
    uuid id PK
    uuid employer_id FK
    uuid company_id FK
    text title
    text department
    text location
    text work_type
    text level
    text sector
    text salary_range
    text impact_area
    text description
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  applications {
    uuid id PK
    uuid job_id FK
    uuid candidate_id FK
    text candidate_email
    text candidate_name
    text linkedin_url
    text cover_letter
    uuid cv_file_id
    text status
    timestamptz created_at
    timestamptz updated_at
  }

  saved_jobs {
    uuid id PK
    uuid candidate_id FK
    uuid job_id FK
    timestamptz created_at
  }

  company_reviews {
    uuid id PK
    uuid company_id FK
    text company_name
    text sector
    text role
    text location
    int rating
    text headline
    text pros
    text cons
    text advice
    text display_mode
    text reviewer_label
    text reviewer_linkedin
    text verified_domain
    timestamptz created_at
  }

  salary_signals {
    uuid id PK
    uuid company_id FK
    text company_name
    text role
    text location
    text level
    text sector
    text work_type
    text currency
    numeric salary_min
    numeric salary_max
    text note
    timestamptz created_at
  }

  uploaded_files {
    uuid id PK
    uuid owner_user_id FK
    text bucket
    text object_path
    text file_name
    text file_type
    bigint file_size
    text parsed_text
    timestamptz created_at
  }

  app_records {
    text path PK
    text record_type
    jsonb data
    timestamptz created_at
    timestamptz updated_at
  }

  users ||--o{ employer_profiles : "owns"
  users ||--o{ jobseeker_profiles : "owns"
  users ||--o{ uploaded_files : "owns"
  employer_profiles ||--o{ jobs : "posts"
  companies ||--o{ jobs : "has"
  jobs ||--o{ applications : "receives"
  jobseeker_profiles ||--o{ applications : "submits"
  jobseeker_profiles ||--o{ saved_jobs : "saves"
  jobs ||--o{ saved_jobs : "saved as"
  companies ||--o{ company_reviews : "reviewed"
  companies ||--o{ salary_signals : "reported"
```

## Expected Indexes

- `app_records_path_pattern_idx`
- `app_records_record_type_idx`
- `app_records_data_gin_idx`
- `users_role_idx`
- `jobs_status_sector_location_idx`
- `jobs_search_gin_idx`
- `applications_job_status_idx`
- `reviews_company_sector_idx`
- `salary_company_role_idx`

## Expected RLS

Expected RLS enabled on:

- `app_records`
- `users`
- `employer_profiles`
- `jobseeker_profiles`
- `companies`
- `jobs`
- `applications`
- `saved_jobs`
- `company_reviews`
- `salary_signals`
- `uploaded_files`

Production verification result: app tables exist and RLS is enabled.

Staging verification result: RLS is enabled on the expected app tables.
