// Shared helpers for the serverless functions. Files starting with "_" are not routes.
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

export const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable ${k}`);
  return v;
};

// Service-role client: bypasses row-level security. Server-side only.
export const admin = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

export const anon = () =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

// Vercel Cron sends "Authorization: Bearer $CRON_SECRET"
export const isCron = (req) => !!process.env.CRON_SECRET && bearer(req) === process.env.CRON_SECRET;

export async function currentUser(req) {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  return error ? null : data.user;
}

export async function ownerEmail(db) {
  const { data } = await db.from('app_owner').select('email').eq('id', 1).maybeSingle();
  return (data && data.email) || '';
}

export async function requireOwner(req) {
  const user = await currentUser(req);
  if (!user) return null;
  const owner = await ownerEmail(admin());
  return owner && owner.toLowerCase() === String(user.email || '').toLowerCase() ? user : null;
}

export function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

// ---------- dates in the owner's timezone ----------
export const todayIn = (tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
};
export function nextRenewal(sub, today) {
  if (!sub.renews) return null;
  let d = sub.renews;
  let guard = 0;
  while (d < today && guard++ < 600) d = addMonths(d, sub.cycle === 'yearly' ? 12 : 1);
  return d;
}

// ---------- owner data ----------
export async function loadOwnerData(db) {
  const [{ data: st }, { data: rows }] = await Promise.all([
    db.from('owner_state').select('data').eq('id', 1).maybeSingle(),
    db.from('tasks').select('data'),
  ]);
  const data = (st && st.data) || {};
  data.tasks = (rows || []).map((r) => r.data);
  data.settings = data.settings || {};
  return data;
}

// Returns true the first time a key is seen, so each notification goes out once.
export async function once(db, key) {
  const { error } = await db.from('notification_log').insert({ key });
  return !error;
}

// ---------- web push ----------
export async function sendPush(db, payload) {
  webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
  const { data: subs } = await db.from('push_subscriptions').select('*');
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      // the phone unsubscribed or the app was removed
      if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
      else console.error('push failed', e.statusCode, e.body);
    }
  }
  return sent;
}
