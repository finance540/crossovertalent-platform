# Assistant UX Flow

## Entry Point

Users see a floating `AI guide` button near the existing support widget. Selecting it opens a compact chat panel with:

- Suggested prompts
- Conversation history
- Text input
- Guided action buttons
- Guidance-only disclaimer

## Public Visitor Flow

Suggested prompts:

- What should I do first?
- I am an employer. How do I start?
- I am looking for jobs. Where do I go?
- How do I contact support?

Primary actions:

- Employer portal
- Job seeker sign in
- Browse jobs
- Contact support

## Employer Flow

Suggested prompts:

- How do I post my first job?
- Why can’t I access my employer dashboard?
- How do I upload my company logo?
- How do I view applicants?

Status handling:

- `pending_review`: explains that profile updates are allowed, but job posting requires admin approval.
- `rejected`: shows rejection reason when available and points to support.
- `suspended`: blocks workflow guidance and points to support.
- `approved`: guides to Jobs and Applications.

Primary actions:

- Go to dashboard
- Post a job
- View applications
- Update company profile
- Browse jobs
- Contact support

## Candidate Flow

Suggested prompts:

- How do I upload my CV?
- How do I apply to a job?
- Where can I see my application status?
- How do I save jobs?

Profile handling:

- If CV/resume is missing, the assistant points users to Resume & preferences.
- If applications exist, the assistant points users to application tracking.
- If profile is incomplete, the assistant suggests CV, LinkedIn, preferences, and job browsing.

Primary actions:

- Candidate dashboard
- Upload CV
- Saved jobs
- Track applications
- Browse jobs
- Contact support

## Admin Flow

Suggested prompts:

- Where do I approve employers?
- How do I moderate reviews?
- How do I check platform health?
- How do I view feedback?

Admin behavior:

- Guidance only.
- Does not approve, reject, suspend, hide, delete, or mutate records.
- Points admins to the relevant dashboard areas.

