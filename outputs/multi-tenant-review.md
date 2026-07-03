# Multi-Tenant Readiness Review

Date: July 3, 2026

## Current State

CrossOver Talent currently supports logical separation by employer company ID, candidate account, and admin role. This is suitable for controlled public beta but is not yet enterprise-grade multi-tenant SaaS.

## Tenant Isolation

Current isolation:
- Employer sessions include `companyId`.
- Employer job and application routes scope reads/writes to `companies/{companyId}`.
- Candidate sessions are scoped by email hash.
- Admin routes require admin session.
- File uploads use kind-specific buckets and object paths.

Risks:
- The current storage abstraction stores application data as JSON records rather than normalized relational rows for every entity.
- Production RLS must be validated against the final Supabase setup.
- Company-level isolation exists, but organization/team-level tenant modeling is not yet formalized.

## Recommended Tenant Model

Primary tenant: `organization`

Entities:
- Organization
- Organization member
- Employer profile
- Recruiter profile
- Job
- Application
- Review
- Salary signal
- Uploaded file
- Audit log

## Organization Permissions

| Permission | Owner | Admin | Recruiter | Viewer |
|---|---:|---:|---:|---:|
| Edit organization profile | Yes | Yes | No | No |
| Upload company logo | Yes | Yes | No | No |
| Invite members | Yes | Yes | No | No |
| Post job | Yes | Yes | Yes | No |
| Publish/unpublish job | Yes | Yes | Yes | No |
| Delete job | Yes | Yes | Limited | No |
| View applications | Yes | Yes | Yes | Read-only |
| Update candidate status | Yes | Yes | Yes | No |
| View analytics | Yes | Yes | Limited | Limited |
| Manage billing | Yes | No | No | No |

## Platform Roles

| Role | Purpose |
|---|---|
| Candidate | Browse, save, apply, withdraw, track status, manage profile |
| Employer Owner | Own organization, billing, members, jobs, applications |
| Employer Admin | Manage profile, jobs, applications, recruiter team |
| Recruiter | Manage assigned jobs and candidates |
| Platform Admin | Moderate platform content and support users |
| Platform Analyst | View operational analytics only |

## RLS Policy Requirements

Production Supabase policies should enforce:
- Members can access organization data only if membership exists and is active.
- Candidates can access only their own private profile, saved jobs, CVs, and applications.
- Employers cannot access other employers' applications.
- Admins can access moderation views, but sensitive service operations remain server-only.
- Uploaded CVs require signed URLs and ownership checks.
- Public users can read only published jobs, public reviews, and aggregated salary signals.

## Enterprise Readiness Gaps

Priority:
1. Formal `organizations` and `organization_members`.
2. Granular employer/recruiter roles.
3. Team invitation flow.
4. Per-tenant audit logs.
5. Per-tenant billing and plan entitlements.
6. Admin impersonation controls, if ever added, with explicit audit trails.

## Recommendation

Controlled Public Beta: Ready.  
Enterprise launch: Not ready until organization membership and role-based entitlements are implemented.
