# Production Go/No-Go Report

Date: 2026-07-06 JST

## Current Decision

**GO - Production remains live for controlled beta.**

**NO-GO - Scale-up / broad real-world rollout until the open P1 OCR blocker is fixed, LinkedIn completed login is fixed, and protected dashboard QA is completed with real approved credentials.**

The latest live QA pass against `https://crossovertalent.asia` confirms the core public platform, auth gates, production Supabase readiness, uploads for text-based files, OAuth start flows, public application submission, and admin route protection are functioning. One P1 issue remains open: scanned/image PDF parsing cannot complete OCR because the production OpenAI project is returning quota/rate-limit errors.

## Latest QA Evidence

| Item | Result |
|---|---:|
| Production URL | `https://crossovertalent.asia/` |
| Production Supabase ref | `hntvcqahoseizmgswohq` |
| Live QA report | `outputs/production-live-qa-report.md` |
| Production health score | `97%` |
| Executed checks | `32` |
| Open P0 issues | `0` |
| Open P1 issues | `1` |
| Latest screenshots | `outputs/qa-screenshots/` |

## Gate Summary

| Gate | PASS / FAIL | Evidence |
|---|---:|---|
| Homepage and CTAs | PASS | Find Jobs, Hire Talent, Book a Consultation, Submit CV visible |
| Employer login page | PASS | `https://crossovertalent.asia/?login=1` |
| Candidate login page | PASS | `https://crossovertalent.asia/?candidate=login` |
| Mobile homepage | PASS | 390x844 viewport screenshot captured |
| `/api/health` | PASS | HTTP `200` |
| `/api/ready` | PASS | HTTP `200`, production ref confirmed |
| Public jobs API | PASS | HTTP `200`, active jobs returned |
| Public reviews API | PASS | HTTP `200` |
| Public salary signals API | PASS | HTTP `200` |
| Admin route protection | PASS | Unauthenticated `/api/admin` HTTP `401` |
| Employer jobs route protection | PASS | Unauthenticated `/api/jobs` HTTP `401` |
| Google OAuth start | PASS | Redirects to production Supabase OAuth authorize URL |
| LinkedIn OAuth start | PASS | Redirects to production Supabase OAuth authorize URL |
| LinkedIn completed OAuth login | FAIL | LinkedIn rejects the production Supabase callback with `redirect_uri does not match the registered value` |
| Phone OTP prepared-disabled state | PASS | Clear HTTP `503` configuration message |
| Candidate registration gate | PASS | New candidate requires email verification |
| Employer registration gate | PASS | New employer defaults to review/verification gate |
| Text JD parsing | PASS | TXT, DOCX, and text-based PDF parse successfully |
| Scanned PDF OCR parsing | FAIL | P1: OpenAI OCR key invalid or unauthorized |
| LinkedIn profile attach helper | PASS | Profile URL attaches with clear scraping limitation note |
| JD generator auth protection | PASS | Unauthenticated request blocked |
| Public application submission | PASS | Public application endpoint accepted smoke application |
| Review/salary write protection | PASS | Unauthenticated writes blocked |
| Feedback/support endpoint | PASS | HTTP `201` |

## Open Bugs

| Bug ID | Severity | Status | Recommendation |
|---|---:|---|---|
| `LIVE-P1-OCR-001` | P1 | Code fix deployed; provider quota still open | Code now supports `OPENAI_OCR_API_KEY` plus multiple vision model fallbacks, declares the PDF renderer dependency directly, and reports HTTP `429` clearly. Enable billing/raise quota or configure `OPENAI_OCR_API_KEY` with available vision-model quota, then rerun scanned PDF upload QA. |
| `LIVE-P1-AUTH-LINKEDIN-001` | P1 | Open | Save `https://hntvcqahoseizmgswohq.supabase.co/auth/v1/callback` in LinkedIn Developer -> Auth -> Authorized redirect URLs. If LinkedIn continues rejecting valid HTTPS URLs, create a fresh LinkedIn app under the verified company, enable OpenID Connect, save the callback URL, then rotate LinkedIn credentials in Supabase. |

## Fix Iteration - 2026-07-06 JST

| Change | Result |
|---|---:|
| Dedicated OCR key support: `OPENAI_OCR_API_KEY` | Done |
| OCR model fallback: `OPENAI_OCR_MODEL`, `OPENAI_VISION_MODEL`, `OPENAI_MODEL`, `gpt-4o-mini`, `gpt-4.1-mini` | Done |
| Direct OCR renderer dependency: `@napi-rs/canvas` | Done |
| Env documentation updated | Done |
| Structural parser tests updated | Done |
| Local lint/typecheck/build/test | PASS |
| Local Playwright E2E | PASS - 6/6 |
| Commit pushed | `56e1ac8` |
| OCR quota handling commit pushed | `42e9967` |
| Production `/api/ready` after push | PASS - HTTP 200 |
| Live QA rerun after push | PASS except OCR provider quota/rate-limit |

The remaining risk is external provider capacity: if Vercel Production uses an OpenAI project without active billing or available vision-model quota, OCR cannot succeed because scanned PDFs contain images, not extractable text.

## Blocked Manual QA

| Workflow | Status | Needed Evidence |
|---|---:|---|
| Approved employer dashboard | BLOCKED | Approved employer QA credentials or admin approval of QA employer |
| Verified candidate dashboard | BLOCKED | Verified candidate QA credentials or completed email verification |
| Admin moderation dashboard | BLOCKED | Existing admin QA credentials |
| Full Google callback | BLOCKED | Interactive Google OAuth login credentials |
| Full LinkedIn callback | FAIL | LinkedIn redirect URL registration is missing/not accepted in the LinkedIn Developer app |

## Final Recommendation

Production can remain live for controlled beta, but do not scale onboarding until:

1. The OpenAI OCR billing/quota issue is fixed in Vercel Production and scanned PDF parsing passes.
2. LinkedIn Developer accepts the Supabase callback URL and completed LinkedIn login passes for candidate and employer.
3. Verified candidate, approved employer, and admin QA credentials are supplied and protected dashboard workflows are re-tested.

DNS changes are not required for these QA findings. No rollback is recommended because email/password login, Google OAuth start, text-based PDF/DOCX/TXT parsing, and the core app remain available; however, do not advertise LinkedIn login or scanned-PDF OCR as fully working until the provider-side blockers are closed.
