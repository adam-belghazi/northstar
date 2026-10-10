(function (NS) {
  const { S, A, C, V, esc, icon, Cloud } = NS;
  const ui = NS.ui;

  // ---------- navigation ----------
  const NAV = [
    { r: 'home', label: 'Today', icon: 'home' },
    { h: 'Life' },
    { r: 'life/goals', label: 'Goals', icon: 'target' },
    { r: 'life/checkin', label: 'Daily check-in', icon: 'checkin', badge: () => (S.state.checkins[NS.today()] ? '' : '<span class="nbadge" title="Not logged today"></span>') },
    { r: 'life/review', label: 'Weekly review', icon: 'star' },
    { r: 'life/wishlist', label: 'Gear wishlist', icon: 'bag' },
    { h: 'HQ · Door-to-door' },
    { r: 'doors/today', label: 'Today at the doors', icon: 'door', badge: () => (NS.D.dueTexts().length || NS.D.walkIns(NS.today()).length ? '<span class="nbadge" title="Walk-ins or texts today"></span>' : '') },
    { r: 'doors/list', label: 'Doors', icon: 'grid' },
    { r: 'doors/texts', label: 'Texts', icon: 'ext' },
    { r: 'doors/calendar', label: 'Doors calendar', icon: 'cal' },
    { r: 'doors/setup', label: 'Setup', icon: 'sliders' },
    { h: 'HQ · PawMinds' },
    { r: 'hq/pipeline', label: 'Pipeline', icon: 'kanban' },
    { r: 'hq/readiness', label: 'Launch readiness', icon: 'flag' },
    { r: 'hq/team', label: 'Team', icon: 'users' },
    { r: 'hq/subs', label: 'Subscriptions', icon: 'card' },
    { r: 'hq/portals', label: 'Contractor portals', icon: 'door' },
  ];
  const SUBNAV = {
    life: [['life/goals', 'Goals'], ['life/review', 'Review'], ['life/wishlist', 'Wishlist']],
    doors: [['doors/today', 'Today'], ['doors/list', 'Doors'], ['doors/texts', 'Texts'], ['doors/calendar', 'Calendar'], ['doors/setup', 'Setup']],
    hq: [['hq/pipeline', 'Pipeline'], ['hq/readiness', 'Readiness'], ['hq/team', 'Team'], ['hq/subs', 'Subs'], ['hq/portals', 'Portals']],
  };
  const TABS = [
    { r: 'home', label: 'Today', icon: 'home', match: (r) => r === 'home' },
    { r: 'life/goals', label: 'Life', icon: 'target', match: (r) => r.startsWith('life/') && r !== 'life/checkin' },
    { r: 'life/checkin', label: 'Check-in', icon: 'checkin', match: (r) => r === 'life/checkin' },
    { r: 'doors/today', label: 'Doors', icon: 'door', match: (r) => r.startsWith('doors/'), dot: () => NS.D.dueTexts().length > 0 },
    { r: 'hq/pipeline', label: 'HQ', icon: 'kanban', match: (r) => r.startsWith('hq/') },
  ];
  const VIEWS = {
    home: 'home', 'life/goals': 'goals', 'life/checkin': 'checkin', 'life/review': 'review', 'life/wishlist': 'wishlist',
    'hq/pipeline': 'pipeline', 'hq/readiness': 'readiness', 'hq/team': 'team', 'hq/subs': 'subs', 'hq/portals': 'portals', settings: 'settings',
    'doors/today': 'doorsToday', 'doors/list': 'doorsList', 'doors/texts': 'doorsTexts', 'doors/calendar': 'doorsCalendar', 'doors/setup': 'doorsSetup',
  };
  const navActive = (r) => ui.route === r || (r === 'hq/portals' && ui.route.startsWith('hq/portal/'));

  const curSeg = () =>
    `<div class="seg cur" title="Display currency">${['AED', 'USD']
      .map((c) => `<button type="button" class="${S.state.settings.currency === c ? 'on' : ''}" data-a="setCur" data-v="${c}">${c}</button>`)
      .join('')}</div>`;
  const wordmark = (href = '#/home') => `<a class="wordmark" href="${href}">NORTHSTAR</a>`;

  const navHtml = () =>
    NAV.map((n) =>
      n.h ? `<div class="nav-h">${n.h}</div>` : `<a href="#/${n.r}" class="${navActive(n.r) ? 'on' : ''}">${icon(n.icon, 17)}<span>${n.label}</span>${n.badge ? n.badge() : ''}</a>`
    ).join('');

  const subnavHtml = () => {
    const sec = ui.route.split('/')[0];
    const items = ui.route !== 'life/checkin' && SUBNAV[sec];
    if (!items) return '';
    return `<nav class="subnav" aria-label="${sec === 'hq' ? 'HQ' : sec === 'doors' ? 'Door-to-door' : 'Life'} pages">${items
      .map(([r, l]) => `<a href="#/${r}" class="${navActive(r) ? 'on' : ''}">${l}</a>`)
      .join('')}</nav>`;
  };
  const tabsHtml = () =>
    `<nav class="tabbar" aria-label="Main">${TABS.map(
      (t) => `<a href="#/${t.r}" class="${t.match(ui.route) ? 'on' : ''}">${icon(t.icon, 21)}<span>${t.label}</span>${(t.r === 'life/checkin' && !S.state.checkins[NS.today()]) || (t.dot && t.dot()) ? '<i class="tab-dot"></i>' : ''}</a>`
    ).join('')}</nav>`;

  NS.refreshNav = () => {
    const nav = document.getElementById('nav');
    if (nav) nav.innerHTML = navHtml();
    const tabs = document.querySelector('.tabbar');
    if (tabs) tabs.outerHTML = tabsHtml();
  };

  const ownerShell = () => `
    <div class="app ${ui.navOpen ? 'nav-open' : ''}">
      <aside class="side">
        <div class="side-top">${wordmark()}</div>
        <nav class="nav" id="nav">${navHtml()}</nav>
        <div class="side-foot">
          ${NS.syncBadge()}
          <div class="side-row">${curSeg()}<button type="button" class="btn ghost sm icon-only" data-a="toggleTheme" aria-label="Switch light or dark">${icon('contrast', 17)}</button></div>
          <a href="#/settings" class="set-link ${ui.route === 'settings' ? 'on' : ''}">${icon('sliders', 16)}<span>Settings</span></a>
        </div>
      </aside>
      <main class="main">
        <header class="mob-top">
          ${wordmark()}<span class="spacer"></span>${curSeg()}
          <a class="btn ghost sm icon-only" href="#/settings" aria-label="Settings">${icon('sliders', 19)}</a>
        </header>
        <div id="subnav-slot"></div>
        <div id="view" class="view"></div>
      </main>
      ${tabsHtml()}
    </div>`;

  const contractorShell = () => `
    <div class="app solo">
      <main class="main">
        <header class="solo-top">${wordmark('#/portal')}<span class="spacer"></span>
          <span class="dim small hide-sm">${esc(Cloud.user.email)}</span>
          <button type="button" class="btn ghost sm icon-only" data-a="toggleTheme" aria-label="Switch light or dark">${icon('contrast', 17)}</button>
          <button type="button" class="btn ghost sm" data-a="signOut">Sign out</button></header>
        <div id="view" class="view"></div>
      </main>
    </div>`;

  // ---------- render ----------
  NS.render = () => {
    document.querySelectorAll('[data-keep]').forEach((el) => (ui.scroll[ui.route + ':' + el.dataset.keep] = el.scrollLeft));
    const root = document.getElementById('app');
    const contractor = Cloud.role === 'contractor';
    const shellKind = contractor ? 'contractor' : 'owner';
    if (ui.shell !== shellKind || !root.querySelector('#view')) {
      root.innerHTML = contractor ? contractorShell() : ownerShell();
      ui.shell = shellKind;
    } else if (!contractor) {
      root.querySelector('.app').classList.toggle('nav-open', !!ui.navOpen);
      NS.refreshNav();
      root.querySelectorAll('.seg.cur').forEach((el) => (el.outerHTML = curSeg()));
      const sl = root.querySelector('.set-link');
      sl && sl.classList.toggle('on', ui.route === 'settings');
    }
    if (!contractor) document.getElementById('subnav-slot').innerHTML = subnavHtml();
    document.body.dataset.section = ui.route.split('/')[0];

    let html;
    try {
      if (contractor) html = V.portalContractor();
      else if (ui.route.startsWith('hq/portal/')) html = V.portalOwner(ui.route.slice('hq/portal/'.length));
      else html = (V[VIEWS[ui.route]] || V.home)();
    } catch (e) {
      console.error(e);
      html = NS.emptyState('Something went wrong showing this page. Your data is safe. Details are in the browser console.');
    }
    document.getElementById('view').innerHTML = html;
    document.querySelectorAll('[data-keep]').forEach((el) => {
      const saved = ui.scroll[ui.route + ':' + el.dataset.keep];
      if (saved != null) el.scrollLeft = saved;
      else if (el.dataset.today) el.scrollLeft = Math.max(0, +el.dataset.today - 160);
    });
    NS.afterRender();
  };

  const route = () => {
    let r = (location.hash || '#/home').replace(/^#\/?/, '');
    if (Cloud.role === 'contractor') r = 'portal';
    else if (!VIEWS[r] && !/^hq\/portal\/[\w-]+$/.test(r)) r = 'home';
    const changed = r !== ui.route;
    ui.route = r;
    ui.navOpen = false;
    if (changed) NS.closeModal();
    NS.render();
    if (changed) window.scrollTo(0, 0);
  };

  A.setCur = (el) => {
    S.state.settings.currency = el.dataset.v;
    S.save();
    NS.render();
  };
  A.toggleTheme = () => {
    NS.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    if (ui.route === 'settings') NS.render();
  };
  A.signOut = () => Cloud.signOut();

  // ---------- event delegation ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    // a real link inside a clickable row/card should just open the link
    const link = e.target.closest('a[href]');
    if (link && link !== el && el.contains(link)) return;
    const fn = A[el.dataset.a];
    if (fn) fn(el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modal) NS.closeModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.kcard')) {
      e.preventDefault();
      e.target.click();
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'mform') {
      e.preventDefault();
      A.mSave();
    } else if (e.target.id === 'loginForm') {
      e.preventDefault();
      A.loginSubmit();
    }
  });
  const bindDraft = (el) => {
    if (!ui.draft) return;
    NS.setPath(ui.draft, el.dataset.d, el.type === 'checkbox' ? el.checked : el.value);
    if (el.type === 'checkbox' && document.getElementById('subed')) NS.refreshDraft();
    if (el.dataset.rerender && NS.refreshCiEditor) NS.refreshCiEditor();
  };
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.d != null && el.type !== 'checkbox') bindDraft(el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset) return;
    if (el.dataset.d != null) {
      if (el.type === 'checkbox') bindDraft(el);
      return;
    }
    if (el.dataset.c && C[el.dataset.c]) C[el.dataset.c](el, e);
  });

  // ---------- kanban drag & drop ----------
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('[data-drag]');
    if (!card) return;
    ui.drag = card.dataset.drag;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', ui.drag);
    card.classList.add('dragging');
  });
  document.addEventListener('dragover', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col || !ui.drag) return;
    e.preventDefault();
    document.querySelectorAll('.col.over').forEach((x) => x !== col && x.classList.remove('over'));
    col.classList.add('over');
  });
  document.addEventListener('drop', (e) => {
    const col = e.target.closest && e.target.closest('[data-drop]');
    if (!col || !ui.drag) return;
    e.preventDefault();
    const id = ui.drag;
    ui.drag = null;
    if (Cloud.role === 'contractor') NS.contractorMoveTask(id, col.dataset.drop);
    else NS.moveTask(id, col.dataset.drop);
  });
  document.addEventListener('dragend', () => {
    ui.drag = null;
    document.querySelectorAll('.over, .dragging').forEach((x) => x.classList.remove('over', 'dragging'));
  });

  // ---------- full-screen states: login, first run, no access ----------
  const screen = (inner) => {
    ui.shell = null;
    document.getElementById('app').innerHTML = `<div class="screen"><div class="screen-card">${wordmark('#')}${inner}</div></div>`;
  };

  // Sign-in: password first (works inside the iPhone Home Screen app), email link as the fallback.
  ui.login = { step: 'password', email: '', busy: false, error: '' };
  const renderLogin = () => {
    const L = ui.login;
    const err = L.error ? `<p class="red small">${esc(L.error)}</p>` : '';
    const emailIn = `<label class="fld"><span class="fl">Email</span><input name="email" type="email" autocomplete="email" required value="${esc(L.email)}" placeholder="you@example.com"></label>`;
    const safari = NS.isIOS() && !NS.isStandalone()
      ? `<p class="dim small">You're in Safari. For notifications and staying signed in, use Northstar from your Home Screen (Share → Add to Home Screen).</p>`
      : '';
    let inner;
    if (L.step === 'password') {
      inner = `<h1>Sign in</h1><p class="muted">You only do this once per device. Northstar remembers you after that.</p>
        <form id="loginForm" class="login-form">${emailIn}
          <label class="fld"><span class="fl">Password</span><input name="password" type="password" autocomplete="current-password" required></label>
          ${err}<button class="btn pri block" ${L.busy ? 'disabled' : ''}>${L.busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" class="btn ghost block" data-a="loginStep" data-v="email">No password yet? Email me a sign-in link</button>
        </form>${safari}`;
    } else if (L.step === 'email') {
      inner = `<h1>Email link</h1><p class="muted">We'll email you a sign-in link. Use it once, then set a password in Settings so the Home Screen app can sign in.</p>
        <form id="loginForm" class="login-form">${emailIn}${err}
          <button class="btn pri block" ${L.busy ? 'disabled' : ''}>${L.busy ? 'Sending…' : 'Email me a link'}</button>
          <button type="button" class="btn ghost block" data-a="loginStep" data-v="password">Back to password</button>
        </form>`;
    } else {
      inner = `<h1>Check your email</h1>
        <ol class="steps"><li>Open the email we sent to <b>${esc(L.email)}</b> and tap <b>Sign in</b>. On iPhone it opens in Safari. That's expected.</li>
          <li>In Northstar, go to <b>Settings → Password for the Home Screen app</b> and set one.</li>
          <li>Open Northstar from your Home Screen and sign in with that password.</li></ol>
        <form id="loginForm" class="login-form">
          <label class="fld"><span class="fl">Got a 6-digit code instead? Type it here</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" class="code-in" placeholder="123456"></label>
          ${err}<button class="btn pri block" ${L.busy ? 'disabled' : ''}>${L.busy ? 'Checking…' : 'Sign in with code'}</button>
          <button type="button" class="btn ghost block" data-a="loginStep" data-v="password">Back to password</button>
        </form>`;
    }
    screen(inner);
    const first = document.querySelector('#loginForm input');
    first && !first.value && first.focus();
  };
  const signedIn = () => {
    location.replace('/#/home');
    location.reload();
  };
  A.loginSubmit = async () => {
    const L = ui.login;
    const form = document.getElementById('loginForm');
    L.error = '';
    L.busy = true;
    try {
      if (L.step === 'password') {
        L.email = form.elements.email.value.trim();
        const pw = form.elements.password.value;
        renderLogin();
        await Cloud.signInPassword(L.email, pw);
        return signedIn();
      } else if (L.step === 'email') {
        L.email = form.elements.email.value.trim();
        renderLogin();
        await Cloud.sendCode(L.email);
        L.step = 'code';
      } else {
        const code = form.elements.code.value.replace(/\s/g, '');
        if (!code) throw new Error('Tap the link in the email, or type the code if there is one');
        renderLogin();
        await Cloud.verifyCode(L.email, code);
        return signedIn();
      }
    } catch (e) {
      L.error = e.message;
    }
    L.busy = false;
    renderLogin();
  };
  A.loginStep = (el) => {
    Object.assign(ui.login, { step: el.dataset.v, error: '' });
    renderLogin();
  };

  const renderFirstRun = () =>
    screen(`<h1>Your cloud is ready</h1><p class="muted">How do you want to start?</p>
      <div class="choice">
        <button type="button" class="choice-b" data-a="firstRun" data-v="fresh"><b>Start fresh</b><span>An empty Northstar for your real goals and tasks.</span></button>
        <label class="choice-b"><b>Import a backup</b><span>Bring over what you built in the local version (Settings → Export backup there).</span><input type="file" accept=".json,application/json" hidden data-c="firstRunImport"></label>
        <button type="button" class="choice-b" data-a="firstRun" data-v="sample"><b>Explore with sample data</b><span>Clear it later in Settings.</span></button>
      </div>`);
  const startOwner = () => {
    Cloud.subscribe();
    route();
  };
  A.firstRun = (el) => {
    S.replace(el.dataset.v === 'sample' ? S.seed() : S.empty());
    startOwner();
  };
  C.firstRunImport = (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.settings) throw new Error('bad');
        data.settings.sample = false;
        S.replace(data);
        NS.toast('Imported. Uploading to the cloud…');
        startOwner();
      } catch (e) {
        NS.toast("That file isn't a Northstar backup");
      }
    };
    reader.readAsText(file);
  };

  const renderNoAccess = () =>
    screen(`<h1>No access</h1><p class="muted"><b>${esc(Cloud.user.email)}</b> isn't connected to a Northstar portal. Ask the person who invited you to check the email they used.</p>
      <button type="button" class="btn block" data-a="signOut">Sign out</button>`);

  const renderError = (e) =>
    screen(`<h1>Can't reach the cloud</h1><p class="muted">${esc(e.message || String(e))}</p>
      <p class="dim small">If this is a fresh setup, make sure supabase/schema.sql was run in the Supabase SQL Editor.</p>
      <button type="button" class="btn pri block" onclick="location.reload()">Try again</button>
      <button type="button" class="btn ghost block" data-a="signOut">Sign out</button>`);

  // ---------- boot ----------
  const boot = async () => {
    NS.applyTheme();
    // ask the browser not to clear Northstar's storage, so this device stays signed in
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    document.getElementById('app').innerHTML = '<div class="screen"><div class="wordmark pulse">NORTHSTAR</div></div>';
    await Cloud.init();
    window.addEventListener('hashchange', route);

    if (Cloud.mode === 'local') {
      S.load();
      window.addEventListener('storage', (e) => {
        if (e.key === 'northstar.v1') { S.load(); NS.render(); }
      });
      ui.route = null;
      return route();
    }

    if (!Cloud.user) return renderLogin();
    try {
      await Cloud.resolveRole();
    } catch (e) {
      return renderError(e);
    }

    if (Cloud.role === 'contractor') {
      S.state = S.empty();
      Cloud.subscribe();
      ui.route = null;
      return route();
    }
    if (Cloud.role !== 'owner') return renderNoAccess();

    S.load(); // cached copy for an instant first paint
    try {
      const exists = await Cloud.loadOwner();
      if (!exists) return renderFirstRun();
    } catch (e) {
      if (!S.state.tasks.length && !S.state.goals.length) return renderError(e);
      Cloud.setStatus('offline', e.message); // show the cached copy
    }
    ui.route = null;
    startOwner();
  };
  boot();
})(window.NS);
