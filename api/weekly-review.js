// Weekly AI review: Sunday evening via Vercel Cron, or on demand from the Review page.
import Anthropic from '@anthropic-ai/sdk';
import { admin, isCron, requireOwner, send, sendPush, loadOwnerData, once, todayIn, addDays } from './_lib.js';
import { items as ciItems, autoDay, hit, describe, HOURS } from './_checkin.js';

const PEG = 3.6725;

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
  const tz = s.timezone || 'Asia/Dubai';
  const doors = data.doors || [];
  const lines = [];
  const gateAmt = Number(s.gateAmount) || 40000;
  const its = ciItems(s);
  const metrics = its.filter((it) => it.area && it.area !== 'none');

  lines.push(`Week: ${start} to ${end}. Name: ${s.name || '(not set)'}. Money gate: ${gateAmt} AED to unlock "${s.gateLabel || 'Run PawMinds ads'}".`);

  lines.push('\n# Daily check-ins');
  const logged = days.filter((d) => ci[d]);
  for (const d of days) {
    const c = ci[d];
    const wd = new Date(d + 'T00:00:00Z').toUTCString().slice(0, 3);
    const auto = autoDay(doors, d, tz);
    if (!c) { lines.push(`${wd} ${d}: not logged${auto.doors ? ` (but ${auto.doors} doors logged)` : ''}`); continue; }
    const h = c.hours || {};
    const hours = HOURS.filter(([k]) => Number(h[k]) > 0).map(([k, label]) => `${label} ${h[k]}h`).join(', ');
    lines.push(`${wd} ${d}: ${its.map((it) => describe(it, c, auto)).join('; ')}. Hours: ${hours || 'not logged'}.${c.workNote ? ' Work note: ' + c.workNote : ''}${c.note ? ' Note: ' + c.note : ''}`);
  }
  lines.push(`\n# Habit rates (${logged.length}/7 days logged)`);
  for (const it of metrics) {
    const hits = logged.filter((d) => hit(it, ci[d], autoDay(doors, d, tz))).length;
    lines.push(`${it.metricLabel || it.label}: ${hits}/${logged.length}`);
  }
  lines.push('\n# Hours this week');
  lines.push(HOURS.map(([k, label]) => `${label}: ${logged.reduce((a, d) => a + (Number((ci[d].hours || {})[k]) || 0), 0)}h`).join(', '));

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
  const deposits = doors.filter((d) => d.depositPaid).map((d) => ({ date: d.depositDate || String(d.at || '').slice(0, 10), amount: Number(d.depositAmount) || 0 }));
  const earnedAll = Object.values(ci).reduce((a, c) => a + (Number(c.d2dAmount) || 0), 0) +
    deposits.reduce((a, x) => a + x.amount, 0) +
    (data.income || []).reduce((a, i) => a + (Number(i.amount) || 0) * (i.currency === 'USD' ? PEG : 1), 0);
  const earnedWeek = days.reduce((a, d) => a + (Number((ci[d] || {}).d2dAmount) || 0), 0) + deposits.filter((x) => x.date >= start && x.date <= end).reduce((a, x) => a + x.amount, 0);
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
