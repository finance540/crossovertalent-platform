# Crossover Talent Version Roadmap

Date: July 3, 2026  
Scope: Version 1.1, Version 1.2, Version 2.0 planning

## Prioritization Model

Effort:

- S: 1-3 engineering days
- M: 1-2 engineering weeks
- L: 3-6 engineering weeks
- XL: 2+ months or multi-role project

Impact:

- High: Directly improves launch readiness, trust, monetization, or core workflow completion.
- Medium: Improves retention, quality, or operational efficiency.
- Low: Useful polish or nice-to-have enhancement.

## Version 1.1 - Production Foundation

Goal: Move from Private Beta quality to stable public-beta foundation.

| Item | Effort | Business Impact | Notes |
|---|---:|---|---|
| Configure transactional email provider | M | High | Required for real verification, password reset, and trust. |
| Configure production Supabase project | M | High | Separate staging/production data and services. |
| Configure production Vercel env/domain | S-M | High | Required for launch. |
| Move uploads/logos to Supabase Storage | M | High | Reduces payloads and improves privacy/security. |
| Add server-side pagination/filtering | M | High | Required before public traffic/data growth. |
| Add production monitoring/error reporting | S-M | High | Enables operational response. |
| Add final security/RLS audit fixes | M | High | Required before public launch. |
| Add real behavioral integration tests | M | High | Protects core workflows. |
| Add production smoke script | S | High | Reduces launch risk. |
| Add field-level form errors | S-M | Medium | Improves conversion and support burden. |

## Version 1.2 - Marketplace Quality

Goal: Make the marketplace feel reliable, searchable, and useful beyond the first cohort.

| Item | Effort | Business Impact | Notes |
|---|---:|---|---|
| Real job detail pages with SEO metadata | M | High | Improves discoverability and sharing. |
| Company profile public pages | M | High | Supports Glassdoor-like comparison behavior. |
| Structured data for job postings | S | High | Search visibility improvement. |
| Better salary insight privacy thresholds | S-M | High | Prevents exposing too-specific signals. |
| Review moderation queue and audit log | M | High | Improves trust and admin safety. |
| Candidate profile completion checklist | S-M | Medium | Improves application quality. |
| Employer onboarding checklist | S | Medium | Improves activation. |
| Mobile card views for dashboard tables | M | Medium | Improves mobile usability. |
| Accessibility QA fixes | M | Medium | Reduces exclusion and compliance risk. |
| Analytics dashboard for funnel metrics | M | Medium | Helps product decisions. |

## Version 2.0 - Intelligence And Scale

Goal: Build a defensible impact-career intelligence platform, not only a job board.

| Item | Effort | Business Impact | Notes |
|---|---:|---|---|
| Live AI JD generation with guardrails | M-L | High | Differentiates employer workflow. |
| Live AI CV improvement with consent controls | M-L | High | Differentiates candidate workflow. |
| Matching engine for candidates/jobs | L | High | Core marketplace intelligence layer. |
| Employer analytics and pipeline insights | L | High | Supports paid employer offerings. |
| Candidate recommendations and alerts | L | High | Improves retention. |
| Verified company review program | L | High | Builds trust moat. |
| Salary intelligence benchmarks by sector/location | L | High | Supports Glassdoor-like insight. |
| Multi-tenant employer teams and permissions | L | High | Needed for enterprise customers. |
| ATS/export integrations | L-XL | Medium-High | Useful for serious employers. |
| Compliance/privacy center | L | Medium-High | Needed as data sensitivity grows. |
| Internationalization/localization | L | Medium | Relevant for Asia expansion. |

## Suggested Sequencing

1. Complete Version 1.1 before public production.
2. Launch public beta with Version 1.1 plus selected Version 1.2 items.
3. Use beta metrics to prioritize Version 1.2 marketplace quality.
4. Start Version 2.0 only after core workflows, trust, and data quality are stable.

## Highest-ROI Next 5 Items

1. Transactional email provider.
2. Production Supabase/Vercel separation.
3. Server-side pagination/filtering.
4. Storage-backed uploads/logos.
5. Monitoring/error reporting.

