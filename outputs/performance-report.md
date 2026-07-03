# Crossover Talent Performance Report

Date: July 3, 2026  
Scope: API queries, frontend rendering, storage, bundle shape, caching, deployment configuration  
Audit type: Planning/audit only. No application code was modified.

## Performance Summary

Performance is acceptable for small controlled beta data volumes. It will degrade as records grow because list APIs scan broad prefixes, return full datasets, and rely on client-side filtering/pagination. Version 1.0 should introduce normalized database queries, server-side pagination, indexes used by live APIs, object storage for uploads/logos, and route-level caching for public marketplace views.

## Database Queries

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Public job listing scans all `companies/` records. | P1 for scale | `api/jobs.js:9-11` calls `listRecords('companies/')` and filters in JS. | Query normalized `jobs` table with `status`, `sector`, `location`, `level`, `work_type`, and search filters. |
| Application submission scans all company records to find a job. | P2 | `api/applications.js:16` filters `listRecords('companies/')` by job id/status. | Read job by indexed id or direct path lookup. |
| Candidate withdrawal scans all company records to find an application. | P2 | `api/applications.js:32`. | Store candidate application index or use normalized `applications` table with candidate/email index. |
| Admin dashboard loads all major record sets. | P2 | `api/admin.js:57-81`. | Paginate admin lists and fetch detail pages on demand. |
| Salary and review endpoints return all records. | P2 | `api/reviews.js`, `api/salary-signals.js`. | Add server-side filtering, pagination, and aggregate-only salary response by default. |

## Indexes

The staging schema includes useful indexes for the normalized tables:

- `jobs_status_sector_location_idx`
- `jobs_search_gin_idx`
- `applications_job_status_idx`
- `reviews_company_sector_idx`
- `salary_company_role_idx`
- `app_records_path_pattern_idx`
- `app_records_record_type_idx`
- `app_records_data_gin_idx`

Issue: The live APIs currently use the generic `app_records` table and prefix scans, so the normalized indexes are not providing full value yet.

Recommendation:

1. Move Version 1.0 read/write paths to normalized tables.
2. Add composite indexes for actual queries after implementation.
3. Use cursor pagination on created_at/id pairs.

## Pagination

| Area | Current Behavior | Risk | Recommendation |
|---|---|---|---|
| Public jobs | Client-side pagination after downloading all jobs | Large payloads as marketplace grows | Add `?limit=&cursor=&sector=&location=&level=&workType=&q=`. |
| Reviews | Client-side pagination after downloading all reviews | Slow public reviews page | Add server pagination and company/sector filters. |
| Salary signals | Full signal list plus aggregates returned | Privacy/performance risk | Return aggregates by default; gate raw signals to admin/owner. |
| Admin users/jobs/reviews | Loads broad datasets and slices in UI | Slow admin dashboard | Add per-list paginated endpoints. |
| Employer jobs/applications | Full workspace records returned | Acceptable early, risky for large employers | Add server pagination and per-job filters. |

## Images And Uploads

| Finding | Severity | Evidence | Recommendation |
|---|---|---|---|
| Logos are stored inline as base64 data URLs. | P2 | `api/company.js:33`, `api/company.js:65`. | Store logos in Supabase Storage and serve optimized URLs. |
| SVG logos are allowed. | P2 | `api/company.js:4`. | Sanitize or disallow SVGs; prefer PNG/JPEG/WEBP. |
| CV/JD files are parsed in API request body. | P2 | `api/assist.js:14-58`. | Use direct-to-storage upload, then parse asynchronously or through a secured job. |
| No image optimization pipeline. | P3 | Static app uses direct image/data URLs. | Use storage transforms or pre-sized logo variants. |

## Bundle Size

The frontend is one static JavaScript file:

- `outputs/app.js`: 1,086 lines.
- No bundler/chunking is currently used.

Risks:

- All employer, candidate, public, admin, review, salary, upload, and AI UI code loads together.
- Harder to lazy-load admin or dashboard-only features.

Recommendation:

- For V1.0, either split `app.js` by feature modules or migrate to a framework/build step that supports route-level code splitting.
- Lazy-load admin and dashboard dialogs.
- Keep public marketplace JS minimal for anonymous visitors.

## Caching

Current behavior:

- API routes set `Cache-Control: no-store`.
- Static files can be cached by Vercel, but no explicit static cache policy is configured beyond defaults.

Recommendation:

- Keep `no-store` for authenticated APIs.
- Add short public cache or SWR-style caching for public jobs/reviews/salary aggregate endpoints.
- Add cache-busting filenames if introducing a build pipeline.

## Server Components / Rendering

The current app is not a Next.js/React Server Components app. It is static HTML plus client-side rendering.

Recommendation:

- For V1.0 SEO and performance, consider moving public marketplace pages to server-rendered routes.
- Generate crawlable job detail pages with structured data.
- Keep dashboards client-heavy but paginate via APIs.

## API Response Times

Potential bottlenecks:

- Prefix scans from `listRecords()`.
- Multiple broad list calls in admin payload.
- File parsing in request/response cycle.
- Rate limiter writes to storage on every limited request.

Recommendation:

- Add timing logs around API handlers during beta.
- Record p50/p95 latency for public jobs, applications, admin dashboard, upload parsing.
- Move rate limiting to an external low-latency store.

## Performance Readiness Score

Current Private Beta scale: **78/100**  
Version 1.0 public scale: **62/100**

Top performance work before public launch:

1. Server-side pagination and filtering.
2. Normalized table queries with indexes.
3. Storage-backed file/logo handling.
4. Public endpoint caching.
5. Admin payload decomposition.

