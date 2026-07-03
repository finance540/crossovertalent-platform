# Crossover Talent Production Environment Checklist

Date: July 3, 2026  
Status: **Blocked until production provider credentials and Vercel Production variables are configured.**

## Production Gate

Do not deploy publicly until every required item below is complete and verified in Vercel Production.

## Required Provider Setup

| Area | Required Action | Status | Validation |
|---|---|---|---|
| Resend API key | Create production Resend API key with send permission | Pending | Send verification, password reset, employer notification, candidate notification |
| Resend sending domain | Verify `crossovertalent.asia` or chosen sender domain in Resend | Pending | SPF, DKIM, DMARC pass; inbox delivery succeeds |
| OpenAI API key | Create production OpenAI key if live AI is approved | Pending | JD and CV AI calls return live output; fallback still works |
| Production Supabase URL | Create/configure production Supabase project | Pending | API can read/write `app_records`; storage upload works |
| Supabase anon key | Add production anon key to Vercel Production | Pending | Present for future browser/Supabase flows; not exposed beyond `NEXT_PUBLIC` |
| Supabase service role key | Add service role key to Vercel Production only | Pending | Server APIs can access DB/storage; key never appears client-side |
| `SESSION_SECRET` | Generate 32+ byte random production secret | Pending | Sessions persist and cannot be forged; secret unique to production |
| `NEXT_PUBLIC_APP_URL` | Set final production URL | Pending | Email links and redirects use production domain |
| Custom domain | Configure production domain in Vercel | Pending | Domain resolves to production deployment |
| SSL | Confirm Vercel SSL certificate is active | Pending | HTTPS loads without warnings |

## Vercel Production Environment Variables

Add these in Vercel Project -> Settings -> Environment Variables -> Production.

| Variable | Required | Example / Notes | Status |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Production Supabase project URL | Pending |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Production anon key | Pending |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose client-side | Pending |
| `SESSION_SECRET` | Yes | Generate with `openssl rand -base64 48` | Pending |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://crossovertalent.asia` or final domain | Pending |
| `STORAGE_DRIVER` | Yes | `supabase` | Pending |
| `RESEND_API_KEY` | Yes for production email | Resend production key | Pending |
| `EMAIL_FROM` | Yes | `Crossover Talent <noreply@crossovertalent.asia>` | Pending |
| `REVIEW_MODERATION_EMAIL` | Recommended | Admin/moderation inbox | Pending |
| `OPENAI_API_KEY` | Required if live AI is approved | Server-only | Pending |
| `OPENAI_MODEL` | Recommended | `gpt-4.1-mini` | Pending |
| `SUPABASE_CV_BUCKET` | Yes | `crossover-cvs-production` | Pending |
| `SUPABASE_JD_BUCKET` | Yes | `crossover-job-descriptions-production` | Pending |
| `SUPABASE_LOGO_BUCKET` | Yes | `crossover-company-logos-production` | Pending |
| `SUPABASE_FILE_BUCKET` | Yes | `crossover-job-descriptions-production` | Pending |
| `FILE_SCAN_PROVIDER` | Optional but recommended | Required if virus scanning is mandatory | Pending |
| `EMAIL_TIMEOUT_MS` | Recommended | `8000` | Pending |
| `ALLOW_SVG_LOGOS` | Recommended | `false` | Pending |
| `SENTRY_DSN` | Recommended | Sentry DSN | Pending |
| `POSTHOG_KEY` | Recommended | PostHog project key | Pending |
| `POSTHOG_HOST` | Recommended | `https://app.posthog.com` | Pending |
| `GA_MEASUREMENT_ID` | Optional | GA4 measurement ID | Pending |

## Custom Domain And SSL Checklist

- [ ] Add domain to Vercel project.
- [ ] Configure DNS records exactly as Vercel requires.
- [ ] Confirm apex/root and `www` behavior.
- [ ] Confirm HTTPS certificate is issued.
- [ ] Confirm all app URLs redirect to canonical production URL.
- [ ] Add production URL to Supabase auth redirect allowlist.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the canonical URL.

## Secret Rotation Guidance

Rotate immediately before public launch:

- Supabase service role key if it was shared outside the dashboard.
- Resend API key if it was shared in chat/docs.
- OpenAI API key if it was shared outside secure env management.
- `SESSION_SECRET` if it was ever used outside production.

Never commit secrets to Git or Markdown reports.

## Release Gate Result

Current result: **BLOCKED**  
Reason: Production provider credentials, custom domain, SSL, and Vercel Production env variables have not been verified from this workspace.

