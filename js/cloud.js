// Cloud layer: Supabase auth, owner data sync, contractor portals, files, push, reviews.
// When /api/config isn't reachable (opened as a file or on the local preview server),
// Northstar stays in "local" mode and keeps everything in this browser.
(function (NS) {
  const S = NS.S;
  const Cloud = (NS.Cloud = {
    mode: 'local', // 'local' | 'cloud'
    config: null,
    sb: null,
    user: null,
    role: null, // 'owner' | 'contractor' | 'none'
    portal: null, // contractor's own portal row
    status: 'local', // 'local' | 'synced' | 'saving' | 'error' | 'offline'
    error: '',
    synced: { state: null, tasks: {}, doors: {}, portals: {} },
  });

  // Key-sorted JSON so Postgres jsonb (which reorders keys) compares equal to local objects.
  const stable = (v) =>
    Array.isArray(v)
      ? '[' + v.map(stable).join(',') + ']'
      : v && typeof v === 'object'
        ? '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}'
        : JSON.stringify(v === undefined ? null : v);
  Cloud.stable = stable;

  // ---------- boot ----------
  Cloud.init = async () => {
    if (location.protocol === 'file:') return;
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    let cfg;
    // remember the public config so the app still opens (on cached data) with no signal
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) {
        cfg = await r.json();
        try { localStorage.setItem('northstar.config', JSON.stringify(cfg)); } catch (e) { /* storage blocked */ }
      }
    } catch (e) {
      /* offline */
    }
    if (!cfg) {
      try { cfg = JSON.parse(localStorage.getItem('northstar.config') || 'null'); } catch (e) { cfg = null; }
      if (!cfg) return;
      Cloud.offlineBoot = true;
    }
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;
    Cloud.config = cfg;
    Cloud.mode = 'cloud';
    Cloud.sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
    const { data } = await Cloud.sb.auth.getSession();
    Cloud.user = data.session ? data.session.user : null;
    Cloud.sb.auth.onAuthStateChange((evt, session) => {
      Cloud.user = session ? session.user : null;
      if (evt === 'SIGNED_OUT') location.replace('/');
    });
    // magic-link tokens arrive in the URL hash; clear them before the router reads it
    if (/access_token|error_description/.test(location.hash)) history.replaceState(null, '', '/#/home');
  };

  Cloud.resolveRole = async () => {
    const remember = (role) => {
      try { localStorage.setItem('northstar.role', role); } catch (e) { /* storage blocked */ }
      return (Cloud.role = role);
    };
    const { data: isOwner, error } = await Cloud.sb.rpc('is_owner');
    if (error) {
      // no signal: trust the role from the last successful sign-in on this device
      let cached = '';
      try { cached = localStorage.getItem('northstar.role') || ''; } catch (e) { /* storage blocked */ }
      if (cached === 'owner') return (Cloud.role = 'owner');
      throw error;
    }
    if (isOwner) return remember('owner');
    const { data: portal } = await Cloud.sb.from('portals').select('*').maybeSingle();
    if (portal) {
      Cloud.portal = portal;
      return remember('contractor');
    }
    return remember('none');
  };

  // ---------- auth ----------
  Cloud.sendCode = async (email) => {
    const { error } = await Cloud.sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/' },
    });
    if (error) {
      if (/signups? not allowed|not found|otp_disabled/i.test(error.message)) throw new Error("This email doesn't have access to Northstar.");
      throw error;
    }
  };
  Cloud.verifyCode = async (email, token) => {
    const { error } = await Cloud.sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or expired. Request a new one.' : error.message);
  };
  Cloud.signOut = () => {
    try { localStorage.removeItem('northstar.role'); } catch (e) { /* storage blocked */ }
    return Cloud.sb.auth.signOut();
  };

  Cloud.token = async () => {
    const { data } = await Cloud.sb.auth.getSession();
    return data.session ? data.session.access_token : '';
  };
  Cloud.api = async (path, body) => {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await Cloud.token()) },
      body: JSON.stringify(body || {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
    return j;
  };

  // ---------- owner data sync ----------
  // Set whenever there are local changes the cloud hasn't confirmed yet (e.g. doors logged offline).
  const DIRTY = 'northstar.cloud.dirty';
  const setDirty = (on) => {
    try { on ? localStorage.setItem(DIRTY, '1') : localStorage.removeItem(DIRTY); } catch (e) { /* storage blocked */ }
  };
  const isDirty = () => { try { return !!localStorage.getItem(DIRTY); } catch (e) { return false; } };

  const ownerPart = () => {
    const { tasks, doors, ...rest } = S.state;
    return rest;
  };
  const assigneeOf = (t) => (t.ownerId && t.ownerId !== 'me' ? t.ownerId : null);
  const portalRows = () =>
    S.state.team
      .filter((m) => m.email && m.email.trim())
      .map((m) => ({ id: m.id, name: m.name || 'Contractor', email: m.email.trim().toLowerCase(), role: m.role || '', drive_url: m.driveUrl || '', enabled: !!m.portal }));

  Cloud.markSynced = () => {
    Cloud.synced = {
      state: stable(ownerPart()),
      tasks: Object.fromEntries(S.state.tasks.map((t) => [t.id, stable(t)])),
      doors: Object.fromEntries(S.state.doors.map((d) => [d.id, stable(d)])),
      portals: Object.fromEntries(portalRows().map((p) => [p.id, stable(p)])),
    };
  };

  // Returns false when the cloud has never been set up (first run).
  Cloud.loadOwner = async () => {
    const [st, tk, dr, pt] = await Promise.all([
      Cloud.sb.from('owner_state').select('data').eq('id', 1).maybeSingle(),
      Cloud.sb.from('tasks').select('id,data'),
      Cloud.sb.from('doors').select('id,data'),
      Cloud.sb.from('portals').select('*'),
    ]);
    for (const r of [st, tk, dr, pt]) if (r.error) throw r.error;
    if (!st.data) return false;
    const data = st.data.data || {};
    data.tasks = tk.data.map((r) => r.data);
    data.doors = dr.data.map((r) => r.data);
    const hasLocal = S.state && (S.state.tasks.length || S.state.doors.length || Object.keys(S.state.checkins || {}).length);
    if (isDirty() && hasLocal) {
      // keep the unsent local copy and upload the difference
      Cloud.synced = {
        state: stable(Object.assign({}, data, { tasks: undefined, doors: undefined })),
        tasks: Object.fromEntries(tk.data.map((r) => [r.id, stable(r.data)])),
        doors: Object.fromEntries(dr.data.map((r) => [r.id, stable(r.data)])),
        portals: Object.fromEntries(pt.data.map((p) => [p.id, stable(p)])),
      };
      Cloud.lastLoad = Date.now();
      Cloud.push();
      return true;
    }
    S.replace(data, { silent: true });
    Cloud.markSynced();
    // remember which portals exist server-side so removed team members get cleaned up
    pt.data.forEach((p) => {
      if (!Cloud.synced.portals[p.id]) Cloud.synced.portals[p.id] = stable(p);
    });
    Cloud.lastLoad = Date.now();
    Cloud.setStatus('synced');
    return true;
  };

  let timer = null;
  let pushing = false;
  let again = false;
  Cloud.schedule = () => {
    if (Cloud.mode !== 'cloud' || Cloud.role !== 'owner') return;
    setDirty(true);
    Cloud.setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(Cloud.push, 700);
  };
  Cloud.pending = () => pushing || timer !== null;

  // upsert changed rows / delete removed rows for one table keyed by id
  const syncRows = async (table, rows, toRow) => {
    const map = {};
    const up = [];
    rows.forEach((x) => {
      const s = stable(x);
      map[x.id] = s;
      if (Cloud.synced[table][x.id] !== s) up.push(toRow(x));
    });
    if (up.length) {
      const { error } = await Cloud.sb.from(table).upsert(up);
      if (error) throw error;
    }
    const del = Object.keys(Cloud.synced[table]).filter((id) => !map[id]);
    if (del.length) {
      const { error } = await Cloud.sb.from(table).delete().in('id', del);
      if (error) throw error;
    }
    Cloud.synced[table] = map;
  };

  Cloud.push = async () => {
    timer = null;
    if (pushing) { again = true; return; }
    pushing = true;
    const sb = Cloud.sb;
    try {
      const stateStr = stable(ownerPart());
      if (stateStr !== Cloud.synced.state) {
        const { error } = await sb.from('owner_state').upsert({ id: 1, data: ownerPart() });
        if (error) throw error;
        Cloud.synced.state = stateStr;
      }

      const teamIds = new Set(S.state.team.map((m) => m.id));
      const pmap = {};
      const pUp = [];
      portalRows().forEach((p) => {
        const s = stable(p);
        pmap[p.id] = s;
        if (Cloud.synced.portals[p.id] !== s) pUp.push(p);
      });
      if (pUp.length) {
        const { error } = await sb.from('portals').upsert(pUp);
        if (error) throw /duplicate|unique/i.test(error.message) ? new Error('Two team members share the same portal email') : error;
      }
      const pDel = Object.keys(Cloud.synced.portals).filter((id) => !teamIds.has(id));
      if (pDel.length) {
        const { error } = await sb.from('portals').delete().in('id', pDel);
        if (error) throw error;
      }
      // a member whose email was cleared keeps their existing portal row untouched
      Object.keys(Cloud.synced.portals).forEach((id) => { if (teamIds.has(id) && !pmap[id]) pmap[id] = Cloud.synced.portals[id]; });
      Cloud.synced.portals = pmap;

      await syncRows('tasks', S.state.tasks, (t) => ({ id: t.id, data: t, assignee: assigneeOf(t) }));
      await syncRows('doors', S.state.doors, (d) => ({ id: d.id, data: d }));
      if (timer === null && !again) setDirty(false);
      Cloud.setStatus('synced');
    } catch (e) {
      console.error(e);
      Cloud.setStatus(navigator.onLine === false ? 'offline' : 'error', e.message);
      clearTimeout(timer);
      timer = setTimeout(Cloud.push, 8000);
    } finally {
      pushing = false;
      if (again) { again = false; Cloud.push(); }
    }
  };

  // Pull fresh data when you come back to the tab (e.g. after using your phone).
  Cloud.refresh = async () => {
    if (Cloud.role !== 'owner' || Cloud.status !== 'synced' || NS.ui.modal) return;
    if (Date.now() - (Cloud.lastLoad || 0) < 20000) return;
    try {
      await Cloud.loadOwner();
      NS.render();
    } catch (e) {
      /* stay on the cached copy */
    }
  };

  // Live updates: contractors moving cards, portal requests, uploads.
  Cloud.subscribe = () => {
    const ch = Cloud.sb.channel('northstar-' + Cloud.role);
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => Cloud.onTaskChange(p));
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'portal_items' }, () => NS.onPortalChange && NS.onPortalChange());
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'files' }, () => NS.onPortalChange && NS.onPortalChange());
    ch.subscribe();
  };
  Cloud.onTaskChange = (p) => {
    if (Cloud.role !== 'owner') return NS.onPortalChange && NS.onPortalChange();
    if (p.eventType === 'DELETE') {
      const id = p.old && p.old.id;
      const local = S.task(id);
      if (local && Cloud.synced.tasks[id] === stable(local)) {
        S.state.tasks = S.state.tasks.filter((t) => t.id !== id);
        delete Cloud.synced.tasks[id];
        S.saveLocal();
        if (!NS.ui.modal) NS.render();
      }
      return;
    }
    const row = p.new;
    const remote = stable(row.data);
    const local = S.task(row.id);
    if (local && stable(local) === remote) return; // our own echo
    if (local && Cloud.synced.tasks[row.id] !== stable(local)) return; // unsaved local edits win
    if (local) {
      Object.keys(local).forEach((k) => delete local[k]);
      Object.assign(local, row.data);
    } else S.state.tasks.push(row.data);
    Cloud.synced.tasks[row.id] = remote;
    S.saveLocal();
    if (!NS.ui.modal) NS.render();
    NS.toast(`Updated: ${row.data.name}`);
  };

  Cloud.setStatus = (s, err) => {
    Cloud.status = s;
    Cloud.error = err || '';
    const el = document.getElementById('sync');
    if (el) el.outerHTML = NS.syncBadge();
  };

  // ---------- portals ----------
  Cloud.portalData = async (portalId) => {
    const sb = Cloud.sb;
    const [portal, items, files, brand, tasks] = await Promise.all([
      sb.from('portals').select('*').eq('id', portalId).maybeSingle(),
      sb.from('portal_items').select('*').eq('portal_id', portalId).order('sort').order('created_at'),
      sb.from('files').select('*').eq('scope', 'portal').eq('ref_id', portalId).order('created_at', { ascending: false }),
      sb.from('files').select('*').eq('scope', 'brand').order('created_at', { ascending: false }),
      Cloud.role === 'contractor' ? sb.from('tasks').select('id,data').eq('assignee', portalId) : Promise.resolve({ data: null }),
    ]);
    for (const r of [portal, items, files, brand]) if (r.error) throw r.error;
    return {
      portal: portal.data,
      items: items.data || [],
      files: files.data || [],
      brand: brand.data || [],
      tasks: tasks.data ? tasks.data.map((r) => r.data) : null,
    };
  };
  Cloud.addItem = async (row) => {
    const { error } = await Cloud.sb.from('portal_items').insert(row);
    if (error) throw error;
  };
  Cloud.updateItem = async (id, patch) => {
    const { error } = await Cloud.sb.from('portal_items').update(patch).eq('id', id);
    if (error) throw error;
  };
  Cloud.deleteItem = async (id) => {
    const { error } = await Cloud.sb.from('portal_items').delete().eq('id', id);
    if (error) throw error;
  };
  Cloud.updateTaskData = async (task) => {
    const { error } = await Cloud.sb.from('tasks').update({ data: task }).eq('id', task.id);
    if (error) throw error;
  };
  Cloud.invite = (portalId) => Cloud.api('/api/invite', { portalId });
  // Tell the owner what a contractor just did (push notification). Never blocks the UI.
  Cloud.ping = (text) => {
    if (Cloud.role === 'contractor') Cloud.api('/api/activity', { text }).catch(() => {});
  };

  // ---------- files ----------
  Cloud.upload = async (scope, refId, file) => {
    if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is over 50 MB`);
    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${scope}/${refId || 'all'}/${NS.uid()}-${safe}`;
    const { error } = await Cloud.sb.storage.from('files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (error) throw error;
    const row = { scope, ref_id: refId || 'all', name: file.name, path, size: file.size, mime: file.type || '', uploaded_by: Cloud.user.email };
    const { data, error: e2 } = await Cloud.sb.from('files').insert(row).select().single();
    if (e2) throw e2;
    return data;
  };
  Cloud.files = async (scope, refId) => {
    const { data, error } = await Cloud.sb.from('files').select('*').eq('scope', scope).eq('ref_id', refId || 'all').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  };
  Cloud.openFile = async (path) => {
    const w = window.open('', '_blank'); // open synchronously so popup blockers allow it
    try {
      const { data, error } = await Cloud.sb.storage.from('files').createSignedUrl(path, 3600);
      if (error) throw error;
      if (w) { w.opener = null; w.location = data.signedUrl; } else location.href = data.signedUrl;
    } catch (e) {
      if (w) w.close();
      NS.toast(e.message);
    }
  };
  Cloud.deleteFile = async (row) => {
    const { error } = await Cloud.sb.storage.from('files').remove([row.path]);
    if (error) throw error;
    const { error: e2 } = await Cloud.sb.from('files').delete().eq('id', row.id);
    if (e2) throw e2;
  };

  // ---------- push notifications ----------
  const b64ToBytes = (b64) => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  };
  Cloud.pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  Cloud.pushState = async () => {
    if (!Cloud.pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub ? 'on' : 'off';
  };
  Cloud.enablePush = async () => {
    if (!Cloud.pushSupported()) throw new Error('On iPhone: tap Share → Add to Home Screen, open Northstar from the Home Screen, then try again.');
    if (!Cloud.config.vapidPublicKey) throw new Error('VAPID_PUBLIC_KEY is missing in Vercel.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications were blocked. Allow them in your phone or browser settings.');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(Cloud.config.vapidPublicKey) }));
    const j = sub.toJSON();
    const { error } = await Cloud.sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, keys: j.keys, user_email: Cloud.user.email });
    if (error) throw error;
  };
  Cloud.disablePush = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return;
    await Cloud.sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  };
  Cloud.testPush = () => Cloud.api('/api/notify', { test: true });

  // ---------- weekly reviews ----------
  Cloud.reviews = async () => {
    const { data, error } = await Cloud.sb.from('reviews').select('*').order('created_at', { ascending: false }).limit(26);
    if (error) throw error;
    return data;
  };
  Cloud.generateReview = () => Cloud.api('/api/weekly-review', {});

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Cloud.mode === 'cloud') Cloud.refresh();
  });
})(window.NS);
