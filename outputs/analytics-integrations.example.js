// Prepared analytics integrations. Do not enable without production privacy/consent approval.
// Google Analytics, PostHog, Microsoft Clarity, and Mixpanel are intentionally disabled.
export const analyticsIntegrations = {
  googleAnalytics: { enabled: false, env: 'NEXT_PUBLIC_GA_MEASUREMENT_ID' },
  postHog: { enabled: false, env: 'NEXT_PUBLIC_POSTHOG_KEY' },
  microsoftClarity: { enabled: false, env: 'NEXT_PUBLIC_CLARITY_ID' },
  mixpanel: { enabled: false, env: 'NEXT_PUBLIC_MIXPANEL_TOKEN' }
};
