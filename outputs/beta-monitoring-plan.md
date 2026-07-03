# Crossover Talent Private Beta Monitoring Plan

Date: July 3, 2026  
Environment: Private Beta / Staging Preview

## Monitoring Cadence

Run this checklist once per day during Private Beta. During the first 48 hours, run a lighter check twice daily if active testers are using the app.

## Daily Checks

| Area | What To Check | Owner | Status |
|---|---|---|---|
| Signups | New employer, candidate, and admin signups | Beta QA owner | Pending |
| Login/auth | Failed signup, failed login, verification issues | Beta QA owner | Pending |
| Job posts | New jobs created, edited, published, unpublished, deleted | Employer workflow owner | Pending |
| Applications | Applications submitted, duplicate prevention, withdrawals, status updates | Candidate workflow owner | Pending |
| Reviews | New reviews, edited reviews, anonymous reviews, moderation queue | Admin owner | Pending |
| Salary signals | New salary submissions and aggregate display | Admin owner | Pending |
| Uploads | CV, JD, and logo upload success/failure | Beta QA owner | Pending |
| AI behavior | Live AI or fallback message behavior | Product/QA owner | Pending |
| Error logs | Vercel function errors and browser console reports | Engineering owner | Pending |
| Supabase usage | Auth, database, storage usage and errors | Engineering owner | Pending |
| User feedback | Review new feedback form responses | Product owner | Pending |
| Critical bugs | Review P0/P1 bugs and resolution status | Release owner | Pending |

## Daily Metrics Snapshot

Record these once per day:

- Total employers onboarded
- Total candidates onboarded
- New jobs posted
- New applications submitted
- Failed signups
- Failed applications
- Upload failures
- Review submissions
- Salary signal submissions
- New user feedback items
- Open P0 bugs
- Open P1 bugs
- Open P2 bugs
- Open P3 bugs

## Escalation Rules

| Severity | Action |
|---|---|
| P0 | Pause beta workflow, notify release owner immediately, fix and retest before continuing. |
| P1 | Keep beta controlled, fix before adding more users. |
| P2 | Triage daily and schedule into beta improvement backlog. |
| P3 | Batch into polish backlog. |

## Daily Review Questions

1. Are beta users able to sign up and log in?
2. Are employers able to create companies and post jobs?
3. Are candidates able to save and apply to jobs?
4. Are employers able to view applications and update statuses?
5. Are candidates able to track application status?
6. Are reviews and salary signals saving correctly?
7. Are uploads working without breaking the page?
8. Are AI features either working or falling back cleanly?
9. Are any P0/P1 bugs open?
10. Is public production still blocked?

## Weekly Beta Review

At the end of each beta week:

- Summarize active users.
- Summarize workflow completion rates.
- Summarize top user complaints.
- Summarize P0/P1/P2/P3 bugs opened and closed.
- Decide whether to expand, pause, or continue beta at the same size.

