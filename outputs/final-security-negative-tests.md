# Final Security Negative Tests

Date: July 3, 2026  
Status: Not run. Execute only after production env and production Supabase are configured.

## Purpose

These tests prove that production data boundaries are enforced. Public production remains blocked until all P1 negative tests pass.

## Test Accounts

Use separate accounts:

- Employer A: `____________________________`
- Employer B: `____________________________`
- Candidate A: `____________________________`
- Candidate B: `____________________________`
- Admin: `____________________________`
- Anonymous/incognito browser

## 1. Employer Cannot Access Other Employer Data

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Employer A cannot list Employer B jobs | Sign in as Employer A; attempt to access Employer B job/application IDs through API/browser | 403/404 or empty result |  |
| Employer A cannot update Employer B job | Send PATCH/DELETE for Employer B job ID | 404 or denied; Employer B job unchanged |  |
| Employer A cannot view Employer B applications | Attempt direct application ID access | 404 or denied |  |
| Employer A cannot change Employer B candidate status | Attempt PATCH with Employer B application ID | 404 or denied |  |

## 2. Candidate Cannot Access Other Candidate Data

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Candidate A cannot view Candidate B dashboard | Use Candidate A session; call `/api/candidate` only returns Candidate A | Candidate B data absent |  |
| Candidate A cannot withdraw Candidate B application | Submit withdraw for Candidate B application ID | 404 or denied |  |
| Candidate A cannot edit Candidate B review | PATCH review owned by Candidate B | 403 denied |  |
| Candidate A cannot delete Candidate B salary signal | DELETE salary signal owned by Candidate B | 403 denied |  |

## 3. Public User Cannot Access Private Records

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Anonymous cannot access employer dashboard APIs | Incognito/no cookie calls `/api/jobs`, `/api/company`, `/api/applications` | 401 |  |
| Anonymous cannot access candidate dashboard | Incognito/no cookie calls `/api/candidate` | 401 |  |
| Anonymous cannot access admin | Incognito/no cookie calls `/api/admin` | 401 |  |
| Anonymous cannot direct-read `app_records` | Use anon key/direct Supabase REST if available | RLS denies access |  |

## 4. Non-Admin Cannot Access Admin Routes

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Employer denied admin GET | Employer session calls `/api/admin` | 401/403 |  |
| Candidate denied admin GET | Candidate session calls `/api/admin` | 401/403 |  |
| Employer denied admin PATCH | Employer session attempts moderation action | 401/403 |  |
| Candidate denied admin PATCH | Candidate session attempts moderation action | 401/403 |  |

## 5. Private Files Cannot Be Downloaded Without Authorization

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| CV direct URL blocked | Try opening private CV object URL without signed URL | 403/404 |  |
| JD direct URL blocked | Try opening private JD object URL without signed URL | 403/404 |  |
| Logo public URL works | Open logo public URL | Image loads |  |
| Signed URL expires | Generate signed private file URL; wait past expiry; reopen | URL denied after expiry |  |

## 6. Service Role Key Never Exposed Client-Side

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Search browser JS | Open DevTools, inspect loaded JS | No service role key |  |
| Search network responses | Inspect API JSON responses | No service role key |  |
| Search browser console | Trigger flows and inspect logs | No service role key |  |
| Search page source | View source and downloaded assets | No service role key |  |
| Search Vercel client bundle output | Inspect deployed static files | No service role key |  |

## 7. Upload Abuse Tests

| Test | Steps | Expected Result | Result |
|---|---|---|---|
| Oversized file rejected | Upload file above limit | Clear error; no storage object |  |
| Mismatched PDF rejected | Rename non-PDF as PDF | Clear error |  |
| SVG logo blocked | Upload SVG with `ALLOW_SVG_LOGOS=false` | Clear error |  |
| HTML/script file blocked | Upload HTML/script as CV/JD | Clear error |  |

## Final Security Result

- [ ] PASS
- [ ] FAIL
- [ ] BLOCKED

Public production can proceed only if all P1 tests pass.

