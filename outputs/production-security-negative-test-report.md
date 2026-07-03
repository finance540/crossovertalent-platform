# Production Security Negative Test Report

Date: 2026-07-04

Status: **Not run**

Reason: Production deployment has not yet been redeployed with verified Vercel Production environment variables.

## Negative Test Checklist

| Test | Expected result | Status | Evidence |
|---|---|---:|---|
| Employer cannot access another employer's company profile | HTTP 403/404 or no cross-tenant data returned | Pending | Not run |
| Employer cannot access another employer's applications | HTTP 403/404 or filtered data only | Pending | Not run |
| Candidate cannot access another candidate's saved jobs/applications | HTTP 403/404 or filtered data only | Pending | Not run |
| Non-admin cannot access admin routes | HTTP 401/403 | Pending | Not run |
| Unauthenticated user cannot access protected dashboards/APIs | HTTP 401/403 or login redirect | Pending | Not run |
| Private CV file cannot be downloaded without authorization | No public URL; signed URL required | Pending | Not run |
| Private JD file cannot be downloaded without authorization | No public URL; signed URL required | Pending | Not run |
| Company logo public read is allowed | Public logo URL works only for logo bucket | Pending | Not run |
| Service role key not exposed client-side | No service role key in HTML/JS/network responses | Pending | Not run |
| Wrong password error handling | Login fails safely, no sensitive info leaked | Pending | Not run |
| CSRF/same-origin protection on mutating APIs | Cross-origin POST/PATCH/DELETE rejected | Pending | Not run |
| Rate limiting | Repeated sensitive actions eventually limited | Pending | Not run |

## Current Result

**Production security negative tests: BLOCKED**

Next action: run after Vercel Production env vars are configured and a fresh production deployment is live.

