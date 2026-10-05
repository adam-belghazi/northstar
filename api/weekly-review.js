// Weekly AI review: Sunday evening via Vercel Cron, or on demand from the Review page.
import Anthropic from '@anthropic-ai/sdk';
import { admin, isCron, requireOwner, send, sendPush, loadOwnerData, once, todayIn, addDays } from './_lib.js';

const PEG = 3.6725;
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const METRICS = [
  ['Woke on time', (c) => !!c.wakeOnTime],
  ['Slept on time', (c) => !!c.sleepOnTime],
  ['7h+ sleep', (c) => Number(c.sleepHours) >= 7],
  ['Door-to-door', (c) => !!c.d2d],
  ['Followed up', (c) => !!c.followUp],
  ['Trained', (c) => !!c.trained],
  ['Calorie goal', (c) => !!c.calories],
  ['All 5 prayers', (c) => (c.prayers || []).filter(Boolean).length === 5],
  ['Meditated', (c) => !!c.meditated],
  ['Peace of mind 4+', (c) => Number(c.peace) >= 4],
  ['Girlfriend on time', (c) => !!c.gf],
];
const HOURS = { sales: 'Door-to-door', pawminds: 'PawMinds', training: 'Training', relationships: 'People', learning: 'Learning', rest: 'Rest', wasted: 'Wasted' };

const SYSTEM = `You write the weekly operating review inside Northstar, one person's personal operating system. The person funds their startup, PawMinds, through door-to-door sales. PawMinds can only run paid ads once door-to-door earnings reach a money gate. Their rule: finish every PawMinds task that doesn't need money now, so the money has somewhere to go the moment it lands.

Write like a blunt senior strategy consultant reviewing a client's week. Lead with evidence, be specific, skip cheerleading and generic advice. Use only the data provided. If something isn't in the data, don't invent it. Name tasks and goals exactly as written. Speak to the person directly as "you".

Format in Markdown, under 450 words, using exactly these sections:
## The week in one line
## Where the time went
## What moved
## What slipped
## PawMinds readiness
## Pushback
## Next week: top 3

"Where the time went" reads the hours by bucket and says what they reveal about priorities. "What slipped" covers habits under 60% and the most likely cause visible in the data. "PawMinds readiness" names the stage, the critical-path task, and what can be finished before the money gate opens. "Pushback" makes one to three honest calls: spreading thin, avoiding something, or working on the wrong stage. "Next week: top 3" gives concrete actions tied to existing tasks or goals, each with a one-line reason. If last week's review is included, say whether its top 3 actually happened.`;

