# Production Smoke Test Report

Date: 2026-07-04

Status: **Not run**

Reason: Vercel Production environment variables have not yet been confirmed and Production has not been redeployed after configuration.

## Prerequisites

- Production Supabase: GO.
- Vercel Production env vars configured.
- Production redeploy completed after env var changes.
- Production URL confirmed.
- Resend production sender verified.
- OpenAI mode decided: live key or fallback-only.

## Smoke Test Checklist

| Test | Expected result | Status | Evidence |
|---|---|---:|---|
| `GET /api/health` | HTTP 200, `status: healthy` | Pending | Not run |
| `GET /api/ready` | HTTP 200, all readiness checks true | Pending | Not run |
| Employer signup | Account created, verification state shown | Pending | Not run |
| Employer email verification | Verification email delivered or verified flow works | Pending | Not run |
| Employer login | Correct dashboard redirect | Pending | Not run |
| Company profile/logo upload | Profile saved, logo stored in `crossover-company-logos-production` | Pending | Not run |
| Job post/publish | Job saved to production DB and visible publicly when active | Pending | Not run |
| Candidate signup | Account created, verification state shown | Pending | Not run |
| Candidate email verification | Verification email delivered or verified flow works | Pending | Not run |
| CV upload | CV stored in `crossover-cvs-production`, parsed preview shown | Pending | Not run |
| Apply to job | Application saved and duplicate prevention works | Pending | Not run |
| Employer sees application | Application appears under posted job | Pending | Not run |
| Employer updates status | Candidate status changes successfully | Pending | Not run |
| Candidate sees status | Candidate dashboard reflects updated status | Pending | Not run |
| Admin moderation | Admin can moderate jobs/reviews/users | Pending | Not run |
| AI generation | Live AI works if key exists, otherwise fallback message appears | Pending | Not run |
| Reviews | Review saves and displays publicly according to display mode | Pending | Not run |
| Salary signals | Salary signal saves and public aggregate displays | Pending | Not run |

## Current Result

**Production smoke test: BLOCKED**

Next action: configure Vercel Production env vars, redeploy Production, then run this checklist.

