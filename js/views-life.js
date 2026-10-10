(function (NS) {
  const { S, A, C, V, esc, icon } = NS;
  const ui = NS.ui;

  // =====================================================================
  // GOALS
  // =====================================================================
  NS.areaCard = (a, compact) => {
    const s = S.areaStats(a.k);
    const week = s.hasMetrics ? (s.week == null ? 'No check-ins this week' : `This week ${NS.pct(s.week)}`) : 'From goals only';
    return `<button type="button" class="card area ${ui.goalArea === a.k ? 'sel' : ''} ${compact ? 'compact' : ''}" style="--c:${a.color}" data-a="${compact ? 'goArea' : 'goalArea'}" data-v="${a.k}">
      <div class="area-top"><span class="area-name">${a.label}</span><span class="lvl num">LV ${s.level}</span></div>
      <div class="xpbar"><i style="width:${s.inLevel}%"></i></div>
      <div class="area-meta"><span class="num">${s.inLevel}/100 XP</span><span>${week}</span></div>
      ${compact ? '' : `<div class="area-foot">${s.active} active · ${s.done} done</div>`}
    </button>`;
  };

  const goalCard = (g) => {
    const a = S.find(S.AREAS, g.area);
    const st = S.find(S.GOAL_STATUS, g.status);
    const p = S.goalPct(g);
    const subs = g.subtasks || [];
    const late = g.status !== 'done' && NS.isOverdue(g.due);
    return `<div class="gcard" style="--c:${a.color}">
      <div class="gc-top">${NS.chip(st.label, st.color)}<span class="spacer"></span>
        ${g.due ? `<span class="small ${late ? 'red' : 'muted'}">${icon('cal', 13)} ${g.status === 'done' ? NS.fmtDate(g.due) : NS.rel(g.due)}</span>` : ''}
        <button type="button" class="btn ghost sm icon-only" data-a="editGoal" data-id="${g.id}" aria-label="Edit goal">${icon('edit', 14)}</button>
      </div>
      <button type="button" class="gc-title" data-a="editGoal" data-id="${g.id}">${esc(g.title)}</button>
      ${g.where ? `<div class="where"><span>Where are we?</span>${esc(g.where)}</div>` : ''}
      <div class="prog">${NS.bar(p, a.color, 'game')}<span class="num">${NS.pct(p)}</span></div>
      ${subs.length
        ? `<div class="mini-subs">${subs
            .slice(0, 5)
            .map(
              (s) => `<label class="msub ${s.done ? 'done' : ''}"><input type="checkbox" data-a="toggleGoalSub" data-id="${g.id}" data-sid="${s.id}" ${s.done ? 'checked' : ''}>
                <span>${esc(s.title)}</span>${s.due ? `<em>${NS.fmtDate(s.due)}</em>` : ''}</label>`
            )
            .join('')}${subs.length > 5 ? `<button type="button" class="linkish small" data-a="editGoal" data-id="${g.id}">+${subs.length - 5} more</button>` : ''}</div>`
        : ''}
    </div>`;
  };

  V.goals = () => {
    const mode = ui.goalView || 'board';
    const area = ui.goalArea || 'all';
    const goals = S.state.goals.filter((g) => area === 'all' || g.area === area);
    const actions = `${NS.seg(
      [
        { k: 'board', label: 'Board', icon: 'grid' },
        { k: 'timeline', label: 'Timeline', icon: 'timeline' },
        { k: 'calendar', label: 'Calendar', icon: 'cal' },
      ],
      mode,
      'goalView'
    )}<button type="button" class="btn pri" data-a="newGoal">${icon('plus', 16)}<span>Goal</span></button>`;

    let body;
    if (!S.state.goals.length) {
      body = NS.emptyState('No goals yet. Start with one per area — health, relationship, learning, habits.', `<button class="btn pri" data-a="newGoal">${icon('plus', 16)}<span>Add your first goal</span></button>`);
    } else if (mode === 'timeline') {
      body = `<div class="card flush">${NS.gantt(
        goals.map((g) => {
          const a = S.find(S.AREAS, g.area);
          return { label: g.title, sub: a.label, start: g.start, end: g.due, color: a.color, pct: S.goalPct(g), attrs: `data-a="editGoal" data-id="${g.id}"` };
        }),
        'goalsGantt'
      )}</div>`;
    } else if (mode === 'calendar') {
      const evs = [];
      goals.forEach((g) => {
        const a = S.find(S.AREAS, g.area);
        if (g.due) evs.push({ date: g.due, label: '◆ ' + g.title, color: a.color, done: g.status === 'done', attrs: `data-a="editGoal" data-id="${g.id}"` });
        (g.subtasks || []).forEach((s) => s.due && evs.push({ date: s.due, label: s.title, color: a.color, done: s.done, attrs: `data-a="editGoal" data-id="${g.id}"` }));
      });
      body = NS.calendar('goals', evs);
    } else {
      const areas = area === 'all' ? S.AREAS : [S.find(S.AREAS, area)];
      body = areas
        .map((a) => {
          const list = goals.filter((g) => g.area === a.k).sort((x, y) => (x.status === 'done') - (y.status === 'done'));
          return `<section class="sect"><div class="sect-h" style="--c:${a.color}"><span class="dot"></span><h2>${a.label}</h2><span class="dim small">${list.length}</span><span class="spacer"></span>
            <button type="button" class="btn ghost sm" data-a="newGoal" data-area="${a.k}">${icon('plus', 14)}<span>Add</span></button></div>
            ${list.length ? `<div class="gc-grid">${list.map(goalCard).join('')}</div>` : `<div class="dim small pad">Nothing here yet.</div>`}</section>`;
        })
        .join('');
    }

    return `${NS.head('Goals', 'Every goal, where it stands, and when it lands.', actions)}
      <div class="area-grid">${S.AREAS.map((a) => NS.areaCard(a)).join('')}</div>
      ${area !== 'all' ? `<div class="filter-note">Showing ${S.find(S.AREAS, area).label} only · <button type="button" class="linkish" data-a="goalArea" data-v="all">Show all</button></div>` : ''}
      ${body}`;
  };

  A.goalView = (el) => { ui.goalView = el.dataset.v; NS.render(); };
  A.goalArea = (el) => { ui.goalArea = ui.goalArea === el.dataset.v ? 'all' : el.dataset.v; NS.render(); };
  A.goArea = (el) => { ui.goalArea = el.dataset.v; location.hash = '#/life/goals'; };
  A.toggleGoalSub = (el) => {
    const g = S.state.goals.find((x) => x.id === el.dataset.id);
    const s = g && g.subtasks.find((x) => x.id === el.dataset.sid);
    if (!s) return;
    s.done = !s.done;
    if (g.status === 'not_started' && s.done) g.status = 'in_progress';
    S.save();
    NS.render();
    if (g.subtasks.every((x) => x.done) && g.status !== 'done') NS.toast('All subtasks done — open the goal and mark it Done.');
    else if (s.done) NS.toast('+10 XP');
  };

  const goalFields = () => [
    { k: 'title', label: 'Goal', full: true, ph: 'e.g. Train 4× a week for 12 weeks' },
    { k: 'area', label: 'Area', type: 'select', options: S.AREAS },
    { k: 'status', label: 'Status', type: 'select', options: S.GOAL_STATUS },
    { k: 'start', label: 'Start', type: 'date' },
    { k: 'due', label: 'Due', type: 'date' },
    { k: 'where', label: 'Where are we?', full: true, ph: 'One line on where this stands right now' },
    { k: 'manualPct', label: 'Progress % (only used when there are no subtasks)', type: 'number' },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
  NS.editGoal = (id, preset = {}) => {
    const existing = S.state.goals.find((g) => g.id === id);
    ui.draft = existing
      ? NS.clone(existing)
      : Object.assign({ id: NS.uid(), title: '', area: ui.goalArea && ui.goalArea !== 'all' ? ui.goalArea : 'health', status: 'not_started', start: NS.today(), due: '', where: '', notes: '', manualPct: 0, subtasks: [], created: NS.today() }, preset);
    const f = goalFields();
    NS.openModal({
      title: existing ? 'Edit goal' : 'New goal',
      wide: true,
      body: NS.fields(f, ui.draft) + NS.subEditor('goal'),
      onSave: (form) => {
        const vals = NS.readForm(form, f);
        if (!vals.title) { NS.toast('Give the goal a name'); return false; }
        const g = Object.assign(ui.draft, vals);
        g.subtasks = g.subtasks.filter((s) => s.title.trim());
        if (existing) Object.assign(existing, g);
        else S.state.goals.push(g);
      },
      onDelete: existing ? () => (S.state.goals = S.state.goals.filter((g) => g.id !== id)) : null,
    });
  };
  A.editGoal = (el) => NS.editGoal(el.dataset.id);
  A.newGoal = (el) => NS.editGoal(null, el.dataset.area ? { area: el.dataset.area } : {});

  // =====================================================================
  // DAILY CHECK-IN — items come from the editable config ("Edit items" on the page)
  // =====================================================================
  const ciDate = () => ui.ciDate || NS.today();
  const ciRec = () => S.state.checkins[ciDate()] || {};
  const RANGES = [7, 14, 30];
  const ciRange = () => ui.ciRange || 7;
  const autoNote = (txt) => `<em class="auto-note">${icon('check', 11)} ${txt}</em>`;
  const newRec = () => ({ hours: {} });

  const ciItem = (it, c, auto) => {
    const v = c[it.id];
    const x = S.ciExtraKey(it);
    const mini = (k, type, attrs = '') => `<input class="mini-in" type="${type}" data-c="ci" data-k="${k}" value="${esc(c[k] ?? '')}" ${attrs}>`;
    const tog = (extra = '', note = '') =>
      `<label class="tog"><input type="checkbox" data-c="ci" data-k="${it.id}" ${v ? 'checked' : ''}><span class="sw"></span><span class="tog-l">${esc(it.label)}${note}</span>${extra}</label>`;
    switch (it.type) {
      case 'toggle':
        return tog();
      case 'toggle_time':
        return tog(mini(x, 'time', `aria-label="${esc(it.label)}: time"`));
      case 'toggle_number': {
        const note = it.auto === 'texts' && auto.texts ? autoNote(`${NS.plural(auto.texts, 'WhatsApp text')} sent from Doors`) : '';
        return tog(mini(x, 'number', 'min="0" placeholder="#" aria-label="How many"'), note);
      }
      case 'number':
        return `<div class="row-in"><span>${esc(it.label)}</span>${mini(it.id, 'number', 'step="0.5" min="0" placeholder="0"')}</div>`;
      case 'money': {
        const dep = it.auto === 'deposits' ? auto.deposits : 0;
        const sub = it.auto === 'deposits' ? `<em class="dim">${dep ? 'Add anything else you earned today' : 'Counts toward the money gate'}</em>` : '';
        return `<div class="row-in"><span>${esc(it.label)}${dep ? autoNote(`AED ${dep.toLocaleString('en-US')} in deposits from Doors`) : ''}${sub}</span>
          <div class="aed">${mini(it.id, 'number', 'min="0" step="50" placeholder="0"')}<span>AED</span></div></div>`;
      }
      case 'minutes': {
        const step = Number(it.step) || 5;
        return `<div class="row-in"><span>${esc(it.label)}</span><div class="stepper">
          <button type="button" data-a="ciStep" data-k="${it.id}" data-v="-${step}" aria-label="${step} minutes less">−</button>
          <b class="num">${Number(v) || 0}<small> min</small></b>
          <button type="button" data-a="ciStep" data-k="${it.id}" data-v="${step}" aria-label="${step} minutes more">+</button></div></div>`;
      }
      case 'time':
        return `<div class="row-in"><span>${esc(it.label)}</span>${mini(it.id, 'time')}</div>`;
      case 'choice': {
        // doors logged today pre-select the door-to-door option until you change it yourself
        const autoPick = it.auto === 'doors' && auto.doors > 0 && !Array.isArray(v);
        const sel = new Set(Array.isArray(v) ? v : []);
        const opts = it.options || [];
        return `<div class="row-in col"><span>${esc(it.label)}${it.auto === 'doors' && auto.doors ? autoNote(`${NS.plural(auto.doors, 'door')} logged today`) : ''}</span>
          <div class="pray" data-choice="${it.id}">${opts
            .map((o) => `<label class="pill"><input type="checkbox" data-c="ciChoice" data-k="${it.id}" value="${esc(o)}" ${sel.has(o) || (autoPick && /door/i.test(o)) ? 'checked' : ''}><span>${esc(o)}</span></label>`)
            .join('')}</div></div>`;
      }
      case 'pills': {
        const arr = Array.isArray(v) ? v : [];
        return `<div class="row-in"><span>${esc(it.label)}</span><div class="pray">${(it.options || [])
          .map((o, i) => `<label class="pill"><input type="checkbox" data-c="ci" data-k="${it.id}.${i}" ${arr[i] ? 'checked' : ''}><span>${esc(o)}</span></label>`)
          .join('')}</div></div>`;
      }
      default:
        return '';
    }
  };

  // ---------- side panel: range grid, bad-week detector, hours ----------
  NS.ciSide = () => {
    const n = ciRange();
    const days = S.lastDays(n);
    const recs = days.map((d) => S.state.checkins[d]);
    const logged = recs.filter(Boolean).length;
    const rows = S.metrics().map((m) => {
      const hits = days.filter((d, i) => recs[i] && m.test(recs[i], d)).length;
      return { m, hits, rate: logged ? hits / logged : null };
    });
    const dayLabel = (d) => {
      const dt = NS.parse(d);
      if (n <= 14) return dt.toLocaleDateString('en-GB', { weekday: 'narrow' });
      return dt.getDay() === 1 ? dt.getDate() : '';
    };
    const narrow = window.innerWidth < 860;
    const cell = n <= 7 ? (narrow ? 17 : 22) : n <= 14 ? (narrow ? 10 : 15) : narrow ? 5 : 9;
    const grid = `<div class="wk-scroll"><div class="wk-grid" style="--n:${n};--cell:${cell}px;--cell-gap:${n <= 7 ? 4 : n <= 14 ? 2 : 1}px">
      <div></div>${days.map((d) => `<div class="wk-d ${d === ciDate() ? 'cur' : ''}" title="${NS.fmtDate(d)}">${dayLabel(d)}</div>`).join('')}<div class="wk-d">Rate</div>
      ${rows
        .map(
          (r) => `<div class="wk-l">${esc(r.m.label)}</div>${days
            .map((d, i) => `<div class="wk-c ${!recs[i] ? 'none' : r.m.test(recs[i], d) ? 'hit' : 'miss'}" title="${NS.fmtDate(d)}"></div>`)
            .join('')}<div class="wk-r num ${r.rate == null ? 'dim' : r.rate >= 0.85 ? 'green' : r.rate < 0.6 ? 'red' : ''}">${r.rate == null ? '—' : NS.pct(r.rate)}</div>`
        )
        .join('')}
    </div></div>`;
    const slipping = rows.filter((r) => r.rate != null && r.rate < 0.6 && logged >= 3).sort((a, b) => a.rate - b.rate);
    const strong = rows.filter((r) => r.rate != null && r.rate >= 0.85 && logged >= 3);
    const rangeNav = `<div class="range-nav">
      <button type="button" class="btn ghost sm icon-only" data-a="ciRange" data-v="-1" ${n === RANGES[0] ? 'disabled' : ''} aria-label="Fewer days">${icon('chevL', 16)}</button>
      <button type="button" class="btn ghost sm icon-only" data-a="ciRange" data-v="1" ${n === RANGES[RANGES.length - 1] ? 'disabled' : ''} aria-label="More days">${icon('chevR', 16)}</button></div>`;

    return `<div class="card"><div class="card-h"><h3>Last ${n} days</h3>${rangeNav}</div>${grid}<div class="dim small" style="margin-top:10px">${logged}/${n} days logged</div></div>
      <div class="card"><h3>Bad-week detector <span class="dim">last ${n} days</span></h3>
        ${logged < 3 ? '<div class="dim small">Log at least 3 days to get a read.</div>' : ''}
        ${slipping.length ? `<div class="signals">${slipping.slice(0, 5).map((r) => `<div class="signal bad">${icon('alert', 14)}<span><b>${esc(r.m.label)}</b>: ${r.hits}/${logged} days</span></div>`).join('')}${slipping.length > 5 ? `<div class="dim small">+${slipping.length - 5} more under 60%</div>` : ''}</div>` : logged >= 3 ? '<div class="signal good">' + icon('check', 14) + '<span>Nothing slipping. Keep the streak alive.</span></div>' : ''}
        ${strong.length ? `<div class="dim small" style="margin-top:12px">Strong: ${strong.map((r) => esc(r.m.label)).join(' · ')}</div>` : ''}
      </div>
      ${hoursCard(n)}`;
  };

  // "Where your hours went": totals, daily averages and the change vs the previous period
  const hoursCard = (n) => {
    const sumH = (days, k) => NS.sum(days, (d) => ((S.state.checkins[d] || {}).hours || {})[k]);
    const cur = S.lastDays(n);
    const prev = cur.map((d) => NS.addDays(d, -n));
    const daysWith = (days) => days.filter((d) => NS.sum(S.HOURS, (h) => ((S.state.checkins[d] || {}).hours || {})[h.k]) > 0).length;
    const dCur = daysWith(cur);
    if (!dCur) return `<div class="card"><h3>Where your hours went</h3><div class="dim small">Log hours in the check-in to see where your days go.</div></div>`;
    const dPrev = daysWith(prev);
    const t = Object.fromEntries(S.HOURS.map((h) => [h.k, sumH(cur, h.k)]));
    const p = Object.fromEntries(S.HOURS.map((h) => [h.k, sumH(prev, h.k)]));
    const total = NS.sum(S.HOURS, (h) => t[h.k]);
    const work = t.sales + t.pawminds;
    const workPrev = p.sales + p.pawminds;
    const avg = (v, days) => (days ? v / days : 0);
    const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');
    const delta = (now, before) => {
      if (!dPrev) return '';
      const diff = avg(now, dCur) - avg(before, dPrev);
      if (Math.abs(diff) < 0.1) return '<span class="dim small">same as before</span>';
      return `<span class="small ${diff > 0 ? '' : 'dim'}">${diff > 0 ? '▲' : '▼'} ${f1(Math.abs(diff))}h/day</span>`;
    };
    const row = (label, v, vPrev, sub, cls = '') => `<div class="hrow ${cls}"><div class="grow"><b>${label}</b>${sub ? `<div class="dim small">${sub}</div>` : ''}</div>
      <div class="hrow-n"><b class="num">${f1(v)}h</b><span class="dim small">${f1(avg(v, dCur))}h/day</span></div><div class="hrow-d">${delta(v, vPrev)}</div></div>`;
    const wastedPct = total ? t.wasted / total : 0;
    const pmShare = work ? t.pawminds / work : 0;
    const insight = [
      `Work averaged <b>${f1(avg(work, dCur))}h a day</b>${dPrev ? ` (${avg(work, dCur) >= avg(workPrev, dPrev) ? 'up from' : 'down from'} ${f1(avg(workPrev, dPrev))}h the ${n} days before)` : ''}.`,
      work ? `PawMinds got <b>${NS.pct(pmShare)}</b> of your work hours.` : '',
      t.wasted ? `Wasted time was <b>${NS.pct(wastedPct)}</b> of what you logged${wastedPct > 0.15 ? ', which is worth fixing' : ''}.` : 'No wasted time logged.',
    ].filter(Boolean).join(' ');
    return `<div class="card"><h3>Where your hours went <span class="dim">${dCur}/${n} days with hours</span></h3>
      <div class="stack">${S.HOURS.filter((h) => t[h.k]).map((h) => `<i style="flex:${t[h.k]};--c:${h.color}" title="${h.label}: ${t[h.k]}h"></i>`).join('')}</div>
      ${row('Work', work, workPrev, `Door-to-door ${f1(t.sales)}h · PawMinds ${f1(t.pawminds)}h`)}
      ${row('Gym', t.training, p.training)}
      ${row('Wasted', t.wasted, p.wasted, total ? NS.pct(wastedPct) + ' of logged time' : '', wastedPct > 0.15 ? 'warn' : '')}
      <p class="insight">${insight}</p>
    </div>`;
  };

  V.checkin = () => {
    const date = ciDate();
    const c = ciRec();
    const auto = S.autoDay(date);
    const isToday = date === NS.today();
    const label = isToday ? 'Today' : NS.parse(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const h = c.hours || {};
    const totH = NS.sum(S.HOURS, (x) => h[x.k]);
    const hourIn = (x) =>
      `<label class="hr" style="--c:${x.color}"><span><span class="dot"></span>${x.label}</span><input type="number" min="0" max="24" step="0.5" data-c="ci" data-k="hours.${x.k}" value="${h[x.k] ?? ''}" placeholder="0"></label>`;

    const nav = `<div class="datenav">
      <button type="button" class="btn ghost sm icon-only" data-a="ciNav" data-v="-1" aria-label="Previous day">${icon('chevL')}</button>
      <div class="dn-l"><b>${label}</b><span id="ci-status" class="small ${S.state.checkins[date] ? 'green' : 'dim'}">${S.state.checkins[date] ? 'Logged' : 'Not logged yet'}</span></div>
      <button type="button" class="btn ghost sm icon-only" data-a="ciNav" data-v="1" ${isToday ? 'disabled' : ''} aria-label="Next day">${icon('chevR')}</button>
      ${isToday ? '' : `<button type="button" class="btn sm" data-a="ciNav" data-v="0">Today</button>`}
    </div>
    <button type="button" class="btn" data-a="ciEdit">${icon('edit', 15)}<span>Edit items</span></button>`;

    const groups = S.ciConfig()
      .groups.filter((g) => g.items.length)
      .map((g) => `<div class="ci-g"><h4>${esc(g.name)}</h4>${g.items.map((it) => ciItem(it, c, auto)).join('')}</div>`)
      .join('');

    const form = `<div class="card ci">
      ${groups}
      <div class="ci-g"><h4>Where did the day go? <span class="dim small" id="ci-hours">${totH}h logged</span></h4>
        <div class="hwork">
          <div class="hwork-h">Work <span class="dim small">Door-to-door + PawMinds</span></div>
          <div class="hours">${S.HOURS.filter((x) => x.group === 'work').map(hourIn).join('')}</div>
          <textarea data-c="ci" data-k="workNote" rows="2" placeholder="What did you work on? e.g. 32 doors in Marina, PawMinds checkout copy">${esc(c.workNote || '')}</textarea>
        </div>
        <div class="hours">${S.HOURS.filter((x) => !x.group).map(hourIn).join('')}</div>
      </div>
      <div class="ci-g"><h4>Note</h4><textarea data-c="ci" data-k="note" rows="2" placeholder="Anything worth remembering about today?">${esc(c.note || '')}</textarea></div>
    </div>`;

    return `${NS.head('Daily check-in', '60 seconds at the end of the day. It feeds your streaks, levels and the weekly review.', nav)}
      <div class="ci-layout"><div>${form}</div><div class="ci-side" id="ci-side">${NS.ciSide()}</div></div>`;
  };

  const ciAfterSave = (c) => {
    S.save();
    document.getElementById('ci-side').innerHTML = NS.ciSide();
    const st = document.getElementById('ci-status');
    if (st) { st.textContent = 'Logged'; st.className = 'small green'; }
    const hh = document.getElementById('ci-hours');
    if (hh) hh.textContent = NS.sum(S.HOURS, (x) => (c.hours || {})[x.k]) + 'h logged';
    NS.refreshNav();
  };
  const ciRecord = () => {
    const date = ciDate();
    return S.state.checkins[date] || (S.state.checkins[date] = newRec());
  };
  C.ci = (el) => {
    const c = ciRecord();
    const k = el.dataset.k;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
    else v = el.value;
    const pill = k.match(/^(.+)\.(\d+)$/);
    if (pill && !k.startsWith('hours.')) {
      const arr = Array.isArray(c[pill[1]]) ? c[pill[1]] : [];
      arr[+pill[2]] = v;
      c[pill[1]] = arr;
    } else NS.setPath(c, k, v);
    ciAfterSave(c);
  };
  C.ciChoice = (el) => {
    const c = ciRecord();
    const box = el.closest('[data-choice]');
    c[el.dataset.k] = [...box.querySelectorAll('input:checked')].map((i) => i.value);
    ciAfterSave(c);
  };
  A.ciStep = (el) => {
    const c = ciRecord();
    c[el.dataset.k] = Math.max(0, (Number(c[el.dataset.k]) || 0) + Number(el.dataset.v));
    S.save();
    NS.render();
  };
  A.ciNav = (el) => {
    const v = +el.dataset.v;
    if (!v) ui.ciDate = null;
    else {
      const next = NS.addDays(ciDate(), v);
      ui.ciDate = next >= NS.today() ? null : next;
    }
    NS.render();
  };
  A.ciRange = (el) => {
    const i = RANGES.indexOf(ciRange()) + Number(el.dataset.v);
    ui.ciRange = RANGES[NS.clamp(i, 0, RANGES.length - 1)];
    document.getElementById('ci-side').innerHTML = NS.ciSide();
  };

  // ---------- check-in editor ----------
  const TARGET_HINT = { number: 'Counts as done at', money: 'Counts as done at (AED)', minutes: 'Counts as done at (min)', pills: 'Done when this many are ticked', time: 'On time if by' };
  NS.ciEditor = () => {
    const g = ui.draft.groups;
    const sel = (path, list, v, rer) =>
      `<select data-d="${path}" ${rer ? 'data-rerender="1"' : ''}>${list.map((o) => `<option value="${o.k}" ${o.k === v ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    const mv = (a, gi, ii, dir, dis) =>
      `<button type="button" class="btn ghost sm icon-only" data-a="${a}" data-g="${gi}" data-i="${ii}" data-v="${dir}" ${dis ? 'disabled' : ''} aria-label="Move ${dir < 0 ? 'up' : 'down'}">${dir < 0 ? '↑' : '↓'}</button>`;
    return `<div id="cied">${g
      .map(
        (gr, gi) => `<div class="ced-g">
        <div class="ced-gh"><input class="grow ced-gname" data-d="groups.${gi}.name" value="${esc(gr.name)}" aria-label="Group name">
          ${mv('cedMoveG', gi, 0, -1, gi === 0)}${mv('cedMoveG', gi, 0, 1, gi === g.length - 1)}
          <button type="button" class="btn ghost sm icon-only" data-a="cedDelG" data-g="${gi}" aria-label="Delete group">${icon('trash', 14)}</button></div>
        ${gr.items
          .map((it, ii) => {
            const p = `groups.${gi}.items.${ii}`;
            const needsOpts = it.type === 'choice' || it.type === 'pills';
            const opts = Array.isArray(it.options) ? it.options.join(', ') : it.options || '';
            return `<div class="ced-i">
              <div class="ced-row"><input class="grow" data-d="${p}.label" value="${esc(it.label)}" placeholder="Item name" aria-label="Item name">
                ${mv('cedMove', gi, ii, -1, ii === 0)}${mv('cedMove', gi, ii, 1, ii === gr.items.length - 1)}
                <button type="button" class="btn ghost sm icon-only" data-a="cedDel" data-g="${gi}" data-i="${ii}" aria-label="Delete item">${icon('trash', 14)}</button></div>
              <div class="ced-row wrap">${sel(p + '.type', S.CI_TYPES, it.type, true)}${sel(p + '.area', S.CI_AREAS, it.area || 'none')}
                ${TARGET_HINT[it.type] ? `<label class="ced-t"><span class="dim small">${TARGET_HINT[it.type]}</span><input type="${it.type === 'time' ? 'time' : 'number'}" data-d="${p}.target" value="${esc(it.target ?? '')}" placeholder="${it.type === 'pills' ? 'all' : it.type === 'time' ? '' : 'any'}"></label>` : ''}
                ${it.auto ? `<span class="chip" style="--c:var(--p1)">Fills from Doors</span>` : ''}</div>
              ${needsOpts ? `<input data-d="${p}.options" value="${esc(opts)}" placeholder="Options, separated by commas">` : ''}
            </div>`;
          })
          .join('')}
        <button type="button" class="btn ghost sm" data-a="cedAdd" data-g="${gi}">${icon('plus', 13)}<span>Add item</span></button>
      </div>`
      )
      .join('')}
      <div class="btn-row"><button type="button" class="btn sm" data-a="cedAddG">${icon('plus', 13)}<span>Add group</span></button>
        <button type="button" class="btn ghost sm" data-a="cedReset">Reset to default</button></div>
      <p class="dim small">Removing an item hides it from now on. What you logged before is kept. "Doesn't count" items are saved but don't affect streaks or levels.</p>
    </div>`;
  };
  NS.refreshCiEditor = () => {
    const el = document.getElementById('cied');
    if (el) el.outerHTML = NS.ciEditor();
  };
  A.ciEdit = () => {
    ui.draft = NS.clone(S.ciConfig());
    const original = NS.clone(S.ciConfig());
    NS.openModal({
      title: 'Edit check-in',
      wide: true,
      body: NS.ciEditor(),
      onSave: () => {
        const cfg = ui.draft;
        cfg.groups = cfg.groups.filter((g) => g.name.trim() || g.items.length);
        for (const g of cfg.groups) {
          g.name = g.name.trim() || 'Untitled';
          g.items = g.items.filter((it) => it.label.trim());
          g.items.forEach((it) => {
            it.label = it.label.trim();
            if (typeof it.options === 'string') it.options = it.options.split(',').map((s) => s.trim()).filter(Boolean);
            if ((it.type === 'choice' || it.type === 'pills') && !(it.options || []).length) it.options = ['Yes'];
            if (it.target === '' || it.target == null) delete it.target;
            else if (it.type !== 'time') it.target = Number(it.target);
            const was = original.groups.flatMap((x) => x.items).find((o) => o.id === it.id);
            if (!was || was.label !== it.label || was.target !== it.target) delete it.metricLabel;
          });
        }
        S.state.settings.checkin = cfg;
      },
    });
  };
  const cedItems = (el) => ui.draft.groups[+el.dataset.g].items;
  const swap = (arr, i, j) => { if (j >= 0 && j < arr.length) [arr[i], arr[j]] = [arr[j], arr[i]]; };
  A.cedAdd = (el) => {
    cedItems(el).push({ id: 'ci_' + NS.uid(), label: '', type: 'toggle', area: 'health' });
    NS.refreshCiEditor();
    const inputs = document.querySelectorAll(`#cied [data-d^="groups.${el.dataset.g}.items."][data-d$=".label"]`);
    inputs.length && inputs[inputs.length - 1].focus();
  };
  A.cedDel = (el) => { cedItems(el).splice(+el.dataset.i, 1); NS.refreshCiEditor(); };
  A.cedMove = (el) => { const it = cedItems(el); swap(it, +el.dataset.i, +el.dataset.i + Number(el.dataset.v)); NS.refreshCiEditor(); };
  A.cedAddG = () => { ui.draft.groups.push({ id: 'g_' + NS.uid(), name: '', items: [] }); NS.refreshCiEditor(); };
  A.cedDelG = (el) => {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.classList.add('danger'); NS.toast('Tap again to delete the group and its items'); return; }
    ui.draft.groups.splice(+el.dataset.g, 1);
    NS.refreshCiEditor();
  };
  A.cedMoveG = (el) => { swap(ui.draft.groups, +el.dataset.g, +el.dataset.g + Number(el.dataset.v)); NS.refreshCiEditor(); };
  A.cedReset = () => { ui.draft = S.defaultCheckin(); NS.refreshCiEditor(); NS.toast('Defaults restored. Save to keep them.'); };

  // =====================================================================
  // GEAR WISHLIST
  // =====================================================================
  const wishCats = () => [...new Set(S.state.wishlist.map((i) => i.category || 'Uncategorized'))].sort();

  const wishCard = (w) => {
    const pr = S.find(S.PRIOS, w.priority);
    const cur = S.state.settings.currency;
    const img = NS.safeUrl(w.image);
    const link = NS.safeUrl(w.link);
    return `<div class="wcard ${w.bought ? 'bought' : ''}">
      <div class="wimg"><span class="ph">${esc(NS.initials(w.name))}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
        <span class="wprio">${NS.chip(pr.label, pr.color)}</span>${w.bought ? `<span class="wbought">${icon('check', 14)} Bought</span>` : ''}</div>
      <div class="wbody">
        <button type="button" class="wname" data-a="editWish" data-id="${w.id}">${esc(w.name)}</button>
        <div class="wprice num">${NS.disp(w.price, w.currency)}</div>
        <div class="dim small">${(w.currency || 'AED') !== cur ? 'Entered as ' + NS.fmtMoney(w.price, w.currency) : '≈ ' + NS.fmtMoney(NS.convert(Number(w.price) || 0, w.currency || 'AED', cur === 'AED' ? 'USD' : 'AED'), cur === 'AED' ? 'USD' : 'AED')}</div>
        <div class="wact">
          <label class="bchk"><input type="checkbox" data-a="toggleBought" data-id="${w.id}" ${w.bought ? 'checked' : ''}><span>Bought</span></label>
          <span class="spacer"></span>
          <button type="button" class="btn ghost sm icon-only" data-a="editWish" data-id="${w.id}" aria-label="Edit">${icon('edit', 14)}</button>
          ${link ? `<a class="btn pri sm" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Buy now ${icon('ext', 13)}</a>` : `<span class="btn sm disabled">No link</span>`}
        </div>
      </div>
    </div>`;
  };

  V.wishlist = () => {
    const items = S.state.wishlist;
    const cats = wishCats();
    const cat = ui.wishCat && cats.includes(ui.wishCat) ? ui.wishCat : 'all';
    const hide = !!ui.hideBought;
    const val = (i) => NS.convert(Number(i.price) || 0, i.currency || 'AED', S.state.settings.currency);
    const fmt = (v) => NS.fmtMoney(v, S.state.settings.currency);
    const remaining = items.filter((i) => !i.bought);
    const bought = items.filter((i) => i.bought);
    const high = remaining.filter((i) => i.priority === 'high');

    const actions = `<label class="tog sm"><input type="checkbox" data-a="hideBought" ${hide ? 'checked' : ''}><span class="sw"></span><span class="tog-l">Hide bought</span></label>
      <button type="button" class="btn pri" data-a="newWish">${icon('plus', 16)}<span>Item</span></button>`;

    const chips = `<div class="chips">
      <button type="button" class="fchip ${cat === 'all' ? 'on' : ''}" data-a="wishCat" data-v="all">All <span>${items.length}</span></button>
      ${cats.map((c) => `<button type="button" class="fchip ${cat === c ? 'on' : ''}" data-a="wishCat" data-v="${esc(c)}">${icon('bag', 13)} ${esc(c)} <span>${items.filter((i) => (i.category || 'Uncategorized') === c).length}</span></button>`).join('')}
    </div>`;

    const showCats = cat === 'all' ? cats : [cat];
    const body = items.length
      ? showCats
          .map((c) => {
            let list = items.filter((i) => (i.category || 'Uncategorized') === c);
            const left = NS.sum(list.filter((i) => !i.bought), val);
            if (hide) list = list.filter((i) => !i.bought);
            const rank = { high: 0, medium: 1, low: 2 };
            list.sort((a, b) => a.bought - b.bought || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1));
            return `<section class="sect"><div class="sect-h"><span class="folder">${icon('bag', 16)}</span><h2>${esc(c)}</h2><span class="dim small">${fmt(left)} left to buy</span><span class="spacer"></span>
              <button type="button" class="btn ghost sm" data-a="newWish" data-cat="${esc(c)}">${icon('plus', 14)}<span>Add</span></button></div>
              ${list.length ? `<div class="w-grid">${list.map(wishCard).join('')}</div>` : '<div class="dim small pad">Everything here is bought.</div>'}</section>`;
          })
          .join('')
      : NS.emptyState('Your wishlist is empty. Add the gear you want, with a link and a price.', `<button class="btn pri" data-a="newWish">${icon('plus', 16)}<span>Add an item</span></button>`);

    return `${NS.head('Gear wishlist', 'Prices convert automatically at the fixed peg: 1 USD = 3.6725 AED.', actions)}
      <div class="grid g3">
        ${NS.stat('Left to buy', fmt(NS.sum(remaining, val)), NS.plural(remaining.length, 'item'), 'var(--accent)')}
        ${NS.stat('High priority', fmt(NS.sum(high, val)), NS.plural(high.length, 'item'), 'var(--red)')}
        ${NS.stat('Already bought', fmt(NS.sum(bought, val)), NS.plural(bought.length, 'item'), 'var(--green)')}
      </div>
      ${chips}${body}`;
  };

  A.wishCat = (el) => { ui.wishCat = el.dataset.v; NS.render(); };
  A.hideBought = (el) => { ui.hideBought = el.checked; NS.render(); };
  A.toggleBought = (el) => {
    const w = S.state.wishlist.find((x) => x.id === el.dataset.id);
    if (!w) return;
    w.bought = !w.bought;
    S.save();
    NS.render();
  };
  const wishFields = () => [
    { k: 'name', label: 'Name', full: true, ph: 'e.g. Wireless lav mic kit' },
    { k: 'category', label: 'Category (folder)', type: 'datalist', options: wishCats(), ph: 'e.g. Content setup' },
    { k: 'priority', label: 'Priority', type: 'select', options: S.PRIOS },
    { k: 'price', label: 'Price', type: 'money', cur: 'currency', hint: 'Enter it in whatever currency the store shows. Totals convert automatically.' },
    { k: 'bought', label: 'Already bought', type: 'check' },
    { k: 'link', label: 'Buy link', type: 'url', full: true, ph: 'https://' },
    { k: 'image', label: 'Image URL', type: 'url', full: true, ph: 'https://…/photo.jpg', hint: 'Right-click the product photo → Copy image address.' },
  ];
  NS.editWish = (id, preset = {}) => {
    const existing = S.state.wishlist.find((w) => w.id === id);
    const obj = existing ? NS.clone(existing) : Object.assign({ id: NS.uid(), name: '', category: '', priority: 'medium', price: null, currency: 'AED', bought: false, link: '', image: '' }, preset);
    const f = wishFields();
    NS.openModal({
      title: existing ? 'Edit item' : 'New item',
      body: NS.fields(f, obj),
      onSave: (form) => {
        const vals = NS.readForm(form, f);
        if (!vals.name) { NS.toast('Give the item a name'); return false; }
        if (!vals.category) vals.category = 'Uncategorized';
        if (existing) Object.assign(existing, vals);
        else S.state.wishlist.push(Object.assign(obj, vals));
      },
      onDelete: existing ? () => (S.state.wishlist = S.state.wishlist.filter((w) => w.id !== id)) : null,
    });
  };
  A.editWish = (el) => NS.editWish(el.dataset.id);

  // =====================================================================
  // WEEKLY REVIEW (AI)
  // =====================================================================
  ui.reviews = null;
  const loadReviews = async () => {
    try {
      ui.reviews = await NS.Cloud.reviews();
    } catch (e) {
      ui.reviews = [];
      NS.toast(e.message);
    }
    if (ui.route === 'life/review') NS.render();
  };

  V.review = () => {
    const Cl = NS.Cloud;
    const actions = Cl.mode === 'cloud' ? `<button type="button" class="btn pri" data-a="genReview" ${ui.genReview ? 'disabled' : ''}>${icon('star', 15)}<span>${ui.genReview ? 'Writing… (up to a minute)' : 'Review this week now'}</span></button>` : '';
    const head = NS.head('Weekly review', 'Every Sunday evening, Claude reads your week and tells you straight where it went.', actions);
    if (Cl.mode !== 'cloud') return head + NS.emptyState('The weekly review runs in the cloud. Connect Supabase and Vercel (see SETUP.md) to switch it on.');
    if (ui.reviews === null) { loadReviews(); return head + '<div class="dim pad">Loading…</div>'; }
    if (!ui.reviews.length) return head + NS.emptyState('No reviews yet. The first one arrives Sunday evening, or press “Review this week now”.');
    const sel = ui.reviews.find((r) => r.id === ui.reviewId) || ui.reviews[0];
    const range = (r) => `${NS.fmtDate(r.week_start)} – ${NS.fmtDate(r.week_end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
    return `${head}
      <div class="review-layout">
        <article class="card review"><div class="eyebrow">Week of ${range(sel)}</div><div class="md">${NS.md(sel.content)}</div></article>
        <aside class="card review-list"><h3>Past reviews</h3><div class="list">${ui.reviews
          .map((r) => `<button type="button" class="li ${r.id === sel.id ? 'sel' : ''}" data-a="pickReview" data-id="${r.id}"><span class="grow"><span class="li-t">${range(r)}</span><span class="li-s">Written ${NS.fmtDate(String(r.created_at).slice(0, 10))}</span></span></button>`)
          .join('')}</div></aside>
      </div>`;
  };
  A.pickReview = (el) => { ui.reviewId = el.dataset.id; NS.render(); window.scrollTo(0, 0); };
  A.genReview = async () => {
    ui.genReview = true;
    NS.render();
    try {
      const r = await NS.Cloud.generateReview();
      ui.reviewId = r.review && r.review.id;
      NS.toast('Review ready');
    } catch (e) {
      NS.toast(e.message);
    }
    ui.genReview = false;
    await loadReviews();
  };
  A.newWish = (el) => NS.editWish(null, el.dataset.cat ? { category: el.dataset.cat } : ui.wishCat && ui.wishCat !== 'all' ? { category: ui.wishCat } : {});
})(window.NS);
