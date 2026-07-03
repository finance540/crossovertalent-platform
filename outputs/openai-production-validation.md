# OpenAI Production Validation Report

Date: July 3, 2026  
Status: **BLOCKED pending production OpenAI key and production deployment validation.**

## Summary

The application now supports live OpenAI calls for:

- Employer JD generation.
- Candidate CV revision.

The app also preserves fallback behavior when:

- `OPENAI_API_KEY` is missing.
- OpenAI API fails.
- OpenAI request times out.

## Required Configuration

| Variable | Required | Status |
|---|---|---|
| `OPENAI_API_KEY` | Required if live AI is approved | Pending |
| `OPENAI_MODEL` | Recommended | Pending |
| Provider billing/usage limit | Recommended | Pending |
| Production Vercel env configured | Required | Pending |

## Validation Checklist

### JD Generation

- [ ] Configure `OPENAI_API_KEY` in Vercel Production.
- [ ] Sign in as employer.
- [ ] Open job-posting dialog.
- [ ] Add title, skills, experience, top 3 KPIs, top 3 KRAs, sector.
- [ ] Generate job description.

Expected result:

- Response is role-specific.
- No hallucinated compensation.
- Output is usable in the description field.
- API does not expose `OPENAI_API_KEY`.

### CV Revision

- [ ] Sign in or open application flow.
- [ ] Upload/paste CV text.
- [ ] Enter target role.
- [ ] Run CV revision.

Expected result:

- CV revision preserves facts.
- No invented employer, dates, credentials, or metrics.
- Response completes or falls back within timeout.

### CV Parsing

CV parsing is local/parser-based, not OpenAI-dependent.

- [ ] Upload text-based PDF.
- [ ] Upload DOCX.
- [ ] Upload TXT.
- [ ] Upload invalid/mismatched file.

Expected result:

- Valid files parse.
- Invalid files show clear error.
- Parsed file metadata is stored.
- No crash or blank state.

### AI Fallback

- [ ] Test non-production deployment without `OPENAI_API_KEY`.
- [ ] Generate JD.
- [ ] Revise CV.

Expected result:

- Both flows return deterministic fallback output.
- UI shows success/fallback-safe output.
- No server crash.
- Audit event records fallback reason.

### Rate Limiting

- [ ] Send repeated AI requests above current limit.
- [ ] Confirm 429 response.
- [ ] Confirm UI shows “Too many requests” message.

Current rate limit:

- `/api/assist`: 40 requests/minute per IP bucket.

Production recommendation:

- Move rate limiting to Redis/KV/WAF before high-volume launch.

### Timeout Handling

- [ ] Simulate OpenAI timeout in non-production.
- [ ] Confirm fallback response.
- [ ] Confirm no hanging request.

Current timeout:

- OpenAI helper timeout defaults to 12 seconds.

### Secret Exposure

- [ ] Inspect browser bundle.
- [ ] Inspect network responses.
- [ ] Inspect Vercel logs.

Expected result:

- `OPENAI_API_KEY` never appears in browser JS, JSON responses, console, or logs.

## Current Result

Result: **BLOCKED**  
Reason: Production OpenAI key and production deployment validation are not available from this workspace.

