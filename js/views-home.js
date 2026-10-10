(function (NS) {
  const { S, A, C, V, esc, icon } = NS;
  const ui = NS.ui;
  const PR = { high: 0, medium: 1, low: 2 };

  // =====================================================================
  // HOME / FOCUS VIEW
  // =====================================================================
  const priorities = () => {
    const f = S.focus();
    const T = NS.today();
    const items = [];
    S.state.tasks
      .filter((t) => S.open(t) && t.stage !== 'hold_money')
      .forEach((t) => items.push({ attrs: `data-a="editTask" data-id="${t.id}"`, title: t.name, due: t.deadline, prio: t.priority, ctx: 'HQ · ' + S.find(S.STAGES, t.stage).label, focus: f && f.task.id === t.id, blocked: t.stage === 'waiting' }));
    S.state.goals
      .filter((g) => g.status !== 'done')
      .forEach((g) => items.push({ attrs: `data-a="editGoal" data-id="${g.id}"`, title: g.title, due: g.due, prio: 'medium', ctx: 'Life · ' + S.find(S.AREAS, g.area).label }));
    const score = (i) => [i.focus ? 0 : 1, i.blocked ? 1 : 0, i.due && i.due < T ? 0 : 1, PR[i.prio] ?? 1, i.due || '9999'];
    items.sort((a, b) => {
      const x = score(a), y = score(b);
      for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] < y[k] ? -1 : 1;
      return 0;
    });
    return items.slice(0, 3);
  };

  const dueSoon = () => {
    const T = NS.today();
    const lim = NS.addDays(T, 7);
    const out = [];
    S.state.tasks.filter(S.open).forEach((t) => {
      if (t.deadline && t.deadline <= lim) out.push({ due: t.deadline, title: t.name, ctx: 'Task', attrs: `data-a="editTask" data-id="${t.id}"` });
      (t.subtasks || []).forEach((s) => s.due && s.due <= lim && S.subPct(s) < 1 && out.push({ due: s.due, title: s.title, ctx: t.name, attrs: `data-a="editTask" data-id="${t.id}"` }));
    });
    S.state.goals.filter((g) => g.status !== 'done').forEach((g) => {
      if (g.due && g.due <= lim) out.push({ due: g.due, title: g.title, ctx: 'Goal', attrs: `data-a="editGoal" data-id="${g.id}"` });
      (g.subtasks || []).forEach((s) => s.due && s.due <= lim && !s.done && out.push({ due: s.due, title: s.title, ctx: g.title, attrs: `data-a="editGoal" data-id="${g.id}"` }));
    });
    return out.sort((a, b) => (a.due < b.due ? -1 : 1)).slice(0, 8);
  };

  V.home = () => {
    const st = S.state;
    const T = NS.today();
    const hr = new Date().getHours();
    const greet = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const name = st.settings.name ? ', ' + esc(st.settings.name) : '';
    const r = S.readiness();
    const R = NS.READY[r.status];
    const ci = st.checkins[T];
    const MS = S.metrics();
    const ciHits = ci ? MS.filter((m) => m.test(ci, T)).length : 0;

    const pr = priorities();
    const due = dueSoon();
    const blockers = st.tasks.filter((t) => S.open(t) && !t.moneyGated && (t.stage === 'waiting' || (t.stage === 'building' && S.unfinishedDeps(t).length)));

    const sample = st.settings.sample
      ? `<div class="banner">${icon('star', 16)}<span>This is sample data so you can see how everything works. Clear it in Settings when you're ready to add your own.</span><a class="btn sm" href="#/settings">Settings</a></div>`
      : '';

    return `${NS.head(`${greet}${name}`, NS.parse(T).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}
      ${sample}
      ${NS.focusCard()}
      <div class="grid">${NS.doorsHomeCard()}</div>
      <div class="grid g3">
        ${NS.gateCard(true)}
        <a class="card link-card" href="#/hq/readiness" style="--c:${R.color}">
          <h3>${icon('flag', 15)} PawMinds stage</h3>
          <div class="ready-row">${NS.ring(r.pct, { size: 104, color: R.color, label: NS.pct(r.pct), sub: 'built' })}
            <div><div class="ready-l">${R.label}</div><div class="muted small">${r.remaining.length} left that don't need money · ${r.money.filter(S.open).length} waiting on money</div></div></div>
        </a>
        <a class="card link-card" href="#/life/checkin">
          <h3>${icon('checkin', 15)} Today's check-in</h3>
          ${ci
            ? `<div class="ready-row">${NS.ring(ciHits / (MS.length || 1), { size: 104, color: 'var(--p1)', label: `${ciHits}/${MS.length}`, sub: 'habits' })}<div><div class="ready-l">Logged</div><div class="muted small">Tap to update before bed.</div></div></div>`
            : `<div class="ci-cta"><div class="ready-l">Not logged yet</div><p class="muted small">60 seconds. It keeps your streaks honest and feeds the weekly review.</p><span class="btn pri sm">Do it now</span></div>`}
        </a>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Top priorities</h3>
          <div class="list">${pr.length
            ? pr.map((p, i) => `<button type="button" class="li" ${p.attrs}><span class="rank num">${i + 1}</span><span class="grow"><span class="li-t">${esc(p.title)}</span><span class="li-s">${esc(p.ctx)}${p.due ? ' · ' + NS.rel(p.due) : ''}</span></span>${p.focus ? NS.chip('Critical path', 'var(--accent)') : ''}</button>`).join('')
            : '<div class="dim small">Nothing open. Add a goal or a task.</div>'}</div></div>
        <div class="card"><h3>Due in the next 7 days</h3>
          <div class="list">${due.length
            ? due.map((d) => `<button type="button" class="li" ${d.attrs}><span class="when ${d.due < T ? 'red' : d.due === T ? 'amber' : ''}">${NS.rel(d.due)}</span><span class="grow"><span class="li-t">${esc(d.title)}</span><span class="li-s">${esc(d.ctx)}</span></span></button>`).join('')
            : '<div class="dim small">Nothing due this week.</div>'}</div></div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Blockers</h3>
          <div class="list">${blockers.length
            ? blockers.map((t) => {
                const deps = S.unfinishedDeps(t);
                return `<button type="button" class="li" data-a="editTask" data-id="${t.id}"><span class="gate-st no">${icon('lock', 14)}</span><span class="grow"><span class="li-t">${esc(t.name)}</span><span class="li-s">${t.stage === 'waiting' ? 'Waiting on ' + esc(t.waitingOn || 'something') : 'Blocked by ' + deps.map((d) => esc(d.name)).join(', ')}</span></span></button>`;
              }).join('')
            : '<div class="dim small">Nothing blocked. Clear road.</div>'}</div></div>
        <div class="card"><h3>Life levels</h3><div class="area-mini">${S.AREAS.map((a) => NS.areaCard(a, true)).join('')}</div></div>
      </div>`;
  };

  // =====================================================================
  // SETTINGS
  // =====================================================================
  ui.pushState = null;
  const refreshPushState = async () => {
    ui.pushState = await NS.Cloud.pushState().catch(() => 'unsupported');
    if (ui.route === 'settings') NS.render();
  };

  V.settings = () => {
    const s = S.state.settings;
    const Cl = NS.Cloud;
    const cloud = Cl.mode === 'cloud';
    if (cloud && ui.pushState === null) refreshPushState();
    const theme = NS.getTheme();
    const push = ui.pushState;
    const pushUi = !cloud
      ? '<p class="muted small">Push notifications need cloud sync (see SETUP.md).</p>'
      : push === 'on'
        ? `<p class="muted small">This device gets your evening reminders, deadline alerts, renewals, contractor activity and the weekly review.</p>
           <div class="btn-row"><button type="button" class="btn" data-a="testPush">Send a test</button><button type="button" class="btn ghost" data-a="pushOff">Turn off on this device</button></div>`
        : push === 'denied'
          ? '<p class="muted small">Notifications are blocked for Northstar. Allow them in your phone or browser settings, then reload.</p>'
          : push === 'unsupported'
            ? '<p class="muted small"><b>On iPhone:</b> open Northstar in Safari, tap Share → <b>Add to Home Screen</b>, then open it from your Home Screen and come back here.</p>'
            : `<p class="muted small">Turn on push for this device. Do it on your phone too. Each device is separate.</p><button type="button" class="btn pri" data-a="pushOn">Turn on notifications</button>`;

    return `${NS.head('Settings', cloud ? 'Synced to your Northstar cloud.' : 'Everything is saved in this browser.')}
      <div class="grid g2">
        <div class="card"><h3>Appearance</h3>
          <div class="fl" style="margin-bottom:8px">Theme on this device</div>
          ${NS.seg([{ k: 'system', label: 'Auto' }, { k: 'light', label: 'Light' }, { k: 'dark', label: 'Dark' }], theme, 'setTheme')}
        </div>
        <div class="card"><h3>Notifications</h3>${pushUi}</div>
      </div>
      ${cloud ? `<div class="grid g2">
        <div class="card"><h3>Account</h3>
          <p class="muted small">Signed in as <b>${esc(Cl.user.email)}</b> (owner).</p>
          <div class="btn-row">${NS.syncBadge()}<button type="button" class="btn ghost" data-a="signOut">Sign out</button></div>
          ${Cl.error ? `<p class="red small">${esc(Cl.error)}</p>` : ''}
        </div>
        <div class="card"><h3>Weekly review</h3>
          <p class="muted small">Written by Claude every Sunday around 8pm (UAE time) and pushed to your phone. You can also run it any time from Life → Weekly review.</p>
          <a class="btn" href="#/life/review">Open reviews</a>
        </div>
      </div>` : ''}
      <div class="grid g2">
        <div class="card"><h3>You</h3>
          <div class="fgrid">
            <label class="fld"><span class="fl">Your first name</span><input data-c="setting" data-k="name" value="${esc(s.name)}" placeholder="For the greeting"></label>
            <label class="fld"><span class="fl">Default currency</span><select data-c="setting" data-k="currency"><option ${s.currency === 'AED' ? 'selected' : ''}>AED</option><option ${s.currency === 'USD' ? 'selected' : ''}>USD</option></select></label>
          </div>
        </div>
        <div class="card"><h3>Money gate</h3>
          <div class="fgrid">
            <label class="fld"><span class="fl">Gate amount (AED)</span><input type="number" min="0" step="500" data-c="setting" data-k="gateAmount" value="${esc(s.gateAmount)}"></label>
            <label class="fld"><span class="fl">What it unlocks</span><input data-c="setting" data-k="gateLabel" value="${esc(s.gateLabel)}"></label>
          </div>
          <p class="dim small">Door-to-door earnings from your daily check-ins plus any income you log count toward this.</p>
        </div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>Backup</h3>
          <p class="muted small">${cloud ? 'Your data is in the cloud. Export a backup file now and then for extra safety. Import replaces everything with the file.' : 'Your data lives in this browser only. Export a backup now and then. To move to the cloud version, export here and import there.'}</p>
          <div class="btn-row">
            <button type="button" class="btn" data-a="exportData">${icon('download', 16)}<span>Export backup</span></button>
            <label class="btn">${icon('upload', 16)}<span>Import backup</span><input type="file" accept="application/json,.json" data-c="importData" hidden></label>
          </div>
        </div>
        <div class="card"><h3>Data</h3>
          <p class="muted small">${s.sample ? "You're looking at sample data." : "You're using your own data."}</p>
          <div class="btn-row">
            ${s.sample ? `<button type="button" class="btn pri" data-a="clearSample">Clear sample data & start fresh</button>` : `<button type="button" class="btn" data-a="loadSample">Load sample data</button>`}
            <button type="button" class="btn ghost danger" data-a="wipe">Erase everything</button>
          </div>
        </div>
      </div>`;
  };
  A.setTheme = (el) => { NS.setTheme(el.dataset.v); NS.render(); };
  A.pushOn = async (el) => {
    el.disabled = true;
    try {
      await NS.Cloud.enablePush();
      NS.toast('Notifications on for this device');
    } catch (e) {
      NS.toast(e.message);
    }
    refreshPushState();
  };
  A.pushOff = async () => {
    await NS.Cloud.disablePush().catch((e) => NS.toast(e.message));
    refreshPushState();
  };
  A.testPush = async () => {
    try {
      const r = await NS.Cloud.testPush();
      NS.toast(r.sent ? 'Sent. Check your notifications.' : 'No devices are subscribed yet');
    } catch (e) {
      NS.toast(e.message);
    }
  };
  A.signOut = () => NS.Cloud.signOut();

  C.setting = (el) => {
    const k = el.dataset.k;
    S.state.settings[k] = el.type === 'number' ? Number(el.value) || 0 : el.value;
    S.save();
    NS.refreshNav();
    NS.toast('Saved');
  };
  A.exportData = () => {
    const blob = new Blob([JSON.stringify(S.state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `northstar-backup-${NS.today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  C.importData = (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data !== 'object' || !data.settings) throw new Error('bad');
        NS.confirm('Import backup?', 'This replaces everything currently in Northstar with the backup.', () => {
          S.replace(data);
          NS.toast('Backup imported');
        }, 'Replace my data');
      } catch (e) {
        NS.toast("That file isn't a Northstar backup");
      }
    };
    reader.readAsText(file);
    el.value = '';
  };
  A.clearSample = () =>
    NS.confirm('Clear sample data?', 'This removes all the example goals, tasks, gear, check-ins and subscriptions so you can add your own. Your settings stay.', () => {
      const keep = Object.assign({}, S.state.settings, { sample: false });
      S.state = S.empty();
      S.state.settings = keep;
      NS.toast('Clean slate. Start with a goal or a task.');
    }, 'Clear it');
  A.loadSample = () =>
    NS.confirm('Load sample data?', 'This replaces your current data with the examples. Export a backup first if you want to keep it.', () => {
      S.state = S.seed();
    }, 'Load samples');
  A.wipe = () =>
    NS.confirm('Erase everything?', 'Every goal, task, check-in, item and setting will be deleted from this browser. This cannot be undone.', () => {
      S.state = S.empty();
    }, 'Erase');
})(window.NS);
