(function (NS) {
  const S = (NS.S = {});
  const KEY = 'northstar.v1';

  // ---------- vocab ----------
  // Colors are shades of the one accent (p1 → p4) plus greys; red is reserved for overdue/wasted.
  S.STAGES = [
    { k: 'backlog', label: 'Backlog', color: 'var(--dim)' },
    { k: 'building', label: 'Building', color: 'var(--p1)' },
    { k: 'waiting', label: 'Waiting on', color: 'var(--p3)' },
    { k: 'hold_money', label: 'On hold · money', color: 'var(--p2)' },
    { k: 'done', label: 'Done', color: 'var(--ink)' },
  ];
  S.AREAS = [
    { k: 'health', label: 'Health', color: 'var(--p1)' },
    { k: 'relationship', label: 'Relationship', color: 'var(--p2)' },
    { k: 'learning', label: 'Learning', color: 'var(--p3)' },
    { k: 'habits', label: 'Habits', color: 'var(--p4)' },
  ];
  S.PRIOS = [
    { k: 'high', label: 'High', color: 'var(--p1)' },
    { k: 'medium', label: 'Medium', color: 'var(--p3)' },
    { k: 'low', label: 'Low', color: 'var(--dim)' },
  ];
  S.GOAL_STATUS = [
    { k: 'not_started', label: 'Not started', color: 'var(--dim)' },
    { k: 'in_progress', label: 'In progress', color: 'var(--p1)' },
    { k: 'done', label: 'Done', color: 'var(--ink)' },
  ];
  S.SUB_STATUS = [
    { k: 'active', label: 'Active', color: 'var(--p1)' },
    { k: 'on_hold', label: 'On hold', color: 'var(--p3)' },
    { k: 'cancelled', label: 'Cancelled', color: 'var(--dim)' },
  ];
  S.BENCH_STATUS = [
    { k: 'considering', label: 'Considering', color: 'var(--dim)' },
    { k: 'contacted', label: 'Contacted', color: 'var(--p3)' },
    { k: 'ready', label: 'Ready to hire', color: 'var(--p1)' },
  ];
  // Hour buckets. "Work" is Door-to-door + PawMinds, with one shared note.
  S.HOURS = [
    { k: 'sales', label: 'Door-to-door', group: 'work', color: 'var(--p1)' },
    { k: 'pawminds', label: 'PawMinds', group: 'work', color: 'var(--p2)' },
    { k: 'training', label: 'Gym', color: 'var(--p3)' },
    { k: 'wasted', label: 'Wasted', color: 'var(--danger)' },
  ];
  S.PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  S.find = (list, k) => list.find((x) => x.k === k) || list[0];

  // ---------- daily check-in: editable items ----------
  S.CI_TYPES = [
    { k: 'toggle', label: 'On / off' },
    { k: 'toggle_time', label: 'On / off + time' },
    { k: 'toggle_number', label: 'On / off + number' },
    { k: 'number', label: 'Number' },
    { k: 'money', label: 'AED amount' },
    { k: 'minutes', label: 'Minutes counter' },
    { k: 'time', label: 'Time' },
    { k: 'choice', label: 'Choice (tap one or more)' },
    { k: 'pills', label: 'Checklist pills' },
  ];
  S.CI_AREAS = [...S.AREAS.map((a) => ({ k: a.k, label: a.label })), { k: 'work', label: 'Work' }, { k: 'none', label: "Doesn't count" }];
  // Item ids match the keys older check-ins were saved under, so history keeps working.
  S.defaultCheckin = () => ({
    groups: [
      { id: 'g_sleep', name: 'Sleep', items: [
        { id: 'wakeOnTime', label: 'Woke up on time', type: 'toggle_time', extra: 'wakeTime', area: 'health' },
        { id: 'sleepOnTime', label: 'Slept on time', type: 'toggle_time', extra: 'sleepTime', area: 'health' },
        { id: 'sleepHours', label: 'Hours slept', type: 'number', area: 'health', target: 7, metricLabel: '7h+ sleep' },
      ] },
      { id: 'g_work', name: 'Work', items: [
        { id: 'workedOn', label: 'Today I worked on', type: 'choice', options: ['Door-to-door', 'PawMinds', 'Other'], area: 'work', auto: 'doors', metricLabel: 'Worked' },
        { id: 'd2dAmount', label: 'Earned today', type: 'money', area: 'none', auto: 'deposits' },
        { id: 'followUp', label: 'Followed up with people', type: 'toggle_number', extra: 'followUpCount', area: 'work', auto: 'texts', metricLabel: 'Followed up' },
      ] },
      { id: 'g_body', name: 'Body', items: [
        { id: 'trained', label: 'Hit the gym', type: 'toggle', area: 'health' },
        { id: 'calories', label: 'Hit my calorie goal', type: 'toggle', area: 'health' },
      ] },
      { id: 'g_mind', name: 'Mind & deen', items: [
        { id: 'prayers', label: 'Prayers', type: 'pills', options: S.PRAYERS.slice(), area: 'habits', metricLabel: 'All 5 prayers' },
        { id: 'meditated', label: 'Meditated', type: 'minutes', area: 'habits', step: 5 },
      ] },
    ],
  });
  S.ciConfig = () => (S.state && S.state.settings.checkin && S.state.settings.checkin.groups ? S.state.settings.checkin : S.defaultCheckin());
  S.ciItems = () => S.ciConfig().groups.flatMap((g) => g.items);
  S.ciExtraKey = (it) => it.extra || it.id + '_x';

  // Did this item count as "showed up" on a day? Door activity counts too (auto).
  S.ciHit = (it, c, auto) => {
    const v = c[it.id];
    const a = auto || {};
    switch (it.type) {
      case 'toggle':
      case 'toggle_time':
      case 'toggle_number':
        return !!v || (it.auto === 'texts' && a.texts > 0);
      case 'number':
      case 'money':
      case 'minutes':
        return Number(v) >= (Number(it.target) || 0.0001) || (it.auto === 'deposits' && a.deposits > 0);
      case 'pills': {
        const need = Number(it.target) || (it.options || []).length;
        return Array.isArray(v) && v.filter(Boolean).length >= need;
      }
      case 'choice':
        return (Array.isArray(v) && v.length > 0) || (it.auto === 'doors' && a.doors > 0);
      case 'time':
        return !!v && (!it.target || v <= it.target);
      default:
        return false;
    }
  };
  // The signals used by streaks, levels and the bad-week detector.
  S.metrics = () =>
    S.ciItems()
      .filter((it) => it.area && it.area !== 'none')
      .map((it) => ({ k: it.id, label: it.metricLabel || it.label, area: it.area, test: (c, d) => S.ciHit(it, c, S.autoDay(d)) }));

  // ---------- persistence ----------
  S.empty = () => ({
    version: 1,
    settings: { currency: 'AED', gateAmount: 40000, gateLabel: 'Run PawMinds ads', name: '', sample: false, timezone: 'Asia/Dubai' },
    goals: [],
    checkins: {},
    doors: [],
    wishlist: [],
    tasks: [],
    income: [],
    team: [],
    bench: [],
    subs: [],
  });

  // Cloud mode keeps its own offline cache so it never mixes with local-only data.
  const key = () => (NS.Cloud && NS.Cloud.mode === 'cloud' ? 'northstar.cloud.v1' : KEY);

  // Upgrades older data: tasks now point at a team member id instead of a name.
  S.normalize = (st) => {
    st.team.forEach((m) => {
      if (m.email == null) m.email = '';
      if (m.portal == null) m.portal = false;
      if (m.driveUrl == null) m.driveUrl = '';
    });
    st.tasks.forEach((t) => {
      if (!t.ownerId) {
        const m = st.team.find((x) => x.name === t.owner);
        t.ownerId = m ? m.id : 'me';
      }
      delete t.owner;
    });
    // older check-ins: meditation was yes/no, door-to-door was a toggle
    Object.values(st.checkins || {}).forEach((c) => {
      if (typeof c.meditated === 'boolean') c.meditated = c.meditated ? 10 : 0;
      if (c.d2d === true && !c.workedOn) c.workedOn = ['Door-to-door'];
    });
    st.doors = st.doors || [];
    return st;
  };

  S.load = () => {
    try {
      const raw = localStorage.getItem(key());
      if (raw) return S.replace(JSON.parse(raw), { silent: true });
    } catch (e) {
      /* storage blocked or corrupt — fall through */
    }
    S.state = NS.Cloud && NS.Cloud.mode === 'cloud' ? S.empty() : S.seed();
    S.saveLocal();
  };

  S.saveLocal = () => {
    try {
      localStorage.setItem(key(), JSON.stringify(S.state));
    } catch (e) {
      NS.toast && NS.toast('Could not save — browser storage is full or blocked');
    }
  };
  S.save = () => {
    S.saveLocal();
    if (NS.Cloud) NS.Cloud.schedule();
  };

  S.replace = (data, { silent } = {}) => {
    const base = S.empty();
    S.state = Object.assign(base, data);
    S.state.settings = Object.assign(S.empty().settings, data.settings || {});
    S.normalize(S.state);
    if (silent) S.saveLocal();
    else S.save();
  };

  // ---------- progress ----------
  S.subPct = (s) =>
    s.checklist && s.checklist.length ? s.checklist.filter((c) => c.done).length / s.checklist.length : s.done ? 1 : 0;
  S.taskPct = (t) => {
    if (t.stage === 'done') return 1;
    const subs = t.subtasks || [];
    return subs.length ? NS.sum(subs, S.subPct) / subs.length : 0;
  };
  S.goalPct = (g) => {
    if (g.status === 'done') return 1;
    const subs = g.subtasks || [];
    if (subs.length) return subs.filter((s) => s.done).length / subs.length;
    return NS.clamp((Number(g.manualPct) || 0) / 100, 0, 1);
  };

  // ---------- money gate ----------
  S.incomeEntries = () => {
    const out = [];
    Object.entries(S.state.checkins).forEach(([date, c]) => {
      if (Number(c.d2dAmount) > 0) out.push({ date, amount: Number(c.d2dAmount), currency: 'AED', note: 'Earned (check-in)', source: 'checkin' });
    });
    (S.state.doors || []).forEach((d) => {
      if (d.depositPaid && Number(d.depositAmount) > 0)
        out.push({ date: d.depositDate || String(d.at || '').slice(0, 10), amount: Number(d.depositAmount), currency: 'AED', note: 'Deposit · ' + (d.name || 'Door'), source: 'door', doorId: d.id });
    });
    S.state.income.forEach((i) => out.push(Object.assign({ source: 'manual' }, i)));
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  };
  S.gateTotal = () => NS.sum(S.incomeEntries(), (i) => NS.convert(Number(i.amount) || 0, i.currency || 'AED', 'AED'));
  S.gateAmount = () => Number(S.state.settings.gateAmount) || 40000;

  // ---------- dependencies & critical path ----------
  S.task = (id) => S.state.tasks.find((t) => t.id === id);
  S.open = (t) => t.stage !== 'done';
  S.unfinishedDeps = (t) => (t.dependsOn || []).map(S.task).filter((d) => d && S.open(d));
  S.dependents = (id) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const t of S.state.tasks) {
        if (S.open(t) && (t.dependsOn || []).includes(cur) && !seen.has(t.id) && t.id !== id) {
          seen.add(t.id);
          stack.push(t.id);
        }
      }
    }
    return [...seen].map(S.task);
  };
  const PR = { high: 0, medium: 1, low: 2 };

  // The one task to drop everything for: actionable now, needs no money,
  // and the most other work is waiting on it.
  S.focus = () => {
    const cands = S.state.tasks
      .filter((t) => S.open(t) && !t.moneyGated && t.stage !== 'hold_money' && t.stage !== 'waiting')
      .filter((t) => S.unfinishedDeps(t).length === 0)
      .map((t) => ({ task: t, deps: S.dependents(t.id) }))
      .filter((x) => x.deps.length > 0);
    if (!cands.length) return null;
    cands.sort(
      (a, b) =>
        b.deps.length - a.deps.length ||
        (PR[a.task.priority] ?? 1) - (PR[b.task.priority] ?? 1) ||
        String(a.task.deadline || '9999').localeCompare(String(b.task.deadline || '9999'))
    );
    const top = cands[0];
    return { task: top.task, count: top.deps.length, gated: top.deps.filter((d) => d.moneyGated).length };
  };

  S.readiness = () => {
    const crit = S.state.tasks.filter((t) => t.critical !== false);
    const money = crit.filter((t) => t.moneyGated);
    const work = crit.filter((t) => !t.moneyGated);
    const workDone = work.filter((t) => t.stage === 'done');
    const remaining = work.filter(S.open);
    const pct = work.length ? NS.sum(work, S.taskPct) / work.length : 0;
    const gateOpen = S.gateTotal() >= S.gateAmount();
    let status;
    if (!crit.length) status = 'empty';
    else if (!remaining.length) status = gateOpen ? 'go' : 'ready';
    else if (money.some(S.open)) status = 'hold';
    else status = 'building';
    return { status, pct, crit, money, work, workDone, remaining, gateOpen };
  };

  // ---------- life ----------
  S.lastDays = (n) => Array.from({ length: n }, (_, i) => NS.addDays(NS.today(), i - n + 1));

  S.areaStats = (k) => {
    const goals = S.state.goals.filter((g) => g.area === k);
    let xp = 0;
    goals.forEach((g) => {
      xp += (g.subtasks || []).filter((s) => s.done).length * 10;
      if (g.status === 'done') xp += 50;
    });
    const ms = S.metrics().filter((m) => m.area === k);
    S.lastDays(30).forEach((d) => {
      const c = S.state.checkins[d];
      if (c) ms.forEach((m) => m.test(c, d) && (xp += 2));
    });
    let hits = 0,
      tot = 0;
    S.lastDays(7).forEach((d) => {
      const c = S.state.checkins[d];
      if (c) ms.forEach((m) => { tot++; if (m.test(c, d)) hits++; });
    });
    return {
      xp,
      level: 1 + Math.floor(xp / 100),
      inLevel: xp % 100,
      week: tot ? hits / tot : null,
      hasMetrics: ms.length > 0,
      active: goals.filter((g) => g.status !== 'done').length,
      done: goals.filter((g) => g.status === 'done').length,
    };
  };

  S.owners = () => [{ k: 'me', label: 'Me' }, ...S.state.team.map((m) => ({ k: m.id, label: m.name || 'Unnamed' }))];
  S.ownerName = (t) => {
    if (!t.ownerId || t.ownerId === 'me') return 'Me';
    const m = S.state.team.find((x) => x.id === t.ownerId);
    return m ? m.name : 'Former team member';
  };

  S.nextRenewal = (s) => {
    if (!s.renews) return null;
    let d = s.renews;
    const T = NS.today();
    let guard = 0;
    while (d < T && guard++ < 600) d = NS.addMonths(d, s.cycle === 'yearly' ? 12 : 1);
    return d;
  };
  S.subYearly = (s) => (Number(s.cost) || 0) * (s.cycle === 'yearly' ? 1 : 12);

  // ---------- sample data ----------
  S.seed = () => {
    const st = S.empty();
    st.settings.sample = true;
    const T = NS.today();
    const d = (n) => NS.addDays(T, n);
    const id = NS.uid;
    const chk = (text, done) => ({ id: id(), text, done: !!done });
    const sub = (title, due, done, checklist) => ({ id: id(), title, due: due || '', done: !!done, checklist: checklist || [] });

    const [t1, t2, t3, t4, t5, t6, t7, t8] = [id(), id(), id(), id(), id(), id(), id(), id()];
    const task = (o) =>
      Object.assign(
        { created: d(-14), owner: 'Me', priority: 'medium', stage: 'backlog', start: '', deadline: '', waitingOn: '', moneyGated: false, critical: true, dependsOn: [], attachments: [], notes: '', subtasks: [] },
        o
      );
    st.tasks = [
      task({
        id: t1, name: 'Finalize offer & product page copy', stage: 'building', priority: 'high', start: d(-10), deadline: d(3),
        subtasks: [
          sub('Headline + hero section', d(1), false, [chk('Draft 3 headline options', 1), chk('Pick the winner', 1), chk('Write hero sub-copy', 0)]),
          sub('FAQ + guarantee', d(3), false, [chk('List top 8 objections', 1), chk('Write answers', 0), chk('Guarantee wording', 0)]),
        ],
        notes: 'One clear promise. Lead with the reactive-dog pain point.',
      }),
      task({
        id: t2, name: 'Set up checkout & payments', stage: 'waiting', priority: 'high', start: d(-7), deadline: d(5),
        waitingOn: 'Payment provider verification',
        subtasks: [
          sub('Connect payment gateway', d(2), false, [chk('Submit business documents', 1), chk('Verification approved', 0)]),
          sub('Test an order end-to-end', d(5), false, [chk('Place test order', 0), chk('Refund test order', 0), chk('Confirmation email looks right', 0)]),
        ],
      }),
      task({
        id: t3, name: 'Recruit 10 Lane A creators', stage: 'building', priority: 'medium', start: d(-5), deadline: d(12),
        subtasks: [
          sub('Build creator shortlist (40)', d(2), true),
          sub('Send outreach DMs', d(6), false, [chk('Batch 1 (20 DMs)', 1), chk('Batch 2 (20 DMs)', 0), chk('Follow-ups', 0)]),
          sub('Sign 10 creators', d(12), false),
        ],
      }),
      task({ id: t4, name: 'Film 5 UGC ad creatives', stage: 'backlog', priority: 'high', owner: 'Video editor (sample)', start: d(8), deadline: d(20), dependsOn: [t3] }),
      task({ id: t5, name: 'Install pixel + conversion tracking', stage: 'backlog', priority: 'medium', start: d(4), deadline: d(9), dependsOn: [t2] }),
      task({ id: t6, name: 'Launch Meta ads', stage: 'hold_money', priority: 'high', moneyGated: true, start: d(21), deadline: d(35), dependsOn: [t1, t2, t4, t5] }),
      task({ id: t7, name: 'Order first inventory batch', stage: 'hold_money', priority: 'high', moneyGated: true, start: d(21), deadline: d(30), dependsOn: [t2] }),
      task({ id: t8, name: 'Register the brand name', stage: 'done', priority: 'low', start: d(-30), deadline: d(-15), created: d(-35), completed: d(-16) }),
    ];

    const goal = (o) => Object.assign({ id: id(), status: 'in_progress', start: d(-14), due: '', where: '', notes: '', manualPct: 0, subtasks: [], created: d(-20) }, o);
    const y = T.slice(0, 4);
    st.goals = [
      goal({ title: 'Train 4× a week for 12 weeks', area: 'health', start: d(-21), due: d(63), where: 'Week 3 — hit 3 of 4 sessions last week',
        subtasks: [sub('Pick a program', d(-20), true), sub('Weeks 1–4', d(7)), sub('Weeks 5–8', d(35)), sub('Weeks 9–12', d(63))] }),
      goal({ title: 'In bed by 11pm, every night', area: 'health', start: d(-10), due: d(20), where: 'Phone out of the bedroom — 4/10 nights so far',
        subtasks: [sub('Charger moved out of bedroom', d(-9), true), sub('7 nights in a row', d(5)), sub('21 nights in a row', d(20))] }),
      goal({ title: 'Weekly date night, phones away', area: 'relationship', start: d(-14), due: d(76), where: '2 of 2 done this month',
        subtasks: [sub('Plan next 4 dates', d(2), true), sub('Date night — week 1', d(-7), true), sub('Date night — week 2', d(0)), sub('Date night — week 3', d(7))] }),
      goal({ title: `Read 12 books in ${y}`, area: 'learning', start: `${y}-01-01`, due: `${y}-12-31`, where: 'Book 8 — halfway through',
        subtasks: Array.from({ length: 12 }, (_, i) => sub(`Book ${i + 1}`, '', i < 7)) }),
      goal({ title: 'Learn Meta ads fundamentals', area: 'learning', status: 'not_started', start: d(3), due: d(30),
        subtasks: [sub('Finish an ads course', d(14)), sub('Write a test plan for PawMinds', d(25))] }),
      goal({ title: 'All 5 prayers on time — 30 days straight', area: 'habits', start: d(-12), due: d(18), where: 'Day 12 — Fajr is the weak one',
        subtasks: [sub('7 days', d(-5), true), sub('14 days', d(2)), sub('30 days', d(18))] }),
    ];

    // deterministic pseudo-random check-ins for the last 12 days
    let n = 11;
    const r = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    for (let i = 12; i >= 1; i--) {
      const sell = r() < 0.78;
      st.checkins[d(-i)] = {
        wakeOnTime: r() < 0.6, wakeTime: '07:00', sleepOnTime: r() < 0.45, sleepTime: '23:30',
        sleepHours: Math.round((5.5 + r() * 2.5) * 2) / 2,
        workedOn: sell ? ['Door-to-door', 'PawMinds'] : ['PawMinds'], d2dAmount: sell ? Math.round((1200 + r() * 1600) / 50) * 50 : 0,
        followUp: r() < 0.55, followUpCount: Math.floor(r() * 8),
        trained: r() < 0.6, calories: r() < 0.5, meditated: r() < 0.4 ? 15 : 0,
        prayers: S.PRAYERS.map(() => r() < 0.85),
        hours: { sales: sell ? 4 + Math.round(r() * 3) : 0, pawminds: 1 + Math.round(r() * 3), training: Math.round(r() * 2), wasted: Math.round(r() * 3) },
        workNote: sell ? 'Marina towers in the morning, PawMinds copy at night.' : 'PawMinds product page.',
        note: '',
      };
    }

    const wish = (o) => Object.assign({ id: id(), image: '', link: '', bought: false, priority: 'medium', currency: 'AED' }, o);
    const amz = (q) => 'https://www.amazon.ae/s?k=' + encodeURIComponent(q);
    st.wishlist = [
      wish({ name: 'Mirrorless camera', category: 'Content setup', price: 2899, priority: 'high', link: amz('mirrorless camera vlog') }),
      wish({ name: 'Wireless lav mic kit', category: 'Content setup', price: 129, currency: 'USD', priority: 'high', link: amz('wireless lavalier mic') }),
      wish({ name: 'LED key light', category: 'Content setup', price: 89, currency: 'USD', link: amz('led key light') }),
      wish({ name: 'Running shoes', category: 'Training', price: 520, bought: true, link: amz('running shoes') }),
      wish({ name: 'Adjustable dumbbells', category: 'Training', price: 1499, priority: 'low', link: amz('adjustable dumbbells') }),
      wish({ name: 'Standing desk', category: 'Home office', price: 349, currency: 'USD', priority: 'low', link: amz('standing desk') }),
    ];

    st.subs = [
      { id: id(), name: 'Shopify', cost: 39, currency: 'USD', cycle: 'monthly', renews: d(12), status: 'active', link: 'https://www.shopify.com', notes: 'Store' },
      { id: id(), name: 'Claude', cost: 20, currency: 'USD', cycle: 'monthly', renews: d(4), status: 'active', link: 'https://claude.ai', notes: '' },
      { id: id(), name: 'Google Workspace', cost: 7.2, currency: 'USD', cycle: 'monthly', renews: d(18), status: 'active', link: 'https://workspace.google.com', notes: 'Business email' },
      { id: id(), name: 'Canva Pro', cost: 450, currency: 'AED', cycle: 'yearly', renews: d(140), status: 'active', link: 'https://www.canva.com', notes: '' },
      { id: id(), name: 'CapCut Pro', cost: 9.99, currency: 'USD', cycle: 'monthly', renews: d(9), status: 'on_hold', link: '', notes: 'Pause until editor needs it' },
    ];

    st.team = [
      { id: id(), personId: 'P-001', name: 'Video editor (sample)', role: 'Edits UGC ads', cost: 1500, currency: 'AED', hireLink: '', trigger: 'Needed for the UGC ad pipeline', notes: '', email: '', portal: false, driveUrl: '' },
    ];
    st.bench = [
      { id: id(), name: 'Media buyer', why: 'Run and scale Meta ads once the gate opens', price: 3000, currency: 'AED', trigger: 'After the 40,000 AED gate', link: '', notes: '', status: 'considering' },
      { id: id(), name: 'Customer support VA', why: 'Handle DMs and emails after launch', price: 1200, currency: 'AED', trigger: 'At 30 orders a week', link: '', notes: '', status: 'considering' },
    ];
    // a few sample doors so the Door-to-door section has something to show
    const at = (days, hh) => `${d(days)}T${hh}`;
    const door = (o) => Object.assign({ id: id(), created: new Date().toISOString(), area: 'JLT', type: 'Café', dm: 'yes', dmRole: 'owner', services: [], qty: 1, notes: '', objections: [], licence: false, texts: {}, replied: false }, o);
    st.doors = [
      door({ name: 'Café Nero (sample)', at: at(0, '10:20'), dmRole: 'manager', dmName: 'Dani', services: ['cards'], qty: 5, price: 500, status: 'meeting', meetAt: at(0, '16:00'), askFor: 'Dani', bring: ['cards', 'price_sheet'], phone: '0501234567', objections: ['too_expensive'] }),
      door({ name: 'Glow Salon (sample)', area: 'Marina', type: 'Salon', at: at(-1, '12:05'), services: ['website', 'content'], price: 3500, status: 'follow_up', nextAt: d(0), phone: '0559876543', objections: ['send_info'], texts: { first: new Date(Date.now() - 864e5 * 2).toISOString() } }),
      door({ name: 'Iron Gym (sample)', area: 'Marina', type: 'Gym', at: at(0, '11:40'), dm: 'no', services: ['ads'], price: 2500, status: 'pitched', phone: '0524445566', objections: ['needs_owner'] }),
      door({ name: 'Bloom Florist (sample)', area: 'JLT', type: 'Retail', at: at(-3, '15:10'), services: ['cards'], qty: 10, price: 900, status: 'closed', depositPaid: true, depositAmount: 450, depositDate: d(-3) }),
    ];

    return S.normalize(st);
  };
})(window.NS);
