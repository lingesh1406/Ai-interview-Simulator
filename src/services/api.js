const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_STORAGE_KEY = 'ais-auth-token';

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

async function handleJsonResponse(res) {
  let payload = {};
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}.`);
    }
  }

  if (!res.ok) {
    const message =
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error
        : `Request failed with status ${res.status}.`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return payload;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return handleJsonResponse(res);
}

export async function registerUser({ full_name, email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name, email, password }),
  });
  const data = await handleJsonResponse(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function loginUser({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleJsonResponse(res);
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function fetchCurrentUser() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: authHeaders(),
  });
  return handleJsonResponse(res);
}

export async function logoutUser() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } finally {
    setAuthToken(null);
  }
}

export async function parseResumePdf(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/resume/parse`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return handleJsonResponse(res);
}

export async function startInterview(config) {
  const res = await fetch(`${API_BASE}/api/interview/start`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(config),
  });
  return handleJsonResponse(res);
}

export async function submitAnswer(params) {
  const res = await fetch(`${API_BASE}/api/interview/answer`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  });
  return handleJsonResponse(res);
}

export async function finishInterview(sessionId) {
  const res = await fetch(`${API_BASE}/api/interview/finish`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ session_id: sessionId }),
  });
  return handleJsonResponse(res);
}

export async function fetchHistory() {
  const res = await fetch(`${API_BASE}/api/history`, {
    headers: authHeaders(),
  });
  return handleJsonResponse(res);
}