function buildBrief(data, start, end) {
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const ci = data.checkins || {};
  const s = data.settings || {};
  const lines = [];
  const gateAmt = Number(s.gateAmount) || 40000;

  lines.push(`Week: ${start} to ${end}. Name: ${s.name || '(not set)'}. Money gate: ${gateAmt} AED to unlock "${s.gateLabel || 'Run PawMinds ads'}".`);

  lines.push('\n# Daily check-ins');
  const logged = days.filter((d) => ci[d]);
  for (const d of days) {
    const c = ci[d];
    const wd = new Date(d + 'T00:00:00Z').toUTCString().slice(0, 3);
    if (!c) { lines.push(`${wd} ${d}: not logged`); continue; }
    const marks = METRICS.map(([label, test]) => `${label} ${test(c) ? 'yes' : 'no'}`).join('; ');
    const prayers = PRAYERS.filter((_, i) => (c.prayers || [])[i]).join('/') || 'none';
    const hours = Object.entries(c.hours || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${HOURS[k] || k} ${v}h`).join(', ');
    lines.push(`${wd} ${d}: ${marks}. Sleep ${c.sleepHours ?? '?'}h. Prayers: ${prayers}. Peace ${c.peace ?? '?'}/5. Earned ${Number(c.d2dAmount) || 0} AED. Follow-ups ${c.followUpCount ?? 0}. Hours: ${hours || 'not logged'}.${c.note ? ' Note: ' + c.note : ''}`);
  }
  lines.push(`\n# Habit rates (${logged.length}/7 days logged)`);
  for (const [label, test] of METRICS) {
    const hits = logged.filter((d) => test(ci[d])).length;
    lines.push(`${label}: ${hits}/${logged.length}`);
  }
  const hourTotals = {};
  logged.forEach((d) => Object.entries(ci[d].hours || {}).forEach(([k, v]) => (hourTotals[k] = (hourTotals[k] || 0) + (Number(v) || 0))));
  lines.push('\n# Hours this week');
  lines.push(Object.entries(hourTotals).map(([k, v]) => `${HOURS[k] || k}: ${v}h`).join(', ') || 'none logged');

  lines.push('\n# Goals');
  for (const g of data.goals || []) {
    const subs = g.subtasks || [];
    const pct = g.status === 'done' ? 100 : subs.length ? Math.round((subs.filter((x) => x.done).length / subs.length) * 100) : Number(g.manualPct) || 0;
    lines.push(`- [${g.area}] "${g.title}": ${g.status}, ${pct}%, due ${g.due || 'none'}${g.where ? `, where: ${g.where}` : ''}`);
  }

  const tasks = data.tasks || [];
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const open = (t) => t.stage !== 'done';
  const dependents = (id) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const t of tasks) if (open(t) && (t.dependsOn || []).includes(cur) && !seen.has(t.id) && t.id !== id) { seen.add(t.id); stack.push(t.id); }
    }
    return seen.size;
  };
  const team = Object.fromEntries((data.team || []).map((m) => [m.id, m.name]));
  const ownerName = (t) => (t.ownerId && t.ownerId !== 'me' ? team[t.ownerId] || 'contractor' : t.owner || 'Me');

  lines.push('\n# PawMinds tasks finished this week');
  const doneThisWeek = tasks.filter((t) => t.stage === 'done' && t.completed && t.completed >= start && t.completed <= end);
  lines.push(doneThisWeek.map((t) => `- ${t.name}`).join('\n') || 'none');

  lines.push('\n# Open PawMinds tasks');
  for (const t of tasks.filter(open)) {
    const deps = (t.dependsOn || []).map((id) => byId[id]).filter((d) => d && open(d)).map((d) => d.name);
    const subs = t.subtasks || [];
    lines.push(`- "${t.name}": stage ${t.stage}, owner ${ownerName(t)}, priority ${t.priority}, deadline ${t.deadline || 'none'}${t.deadline && t.deadline < end ? ' (OVERDUE)' : ''}${t.moneyGated ? ', needs money' : ''}${t.waitingOn ? `, waiting on ${t.waitingOn}` : ''}${deps.length ? `, blocked by ${deps.join(', ')}` : ''}, ${dependents(t.id)} tasks depend on it, subtasks done ${subs.filter((x) => x.done).length}/${subs.length}`);
  }

  const crit = tasks.filter((t) => t.critical !== false && !t.moneyGated);
  const earnedAll = Object.values(ci).reduce((a, c) => a + (Number(c.d2dAmount) || 0), 0) +
    (data.income || []).reduce((a, i) => a + (Number(i.amount) || 0) * (i.currency === 'USD' ? PEG : 1), 0);
  const earnedWeek = logged.reduce((a, d) => a + (Number(ci[d].d2dAmount) || 0), 0);
  lines.push('\n# Readiness & money');
  lines.push(`Launch tasks that don't need money: ${crit.filter((t) => !open(t)).length}/${crit.length} done.`);
  lines.push(`Money gate: ${Math.round(earnedAll)} / ${gateAmt} AED total. Earned this week: ${earnedWeek} AED.`);
  return lines.join('\n');
}

export default async function handler(req, res) {
  const cron = isCron(req);
  if (!cron && !(await requireOwner(req))) return send(res, 401, { error: 'Not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: 'ANTHROPIC_API_KEY is not set in Vercel' });

  const db = admin();
  const data = await loadOwnerData(db);
  const end = todayIn(data.settings.timezone || 'Asia/Dubai');
  const start = addDays(end, -6);
  if (cron && !(await once(db, `review:${end}`))) return send(res, 200, { ok: true, skipped: 'already generated' });

  const { data: prev } = await db.from('reviews').select('content,week_end').order('created_at', { ascending: false }).limit(1);
  const last = prev && prev[0] && prev[0].week_end < end ? `\n\n# Last week's review (${prev[0].week_end})\n${prev[0].content.slice(0, 3000)}` : '';

  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Here is this week's data. Write the review.\n\n${buildBrief(data, start, end)}${last}` }],
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'The Anthropic API key is invalid' });
    if (error instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'Rate limited by Anthropic — try again in a minute' });
    if (error instanceof Anthropic.APIError) return send(res, 502, { error: `Anthropic API error ${error.status}: ${error.message}` });
    throw error;
  }

  if (response.stop_reason === 'refusal') return send(res, 502, { error: 'The model declined to write this review. Try again.' });
  const content = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!content) return send(res, 502, { error: 'Empty review — try again' });

  const { data: saved, error } = await db.from('reviews').insert({ week_start: start, week_end: end, content }).select().single();
  if (error) return send(res, 500, { error: error.message });

  await sendPush(db, { title: 'Weekly review', body: 'Your week, reviewed. Tap to read.', url: '/#/life/review', tag: 'review' }).catch(() => 0);
  return send(res, 200, { ok: true, review: saved });
}
