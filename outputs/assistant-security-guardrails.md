# Assistant Security Guardrails

## Guardrails Implemented

- The assistant cannot execute admin decisions.
- The assistant cannot approve, reject, or suspend employers.
- The assistant cannot create, edit, or delete jobs/applications/reviews.
- The assistant cannot bypass employer approval gates.
- The assistant cannot bypass route protection or RLS.
- The assistant does not expose service role keys, API keys, environment variables, or private records.
- The assistant does not provide authoritative legal, medical, visa, or financial advice.
- The assistant uses existing session role context and only returns guidance/actions.
- Guided action URLs are restricted to internal paths; invalid external hrefs fall back to contact support.
- Conversation history is local to the browser session.
- The existing `/api/assist` route enforces same-origin checks, rate limiting, no-store cache headers, and security headers.

## OpenAI Fallback

If `OPENAI_API_KEY` is unavailable, the assistant returns deterministic role-aware fallback guidance. This prevents blank screens and broken buttons.

## Admin Data Protection

Admin role detection only affects suggested guidance. The assistant does not return admin-only datasets or perform admin-only mutations. Non-admin users may ask admin-related questions, but the response remains navigational and does not expose protected data.

## Remaining Manual Verification

- Verify production logs do not include prompt payloads containing private data beyond the current audit metadata.
- Verify OpenAI production usage policy and retention settings before enabling live AI at scale.
- Confirm rate limit thresholds remain appropriate after real beta usage.

