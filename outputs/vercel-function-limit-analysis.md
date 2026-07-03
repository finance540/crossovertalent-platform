# Vercel Function Limit Analysis

Date: 2026-07-04

Status: **NO-GO - Production deployment blocked by Vercel Serverless Function count limit**

## Exact Build Error

The Git-connected Production deployment reached the current codebase and ran the expected build checks, including the API routes missing from the stale artifact.

Relevant build log excerpt:

```text
Building: Running "npm run build"
Building: > crossover-talent@1.0.0 build
Building: > npm run check
Building: > crossover-talent@1.0.0 check
Building: > node --check outputs/app.js && ... && node --check api/health.js && node --check api/ready.js && ...
Building: Build Completed in /vercel/output [15s]
Building: Deploying outputs...
{
  "status": "error",
  "reason": "deploy_failed",
  "message": "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan. Create a team (Pro plan) to deploy more.",
  "next": [
    {
      "command": "vercel deploy --scope cot-s-projects1",
      "when": "retry deploy"
    }
  ]
}
Error: No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan. Create a team (Pro plan) to deploy more.
```

## Limit Type

| Possible restriction | Finding |
|---|---:|
| Number of Serverless Functions | **Confirmed** |
| Bundle size | Not indicated |
| Edge Functions | Not indicated |
| Build failure / syntax error | Not indicated; `npm run check` passed during Vercel build |
| Environment variable failure | Not indicated |
| Supabase failure | Not reached |

The blocker is the number of Serverless Functions in the deployment. The app currently has 15 public API endpoints under `api/*.js`, plus `api/_lib.js` as a shared helper module. Vercel rejected the deployment because the project is on Hobby and the deployment exceeds the plan limit reported by Vercel for this project.

## Source Context

Vercel's current limits documentation lists "Functions Created per Deployment" as a plan-governed limit. The production build log provides the concrete enforcement message for this project: no more than 12 Serverless Functions on the Hobby plan.

Vercel's pricing page currently lists:

- Hobby: `$0/mo`
- Pro: `$20/mo`
- Pro includes `$20 of included usage credit`

References:

- Vercel limits: https://vercel.com/docs/limits
- Vercel pricing: https://vercel.com/pricing

## Immediate Impact

| Area | Impact |
|---|---|
| Git-based deployment provenance | **Improved**: Vercel is connected to GitHub and reached current source. |
| Production deployment | **Blocked**: function count exceeds Hobby limit. |
| Existing Production alias | Still points to prior stale deployment. |
| DNS migration | Must remain blocked. |
| Public launch | Must remain blocked. |

## Conclusion

This is not a code correctness failure. It is a Vercel plan/deployment-shape constraint. The lowest-risk production unblock is to upgrade the Vercel project/team to a plan that supports the current function count. Refactoring should only be used if the product owner prefers to stay on the Hobby plan.
