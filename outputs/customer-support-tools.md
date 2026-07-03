# Customer Support Tools

Date: July 3, 2026

## Implemented

### User Feedback Widget

Location: Floating `Support` button on every screen.

Supported request types:
- User feedback
- Bug report
- Contact support
- Feature request

Fields:
- Type
- Priority
- Name
- Email
- Company
- Subject
- Details
- Page URL
- User agent

### Support API

Route: `POST /api/feedback`

Behavior:
- Validates subject and message.
- Validates email when supplied.
- Rate limits submissions.
- Stores structured support tickets.
- Sends email to `SUPPORT_EMAIL` when configured.
- Creates audit log entry `support.ticket_created`.

### Admin Feedback Inbox

Location: Admin dashboard.

Admin capabilities:
- View support tickets.
- See type, priority, status, subject, message, email, and company.
- Mark tickets as triaged.
- Close tickets.

Route:
- `GET /api/feedback`: Admin-only ticket listing.
- `PATCH /api/feedback`: Admin-only status update.

## 30-Day Operating Process

1. Review inbox every business day.
2. Triage new items by severity:
   - P0: Platform unavailable, data exposure, payment/security blocker.
   - P1: Signup, login, job posting, application, or admin moderation blocked.
   - P2: Workflow degraded but workaround exists.
   - P3: Cosmetic, copy, or enhancement.
3. Respond to urgent/high-priority tickets within 1 business day.
4. Group recurring feature requests weekly.
5. Feed P1/P2 patterns into the Version 1.1 backlog.

## Support Templates

Bug response:
> Thanks for reporting this. We have logged it for beta triage. If you can share the role/company/page where it happened, that will help us reproduce it faster.

Feature request response:
> Thanks. We are tracking beta feature requests weekly and prioritizing based on customer impact, revenue impact, effort, and risk reduction.

Support request response:
> Thanks for reaching out. We will review this and follow up with the next step.

## Recommended Manual Setup

Set in Vercel Production:
- `SUPPORT_EMAIL`

Recommended external tools for launch:
- Shared support inbox: support@crossovertalent.asia
- Private bug tracker board.
- Daily triage owner.
- Weekly beta feedback review.
