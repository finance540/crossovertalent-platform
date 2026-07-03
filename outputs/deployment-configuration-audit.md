# Deployment Configuration Audit

Date: 2026-07-04

Scope: CrossOver Talent production deployment mismatch.

Mode: Read-only. No deployment, env change, DNS change, or production resource mutation was performed.

## Executive Finding

**Production is not using the verified production Supabase infrastructure.**

Root cause is a combination of:

1. Vercel Production env vars are missing.
2. The current Vercel Production deployment is an older code snapshot with only a subset of API routes.
3. The commercial domain `crossovertalent.asia` is still routed through Wix DNS/hosting.
4. The live Vercel app is reading old Vercel Blob-backed data, not the verified production Supabase project.

## Current Production Deployment Target

| Item | Value |
|---|---|
| Vercel project | `cot-s-projects1/build-me-a-simple-website-where` |
| Project ID | `prj_weXVocYHeOcEQjHH1EmdHSrKz4gb` |
| Production alias | `https://build-me-a-simple-website-where.vercel.app` |
| Deployment URL | `https://build-me-a-simple-website-where-gf2966e6q-cot-s-projects1.vercel.app` |
| Deployment ID | `dpl_AKHXGQfCVW86nBf1UuNHW5zyZPFQ` |
| Target | `production` |
| Status | `READY` |
| Created | 2026-07-03 12:17:44 JST |
| Runtime | Node.js 24.x |

## Current Supabase Target

| Item | Value |
|---|---|
| Verified production Supabase project | `crossover-talent-production` |
| Production ref | `hntvcqahoseizmgswohq` |
| Production URL expected | `https://hntvcqahoseizmgswohq.supabase.co` |
| Current deployed app Supabase target | **None verified** |
| Evidence | Vercel Production env only has `BLOB_READ_WRITE_TOKEN`; no Supabase URL/key vars. |

Conclusion: current Vercel Production is using Vercel Blob fallback/old data, not the verified production Supabase project.

## Current DNS Target

| Domain | Current target | Evidence |
|---|---|---|
| `crossovertalent.asia` | Wix | Nameservers `ns0.wixdns.net`, `ns1.wixdns.net`; HTTP headers `server: Pepyaka` |
| `www.crossovertalent.asia` | Wix CDN | CNAME `cdn1.wixdns.net`; HTTP headers `server: Pepyaka` |
| `build-me-a-simple-website-where.vercel.app` | Vercel | Vercel alias to current production deployment |

## Current Blocker

**P0: Production deployment is not connected to production infrastructure.**

The verified production Supabase database/storage is ready, but the active Vercel Production deployment has:

- no production Supabase env vars,
- no production session secret,
- no production email vars,
- no latest API routes,
- no Vercel DNS serving the commercial domain.

## Next Manual Action Required

In Vercel:

**Project -> Settings -> Environment Variables -> Production**

Add the required production env vars from [production-env-diff.md](/Users/sam/Documents/Codex/2026-06-18/build-me-a-simple-website-where/outputs/production-env-diff.md), then redeploy Production from the current codebase.

After redeploy, verify:

- `/api/health` returns 200.
- `/api/ready` returns 200.
- `/api/jobs?public=1` returns zero jobs initially from production Supabase.
- `/api/reviews` returns zero reviews initially from production Supabase.
- `crossovertalent.asia` is moved from Wix to Vercel only when ready.

