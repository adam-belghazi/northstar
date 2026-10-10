// Door-to-door rules on the server (mirrors js/doors.js). Not a route.

// ---------- time zones: door times are saved as local wall-clock "YYYY-MM-DDTHH:MM" ----------
const parts = (ms, tz) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
const offsetMs = (ms, tz) => {
  const p = parts(ms, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
};
export const localToMs = (local, tz) => {
  const [d, t = '00:00'] = String(local).split('T');
  const [y, m, dd] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, dd, hh, mm);
  return guess - offsetMs(guess, tz);
};
export const localNow = (tz, ms = Date.now()) => {
  const p = parts(ms, tz);
  return `${p.year}-${p.month}-${p.day}T${String(+p.hour % 24).padStart(2, '0')}:${p.minute}`;
};
export const localDateOfIso = (iso, tz) => (iso ? localNow(tz, Date.parse(iso)).slice(0, 10) : '');
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const fmtTime = (local) => {
  const t = String(local || '').slice(11, 16);
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- vocabulary ----------
const BRING = { cards: 'programmed cards', price_sheet: 'price sheet', receipt_book: 'receipt book', payment_link: 'payment link', demo: 'demo' };
export const bringText = (d) => {
  const list = (d.bring || []).map((k) => {
    if (k === 'cards' && (d.services || []).includes('cards') && Number(d.qty) > 1) return `${d.qty} programmed cards`;
    return BRING[k] || k;
  });
  if (!list.length) return '';
  return list.length === 1 ? list[0] : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
};
export const walkInLine = (d) =>
  [`${d.name}${d.area ? `, ${d.area}` : ''}.`, d.askFor ? `Ask for ${d.askFor}.` : '', bringText(d) ? `Bring ${bringText(d)}.` : ''].filter(Boolean).join(' ');

// ---------- queues ----------
const STEPS = [['d2', 2], ['d5', 5], ['d9', 9]];
const digits = (p) => {
  let s = String(p || '').replace(/\D/g, '');
  if (s.startsWith('00')) s = s.slice(2);
  if (s.length === 10 && s.startsWith('0')) s = '971' + s.slice(1);
  else if (s.length === 9 && s.startsWith('5')) s = '971' + s;
  return s;
};
export const nextText = (d, tz) => {
  if (!digits(d.phone) || !(d.status === 'pitched' || d.status === 'follow_up') || d.replied) return null;
  const t = d.texts || {};
  if (!t.first) return { step: 'first', due: String(d.at || '').slice(0, 10) };
  const base = localDateOfIso(t.first, tz);
  for (const [k, n] of STEPS) if (!t[k]) return { step: k, due: addDays(base, n) };
  return null;
};
export const dueTexts = (doors, today, tz) => doors.map((d) => nextText(d, tz)).filter((x) => x && x.due <= today);
export const walkIns = (doors, date) =>
  doors.filter((d) => d.status === 'meeting' && String(d.meetAt || '').slice(0, 10) === date).sort((a, b) => (a.meetAt < b.meetAt ? -1 : 1));
export const revisits = (doors, today) => doors.filter((d) => d.status === 'follow_up' && d.nextAt && d.nextAt <= today);
