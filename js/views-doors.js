// HQ · Door-to-door: Today, Doors, Texts, Calendar, Setup + the door form.
(function (NS) {
  const { S, A, C, V, D, esc, icon } = NS;
  const ui = NS.ui;
  const T = () => NS.today();
  const fab = () => `<button type="button" class="fab" data-a="newDoor" aria-label="Log a door">${icon('plus', 20)}<span>Door</span></button>`;
  const statusChip = (d) => NS.chip(D.status(d.status).label, D.status(d.status).color);
  const services = (d) => (d.services || []).map((k) => D.labelOf(D.SERVICES, k)).join(' · ');
  const aed = (n) => 'AED ' + Number(n || 0).toLocaleString('en-US');

  // small toast with an Undo button
  let undoT;
  NS.undoToast = (msg, fn) => {
    const el = document.getElementById('toast');
    el.innerHTML = `<span>${esc(msg)}</span><button type="button" class="toast-btn">Undo</button>`;
    el.classList.add('show', 'has-btn');
    el.querySelector('button').onclick = () => {
      fn();
      el.classList.remove('show', 'has-btn');
    };
    clearTimeout(undoT);
    undoT = setTimeout(() => el.classList.remove('show', 'has-btn'), 6000);
  };

  // ---------- rows ----------
  const doorRow = (d, extra = '') => `<button type="button" class="li door-li" data-a="editDoor" data-id="${d.id}">
      <span class="grow"><span class="li-t">${esc(d.name)}</span>
      <span class="li-s">${esc([d.area, d.type].filter(Boolean).join(' · '))}${services(d) ? ' · ' + esc(services(d)) : ''}${Number(d.price) > 0 ? ' · ' + aed(d.price) : ''}${extra}</span></span>
      ${statusChip(d)}</button>`;

  const textItem = (q, showDue) => {
    const d = q.door;
    const step = D.STEPS.find((s) => s.k === q.step);
    const late = q.due < T();
    return `<div class="titem">
      <div class="titem-h"><b>${esc(d.name)}</b><span class="dim small">${step.label}${showDue ? ' · ' + (q.due === T() ? 'today' : late ? NS.rel(q.due) : NS.fmtDate(q.due)) : ''}</span></div>
      <p class="titem-p">${esc(D.render(q.step, d))}</p>
      <div class="btn-row">
        <button type="button" class="btn pri sm" data-a="sendText" data-id="${d.id}" data-step="${q.step}">${icon('ext', 13)}<span>Send on WhatsApp</span></button>
        <button type="button" class="btn sm" data-a="composeText" data-id="${d.id}" data-step="${q.step}">${icon('edit', 13)}<span>Edit first</span></button>
        <button type="button" class="btn ghost sm" data-a="markReplied" data-id="${d.id}">They replied</button>
      </div></div>`;
  };

  const walkInRow = (d, missed) => `<div class="walkin ${missed ? 'missed' : ''}">
      <div class="walkin-t num">${missed ? NS.fmtDate(D.dateOf(d.meetAt)) : D.fmtTime(d.meetAt)}</div>
      <div class="grow"><b>${esc(d.name)}</b> <span class="dim">${esc(d.area || '')}</span>
        <div class="small muted">${d.askFor ? `Ask for <b>${esc(d.askFor)}</b>` : ''}${d.askFor && (d.bring || []).length ? ' · ' : ''}${(d.bring || []).length ? 'Bring: ' + (d.bring || []).map((b) => esc(D.labelOf(D.BRING, b))).join(', ') : ''}</div>
      </div>
      <div class="btn-row">
        ${D.phoneDigits(d.phone) ? `<a class="btn ghost sm icon-only" href="https://wa.me/${D.phoneDigits(d.phone)}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${icon('ext', 15)}</a>` : ''}
        <button type="button" class="btn sm" data-a="editDoor" data-id="${d.id}">${missed ? 'Update' : 'Open'}</button>
      </div></div>`;

  // ---------- TODAY ----------
  V.doorsToday = () => {
    const today = T();
    const cfg = D.cfg();
    const logged = D.loggedOn(today);
    const target = Number(cfg.target) || 0;
    const walk = D.walkIns(today);
    const missed = D.missedMeetings();
    const due = D.dueTexts();
    const revisits = D.revisits();
    const finished = S.state.doors.filter(D.chainDone);
    const auto = S.autoDay(today);
    const clashes = D.clashes(today);
    const hourLabel = (h) => D.fmtTime(`2000-01-01T${h}:00`).replace(':00', '');

    return `${NS.head('Door-to-door', NS.parse(today).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}
      <div class="grid g3">
        <div class="card stat" style="--c:var(--p1)"><div class="stat-l">Doors today</div>
          <div class="big num">${logged.length}${target ? `<span class="unit"> / ${target}</span>` : ''}</div>
          ${target ? `<div style="margin-top:12px">${NS.bar(logged.length / target, 'var(--p1)')}</div>` : ''}
          <div class="stat-s">${target ? (logged.length >= target ? 'Target hit. Anything more is a bonus.' : `${target - logged.length} to go`) : 'Set a daily target in Setup'}</div></div>
        ${NS.stat('Texts to send', due.length, due.length ? 'Clear them in 2 minutes' : 'All caught up')}
        ${NS.stat('Deposits today', aed(auto.deposits), NS.plural(auto.texts, 'text') + ' sent today')}
      </div>
      ${clashes.map((c) => `<div class="banner warn">${icon('alert', 16)}<span><b>${c.doors.length} walk-ins around ${hourLabel(c.hour)}.</b> ${c.doors.map((d) => esc(d.name)).join(', ')}. Move one so you're not rushing.</span></div>`).join('')}
      <div class="grid g2">
        <div class="card"><h3>${icon('door', 15)} Walk-ins today <span class="dim">${walk.length}</span></h3>
          ${walk.length ? `<div class="walkins">${walk.map((d) => walkInRow(d)).join('')}</div>` : '<div class="dim small">No walk-ins booked today.</div>'}
          ${missed.length ? `<h3 style="margin-top:22px">Missed, needs an update <span class="dim">${missed.length}</span></h3><div class="walkins">${missed.map((d) => walkInRow(d, true)).join('')}</div>` : ''}
        </div>
        <div class="card"><h3>${icon('ext', 15)} Texts to send <span class="dim">${due.length}</span></h3>
          ${due.length ? due.slice(0, 4).map((q) => textItem(q, true)).join('') + (due.length > 4 ? `<a class="btn sm" href="#/doors/texts">See all ${due.length}</a>` : '') : '<div class="dim small">Nothing due. New pitches with a phone number show up here automatically.</div>'}
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Revisits due <span class="dim">${revisits.length}</span></h3>
          <div class="list">${revisits.length ? revisits.map((d) => doorRow(d, d.nextAt === T() ? ' · due today' : ' · due since ' + NS.fmtDate(d.nextAt))).join('') : '<div class="dim small">No follow-up visits due.</div>'}</div>
          ${finished.length ? `<h3 style="margin-top:22px">Break-up sent, no reply <span class="dim">${finished.length}</span></h3>
            <div class="list">${finished.map((d) => `<div class="li static"><span class="grow"><span class="li-t">${esc(d.name)}</span><span class="li-s">Break-up text sent ${NS.fmtDate(D.localDate(d.texts.d9))}</span></span><button type="button" class="btn sm" data-a="setDoorStatus" data-id="${d.id}" data-v="dead">Mark dead</button></div>`).join('')}</div>` : ''}
        </div>
        <div class="card"><h3>Logged today <span class="dim">${logged.length}</span></h3>
          <div class="list">${logged.length ? logged.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).map((d) => doorRow(d, ' · ' + D.fmtTime(d.at))).join('') : '<div class="dim small">Tap “+ Door” after each visit.</div>'}</div>
        </div>
      </div>
      ${fab()}`;
  };

  // ---------- DOORS (all) ----------
  const matches = (d, q) => !q || [d.name, d.area, d.type, d.dmName, d.askFor, d.phone, d.notes].some((x) => String(x || '').toLowerCase().includes(q));
  const listHtml = () => {
    const f = ui.doorFilter || 'all';
    const q = (ui.doorQuery || '').trim().toLowerCase();
    const list = S.state.doors
      .filter((d) => (f === 'all' || d.status === f) && matches(d, q))
      .sort((a, b) => String(b.updated || b.at || '').localeCompare(String(a.updated || a.at || '')));
    return list.length
      ? `<div class="list">${list.map((d) => doorRow(d, d.status === 'meeting' && d.meetAt ? ' · walk-in ' + NS.fmtDate(D.dateOf(d.meetAt)) + ' ' + D.fmtTime(d.meetAt) : ' · ' + NS.fmtDate(D.dateOf(d.at)))).join('')}</div>`
      : `<div class="dim small pad">${S.state.doors.length ? 'No doors match.' : 'No doors yet. Tap “+ Door” after your first visit.'}</div>`;
  };
  V.doorsList = () => {
    const f = ui.doorFilter || 'all';
    const count = (k) => S.state.doors.filter((d) => k === 'all' || d.status === k).length;
    return `${NS.head('Doors', `${NS.plural(S.state.doors.length, 'door')} logged.`, `<button type="button" class="btn pri" data-a="newDoor">${icon('plus', 16)}<span>Door</span></button>`)}
      <div class="card">
        <input class="search" type="search" data-c="doorSearch" placeholder="Search name, area, contact, notes…" value="${esc(ui.doorQuery || '')}" aria-label="Search doors">
        <div class="chips" style="margin:14px 0 6px">${[{ k: 'all', label: 'All' }, ...D.STATUS]
          .map((s) => `<button type="button" class="fchip ${f === s.k ? 'on' : ''}" data-a="doorFilter" data-v="${s.k}">${s.label} <span>${count(s.k)}</span></button>`)
          .join('')}</div>
        <div id="door-list">${listHtml()}</div>
      </div>${fab()}`;
  };
  A.doorFilter = (el) => { ui.doorFilter = el.dataset.v; NS.render(); };
  document.addEventListener('input', (e) => {
    if (e.target.dataset && e.target.dataset.c === 'doorSearch') {
      ui.doorQuery = e.target.value;
      const box = document.getElementById('door-list');
      if (box) box.innerHTML = listHtml();
    }
  });
  C.doorSearch = () => {};

  // ---------- TEXTS ----------
  V.doorsTexts = () => {
    const q = D.queue();
    const due = q.filter((x) => x.due <= T());
    const later = q.filter((x) => x.due > T());
    const sent = D.sentOn(T());
    return `${NS.head('Texts', 'Pitched and follow-up doors with a phone number queue a WhatsApp text automatically. Follow-ups go out 2, 5 and 9 days after the first text.')}
      <div class="grid g2">
        <div class="card"><h3>Send now <span class="dim">${due.length}</span></h3>
          ${due.length ? due.map((x) => textItem(x, true)).join('') : '<div class="dim small">All caught up.</div>'}</div>
        <div class="stack-col">
          <div class="card"><h3>Coming up <span class="dim">${later.length}</span></h3>
            <div class="list">${later.length ? later.map((x) => `<button type="button" class="li" data-a="editDoor" data-id="${x.door.id}"><span class="when">${NS.rel(x.due)}</span><span class="grow"><span class="li-t">${esc(x.door.name)}</span><span class="li-s">${D.STEPS.find((s) => s.k === x.step).label}</span></span></button>`).join('') : '<div class="dim small">Nothing scheduled.</div>'}</div></div>
          <div class="card"><h3>Sent today <span class="dim">${sent.length}</span></h3>
            <div class="list">${sent.length ? sent.map((x) => `<div class="li static"><span class="grow"><span class="li-t">${esc(x.door.name)}</span><span class="li-s">${(D.STEPS.find((s) => s.k === x.step) || { label: x.step }).label} · ${new Date(x.at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span></span><button type="button" class="btn ghost sm" data-a="unsendText" data-id="${x.door.id}" data-step="${x.step}">Undo</button></div>`).join('') : '<div class="dim small">Nothing sent yet today.</div>'}</div></div>
        </div>
      </div>${fab()}`;
  };

  const markSent = (d, step) => {
    d.texts = d.texts || {};
    d.texts[step] = new Date().toISOString();
    D.touch(d);
    D.save();
    NS.render();
    NS.undoToast(`Marked as sent: ${d.name}`, () => {
      delete d.texts[step];
      D.touch(d);
      D.save();
      NS.render();
    });
  };
  A.sendText = (el) => {
    const d = D.get(el.dataset.id);
    if (!d) return;
    window.open(D.waLink(d, D.render(el.dataset.step, d)), '_blank', 'noopener');
    markSent(d, el.dataset.step);
  };
  A.composeText = (el) => {
    const d = D.get(el.dataset.id);
    const step = el.dataset.step;
    NS.openModal({
      title: 'Text ' + d.name,
      body: `<label class="fld full"><span class="fl">Message</span><textarea name="msg" rows="6">${esc(D.render(step, d))}</textarea></label>
        <p class="dim small">Opens WhatsApp with this text and marks it as sent. Edit the default wording in Doors → Setup → Templates.</p>`,
      saveLabel: 'Open WhatsApp',
      onSave: (form) => {
        window.open(D.waLink(d, form.elements.msg.value), '_blank', 'noopener');
        setTimeout(() => markSent(d, step), 50);
      },
    });
  };
  A.unsendText = (el) => {
    const d = D.get(el.dataset.id);
    if (!d || !d.texts) return;
    delete d.texts[el.dataset.step];
    D.touch(d);
    D.save();
    NS.render();
  };
  A.markReplied = (el) => {
    const d = D.get(el.dataset.id);
    if (!d) return;
    d.replied = true;
    D.touch(d);
    D.save();
    NS.render();
    NS.undoToast(`${d.name} replied. Follow-ups stopped.`, () => { d.replied = false; D.touch(d); D.save(); NS.render(); });
  };
  A.setDoorStatus = (el) => {
    const d = D.get(el.dataset.id);
    if (!d) return;
    const before = d.status;
    d.status = el.dataset.v;
    D.touch(d);
    D.save();
    NS.render();
    NS.undoToast(`${d.name}: ${D.status(d.status).label}`, () => { d.status = before; D.touch(d); D.save(); NS.render(); });
  };

  // ---------- CALENDAR ----------
  V.doorsCalendar = () => {
    const evs = [];
    S.state.doors.forEach((d) => {
      if (d.meetAt && (d.status === 'meeting' || d.status === 'closed'))
        evs.push({ date: D.dateOf(d.meetAt), label: `${D.fmtTime(d.meetAt)} ${d.name}`, color: 'var(--p1)', done: d.status !== 'meeting', attrs: `data-a="editDoor" data-id="${d.id}"` });
      if (d.status === 'follow_up' && d.nextAt) evs.push({ date: d.nextAt, label: '↻ ' + d.name, color: 'var(--p3)', attrs: `data-a="editDoor" data-id="${d.id}"` });
    });
    const cloud = NS.Cloud.mode === 'cloud';
    let sub = '<p class="muted small">The phone calendar needs cloud sync.</p>';
    if (cloud) {
      const feed = `${location.host}/api/calendar?t=${D.calToken()}`;
      sub = `<p class="muted small">Adds a separate <b>Northstar · Doors</b> calendar to your iPhone with every walk-in and revisit. Alerts are set for 30 and 15 minutes before each walk-in. It updates by itself.</p>
        <div class="btn-row"><a class="btn pri" href="webcal://${esc(feed)}">${icon('cal', 15)}<span>Add to iPhone Calendar</span></a>
        <button type="button" class="btn" data-a="copyFeed" data-v="https://${esc(feed)}">Copy link</button>
        <button type="button" class="btn ghost" data-a="resetFeed">Reset link</button></div>
        <p class="dim small" style="margin-top:10px">On a Mac or Google Calendar: “Subscribe to calendar” or “From URL” and paste the link. Anyone with the link can see your walk-ins, so reset it if you share it by mistake.</p>`;
    }
    return `${NS.head('Doors calendar', 'Walk-ins and revisits only. Your other plans stay separate.')}
      ${NS.calendar('doors', evs)}
      <div class="legend" style="margin:12px 0 var(--gap)"><span><span class="dot" style="--c:var(--p1)"></span>Walk-in</span><span><span class="dot" style="--c:var(--p3)"></span>↻ Revisit</span></div>
      <div class="card"><h3>${icon('cal', 15)} On your phone</h3>${sub}</div>${fab()}`;
  };
  A.copyFeed = async (el) => {
    try { await navigator.clipboard.writeText(el.dataset.v); NS.toast('Link copied'); } catch (e) { NS.toast(el.dataset.v); }
  };
  A.resetFeed = () =>
    NS.confirm('Reset the calendar link?', 'The old link stops working. You will need to subscribe again on your phone.', () => {
      S.state.settings.doors = Object.assign(D.cfg(), { calToken: '' });
      D.calToken();
    }, 'Reset');

  // ---------- SETUP ----------
  V.doorsSetup = () => {
    const cfg = D.cfg();
    const prices = cfg.prices || {};
    return `${NS.head('Door-to-door setup', 'Targets, prices, message templates and importing old doors.')}
      <div class="grid g2">
        <div class="card"><h3>Daily target</h3>
          <label class="fld"><span class="fl">Doors per day</span><input type="number" min="0" step="1" data-c="doorCfg" data-k="target" value="${esc(cfg.target)}"></label>
          <p class="dim small" style="margin-top:8px">Shows as a progress bar on Doors → Today.</p>
          <h3 style="margin-top:26px">Your name in texts</h3>
          <p class="muted small">Templates say “it's ${esc(S.state.settings.name || 'me')}”. Change it in <a class="linkish" href="#/settings">Settings → Your first name</a>.</p>
        </div>
        <div class="card"><h3>Price list</h3>
          <p class="dim small" style="margin-bottom:12px">Standard price per unit. Picking services fills the quote (price × quantity). You can still change it on each door.</p>
          <div class="fgrid">${D.SERVICES.map((s) => `<label class="fld"><span class="fl">${s.label}</span><div class="aed"><input type="number" min="0" step="10" data-c="doorPrice" data-k="${s.k}" value="${esc(prices[s.k] ?? '')}" placeholder="0"><span>AED</span></div></label>`).join('')}</div>
        </div>
      </div>
      <div class="card"><h3>WhatsApp templates</h3>
        <p class="dim small" style="margin-bottom:14px">Placeholders: <code>{name}</code> (who you'll ask for) · <code>{me}</code> · <code>{business}</code> · <code>{service}</code> · <code>{quote}</code> (“It's AED 500 for 5. ”). The first text uses the template for the first objection you ticked, or the general one.</p>
        <div class="tpl-grid">${D.TEMPLATE_LABELS.map(([k, label]) => {
          const custom = (cfg.templates || {})[k];
          return `<label class="fld"><span class="fl">${esc(label)} ${custom ? `<button type="button" class="linkish small" data-a="resetTpl" data-k="${k}">Reset</button>` : ''}</span><textarea rows="3" data-c="doorTpl" data-k="${k}">${esc(D.tpl(k))}</textarea></label>`;
        }).join('')}</div>
      </div>
      <div class="card"><h3>Import old doors</h3>
        <p class="muted small">Pick a CSV export (from Notion, Sheets or Excel). You'll match its columns to Northstar fields before anything is imported. Doors with the same name and area are skipped.</p>
        <label class="btn" style="margin-top:12px">${icon('upload', 15)}<span>Choose CSV file</span><input type="file" accept=".csv,text/csv" hidden data-c="doorCsv"></label>
      </div>`;
  };
  C.doorCfg = (el) => { D.setCfg({ [el.dataset.k]: el.value === '' ? 0 : Number(el.value) }); NS.toast('Saved'); };
  C.doorPrice = (el) => {
    const prices = Object.assign({}, D.cfg().prices, { [el.dataset.k]: el.value === '' ? null : Number(el.value) });
    D.setCfg({ prices });
    NS.toast('Saved');
  };
  C.doorTpl = (el) => {
    const t = Object.assign({}, D.cfg().templates);
    const v = el.value.trim();
    if (!v || v === D.TEMPLATES[el.dataset.k]) delete t[el.dataset.k];
    else t[el.dataset.k] = v;
    D.setCfg({ templates: t });
    NS.toast('Template saved');
  };
  A.resetTpl = (el) => {
    const t = Object.assign({}, D.cfg().templates);
    delete t[el.dataset.k];
    D.setCfg({ templates: t });
    NS.render();
  };

  // ---------- CSV import ----------
  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = '';
    let q = false;
    const src = text.replace(/^﻿/, '');
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim())) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
    return rows;
  };
  const IMPORT = [
    ['name', 'Business name', /business|name|shop|company|store/i],
    ['area', 'Area', /area|location|district|zone|neighbou?rhood/i],
    ['type', 'Business type', /type|category|industry/i],
    ['at', 'Date visited', /date|visited|when|time|created/i],
    ['status', 'Status', /status|stage|result|outcome/i],
    ['dmName', 'Contact name', /contact|person|manager|owner|ask/i],
    ['phone', 'Phone', /phone|mobile|whats|number|tel/i],
    ['email', 'Email', /mail/i],
    ['instagram', 'Instagram', /insta|ig\b|handle/i],
    ['services', 'Service pitched', /service|product|pitch/i],
    ['price', 'Price quoted', /price|quote|amount|aed|value/i],
    ['notes', 'Notes', /note|comment|remark|detail/i],
  ];
  const mapStatus = (s) => {
    s = String(s || '').toLowerCase();
    if (/close|won|paid|sold|deal/.test(s)) return 'closed';
    if (/dead|lost|no\b|not interested|reject/.test(s)) return 'dead';
    if (/meet|appoint|walk/.test(s)) return 'meeting';
    if (/follow|call back|later/.test(s)) return 'follow_up';
    if (/pitch|interested|info/.test(s)) return 'pitched';
    return s ? 'pitched' : 'cold';
  };
  const mapDate = (s) => {
    s = String(s || '').trim();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}T${(m[4] || '10').padStart(2, '0')}:${m[5] || '00'}`;
    }
    const t = Date.parse(s);
    if (!isNaN(t)) {
      const d = new Date(t);
      return `${NS.iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return `${T()}T10:00`;
  };
  const mapServices = (s) => D.SERVICES.filter((x) => new RegExp(x.label.split(' ')[0], 'i').test(String(s || ''))).map((x) => x.k);

  C.doorCsv = (el) => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      if (rows.length < 2) return NS.toast("That file doesn't have any rows");
      const head = rows[0].map((h) => h.trim());
      const data = rows.slice(1);
      const guess = {};
      IMPORT.forEach(([k, , re]) => {
        const i = head.findIndex((h, idx) => re.test(h) && !Object.values(guess).includes(idx));
        guess[k] = i;
      });
      const sel = (k) => `<select name="map_${k}"><option value="-1">— skip —</option>${head.map((h, i) => `<option value="${i}" ${guess[k] === i ? 'selected' : ''}>${esc(h || 'Column ' + (i + 1))}</option>`).join('')}</select>`;
      NS.openModal({
        title: `Import ${NS.plural(data.length, 'door')}`,
        wide: true,
        body: `<p class="muted small">Match each Northstar field to a column in your file. I've guessed where I could.</p>
          <div class="fgrid" style="margin-top:12px">${IMPORT.map(([k, label]) => `<label class="fld"><span class="fl">${label}</span>${sel(k)}</label>`).join('')}</div>
          <p class="dim small" style="margin-top:12px">Dates like 05/10/2026 are read as day/month/year. Status words like “closed”, “lost” and “follow up” map to Northstar statuses. Imported doors don't trigger texts until you edit them.</p>`,
        saveLabel: 'Import',
        onSave: (form) => {
          const idx = Object.fromEntries(IMPORT.map(([k]) => [k, Number(form.elements['map_' + k].value)]));
          if (idx.name < 0) { NS.toast('Pick the column with the business name'); return false; }
          const get = (r, k) => (idx[k] >= 0 ? String(r[idx[k]] || '').trim() : '');
          const exists = new Set(S.state.doors.map((d) => (d.name + '|' + (d.area || '')).toLowerCase()));
          let added = 0;
          let skipped = 0;
          data.forEach((r) => {
            const name = get(r, 'name');
            if (!name) return;
            const area = get(r, 'area');
            const key = (name + '|' + area).toLowerCase();
            if (exists.has(key)) { skipped++; return; }
            exists.add(key);
            const price = parseFloat(get(r, 'price').replace(/[^\d.]/g, ''));
            const d = {
              id: NS.uid(), name, area, type: get(r, 'type'), at: mapDate(get(r, 'at')), created: new Date().toISOString(),
              status: mapStatus(get(r, 'status')), dmName: get(r, 'dmName'), phone: get(r, 'phone'), email: get(r, 'email'),
              instagram: get(r, 'instagram'), services: mapServices(get(r, 'services')), qty: 1, price: isNaN(price) ? null : price,
              notes: get(r, 'notes'), objections: [], imported: true, replied: false,
              // don't flood the text queue with old doors: treat their chain as already handled
              texts: { first: new Date().toISOString(), d2: new Date().toISOString(), d5: new Date().toISOString(), d9: new Date().toISOString() },
            };
            D.touch(d);
            S.state.doors.push(d);
            added++;
          });
          D.ver++;
          NS.toast(`Imported ${NS.plural(added, 'door')}${skipped ? `, skipped ${NS.plural(skipped, 'duplicate')}` : ''}`);
          ui.route = 'doors/list';
          location.hash = '#/doors/list';
        },
      });
    };
    reader.readAsText(file);
  };

  // ---------- door form ----------
  const doorFields = (d) => {
    const areas = [...new Set(S.state.doors.map((x) => x.area).filter(Boolean))].sort();
    return {
      name: { k: 'name', label: 'Business name', full: true, ph: 'Start typing. Existing doors show up below.' },
      area: { k: 'area', label: 'Area', type: 'datalist', options: areas, ph: 'e.g. JLT' },
      at: { k: 'at', label: 'When', type: 'datetime-local' },
      type: { k: 'type', label: 'Business type', type: 'radio', full: true, options: D.TYPES },
      dm: { k: 'dm', label: 'Reached the decision-maker?', type: 'radio', options: [{ k: 'yes', label: 'Yes' }, { k: 'no', label: 'No' }] },
      dmRole: { k: 'dmRole', label: 'Who did you speak to?', type: 'radio', options: D.ROLES },
      dmName: { k: 'dmName', label: 'Their name (optional)', ph: 'e.g. Dani' },
      services: { k: 'services', label: 'Service pitched', type: 'chips', full: true, options: D.SERVICES },
      qty: { k: 'qty', label: 'Quantity', type: 'number' },
      price: { k: 'price', label: 'Price quoted (AED)', type: 'number', hint: 'Fills from your price list until you type your own.' },
      notes: { k: 'notes', label: 'Pitch notes', type: 'textarea', full: true, rows: 3, hint: 'Tip: tap the microphone on your phone keyboard to dictate.' },
      objections: { k: 'objections', label: 'Objections', type: 'chips', full: true, options: D.OBJECTIONS },
      objectionOther: { k: 'objectionOther', label: 'Other objection', full: true },
      licence: { k: 'licence', label: 'Needs a trade licence / invoice', type: 'check' },
      status: { k: 'status', label: 'Status', type: 'radio', full: true, options: D.STATUS },
      meetAt: { k: 'meetAt', label: 'Walk-in date & time', type: 'datetime-local' },
      askFor: { k: 'askFor', label: 'Ask for', ph: 'Name' },
      bring: { k: 'bring', label: 'Bring', type: 'chips', full: true, options: D.BRING },
      nextAt: { k: 'nextAt', label: 'Come back on', type: 'date' },
      phone: { k: 'phone', label: 'Phone / WhatsApp', type: 'tel', ph: '05x xxx xxxx' },
      email: { k: 'email', label: 'Email', type: 'email' },
      instagram: { k: 'instagram', label: 'Instagram', ph: '@handle' },
      depositPaid: { k: 'depositPaid', label: 'Deposit paid', type: 'check' },
      depositAmount: { k: 'depositAmount', label: 'Deposit (AED)', type: 'number' },
      depositDate: { k: 'depositDate', label: 'Paid on', type: 'date' },
      replied: { k: 'replied', label: 'They replied (stops follow-up texts)', type: 'check' },
    };
  };

  NS.editDoor = (id, preset = {}) => {
    const existing = D.get(id);
    const cfg = D.cfg();
    ui.draft = existing
      ? NS.clone(existing)
      : Object.assign({ id: NS.uid(), name: '', area: cfg.lastArea || '', at: D.nowLocal(), type: '', dm: '', dmRole: '', services: [], qty: 1, price: null, objections: [], status: 'pitched', bring: [], texts: {}, replied: false, depositPaid: false }, preset);
    const f = doorFields(ui.draft);
    const d = ui.draft;
    const fl = (k) => NS.field(f[k], d);
    const cloud = NS.Cloud.mode === 'cloud';
    const sec = (title, inner, cls = '', open = true) => `<details class="dsec ${cls}" ${open ? 'open' : ''}><summary>${title}</summary><div class="fgrid">${inner}</div></details>`;
    const texts = d.texts || {};
    const sentList = D.STEPS.filter((s) => texts[s.k]).map((s) => `${s.label}: ${NS.fmtDate(D.localDate(texts[s.k]))}`).join(' · ');

    const body = `<div class="door-form ${existing ? '' : 'is-new'}">
      <div class="fgrid">${fl('name')}<div class="full" id="dupes"></div>${fl('area')}${fl('at')}${fl('type')}</div>
      ${sec('Pitch', fl('status') + fl('dm') + `<div class="if-dm fgrid-span">${fl('dmRole')}${fl('dmName')}</div>` + fl('services') + fl('qty') + fl('price') + fl('notes') + fl('objections') + `<div class="if-other full">${fl('objectionOther')}</div>` + fl('licence'))}
      <div class="if-meeting">${sec('Walk-in', fl('meetAt') + fl('askFor') + fl('bring') + '<div class="full" id="clash"></div>')}</div>
      <div class="if-followup">${sec('Next visit', fl('nextAt'))}</div>
      ${sec('Contact', fl('phone') + fl('email') + fl('instagram') + (cloud ? `<div class="fld full"><span class="fl">Business card photo</span><div class="btn-row">
          <label class="btn sm">${icon('upload', 14)}<span>${d.cardPath ? 'Replace photo' : 'Take / add photo'}</span><input type="file" accept="image/*" capture="environment" hidden data-c="doorCard"></label>
          ${d.cardPath ? `<button type="button" class="linkish small" data-a="openFile" data-path="${esc(d.cardPath)}">${icon('clip', 12)} View card</button>` : ''}<span id="card-st" class="dim small"></span></div></div>` : ''), '', !!(d.phone || d.email || d.instagram) || !existing)}
      ${sec('Deposit', fl('depositPaid') + `<div class="if-deposit fgrid-span">${fl('depositAmount')}${fl('depositDate')}</div>`, '', !!d.depositPaid || d.status === 'closed')}
      ${existing ? sec('Texts', fl('replied') + `<div class="fld full"><span class="dim small">${sentList || 'No texts sent yet.'}</span></div>`, '', false) : ''}
    </div>`;

    NS.openModal({
      title: existing ? d.name : 'Log a door',
      wide: true,
      body,
      saveLabel: existing ? 'Save' : 'Save door',
      onSave: (form) => {
        const v = NS.readForm(form, Object.values(f));
        if (!v.name) { NS.toast('Add the business name'); return false; }
        if (v.status === 'meeting' && !v.meetAt) { NS.toast('Pick the walk-in date and time'); return false; }
        const door = Object.assign(ui.draft, v);
        if (door.depositPaid && !door.depositDate) door.depositDate = T();
        if (!door.created) door.created = new Date().toISOString();
        D.touch(door);
        if (existing) Object.assign(existing, door);
        else S.state.doors.push(door);
        if (door.area) S.state.settings.doors = Object.assign(D.cfg(), { lastArea: door.area });
        D.save();
        const clash = door.status === 'meeting' && D.clashes(D.dateOf(door.meetAt)).find((c) => c.doors.some((x) => x.id === door.id));
        if (clash) NS.toast(`Heads up: ${clash.doors.length} walk-ins in the same hour`);
        else if (!existing && D.nextText(door) && D.nextText(door).step === 'first') NS.toast('First text is ready in Texts');
        else NS.toast(existing ? 'Saved' : 'Door logged');
      },
      onDelete: existing ? () => (S.state.doors = S.state.doors.filter((x) => x.id !== id), D.ver++) : null,
    });
    // keep the price in step with services × quantity until it's typed by hand
    ui.priceTouched = !!(existing && existing.price != null && existing.price !== D.autoPrice(existing.services, existing.qty));
    doorFormLive();
  };

  const doorFormLive = () => {
    const form = document.getElementById('mform');
    if (!form || !form.querySelector('.door-form')) return;
    const name = form.elements.name;
    name.setAttribute('autocomplete', 'off');
    const updDupes = () => {
      const q = name.value.trim().toLowerCase();
      const box = document.getElementById('dupes');
      if (!box) return;
      const hits = q.length < 2 ? [] : S.state.doors.filter((x) => x.id !== ui.draft.id && String(x.name).toLowerCase().includes(q)).slice(0, 4);
      box.innerHTML = hits.length
        ? `<div class="dupes"><span class="dim small">Already logged:</span>${hits.map((x) => `<button type="button" class="dupe" data-a="openDupe" data-id="${x.id}"><b>${esc(x.name)}</b> <span class="dim">${esc(x.area || '')} · ${D.status(x.status).label}</span></button>`).join('')}</div>`
        : '';
    };
    name.addEventListener('input', updDupes);
    const recalc = () => {
      if (ui.priceTouched) return;
      const svc = [...form.querySelectorAll('input[name="services"]:checked')].map((i) => i.value);
      const p = D.autoPrice(svc, form.elements.qty.value);
      if (p != null) form.elements.price.value = p;
    };
    form.addEventListener('change', (e) => {
      if (e.target.name === 'services' || e.target.name === 'qty') recalc();
      if (e.target.name === 'meetAt' || e.target.name === 'status') updClash();
    });
    form.elements.qty.addEventListener('input', recalc);
    form.elements.price.addEventListener('input', () => (ui.priceTouched = true));
    const updClash = () => {
      const box = document.getElementById('clash');
      const at = form.elements.meetAt.value;
      if (!box) return;
      const others = at ? D.walkIns(D.dateOf(at)).filter((x) => x.id !== ui.draft.id && D.timeOf(x.meetAt).slice(0, 2) === D.timeOf(at).slice(0, 2)) : [];
      box.innerHTML = others.length >= 2 ? `<div class="banner warn">${icon('alert', 15)}<span>That makes <b>${others.length + 1} walk-ins</b> in the same hour: ${others.map((x) => esc(x.name)).join(', ')}.</span></div>` : '';
    };
    updClash();
    if (!ui.draft.name) setTimeout(() => name.focus(), 60);
  };
  A.openDupe = (el) => { NS.closeModal(); NS.editDoor(el.dataset.id); };
  A.editDoor = (el) => NS.editDoor(el.dataset.id);
  A.newDoor = () => NS.editDoor(null);

  C.doorCard = async (el) => {
    const file = el.files && el.files[0];
    el.value = '';
    if (!file) return;
    const st = document.getElementById('card-st');
    if (st) st.textContent = 'Uploading…';
    try {
      const row = await NS.Cloud.upload('door', ui.draft.id, file);
      ui.draft.cardPath = row.path;
      if (st) st.textContent = 'Photo added. Save to keep it.';
    } catch (e) {
      if (st) st.textContent = '';
      NS.toast('Upload failed: ' + e.message);
    }
  };

  // ---------- home screen card ----------
  NS.doorsHomeCard = () => {
    const today = T();
    const walk = D.walkIns(today);
    const now = D.nowLocal();
    const next = walk.find((d) => d.meetAt >= now);
    const due = D.dueTexts().length;
    const logged = D.loggedOn(today).length;
    const target = Number(D.cfg().target) || 0;
    return `<a class="card link-card" href="#/doors/today">
      <h3>${icon('door', 15)} Door-to-door today</h3>
      <div class="dh-row">
        <div><div class="big num">${walk.length}</div><div class="dim small">${walk.length === 1 ? 'walk-in' : 'walk-ins'}</div></div>
        <div><div class="big num">${due}</div><div class="dim small">texts to send</div></div>
        <div><div class="big num">${logged}${target ? `<span class="unit">/${target}</span>` : ''}</div><div class="dim small">doors</div></div>
      </div>
      ${next ? `<div class="small" style="margin-top:12px">Next: <b>${esc(next.name)}</b> at ${D.fmtTime(next.meetAt)}${next.askFor ? ` · ask for ${esc(next.askFor)}` : ''}</div>` : ''}
    </a>`;
  };
})(window.NS);
