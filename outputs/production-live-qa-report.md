# Production Live QA Audit Report

Generated: 2026-07-06T03:31:42.047Z
Target: https://crossovertalent.asia
Production health score: 97%

## Executive Summary

Status: NO-GO for scale-up. 1 open P0/P1 issue(s).

## Feature Status Matrix

| Feature | Status | Evidence | Severity |
|---|---:|---|---|
| Homepage loads | PASS | https://crossovertalent.asia/ |  |
| Homepage CTA visibility | PASS | Find Jobs=3, Hire Talent=3, Book a Consultation=6, Submit CV=2 |  |
| Employer login page loads | PASS | https://crossovertalent.asia/?login=1 |  |
| Candidate login page loads | PASS | https://crossovertalent.asia/?candidate=login |  |
| Mobile homepage loads | PASS | 390x844 viewport |  |
| Console errors on sampled pages | PASS |  |  |
| /api/health | PASS | HTTP 200 |  |
| /api/ready | PASS | HTTP 200; ref=hntvcqahoseizmgswohq |  |
| Public jobs API | PASS | HTTP 200; jobs=5 |  |
| Public reviews API | PASS | HTTP 200; reviews=0 |  |
| Public salary signals API | PASS | HTTP 200; aggregates=0 |  |
| Unauthenticated admin route protection | PASS | HTTP 401 |  |
| Unauthenticated employer jobs protection | PASS | HTTP 401 |  |
| Auth provider status endpoint | PASS | {"google":{"configured":true,"setupRequired":false},"linkedin":{"configured":true,"setupRequired":false},"phone":{"configured":false,"setupRequired":true}} |  |
| google OAuth start | PASS | HTTP 302; location=https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fcrossovertalent.asia%2F%3Fauth_callback |  |
| linkedin OAuth start | PASS | HTTP 302; location=https://hntvcqahoseizmgswohq.supabase.co/auth/v1/authorize?provider=linkedin_oidc&redirect_to=https%3A%2F%2Fcrossovertalent.asia%2F%3Fauth_c |  |
| Phone OTP endpoint availability | PASS | HTTP 503; Phone OTP login is prepared but not enabled yet. Configure Supabase Auth phone/SMS provider before activating this login method. |  |
| Candidate registration | PASS | HTTP 202; verificationLinkExposed=false |  |
| Candidate unverified login gate | PASS | HTTP 403; Verify your email before signing in |  |
| Employer registration | PASS | HTTP 202; status=pending_review; verificationLinkExposed=false |  |
| Employer unverified/approval gate | PASS | HTTP 403; Verify your email before signing in |  |
| Pending/unauth employer cannot post job | PASS | HTTP 401 |  |
| JD TXT parsing | PASS | HTTP 200; method=plain-text; score=1; error= |  |
| JD DOCX parsing | PASS | HTTP 200; method=docx-text; score=1; error= |  |
| JD text PDF parsing | PASS | HTTP 200; method=pdf-text; score=1; error= |  |
| Scanned PDF OCR parsing | FAIL | HTTP 422; method=; error=The file uploaded, but readable text could not be extracted. OCR could not complete: OpenAI OCR key is invalid or not authorized. Upload a clearer text-based PDF/DOCX/TXT, try a higher-quality scan, or paste the JD content manually. | P1 |
| LinkedIn profile attach helper | PASS | HTTP 200; LinkedIn public scraping is restricted. This profile URL is attached for employer review; upload a CV for full parsing. |  |
| JD generator auth protection | PASS | HTTP 401 |  |
| Public application submission | PASS | HTTP 201; job=Chief Agriculture Operations Officer;  |  |
| Review auth protection | PASS | HTTP 401 |  |
| Salary signal auth protection | PASS | HTTP 401 |  |
| Feedback/support endpoint | PASS | HTTP 201;  |  |

## Bug Register

| Bug ID | Severity | Feature | Steps | Expected | Actual | Root Cause | Fix Plan | Status |
|---|---|---|---|---|---|---|---|---|
| LIVE-P1-OCR-001 | P1 | JD/CV scanned PDF parsing | Upload an image-only/scanned PDF containing readable JD/CV text. | OCR extracts text, returns extractionMethod=ocr, and upload status shows OCR parsed. | The file uploaded, but readable text could not be extracted. OCR could not complete: OpenAI OCR key is invalid or not authorized. Upload a clearer text-based PDF/DOCX/TXT, try a higher-quality scan, or paste the JD content manually. | Production OPENAI_API_KEY is invalid or not authorized for the selected vision-capable model. | Replace Vercel Production OPENAI_API_KEY with a valid OpenAI project API key with access to the configured model, redeploy, then rerun scanned PDF OCR QA. | Open |

## Codex Fix Prompts

### 1. Fix scanned PDF OCR production blocker

```
Production scanned PDF parsing fails. Evidence: The file uploaded, but readable text could not be extracted. OCR could not complete: OpenAI OCR key is invalid or not authorized. Upload a clearer text-based PDF/DOCX/TXT, try a higher-quality scan, or paste the JD content manually.. Replace the Vercel Production OPENAI_API_KEY with a valid OpenAI key authorized for the configured vision-capable model, redeploy, and rerun a scanned PDF upload through /api/assist?action=parse-document. Do not expose secrets.
```

## Blocked / Manual Checks

- Full approved employer dashboard workflow: BLOCKED unless an approved employer QA account is provided or an admin approves the QA employer created during this run.
- Full verified candidate dashboard workflow: BLOCKED unless the QA candidate verification email is completed or a verified candidate QA account is provided.
- Admin moderation workflow: BLOCKED because production correctly disables admin self-registration. Provide an existing admin QA account to test moderation end to end.
- Google/LinkedIn full OAuth callback: start URL was tested; final login requires interactive third-party auth credentials.

## Evidence

Screenshots saved under `outputs/qa-screenshots/` with stamp `20260706033050`.

## Iteration Recommendation

Fix the open P1 OCR provider blocker, redeploy, and rerun this audit. Then provide verified candidate, approved employer, and admin QA credentials to complete protected dashboard validation.

## Fix Iteration - 2026-07-06 JST

Code hardening completed locally:

- Added support for a dedicated server-only `OPENAI_OCR_API_KEY`, while keeping `OPENAI_API_KEY` compatible.
- Added OCR model fallback order using `OPENAI_OCR_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_MODEL`, then `gpt-4o-mini` and `gpt-4.1-mini`.
- Declared `@napi-rs/canvas` as a direct dependency so PDF page rendering for OCR is not dependent on a transitive package.
- Updated `.env.example` and structural tests for OCR-specific provider configuration.

Local validation:

| Check | Result |
|---|---:|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test` | PASS |
| `npm run test:e2e` | PASS - 6/6 |

Production status after local fix: pending deploy and provider validation. If the existing production OpenAI key is still invalid, scanned PDF OCR will remain blocked until a valid key is configured in Vercel Production.
