// Runs every 5 minutes (Supabase pg_cron → this URL). Sends:
//   • walk-in reminders 30 and 15 minutes before each meeting
//   • the 8:30 am digest: "Today: 4 walk-ins, 7 texts"
// Each notification is sent once (notification_log), so extra calls are harmless.
import { admin, isCron, isTick, requireOwner, send, sendPush, loadOwnerData, once } from './_lib.js';
import { localToMs, localNow, fmtTime, plural, walkInLine, dueTexts, walkIns, revisits } from './_doors.js';

export default async function handler(req, res) {
  const db = admin();
  if (!(await isTick(req, db)) && !isCron(req) && !(await requireOwner(req))) return send(res, 401, { error: 'Not allowed' });

  const data = await loadOwnerData(db);
  const tz = data.settings.timezone || 'Asia/Dubai';
  const doors = data.doors || [];
  const now = Date.now();
  const nowLocal = localNow(tz, now);
  const today = nowLocal.slice(0, 10);
  const pushes = [];

  // walk-in reminders
  for (const d of doors) {
    if (d.status !== 'meeting' || !d.meetAt) continue;
    const mins = (localToMs(d.meetAt, tz) - now) / 60000;
    const which = mins > 15 && mins <= 31 ? 30 : mins > 0 && mins <= 15 ? 15 : 0;
    if (!which || !(await once(db, `walk:${d.id}:${d.meetAt}:${which}`))) continue;
    pushes.push({
      title: which === 30 ? `Walk-in at ${fmtTime(d.meetAt)} · 30 min` : `Head back now · ${fmtTime(d.meetAt)}`,
      body: walkInLine(d),
      url: '/#/doors/today',
      tag: `walk-${d.id}`,
    });
  }

  // 8:30 am digest
  const hm = nowLocal.slice(11, 16);
  if (hm >= '08:30' && hm < '12:00' && (await once(db, `doors-digest:${today}`))) {
    const walk = walkIns(doors, today);
    const texts = dueTexts(doors, today, tz).length;
    const rev = revisits(doors, today).length;
    if (walk.length || texts || rev) {
      const first = walk[0];
      pushes.push({
        title: `Today: ${plural(walk.length, 'walk-in')}, ${plural(texts, 'text')}`,
        body: [first ? `First: ${first.name} at ${fmtTime(first.meetAt)}${first.area ? ` (${first.area})` : ''}.` : '', rev ? `${plural(rev, 'revisit')} due.` : '', texts ? 'Texts take 2 minutes from the Doors tab.' : '']
          .filter(Boolean)
          .join(' '),
        url: '/#/doors/today',
        tag: 'doors-digest',
      });
    }
  }

  let sent = 0;
  for (const p of pushes) sent += await sendPush(db, p).catch(() => 0);
  return send(res, 200, { ok: true, notifications: pushes.length, deliveries: sent, at: nowLocal });
}
