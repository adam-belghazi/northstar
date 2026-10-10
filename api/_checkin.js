// Daily check-in rules on the server (mirrors js/store.js). Not a route.
import { localDateOfIso } from './_doors.js';

const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
export const DEFAULT_CHECKIN = {
  groups: [
    { name: 'Sleep', items: [
      { id: 'wakeOnTime', label: 'Woke up on time', type: 'toggle_time', extra: 'wakeTime', area: 'health' },
      { id: 'sleepOnTime', label: 'Slept on time', type: 'toggle_time', extra: 'sleepTime', area: 'health' },
      { id: 'sleepHours', label: 'Hours slept', type: 'number', area: 'health', target: 7, metricLabel: '7h+ sleep' },
    ] },
    { name: 'Work', items: [
      { id: 'workedOn', label: 'Today I worked on', type: 'choice', options: ['Door-to-door', 'PawMinds', 'Other'], area: 'work', auto: 'doors', metricLabel: 'Worked' },
      { id: 'd2dAmount', label: 'Earned today', type: 'money', area: 'none', auto: 'deposits' },
      { id: 'followUp', label: 'Followed up with people', type: 'toggle_number', extra: 'followUpCount', area: 'work', auto: 'texts', metricLabel: 'Followed up' },
    ] },
    { name: 'Body', items: [
      { id: 'trained', label: 'Hit the gym', type: 'toggle', area: 'health' },
      { id: 'calories', label: 'Hit my calorie goal', type: 'toggle', area: 'health' },
    ] },
    { name: 'Mind & deen', items: [
      { id: 'prayers', label: 'Prayers', type: 'pills', options: PRAYERS, area: 'habits', metricLabel: 'All 5 prayers' },
      { id: 'meditated', label: 'Meditated', type: 'minutes', area: 'habits' },
    ] },
  ],
};
export const HOURS = [['sales', 'Door-to-door'], ['pawminds', 'PawMinds'], ['training', 'Gym'], ['wasted', 'Wasted']];

export const items = (settings) => ((settings.checkin && settings.checkin.groups) || DEFAULT_CHECKIN.groups).flatMap((g) => g.items);

// door activity that fills the check-in by itself
export const autoDay = (doors, date, tz) => ({
  doors: doors.filter((d) => String(d.at || '').slice(0, 10) === date).length,
  deposits: doors.filter((d) => d.depositPaid && (d.depositDate || String(d.at || '').slice(0, 10)) === date).reduce((a, d) => a + (Number(d.depositAmount) || 0), 0),
  texts: doors.reduce((a, d) => a + Object.values(d.texts || {}).filter((iso) => iso && localDateOfIso(iso, tz) === date).length, 0),
});

export function hit(it, c, auto) {
  const v = c[it.id];
  if (typeof v === 'boolean' && it.type === 'minutes') return v;
  switch (it.type) {
    case 'toggle':
    case 'toggle_time':
    case 'toggle_number':
      return !!v || (it.auto === 'texts' && auto.texts > 0);
    case 'number':
    case 'money':
    case 'minutes':
      return Number(v) >= (Number(it.target) || 0.0001) || (it.auto === 'deposits' && auto.deposits > 0);
    case 'pills':
      return Array.isArray(v) && v.filter(Boolean).length >= (Number(it.target) || (it.options || []).length);
    case 'choice':
      return (Array.isArray(v) && v.length > 0) || (it.auto === 'doors' && auto.doors > 0);
    case 'time':
      return !!v && (!it.target || v <= it.target);
    default:
      return false;
  }
}

// readable value for the brief, e.g. "Meditated 15 min", "Prayers 4/5 (no Fajr)"
export function describe(it, c, auto) {
  const v = c[it.id];
  switch (it.type) {
    case 'pills': {
      const opts = it.options || [];
      const arr = Array.isArray(v) ? v : [];
      const missed = opts.filter((_, i) => !arr[i]);
      return `${it.label} ${opts.length - missed.length}/${opts.length}${missed.length && missed.length < opts.length ? ` (missed ${missed.join(', ')})` : ''}`;
    }
    case 'choice':
      return `${it.label}: ${(Array.isArray(v) && v.length ? v : auto.doors && it.auto === 'doors' ? ['Door-to-door'] : ['nothing']).join(', ')}`;
    case 'minutes':
      return `${it.label} ${Number(v) || 0} min`;
    case 'money':
      return `${it.label} ${(Number(v) || 0) + (it.auto === 'deposits' ? auto.deposits : 0)} AED`;
    case 'number':
      return `${it.label} ${v ?? '?'}`;
    case 'toggle_time':
      return `${it.label} ${v ? 'yes' : 'no'}${c[it.extra || it.id + '_x'] ? ` (${c[it.extra || it.id + '_x']})` : ''}`;
    case 'toggle_number': {
      const n = (Number(c[it.extra || it.id + '_x']) || 0) + (it.auto === 'texts' ? auto.texts : 0);
      return `${it.label} ${v || n ? 'yes' : 'no'}${n ? ` (${n})` : ''}`;
    }
    default:
      return `${it.label} ${hit(it, c, auto) ? 'yes' : 'no'}`;
  }
}
