// Private iPhone/Google calendar feed: walk-ins (with 30 + 15 min alerts) and revisits.
// URL: /api/calendar?t=<secret token from Doors → Calendar>. Wrong token = 404.
import { admin, loadOwnerData, safeEqual } from './_lib.js';
import { localToMs, bringText } from './_doors.js';

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = (line) => {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out.join('\r\n');
};

export default async function handler(req, res) {
  const t = String((req.query && req.query.t) || '');
  const db = admin();
  const data = await loadOwnerData(db);
  const token = (data.settings.doors || {}).calToken;
  if (!token || !safeEqual(t, token)) {
    res.status(404).setHeader('Content-Type', 'text/plain');
    return res.end('Not found');
  }
  const tz = data.settings.timezone || 'Asia/Dubai';
  const stamp = utc(Date.now());
  const L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Northstar//Doors//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Northstar · Doors', `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M',
  ];
  const alarm = (trigger, text) => ['BEGIN:VALARM', `TRIGGER${trigger}`, 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, 'END:VALARM'];

  for (const d of data.doors || []) {
    if (d.status === 'meeting' && d.meetAt) {
      const start = localToMs(d.meetAt, tz);
      const desc = [d.askFor ? `Ask for ${d.askFor}` : '', bringText(d) ? `Bring ${bringText(d)}` : '', d.phone ? `Phone ${d.phone}` : '', d.notes ? `Notes: ${d.notes}` : ''].filter(Boolean).join('\n');
      L.push('BEGIN:VEVENT', `UID:walkin-${d.id}@northstar`, `DTSTAMP:${stamp}`, `DTSTART:${utc(start)}`, `DTEND:${utc(start + 30 * 60000)}`,
        `SUMMARY:${esc('Walk-in: ' + d.name)}`, `LOCATION:${esc(d.area || '')}`, `DESCRIPTION:${esc(desc)}`, 'STATUS:CONFIRMED',
        ...alarm(':-PT30M', `${d.name} in 30 minutes`), ...alarm(':-PT15M', `Head back to ${d.name} now`), 'END:VEVENT');
    }
    if (d.status === 'follow_up' && d.nextAt) {
      const day = d.nextAt.replace(/-/g, '');
      const next = new Date(d.nextAt + 'T00:00:00Z');
      next.setUTCDate(next.getUTCDate() + 1);
      L.push('BEGIN:VEVENT', `UID:revisit-${d.id}-${day}@northstar`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`, `SUMMARY:${esc('Revisit: ' + d.name)}`,
        `LOCATION:${esc(d.area || '')}`, 'TRANSP:TRANSPARENT', ...alarm(';RELATED=START:PT9H', `Revisit ${d.name} today`), 'END:VEVENT');
    }
  }
  L.push('END:VCALENDAR');
  res.status(200);
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(L.map(fold).join('\r\n') + '\r\n');
}
