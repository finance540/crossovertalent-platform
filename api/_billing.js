import { isJobExpired, listRecords, readRecord } from './_lib.js';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'A focused hiring workspace for a small team.',
    priceEnv: 'STRIPE_PRICE_STARTER',
    maxActiveJobs: 2,
    teamSeats: 1,
    capabilities: ['jobs.publish', 'applications.view_full']
  },
  {
    id: 'growth',
    name: 'Growth',
    description: 'More active roles, AI-assisted job writing, and standard analytics.',
    priceEnv: 'STRIPE_PRICE_GROWTH',
    maxActiveJobs: 25,
    teamSeats: 5,
    capabilities: ['jobs.publish', 'applications.view_full', 'ai.jd_generate', 'analytics.view']
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'An expanded workspace for high-volume hiring teams.',
    priceEnv: 'STRIPE_PRICE_PRO',
    maxActiveJobs: null,
    teamSeats: 10,
    capabilities: ['jobs.publish', 'applications.view_full', 'ai.jd_generate', 'analytics.view', 'candidate.search', 'team.invite', 'branding.edit']
  }
];

export function stripeTestKeyConfigured() {
  return /^sk_test_[^\s]+$/.test(process.env.STRIPE_SECRET_KEY || '');
}

export function billingEnforced() {
  return Boolean(process.env.STRIPE_SECRET_KEY) || process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export function billingPlans() {
  return PLANS.map(({ priceEnv, ...plan }) => ({ ...plan, priceConfigured: Boolean(process.env[priceEnv]) }));
}

export function billingPlan(planId) {
  return PLANS.find((plan) => plan.id === planId) || null;
}

export function billingPlanForPrice(priceId) {
  return PLANS.find((plan) => process.env[plan.priceEnv] && process.env[plan.priceEnv] === priceId) || null;
}

export function activeSubscription(subscription) {
  if (!subscription || !['active', 'trialing'].includes(subscription.status) || !billingPlan(subscription.planId)) return false;
  if (subscription.currentPeriodEnd && Date.parse(subscription.currentPeriodEnd) <= Date.now()) return false;
  return true;
}

export function subscriptionHasEntitlement(subscription, capability) {
  const plan = billingPlan(subscription?.planId);
  return activeSubscription(subscription) && Boolean(plan?.capabilities.includes(capability));
}

function activeJobs(jobs, excludedJobId = '') {
  return jobs.filter((job) => job.recordType === 'job' && job.status === 'active' && String(job.id) !== String(excludedJobId) && !isJobExpired(job));
}

export function publishAllowance(subscription, jobs, excludedJobId = '') {
  const plan = billingPlan(subscription?.planId);
  const count = activeJobs(jobs, excludedJobId).length;
  if (!subscriptionHasEntitlement(subscription, 'jobs.publish')) return { allowed: false, activeJobs: count, jobLimit: null, reason: 'subscription_required' };
  const allowed = plan.maxActiveJobs === null || count < plan.maxActiveJobs;
  return { allowed, activeJobs: count, jobLimit: plan.maxActiveJobs, reason: allowed ? '' : 'job_limit_reached' };
}

export function candidateAccess(subscription, jobs) {
  return subscriptionHasEntitlement(subscription, 'applications.view_full') || jobs.some((job) => job.recordType === 'job' && job.status === 'active' && job.payment_status === 'paid' && !isJobExpired(job));
}

export async function companySubscription(companyId) {
  return await readRecord(`companies/${companyId}/billing.json`) || null;
}

export async function companyPublishAllowance(companyId, excludedJobId = '') {
  const [subscription, jobs] = await Promise.all([
    companySubscription(companyId),
    listRecords(`companies/${companyId}/jobs/`)
  ]);
  return { subscription, ...publishAllowance(subscription, jobs, excludedJobId) };
}

export async function companyHasCandidateAccess(companyId) {
  const [subscription, jobs] = await Promise.all([
    companySubscription(companyId),
    listRecords(`companies/${companyId}/jobs/`)
  ]);
  return candidateAccess(subscription, jobs);
}
