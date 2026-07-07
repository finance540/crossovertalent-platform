const LIVE_ORIGIN = 'https://build-me-a-simple-website-where.vercel.app';
const MAX_UPLOAD_BYTES = 3_000_000;
const state = { user: null, candidate: null, admin: null, adminData: null, companyProfile: null, candidateApplications: [], myReviews: [], jobs: [], applications: [], publicJobs: [], publicReviews: [], publicSalarySignals: [], salaryAggregates: [], notifications: [], publicTab: 'jobs', view: 'overview', candidateView: 'overview', authMode: 'login', candidateAuthMode: 'login', adminAuthMode: 'login', search: '', candidateSearch: '', publicSearch: '', sector: '', location: '', level: '', workType: '', functionFilter: '', industry: '', pages: { jobs: 1, applications: 1, publicJobs: 1, publicReviews: 1, publicSalaries: 1, admin: 1 }, pageSize: 10 };
let liveSyncTimer;
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const assistantHistory = JSON.parse(sessionStorage.getItem('ct_assistant_history') || '[]').slice(-8);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function safeExternalUrl(value = '') {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : '';
  } catch { return ''; }
}

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.style.background = error ? '#a44336' : '#17233f';
  element.classList.add('show');
  addNotification(error ? 'Action needed' : 'Update', message, error ? 'error' : 'success');
  setTimeout(() => element.classList.remove('show'), 2400);
}

function addNotification(title, message, type = 'info') {
  state.notifications.unshift({ title, message, type, createdAt: new Date().toISOString() });
  state.notifications = state.notifications.slice(0, 8);
  renderNotifications();
}

function renderNotifications() {
  const panel = $('#notification-panel');
  const button = $('#notification-button');
  if (!panel || !button) return;
  $('.notification-dot')?.classList.toggle('hidden', !state.notifications.length);
  panel.innerHTML = `<h2>Notifications</h2>${state.notifications.length ? state.notifications.map((item) => `<article class="notification-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><p>${dateLabel(item.createdAt)}</p></article>`).join('') : '<article class="notification-item"><strong>All clear</strong><p>Workflow updates, errors, and support confirmations will appear here.</p></article>'}`;
}

function toggleNotifications() {
  const panel = $('#notification-panel');
  panel.classList.toggle('hidden');
  $('#notification-button').setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
}

function skeleton(count = 4) {
  return `<div class="public-jobs">${Array.from({ length: count }).map(() => '<article class="skeleton-card"><div class="skeleton-line short"></div><div class="skeleton-line medium"></div><div class="skeleton-line"></div></article>').join('')}</div>`;
}

function track(type, payload = {}) {
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify({ type, path: location.pathname + location.search, ...payload })], { type: 'application/json' });
    navigator.sendBeacon('/api/telemetry', blob);
    return;
  }
  fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, path: location.pathname + location.search, ...payload }), keepalive: true }).catch(() => {});
}

window.addEventListener('error', (event) => track('client.error', { message: event.message, detail: { source: event.filename, line: event.lineno, column: event.colno } }));
window.addEventListener('unhandledrejection', (event) => track('client.unhandled_rejection', { message: event.reason?.message || String(event.reason || 'Unhandled rejection') }));
window.addEventListener('load', () => {
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav) track('client.performance', { metric: 'navigation', detail: { duration: Math.round(nav.duration), domContentLoaded: Math.round(nav.domContentLoadedEventEnd), transferSize: nav.transferSize || 0 } });
});

async function api(path, options = {}) {
  const url = location.protocol === 'file:' && path.startsWith('/') ? `${LIVE_ORIGIN}${path}` : path;
  const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Something went wrong');
    Object.assign(error, data);
    throw error;
  }
  return data;
}

function formObject(form) {
  return Object.fromEntries(new FormData(form));
}

function filePayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Choose a file first'));
    if (file.size > MAX_UPLOAD_BYTES) return reject(new Error('Upload a PDF, DOCX, or TXT file under 3 MB. For larger PDFs, export a compressed/text PDF or paste the content manually.'));
    if (/\.doc$/i.test(file.name || '') || /msword/i.test(file.type || '')) return reject(new Error('Legacy .doc files are not supported. Export as DOCX, PDF, or TXT and upload again.'));
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', size: file.size, data: String(reader.result).split(',')[1] || '' });
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function absoluteUrl(path = '') {
  return path.startsWith('http') ? path : `${location.origin}${path}`;
}

function parseJsonField(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function structuredLines(value = '') {
  return String(value).split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function showScreen(name) {
  $('#landing-screen').classList.toggle('hidden', name !== 'landing');
  $('#auth-screen').classList.toggle('hidden', name !== 'auth');
  $('#candidate-auth-screen').classList.toggle('hidden', name !== 'candidate-auth');
  $('#jobs-screen').classList.toggle('hidden', name !== 'jobs');
  $('#app').classList.toggle('hidden', name !== 'app');
  $('#candidate-app').classList.toggle('hidden', name !== 'candidate-app');
  $('#admin-screen')?.classList.toggle('hidden', name !== 'admin');
  if (name !== 'app') stopLiveSync();
}

function openAuth(mode = 'login') {
  if (location.protocol === 'file:') {
    location.href = `${LIVE_ORIGIN}/?${mode === 'register' ? 'register' : 'login'}=1`;
    return;
  }
  setAuthMode(mode);
  history.pushState({}, '', mode === 'register' ? '/?register=1' : '/?login=1');
  showScreen('auth');
  window.scrollTo(0, 0);
}

function openJobs() {
  if (location.protocol === 'file:') {
    location.href = `${LIVE_ORIGIN}/?jobs=1`;
    return;
  }
  history.pushState({}, '', '/?jobs=1');
  showScreen('jobs');
  loadPublicJobs();
  window.scrollTo(0, 0);
}

function openCandidateAuth(mode = 'login') {
  if (location.protocol === 'file:') {
    location.href = `${LIVE_ORIGIN}/?candidate=${mode === 'register' ? 'register' : 'login'}`;
    return;
  }
  setCandidateAuthMode(mode);
  history.pushState({}, '', `/?candidate=${mode === 'register' ? 'register' : 'login'}`);
  showScreen('candidate-auth');
  window.scrollTo(0, 0);
}

function stopLiveSync() {
  clearInterval(liveSyncTimer);
  liveSyncTimer = undefined;
}

function startLiveSync() {
  stopLiveSync();
  liveSyncTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return;
    try { await loadDashboard(true); } catch { /* The next sync retries automatically. */ }
  }, 10000);
}

function setAuthMode(mode) {
  state.authMode = mode;
  const register = mode === 'register';
  $$('.register-field').forEach((field) => field.classList.toggle('hidden', !register));
  $('#auth-eyebrow').textContent = register ? 'Start a mandate' : 'Welcome back';
  $('#auth-title').textContent = register ? 'Create employer workspace' : 'Sign in to your workspace';
  $('#auth-subtitle').textContent = register ? 'Your employer portal will be ready in a moment.' : 'Manage your roles and applicant pipeline.';
  $('#auth-submit').innerHTML = register ? 'Create employer workspace <span>→</span>' : 'Sign in <span>→</span>';
  $('#auth-switch-copy').textContent = register ? 'Already have an account?' : 'New to Crossover Talent?';
  $('#auth-switch').textContent = register ? 'Sign in' : 'Create employer workspace';
  const companyInput = $('#auth-form [name="company"]');
  companyInput.required = register;
}

function setCandidateAuthMode(mode) {
  state.candidateAuthMode = mode;
  const register = mode === 'register';
  $$('.candidate-register-field').forEach((field) => field.classList.toggle('hidden', !register));
  $('#candidate-auth-eyebrow').textContent = register ? 'Create job seeker account' : 'Job seeker sign in';
  $('#candidate-auth-title').textContent = register ? 'Create your dashboard' : 'Access your dashboard';
  $('#candidate-auth-subtitle').textContent = register ? 'Save jobs, track applications, and tune your preferences.' : 'Save jobs, track applications, and update your resume.';
  $('#candidate-auth-submit').innerHTML = register ? 'Create job seeker account <span>→</span>' : 'Sign in <span>→</span>';
  $('#candidate-auth-switch-copy').textContent = register ? 'Already have an account?' : 'New to Crossover Talent?';
  $('#candidate-auth-switch').textContent = register ? 'Sign in' : 'Create job seeker account';
  $('#candidate-auth-form [name="name"]').required = register;
}

function showVerificationNotice(selector, response, email, role) {
  const target = $(selector);
  const verifyUrl = response.verificationUrl ? absoluteUrl(response.verificationUrl) : '';
  target.innerHTML = `${escapeHtml(response.message || 'Verify your email before signing in.')}${verifyUrl ? ` <a href="${verifyUrl}" target="_blank" rel="noopener">Open verification link</a>` : ''} <button type="button" class="text-button" data-resend-verification="${role}" data-email="${escapeHtml(email)}">Resend email</button>`;
  $('[data-resend-verification]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    try {
      const endpoint = button.dataset.resendVerification === 'candidate' ? '/api/candidate' : button.dataset.resendVerification === 'admin' ? '/api/admin' : '/api/auth';
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify({ action: 'resend-verification', email: button.dataset.email }) });
      showVerificationNotice(selector, data, button.dataset.email, button.dataset.resendVerification);
      toast('Verification email queued');
    } catch (error) { toast(error.message, true); }
  });
}

