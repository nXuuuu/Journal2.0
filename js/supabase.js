/**
 * nXuu — supabase.js
 * All Supabase connection, auth and database queries.
 * ─────────────────────────────────────────────────
 * Replace the two lines below with your own values
 * from Supabase → Settings → API
 * ─────────────────────────────────────────────────
 */

'use strict';

const SUPABASE_URL      = 'https://pwfaqfghkrsnitisljlb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3ZmFxZmdoa3Jzbml0aXNsamxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjQzODcsImV4cCI6MjA4OTkwMDM4N30.16Cv4pq4e9OhY0rfbcVnnAJViTRf1xlbPVL70gM_JWA';

// ── HELPERS ───────────────────────────────────────────────────
function isConfigured() {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
         SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

function authHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
  };
}

// ── AUTH STATE ────────────────────────────────────────────────
let _session = null;

function getSession()      { return _session; }
function getToken()        { return _session?.access_token || SUPABASE_ANON_KEY; }
function getUserId()       { return _session?.user?.id || null; }
function getUserEmail()    { return _session?.user?.email || ''; }
function getUserDisplayName() { return _session?.user?.user_metadata?.display_name || ''; }

/**
 * Save a display name to Supabase user metadata.
 */
async function updateUserDisplayName(name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method:  'PUT',
    headers: authHeaders(getToken()),
    body:    JSON.stringify({ data: { display_name: name } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.msg || data.error_description || 'Could not update display name.');
  }
  const updated = await res.json();
  // Patch local session so it reflects immediately without re-login
  if (_session && updated?.user_metadata) {
    _session.user.user_metadata = updated.user_metadata;
    localStorage.setItem('nxuu_session', JSON.stringify(_session));
  }
  return updated;
}

/**
 * Sign up with email + password.
 */
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body:    JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || data.error || data.error_code || data.msg) {
    throw new Error(data.error_description || data.msg || (data.error?.message) || data.error || 'Sign up failed');
  }
  return data;
}

/**
 * Sign in with email + password.
 */
async function signIn(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
      body:    JSON.stringify({ email, password }),
    }
  );
  const data = await res.json();
  // Supabase can return errors in multiple shapes — check all of them
  if (!res.ok || data.error || data.error_code || data.msg || !data.access_token) {
    throw new Error(data.error_description || data.msg || data.error || 'Invalid email or password.');
  }
  // Clear any previous session before saving the new one
  localStorage.removeItem('nxuu_session');
  _session = data;
  localStorage.setItem('nxuu_session', JSON.stringify(data));
  return data;
}

/**
 * Sign out — clear session.
 */
async function signOut() {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method:  'POST',
      headers: authHeaders(getToken()),
    });
  } catch(e) {}
  _session = null;
  localStorage.removeItem('nxuu_session');
}

/**
 * Restore session from localStorage on page load.
 * Returns true if a valid session was found.
 */
function restoreSession() {
  try {
    const raw = localStorage.getItem('nxuu_session');
    if (!raw) return false;
    const s = JSON.parse(raw);
    // Must have a real access token AND a real user id — not just any truthy value
    if (!s?.access_token || !s?.user?.id || !s?.user?.email) {
      localStorage.removeItem('nxuu_session');
      return false;
    }
    _session = s;
    return true;
  } catch(e) {
    localStorage.removeItem('nxuu_session');
    return false;
  }
}

/**
 * Build a session from raw tokens (used after email confirmation redirect).
 * Fetches the user object from Supabase so we have a full valid session.
 */
async function setSessionFromTokens(accessToken, refreshToken) {
  // Fetch the user record using the access token
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${accessToken}`,
    }
  });
  if (!res.ok) throw new Error('Could not verify token');
  const user = await res.json();
  if (!user?.id) throw new Error('Invalid user from token');
  const session = { access_token: accessToken, refresh_token: refreshToken, user };
  _session = session;
  localStorage.setItem('nxuu_session', JSON.stringify(session));
}


async function insertTrade(trade) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trades`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ ...trade, user_id: getUserId() }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchAllTrades() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&order=date.desc,created_at.desc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchTradesByMonth(year, month) {
  const from    = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to      = `${year}-${String(month).padStart(2,'0')}-${lastDay}`;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/trades?select=*&date=gte.${from}&date=lte.${to}&order=date.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteTrade(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── CHECKLIST STEPS ───────────────────────────────────────────
async function fetchSteps() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/checklist_steps?select=*&order=position.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insertStep(section, title, position) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ user_id: getUserId(), section, title, position }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function updateStep(id, fields) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteStep(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/checklist_steps?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── ENTRY MODELS ──────────────────────────────────────────────
async function fetchModels() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/entry_models?select=*&order=created_at.asc`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function insertModel(name) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/entry_models`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ user_id: getUserId(), name }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteModel(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/entry_models?id=eq.${id}`, {
    method:  'DELETE',
    headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── PASSWORD RESET ────────────────────────────────────────────
/**
 * Send a password reset email via Supabase.
 */
async function requestPasswordReset(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body:    JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>({}));
    throw new Error(data.msg || data.error_description || 'Could not send reset email.');
  }
}

// ── MT4/5 SYNC KEY ───────────────────────────────────────────
// Generates a random key client-side, stores only its SHA-256
// hash in Supabase, and returns the raw key once (for the EA).
async function generateRandomKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

/**
 * Create (or replace) the user's sync key. Returns the raw key —
 * this is the only time it's ever visible, show it once to the user.
 */
async function generateSyncKey() {
  const rawKey  = await generateRandomKey();
  const keyHash = await sha256Hex(rawKey);
  // Delete any existing key for this user first
  await fetch(`${SUPABASE_URL}/rest/v1/sync_keys?user_id=eq.${getUserId()}`, {
    method: 'DELETE', headers: authHeaders(getToken()),
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_keys`, {
    method:  'POST',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify({ user_id: getUserId(), key_hash: keyHash }),
  });
  if (!res.ok) throw new Error(await res.text());
  return rawKey;
}

/**
 * Check if the user already has a sync key set up (without revealing it).
 */
async function hasSyncKey() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sync_keys?select=id&user_id=eq.${getUserId()}`,
    { headers: authHeaders(getToken()) }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

async function revokeSyncKey() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sync_keys?user_id=eq.${getUserId()}`, {
    method: 'DELETE', headers: authHeaders(getToken()),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── ANNOTATIONS (for API-imported trades) ───────────────────
/**
 * Update only the annotation fields of a trade (never touches
 * locked broker data like pnl, entry, exit, ticket).
 */
async function updateTradeAnnotation(id, fields) {
  const allowed = { r_value: fields.r_value, model: fields.model, session: fields.session, notes: fields.notes };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/trades?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...authHeaders(getToken()), 'Prefer': 'return=representation' },
    body:    JSON.stringify(allowed),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── LEADERBOARD ───────────────────────────────────────────────
/**
 * Fetch aggregated stats for all users who opted in.
 * Uses a Supabase RPC function (see schema_v6.sql for setup).
 * Falls back to empty array if the function doesn't exist yet.
 */
async function fetchLeaderboard() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/get_leaderboard`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({}),
    }
  );
  if (!res.ok) return []; // gracefully return empty if function not set up
  return res.json();
}
