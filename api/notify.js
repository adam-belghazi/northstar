// Daily evening push (Vercel Cron), or a test push when the owner taps "Send test".
// Sends: check-in reminder, what's due tomorrow / overdue, subscriptions renewing soon.
import { admin, isCron, requireOwner, send, sendPush, loadOwnerData, once, todayIn, addDays, nextRenewal } from './_lib.js';

export default async function handler(req, res) {
  const cron = isCron(req);
  if (!cron && !(await requireOwner(req))) return send(res, 401, { error: 'Not allowed' });
  const db = admin();

  if (!cron && req.body && req.body.test) {
    const sent = await sendPush(db, { title: 'Northstar', body: 'Notifications are on. You’ll hear from me in the evening.', url: '/#/home' });
    return send(res, 200, { ok: true, sent });
  }

  const data = await loadOwnerData(db);
  const tz = data.settings.timezone || 'Asia/Dubai';
  const today = todayIn(tz);
  const tomorrow = addDays(today, 1);
  const pushes = [];

  // 1) check-in
  if (!(data.checkins || {})[today] && (await once(db, `checkin:${today}`))) {
    pushes.push({ title: 'Daily check-in', body: '60 seconds before bed. Keep the streak honest.', url: '/#/life/checkin', tag: 'checkin' });
  }

  // 2) deadlines
  const open = (data.tasks || []).filter((t) => t.stage !== 'done');
  const dueTomorrow = [
    ...open.filter((t) => t.deadline === tomorrow).map((t) => t.name),
    ...(data.goals || []).filter((g) => g.status !== 'done' && g.due === tomorrow).map((g) => g.title),
  ];
  const overdue = open.filter((t) => t.deadline && t.deadline < today && t.stage !== 'hold_money');
  if ((dueTomorrow.length || overdue.length) && (await once(db, `due:${today}`))) {
    const parts = [];
    if (dueTomorrow.length) parts.push(`Due tomorrow: ${dueTomorrow.slice(0, 3).join(', ')}${dueTomorrow.length > 3 ? '…' : ''}`);
    if (overdue.length) parts.push(`${overdue.length} overdue`);
    pushes.push({ title: 'Deadlines', body: parts.join(' · '), url: '/#/hq/pipeline', tag: 'due' });
  }

  // 3) subscriptions renewing in the next 3 days
  for (const s of (data.subs || []).filter((x) => x.status === 'active')) {
    const next = nextRenewal(s, today);
    if (next && next <= addDays(today, 3) && (await once(db, `renew:${s.id}:${next}`))) {
      pushes.push({ title: 'Renewing soon', body: `${s.name} renews ${next === today ? 'today' : next === tomorrow ? 'tomorrow' : 'on ' + next}.`, url: '/#/hq/subs', tag: `renew-${s.id}` });
    }
  }

  let sent = 0;
  for (const p of pushes) sent += await sendPush(db, p);
  return send(res, 200, { ok: true, notifications: pushes.length, deliveries: sent });
}
