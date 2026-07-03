# Deployment Options Comparison

Date: 2026-07-04

## Options Reviewed

### Option A: Upgrade Vercel Plan

Move the project/team from Hobby to Pro.

Evidence:

- Current Vercel build error explicitly says: `Create a team (Pro plan) to deploy more.`
- Vercel pricing lists Pro at `$20/mo` with `$20 of included usage credit`.

| Dimension | Assessment |
|---|---|
| Engineering effort | Very low |
| Deployment risk | Low |
| Maintainability | High; no route consolidation needed |
| Performance | Best; each route remains independently deployed/cached/observed |
| Future scalability | Best near-term; more room for additional API endpoints |
| Cost | Starts at roughly `$20/mo` plus usage-based charges after included allowances/credits |
| Behavior change | None |

Pros:

- Fastest production unblock.
- No code refactor.
- Preserves clean API boundaries.
- Avoids introducing router bugs right before production validation.

Cons:

- Adds monthly platform cost.
- Usage-based billing needs spend controls.

### Option B: Convert to Next.js Route Handlers or Another Structure

Migrate the static/Vercel functions app into a Next.js app-router or pages-router structure.

| Dimension | Assessment |
|---|---|
| Engineering effort | High |
| Deployment risk | Medium/High |
| Maintainability | Medium/High long-term, but migration-heavy |
| Performance | Potentially good, but must retest |
| Future scalability | Good if architecture is redesigned |
| Cost | Could still hit function limits if each route remains separate |
| Behavior change | High risk during migration |

Pros:

- Could modernize routing and deployment architecture.
- May improve long-term conventions if the product becomes a full Next.js app.

Cons:

- Does **not automatically reduce function count** unless routes are also consolidated.
- High regression risk before launch.
- Requires broader test pass and possible UI/build migration.

### Option C: Consolidate Lightweight Utility Endpoints

Create one router function for low-risk utility routes while preserving public URLs via rewrites.

Potential grouped endpoints:

- `/api/health`
- `/api/ready`
- `/api/telemetry`
- `/api/email-templates`
- `/api/verify`
- Possibly `/api/feedback`

| Dimension | Assessment |
|---|---|
| Engineering effort | Low/Medium |
| Deployment risk | Medium |
| Maintainability | Medium; fewer functions but router indirection |
| Performance | Usually fine; minor router overhead |
| Future scalability | Moderate; buys room under Hobby but not infinite room |
| Cost | Keeps Hobby possible |
| Behavior change | Should be none if rewrites preserve URLs, but must be tested carefully |

Pros:

- Avoids immediate Vercel upgrade cost.
- Can keep public API URLs unchanged.
- Smallest code-level remediation if staying on Hobby is required.

Cons:

- Refactor risk around health/readiness/verification/support.
- More complex routing/debugging.
- Future endpoints may hit the limit again.

### Option D: Other Supported Deployment Approaches

Alternatives considered:

| Approach | Assessment |
|---|---|
| Split APIs across another Vercel project | Avoids single-project function count but adds cross-project routing, CORS, env duplication, and operational complexity. Not recommended. |
| Move low-traffic endpoints to Supabase Edge Functions | Possible, but changes hosting boundary, auth/session handling, env management, and monitoring. Higher risk than Option C. |
| Use static JSON for email template definitions | Safe for `email-templates`, but removes only one endpoint. Not enough alone. |
| Remove unused endpoints | Not currently justified; endpoints are tied to launch readiness and validation. |
| Keep dashboard redeploy/stale artifact | Not acceptable; it bypasses current code and breaks validation. |

## Comparison Matrix

| Option | Engineering effort | Deployment risk | Maintainability | Performance | Scalability | Cost impact | Recommendation |
|---|---:|---:|---:|---:|---:|---:|---|
| A: Upgrade Vercel Pro | Low | Low | High | High | High | Medium | **Recommended** |
| B: Next.js migration | High | High | Medium/High | Medium/High | High | Low/Medium | Not now |
| C: Consolidate utility endpoints | Low/Medium | Medium | Medium | Medium/High | Medium | Low | Backup if no upgrade |
| D: Split/move endpoints | Medium/High | High | Low/Medium | Mixed | Medium | Mixed | Not recommended |

## Conclusion

Option A is the lowest-risk path to production validation. Option C is the best no-cost fallback if the product owner chooses to remain on Hobby.
