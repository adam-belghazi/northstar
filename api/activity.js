// A contractor did something in their portal → push a notification to the owner.
import { admin, currentUser, send, sendPush } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const user = await currentUser(req);
  if (!user) return send(res, 401, { error: 'Not signed in' });

  const db = admin();
  const { data: portal } = await db
    .from('portals')
    .select('id,name,enabled')
    .ilike('email', String(user.email || '').replace(/[%_]/g, '\\$&'))
    .maybeSingle();
  if (!portal || !portal.enabled) return send(res, 403, { error: 'No portal for this account' });

  const text = String((req.body && req.body.text) || '').slice(0, 140);
  if (!text) return send(res, 400, { error: 'text is required' });

  await sendPush(db, { title: portal.name, body: text, url: `/#/hq/portal/${portal.id}`, tag: `portal-${portal.id}` });
  return send(res, 200, { ok: true });
}
