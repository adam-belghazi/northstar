// Public settings the browser needs. Only public values here — never secrets.
import { send } from './_lib.js';

export default function handler(req, res) {
  send(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    ai: !!process.env.ANTHROPIC_API_KEY,
  });
}
