# Crossover Talent Load Testing Plan

Date: July 3, 2026

## Targets

- 1,000 concurrent users.
- 10,000 jobs.
- 100,000 applications.
- File uploads.
- AI requests.

## Scenarios

| Scenario | Target | Key Metrics |
|---|---:|---|
| Public job browsing | 1,000 concurrent users | p95 latency, error rate, payload size |
| Search and filters | 500 concurrent users | p95 latency, database query time |
| Candidate applications | 100 concurrent submissions | write success rate, duplicate prevention |
| Employer dashboard | 100 employers | application list latency |
| Admin dashboard | 10 admins | payload size, memory/function duration |
| CV/JD uploads | 50 concurrent uploads | parse success, timeout rate |
| AI generation | 50 concurrent AI requests | timeout rate, fallback rate, cost |

## Expected Bottlenecks

- Prefix scans over `app_records`.
- Full public/admin datasets returned before client-side pagination.
- File parsing inside request lifecycle.
- Storage-backed rate limiting.
- Admin dashboard broad payload.

## Recommended Tools

- k6 for HTTP/API load testing.
- Vercel logs for function duration/error rate.
- Supabase dashboard/logs for database/storage pressure.
- PostHog/GA for user journey metrics.
- Sentry for application errors.

## Success Criteria

- Public job board p95 below 800 ms after caching/query optimization.
- Authenticated dashboard p95 below 1.5 seconds for normal page loads.
- Application write error rate below 0.5%.
- Upload parse failures are explainable and below 5% for valid files.
- AI requests either complete or gracefully fallback within 12 seconds.

## Required Before Running Real Load Test

- Production-like Supabase data volume.
- Server-side pagination implemented.
- Monitoring enabled.
- Cost limits configured for AI.

