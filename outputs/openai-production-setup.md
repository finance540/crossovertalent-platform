# OpenAI Production Setup

Date: July 3, 2026  
Status: Manual setup required if live AI is approved for production.

## Goal

Enable live AI for:

- Employer JD generation.
- Candidate CV revision.

CV/JD parsing itself does not require OpenAI. It uses file parsing and safe fallback behavior.

## Step 1 - Decide AI Launch Mode

Product owner must choose:

- [ ] Live OpenAI enabled for production.
- [ ] Fallback-only AI accepted for production launch.

If fallback-only is accepted, do not market the product as having live generative AI until `OPENAI_API_KEY` is configured and validated.

## Step 2 - Add OpenAI Key To Vercel Production

If live AI is approved:

1. Create production OpenAI API key.
2. Add to Vercel Production:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL=gpt-4.1-mini`
3. Confirm key is not added to `NEXT_PUBLIC_*`.
4. Redeploy production candidate.

## Step 3 - Validate JD Generation

1. Log in as employer.
2. Open job post dialog.
3. Add:
   - Job title
   - Sector
   - Required skills
   - Experience summary
   - Top 3 KPIs
   - Top 3 KRAs
4. Click generate.

Pass criteria:

- AI output appears in description field.
- Output is specific to provided role.
- No invented compensation.
- No blank screen or crash.
- Request completes or falls back within timeout.

## Step 4 - Validate CV Revision

1. Open candidate application or dashboard resume tool.
2. Add CV text.
3. Add target role and skills.
4. Run CV revision.

Pass criteria:

- Output preserves facts.
- No invented employers, dates, credentials, or metrics.
- Fallback appears if OpenAI is unavailable.

## Step 5 - Validate AI Fallback

In non-production:

1. Remove `OPENAI_API_KEY`.
2. Run JD generation.
3. Run CV revision.

Pass criteria:

- Fallback content appears.
- No crash.
- Audit log records fallback reason.

## Step 6 - Validate Rate Limiting

1. Send repeated `/api/assist` requests.
2. Confirm excessive usage returns 429.
3. Confirm UI shows clear error.

Current limit:

- `/api/assist`: 40 requests/minute per IP bucket.

Production recommendation:

- Add provider-level or Redis/KV-backed rate limiting before high-volume public launch.

## Step 7 - Confirm Secret Safety

Check:

- Browser JS bundle.
- Browser network responses.
- Vercel logs.
- Error messages.

Pass criteria:

- `OPENAI_API_KEY` never appears client-side or in logs.

## Release Gate

Current status: **BLOCKED until product owner chooses live AI or fallback-only mode and validation passes.**

