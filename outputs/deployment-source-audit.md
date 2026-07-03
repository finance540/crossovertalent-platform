# Deployment Source Audit

Date: 2026-07-04

Status: **NO-GO - Production deployment artifact mismatch**

## Scope

Audit why the latest Vercel Production deployment does not contain the current application files, specifically:

- `api/health.js`
- `api/ready.js`
- `api/company.js`
- `api/verify.js`
- `api/feedback.js`
- `api/telemetry.js`

No application code was modified. DNS was not changed. No redeploy was performed.

## Verified Vercel Project

| Field | Value |
|---|---|
| Team / scope | `cot-s-projects1` |
| Project | `build-me-a-simple-website-where` |
| Project ID | `prj_weXVocYHeOcEQjHH1EmdHSrKz4gb` |
| Org/team ID | `team_PiEtp1hNJO1E6hFxLSGHOMF5` |
| Node version | `24.x` |
| Framework | Other / none |
| Root directory | Project API reports `null`; CLI inspect displays `.` |
| Git repository | **None linked** |
| Production branch | **Not configured** |

Project API evidence shows `gitRepository: null`. Therefore Vercel is not tracking a Git repository or production branch for this project.

## Local Repository Audit

| Check | Result |
|---|---:|
| Local `.git` directory | Missing |
| `git status` | Fails: not a Git repository |
| Git remote | Not available |
| Current branch | Not available |
| Current HEAD commit SHA | Not available |
| Latest pushed commit SHA | Not available |
| Local commits unpushed | Not applicable; workspace is not a Git checkout |

Conclusion: the current workspace is a Vercel-linked folder, but not a Git repository. There is no local commit SHA that can be compared to Vercel.

## Current Workspace API Files

The current workspace contains the required API files:

| File | Exists locally | Notes |
|---|---:|---|
| `api/health.js` | Yes | Health route present. |
| `api/ready.js` | Yes | Readiness route present. |
| `api/company.js` | Yes | Company/profile route present. |
| `api/verify.js` | Yes | Email verification route present. |
| `api/feedback.js` | Yes | Feedback/support route present. |
| `api/telemetry.js` | Yes | Telemetry route present. |

`npm run check` passed and includes syntax checks for all six missing routes.

## Latest Production Deployment

| Field | Value |
|---|---|
| Deployment ID | `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` |
| Deployment URL | `https://build-me-a-simple-website-where-da8xixfth-cot-s-projects1.vercel.app` |
| Target | Production |
| Status | Ready |
| Created | 2026-07-04 02:54:03 JST |
| Source | `redeploy` |
| Git metadata | Empty |
| Creator | Vercel user `finance-2897` |

The deployment was created from Vercel's redeploy mechanism, not from a Git commit.

## Production Endpoint Evidence

| Endpoint | Expected | Actual |
|---|---:|---:|
| `/api/health` | HTTP 200 | HTTP 404 |
| `/api/ready` | HTTP 200 | HTTP 404 |
| `/api/company` | Route exists; auth error acceptable | HTTP 404 |
| `/api/verify` | Route exists; validation error acceptable | HTTP 404 |
| `/api/feedback` | Route exists; method/auth behavior acceptable | HTTP 404 |
| `/api/telemetry` | Route exists; method behavior acceptable | HTTP 404 |

## Production Build Artifact Evidence

Vercel inspect for `dpl_A2CfDxGVvwejsLTpjbEF4meyYATS` shows older API functions such as:

- `api/admin`
- `api/applications`
- `api/assist`
- `api/auth`
- `api/candidate`

It does not expose the required newer functions:

- `api/health`
- `api/ready`
- `api/company`
- `api/verify`
- `api/feedback`
- `api/telemetry`

## Root Cause

The latest Production deployment was a Vercel **redeploy** of an older deployment/source artifact. Because the Vercel project is not linked to Git, redeploying from the dashboard reuses the old uploaded source snapshot rather than the current local workspace.

This explains why Production has the correct environment variables but still lacks the new API routes.

## Decision

Production deployment source status: **NO-GO**

Production is stale. It must be redeployed from the current local workspace or from a Git repository that contains the current workspace files.
