# AI Navigation Assistant Report

Date: 2026-07-05

## Summary

Implemented a guided AI navigation assistant for Crossover Talent as a non-destructive help layer over the existing platform. The assistant appears as a floating "AI guide" button and opens a chat panel with role-aware suggested prompts, guided CTA actions, local session conversation history, and safe fallback guidance when OpenAI is unavailable.

## Implemented

- Floating AI assistant button and pop-up panel on all pages.
- Suggested prompts for public visitors, employers, candidates, and admins.
- Page-aware and role-aware client context collection.
- Assistant API action on the existing `/api/assist` endpoint: `navigation-assistant`.
- Fallback guidance when `OPENAI_API_KEY` is missing or OpenAI times out.
- Guided CTA buttons for:
  - Employer dashboard
  - Job posting
  - Applications
  - Company profile
  - Candidate dashboard
  - CV upload
  - Saved jobs
  - Application tracking
  - Admin dashboard
  - Employer approvals
  - Review moderation
  - Feedback inbox
  - Contact support
- Employer approval awareness:
  - Pending review
  - Approved
  - Rejected
  - Suspended
- Candidate profile awareness:
  - Resume/CV presence
  - LinkedIn presence
  - Preferences
  - Saved jobs
  - Applications
- Admin guidance without executing admin actions.
- Local session history using `sessionStorage`.
- Guardrails to prevent private data exposure, secret disclosure, admin action execution, or approval bypass.

## Supporting Reliability Fixes

- Session cookies now keep `Secure` only in Vercel Production so local Playwright can test authenticated dashboards over HTTP while production remains protected.
- Empty company profile responses now return a clean empty profile instead of logging a null-profile server error.

## Manual Configuration

- `OPENAI_API_KEY` is optional.
- If `OPENAI_API_KEY` is missing, the assistant uses deterministic safe fallback guidance.
- No client-side secrets are required or exposed.

## Deployment Recommendation

Ready to deploy after an intentional production deployment step. Do not deploy automatically from this report. Run a production smoke after deploy to confirm the assistant renders and `/api/assist` returns safe guidance.

