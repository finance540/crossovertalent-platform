# Crossover Talent Production Go/No-Go Checklist

Date: July 3, 2026

## Go Criteria

- [ ] Product owner approves public production.
- [ ] Engineering approves public production.
- [ ] QA approves public production.
- [ ] Security/RLS audit is complete.
- [ ] No open P0/P1 bugs.
- [ ] Production email verification works.
- [ ] Password reset works.
- [ ] Production Supabase writes and reads work.
- [ ] Production Storage uploads and downloads work.
- [ ] OpenAI works or fallback-only mode is explicitly approved.
- [ ] Vercel production build passes.
- [ ] Custom domain and SSL work.
- [ ] Production smoke test passes.
- [ ] Monitoring and rollback owners are assigned.

## No-Go Criteria

- [ ] Any open P0/P1 bug.
- [ ] Email verification does not reach inboxes.
- [ ] Production database writes fail.
- [ ] Uploaded files cannot be stored securely.
- [ ] Auth redirects fail on custom domain.
- [ ] Admin route is accessible to non-admin users.
- [ ] Service-role key appears in client/browser output.
- [ ] Production environment points to staging Supabase by mistake.
- [ ] Rollback path is untested or unclear.

## Current Recommendation

Current recommendation: **No-Go for public production until provider configuration and production smoke testing are complete.**

