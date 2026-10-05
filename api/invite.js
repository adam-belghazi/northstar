// Owner-only: give a contractor access to their portal and email them a login code.
import { admin, anon, requireOwner, send } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const owner = await requireOwner(req);
  if (!owner) return send(res, 401, { error: 'Only the owner can invite people' });

  const portalId = req.body && req.body.portalId;
  if (!portalId) return send(res, 400, { error: 'portalId is required' });

  const db = admin();
  const { data: portal } = await db.from('portals').select('*').eq('id', portalId).maybeSingle();
  if (!portal) return send(res, 404, { error: 'Save the team member with a portal email first' });
  if (!portal.enabled) return send(res, 400, { error: 'Portal access is turned off for this person' });

  // Create their login (no-op if it already exists). New sign-ups are disabled,
  // so this is the only way a contractor account comes into existence.
  const created = await db.auth.admin.createUser({ email: portal.email, email_confirm: true });
  const alreadyExists = created.error && /already|exists|registered/i.test(created.error.message || '');
  if (created.error && !alreadyExists) return send(res, 500, { error: created.error.message });

  const origin = req.headers.origin || `https://${req.headers.host}`;
  const { error } = await anon().auth.signInWithOtp({
    email: portal.email,
    options: { shouldCreateUser: false, emailRedirectTo: origin + '/' },
  });
  if (error) return send(res, 500, { error: 'Account ready, but the email failed: ' + error.message });

  await db.from('portals').update({ invited_at: new Date().toISOString() }).eq('id', portalId);
  return send(res, 200, { ok: true, url: origin });
}
