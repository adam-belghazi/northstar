window.NS = window.NS || {};

(function (NS) {
  NS.uid = () => Math.random().toString(36).slice(2, 10);

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  NS.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  // ---- dates (all stored as local YYYY-MM-DD strings) ----
  NS.iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  NS.today = () => NS.iso(new Date());
  NS.parse = (s) => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  NS.addDays = (s, n) => {
    const d = NS.parse(s);
    d.setDate(d.getDate() + n);
    return NS.iso(d);
  };
  NS.addMonths = (s, n) => {
    const d = NS.parse(s);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return NS.iso(d);
  };
  NS.diff = (a, b) => Math.round((NS.parse(b) - NS.parse(a)) / 864e5);
  NS.fmtDate = (s, opts) =>
    s ? NS.parse(s).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short' }) : '—';
  NS.rel = (s) => {
    if (!s) return '';
    const n = NS.diff(NS.today(), s);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n < 0) return `${-n}d overdue`;
    if (n < 14) return `in ${n}d`;
    return NS.fmtDate(s);
  };
  NS.isOverdue = (s) => !!s && s < NS.today();

  // ---- money: AED is pegged to USD, so conversion is exact and never stale ----
  NS.PEG = 3.6725;
  NS.convert = (v, from, to) => (from === to ? v : to === 'AED' ? v * NS.PEG : v / NS.PEG);
  NS.fmtMoney = (v, cur) => {
    if (v == null || isNaN(v)) return '—';
    const digits = cur === 'USD' && Math.abs(v) < 1000 ? 2 : 0;
    const frac = digits && Math.round(v * 100) % 100 !== 0 ? 2 : 0;
    const s = Number(v).toLocaleString('en-US', { minimumFractionDigits: frac, maximumFractionDigits: digits });
    return cur === 'USD' ? '$' + s : 'AED ' + s;
  };

  // ---- misc ----
  NS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  NS.sum = (arr, f) => arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0);
  NS.pct = (x) => Math.round((x || 0) * 100) + '%';
  NS.safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  NS.plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  NS.initials = (name) =>
    String(name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  NS.setPath = (o, path, v) => {
    const ks = path.split('.');
    let cur = o;
    for (let i = 0; i < ks.length - 1; i++) {
      if (cur[ks[i]] == null) cur[ks[i]] = {};
      cur = cur[ks[i]];
    }
    cur[ks[ks.length - 1]] = v;
  };
  NS.clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- icons ----
  const I = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    checkin: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M9 15.5l2 2 4-4"/>',
    bag: '<path d="M6 7h12l1 14H5L6 7z"/><path d="M9 7a3 3 0 016 0"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    ext: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    timeline: '<path d="M4 6h9M8 12h12M4 18h8"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    star: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    clip: '<path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    chevL: '<path d="M15 6l-6 6 6 6"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    coins: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>',
    door: '<path d="M5 21V4a1 1 0 011-1h12a1 1 0 011 1v17"/><path d="M3 21h18M14 12v.01"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    contrast: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor"/>',
  };
  NS.icon = (n, s = 18) =>
    `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;
})(window.NS);

// device checks used for iPhone Home Screen hints
(function (NS) {
  NS.isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  NS.isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
})(window.NS);
