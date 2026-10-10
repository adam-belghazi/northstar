(function (NS) {
  const { S, A, C, V, esc, icon } = NS;
  const ui = NS.ui;
  const PR = { high: 0, medium: 1, low: 2 };
  const byPrio = (a, b) => (PR[a.priority] ?? 1) - (PR[b.priority] ?? 1) || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999'));
  const cloudOwner = () => NS.Cloud.mode === 'cloud' && NS.Cloud.role === 'owner';

  // =====================================================================
  // PIPELINE
  // =====================================================================
  NS.kcard = (t, opts = {}) => {
    const pr = S.find(S.PRIOS, t.priority);
    const blocked = opts.noDeps ? [] : S.unfinishedDeps(t);
    const p = S.taskPct(t);
    const subs = t.subtasks || [];
    const late = t.stage !== 'done' && NS.isOverdue(t.deadline);
    const atts = (t.attachments || []).length;
    const who = opts.owner || S.ownerName(t);
    return `<div class="kcard ${t.stage === 'done' ? 'is-done' : ''}" draggable="true" data-drag="${t.id}" data-a="${opts.action || 'editTask'}" data-id="${t.id}" style="--c:${pr.color}" tabindex="0">
      <div class="kc-top"><span class="dot" title="${pr.label} priority"></span><span class="kc-name">${esc(t.name)}</span></div>
      ${t.stage === 'waiting' && t.waitingOn ? `<div class="kc-wait">Waiting on: ${esc(t.waitingOn)}</div>` : ''}
      ${subs.length ? `<div class="prog sm">${NS.bar(p, 'var(--p1)', 'sm')}<span class="num small">${NS.pct(p)}</span></div>` : ''}
      <div class="kc-meta"><span class="who"><span class="av">${esc(NS.initials(who))}</span>${esc(who)}</span>
        ${t.deadline ? `<span class="${late ? 'red' : ''}">${icon('cal', 12)} ${t.stage === 'done' ? NS.fmtDate(t.deadline) : NS.rel(t.deadline)}</span>` : ''}</div>
      ${t.moneyGated || blocked.length || atts
        ? `<div class="kc-badges">${t.moneyGated ? NS.chip('Needs money', 'var(--p2)') : ''}${blocked.length ? NS.chip('Blocked by ' + blocked.length, 'var(--danger)') : ''}${atts ? `<span class="chip">${icon('clip', 11)} ${atts}</span>` : ''}</div>`
        : ''}
    </div>`;
  };

  NS.board = (tasks, opts = {}) =>
    `<div class="kb" data-keep="kb">${S.STAGES.map((s) => {
      const list = tasks.filter((t) => t.stage === s.k).sort(byPrio);
      return `<div class="col" data-drop="${s.k}" style="--c:${s.color}">
        <div class="col-h"><span class="dot"></span><b>${s.label}</b><span class="dim">${list.length}</span></div>
        ${s.k === 'hold_money' && !opts.contractor ? `<div class="col-note">Behind the ${NS.fmtMoney(S.gateAmount(), 'AED')} gate</div>` : ''}
        ${list.map((t) => NS.kcard(t, opts)).join('')}
        ${opts.contractor ? '' : `<button type="button" class="btn ghost sm add-in" data-a="newTask" data-stage="${s.k}">${icon('plus', 14)}<span>Add</span></button>`}
      </div>`;
    }).join('')}</div>`;

  V.pipeline = () => {
    const mode = ui.pipeView || 'board';
    const owner = ui.pipeOwner || 'all';
    const tasks = S.state.tasks.filter((t) => owner === 'all' || (t.ownerId || 'me') === owner);
    const actions = `${NS.seg(
      [
        { k: 'board', label: 'Board', icon: 'kanban' },
        { k: 'timeline', label: 'Timeline', icon: 'timeline' },
        { k: 'calendar', label: 'Calendar', icon: 'cal' },
      ],
      mode,
      'pipeView'
    )}
      <select class="sel" data-c="pipeOwner" aria-label="Filter by owner"><option value="all">Everyone</option>${S.owners()
        .map((o) => `<option value="${esc(o.k)}" ${owner === o.k ? 'selected' : ''}>${esc(o.label)}</option>`)
        .join('')}</select>
      <button type="button" class="btn pri" data-a="newTask">${icon('plus', 16)}<span>Task</span></button>`;

    let body;
    if (mode === 'timeline') {
      body = `<div class="card flush">${NS.gantt(
        tasks.map((t) => ({
          label: t.name,
          sub: `${S.find(S.STAGES, t.stage).label} · ${S.ownerName(t)}`,
          start: t.start || t.created,
          end: t.deadline,
          color: S.find(S.STAGES, t.stage).color,
          pct: S.taskPct(t),
          attrs: `data-a="editTask" data-id="${t.id}"`,
        })),
        'tasksGantt'
      )}</div>
      <div class="legend" style="margin-top:14px">${S.STAGES.map((s) => `<span><span class="dot" style="--c:${s.color}"></span>${s.label}</span>`).join('')}<span><span class="dot" style="--c:var(--danger)"></span>Red outline = overdue</span></div>`;
    } else if (mode === 'calendar') {
      const evs = [];
      tasks.forEach((t) => {
        const col = S.find(S.STAGES, t.stage).color;
        if (t.deadline) evs.push({ date: t.deadline, label: '◆ ' + t.name, color: col, done: t.stage === 'done', attrs: `data-a="editTask" data-id="${t.id}"` });
        (t.subtasks || []).forEach((s) => s.due && evs.push({ date: s.due, label: s.title, color: col, done: S.subPct(s) === 1, attrs: `data-a="editTask" data-id="${t.id}"` }));
      });
      body = NS.calendar('tasks', evs) + `<div class="dim small" style="margin-top:10px">◆ = task deadline · plain = subtask due date</div>`;
    } else {
      body = NS.board(tasks) + `<div class="dim small" style="margin-top:10px">Drag cards between columns. On a phone, open a card and change its stage.</div>`;
    }
    return `${NS.head('Pipeline', 'Everything PawMinds needs, from idea to done.', actions)}${body}`;
  };
  A.pipeView = (el) => { ui.pipeView = el.dataset.v; NS.render(); };
  C.pipeOwner = (el) => { ui.pipeOwner = el.value; NS.render(); };

  NS.moveTask = (id, stage) => {
    const t = S.task(id);
    if (!t || t.stage === stage) return;
    t.stage = stage;
    if (stage === 'hold_money' && !t.moneyGated) {
      t.moneyGated = true;
      NS.toast('Marked as needing money');
    }
    if (stage === 'done') {
      t.completed = NS.today();
      NS.celebrate(id);
      const freed = S.state.tasks.filter((x) => S.open(x) && (x.dependsOn || []).includes(id) && S.unfinishedDeps(x).length === 0);
      if (freed.length) NS.toast(`Unblocked: ${freed.map((x) => x.name).join(', ')}`);
    }
    S.save();
    NS.render();
  };

  const taskFields = (t) => [
    { k: 'name', label: 'Task', full: true, ph: 'e.g. Set up checkout & payments' },
    { k: 'stage', label: 'Stage', type: 'select', options: S.STAGES },
    { k: 'priority', label: 'Priority', type: 'select', options: S.PRIOS },
    { k: 'ownerId', label: 'Owner', type: 'select', options: S.owners(), hint: 'Assign a contractor and it shows up on their portal board.' },
    { k: 'waitingOn', label: 'Waiting on (person / thing)', ph: 'e.g. Payment provider verification' },
    { k: 'start', label: 'Start', type: 'date' },
    { k: 'deadline', label: 'Deadline', type: 'date' },
    { k: 'moneyGated', label: 'Needs money', type: 'check', hint: `Can't start until the ${NS.fmtMoney(S.gateAmount(), 'AED')} gate opens.` },
    { k: 'critical', label: 'Needed before PawMinds takes money', type: 'check', hint: 'Counts toward launch readiness.' },
    {
      k: 'dependsOn',
      label: 'Depends on (finish these first)',
      type: 'multi',
      full: true,
      options: S.state.tasks.filter((x) => x.id !== t.id).map((x) => ({ k: x.id, label: x.name })),
      empty: 'No other tasks yet.',
    },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
    { k: '_created', label: 'Created', type: 'static', html: NS.fmtDate(t.created, { day: 'numeric', month: 'short', year: 'numeric' }) },
  ];

  NS.editTask = (id, preset = {}) => {
    const existing = S.task(id);
    ui.draft = existing
      ? NS.clone(existing)
      : Object.assign(
          { id: NS.uid(), name: '', created: NS.today(), ownerId: 'me', priority: 'medium', stage: 'backlog', start: NS.today(), deadline: '', waitingOn: '', moneyGated: false, critical: true, dependsOn: [], attachments: [], notes: '', subtasks: [] },
          preset
        );
    if (ui.draft.stage === 'hold_money') ui.draft.moneyGated = true;
    const f = taskFields(ui.draft);
    NS.openModal({
      title: existing ? 'Edit task' : 'New task',
      wide: true,
      body: NS.fields(f, ui.draft) + NS.subEditor('task') + NS.fileSection('task', ui.draft.id) + NS.attEditor(),
      onSave: (form) => {
        const vals = NS.readForm(form, f);
        if (!vals.name) { NS.toast('Give the task a name'); return false; }
        const t = Object.assign(ui.draft, vals);
        t.subtasks = t.subtasks.filter((s) => s.title.trim() || (s.checklist || []).length);
        t.subtasks.forEach((s) => {
          s.checklist = (s.checklist || []).filter((c) => c.text.trim());
          if (s.checklist.length) s.done = s.checklist.every((c) => c.done);
        });
        t.attachments = t.attachments.filter((a) => a.url.trim() || a.name.trim());
        if (t.stage === 'done' && !t.completed) t.completed = NS.today();
        if (existing) Object.assign(existing, t);
        else S.state.tasks.push(t);
      },
      onDelete: existing
        ? () => {
            S.state.tasks = S.state.tasks.filter((t) => t.id !== id);
            S.state.tasks.forEach((t) => (t.dependsOn = (t.dependsOn || []).filter((d) => d !== id)));
          }
        : null,
    });
    NS.loadFileSection();
  };
  A.editTask = (el) => NS.editTask(el.dataset.id);
  A.newTask = (el) => NS.editTask(null, el.dataset.stage ? { stage: el.dataset.stage, moneyGated: el.dataset.stage === 'hold_money' } : {});

  // =====================================================================
  // FILE LISTS (task attachments, portal files, brand kit) — cloud only
  // =====================================================================
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  NS.fileRow = (f, canDelete) => `<div class="file-row">
      ${icon('clip', 15)}
      <button type="button" class="linkish grow file-name" data-a="openFile" data-path="${esc(f.path)}">${esc(f.name)}</button>
      <span class="dim small">${f.size ? fmtSize(f.size) : ''} · ${NS.fmtDate(String(f.created_at).slice(0, 10))}</span>
      ${canDelete ? `<button type="button" class="btn ghost sm icon-only" data-a="deleteFile" data-id="${f.id}" data-path="${esc(f.path)}" aria-label="Delete file">${icon('trash', 14)}</button>` : ''}
    </div>`;
  NS.fileSection = (scope, refId) => {
    if (NS.Cloud.mode !== 'cloud') return '';
    return `<div class="subed" id="files-${scope}" data-scope="${scope}" data-ref="${esc(refId)}">
      <div class="subed-h"><span class="fl">Uploaded files</span>
        <label class="btn sm">${icon('upload', 14)}<span>Upload</span><input type="file" multiple hidden data-c="uploadFiles" data-scope="${scope}" data-ref="${esc(refId)}"></label></div>
      <div class="file-list"><div class="dim small">Loading…</div></div>
    </div>`;
  };
  NS.loadFileSection = async () => {
    const box = document.querySelector('[id^="files-"]');
    if (!box) return;
    try {
      const rows = await NS.Cloud.files(box.dataset.scope, box.dataset.ref);
      const list = box.querySelector('.file-list');
      if (list) list.innerHTML = rows.length ? rows.map((f) => NS.fileRow(f, NS.Cloud.role === 'owner')).join('') : '<div class="dim small">No files yet.</div>';
    } catch (e) {
      box.querySelector('.file-list').innerHTML = `<div class="red small">${esc(e.message)}</div>`;
    }
  };
  C.uploadFiles = async (el) => {
    const files = [...el.files];
    el.value = '';
    if (!files.length) return;
    NS.toast(`Uploading ${NS.plural(files.length, 'file')}…`);
    try {
      for (const f of files) await NS.Cloud.upload(el.dataset.scope, el.dataset.ref, f);
      NS.toast('Uploaded');
      if (NS.Cloud.role === 'contractor') NS.Cloud.ping(`uploaded ${files.map((f) => f.name).join(', ')}`);
    } catch (e) {
      NS.toast('Upload failed: ' + e.message);
    }
    if (document.querySelector('[id^="files-"]')) NS.loadFileSection();
    else NS.onPortalChange && NS.onPortalChange(true);
  };
  A.openFile = (el) => NS.Cloud.openFile(el.dataset.path);
  A.deleteFile = async (el) => {
    if (!el.dataset.armed) {
      el.dataset.armed = '1';
      el.classList.add('danger');
      NS.toast('Tap the bin again to delete');
      return;
    }
    try {
      await NS.Cloud.deleteFile({ id: el.dataset.id, path: el.dataset.path });
      NS.toast('Deleted');
    } catch (e) {
      NS.toast(e.message);
    }
    if (document.querySelector('[id^="files-"]')) NS.loadFileSection();
    else NS.onPortalChange && NS.onPortalChange(true);
  };

  // =====================================================================
  // LAUNCH READINESS + MONEY GATE
  // =====================================================================
  NS.focusCard = () => {
    const f = S.focus();
    if (!f) return '';
    const gateOpen = S.gateTotal() >= S.gateAmount();
    return `<div class="card focus">
      <div class="grow">
        <div class="eyebrow">${icon('alert', 13)} Critical path</div>
        <h2>Stop. Finish “${esc(f.task.name)}” first.</h2>
        <p>${f.count === 1 ? '1 task depends' : f.count + ' tasks depend'} on it${f.gated ? `, including ${f.gated} behind the money gate` : ''}. It doesn't need money, so there's no reason to wait.
        ${gateOpen ? 'The money is in, so this is the only thing standing between you and launch.' : `Finish it now, and when the ${NS.fmtMoney(S.gateAmount(), 'AED')} lands you'll know exactly where to plug it in.`}</p>
      </div>
      <button type="button" class="btn pri" data-a="editTask" data-id="${f.task.id}">Open task</button>
    </div>`;
  };

  NS.READY = {
    empty: { label: 'Nothing tracked yet', color: 'var(--dim)', desc: 'Add PawMinds tasks in the Pipeline to see how ready you are.' },
    building: { label: 'Building', color: 'var(--p1)', desc: 'Core work is still in progress. Nothing is waiting on money yet.' },
    hold: { label: 'Waiting on money, with work left', color: 'var(--p2)', desc: "Some tasks need money, but there's still work you can finish without it. Do that now so the money has somewhere to go." },
    ready: { label: 'Ready for money', color: 'var(--p1)', desc: "Everything that doesn't need money is done. Once the gate opens, plug the money in." },
    go: { label: 'Gate open. Go.', color: 'var(--p1)', desc: 'Everything is built and the money is in. Launch the money-gated tasks.' },
  };

  NS.gateCard = (compact) => {
    const total = S.gateTotal();
    const amt = S.gateAmount();
    const p = total / amt;
    const usd = S.state.settings.currency === 'USD';
    return `<div class="card gate">
      <div class="card-h"><h3>${icon('coins', 15)} Money gate</h3><button type="button" class="btn ghost sm" data-a="editGate">${icon('edit', 13)}<span>Edit</span></button></div>
      <div class="gate-row">
        ${NS.ring(p, { size: compact ? 96 : 120, color: 'var(--p1)', label: NS.pct(Math.min(p, 1)) })}
        <div>
          <div class="big num">${Math.round(total).toLocaleString('en-US')}<span class="unit"> / ${amt.toLocaleString('en-US')} AED</span></div>
          ${usd ? `<div class="dim small">≈ ${NS.fmtMoney(NS.convert(total, 'AED', 'USD'), 'USD')} of ${NS.fmtMoney(NS.convert(amt, 'AED', 'USD'), 'USD')}</div>` : ''}
          <div class="muted" style="margin-top:6px">${p >= 1 ? 'Unlocked: ' : 'Unlocks: '}<b>${esc(S.state.settings.gateLabel || 'Run PawMinds ads')}</b></div>
          ${p < 1 ? `<div class="dim small">${NS.fmtMoney(amt - total, 'AED')} to go</div>` : ''}
        </div>
      </div>
    </div>`;
  };

  V.readiness = () => {
    const r = S.readiness();
    const R = NS.READY[r.status];
    const actions = `<button type="button" class="btn" data-a="newIncome">${icon('coins', 16)}<span>Log income</span></button>
      <button type="button" class="btn pri" data-a="newTask">${icon('plus', 16)}<span>Task</span></button>`;

    const row = (t, extra = '') => {
      const st = S.find(S.STAGES, t.stage);
      const who = S.ownerName(t);
      return `<button type="button" class="li" data-a="editTask" data-id="${t.id}">
        <span class="dot" style="--c:${st.color}"></span>
        <span class="grow"><span class="li-t">${esc(t.name)}</span><span class="li-s">${st.label}${who !== 'Me' ? ' · ' + esc(who) : ''}${t.stage === 'done' ? (t.completed ? ' · finished ' + NS.fmtDate(t.completed) : '') : t.deadline ? ' · ' + NS.rel(t.deadline) : ''}${extra}</span></span>
        <span class="li-p">${NS.bar(S.taskPct(t), 'var(--p1)', 'sm')}<span class="num small">${NS.pct(S.taskPct(t))}</span></span>
      </button>`;
    };

    const building = r.remaining.filter((t) => t.stage !== 'waiting').sort(byPrio);
    const waiting = S.state.tasks.filter((t) => S.open(t) && !t.moneyGated && (t.stage === 'waiting' || S.unfinishedDeps(t).length));
    const gated = r.money.filter(S.open);
    const done = r.workDone;
    const income = S.incomeEntries().slice(0, 8);

    return `${NS.head('Launch readiness', 'Is PawMinds ready for money to come in?', actions)}
      <div class="card status" style="--c:${R.color}">
        ${NS.ring(r.pct, { size: 124, color: 'var(--p1)', label: NS.pct(r.pct), sub: 'built' })}
        <div class="grow">
          <div class="eyebrow">Current stage</div>
          <h2>${R.label}</h2>
          <p class="muted">${R.desc}</p>
          <div class="kpis">
            <span><b class="num">${r.workDone.length}/${r.work.length}</b> launch tasks done</span>
            <span><b class="num">${r.remaining.length}</b> left that don't need money</span>
            <span><b class="num">${gated.length}</b> waiting on money</span>
          </div>
        </div>
      </div>
      ${NS.focusCard()}
      <div class="grid g2">
        <div class="card"><h3>What we're building <span class="dim">${building.length}</span></h3>
          <div class="list">${building.length ? building.map((t) => row(t)).join('') : '<div class="dim small">Nothing in progress.</div>'}</div></div>
        <div class="card"><h3>What we're waiting on <span class="dim">${waiting.length}</span></h3>
          <div class="list">${waiting.length
            ? waiting.map((t) => {
                const deps = S.unfinishedDeps(t);
                const why = t.stage === 'waiting' && t.waitingOn ? ` · waiting on ${esc(t.waitingOn)}` : deps.length ? ` · blocked by ${deps.map((d) => esc(d.name)).join(', ')}` : '';
                return row(t, why);
              }).join('')
            : '<div class="dim small">Nothing blocked.</div>'}</div></div>
      </div>
      <div class="grid g2">
        <div class="stack-col">${NS.gateCard()}
          <div class="card"><h3>Income log</h3>
            <div class="list">${income.length
              ? income.map((i) => `<div class="li static"><span class="grow"><span class="li-t">${esc(i.note || 'Income')}</span><span class="li-s">${NS.fmtDate(i.date)} · ${i.source === 'checkin' ? 'from check-in' : i.source === 'door' ? 'from Doors' : 'manual'}</span></span>
                  <b class="num">${NS.fmtMoney(i.amount, i.currency || 'AED')}</b>${i.source === 'manual' ? `<button type="button" class="btn ghost sm icon-only" data-a="editIncome" data-id="${i.id}" aria-label="Edit">${icon('edit', 14)}</button>` : ''}</div>`).join('')
              : '<div class="dim small">Log door-to-door earnings in the daily check-in, or add income here.</div>'}</div></div>
        </div>
        <div class="card"><h3>Behind the money gate <span class="dim">${gated.length}</span></h3>
          <div class="list">${gated.length
            ? gated.sort(byPrio).map((t) => {
                const deps = S.unfinishedDeps(t);
                return `<button type="button" class="li" data-a="editTask" data-id="${t.id}">
                  <span class="gate-st ${deps.length ? 'no' : 'yes'}">${icon(deps.length ? 'lock' : 'check', 14)}</span>
                  <span class="grow"><span class="li-t">${esc(t.name)}</span>
                  <span class="li-s">${deps.length ? 'Still needs: ' + deps.map((d) => esc(d.name)).join(', ') : r.gateOpen ? 'Ready. Go.' : 'Ready to fire as soon as the money lands'}</span></span></button>`;
              }).join('')
            : '<div class="dim small">No tasks marked as needing money.</div>'}</div>
          ${done.length ? `<h3 style="margin-top:24px">Built ${icon('check', 14)} <span class="dim">${done.length}</span></h3><div class="list">${done.map((t) => row(t)).join('')}</div>` : ''}
        </div>
      </div>`;
  };

  const gateFields = [
    { k: 'gateAmount', label: 'Target (AED)', type: 'number', hint: 'How much you need before PawMinds can run on money alone.' },
    { k: 'gateLabel', label: 'What it unlocks', ph: 'e.g. Run PawMinds ads' },
  ];
  A.editGate = (el, e) => {
    e && e.preventDefault();
    NS.openModal({
      title: 'Money gate',
      body: NS.fields(gateFields, S.state.settings) + `<p class="dim small" style="margin-top:10px">Progress = door deposits + other earnings in your check-ins + income you log here. Now: <b>${NS.fmtMoney(S.gateTotal(), 'AED')}</b>.</p>`,
      onSave: (form) => {
        const v = NS.readForm(form, gateFields);
        if (!(v.gateAmount > 0)) { NS.toast('Enter a target above 0'); return false; }
        Object.assign(S.state.settings, v);
      },
    });
  };

  const incomeFields = [
    { k: 'date', label: 'Date', type: 'date' },
    { k: 'amount', label: 'Amount', type: 'money', cur: 'currency' },
    { k: 'note', label: 'Source', full: true, ph: 'e.g. Commission bonus' },
  ];
  NS.editIncome = (id) => {
    const existing = S.state.income.find((i) => i.id === id);
    const obj = existing ? NS.clone(existing) : { id: NS.uid(), date: NS.today(), amount: null, currency: 'AED', note: '' };
    NS.openModal({
      title: existing ? 'Edit income' : 'Log income',
      body: `${NS.fields(incomeFields, obj)}<p class="dim small">Daily door-to-door earnings belong in the check-in. Use this for anything else that counts toward the gate.</p>`,
      onSave: (form) => {
        const v = NS.readForm(form, incomeFields);
        if (!(v.amount > 0)) { NS.toast('Enter an amount'); return false; }
        if (existing) Object.assign(existing, v);
        else S.state.income.push(Object.assign(obj, v));
      },
      onDelete: existing ? () => (S.state.income = S.state.income.filter((i) => i.id !== id)) : null,
    });
  };
  A.newIncome = () => NS.editIncome(null);
  A.editIncome = (el) => NS.editIncome(el.dataset.id);

  // =====================================================================
  // TEAM: active roster + hiring bench
  // =====================================================================
  V.team = () => {
    const tab = ui.teamTab || 'active';
    const cur = S.state.settings.currency;
    const monthly = NS.sum(S.state.team, (m) => NS.convert(Number(m.cost) || 0, m.currency || 'AED', cur));
    const benchCost = NS.sum(S.state.bench, (b) => NS.convert(Number(b.price) || 0, b.currency || 'AED', cur));
    const actions = `${NS.seg(
      [
        { k: 'active', label: `Active · ${S.state.team.length}` },
        { k: 'bench', label: `Bench · ${S.state.bench.length}` },
      ],
      tab,
      'teamTab'
    )}<button type="button" class="btn pri" data-a="${tab === 'active' ? 'newMember' : 'newBench'}">${icon('plus', 16)}<span>${tab === 'active' ? 'Person' : 'Candidate'}</span></button>`;

    const link = (u) => (NS.safeUrl(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="linkish">${icon('ext', 13)} Open</a>` : '<span class="dim">—</span>');
    let table;
    if (tab === 'active') {
      table = S.state.team.length
        ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Name</th><th>Role / asset</th><th class="r">Est. cost / mo</th><th>Hire trigger</th><th>Hiring link</th><th>Portal</th></tr></thead><tbody>
          ${S.state.team.map((m) => `<tr data-a="editMember" data-id="${m.id}">
            <td class="dim num">${esc(m.personId)}</td>
            <td><span class="who"><span class="av">${esc(NS.initials(m.name))}</span><b>${esc(m.name)}</b></span></td>
            <td>${esc(m.role)}</td>
            <td class="r num">${NS.disp(m.cost, m.currency)}</td>
            <td>${esc(m.trigger)}</td>
            <td>${link(m.hireLink)}</td>
            <td>${m.portal && m.email ? `<a class="linkish" href="#/hq/portal/${m.id}">${icon('door', 13)} Open</a>` : '<span class="dim">Off</span>'}</td>
          </tr>`).join('')}</tbody></table></div>`
        : NS.emptyState('No one on the team yet.');
    } else {
      table = S.state.bench.length
        ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name / role</th><th>Why hire</th><th class="r">Est. price / mo</th><th>When to hire</th><th>Status</th><th>Link</th><th></th></tr></thead><tbody>
          ${S.state.bench.map((b) => {
            const st = S.find(S.BENCH_STATUS, b.status);
            return `<tr data-a="editBench" data-id="${b.id}">
              <td><b>${esc(b.name)}</b></td><td class="clip">${esc(b.why)}</td><td class="r num">${NS.disp(b.price, b.currency)}</td>
              <td>${esc(b.trigger)}</td><td>${NS.chip(st.label, st.color)}</td><td>${link(b.link)}</td>
              <td class="r"><button type="button" class="btn sm" data-a="hire" data-id="${b.id}">Hire →</button></td>
            </tr>`;
          }).join('')}</tbody></table></div>`
        : NS.emptyState('Nobody on the bench. Add the roles you plan to hire and what should trigger each hire.');
    }
    return `${NS.head('Team', 'Who you have, who you need next, and what triggers each hire.', actions)}
      <div class="grid g3">
        ${NS.stat('Active team', S.state.team.length, 'people')}
        ${NS.stat('Team cost', NS.fmtMoney(monthly, cur), 'per month, estimated', 'var(--p1)')}
        ${NS.stat('If you hire the bench', '+' + NS.fmtMoney(benchCost, cur), 'per month on top')}
      </div>${table}`;
  };
  A.teamTab = (el) => { ui.teamTab = el.dataset.v; NS.render(); };

  const memberFields = () => [
    { k: 'name', label: 'Name' },
    { k: 'personId', label: 'Person ID' },
    { k: 'role', label: 'Role / asset', full: true, ph: 'What they handle or bring' },
    { k: 'cost', label: 'Estimated cost / month', type: 'money', cur: 'currency' },
    { k: 'trigger', label: 'Hire trigger', ph: 'What made you hire them' },
    { k: 'hireLink', label: 'Hiring link', type: 'url', full: true, ph: 'Upwork / Fiverr / LinkedIn profile' },
    { k: 'notes', label: 'Private notes', type: 'textarea', full: true, hint: 'Only you see this. Contractors never see cost, trigger or notes.' },
    { k: 'email', label: 'Portal login email', type: 'email', ph: 'their@email.com' },
    { k: 'portal', label: 'Give them a portal', type: 'check', hint: NS.Cloud.mode === 'cloud' ? 'Then press “Send login” on their portal page.' : 'Portals go live once cloud sync is connected.' },
    { k: 'driveUrl', label: 'Google Drive folder (optional)', type: 'url', full: true, ph: 'https://drive.google.com/drive/folders/…', hint: 'Shown inside their portal. Share the folder with their email first.' },
  ];
  const nextPersonId = () => {
    const nums = S.state.team.map((m) => parseInt(String(m.personId || '').replace(/\D/g, ''), 10) || 0);
    return 'P-' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
  };
  NS.editMember = (id, preset) => {
    const existing = S.state.team.find((m) => m.id === id);
    const obj = existing ? NS.clone(existing) : Object.assign({ id: NS.uid(), personId: nextPersonId(), name: '', role: '', cost: null, currency: 'AED', trigger: '', hireLink: '', notes: '', email: '', portal: false, driveUrl: '' }, preset || {});
    const f = memberFields();
    NS.openModal({
      title: existing ? 'Edit team member' : 'Add team member',
      body: NS.fields(f, obj),
      onSave: (form) => {
        const v = NS.readForm(form, f);
        if (!v.name) { NS.toast('Add a name'); return false; }
        if (v.portal && !/^\S+@\S+\.\S+$/.test(v.email)) { NS.toast('Add a valid email to give them a portal'); return false; }
        if (v.email && S.state.team.some((m) => m.id !== obj.id && (m.email || '').toLowerCase() === v.email.toLowerCase())) {
          NS.toast('Another team member already uses that email');
          return false;
        }
        if (existing) Object.assign(existing, v);
        else S.state.team.push(Object.assign(obj, v));
      },
      onDelete: existing
        ? () => {
            S.state.team = S.state.team.filter((m) => m.id !== id);
            S.state.tasks.forEach((t) => t.ownerId === id && (t.ownerId = 'me'));
          }
        : null,
    });
  };
  A.newMember = () => NS.editMember(null);
  A.editMember = (el) => NS.editMember(el.dataset.id);

  const benchFields = [
    { k: 'name', label: 'Name or role', full: true },
    { k: 'why', label: 'Why hire', type: 'textarea', full: true, rows: 2 },
    { k: 'price', label: 'Estimated price / month', type: 'money', cur: 'currency' },
    { k: 'status', label: 'Status', type: 'select', options: S.BENCH_STATUS },
    { k: 'trigger', label: 'When to hire (trigger)', full: true, ph: 'e.g. After the 40,000 AED gate, or at 30 orders a week' },
    { k: 'link', label: 'Link', type: 'url', full: true },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
  NS.editBench = (id) => {
    const existing = S.state.bench.find((b) => b.id === id);
    const obj = existing ? NS.clone(existing) : { id: NS.uid(), name: '', why: '', price: null, currency: 'AED', trigger: '', link: '', notes: '', status: 'considering' };
    NS.openModal({
      title: existing ? 'Edit candidate' : 'Add to hiring bench',
      body: NS.fields(benchFields, obj),
      onSave: (form) => {
        const v = NS.readForm(form, benchFields);
        if (!v.name) { NS.toast('Add a name or role'); return false; }
        if (existing) Object.assign(existing, v);
        else S.state.bench.push(Object.assign(obj, v));
      },
      onDelete: existing ? () => (S.state.bench = S.state.bench.filter((b) => b.id !== id)) : null,
    });
  };
  A.newBench = () => NS.editBench(null);
  A.editBench = (el) => NS.editBench(el.dataset.id);
  A.hire = (el) => {
    const b = S.state.bench.find((x) => x.id === el.dataset.id);
    if (!b) return;
    NS.editMember(null, { name: b.name, role: b.why, cost: b.price, currency: b.currency, trigger: b.trigger, hireLink: b.link, notes: b.notes });
    const save = NS.ui.modal.onSave;
    NS.ui.modal.onSave = (form) => {
      const res = save(form);
      if (res === false) return false;
      S.state.bench = S.state.bench.filter((x) => x.id !== b.id);
      ui.teamTab = 'active';
      NS.toast(`${b.name} moved to the active team`);
    };
  };

  // =====================================================================
  // SUBSCRIPTIONS
  // =====================================================================
  V.subs = () => {
    const cur = S.state.settings.currency;
    const subs = S.state.subs.map((s) => Object.assign({}, s, { next: S.nextRenewal(s) }));
    const active = subs.filter((s) => s.status === 'active');
    const yearly = NS.sum(active, (s) => NS.convert(S.subYearly(s), s.currency || 'AED', cur));
    const soon = active.filter((s) => s.next && NS.diff(NS.today(), s.next) <= 7).sort((a, b) => (a.next < b.next ? -1 : 1));
    const order = { active: 0, on_hold: 1, cancelled: 2 };
    subs.sort((a, b) => order[a.status] - order[b.status] || String(a.next || '9999').localeCompare(String(b.next || '9999')));

    const actions = `<button type="button" class="btn pri" data-a="newSub">${icon('plus', 16)}<span>Subscription</span></button>`;
    const table = subs.length
      ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Status</th><th class="r">Cost</th><th>Cycle</th><th class="r">Yearly</th><th>Renews</th><th>Notes</th></tr></thead><tbody>
        ${subs.map((s) => {
          const st = S.find(S.SUB_STATUS, s.status);
          const days = s.next ? NS.diff(NS.today(), s.next) : null;
          const link = NS.safeUrl(s.link);
          return `<tr data-a="editSub" data-id="${s.id}" class="${s.status === 'cancelled' ? 'faded' : ''}">
            <td><b>${esc(s.name)}</b> ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="linkish" aria-label="Open app">${icon('ext', 13)}</a>` : ''}</td>
            <td>${NS.chip(st.label, st.color)}</td>
            <td class="r num">${NS.disp(s.cost, s.currency)}${(s.currency || 'AED') !== cur ? `<div class="dim small">${NS.fmtMoney(s.cost, s.currency)}</div>` : ''}</td>
            <td>${s.cycle === 'yearly' ? 'Yearly' : 'Monthly'}</td>
            <td class="r num">${NS.disp(S.subYearly(s), s.currency)}</td>
            <td class="${s.status === 'active' && days != null && days <= 7 ? 'accent-text' : ''}">${s.next ? `${NS.fmtDate(s.next)} <span class="dim small">${s.status === 'active' && days < 14 ? NS.rel(s.next) : ''}</span>` : '—'}</td>
            <td class="clip">${esc(s.notes)}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : NS.emptyState('No subscriptions tracked yet.');

    return `${NS.head('Subscriptions', 'What you pay for, what it costs a year, and what renews next.', actions)}
      <div class="grid g4">
        ${NS.stat('Monthly burn', NS.fmtMoney(yearly / 12, cur), 'active only', 'var(--p1)')}
        ${NS.stat('Yearly cost', NS.fmtMoney(yearly, cur), NS.plural(active.length, 'active subscription'))}
        ${NS.stat('Renewing in 7 days', soon.length, soon.map((s) => esc(s.name)).join(', ') || 'Nothing soon')}
        ${NS.stat('On hold / cancelled', subs.length - active.length, 'not counted in totals')}
      </div>${table}`;
  };
  const subFields = [
    { k: 'name', label: 'Name', full: true },
    { k: 'cost', label: 'Cost', type: 'money', cur: 'currency' },
    { k: 'cycle', label: 'Cycle', type: 'select', options: [{ k: 'monthly', label: 'Monthly' }, { k: 'yearly', label: 'Yearly' }] },
    { k: 'status', label: 'Status', type: 'select', options: S.SUB_STATUS },
    { k: 'renews', label: 'Renews on', type: 'date', hint: 'Any past renewal date works. Northstar rolls it forward.' },
    { k: 'link', label: 'Link to the app', type: 'url', full: true },
    { k: 'notes', label: 'Notes', type: 'textarea', full: true },
  ];
  NS.editSub = (id) => {
    const existing = S.state.subs.find((s) => s.id === id);
    const obj = existing ? NS.clone(existing) : { id: NS.uid(), name: '', cost: null, currency: 'USD', cycle: 'monthly', renews: '', status: 'active', link: '', notes: '' };
    NS.openModal({
      title: existing ? 'Edit subscription' : 'Add subscription',
      body: NS.fields(subFields, obj),
      onSave: (form) => {
        const v = NS.readForm(form, subFields);
        if (!v.name) { NS.toast('Add a name'); return false; }
        if (existing) Object.assign(existing, v);
        else S.state.subs.push(Object.assign(obj, v));
      },
      onDelete: existing ? () => (S.state.subs = S.state.subs.filter((s) => s.id !== id)) : null,
    });
  };
  A.newSub = () => NS.editSub(null);
  A.editSub = (el) => NS.editSub(el.dataset.id);
})(window.NS);
