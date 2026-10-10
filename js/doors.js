// Door-to-door: vocabulary, settings, WhatsApp templates, text queue, walk-ins,
// and the numbers that flow into the daily check-in.
(function (NS) {
  const S = NS.S;
  const D = (NS.D = {});

  D.STATUS = [
    { k: 'cold', label: 'Cold', color: 'var(--dim)' },
    { k: 'pitched', label: 'Pitched', color: 'var(--p3)' },
    { k: 'follow_up', label: 'Follow-up', color: 'var(--p2)' },
    { k: 'meeting', label: 'Meeting set', color: 'var(--p1)' },
    { k: 'closed', label: 'Closed', color: 'var(--ink)' },
    { k: 'dead', label: 'Dead', color: 'var(--danger)' },
  ];
  D.SERVICES = [
    { k: 'cards', label: 'Cards', phrase: 'cards' },
    { k: 'owner_line', label: 'Owner Line', phrase: 'Owner Line' },
    { k: 'website', label: 'Website', phrase: 'website' },
    { k: 'ads', label: 'Ads', phrase: 'ads' },
    { k: 'content', label: 'Content', phrase: 'content' },
    { k: 'hc28', label: 'HC28 fit-out', phrase: 'HC28 fit-out' },
  ];
  D.ROLES = [
    { k: 'owner', label: 'Owner' },
    { k: 'manager', label: 'Manager' },
    { k: 'staff', label: 'Staff' },
    { k: 'head_office', label: 'Head office' },
  ];
  D.OBJECTIONS = [
    { k: 'too_expensive', label: 'Too expensive' },
    { k: 'brand_policy', label: 'Brand policy / head office' },
    { k: 'already_have', label: 'Already have it' },
    { k: 'needs_owner', label: 'Needs the owner' },
    { k: 'needs_licence', label: 'Needs trade licence or invoice' },
    { k: 'send_info', label: 'Send me info' },
    { k: 'other', label: 'Other' },
  ];
  D.BRING = [
    { k: 'cards', label: 'Programmed cards' },
    { k: 'price_sheet', label: 'Price sheet' },
    { k: 'receipt_book', label: 'Receipt book' },
    { k: 'payment_link', label: 'Payment link' },
    { k: 'demo', label: 'Demo' },
  ];
  D.TYPES = ['Café', 'Restaurant', 'Salon', 'Gym', 'Clinic', 'Retail', 'Office', 'Hotel', 'Other'];
  D.STEPS = [
    { k: 'first', label: 'First text', day: 0 },
    { k: 'd2', label: 'Follow-up · day 2', day: 2 },
    { k: 'd5', label: 'Follow-up · day 5', day: 5 },
    { k: 'd9', label: 'Break-up · day 9', day: 9 },
  ];
  D.status = (k) => S.find(D.STATUS, k);
  D.labelOf = (list, k) => (list.find((x) => x.k === k) || { label: k }).label;

  // ---------- settings ----------
  D.cfg = () => Object.assign({ target: 30, prices: {}, templates: {}, calToken: '', lastArea: '' }, S.state.settings.doors || {});
  D.setCfg = (patch) => {
    S.state.settings.doors = Object.assign(D.cfg(), patch);
    S.save();
  };
  D.calToken = () => {
    let t = D.cfg().calToken;
    if (!t) {
      const b = new Uint8Array(18);
      crypto.getRandomValues(b);
      t = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      D.setCfg({ calToken: t });
    }
    return t;
  };
  D.autoPrice = (services, qty) => {
    const p = D.cfg().prices || {};
    const each = NS.sum(services || [], (s) => Number(p[s]) || 0);
    return each ? each * (Number(qty) || 1) : null;
  };

  // ---------- dates ----------
  D.dateOf = (local) => String(local || '').slice(0, 10);
  D.timeOf = (local) => String(local || '').slice(11, 16);
  D.localDate = (iso) => (iso ? NS.iso(new Date(iso)) : '');
  D.fmtTime = (local) => {
    const t = D.timeOf(local);
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  D.nowLocal = () => {
    const d = new Date();
    return `${NS.iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // ---------- WhatsApp ----------
  D.TEMPLATES = {
    first: "Hi {name}, it's {me}. I came by {business} today about the {service}. {quote}Happy to drop by again whenever suits you 🙂",
    too_expensive: "Hi {name}, it's {me} from earlier 👋 I've been thinking about the {service}. {quote}If we lock it in this week I can sharpen the price. Want me to bring it by?",
    brand_policy: "Hi {name}, it's {me} from earlier. Totally understand it goes through head office. Want me to send a one-page summary of the {service} you can forward to them?",
    already_have: "Hi {name}, it's {me} from earlier. You mentioned you already have something for the {service}. Happy to show you how ours compares: 5 minutes, no pressure.",
    needs_owner: "Hi {name}, it's {me} from earlier. When's a good time to catch the owner? I'll come back and walk them through the {service} in 5 minutes.",
    needs_licence: "Hi {name}, it's {me} from earlier. No problem on the paperwork: I can send a proper invoice with our trade licence for the {service}. Shall I send it over?",
    send_info: "Hi {name}, as promised, here's the info on the {service}. {quote}Any questions, just reply here 🙂",
    other: "Hi {name}, it's {me} from earlier about the {service}. Let me know what would make it work for you 🙂",
    d2: 'Hi {name}, just checking you saw my message about the {service} 🙂',
    d5: 'Hi {name}, quick follow-up on the {service} for {business}. I can come by any day this week. What suits you?',
    d9: "Hi {name}, I'll stop chasing 🙂 If the {service} becomes a priority, I'm one message away.",
  };
  D.TEMPLATE_LABELS = [
    ['first', 'First text (no objection)'],
    ...D.OBJECTIONS.map((o) => [o.k, 'First text · ' + o.label]),
    ['d2', 'Follow-up · day 2'],
    ['d5', 'Follow-up · day 5'],
    ['d9', 'Break-up · day 9'],
  ];
  D.tpl = (k) => (D.cfg().templates || {})[k] || D.TEMPLATES[k] || D.TEMPLATES.first;
  D.servicePhrase = (d) => {
    const ps = (d.services || []).map((k) => (D.SERVICES.find((s) => s.k === k) || { phrase: k }).phrase);
    if (!ps.length) return 'offer';
    return ps.length === 1 ? ps[0] : ps.slice(0, -1).join(', ') + ' and ' + ps[ps.length - 1];
  };
  D.firstKey = (d) => (d.objections || []).find((o) => D.TEMPLATES[o]) || 'first';
  D.render = (step, d) => {
    const key = step === 'first' ? D.firstKey(d) : step;
    const qty = Number(d.qty) || 1;
    const quote = Number(d.price) > 0 ? `It's AED ${Number(d.price).toLocaleString('en-US')}${qty > 1 ? ` for ${qty}` : ''}. ` : '';
    const vars = {
      name: (d.askFor || d.dmName || '').trim() || 'there',
      me: (S.state.settings.name || '').trim() || 'me',
      business: d.name || 'your place',
      service: D.servicePhrase(d),
      quote,
    };
    return D.tpl(key).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\s{2,}/g, ' ').trim();
  };
  // Local UAE numbers (05x…) become international (9715x…) for wa.me
  D.phoneDigits = (p) => {
    let s = String(p || '').replace(/\D/g, '');
    if (s.startsWith('00')) s = s.slice(2);
    if (s.length === 10 && s.startsWith('0')) s = '971' + s.slice(1);
    else if (s.length === 9 && s.startsWith('5')) s = '971' + s;
    return s;
  };
  D.waLink = (d, text) => `https://wa.me/${D.phoneDigits(d.phone)}?text=${encodeURIComponent(text)}`;

  // ---------- text queue: first text, then day 2 / 5 / 9 after the first one went out ----------
  D.chainActive = (d) => !!D.phoneDigits(d.phone) && (d.status === 'pitched' || d.status === 'follow_up') && !d.replied;
  D.nextText = (d) => {
    if (!D.chainActive(d)) return null;
    const t = d.texts || {};
    if (!t.first) return { step: 'first', due: D.dateOf(d.at) || NS.today() };
    const base = D.localDate(t.first);
    for (const s of D.STEPS.slice(1)) if (!t[s.k]) return { step: s.k, due: NS.addDays(base, s.day) };
    return null; // chain finished
  };
  D.queue = () =>
    S.state.doors
      .map((d) => Object.assign({ door: d }, D.nextText(d)))
      .filter((x) => x.step)
      .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  D.dueTexts = () => D.queue().filter((x) => x.due <= NS.today());
  D.chainDone = (d) => !!(d.texts && d.texts.d9) && !d.replied && (d.status === 'pitched' || d.status === 'follow_up');
  D.sentOn = (date) => {
    const out = [];
    S.state.doors.forEach((d) => Object.entries(d.texts || {}).forEach(([k, iso]) => iso && D.localDate(iso) === date && out.push({ door: d, step: k, at: iso })));
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  };

  // ---------- walk-ins, revisits, clashes ----------
  D.walkIns = (date) =>
    S.state.doors.filter((d) => d.status === 'meeting' && D.dateOf(d.meetAt) === date).sort((a, b) => (a.meetAt < b.meetAt ? -1 : 1));
  D.missedMeetings = () => {
    const now = D.nowLocal();
    return S.state.doors.filter((d) => d.status === 'meeting' && d.meetAt && d.meetAt < now && D.dateOf(d.meetAt) < NS.today());
  };
  D.revisits = () =>
    S.state.doors.filter((d) => d.status === 'follow_up' && d.nextAt && d.nextAt <= NS.today()).sort((a, b) => (a.nextAt < b.nextAt ? -1 : 1));
  // hours (e.g. "16") on a day with 3+ walk-ins
  D.clashes = (date, extra) => {
    const by = {};
    D.walkIns(date).concat(extra ? [extra] : []).forEach((d) => {
      const h = D.timeOf(d.meetAt).slice(0, 2);
      if (h) (by[h] = by[h] || []).push(d);
    });
    return Object.entries(by).filter(([, list]) => list.length >= 3).map(([h, list]) => ({ hour: h, doors: list }));
  };
  D.loggedOn = (date) => S.state.doors.filter((d) => D.dateOf(d.at) === date);

  // ---------- numbers that fill the check-in by themselves ----------
  let memo = { ref: null, ver: -1, days: {} };
  D.ver = 0;
  S.autoDay = (date) => {
    const doors = (S.state && S.state.doors) || [];
    if (memo.ref !== doors || memo.ver !== D.ver) memo = { ref: doors, ver: D.ver, days: {} };
    if (!memo.days[date]) {
      memo.days[date] = {
        doors: doors.filter((d) => D.dateOf(d.at) === date).length,
        deposits: NS.sum(doors.filter((d) => d.depositPaid && (d.depositDate || D.dateOf(d.at)) === date), (d) => Number(d.depositAmount) || 0),
        texts: D.sentOn(date).length,
      };
    }
    return memo.days[date];
  };

  // ---------- saving ----------
  D.get = (id) => S.state.doors.find((d) => d.id === id);
  D.touch = (d) => {
    d.updated = new Date().toISOString();
    if (d.meetAt) d.meetTs = new Date(d.meetAt).getTime();
    D.ver++;
  };
  D.save = () => {
    D.ver++;
    S.save();
  };
})(window.NS);