function employerStatusLabel(status = '') {
  return ({ pending_review: 'Pending review', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' })[status] || 'Approved';
}

function showEmployerStatusNotice(selector, error) {
  const target = $(selector);
  if (!target) return;
  const status = employerStatusLabel(error.employer_status);
  target.innerHTML = `<strong>${escapeHtml(status)}</strong> · ${escapeHtml(error.message || error.error || 'Your employer account requires admin review before dashboard access.')}${error.rejection_reason ? ` <span>${escapeHtml(error.rejection_reason)}</span>` : ''} <a href="/contact.html">Contact support</a>`;
}

function currentAssistantRole() {
  if (state.admin) return 'admin';
  if (state.user) return 'employer';
  if (state.candidate) return 'candidate';
  if (!$('#admin-screen')?.classList.contains('hidden')) return 'admin';
  if (!$('#candidate-app')?.classList.contains('hidden') || !$('#candidate-auth-screen')?.classList.contains('hidden')) return 'candidate';
  if (!$('#app')?.classList.contains('hidden') || !$('#auth-screen')?.classList.contains('hidden')) return 'employer';
  return 'public';
}

function currentAssistantPage() {
  if (!$('#admin-screen')?.classList.contains('hidden')) return 'admin';
  if (!$('#candidate-app')?.classList.contains('hidden')) return `candidate-${state.candidateView}`;
  if (!$('#app')?.classList.contains('hidden')) return `employer-${state.view}`;
  if (!$('#jobs-screen')?.classList.contains('hidden')) return `marketplace-${state.publicTab}`;
  if (!$('#auth-screen')?.classList.contains('hidden')) return 'login';
  if (!$('#candidate-auth-screen')?.classList.contains('hidden')) return 'candidate-login';
  return 'landing';
}

function assistantContext() {
  const visibleError = ['#auth-subtitle', '#candidate-auth-subtitle', '#admin-auth-message', '#cv-parse-status', '#jd-parse-status']
    .map((selector) => $(selector)?.innerText || '')
    .find((text) => /review|reject|suspend|verify|error|failed|not enabled|not configured/i.test(text)) || '';
  return {
    url: location.pathname + location.search,
    page: currentAssistantPage(),
    role: currentAssistantRole(),
    loginStatus: Boolean(state.user || state.candidate || state.admin),
    employerStatus: state.user?.employer_status || '',
    candidateProfile: state.candidate ? {
      hasResume: Boolean(state.candidate.resume),
      hasLinkedin: Boolean(state.candidate.linkedin),
      savedJobs: (state.candidate.savedJobs || []).length,
      applications: state.candidateApplications.length,
      preferences: state.candidate.preferences || {}
    } : null,
    adminLoaded: Boolean(state.adminData),
    errorText: visibleError
  };
}

function assistantPrompts(role = currentAssistantRole(), page = currentAssistantPage()) {
  if (role === 'employer') {
    if (page === 'employer-company') return ['How do I improve my company profile?', 'How do I upload or replace our logo?', 'What proof should employers add?', 'How do I book hiring support?'];
    if (page === 'employer-jobs') return ['How do I post a stronger job?', 'What should I put in KPI and KRA?', 'How do I publish or close a job?', 'How can Crossover support leadership hiring?'];
    if (page === 'employer-applications') return ['How do I review applicants?', 'How should I update candidate status?', 'What is the candidate pipeline?', 'How do I contact support about hiring?'];
    return ['How do I post my first job?', 'What engagement model is right for us?', 'How does employer approval work?', 'How do I book a consultation?'];
  }
  if (role === 'candidate') {
    if (page === 'candidate-resume') return ['How do I improve my CV?', 'What should I include for impact roles?', 'How do I add LinkedIn?', 'Can AI revise my resume safely?'];
    if (page === 'candidate-saved') return ['How do I compare saved jobs?', 'How do I set job alerts?', 'Which roles fit my preferences?', 'How do I apply from saved jobs?'];
    if (page === 'candidate-applications') return ['Where can I see application status?', 'What happens after I apply?', 'Can I withdraw an application?', 'How long does hiring usually take?'];
    if (page.startsWith('marketplace')) return ['How do I find relevant jobs?', 'How do I use filters?', 'How do I save jobs?', 'What happens after I apply?'];
    return ['How do I upload my CV?', 'How do I apply to a job?', 'Where can I see my application status?', 'How do I get career support?'];
  }
  if (role === 'admin') return ['Where do I approve employers?', 'How do I moderate reviews?', 'How do I check platform health?', 'How do I view feedback?'];
  if (page.startsWith('marketplace')) return ['What should I do first?', 'How do I find climate or impact jobs?', 'How do I submit my CV?', 'What happens after I apply?'];
  if (page === 'login') return ['Why can’t I post a job yet?', 'How does employer approval work?', 'What hiring support is available?', 'How do I contact support?'];
  if (page === 'candidate-login') return ['How do I create a candidate account?', 'How do I submit my CV?', 'Can I track applications?', 'How do I get career support?'];
  return ['Find jobs in Asia', 'Hire talent for impact roles', 'Book a consultation', 'Submit my CV'];
}

function saveAssistantHistory() {
  sessionStorage.setItem('ct_assistant_history', JSON.stringify(assistantHistory.slice(-8)));
}

function actionButtonHtml(action) {
  if (action.href) {
    const href = String(action.href || '').startsWith('/') ? action.href : '/contact.html';
    return `<a href="${escapeHtml(href)}">${escapeHtml(action.label)}</a>`;
  }
  return `<button type="button" data-assistant-action="${escapeHtml(action.action || '')}">${escapeHtml(action.label)}</button>`;
}

function assistantMessageClass(from = 'assistant') {
  return ['user', 'assistant', 'error'].includes(from) ? from : 'assistant';
}

function renderAssistant() {
  const suggestions = $('#assistant-suggestions');
  const messages = $('#assistant-messages');
  if (!suggestions || !messages) return;
  suggestions.innerHTML = assistantPrompts().map((prompt) => `<button type="button" class="assistant-chip" data-assistant-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`).join('');
  messages.innerHTML = assistantHistory.length ? assistantHistory.map((item) => {
    const actions = item.actions?.length ? `<div class="assistant-actions">${item.actions.map(actionButtonHtml).join('')}</div>` : '';
    return `<article class="assistant-message ${assistantMessageClass(item.from)}">${escapeHtml(item.text)}${actions}</article>`;
  }).join('') : `<article class="assistant-message">Hi, I’m your Crossover Talent guide. Ask me where to go next, how to complete a workflow, or why an account status is blocking an action.</article>`;
  messages.scrollTop = messages.scrollHeight;
  $$('[data-assistant-prompt]').forEach((button) => button.addEventListener('click', () => submitAssistantPrompt(button.dataset.assistantPrompt)));
  $$('[data-assistant-action]').forEach((button) => button.addEventListener('click', () => runAssistantAction(button.dataset.assistantAction)));
}

function addAssistantMessage(from, text, actions = []) {
  assistantHistory.push({ from, text, actions: actions.slice(0, 5), at: new Date().toISOString() });
  while (assistantHistory.length > 8) assistantHistory.shift();
  saveAssistantHistory();
  renderAssistant();
}

function runAssistantAction(action) {
  if (action === 'employer-jobs') return setView('jobs');
  if (action === 'employer-applications') return setView('applications');
  if (action === 'employer-profile') return setView('company');
  if (action === 'candidate-resume') return setCandidateView('resume');
  if (action === 'candidate-saved') return setCandidateView('saved');
  if (action === 'candidate-applications') return setCandidateView('applications');
  if (action === 'admin-employers' || action === 'admin-reviews' || action === 'admin-feedback' || action === 'admin-health') return loadAdminDashboard();
  toast('Open the suggested page to continue');
}

function toggleAssistant(open = null) {
  const panel = $('#assistant-panel');
  const button = $('#assistant-widget-button');
  const shouldOpen = open ?? panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !shouldOpen);
  button.setAttribute('aria-expanded', String(shouldOpen));
  if (shouldOpen) {
    renderAssistant();
    $('#assistant-input')?.focus();
  }
}

async function submitAssistantPrompt(prompt) {
  const message = String(prompt || $('#assistant-input')?.value || '').trim();
  if (!message) return;
  $('#assistant-input').value = '';
  addAssistantMessage('user', message);
  const submit = $('#assistant-form button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const response = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'navigation-assistant', message, context: assistantContext(), history: assistantHistory.slice(-6) }) });
    addAssistantMessage(response.fallback ? 'assistant' : 'assistant', response.reply, response.actions || []);
  } catch (error) {
    addAssistantMessage('error', `${error.message || 'Assistant is unavailable.'}\n\nYou can still contact support or use the suggested prompts to navigate manually.`, [{ label: 'Contact support', href: '/contact.html' }]);
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function startProviderLogin(provider, role) {
  try {
    const status = await api('/api/auth-provider');
    const providerStatus = status.providers?.[provider] || {};
    if (!status.supabaseAuthConfigured || !providerStatus.configured) {
      throw new Error(`${providerStatus.label || provider} login is prepared but not enabled yet. Ask an admin to configure the provider in Supabase.`);
    }
    location.href = `/api/auth-provider?provider=${encodeURIComponent(provider)}&role=${encodeURIComponent(role)}`;
  } catch (error) {
    toast(error.message, true);
  }
}

async function handleProviderSessionResponse(response, role, noticeSelector = '#auth-subtitle') {
  if (response.user) {
    state.user = response.user;
    history.replaceState({}, '', response.redirectTo || '/?dashboard=1');
    showScreen('app');
    await loadDashboard();
    toast('Welcome back');
    return;
  }
  if (response.candidate) {
    state.candidate = response.candidate;
    state.candidateApplications = response.applications || [];
    history.replaceState({}, '', response.redirectTo || '/?candidate=dashboard');
    await loadCandidateDashboard();
    toast('Welcome back');
    return;
  }
  if (response.admin) {
    state.admin = response.admin;
    history.replaceState({}, '', response.redirectTo || '/?admin=1');
    await loadAdminDashboard();
    toast('Admin signed in');
    return;
  }
  if (role === 'employer' && response.employer_status) showEmployerStatusNotice(noticeSelector, response);
}

async function completeOAuthCallback() {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const code = params.get('code') || '';
  const directState = params.get('state') || '';
  const accessToken = hash.get('access_token') || '';
  const role = params.get('role') || 'candidate';
  const provider = hash.get('provider_token') ? 'oauth' : 'oauth';
  let completed = false;
  if (code && directState) {
    let fallbackPath = '/?candidate=login';
    try {
      const response = await api('/api/auth-provider', { method: 'POST', body: JSON.stringify({ action: 'complete-linkedin', code, state: directState }) });
      await handleProviderSessionResponse(response, response.candidate ? 'candidate' : response.admin ? 'admin' : 'employer', response.candidate ? '#candidate-auth-subtitle' : '#auth-subtitle');
      completed = true;
      return;
    } catch (error) {
      if (error.employer_status) {
        openAuth('login');
        showEmployerStatusNotice('#auth-subtitle', error);
        fallbackPath = '/?login=1';
      } else {
        openCandidateAuth('login');
      }
      toast(error.message || 'LinkedIn login could not be completed.', true);
    } finally {
      if (!completed) history.replaceState({}, '', fallbackPath);
    }
    return;
  }
  if (!accessToken) {
    showScreen('landing');
    toast('Social login returned without a Supabase access token. Check the Supabase Auth flow configuration.', true);
    return;
  }
  try {
    const response = await api('/api/auth-provider', { method: 'POST', body: JSON.stringify({ action: 'complete-oauth', role, provider, accessToken }) });
    await handleProviderSessionResponse(response, role, role === 'candidate' ? '#candidate-auth-subtitle' : '#auth-subtitle');
    completed = true;
  } catch (error) {
    if (error.employer_status) {
      openAuth('login');
      showEmployerStatusNotice('#auth-subtitle', error);
    } else if (role === 'candidate') {
      openCandidateAuth('login');
    } else {
      showScreen('landing');
    }
    toast(error.message, true);
  } finally {
    if (!completed) history.replaceState({}, '', role === 'candidate' ? '/?candidate=login' : role === 'admin' ? '/?admin=1' : '/?login=1');
  }
}

async function startPhoneOtp(role, selector) {
  try {
    const phone = $(selector)?.value || '';
    const response = await api('/api/auth-provider', { method: 'POST', body: JSON.stringify({ action: 'start-phone-otp', role, phone }) });
    toast(response.message || 'OTP sent');
    const token = window.prompt('Enter the OTP code sent to your phone') || '';
    if (!token.trim()) return;
    const company = role === 'employer' ? (window.prompt('Company name for employer review') || '') : '';
    const name = role === 'candidate' || role === 'admin' ? (window.prompt('Your name') || '') : '';
    const verified = await api('/api/auth-provider', { method: 'POST', body: JSON.stringify({ action: 'verify-phone-otp', role, phone, token, company, name }) });
    await handleProviderSessionResponse(verified, role, role === 'candidate' ? '#candidate-auth-subtitle' : role === 'admin' ? '#admin-auth-message' : '#auth-subtitle');
  } catch (error) {
    if (error.employer_status) showEmployerStatusNotice('#auth-subtitle', error);
    toast(error.message, true);
  }
}

function initials(value = '') {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CO';
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function filtered(items, fields) {
  const query = state.search.trim().toLowerCase();
  return query ? items.filter((item) => fields.some((field) => String(item[field] || '').toLowerCase().includes(query))) : items;
}

function ratingStars(value = 0) {
  const score = Math.max(0, Math.min(5, Number(value) || 0));
  return `${'★'.repeat(Math.round(score))}${'☆'.repeat(5 - Math.round(score))}`;
}

function moneyLabel(value = '') {
  return value ? escapeHtml(value) : 'Salary not listed';
}

function statusLabel(value = '') {
  return ({ new: 'Applied', applied: 'Applied', review: 'Shortlisted', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offered', offered: 'Offered', rejected: 'Rejected', hired: 'Hired', withdrawn: 'Withdrawn' })[value] || value || 'Applied';
}

function salaryRange(signal) {
  const currency = escapeHtml(signal.currency || 'USD');
  return `${currency} ${Number(signal.salaryMin || signal.averageMin || 0).toLocaleString()} - ${Number(signal.salaryMax || signal.averageMax || 0).toLocaleString()}`;
}

function emptyState(icon, title, copy, action = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${copy}</p>${action}</div>`;
}

function pageKeyForPublic() {
  return state.publicTab === 'reviews' ? 'publicReviews' : state.publicTab === 'salaries' ? 'publicSalaries' : 'publicJobs';
}

function resetPage(key) {
  state.pages[key] = 1;
}

function paginate(items, key) {
  const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
  const page = Math.min(state.pages[key] || 1, totalPages);
  state.pages[key] = page;
  const start = (page - 1) * state.pageSize;
  return { page, totalPages, total: items.length, items: items.slice(start, start + state.pageSize) };
}

function paginationControls(key, pageData) {
  if (pageData.totalPages <= 1) return '';
  return `<div class="pagination"><button class="mini-button" data-page="${key}" data-next-page="${pageData.page - 1}" ${pageData.page <= 1 ? 'disabled' : ''}>Previous</button><span>Page ${pageData.page} of ${pageData.totalPages} · ${pageData.total} records</span><button class="mini-button" data-page="${key}" data-next-page="${pageData.page + 1}" ${pageData.page >= pageData.totalPages ? 'disabled' : ''}>Next</button></div>`;
}

function bindPagination(scope = document) {
  scope.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => {
    state.pages[button.dataset.page] = Number(button.dataset.nextPage);
    render();
    if ($('#jobs-screen') && !$('#jobs-screen').classList.contains('hidden')) renderMarketplace();
    if ($('#candidate-app') && !$('#candidate-app').classList.contains('hidden')) renderCandidateDashboard();
    if ($('#admin-screen') && !$('#admin-screen').classList.contains('hidden')) renderAdminDashboard();
  }));
}

function renderOverview() {
  const activeJobs = state.jobs.filter((job) => job.status === 'active').length;
  const interviewing = state.applications.filter((item) => item.status === 'interview').length;
  const hired = state.applications.filter((item) => item.status === 'hired').length;
  const recent = state.applications.slice(0, 5);
  $('#main-content').innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">Hiring overview</p><h1>Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${escapeHtml(state.user.company)}.</h1><p class="muted"><span class="live-dot"></span> Live pipeline · updates automatically</p></div></section>
    <section class="tour-grid" aria-label="Employer onboarding tour">
      <article class="tour-card"><span>1</span><h3>Complete profile</h3><p>Add company story, sector, location, website, and logo.</p></article>
      <article class="tour-card"><span>2</span><h3>Post role</h3><p>Use the JD assistant or upload an existing job description.</p></article>
      <article class="tour-card"><span>3</span><h3>Manage pipeline</h3><p>Move candidates through shortlist, interview, offer, and hire.</p></article>
    </section>
    <section class="stats-grid">
      <article class="stat-card"><div class="stat-icon blue">▣</div><p>Open roles</p><strong>${activeJobs}</strong></article>
      <article class="stat-card"><div class="stat-icon coral">♙</div><p>Total applicants</p><strong>${state.applications.length}</strong></article>
      <article class="stat-card"><div class="stat-icon yellow">◷</div><p>In interviews</p><strong>${interviewing}</strong></article>
      <article class="stat-card"><div class="stat-icon green">✓</div><p>Hired</p><strong>${hired}</strong></article>
    </section>
    <section class="panel"><div class="panel-header"><div><h2>Recent applications</h2><p>Your newest candidates</p></div>${recent.length ? '<button class="text-button" data-go="applications">View all →</button>' : ''}</div>
      ${recent.length ? applicationTable(recent) : emptyState('♙', 'Your pipeline is ready', 'Applications will appear here as candidates submit them through your public job board.', state.jobs.length ? `<a class="button subtle" href="/?jobs=1&company=${encodeURIComponent(state.user.companyId)}" target="_blank">View public board</a>` : '<button class="button primary" data-post-job>Post your first job</button>')}
    </section>`;
}

function jobTable(jobs) {
  return `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Sector</th><th>Status</th><th>Applications</th><th>Published</th><th>Actions</th></tr></thead><tbody>${jobs.map((job) => `<tr><td class="title-cell"><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(job.department)} · ${escapeHtml(job.location)} · ${escapeHtml(job.type)}</small></td><td><span class="sector-pill">${escapeHtml(job.sector || 'Impact')}</span></td><td><span class="status ${job.status}">${job.status === 'active' ? 'Published' : 'Unpublished'}</span></td><td>${job.application_count}</td><td>${dateLabel(job.created_at)}</td><td><div class="row-actions"><button class="mini-button" data-job-share="${job.id}">Share</button><button class="mini-button" data-job-edit="${job.id}">Edit</button><button class="mini-button" data-job-toggle="${job.id}" data-next="${job.status === 'active' ? 'closed' : 'active'}">${job.status === 'active' ? 'Unpublish' : 'Publish'}</button><button class="mini-button" data-job-delete="${job.id}">Delete</button></div></td></tr>`).join('')}</tbody></table></div>`;
}

function renderJobs() {
  const jobs = filtered(state.jobs, ['title', 'department', 'location', 'status']);
  const page = paginate(jobs, 'jobs');
  $('#main-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Roles</p><h1>Your jobs</h1><p class="muted">Publish roles and control what appears on your public board.</p></div><button class="button primary" data-post-job>＋ Post a job</button></section><section class="panel"><div class="panel-header"><div><h2>${jobs.length} ${jobs.length === 1 ? 'role' : 'roles'}</h2><p>${state.search ? 'Matching your search' : 'All roles in your workspace'}</p></div></div>${jobs.length ? jobTable(page.items) + paginationControls('jobs', page) : emptyState('▣', state.search ? 'No matching roles' : 'Post your first role', state.search ? 'Try another search term.' : 'Create a role and start accepting applications.', state.search ? '' : '<button class="button primary" data-post-job>Post a job</button>')}</section>`;
  bindPagination($('#main-content'));
}

function applicationTable(applications) {
  return `<div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Role</th><th>Applied</th><th>Status</th></tr></thead><tbody>${applications.map((item) => `<tr data-application="${item.id}"><td class="title-cell"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></td><td>${escapeHtml(item.job_title)}</td><td>${dateLabel(item.created_at)}</td><td><span class="status ${item.status}">${statusLabel(item.status)}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function renderApplications() {
  const applications = filtered(state.applications, ['name', 'email', 'job_title', 'status']);
  const page = paginate(applications, 'applications');
  $('#main-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Pipeline</p><h1>Applications</h1><p class="muted">Review candidates and keep every decision visible.</p></div></section><section class="panel"><div class="panel-header"><div><h2>${applications.length} ${applications.length === 1 ? 'candidate' : 'candidates'}</h2><p>${state.search ? 'Matching your search' : 'Across every role'}</p></div></div>${applications.length ? applicationTable(page.items) + paginationControls('applications', page) : emptyState('♙', state.search ? 'No matching candidates' : 'No applications yet', state.search ? 'Try another search term.' : 'Share your public job board. New applications will arrive here automatically.')}</section>`;
  bindPagination($('#main-content'));
}

function renderCompanyProfile() {
  const profile = state.companyProfile || {};
  const logoUrl = profile.logo?.publicUrl || profile.logo?.dataUrl || '';
  const logo = logoUrl ? `<div class="logo-preview"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(profile.company)} logo" /><button class="mini-button" id="remove-company-logo">Remove logo</button></div>` : '<p class="muted">No logo uploaded yet.</p>';
  $('#main-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Company profile</p><h1>Edit public company details.</h1><p class="muted">This profile powers company cards and candidate trust signals.</p></div></section>
  <section class="panel candidate-form-panel"><div class="form-grid"><label>Company name<input id="company-name-input" value="${escapeHtml(profile.company || state.user.company || '')}" /></label><label>Website<input id="company-website-input" placeholder="https://example.org" value="${escapeHtml(profile.website || '')}" /></label><label>Focus sector<select id="company-sector-input"><option value="">Select sector</option>${['Climate', 'Impact Investment', 'Public Healthcare', 'Agriculture', 'Water', 'Education', 'Clean Energy', 'Philanthropic Foundation', 'Circular Economy', 'CSR', 'ESG Consulting'].map((sector) => `<option ${profile.sector === sector ? 'selected' : ''}>${sector}</option>`).join('')}</select></label><label>Location<input id="company-location-input" value="${escapeHtml(profile.location || '')}" /></label><label class="span-2">Description<textarea id="company-description-input" rows="5">${escapeHtml(profile.description || '')}</textarea></label></div><div class="ai-box"><strong>Company logo</strong>${logo}<div class="inline-actions"><label class="upload-button">Upload logo<input id="company-logo-input" type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" /></label></div><p class="muted" id="company-logo-status">PNG, JPG, WEBP, or SVG under 750 KB.</p></div><div class="dialog-actions"><button class="button primary" id="save-company-profile">Save company profile</button></div></section>`;
  $('#save-company-profile').addEventListener('click', () => saveCompanyProfile());
  $('#company-logo-input').addEventListener('change', (event) => saveCompanyProfile(event.target.files[0]));
  $('#remove-company-logo')?.addEventListener('click', () => saveCompanyProfile(null, true));
}

function candidateJobsById() {
  return new Map(state.publicJobs.map((job) => [String(job.id), job]));
}

function filteredCandidateApplications() {
  const query = state.candidateSearch.trim().toLowerCase();
  return query ? state.candidateApplications.filter((item) => `${item.job_title} ${item.status} ${item.location || ''}`.toLowerCase().includes(query)) : state.candidateApplications;
}

function renderCandidateOverview() {
  const saved = state.candidate.savedJobs || [];
  const applications = state.candidateApplications || [];
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Job seeker dashboard</p><h1>Welcome, ${escapeHtml(state.candidate.name)}.</h1><p class="muted">Track roles, update your resume, and manage job preferences.</p></div><button class="button primary" data-candidate-go="resume">Update resume</button></section>
  <section class="tour-grid" aria-label="Candidate onboarding tour">
    <article class="tour-card"><span>1</span><h3>Save jobs</h3><p>Shortlist roles across climate, health, finance, ESG, and public-good teams.</p></article>
    <article class="tour-card"><span>2</span><h3>Upload CV</h3><p>Use a text-based PDF, DOCX, or TXT file for best parsing.</p></article>
    <article class="tour-card"><span>3</span><h3>Track status</h3><p>Follow each application from applied through final decision.</p></article>
  </section>
  <section class="stats-grid"><article class="stat-card"><div class="stat-icon green">♡</div><p>Saved jobs</p><strong>${saved.length}</strong></article><article class="stat-card"><div class="stat-icon blue">♙</div><p>Applied jobs</p><strong>${applications.length}</strong></article><article class="stat-card"><div class="stat-icon yellow">◎</div><p>Resume</p><strong>${state.candidate.resume ? 'Ready' : 'Add'}</strong></article><article class="stat-card"><div class="stat-icon coral">⚙</div><p>Preferences</p><strong>${Object.values(state.candidate.preferences || {}).filter(Boolean).length}</strong></article></section>
  <section class="panel"><div class="panel-header"><div><h2>Recent applications</h2><p>Your application history across Crossover Talent.</p></div></div>${applications.length ? applicationTable(applications.slice(0, 5)) : emptyState('♙', 'No applications yet', 'Apply to jobs from the public board and they will appear here.')}</section>`;
}

function renderSavedJobs() {
  const jobs = candidateJobsById();
  const saved = (state.candidate.savedJobs || []).map((id) => jobs.get(String(id))).filter(Boolean);
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Saved jobs</p><h1>${saved.length} saved role${saved.length === 1 ? '' : 's'}</h1><p class="muted">Save roles from the marketplace and revisit them here.</p></div><a class="button primary" href="/?jobs=1">Browse jobs</a></section><section class="panel">${saved.length ? saved.map((job) => `<article class="public-job"><div><p class="company">${escapeHtml(job.company)} · ${escapeHtml(job.sector || 'Impact')}</p><h2>${escapeHtml(job.title)}</h2><p>${escapeHtml(job.location)} · ${moneyLabel(job.salary)}</p></div><div class="row-actions"><button class="button subtle" data-unsave-job="${job.id}">Remove</button><button class="button primary" data-apply="${job.id}">Apply</button></div></article>`).join('') : emptyState('♡', 'No saved jobs yet', 'Browse the job board and save roles that match your preferences.')}</section>`;
  $$('[data-unsave-job]').forEach((button) => button.addEventListener('click', () => toggleSaveJob(button.dataset.unsaveJob, false)));
  $$('[data-apply]').forEach((button) => button.addEventListener('click', () => openApply(button.dataset.apply)));
}

function renderCandidateApplications() {
  const applications = filteredCandidateApplications();
  const page = paginate(applications, 'applications');
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Application history</p><h1>${applications.length} applied job${applications.length === 1 ? '' : 's'}</h1><p class="muted">Status updates from employers appear here.</p></div></section><section class="panel">${applications.length ? `<div class="table-wrap"><table><thead><tr><th>Role</th><th>Applied</th><th>Status</th><th>Action</th></tr></thead><tbody>${page.items.map((item) => `<tr><td class="title-cell"><strong>${escapeHtml(item.job_title)}</strong><small>${escapeHtml(item.company || item.companyId || '')}</small></td><td>${dateLabel(item.created_at)}</td><td><span class="status ${item.status}">${statusLabel(item.status)}</span></td><td>${['offered', 'hired', 'withdrawn', 'offer'].includes(item.status) ? '—' : `<button class="mini-button" data-withdraw-application="${item.id}">Withdraw</button>`}</td></tr>`).join('')}</tbody></table></div>${paginationControls('applications', page)}` : emptyState('♙', 'No application history', 'Apply to roles with your candidate email to build this history.')}</section>`;
  $$('[data-withdraw-application]').forEach((button) => button.addEventListener('click', () => withdrawApplication(button.dataset.withdrawApplication)));
  bindPagination($('#candidate-content'));
}

async function withdrawApplication(id) {
  if (!window.confirm('Withdraw this application? You will not be able to re-apply unless the employer reopens the process.')) return;
  try {
    await api('/api/applications', { method: 'PATCH', body: JSON.stringify({ action: 'withdraw', id }) });
    await loadCandidateDashboard();
    state.candidateView = 'applications';
    renderCandidateDashboard();
    toast('Application withdrawn');
  } catch (error) {
    toast(error.message, true);
  }
}

function renderResumeTools() {
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Resume and AI</p><h1>Create or update your resume.</h1><p class="muted">Use your current resume and target role to generate a cleaner version.</p></div></section>
  <section class="panel candidate-form-panel"><div class="ai-box"><strong>Upload CV</strong><p>Upload a PDF, DOCX, or TXT file to parse and save it to your candidate profile.</p><div class="inline-actions"><label class="upload-button">Upload CV<input id="candidate-resume-upload" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" /></label></div><p class="muted" id="candidate-resume-upload-status">No CV parsed yet.</p></div><label>Current resume<textarea id="candidate-resume" rows="9">${escapeHtml(state.candidate.resume || '')}</textarea></label><label>Target role<input id="candidate-target-role" placeholder="e.g. Climate Data Lead" /></label><label>Key skills<input id="candidate-skills" placeholder="SQL, MRV, partnerships" /></label><div class="dialog-actions"><button class="button subtle" id="save-resume-profile">Save resume</button><button class="button primary" id="generate-candidate-resume">Generate AI resume</button></div><label>AI chat<textarea id="candidate-chat-message" rows="3" placeholder="Ask about improving your resume or job search strategy"></textarea></label><div class="dialog-actions"><button class="button subtle" id="candidate-chat-button">Ask AI</button></div><div id="candidate-ai-output" class="cv-panel hidden"></div></section>`;
  $('#candidate-resume-upload').addEventListener('change', uploadCandidateResume);
  $('#save-resume-profile').addEventListener('click', () => saveCandidateProfile({ resume: $('#candidate-resume').value }));
  $('#generate-candidate-resume').addEventListener('click', () => generateCandidateResume());
  $('#candidate-chat-button').addEventListener('click', () => candidateChat());
}

async function uploadCandidateResume(event) {
  const file = event.target.files[0];
  if (!file) return;
  $('#candidate-resume-upload-status').textContent = `Reading ${file.name}...`;
  try {
    const payload = await filePayload(file);
    payload.purpose = 'cv';
    const parsed = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'parse-document', file: payload }) });
    $('#candidate-resume').value = parsed.text;
    await saveCandidateProfile({ resume: parsed.text });
    const confidence = parsed.readabilityScore ? `${parsed.confidence} confidence (${Math.round(parsed.readabilityScore * 100)}% readable)` : `${parsed.confidence} confidence`;
    const method = parsed.extractionMethod === 'ocr' ? 'OCR parsed' : 'parsed';
    $('#candidate-resume-upload-status').textContent = `${parsed.file.fileName || parsed.file.name || file.name} uploaded, ${method}, and saved to your profile with ${confidence}.`;
    toast('CV uploaded and saved');
  } catch (error) {
    $('#candidate-resume-upload-status').textContent = `CV upload or parsing failed. ${error.message || 'Try a clearer text-based PDF/DOCX/TXT or paste the CV content manually.'}`;
    toast(error.message, true);
  } finally {
    event.target.value = '';
  }
}

function renderCandidatePreferences() {
  const prefs = state.candidate.preferences || {};
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Job preferences</p><h1>Tell us what ideal looks like.</h1><p class="muted">These preferences power matching, saved-job review, and AI guidance.</p></div></section>
  <section class="panel candidate-form-panel"><div class="form-grid"><label>Preferred company<input id="pref-company" value="${escapeHtml(prefs.company || '')}" /></label><label>Current compensation<input id="pref-current" value="${escapeHtml(prefs.currentCompensation || '')}" /></label><label>Expected compensation<input id="pref-expected" value="${escapeHtml(prefs.expectedCompensation || '')}" /></label><label>Designation<input id="pref-designation" value="${escapeHtml(prefs.designation || '')}" /></label><label>Job location<input id="pref-location" value="${escapeHtml(prefs.location || '')}" /></label><label>Ideal job role<input id="pref-role" value="${escapeHtml(prefs.idealRole || '')}" /></label></div><div class="dialog-actions"><button class="button primary" id="save-candidate-preferences">Save preferences</button></div></section>`;
  $('#save-candidate-preferences').addEventListener('click', () => saveCandidateProfile({ preferences: { company: $('#pref-company').value, currentCompensation: $('#pref-current').value, expectedCompensation: $('#pref-expected').value, designation: $('#pref-designation').value, location: $('#pref-location').value, idealRole: $('#pref-role').value } }));
}

function renderCandidateReviews() {
  $('#candidate-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">My reviews</p><h1>Edit your workplace reviews.</h1><p class="muted">Update reviews you created. Public identity settings still apply.</p></div><button class="button primary" id="candidate-add-review">Add review</button></section><section class="panel">${state.myReviews.length ? state.myReviews.map((review) => `<article class="review-card"><div class="review-head"><div><p class="company">${escapeHtml(review.company)} · ${escapeHtml(review.sector)}</p><h2>${escapeHtml(review.headline)}</h2></div><strong>${ratingStars(review.rating)} ${Number(review.rating).toFixed(1)}</strong></div><p>${escapeHtml(review.role)} · ${escapeHtml(review.location)}</p><div class="row-actions"><button class="mini-button" data-edit-review="${review.id}">Edit review</button></div></article>`).join('') : emptyState('◎', 'No reviews yet', 'Add a verified review from the marketplace or your dashboard.')}</section>`;
  $('#candidate-add-review').addEventListener('click', () => openReviewDialog());
  $$('[data-edit-review]').forEach((button) => button.addEventListener('click', () => openReviewDialog(state.myReviews.find((review) => review.id === button.dataset.editReview))));
}

function renderCandidateDashboard() {
  $('#saved-count-nav').textContent = (state.candidate.savedJobs || []).length;
  $('#candidate-application-count-nav').textContent = state.candidateApplications.length;
  $('#candidate-name').textContent = state.candidate.name;
  $('#candidate-email').textContent = state.candidate.email;
  $('#candidate-avatar').textContent = initials(state.candidate.name);
  $$('.nav-item[data-candidate-view]').forEach((item) => item.classList.toggle('active', item.dataset.candidateView === state.candidateView));
  if (state.candidateView === 'saved') renderSavedJobs();
  else if (state.candidateView === 'applications') renderCandidateApplications();
  else if (state.candidateView === 'resume') renderResumeTools();
  else if (state.candidateView === 'reviews') renderCandidateReviews();
  else if (state.candidateView === 'preferences') renderCandidatePreferences();
  else renderCandidateOverview();
  $$('[data-candidate-go]').forEach((button) => button.addEventListener('click', () => setCandidateView(button.dataset.candidateGo)));
}

function setCandidateView(view) {
  state.candidateView = view;
  $('#candidate-app .sidebar').classList.remove('open');
  renderCandidateDashboard();
}

async function loadCandidateDashboard() {
  showScreen('candidate-app');
  $('#candidate-content').innerHTML = skeleton(3);
  const [candidateData, jobsData, reviewsData, myReviewsData] = await Promise.all([api('/api/candidate'), api('/api/jobs?public=1'), api('/api/reviews'), api('/api/reviews?mine=1').catch(() => ({ reviews: [] }))]);
  state.candidate = candidateData.candidate;
  state.candidateApplications = candidateData.applications;
  state.publicJobs = jobsData.jobs;
  state.publicReviews = reviewsData.reviews;
  state.myReviews = myReviewsData.reviews || [];
  renderCandidateDashboard();
}

function render() {
  if (state.view === 'jobs') renderJobs();
  else if (state.view === 'applications') renderApplications();
  else if (state.view === 'company') renderCompanyProfile();
  else renderOverview();
  $$('[data-post-job]').forEach((button) => button.addEventListener('click', () => openJobDialog()));
  $$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
  $$('[data-job-toggle]').forEach((button) => button.addEventListener('click', () => updateJob(button.dataset.jobToggle, button.dataset.next)));
  $$('[data-job-edit]').forEach((button) => button.addEventListener('click', () => openJobDialog(state.jobs.find((job) => String(job.id) === button.dataset.jobEdit))));
  $$('[data-job-share]').forEach((button) => button.addEventListener('click', () => shareJob(button.dataset.jobShare)));
  $$('[data-job-delete]').forEach((button) => button.addEventListener('click', () => deleteJob(button.dataset.jobDelete)));
  $$('[data-application]').forEach((row) => row.addEventListener('click', () => openApplication(row.dataset.application)));
}

function setView(view) {
  state.view = view;
  state.search = '';
  $('#global-search').value = '';
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  $('.sidebar').classList.remove('open');
  render();
}

async function loadDashboard(silent = false) {
  if (!silent) $('#main-content').innerHTML = skeleton(4);
  const [jobsData, applicationsData, companyData] = await Promise.all([api('/api/jobs'), api('/api/applications'), api('/api/company').catch(() => ({ profile: null }))]);
  state.jobs = jobsData.jobs;
  state.applications = applicationsData.applications;
  state.companyProfile = companyData.profile;
  $('#job-count-nav').textContent = state.jobs.length;
  $('#application-count-nav').textContent = state.applications.length;
  $('#profile-name').textContent = state.user.company;
  $('#profile-email').textContent = state.user.email;
  $('.profile-button .avatar').textContent = initials(state.user.company);
  render();
  if (!silent) startLiveSync();
}

async function saveCompanyProfile(file, remove = false) {
  const payload = {
    company: $('#company-name-input').value,
    website: $('#company-website-input').value,
    sector: $('#company-sector-input').value,
    location: $('#company-location-input').value,
    description: $('#company-description-input').value
  };
  try {
    if (file) {
      $('#company-logo-status').textContent = `Uploading ${file.name}...`;
      payload.logo = await filePayload(file);
    }
    if (remove) payload.logo = { remove: true };
    const data = await api('/api/company', { method: 'PATCH', body: JSON.stringify(payload) });
    state.companyProfile = data.profile;
    state.user.company = data.profile.company;
    $('#profile-name').textContent = state.user.company;
    renderCompanyProfile();
    toast('Company profile saved');
  } catch (error) {
    if (error.verificationRequired) showVerificationNotice('#candidate-auth-subtitle', error, data.email, 'candidate');
    toast(error.message, true);
  }
}

function openJobDialog(job = null) {
  const form = $('#job-form');
  form.reset();
  form.elements.id.value = job?.id || '';
  $('#job-dialog-eyebrow').textContent = job ? 'Update role' : 'Create a role';
  $('#job-dialog-title').textContent = job ? 'Edit job' : 'Post a new job';
  $('#job-submit').textContent = job ? 'Save changes' : 'Publish job';
  if (job) ['title', 'department', 'location', 'type', 'salary', 'sector', 'experience', 'impactArea', 'description'].forEach((field) => { form.elements[field].value = job[field] || ''; });
  form.elements.sourceText.value = job?.sourceText || '';
  form.elements.sourceAttachment.value = job?.sourceAttachment ? JSON.stringify(job.sourceAttachment) : '';
  form.elements.aiInputs.value = job?.aiInputs ? JSON.stringify(job.aiInputs) : '';
  $('#job-parse-status').textContent = job?.sourceAttachment?.name ? `Parsed ${job.sourceAttachment.name}` : 'No attachment parsed yet.';
  $('#job-dialog').showModal();
}

async function shareJob(id) {
  const url = `${location.origin}/?jobs=1&company=${encodeURIComponent(state.user.companyId)}&job=${encodeURIComponent(id)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Direct job link copied');
  } catch { toast('Copy failed. Open the public board and copy its URL.', true); }
}

async function updateJob(id, status) {
  try {
    await api('/api/jobs', { method: 'PATCH', body: JSON.stringify({ id, status }) });
    await loadDashboard();
    toast(status === 'active' ? 'Job reopened' : 'Job closed');
  } catch (error) { toast(error.message, true); }
}

async function deleteJob(id) {
  if (!window.confirm('Delete this job? Applications already received will be kept.')) return;
  try {
    await api(`/api/jobs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await loadDashboard();
    toast('Job deleted');
  } catch (error) { toast(error.message, true); }
}

function openApplication(id) {
  const item = state.applications.find((application) => String(application.id) === String(id));
  if (!item) return;
  const safeLink = safeExternalUrl(item.linkedin);
  const link = safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener">Open link ↗</a>` : '<strong>Not provided</strong>';
  const cvBlock = item.cv_text || item.revised_cv ? `<div class="cv-panel"><h3>Candidate CV</h3>${item.cvAttachment?.name ? `<p><strong>Attachment:</strong> ${escapeHtml(item.cvAttachment.name)}</p>` : ''}${item.linkedin_note ? `<p>${escapeHtml(item.linkedin_note)}</p>` : ''}${item.revised_cv ? `<h4>AI revised CV</h4><pre>${escapeHtml(item.revised_cv)}</pre>` : ''}${item.cv_text ? `<h4>Parsed CV text</h4><pre>${escapeHtml(item.cv_text)}</pre>` : ''}</div>` : '';
  $('#application-detail').innerHTML = `<div class="dialog-header"><p class="eyebrow">Candidate profile</p><button class="close-button" data-detail-close>×</button></div><div class="application-hero"><span class="avatar">${initials(item.name)}</span><div><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.job_title)} · <a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></p></div></div><div class="detail-grid"><div><small>Phone</small><strong>${escapeHtml(item.phone || 'Not provided')}</strong></div><div><small>Location</small><strong>${escapeHtml(item.location || 'Not provided')}</strong></div><div><small>Profile</small>${link}</div></div><p class="cover-letter">${escapeHtml(item.cover_letter)}</p>${cvBlock}<div class="candidate-actions"><select id="application-status"><option value="applied">Applied</option><option value="shortlisted">Shortlisted</option><option value="interview">Interview</option><option value="offered">Offered</option><option value="rejected">Rejected</option><option value="hired">Hired</option><option value="withdrawn">Withdrawn</option></select><a class="button subtle" href="mailto:${escapeHtml(item.email)}?subject=${encodeURIComponent(`Your application for ${item.job_title}`)}">Email</a><button class="button primary" id="save-status">Save status</button></div>`;
  $('#application-status').value = ({ new: 'applied', review: 'shortlisted', offer: 'offered' })[item.status] || item.status || 'applied';
  $('[data-detail-close]').addEventListener('click', () => $('#application-dialog').close());
  $('#save-status').addEventListener('click', () => updateApplication(item.id, $('#application-status').value));
  $('#application-dialog').showModal();
}

async function updateApplication(id, status) {
  try {
    await api('/api/applications', { method: 'PATCH', body: JSON.stringify({ id, status }) });
    $('#application-dialog').close();
    await loadDashboard();
    toast('Application status updated');
  } catch (error) { toast(error.message, true); }
}

function marketplaceCompanies() {
  const companies = new Map();
  state.publicJobs.forEach((job) => {
    const record = companies.get(job.company) || { company: job.company, sectors: new Set(), locations: new Set(), jobs: 0, reviews: [], latestJob: job.created_at };
    record.jobs += 1;
    record.sectors.add(job.sector || 'Impact');
    record.locations.add(job.location);
    if (job.created_at > record.latestJob) record.latestJob = job.created_at;
    companies.set(job.company, record);
  });
  state.publicReviews.forEach((review) => {
    const record = companies.get(review.company) || { company: review.company, sectors: new Set(), locations: new Set(), jobs: 0, reviews: [], latestJob: '' };
    record.reviews.push(review);
    record.sectors.add(review.sector || 'Impact');
    record.locations.add(review.location);
    companies.set(review.company, record);
  });
  return [...companies.values()].map((company) => {
    const average = company.reviews.length ? company.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / company.reviews.length : 0;
    return { ...company, sectors: [...company.sectors], locations: [...company.locations], rating: average };
  }).sort((a, b) => (b.jobs + b.reviews.length) - (a.jobs + a.reviews.length));
}

function publicMatches(item) {
  const haystack = `${item.title || ''} ${item.company || ''} ${item.location || ''} ${item.department || ''} ${item.sector || ''} ${item.impactArea || ''} ${item.role || ''} ${item.headline || ''} ${item.level || ''} ${item.type || ''} ${item.workType || ''}`.toLowerCase();
  const queryMatch = !state.publicSearch || haystack.includes(state.publicSearch.toLowerCase());
  const sectorMatch = !state.sector || item.sector === state.sector || (item.sectors || []).includes(state.sector);
  const industryMatch = !state.industry || state.industry === 'SaaS / AI / Fintech' ? (!state.industry || /saas|ai|fintech|technology|software|data|product/i.test(haystack)) : (item.sector === state.industry || (item.sectors || []).includes(state.industry));
  const locationMatch = !state.location || item.location === state.location || (item.locations || []).includes(state.location);
  const levelMatch = !state.level || item.experience === state.level || item.level === state.level;
  const typeMatch = !state.workType || item.type === state.workType || item.workType === state.workType;
  const functionMatch = !state.functionFilter || item.department === state.functionFilter || item.role === state.functionFilter || haystack.includes(state.functionFilter.toLowerCase());
  return queryMatch && sectorMatch && industryMatch && locationMatch && levelMatch && typeMatch && functionMatch;
}

function updatePublicFilterOptions() {
  const locationSelect = $('#location-filter');
  const functionSelect = $('#function-filter');
  const currentLocation = locationSelect.value;
  const currentFunction = functionSelect?.value || '';
  const locations = [...new Set([...state.publicJobs.map((job) => job.location), ...state.publicReviews.map((review) => review.location), ...state.publicSalarySignals.map((signal) => signal.location)].filter(Boolean))].sort();
  const functions = [...new Set([...state.publicJobs.map((job) => job.department), ...state.publicReviews.map((review) => review.role), ...state.publicSalarySignals.map((signal) => signal.role)].filter(Boolean))].sort();
  locationSelect.innerHTML = '<option value="">All locations</option>' + locations.map((location) => `<option>${escapeHtml(location)}</option>`).join('');
  locationSelect.value = locations.includes(currentLocation) ? currentLocation : '';
  state.location = locationSelect.value;
  if (functionSelect) {
    functionSelect.innerHTML = '<option value="">All functions</option>' + functions.map((item) => `<option>${escapeHtml(item)}</option>`).join('');
    functionSelect.value = functions.includes(currentFunction) ? currentFunction : '';
    state.functionFilter = functionSelect.value;
  }
}

function renderMarketSummary() {
  const companies = marketplaceCompanies();
  const ratings = state.publicReviews.map((review) => Number(review.rating || 0)).filter(Boolean);
  const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : '—';
  $('#market-summary').innerHTML = `
    <article><strong>${state.publicJobs.length}</strong><span>Live jobs</span></article>
    <article><strong>${companies.length}</strong><span>Companies</span></article>
    <article><strong>${state.publicReviews.length}</strong><span>Reviews</span></article>
    <article><strong>${state.publicSalarySignals.length}</strong><span>Salary signals</span></article>`;
}

function renderPublicJobsList() {
  const jobs = state.publicJobs.filter(publicMatches);
  const page = paginate(jobs, 'publicJobs');
  const saved = new Set(state.candidate?.savedJobs || []);
  $('#public-market').innerHTML = jobs.length ? page.items.map((job) => `
    <article class="public-job impact-card">
      <div>
        <p class="company">${escapeHtml(job.company)} · <span>${escapeHtml(job.sector || 'Impact')}</span></p>
        <h2>${escapeHtml(job.title)}</h2>
        <p>${escapeHtml(job.department)} · ${escapeHtml(job.location)} · ${escapeHtml(job.type)} · ${escapeHtml(job.experience || 'Open level')}</p>
        <p>${job.impactArea ? escapeHtml(job.impactArea) + ' · ' : ''}${moneyLabel(job.salary)}</p>
      </div>
      <div class="row-actions"><button class="button subtle" data-save-job="${job.id}">${saved.has(job.id) ? 'Saved' : 'Save'}</button><button class="button primary" data-job-detail="${job.id}">View details</button></div>
    </article>`).join('') + paginationControls('publicJobs', page) : `<div class="empty-public"><strong>No roles match these filters.</strong><p>Try a different sector, location, or keyword.</p></div>`;
  $$('[data-job-detail]').forEach((button) => button.addEventListener('click', () => openJobDetail(button.dataset.jobDetail)));
  $$('[data-save-job]').forEach((button) => button.addEventListener('click', () => toggleSaveJob(button.dataset.saveJob, true)));
  bindPagination($('#public-market'));
}

function renderCompaniesList() {
  const companies = marketplaceCompanies().filter(publicMatches);
  const page = paginate(companies, 'publicJobs');
  $('#public-market').innerHTML = companies.length ? page.items.map((company) => `
    <article class="company-card">
      <div>
        <p class="company">${company.sectors.map(escapeHtml).join(' · ')}</p>
        <h2>${escapeHtml(company.company)}</h2>
        <p>${company.locations.map(escapeHtml).join(' · ') || 'Location not listed'}</p>
        <div class="company-metrics"><span>${company.jobs} open role${company.jobs === 1 ? '' : 's'}</span><span>${company.reviews.length} review${company.reviews.length === 1 ? '' : 's'}</span><span>${company.rating ? `${ratingStars(company.rating)} ${company.rating.toFixed(1)}` : 'No rating yet'}</span></div>
      </div>
    </article>`).join('') + paginationControls('publicJobs', page) : `<div class="empty-public"><strong>No companies match these filters.</strong><p>Company profiles appear as employers post jobs and candidates add reviews.</p></div>`;
  bindPagination($('#public-market'));
}

function renderReviewsList() {
  const reviews = state.publicReviews.filter(publicMatches);
  const page = paginate(reviews, 'publicReviews');
  $('#public-market').innerHTML = reviews.length ? page.items.map((review) => `
    <article class="review-card">
      <div class="review-head"><div><p class="company">${escapeHtml(review.company)} · ${escapeHtml(review.sector)}</p><h2>${escapeHtml(review.headline)}</h2></div><strong>${ratingStars(review.rating)} ${Number(review.rating).toFixed(1)}</strong></div>
      <p>${escapeHtml(review.role)} · ${escapeHtml(review.location)} · ${moneyLabel(review.salary)}${review.companyUrl ? ` · <a href="${escapeHtml(review.companyUrl)}" target="_blank" rel="noopener">Company URL ↗</a>` : ''}</p>
      <p>${review.reviewer?.displayMode === 'linkedin' ? `<a href="${escapeHtml(review.reviewer.linkedin)}" target="_blank" rel="noopener">${escapeHtml(review.reviewer.label)} ↗</a>` : escapeHtml(review.reviewer?.label || 'Anonymous verified reviewer')} · verified ${escapeHtml(review.reviewer?.verifiedDomain || 'email')}</p>
      <div class="review-grid"><div><small>Pros</small><p>${escapeHtml(review.pros)}</p></div><div><small>Watch-outs</small><p>${escapeHtml(review.cons)}</p></div></div>
      ${review.advice ? `<p class="advice"><strong>Advice:</strong> ${escapeHtml(review.advice)}</p>` : ''}
    </article>`).join('') + paginationControls('publicReviews', page) : `<div class="empty-public"><strong>No reviews match these filters.</strong><p>Add the first anonymous review for this sector.</p></div>`;
  bindPagination($('#public-market'));
}

function renderSalariesList() {
  const signals = state.salaryAggregates.filter(publicMatches);
  const page = paginate(signals, 'publicSalaries');
  $('#public-market').innerHTML = signals.length ? `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Role</th><th>Sector</th><th>Location</th><th>Level</th><th>Aggregated range</th><th>Signals</th></tr></thead><tbody>${page.items.map((signal) => `<tr><td>${escapeHtml(signal.company)}</td><td>${escapeHtml(signal.role)}</td><td>${escapeHtml(signal.sector)}</td><td>${escapeHtml(signal.location)}</td><td>${escapeHtml(signal.level)}</td><td>${salaryRange(signal)}</td><td>${signal.count}</td></tr>`).join('')}</tbody></table></div>${paginationControls('publicSalaries', page)}` : `<div class="empty-public"><strong>No salary signals match these filters.</strong><p>Submit a signal to help candidates understand real compensation ranges without exposing private data.</p></div>`;
  bindPagination($('#public-market'));
}

function renderMarketplace() {
  $$('.market-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.publicTab === state.publicTab));
  renderMarketSummary();
  if (state.publicTab === 'companies') renderCompaniesList();
  else if (state.publicTab === 'reviews') renderReviewsList();
  else if (state.publicTab === 'salaries') renderSalariesList();
  else renderPublicJobsList();
}

function openReviewDialog(review = null) {
  const form = $('#review-form');
  form.reset();
  form.elements.id.value = review?.id || '';
  if (review) ['company', 'companyUrl', 'sector', 'role', 'location', 'rating', 'salary', 'headline', 'pros', 'cons', 'advice'].forEach((field) => { form.elements[field].value = review[field] || ''; });
  if (review?.reviewer) {
    form.elements.displayMode.value = review.reviewer.displayMode || 'anonymous';
    form.elements.reviewerLinkedin.value = review.reviewer.linkedin || '';
  }
  $('#review-dialog .dialog-header h2').textContent = review ? 'Edit workplace insight' : 'Share workplace insight';
  $('#review-form [type="submit"]').textContent = review ? 'Save review' : 'Publish review';
  $('#review-dialog').showModal();
}

async function loadPublicJobs() {
  try {
    $('#public-market').innerHTML = skeleton(5);
    const params = new URLSearchParams(location.search);
    const companyId = params.get('company');
    const [data, reviewsData, salariesData, candidateData] = await Promise.all([api(`/api/jobs?public=1${companyId ? `&company=${encodeURIComponent(companyId)}` : ''}`), api('/api/reviews'), api('/api/salary-signals'), api('/api/candidate?optional=1').catch(() => null)]);
    state.publicJobs = data.jobs;
    state.publicReviews = reviewsData.reviews;
    state.publicSalarySignals = salariesData.signals || [];
    state.salaryAggregates = salariesData.aggregates || [];
    if (candidateData?.candidate) {
      state.candidate = candidateData.candidate;
      state.candidateApplications = candidateData.applications || [];
    }
    if (companyId && data.jobs.length) {
      $('#public-eyebrow').textContent = `${data.jobs[0].company} opportunities`;
      $('#public-title').innerHTML = `Explore roles<br />with impact.`;
      $('#public-subtitle').textContent = `Explore open roles at ${data.jobs[0].company}.`;
    } else {
      $('#public-eyebrow').textContent = 'Crossover Talent marketplace';
      $('#public-title').innerHTML = 'Explore impact roles,<br />companies, and reviews.';
      $('#public-subtitle').textContent = 'Browse live opportunities and workplace signals across climate, impact investment, public healthcare, agriculture, water, education, clean energy, foundations, circular economy, CSR, and ESG consulting.';
    }
    updatePublicFilterOptions();
    renderMarketplace();
    const directJob = params.get('job');
    if (directJob && state.publicJobs.some((job) => String(job.id) === directJob)) openJobDetail(directJob);
  } catch (error) {
    $('#public-market').innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}

function renderPublicJobs(query = '') {
  state.publicSearch = query;
  resetPage(pageKeyForPublic());
  renderMarketplace();
}

function openJobDetail(id) {
  const job = state.publicJobs.find((item) => String(item.id) === String(id));
  if (!job) return;
  $('#job-detail').innerHTML = `
    <div class="dialog-header"><div><p class="eyebrow">${escapeHtml(job.company)} · ${escapeHtml(job.sector || 'Impact')}</p><h2>${escapeHtml(job.title)}</h2><p class="muted">${escapeHtml(job.department)} · ${escapeHtml(job.location)} · ${escapeHtml(job.type)} · ${escapeHtml(job.experience || 'Open level')}</p></div><button type="button" class="close-button" data-job-detail-close>×</button></div>
    <div class="detail-grid"><div><small>Salary</small><strong>${moneyLabel(job.salary)}</strong></div><div><small>Impact area</small><strong>${escapeHtml(job.impactArea || 'Not listed')}</strong></div><div><small>Published</small><strong>${dateLabel(job.created_at)}</strong></div></div>
    <p class="job-description">${escapeHtml(job.description)}</p>
    ${job.sourceAttachment?.name ? `<p class="muted">Source JD attached: ${escapeHtml(job.sourceAttachment.name)}</p>` : ''}
    <div class="dialog-actions"><button type="button" class="button subtle" data-job-share-public="${job.id}">Copy link</button><button type="button" class="button primary" data-apply-from-detail="${job.id}">Apply now</button></div>`;
  $('#job-detail-dialog').showModal();
  $('[data-job-detail-close]').addEventListener('click', () => $('#job-detail-dialog').close());
  $('[data-apply-from-detail]').addEventListener('click', () => {
    $('#job-detail-dialog').close();
    openApply(job.id);
  });
  $('[data-job-share-public]').addEventListener('click', async () => {
    await navigator.clipboard.writeText(`${location.origin}/?jobs=1&job=${encodeURIComponent(job.id)}`);
    toast('Public job link copied');
  });
}

function openApply(id) {
  const job = state.publicJobs.find((item) => String(item.id) === String(id));
  if (!job) return;
  $('#apply-form [name="jobId"]').value = job.id;
  if (state.candidate) {
    const form = $('#apply-form');
    form.elements.name.value = state.candidate.name || '';
    form.elements.email.value = state.candidate.email || '';
    form.elements.linkedin.value = state.candidate.linkedin || '';
    form.elements.cvText.value = state.candidate.resume || '';
    form.elements.linkedinNote.value = state.candidate.linkedin ? 'LinkedIn profile attached from job seeker dashboard.' : '';
  }
  $('#apply-job-title').textContent = job.title;
  $('#apply-company').textContent = `${job.company} · ${job.location} · ${job.type}`;
  $('#apply-description').textContent = job.description;
  $('#apply-dialog').showModal();
}

async function toggleSaveJob(id, save = true) {
  if (!state.candidate) {
    toast('Sign in as a job seeker to save jobs', true);
    openCandidateAuth('login');
    return;
  }
  try {
    const data = await api('/api/candidate', { method: 'POST', body: JSON.stringify({ action: save ? 'save-job' : 'unsave-job', jobId: id }) });
    state.candidate = data.candidate;
    renderMarketplace();
    if (!save) renderCandidateDashboard();
    toast(save ? 'Job saved' : 'Job removed');
  } catch (error) { toast(error.message, true); }
}

async function saveCandidateProfile(changes = {}) {
  const payload = { action: 'profile', name: state.candidate.name, linkedin: state.candidate.linkedin, resume: state.candidate.resume, preferences: state.candidate.preferences, ...changes };
  try {
    const data = await api('/api/candidate', { method: 'POST', body: JSON.stringify(payload) });
    state.candidate = data.candidate;
    renderCandidateDashboard();
    toast('Profile saved');
  } catch (error) { toast(error.message, true); }
}

async function generateCandidateResume() {
  try {
    const data = await api('/api/candidate', { method: 'POST', body: JSON.stringify({ action: 'ai-resume', resume: $('#candidate-resume').value, targetRole: $('#candidate-target-role').value, skills: $('#candidate-skills').value }) });
    $('#candidate-resume').value = data.resume;
    $('#candidate-ai-output').classList.remove('hidden');
    $('#candidate-ai-output').innerHTML = `<h3>AI resume draft</h3><pre>${escapeHtml(data.resume)}</pre>`;
    toast('Resume draft generated');
  } catch (error) { toast(error.message, true); }
}

async function candidateChat() {
  try {
    const data = await api('/api/candidate', { method: 'POST', body: JSON.stringify({ action: 'ai-chat', message: $('#candidate-chat-message').value }) });
    $('#candidate-ai-output').classList.remove('hidden');
    $('#candidate-ai-output').innerHTML = `<h3>AI chat</h3><p>${escapeHtml(data.reply)}</p>`;
  } catch (error) { toast(error.message, true); }
}

function renderAdminLogin() {
  showScreen('admin');
  $('#admin-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Admin</p><h1>Admin access.</h1><p class="muted" id="admin-auth-message">Sign in with a verified qa-admin account.</p></div></section><section class="panel candidate-form-panel"><div class="form-grid"><label>Name<input id="admin-name-input" placeholder="Required for registration" /></label><label>Email<input id="admin-email-input" type="email" placeholder="qa-admin-name@crossovertalent.asia" /></label><label>Password<input id="admin-password-input" type="password" placeholder="12 characters minimum" /></label><label>Mode<select id="admin-mode-input"><option value="login">Login</option><option value="register">Register</option></select></label></div><div class="auth-methods"><p>Prepared admin login methods</p><div><button type="button" class="button subtle" data-admin-auth-provider="google">Google</button><button type="button" class="button subtle" data-admin-auth-provider="linkedin">LinkedIn</button></div><label>Phone number / OTP<input id="admin-phone-input" type="tel" placeholder="+6591234567" /></label><button type="button" class="button subtle full" id="admin-phone-otp">Send phone OTP</button></div><div class="dialog-actions"><button class="button primary" id="admin-auth-submit">Continue</button></div></section>`;
  $('#admin-auth-submit').addEventListener('click', adminAuth);
  $$('[data-admin-auth-provider]').forEach((button) => button.addEventListener('click', () => startProviderLogin(button.dataset.adminAuthProvider, 'admin')));
  $('#admin-phone-otp')?.addEventListener('click', () => startPhoneOtp('admin', '#admin-phone-input'));
}

async function adminAuth() {
  const payload = { action: $('#admin-mode-input').value, name: $('#admin-name-input').value, email: $('#admin-email-input').value, password: $('#admin-password-input').value };
  try {
    const data = await api('/api/admin', { method: 'POST', body: JSON.stringify(payload) });
    if (data.verificationRequired) {
      showVerificationNotice('#admin-auth-message', data, payload.email, 'admin');
      toast('Verify your admin email before signing in');
      return;
    }
    state.admin = data.admin;
    state.adminData = data;
    renderAdminDashboard();
  } catch (error) {
    if (error.verificationRequired) showVerificationNotice('#admin-auth-message', error, payload.email, 'admin');
    toast(error.message, true);
  }
}

async function loadAdminDashboard() {
  try {
    showScreen('admin');
    $('#admin-content').innerHTML = skeleton(4);
    const data = await api('/api/admin');
    state.admin = data.admin;
    state.adminData = data;
    renderAdminDashboard();
  } catch {
    renderAdminLogin();
  }
}

function renderAdminDashboard() {
  const data = state.adminData || {};
  const query = ($('#admin-search')?.value || '').toLowerCase();
  const users = (data.users || []).filter((item) => `${item.email} ${item.name} ${item.company} ${item.role}`.toLowerCase().includes(query));
  const jobs = (data.jobs || []).filter((item) => `${item.title} ${item.company} ${item.status}`.toLowerCase().includes(query));
  const reviews = (data.reviews || []).filter((item) => `${item.company} ${item.headline} ${item.hidden ? 'hidden' : 'visible'}`.toLowerCase().includes(query));
  const supportTickets = (data.supportTickets || []).filter((item) => `${item.type} ${item.priority} ${item.status} ${item.subject} ${item.email} ${item.company}`.toLowerCase().includes(query));
  const apps = data.applications || [];
  const usersPage = paginate(users, 'admin');
  const metrics = data.metrics || {};
  const health = metrics.systemHealth || {};
  $('#admin-content').innerHTML = `<section class="page-heading"><div><p class="eyebrow">Admin dashboard</p><h1>Operations, growth, and moderation.</h1><p class="muted">Signed in as ${escapeHtml(state.admin?.email || '')} · System ${escapeHtml(health.status || 'unknown')}</p></div></section><section class="tour-grid" aria-label="Admin onboarding tour"><article class="tour-card"><span>1</span><h3>Watch health</h3><p>Review errors, latency, email, AI, and upload signals daily.</p></article><article class="tour-card"><span>2</span><h3>Triage support</h3><p>Move feedback, bugs, and feature requests from open to triaged or closed.</p></article><article class="tour-card"><span>3</span><h3>Moderate trust</h3><p>Review jobs, reviews, and user account status before expansion.</p></article></section><section class="stats-grid"><article class="stat-card"><p>Jobs</p><strong>${metrics.totalJobs ?? jobs.length}</strong></article><article class="stat-card"><p>Employers</p><strong>${metrics.employers ?? 0}</strong></article><article class="stat-card"><p>Candidates</p><strong>${metrics.candidates ?? 0}</strong></article><article class="stat-card"><p>Applications</p><strong>${metrics.applications ?? apps.length}</strong></article></section><section class="stats-grid"><article class="stat-card"><p>Active employers</p><strong>${metrics.activeEmployers ?? 0}</strong></article><article class="stat-card"><p>Active candidates</p><strong>${metrics.activeCandidates ?? 0}</strong></article><article class="stat-card"><p>Weekly registrations</p><strong>${metrics.weeklyRegistrations ?? 0}</strong></article><article class="stat-card"><p>Open support</p><strong>${metrics.supportTicketsOpen ?? 0}</strong></article></section><section class="stats-grid"><article class="stat-card"><p>DAU</p><strong>${metrics.dailyActiveUsers ?? 0}</strong></article><article class="stat-card"><p>WAU</p><strong>${metrics.weeklyActiveUsers ?? 0}</strong></article><article class="stat-card"><p>MAU</p><strong>${metrics.monthlyActiveUsers ?? 0}</strong></article><article class="stat-card"><p>Daily signups</p><strong>${metrics.dailySignups ?? 0}</strong></article></section><section class="stats-grid"><article class="stat-card"><p>Jobs posted</p><strong>${metrics.jobsPosted ?? 0}</strong></article><article class="stat-card"><p>Applications submitted</p><strong>${metrics.applicationsSubmitted ?? apps.length}</strong></article><article class="stat-card"><p>Applications completed</p><strong>${metrics.applicationsCompleted ?? 0}</strong></article><article class="stat-card"><p>Failed applications</p><strong>${metrics.failedApplications ?? 0}</strong></article></section><section class="stats-grid"><article class="stat-card"><p>Application conversion</p><strong>${metrics.applicationConversionRate ?? 0}</strong></article><article class="stat-card"><p>Employer activation</p><strong>${metrics.employerActivationRate ?? 0}</strong></article><article class="stat-card"><p>Candidate activation</p><strong>${metrics.candidateActivationRate ?? 0}</strong></article><article class="stat-card"><p>Email success</p><strong>${metrics.emailSuccessRate ?? 'N/A'}</strong></article></section><section class="panel"><div class="panel-header"><div><h2>Reliability and usage</h2><p>API latency: ${metrics.averageApiLatencyMs ?? 'N/A'} ms · Error rate: ${metrics.errorRate ?? 0} · Uptime: ${metrics.systemUptime ?? 'N/A'}% · AI ${metrics.aiRequests?.success ?? 0}/${metrics.aiRequests?.failed ?? 0} success/fail · Upload ${metrics.uploads?.success ?? 0}/${metrics.uploads?.failed ?? 0} success/fail · Email ${metrics.emailDelivery?.sent ?? 0}/${metrics.emailDelivery?.failed ?? 0} sent/fail · Server errors 24h: ${health.serverErrors24h ?? 0}</p></div></div></section><section class="panel"><div class="panel-header"><div><h2>Feedback inbox</h2><p>User feedback, bug reports, support requests, and feature requests.</p></div></div><div class="support-ticket-list">${supportTickets.length ? supportTickets.slice(0, 12).map((ticket) => `<article class="support-ticket"><small>${escapeHtml(ticket.type)} · ${escapeHtml(ticket.priority)} · ${escapeHtml(ticket.status)}</small><strong>${escapeHtml(ticket.subject)}</strong><p>${escapeHtml(ticket.message)}</p><p>${escapeHtml(ticket.email || 'No email')} ${ticket.company ? `· ${escapeHtml(ticket.company)}` : ''}</p><div class="row-actions"><button class="mini-button" data-support-ticket="${ticket.id}" data-support-status="triaged">Mark triaged</button><button class="mini-button" data-support-ticket="${ticket.id}" data-support-status="closed">Close</button></div></article>`).join('') : '<div class="empty-state"><h3>No support tickets yet</h3><p>Feedback and bug reports from beta users will appear here.</p></div>'}</div></section><section class="panel"><div class="panel-header"><div><h2>User approvals and moderation</h2><p>Review employer, candidate, and admin verification/status. Enable or disable accounts when needed.</p></div></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Verified</th><th>Status</th><th>Action</th></tr></thead><tbody>${usersPage.items.map((user) => `<tr><td>${escapeHtml(user.email)}<br><small>${escapeHtml(user.name || user.company)}</small></td><td>${escapeHtml(user.role)}</td><td>${user.emailVerified ? 'Yes' : 'No'}</td><td>${user.disabled ? 'Disabled' : 'Enabled'}</td><td><button class="mini-button" data-admin-user="${escapeHtml(user.email)}" data-admin-role="${escapeHtml(user.role)}" data-admin-disabled="${user.disabled ? 'false' : 'true'}">${user.disabled ? 'Enable' : 'Disable'}</button></td></tr>`).join('')}</tbody></table></div>${paginationControls('admin', usersPage)}</section><section class="panel"><div class="panel-header"><div><h2>Company approval</h2><p>Company approval is represented by employer verification/status in Version 1.0; formal approval workflow is planned for Version 1.1.</p></div></div></section><section class="panel"><div class="panel-header"><div><h2>Job moderation</h2><p>Unpublish inappropriate jobs.</p></div></div><div class="table-wrap"><table><thead><tr><th>Job</th><th>Company</th><th>Status</th><th>Action</th></tr></thead><tbody>${jobs.slice(0, 20).map((job) => `<tr><td>${escapeHtml(job.title)}</td><td>${escapeHtml(job.company)}</td><td>${escapeHtml(job.status)}</td><td><button class="mini-button" data-admin-job="${job.id}" data-admin-job-status="${job.status === 'active' ? 'closed' : 'active'}">${job.status === 'active' ? 'Unpublish' : 'Restore'}</button></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><h2>Review moderation</h2><p>Hide or restore public reviews.</p></div></div><div class="table-wrap"><table><thead><tr><th>Review</th><th>Company</th><th>Status</th><th>Action</th></tr></thead><tbody>${reviews.slice(0, 20).map((review) => `<tr><td>${escapeHtml(review.headline)}</td><td>${escapeHtml(review.company)}</td><td>${review.hidden ? 'Hidden' : 'Visible'}</td><td><button class="mini-button" data-admin-review="${review.id}" data-admin-hidden="${review.hidden ? 'false' : 'true'}">${review.hidden ? 'Restore' : 'Hide'}</button></td></tr>`).join('')}</tbody></table></div></section>`;
  [...$('#admin-content').querySelectorAll('.panel')].forEach((panel) => {
    if (panel.textContent.includes('formal approval workflow is planned')) panel.remove();
  });
  const employersForReview = (data.employers || []).filter((user) => user.role === 'employer');
  $('#admin-content').insertAdjacentHTML('beforeend', `<section class="panel"><div class="panel-header"><div><h2>Employer approval queue</h2><p>New employers default to pending review. Approval cannot be self-assigned and is enforced by employer APIs.</p></div></div>${employersForReview.length ? `<div class="table-wrap"><table><thead><tr><th>Employer</th><th>Status</th><th>Reviewed</th><th>Notes</th><th>Actions</th></tr></thead><tbody>${employersForReview.map((user) => `<tr><td>${escapeHtml(user.company || user.name)}<br><small>${escapeHtml(user.email)}</small></td><td><span class="status ${escapeHtml(user.employer_status || 'approved')}">${escapeHtml(employerStatusLabel(user.employer_status))}</span>${user.rejection_reason ? `<br><small>${escapeHtml(user.rejection_reason)}</small>` : ''}</td><td>${user.reviewed_at ? `${escapeHtml(dateLabel(user.reviewed_at))}<br><small>${escapeHtml(user.reviewed_by)}</small>` : 'Not reviewed'}</td><td>${escapeHtml(user.company_validation_notes || '—')}</td><td><div class="row-actions"><button class="mini-button" data-employer-review="${escapeHtml(user.email)}" data-employer-status="approved">Approve</button><button class="mini-button" data-employer-review="${escapeHtml(user.email)}" data-employer-status="rejected">Reject</button><button class="mini-button" data-employer-review="${escapeHtml(user.email)}" data-employer-status="suspended">Suspend</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('✓', 'No employers to review', 'Employer registrations will appear here after signup.')}</section>`);
  bindPagination($('#admin-content'));
  $$('[data-admin-user]').forEach((button) => button.addEventListener('click', () => adminPatch({ action: 'user-status', email: button.dataset.adminUser, role: button.dataset.adminRole, disabled: button.dataset.adminDisabled === 'true' })));
  $$('[data-admin-job]').forEach((button) => button.addEventListener('click', () => adminPatch({ action: 'job-moderation', id: button.dataset.adminJob, status: button.dataset.adminJobStatus })));
  $$('[data-admin-review]').forEach((button) => button.addEventListener('click', () => adminPatch({ action: 'review-moderation', id: button.dataset.adminReview, hidden: button.dataset.adminHidden === 'true' })));
  $$('[data-support-ticket]').forEach((button) => button.addEventListener('click', () => updateSupportTicket(button.dataset.supportTicket, button.dataset.supportStatus)));
  $$('[data-employer-review]').forEach((button) => button.addEventListener('click', () => reviewEmployer(button.dataset.employerReview, button.dataset.employerStatus)));
}

async function adminPatch(payload) {
  try {
    await api('/api/admin', { method: 'PATCH', body: JSON.stringify(payload) });
    const data = await api('/api/admin');
    state.adminData = data;
    renderAdminDashboard();
    toast('Admin action saved');
  } catch (error) { toast(error.message, true); }
}

async function updateSupportTicket(id, status) {
  try {
    await api('/api/feedback', { method: 'PATCH', body: JSON.stringify({ id, status }) });
    const data = await api('/api/admin');
    state.adminData = data;
    renderAdminDashboard();
    toast('Support ticket updated');
  } catch (error) { toast(error.message, true); }
}

async function reviewEmployer(email, status) {
  const companyValidationNotes = window.prompt('Company validation notes', status === 'approved' ? 'Company verified and approved.' : '') || '';
  let rejectionReason = '';
  if (status === 'rejected') {
    rejectionReason = window.prompt('Rejection reason shown to employer', 'Company details could not be validated.') || '';
    if (!rejectionReason.trim()) return toast('Add a rejection reason before rejecting an employer', true);
  }
  await adminPatch({ action: 'employer-approval', email, status, rejection_reason: rejectionReason, company_validation_notes: companyValidationNotes });
}

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#auth-submit');
  const data = Object.fromEntries(new FormData(event.currentTarget));
  button.disabled = true;
  try {
    const response = await api('/api/auth', { method: 'POST', body: JSON.stringify({ action: state.authMode, ...data }) });
    if (response.verificationRequired) {
      showVerificationNotice('#auth-subtitle', response, data.email, 'employer');
      toast('Verify your email before signing in');
      return;
    }
    state.user = response.user;
    history.replaceState({}, '', '/?dashboard=1');
    showScreen('app');
    await loadDashboard();
    toast(state.authMode === 'register' ? 'Workspace created' : 'Welcome back');
  } catch (error) {
    if (error.employer_status) showEmployerStatusNotice('#auth-subtitle', error);
    toast(error.message, true);
  }
  finally { button.disabled = false; }
});

$('#candidate-auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('#candidate-auth-submit');
  const data = formObject(event.currentTarget);
  button.disabled = true;
  try {
    const response = await api('/api/candidate', { method: 'POST', body: JSON.stringify({ action: state.candidateAuthMode, ...data }) });
    if (response.verificationRequired) {
      showVerificationNotice('#candidate-auth-subtitle', response, data.email, 'candidate');
      toast('Verify your email before signing in');
      return;
    }
    state.candidate = response.candidate;
    state.candidateApplications = response.applications || [];
    history.replaceState({}, '', '/?candidate=dashboard');
    await loadCandidateDashboard();
    toast(state.candidateAuthMode === 'register' ? 'Job seeker account created' : 'Welcome back');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#job-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  data.sourceAttachment = parseJsonField(data.sourceAttachment);
  data.aiInputs = parseJsonField(data.aiInputs);
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const editing = Boolean(data.id);
    await api('/api/jobs', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    event.currentTarget.reset();
    $('#job-dialog').close();
    state.view = 'jobs';
    await loadDashboard();
    toast(editing ? 'Job updated' : 'Your job is live');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#apply-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  data.cvAttachment = parseJsonField(data.cvAttachment);
  if (state.candidate) {
    data.name = data.name || state.candidate.name;
    data.email = state.candidate.email;
    data.linkedin = data.linkedin || state.candidate.linkedin || '';
    data.cvText = data.cvText || state.candidate.resume || '';
  }
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/applications', { method: 'POST', body: JSON.stringify(data) });
    if (state.candidate) {
      const refreshed = await api('/api/candidate').catch(() => null);
      if (refreshed?.candidate) {
        state.candidate = refreshed.candidate;
        state.candidateApplications = refreshed.applications || [];
      }
    }
    event.currentTarget.reset();
    $('#apply-dialog').close();
    toast(state.candidate ? 'Application submitted. Track it from your dashboard.' : 'Application submitted. Good luck!');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#job-attachment').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  $('#job-parse-status').textContent = `Reading ${file.name}...`;
  try {
    const payload = await filePayload(file);
    payload.purpose = 'job-description';
    const parsed = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'parse-document', file: payload }) });
    const form = $('#job-form');
    form.elements.sourceText.value = parsed.text;
    form.elements.sourceAttachment.value = JSON.stringify(parsed.file);
    if (parsed.text && !form.elements.description.value.trim()) form.elements.description.value = parsed.text.slice(0, 5000);
    const confidence = parsed.readabilityScore ? `${parsed.confidence} confidence (${Math.round(parsed.readabilityScore * 100)}% readable)` : `${parsed.confidence} confidence`;
    const method = parsed.extractionMethod === 'ocr' ? 'OCR parsed' : 'parsed';
    $('#job-parse-status').textContent = `${parsed.file.name} uploaded, ${method}, and attached with ${confidence}.`;
  } catch (error) {
    $('#job-parse-status').textContent = `Parsing failed. ${error.message || 'Try a clearer text-based PDF/DOCX/TXT, a higher-quality scan, or paste the JD content manually.'}`;
    toast(error.message, true);
  }
});

$('#generate-job-description').addEventListener('click', async () => {
  const form = $('#job-form');
  const data = formObject(form);
  const aiInputs = { skills: data.skills, experience: data.experienceSummary, kpis: data.kpis, kras: data.kras };
  if (!data.title.trim()) return toast('Add the job title first', true);
  const button = $('#generate-job-description');
  button.disabled = true;
  button.textContent = 'Generating...';
  try {
    const generated = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'generate-job-description', title: data.title, department: data.department, location: data.location, level: data.experience, impactArea: data.impactArea, sector: data.sector, context: data.sourceText, ...aiInputs }) });
    form.elements.description.value = generated.description;
    if (structuredLines(data.kpis).length < 3 && generated.kpis?.length) form.elements.kpis.value = generated.kpis.join('\n');
    if (structuredLines(data.kras).length < 3 && generated.kras?.length) form.elements.kras.value = generated.kras.join('\n');
    form.elements.aiInputs.value = JSON.stringify({ ...aiInputs, kpis: form.elements.kpis.value, kras: form.elements.kras.value });
    toast(generated.fallback ? 'Job spec generated with fallback assistant' : 'Job spec generated with AI');
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Generate job spec';
  }
});

async function suggestJobMetrics(kind = 'both') {
  const form = $('#job-form');
  const data = formObject(form);
  if (!data.title.trim()) return toast('Add the job title first', true);
  const button = kind === 'kpis' ? $('#suggest-job-kpis') : $('#suggest-job-kras');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Suggesting...';
  try {
    const metrics = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'suggest-job-metrics', title: data.title, department: data.department, location: data.location, level: data.experience, impactArea: data.impactArea, sector: data.sector, skills: data.skills, experience: data.experienceSummary, context: data.sourceText }) });
    if (kind === 'kpis') form.elements.kpis.value = metrics.kpis.join('\n');
    if (kind === 'kras') form.elements.kras.value = metrics.kras.join('\n');
    toast(kind === 'kpis' ? 'Top 3 KPIs suggested' : 'Top 3 KRAs suggested');
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

$('#suggest-job-kpis').addEventListener('click', () => suggestJobMetrics('kpis'));
$('#suggest-job-kras').addEventListener('click', () => suggestJobMetrics('kras'));

$('#cv-attachment').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  $('#cv-parse-status').textContent = `Reading ${file.name}...`;
  try {
    const payload = await filePayload(file);
    payload.purpose = 'cv';
    const parsed = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'parse-document', file: payload }) });
    const form = $('#apply-form');
    form.elements.cvText.value = parsed.text;
    form.elements.cvAttachment.value = JSON.stringify(parsed.file);
    const confidence = parsed.readabilityScore ? `${parsed.confidence} confidence (${Math.round(parsed.readabilityScore * 100)}% readable)` : `${parsed.confidence} confidence`;
    const method = parsed.extractionMethod === 'ocr' ? 'OCR parsed' : 'parsed';
    $('#cv-parse-status').textContent = `${parsed.file.name} uploaded, ${method}, and attached with ${confidence}.`;
  } catch (error) {
    $('#cv-parse-status').textContent = `CV parsing failed. ${error.message || 'Try a clearer text-based PDF/DOCX/TXT or paste the CV content manually.'}`;
    toast(error.message, true);
  }
});

$('#parse-linkedin').addEventListener('click', async () => {
  const form = $('#apply-form');
  try {
    const parsed = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'parse-linkedin', url: form.elements.linkedin.value }) });
    if (parsed.name && !form.elements.name.value) form.elements.name.value = parsed.name;
    form.elements.linkedin.value = parsed.linkedin;
    form.elements.linkedinNote.value = parsed.note;
    toast('LinkedIn profile attached');
  } catch (error) { toast(error.message, true); }
});

$('#revise-cv').addEventListener('click', async () => {
  const form = $('#apply-form');
  const jobTitle = $('#apply-job-title').textContent;
  try {
    const revised = await api('/api/assist', { method: 'POST', body: JSON.stringify({ action: 'revise-cv', targetRole: jobTitle, cvText: form.elements.cvText.value, profileText: form.elements.coverLetter.value }) });
    form.elements.revisedCv.value = revised.cv;
    toast('CV revision generated');
  } catch (error) { toast(error.message, true); }
});

$('#review-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/reviews', { method: data.id ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    event.currentTarget.reset();
    $('#review-dialog').close();
    state.publicTab = 'reviews';
    await loadPublicJobs();
    if (state.candidate) await loadCandidateDashboard();
    toast(data.id ? 'Review updated' : 'Anonymous review published');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#salary-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = formObject(event.currentTarget);
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await api('/api/salary-signals', { method: 'POST', body: JSON.stringify(data) });
    event.currentTarget.reset();
    $('#salary-dialog').close();
    state.publicTab = 'salaries';
    await loadPublicJobs();
    toast('Salary signal submitted');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#support-widget-button').addEventListener('click', () => $('#support-dialog').showModal());
$('#notification-button').addEventListener('click', toggleNotifications);
$('#support-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('[type="submit"]');
  const payload = {
    ...formObject(form),
    page: location.pathname + location.search,
    userAgent: navigator.userAgent
  };
  button.disabled = true;
  try {
    await api('/api/feedback', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    $('#support-dialog').close();
    toast('Thanks. Support received your message.');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});

$('#auth-switch').addEventListener('click', () => setAuthMode(state.authMode === 'login' ? 'register' : 'login'));
$('#candidate-auth-switch').addEventListener('click', () => setCandidateAuthMode(state.candidateAuthMode === 'login' ? 'register' : 'login'));
['#landing-login', '#footer-login'].forEach((selector) => $(selector).addEventListener('click', () => openAuth('login')));
['#landing-start', '#hero-hire-talent', '#quick-hire-talent', '#feature-start', '#cta-hire-talent'].forEach((selector) => $(selector).addEventListener('click', () => openAuth('register')));
['#landing-jobs-link', '#hero-find-jobs', '#quick-find-jobs', '#cta-find-jobs', '#footer-jobs', '#browse-jobs-button'].forEach((selector) => $(selector).addEventListener('click', openJobs));
['#hero-submit-cv', '#quick-submit-cv'].forEach((selector) => $(selector).addEventListener('click', () => openCandidateAuth('register')));
['#hero-book-consultation', '#quick-book-consultation', '#service-book-consultation', '#cta-consultation', '#footer-contact'].forEach((selector) => $(selector).addEventListener('click', () => $('#support-dialog').showModal()));
['#landing-candidate-login', '#candidate-login-button'].forEach((selector) => $(selector).addEventListener('click', () => openCandidateAuth('login')));
$('#pricing-candidate')?.addEventListener('click', () => openCandidateAuth('register'));
$('#pricing-employer')?.addEventListener('click', () => openAuth('register'));
$('#pricing-support')?.addEventListener('click', () => $('#support-dialog').showModal());
$('#pricing-partnership')?.addEventListener('click', () => $('#support-dialog').showModal());
$('#candidate-browse-jobs').addEventListener('click', openJobs);
$('#employer-login-button').addEventListener('click', () => openAuth('login'));
$('#add-review-button').addEventListener('click', () => {
  if (!state.candidate && !state.user) {
    toast('Sign in before writing a verified review', true);
    openCandidateAuth('login');
    return;
  }
  openReviewDialog();
});
$('#add-salary-button').addEventListener('click', () => {
  if (!state.candidate && !state.user) {
    toast('Sign in before submitting a salary signal', true);
    openCandidateAuth('login');
    return;
  }
  $('#salary-dialog').showModal();
});
$('#join-job-alerts')?.addEventListener('click', () => {
  const form = $('#support-form');
  if (form) {
    form.elements.type.value = 'feature';
    form.elements.priority.value = 'normal';
    form.elements.subject.value = 'Join job alerts waitlist';
    form.elements.message.value = 'I would like to receive curated job alerts for relevant impact roles.';
  }
  $('#support-dialog').showModal();
});
$('#refresh-market-button').addEventListener('click', () => loadPublicJobs());
$('#new-job-button').addEventListener('click', () => openJobDialog());
$('#menu-button').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
$('#candidate-menu-button').addEventListener('click', () => $('#candidate-app .sidebar').classList.toggle('open'));
$('#candidate-back-button').addEventListener('click', () => {
  if (history.length > 1) history.back();
  else openJobs();
});
$('#global-search').addEventListener('input', (event) => { state.search = event.target.value; render(); });
$('#candidate-search').addEventListener('input', (event) => { state.candidateSearch = event.target.value; renderCandidateDashboard(); });
$('#public-search').addEventListener('input', (event) => renderPublicJobs(event.target.value));
$('#sector-filter').addEventListener('change', (event) => { state.sector = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$('#location-filter').addEventListener('change', (event) => { state.location = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$('#level-filter').addEventListener('change', (event) => { state.level = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$('#type-filter').addEventListener('change', (event) => { state.workType = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$('#function-filter')?.addEventListener('change', (event) => { state.functionFilter = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$('#industry-filter')?.addEventListener('change', (event) => { state.industry = event.target.value; resetPage(pageKeyForPublic()); renderMarketplace(); });
$$('[data-public-tab]').forEach((button) => button.addEventListener('click', () => { state.publicTab = button.dataset.publicTab; resetPage(pageKeyForPublic()); renderMarketplace(); }));
$$('[data-close]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
$$('.nav-item[data-view]').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
$$('[data-candidate-view]').forEach((item) => item.addEventListener('click', () => setCandidateView(item.dataset.candidateView)));
$('#copy-board-link').addEventListener('click', async () => { await navigator.clipboard.writeText(`${location.origin}/?jobs=1&company=${encodeURIComponent(state.user.companyId)}`); toast('Company job board link copied'); });
$('#profile-button').addEventListener('click', () => { setView('overview'); toast('Workspace profile loaded'); });
$('#logout-button').addEventListener('click', async () => { await api('/api/auth', { method: 'DELETE' }); state.user = null; showScreen('landing'); toast('Signed out'); });
$('#candidate-board-link').addEventListener('click', openJobs);
$('#candidate-profile-button').addEventListener('click', () => setCandidateView('preferences'));
$('#candidate-logout-button').addEventListener('click', async () => { await api('/api/candidate', { method: 'DELETE' }); state.candidate = null; showScreen('landing'); toast('Signed out'); });
$('#refresh-admin-button')?.addEventListener('click', () => loadAdminDashboard());
$('#admin-search')?.addEventListener('input', () => { resetPage('admin'); renderAdminDashboard(); });
$('#admin-logout-button')?.addEventListener('click', async () => { await api('/api/admin', { method: 'DELETE' }); state.admin = null; state.adminData = null; renderAdminLogin(); toast('Signed out'); });
$$('[data-auth-provider]').forEach((button) => button.addEventListener('click', () => startProviderLogin(button.dataset.authProvider, button.dataset.authRole)));
$$('[data-phone-otp-role]').forEach((button) => button.addEventListener('click', () => startPhoneOtp(button.dataset.phoneOtpRole, button.dataset.phoneField)));
$('#assistant-widget-button')?.addEventListener('click', () => toggleAssistant());
$('#assistant-close')?.addEventListener('click', () => toggleAssistant(false));
$('#assistant-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitAssistantPrompt();
});

async function init() {
  const params = new URLSearchParams(location.search);
  if (location.protocol === 'file:') {
    location.href = `${LIVE_ORIGIN}/${location.search || ''}${location.hash || ''}`;
    return;
  }
  if (params.has('jobs')) {
    showScreen('jobs');
    await loadPublicJobs();
    return;
  }
  if (params.has('auth_callback') || (params.has('code') && params.has('state'))) {
    await completeOAuthCallback();
    return;
  }
  if (params.has('register') || params.has('login')) {
    openAuth(params.has('register') ? 'register' : 'login');
    return;
  }
  if (params.has('candidate')) {
    const candidateMode = params.get('candidate');
    if (candidateMode === 'dashboard') {
      try { await loadCandidateDashboard(); } catch { openCandidateAuth('login'); }
      return;
    }
    openCandidateAuth(candidateMode === 'register' ? 'register' : 'login');
    return;
  }
  if (params.has('admin')) {
    await loadAdminDashboard();
    return;
  }
  if (!params.has('dashboard')) {
    showScreen('landing');
    return;
  }
  try {
    const response = await api('/api/auth');
    state.user = response.user;
    showScreen('app');
    await loadDashboard();
  } catch {
    showScreen('landing');
  }
}

setAuthMode('login');
renderNotifications();
init();
