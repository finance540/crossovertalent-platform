# Deployment Commit Comparison

Date: 2026-07-04

Status: **NO-GO - No Git commit provenance available**

## Summary

There is no valid Git commit comparison because:

- The current local workspace is not a Git repository.
- The Vercel project is not linked to a Git repository.
- The latest Production deployment was created with source `redeploy`.
- The latest Production deployment has no Git commit metadata.

## Local Workspace

| Item | Result |
|---|---|
| Git repository present | No |
| Current branch | Not available |
| Local HEAD SHA | Not available |
| Git remote | Not available |
| Default branch | Not available |
| Latest pushed SHA | Not available |
| Unpushed local commits | Not applicable |

Commands such as `git status`, `git remote -v`, and `git rev-parse HEAD` fail because this directory is not a Git checkout.

## Vercel Project Git Linkage

| Item | Result |
|---|---|
| Vercel project ID | `prj_weXVocYHeOcEQjHH1EmdHSrKz4gb` |
| Git repository linked | No |
| Production branch configured | No |
| Project source of truth | Manual/CLI uploads and Vercel redeploy snapshots |

Vercel project API reports no `gitRepository` link.

## Latest Production Deployment

| Item | Result |
|---|---|
| Deployment ID | `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` |
| Deployment source | `redeploy` |
| Deployment commit SHA | None |
| Git branch | None |
| Git repo | None |
| Target | Production |
| Status | Ready |

The deployment does not identify a Git commit because it was not produced from Git.

## Comparison Result

| Question | Answer |
|---|---|
| Which Git commit is deployed? | **None / not available.** The deployment source is `redeploy`, not Git. |
| Which Git commit should be deployed? | **No commit exists in this workspace.** The current workspace files should be deployed, or first committed to a repository and then deployed from that commit. |
| Are local commits missing from the remote? | **Not applicable.** There is no local Git repository. |
| Is Vercel tracking the correct repository and branch? | **No Git repository is linked.** There is no branch tracking. |
| Is the Production deployment stale? | **Yes.** It lacks API routes that exist in the current workspace. |

## Practical Interpretation

This is not a "wrong branch" issue. It is a deployment provenance issue:

1. Current code exists only in the local workspace.
2. Vercel Production was redeployed from an older Vercel source snapshot.
3. The latest deployment therefore does not contain the current local files.

## Recommendation

Choose one source of truth before the next deploy:

1. **Fastest path:** deploy directly from the current local workspace with Vercel CLI.
2. **Best long-term path:** initialize/connect a Git repository, commit the current code, connect Vercel to that repository, set the production branch, and deploy from Git.

Until one of those is done, dashboard "Redeploy" may continue producing stale artifacts.
