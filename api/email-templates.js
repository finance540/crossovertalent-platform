export const EMAIL_TEMPLATES = {
  welcome: {
    subject: 'Welcome to CrossOver Talent',
    purpose: 'Sent after account activation in production onboarding flows.'
  },
  verification: {
    subject: 'Verify your CrossOver Talent email',
    purpose: 'Sent to employer, candidate, and admin users before dashboard access.'
  },
  passwordReset: {
    subject: 'Reset your CrossOver Talent password',
    purpose: 'Sent after password reset request.'
  },
  applicationReceived: {
    subject: 'Application received: {{job_title}}',
    purpose: 'Sent to candidates after application submission.'
  },
  applicationStatusChanged: {
    subject: 'Application status updated: {{job_title}}',
    purpose: 'Sent to candidates when employer changes application status.'
  },
  interviewScheduled: {
    subject: 'Interview update for {{job_title}}',
    purpose: 'Prepared for future interview scheduling workflow.'
  },
  offer: {
    subject: 'Offer update for {{job_title}}',
    purpose: 'Prepared for offer-stage notification workflow.'
  },
  rejection: {
    subject: 'Application update for {{job_title}}',
    purpose: 'Prepared for rejection-stage notification workflow.'
  }
};
