# Domain DNS Audit

Date: 2026-07-04

Mode: Read-only. No DNS or Vercel domain changes were made.

## Vercel Domain Configuration

Vercel has `crossovertalent.asia` attached to project:

- `build-me-a-simple-website-where`

Aliases point to:

- `crossovertalent.asia`
- `www.crossovertalent.asia`
- `build-me-a-simple-website-where.vercel.app`

However, Vercel reports the domain is **not configured properly**.

Vercel recommended record:

```text
A crossovertalent.asia 76.76.21.21
```

## Current DNS

| Host | Current DNS | Evidence |
|---|---|---|
| `crossovertalent.asia` | Wix nameservers | `ns0.wixdns.net`, `ns1.wixdns.net` |
| `www.crossovertalent.asia` | Wix CDN | CNAME `cdn1.wixdns.net` |
| Wix CDN A record | Wix IP | `34.149.87.45` |

## HTTP Evidence

`https://crossovertalent.asia`:

- HTTP 301 to `https://www.crossovertalent.asia/`
- `server: Pepyaka`
- `x-wix-request-id` present

`https://www.crossovertalent.asia`:

- HTTP 200
- `server: Pepyaka`
- Wix/static asset headers present

## Root Cause

The domain is attached in Vercel, but DNS is still controlled by Wix and points traffic to Wix.

## Required Manual Action

At the DNS provider currently managing the domain, replace Wix routing with Vercel routing:

1. For apex domain:

```text
A     @     76.76.21.21
```

2. For www:

```text
CNAME www   cname.vercel-dns.com
```

or follow the exact Vercel project domain instructions in:

**Vercel -> Project -> Settings -> Domains**

## Verification

After DNS changes propagate:

```bash
dig +short crossovertalent.asia A
dig +short www.crossovertalent.asia CNAME
curl -I https://crossovertalent.asia
curl -I https://www.crossovertalent.asia
```

Expected:

- Apex A includes `76.76.21.21`.
- `www` CNAME points to Vercel.
- HTTP headers show Vercel, not Pepyaka/Wix.
- Vercel domain page shows valid configuration and SSL active.

## Domain Decision

**FAIL**

Commercial domain is not serving the Vercel app.

