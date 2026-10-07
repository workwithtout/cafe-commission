import { createClient } from '@supabase/supabase-js';

// The ONLY place the site learns which Supabase project to talk to is these two environment
// variables (set in Vercel -> Settings -> Environment Variables). Nothing is hard-coded, so every
// copy of the template talks to its own owner's Supabase project and nobody else's.
const rawUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// People often paste "https://xyz.supabase.co/" or the full ".../rest/v1/" address — accept both.
const url = rawUrl.replace(/\/(rest|auth|storage|realtime)\/v1.*$/i, '').replace(/\/+$/, '');

function jwtRole(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).role || null;
  } catch {
    return null;
  }
}

/**
 * What is wrong with the configuration, if anything:
 *   missing_url | bad_url | missing_key | secret_key | null
 * A secret / service_role key must NEVER ship inside a web page (it bypasses all security),
 * so the site refuses to start with one instead of silently exposing the database.
 */
export function configProblem() {
  if (!url) return 'missing_url';
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(url)) return 'bad_url';
  if (!rawKey) return 'missing_key';
  if (/^sb_secret_/i.test(rawKey) || jwtRole(rawKey) === 'service_role') return 'secret_key';
  return null;
}

export const problem = configProblem();
export const configured = problem === null;

export const supabase = configured
  ? createClient(url, rawKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export const BUCKET = 'cafe-media';

/** Direct link to this project's SQL Editor (so the setup page can open the right place in one tap). */
export function sqlEditorUrl() {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}/sql/new` : 'https://supabase.com/dashboard';
}

export function usersUrl() {
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
  return m ? `https://supabase.com/dashboard/project/${m[1]}/auth/users` : 'https://supabase.com/dashboard';
}

/** Throws a readable Error if a Supabase response failed. Returns data otherwise. */
export function unwrap({ data, error }) {
  if (error) {
    const e = new Error(error.message || 'เกิดข้อผิดพลาดจากฐานข้อมูล');
    e.code = error.code;
    throw e;
  }
  return data;
}

/** True when the error means "the database tables have not been created yet". */
export function isSetupError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return ['PGRST205', 'PGRST202', '42P01', '42883'].includes(code) || /schema cache|does not exist|Could not find the (table|function)/i.test(msg);
}
