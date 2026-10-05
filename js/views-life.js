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
  // DAILY CHECK-IN
  // =====================================================================
  const ciDate = () => ui.ciDate || NS.today();
  const ciRec = () => S.state.checkins[ciDate()] || {};

  const tog = (k, label, c, extra = '') =>
    `<label class="tog"><input type="checkbox" data-c="ci" data-k="${k}" ${c[k] ? 'checked' : ''}><span class="sw"></span><span class="tog-l">${label}</span>${extra}</label>`;
  const mini = (k, c, type, attrs = '') =>
    `<input class="mini-in" type="${type}" data-c="ci" data-k="${k}" value="${esc(c[k] ?? '')}" ${attrs}>`;

  NS.ciSide = () => {
    const days = S.lastDays(7);
    const recs = days.map((d) => S.state.checkins[d]);
    const logged = recs.filter(Boolean).length;
    const rows = S.METRICS.map((m) => {
      const hits = recs.filter((c) => c && m.test(c)).length;
      const rate = logged ? hits / logged : null;
      return { m, hits, rate };
    });
    const grid = `<div class="wk-grid" style="--n:${days.length}">
      <div></div>${days.map((d) => `<div class="wk-d ${d === ciDate() ? 'cur' : ''}">${NS.parse(d).toLocaleDateString('en-GB', { weekday: 'narrow' })}</div>`).join('')}<div class="wk-d">Rate</div>
      ${rows
        .map(
          (r) => `<div class="wk-l">${r.m.label}</div>${recs
            .map((c) => `<div class="wk-c ${!c ? 'none' : r.m.test(c) ? 'hit' : 'miss'}"></div>`)
            .join('')}<div class="wk-r num ${r.rate == null ? 'dim' : r.rate >= 0.85 ? 'green' : r.rate < 0.6 ? 'red' : ''}">${r.rate == null ? '—' : NS.pct(r.rate)}</div>`
        )
        .join('')}
    </div>`;
    const slipping = rows.filter((r) => r.rate != null && r.rate < 0.6 && logged >= 3).sort((a, b) => a.rate - b.rate);
    const strong = rows.filter((r) => r.rate != null && r.rate >= 0.85 && logged >= 3);

    const hours = S.HOURS.map((h) => ({ h, v: NS.sum(recs.filter(Boolean), (c) => (c.hours || {})[h.k]) }));
    const totH = NS.sum(hours, (x) => x.v);
    const hoursBar = totH
      ? `<div class="stack">${hours.filter((x) => x.v).map((x) => `<i style="flex:${x.v};--c:${x.h.color}" title="${x.h.label}: ${x.v}h"></i>`).join('')}</div>
         <div class="legend">${hours
           .filter((x) => x.v)
           .map((x) => `<span><span class="dot" style="--c:${x.h.color}"></span>${x.h.label} <b class="num">${x.v}h</b> <span class="dim">${Math.round((x.v / totH) * 100)}%</span></span>`)
           .join('')}</div>`
      : `<div class="dim small">Log hours in the check-in to see where your days go.</div>`;

    return `<div class="card"><h3>Last 7 days</h3>${grid}<div class="dim small" style="margin-top:8px">${logged}/7 days logged</div></div>
      <div class="card"><h3>Bad-week detector</h3>
        ${logged < 3 ? '<div class="dim small">Log at least 3 days to get a read.</div>' : ''}
        ${slipping.length ? `<div class="signals">${slipping.slice(0, 5).map((r) => `<div class="signal bad">${icon('alert', 14)}<span><b>${r.m.label}</b>: ${r.hits}/${logged} days</span></div>`).join('')}${slipping.length > 5 ? `<div class="dim small">+${slipping.length - 5} more under 60%</div>` : ''}</div>` : logged >= 3 ? '<div class="signal good">' + icon('check', 14) + '<span>Nothing slipping. Keep the streak alive.</span></div>' : ''}
        ${strong.length ? `<div class="dim small" style="margin-top:10px">Strong: ${strong.map((r) => r.m.label).join(' · ')}</div>` : ''}
      </div>
      <div class="card"><h3>Where the week went</h3>${hoursBar}</div>`;
  };

  V.checkin = () => {
    const date = ciDate();
    const c = ciRec();
    const T = NS.today();
    const isToday = date === T;
    const label = isToday ? 'Today' : NS.parse(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    const h = c.hours || {};
    const totH = NS.sum(S.HOURS, (x) => h[x.k]);
    const prayers = c.prayers || [];

    const nav = `<div class="datenav">
      <button type="button" class="btn ghost sm icon-only" data-a="ciNav" data-v="-1" aria-label="Previous day">${icon('chevL')}</button>
      <div class="dn-l"><b>${label}</b><span id="ci-status" class="small ${S.state.checkins[date] ? 'green' : 'dim'}">${S.state.checkins[date] ? 'Logged' : 'Not logged yet'}</span></div>
      <button type="button" class="btn ghost sm icon-only" data-a="ciNav" data-v="1" ${isToday ? 'disabled' : ''} aria-label="Next day">${icon('chevR')}</button>
      ${isToday ? '' : `<button type="button" class="btn sm" data-a="ciNav" data-v="0">Today</button>`}
    </div>`;

    const form = `<div class="card ci">
      <div class="ci-g"><h4>Sleep</h4>
        ${tog('wakeOnTime', 'Woke up on time', c, mini('wakeTime', c, 'time', 'aria-label="Wake time"'))}
        ${tog('sleepOnTime', 'Slept on time', c, mini('sleepTime', c, 'time', 'aria-label="Bed time"'))}
        <div class="row-in"><span>Hours slept</span>${mini('sleepHours', c, 'number', 'step="0.5" min="0" max="16" placeholder="0"')}</div>
      </div>
      <div class="ci-g"><h4>Hustle</h4>
        ${tog('d2d', 'Did door-to-door', c)}
        <div class="row-in"><span>Earned today <em class="dim">(counts toward the gate)</em></span><div class="aed">${mini('d2dAmount', c, 'number', 'min="0" step="50" placeholder="0"')}<span>AED</span></div></div>
        ${tog('followUp', 'Followed up with people', c, mini('followUpCount', c, 'number', 'min="0" placeholder="#" aria-label="How many"'))}
      </div>
      <div class="ci-g"><h4>Body</h4>
        ${tog('trained', 'Trained', c)}
        ${tog('calories', 'Hit my calorie goal', c)}
      </div>
      <div class="ci-g"><h4>Mind & deen</h4>
        <div class="row-in"><span>Prayers</span><div class="pray">${S.PRAYERS.map(
          (p, i) => `<label class="pill"><input type="checkbox" data-c="ci" data-k="prayers.${i}" ${prayers[i] ? 'checked' : ''}><span>${p}</span></label>`
        ).join('')}</div></div>
        ${tog('meditated', 'Meditated', c)}
        <div class="row-in"><span>Peace of mind</span><div class="peace">${[1, 2, 3, 4, 5]
          .map((n) => `<button type="button" class="${Number(c.peace) === n ? 'on' : ''}" data-a="ciPeace" data-v="${n}">${n}</button>`)
          .join('')}</div></div>
      </div>
      <div class="ci-g"><h4>Relationship</h4>
        ${tog('gf', 'Attended to my girlfriend on time', c)}
      </div>
      <div class="ci-g"><h4>Where did the day go? <span class="dim small" id="ci-hours">${totH}h logged</span></h4>
        <div class="hours">${S.HOURS.map(
          (x) => `<label class="hr" style="--c:${x.color}"><span><span class="dot"></span>${x.label}</span><input type="number" min="0" max="24" step="0.5" data-c="ci" data-k="hours.${x.k}" value="${h[x.k] ?? ''}" placeholder="0"></label>`
        ).join('')}</div>
      </div>
      <div class="ci-g"><h4>Note</h4><textarea data-c="ci" data-k="note" rows="2" placeholder="Anything worth remembering about today?">${esc(c.note || '')}</textarea></div>
    </div>`;

    return `${NS.head('Daily check-in', '60 seconds at the end of the day. It feeds your streaks, levels and the weekly review.', nav)}
      <div class="ci-layout"><div>${form}</div><div class="ci-side" id="ci-side">${NS.ciSide()}</div></div>`;
  };

  C.ci = (el) => {
    const date = ciDate();
    const c = S.state.checkins[date] || (S.state.checkins[date] = { prayers: [false, false, false, false, false], hours: {} });
    const k = el.dataset.k;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'number') v = el.value === '' ? null : parseFloat(el.value);
    else v = el.value;
    if (k.startsWith('prayers.')) {
      c.prayers = c.prayers || [false, false, false, false, false];
      c.prayers[+k.split('.')[1]] = v;
    } else NS.setPath(c, k, v);
    // logging earnings implies you went out selling
    if (k === 'd2dAmount' && v > 0) {
      c.d2d = true;
      const t = document.querySelector('[data-k="d2d"]');
      if (t) t.checked = true;
    }
    S.save();
    document.getElementById('ci-side').innerHTML = NS.ciSide();
    const st = document.getElementById('ci-status');
    if (st) { st.textContent = 'Logged'; st.className = 'small green'; }
    const hh = document.getElementById('ci-hours');
    if (hh) hh.textContent = NS.sum(S.HOURS, (x) => (c.hours || {})[x.k]) + 'h logged';
    NS.refreshNav();
  };
  A.ciPeace = (el) => {
    const date = ciDate();
    const c = S.state.checkins[date] || (S.state.checkins[date] = { prayers: [false, false, false, false, false], hours: {} });
    c.peace = +el.dataset.v;
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
