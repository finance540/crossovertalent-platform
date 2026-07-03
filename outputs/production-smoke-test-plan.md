# Crossover Talent Production Smoke Test Plan

Date: July 3, 2026

## Test Accounts

Use production-safe test accounts with clearly marked emails. Do not use real candidate private data during smoke testing.

## Smoke Workflow

1. Employer signup.
2. Employer receives verification email.
3. Employer verifies email.
4. Employer logs in.
5. Employer creates company profile.
6. Employer uploads logo.
7. Employer posts job.
8. Employer edits job.
9. Employer publishes and unpublishes job.
10. Public job board shows only published jobs.
11. Candidate signup.
12. Candidate receives verification email.
13. Candidate verifies email.
14. Candidate logs in.
15. Candidate uploads CV.
16. Candidate saves job.
17. Candidate applies.
18. Candidate receives application confirmation email.
19. Employer receives application notification email.
20. Employer views application.
21. Employer updates candidate status.
22. Candidate receives status update email.
23. Candidate sees updated status.
24. Candidate withdraws eligible application.
25. Review submission works.
26. Review moderation works.
27. Salary signal submission works.
28. Salary aggregate display works.
29. AI JD generation works or safe fallback is shown.
30. AI CV revision works or safe fallback is shown.
31. Admin login works.
32. Admin user/job/review moderation works.

## Pass Criteria

- Every core workflow completes without workaround.
- No major console errors.
- No 5xx API responses.
- No sensitive data exposed in public pages or logs.
- No P0/P1 bugs.

