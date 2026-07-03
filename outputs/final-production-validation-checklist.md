# Final Production Validation Checklist

Date: July 3, 2026  
Status: Not run. Execute only after production env, Supabase, Resend, domain, and SSL are configured.

## Test Environment

Production URL: `____________________________`

Test accounts:

- Employer: `____________________________`
- Candidate: `____________________________`
- Admin: `____________________________`

Result legend:

- PASS
- FAIL
- BLOCKED

## 1. Employer Signup/Login/Email Verification

| Step | Expected Result | Result |
|---|---|---|
| Open production URL in incognito | App loads over HTTPS |  |
| Register employer account | Verification email is queued/sent |  |
| Try login before verification | Dashboard access denied |  |
| Open verification email | Email delivered to real inbox |  |
| Click verification link | Account marked verified |  |
| Login after verification | Employer dashboard opens |  |
| Logout | Session clears |  |
| Login again | Session works |  |

## 2. Company Profile And Logo

| Step | Expected Result | Result |
|---|---|---|
| Open Company section | Company form loads |  |
| Add company name, website, sector, location, description | Save succeeds |  |
| Upload PNG/JPG/WEBP logo | Upload succeeds |  |
| Refresh page | Logo still appears |  |
| Remove logo | Logo removed |  |
| Upload invalid file type | Clear validation error |  |

## 3. Job Posting

| Step | Expected Result | Result |
|---|---|---|
| Create job with required fields | Job created |  |
| Edit job | Changes persist |  |
| Publish job | Job status active/published |  |
| Unpublish job | Job disappears from public board |  |
| Republish job | Job appears publicly again |  |
| Delete test job | Job removed from employer list |  |

## 4. Public Job Board

| Step | Expected Result | Result |
|---|---|---|
| Open `/?jobs=1` | Public board loads |  |
| Search by title/company | Results filter correctly |  |
| Filter by sector | Results filter correctly |  |
| Filter by location | Results filter correctly |  |
| Filter by level/work type | Results filter correctly |  |
| Open job detail | Detail modal/page opens |  |
| Empty search | Clear empty state appears |  |

## 5. Candidate Signup/Login/Email Verification

| Step | Expected Result | Result |
|---|---|---|
| Register candidate | Verification email is sent |  |
| Try login before verification | Dashboard access denied |  |
| Click verification link | Account marked verified |  |
| Login after verification | Candidate dashboard opens |  |
| Update preferences | Save succeeds |  |
| Add LinkedIn profile | Save succeeds |  |

## 6. CV Upload

| Step | Expected Result | Result |
|---|---|---|
| Upload TXT CV | Parsed preview appears |  |
| Upload text-based PDF | Parsed preview appears |  |
| Upload DOCX | Parsed preview appears |  |
| Upload invalid/mismatched file | Clear validation error |  |
| Confirm storage metadata | File metadata stored |  |
| Confirm private file access | Direct private URL blocked |  |

## 7. Job Application

| Step | Expected Result | Result |
|---|---|---|
| Candidate saves job | Saved job appears in dashboard |  |
| Candidate applies with CV and cover letter | Application saved |  |
| Duplicate apply attempt | Duplicate blocked |  |
| Candidate receives confirmation email | Email delivered |  |
| Employer receives new application email | Email delivered |  |

## 8. Employer Application Review

| Step | Expected Result | Result |
|---|---|---|
| Employer opens Applications | Candidate application visible |  |
| Employer opens candidate detail | CV/cover letter visible |  |
| Employer changes status to Shortlisted | Status saves |  |
| Employer changes status to Interview | Status saves |  |
| Candidate receives status email | Email delivered |  |

## 9. Candidate Status Tracking

| Step | Expected Result | Result |
|---|---|---|
| Candidate opens Applied jobs | Application visible |  |
| Candidate sees updated status | Matches employer update |  |
| Candidate withdraws eligible application | Status becomes Withdrawn |  |
| Employer sees withdrawn status | Employer dashboard updates |  |

## 10. Reviews

| Step | Expected Result | Result |
|---|---|---|
| Verified user submits anonymous review | Review saved |  |
| Public reviews list displays review | Review visible |  |
| User edits own review | Changes save |  |
| User cannot edit another user review | Access denied |  |
| Admin hides review | Review hidden publicly |  |
| Admin restores review | Review visible again |  |

## 11. Salary Signals

| Step | Expected Result | Result |
|---|---|---|
| Verified user submits salary signal | Signal saved |  |
| Public salary aggregate updates | Aggregate visible |  |
| Private user identity hidden | No email/name exposed |  |

## 12. Admin Moderation

| Step | Expected Result | Result |
|---|---|---|
| Admin logs in | Admin dashboard opens |  |
| Admin views users | Users list appears |  |
| Admin disables test user | User disabled |  |
| Disabled user login blocked | Access denied |  |
| Admin unpublishes test job | Job hidden publicly |  |
| Admin hides/restores review | Public display updates |  |

## 13. AI Features

| Step | Expected Result | Result |
|---|---|---|
| Employer generates JD | Live AI output or approved fallback |  |
| Candidate revises CV | Live AI output or approved fallback |  |
| Simulate missing AI key in non-prod | Fallback works |  |
| Excessive AI requests | Rate limit returns clear error |  |
| Inspect logs | No API key exposed |  |

## 14. Error Monitoring

| Step | Expected Result | Result |
|---|---|---|
| Trigger handled validation error | Error visible to user, no crash |  |
| Check telemetry/audit logs | Event recorded |  |
| Check Vercel logs | No unhandled 5xx |  |
| Check Supabase logs | No write/storage failures |  |
| Check monitoring tools | Events visible if configured |  |

## Final Smoke Result

- [ ] PASS
- [ ] FAIL
- [ ] BLOCKED

Notes:

`______________________________________________________________________________`

