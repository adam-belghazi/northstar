// Contractor portals. Owner sees /#/hq/portals (list + brand kit) and /#/hq/portal/<id>.
// A contractor only ever sees their own portal at /#/portal.
(function (NS) {
  const { S, A, C, V, esc, icon } = NS;
  const ui = NS.ui;
  const Cloud = NS.Cloud;
  ui.portal = { id: null, data: null, loading: false, error: '' };

  const STANDARD = [
    ['Sign the NDA', 'Download, sign and upload it here.'],
    ['Sign the contract', 'Download, sign and upload it here.'],
    ['Payment details', 'Bank name, IBAN or PayPal email, in a document or a photo.'],
    ['Photo ID', 'A clear photo of your passport or Emirates ID.'],
  ];
  const isOwner = () => Cloud.role === 'owner';

  // ---------- data ----------
  NS.loadPortal = async (id) => {
    ui.portal.loading = true;
    try {
      ui.portal.data = await Cloud.portalData(id);
      ui.portal.id = id;
      ui.portal.error = '';
    } catch (e) {
      ui.portal.error = e.message;
    }
    ui.portal.loading = false;
    if (!NS.ui.modal) NS.render();
  };
  // realtime or upload finished: refresh whichever portal is on screen
  NS.onPortalChange = (force) => {
    const r = ui.route;
    if (r === 'portal' || r.startsWith('hq/portal')) NS.loadPortal(ui.portal.id || (Cloud.portal && Cloud.portal.id));
    else if (r === 'hq/portals' || force) NS.loadBrand();
  };

  const notCloud = () =>
    NS.emptyState('Contractor portals need cloud sync. Follow SETUP.md to connect Supabase and Vercel, then come back here.');

  // ---------- owner: list of portals + brand kit ----------
  ui.brand = null;
  NS.loadBrand = async () => {
    try {
      ui.brand = await Cloud.files('brand', 'all');
    } catch (e) {
      ui.brand = [];
      NS.toast(e.message);
    }
    if (ui.route === 'hq/portals' && !ui.modal) NS.render();
  };

  V.portals = () => {
    const head = NS.head('Contractor portals', 'One private page per contractor. They only ever see their own.');
    if (Cloud.mode !== 'cloud') return head + notCloud();
    if (ui.brand === null) NS.loadBrand();
    const people = S.state.team.filter((m) => m.portal && m.email);
    const off = S.state.team.filter((m) => !(m.portal && m.email));
    return `${head}
      <div class="grid g2">
        <div class="card"><h3>Portals <span class="dim">${people.length}</span></h3>
          <div class="list">${people.length
            ? people.map((m) => `<a class="li" href="#/hq/portal/${m.id}"><span class="av lg">${esc(NS.initials(m.name))}</span><span class="grow"><span class="li-t">${esc(m.name)}</span><span class="li-s">${esc(m.email)} · ${S.state.tasks.filter((t) => t.ownerId === m.id && S.open(t)).length} open tasks</span></span>${icon('chevR', 16)}</a>`).join('')
            : '<div class="dim small">No portals yet. Open a team member, add their email and tick “Give them a portal”.</div>'}</div>
          ${off.length ? `<div class="dim small" style="margin-top:12px">No portal: ${off.map((m) => esc(m.name)).join(', ')}</div>` : ''}
        </div>
        <div class="card"><h3>Brand kit <span class="dim">shared with every contractor</span></h3>
          <p class="muted small">Logos, product photos, fonts, guidelines, ad scripts. Upload once and every portal shows them.</p>
          <label class="btn">${icon('upload', 15)}<span>Upload to brand kit</span><input type="file" multiple hidden data-c="uploadFiles" data-scope="brand" data-ref="all"></label>
          <div class="file-list" style="margin-top:14px">${ui.brand === null ? '<div class="dim small">Loading…</div>' : ui.brand.length ? ui.brand.map((f) => NS.fileRow(f, true)).join('') : '<div class="dim small">Empty for now.</div>'}</div>
        </div>
      </div>`;
  };

  // ---------- one portal (owner or contractor) ----------
  const driveEmbed = (url) => {
    const m = String(url || '').match(/folders\/([\w-]+)/);
    if (!m) return url && NS.safeUrl(url) ? `<a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('ext', 14)}<span>Open shared folder</span></a>` : '';
    return `<div class="drive"><iframe title="Shared Google Drive folder" src="https://drive.google.com/embeddedfolderview?id=${esc(m[1])}#grid" loading="lazy"></iframe></div>
      <a class="linkish small" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${icon('ext', 12)} Open in Google Drive</a>`;
  };

  const statusChip = (it) =>
    it.status === 'done' ? NS.chip(it.kind === 'owe_me' ? 'Approved' : 'Delivered', 'var(--ink)')
      : it.status === 'submitted' ? NS.chip(isOwner() ? 'Needs your review' : 'Sent for review', 'var(--p1)')
        : NS.chip(it.kind === 'owe_you' && it.requested_by === 'contractor' ? 'Requested' : 'To do', 'var(--dim)');

  const itemRow = (it, files) => {
    const file = it.file_path ? files.find((f) => f.path === it.file_path) : null;
    let actions = '';
    if (isOwner()) {
      if (it.kind === 'owe_me' && it.status === 'submitted') actions += `<button type="button" class="btn sm pri" data-a="itemStatus" data-id="${it.id}" data-v="done">Approve</button><button type="button" class="btn sm" data-a="itemStatus" data-id="${it.id}" data-v="open">Send back</button>`;
      if (it.kind === 'owe_you' && it.status !== 'done') actions += `<button type="button" class="btn sm pri" data-a="itemStatus" data-id="${it.id}" data-v="done">Mark delivered</button>`;
      if (it.status === 'done') actions += `<button type="button" class="btn sm ghost" data-a="itemStatus" data-id="${it.id}" data-v="open">Reopen</button>`;
      actions += `<button type="button" class="btn ghost sm icon-only" data-a="itemDelete" data-id="${it.id}" aria-label="Remove">${icon('trash', 14)}</button>`;
    } else if (it.kind === 'owe_me' && it.status !== 'done') {
      actions += `<label class="btn sm ${it.status === 'open' ? 'pri' : ''}">${icon('upload', 13)}<span>${it.file_path ? 'Replace file' : 'Upload'}</span><input type="file" hidden data-c="itemUpload" data-id="${it.id}"></label>`;
      if (it.status === 'open') actions += `<button type="button" class="btn sm" data-a="itemStatus" data-id="${it.id}" data-v="submitted">Mark as done</button>`;
    } else if (it.kind === 'owe_you' && it.requested_by === 'contractor' && it.status === 'open') {
      actions += `<button type="button" class="btn ghost sm icon-only" data-a="itemDelete" data-id="${it.id}" aria-label="Withdraw request">${icon('trash', 14)}</button>`;
    }
    return `<div class="item ${it.status}">
      <span class="item-check">${it.status === 'done' ? icon('check', 14) : ''}</span>
      <div class="grow">
        <div class="item-t">${esc(it.title)}</div>
        ${it.detail ? `<div class="item-d">${esc(it.detail)}</div>` : ''}
        <div class="item-meta">${statusChip(it)}${file ? `<button type="button" class="linkish small" data-a="openFile" data-path="${esc(file.path)}">${icon('clip', 12)} ${esc(file.name)}</button>` : ''}</div>
      </div>
      <div class="item-act">${actions}</div>
    </div>`;
  };

  const portalBody = (d, owner) => {
    const p = d.portal;
    const me = owner ? S.state.team.find((m) => m.id === p.id) : null;
    const oweMe = d.items.filter((i) => i.kind === 'owe_me');
    const oweYou = d.items.filter((i) => i.kind === 'owe_you');
    const done = oweMe.filter((i) => i.status === 'done').length;
    const tasks = owner ? S.state.tasks.filter((t) => t.ownerId === p.id) : d.tasks || [];
    const openTasks = tasks.filter((t) => t.stage !== 'done').length;

    const ownerBar = owner
      ? `<div class="card portal-admin">
          <div class="grow"><div class="eyebrow">Access</div>
            <div>${esc(p.email)} · ${p.enabled ? (p.invited_at ? `login sent ${NS.fmtDate(p.invited_at.slice(0, 10))}` : 'login not sent yet') : 'portal turned off'}</div>
            <div class="dim small">They sign in at ${esc(location.origin)} with this email and a one-time code.</div></div>
          <button type="button" class="btn" data-a="editMember" data-id="${p.id}">${icon('edit', 14)}<span>Edit</span></button>
          ${p.enabled ? `<button type="button" class="btn pri" data-a="sendInvite" data-id="${p.id}">${icon('door', 15)}<span>${p.invited_at ? 'Resend login' : 'Send login'}</span></button>` : ''}
        </div>`
      : '';

    return `${ownerBar}
      <div class="grid g3">
        ${NS.stat('Onboarding', `${done}/${oweMe.length}`, oweMe.length ? 'items approved' : 'nothing yet', 'var(--p1)')}
        ${NS.stat('Open tasks', openTasks, NS.plural(tasks.length, 'task') + ' total')}
        ${NS.stat(owner ? 'You still owe them' : 'Still owed to you', oweYou.filter((i) => i.status !== 'done').length, 'items to deliver')}
      </div>
      <div class="grid g2">
        <div class="card"><h3>${owner ? 'What they owe you' : 'What you owe me'} <span class="dim">onboarding</span></h3>
          <div class="items">${oweMe.length ? oweMe.map((i) => itemRow(i, d.files)).join('') : `<div class="dim small">${owner ? 'Nothing requested yet.' : 'Nothing needed from you right now.'}</div>`}</div>
          ${owner ? `<div class="btn-row" style="margin-top:14px"><button type="button" class="btn sm" data-a="itemNew" data-kind="owe_me">${icon('plus', 13)}<span>Add item</span></button>
            ${oweMe.length ? '' : `<button type="button" class="btn sm" data-a="itemStandard">${icon('checkin', 13)}<span>Add standard onboarding</span></button>`}</div>` : ''}
        </div>
        <div class="card"><h3>${owner ? 'What you owe them' : 'What I owe you'}</h3>
          <div class="items">${oweYou.length ? oweYou.map((i) => itemRow(i, d.files)).join('') : '<div class="dim small">Nothing listed yet.</div>'}</div>
          <div class="btn-row" style="margin-top:14px"><button type="button" class="btn sm" data-a="itemNew" data-kind="owe_you">${icon('plus', 13)}<span>${owner ? 'Add item' : 'Ask for something'}</span></button></div>
        </div>
      </div>
      <section class="sect"><div class="sect-h"><h2>${owner ? 'Their tasks' : 'Your tasks'}</h2><span class="dim small">${owner ? 'Synced with your Pipeline' : 'Drag a card to update its stage'}</span></div>
        ${tasks.length ? NS.board(tasks, owner ? { owner: p.name } : { contractor: true, noDeps: true, owner: p.name, action: 'cTask' }) : NS.emptyState(owner ? 'No tasks assigned. Set a task’s owner to this person in the Pipeline.' : 'No tasks assigned to you yet.')}
      </section>
      <div class="grid g2">
        <div class="card"><h3>Files</h3>
          <label class="btn sm">${icon('upload', 14)}<span>Upload files</span><input type="file" multiple hidden data-c="uploadFiles" data-scope="portal" data-ref="${esc(p.id)}"></label>
          <div class="file-list" style="margin-top:14px">${d.files.length ? d.files.map((f) => NS.fileRow(f, owner || f.uploaded_by === (Cloud.user && Cloud.user.email))).join('') : '<div class="dim small">No files yet.</div>'}</div>
          ${p.drive_url ? `<div style="margin-top:16px">${driveEmbed(p.drive_url)}</div>` : ''}
        </div>
        <div class="card"><h3>Brand kit</h3>
          <div class="file-list">${d.brand.length ? d.brand.map((f) => NS.fileRow(f, false)).join('') : '<div class="dim small">No brand files yet.</div>'}</div>
          ${owner ? '<div class="dim small" style="margin-top:12px">Manage the brand kit on the Contractor portals page.</div>' : ''}
        </div>
      </div>`;
  };

  V.portalOwner = (id) => {
    if (Cloud.mode !== 'cloud') return NS.head('Portal') + notCloud();
    const m = S.state.team.find((x) => x.id === id);
    const title = m ? `${m.name}'s portal` : 'Portal';
    if (ui.portal.id !== id && !ui.portal.loading) { ui.portal.data = null; NS.loadPortal(id); }
    const d = ui.portal.id === id ? ui.portal.data : null;
    let body;
    if (ui.portal.error) body = NS.emptyState(esc(ui.portal.error));
    else if (!d) body = '<div class="dim pad">Loading…</div>';
    else if (!d.portal) body = NS.emptyState(Cloud.status === 'saving' ? 'Saving… open this again in a moment.' : 'This person has no portal yet. Add their email and tick “Give them a portal”.', m ? `<button class="btn pri" data-a="editMember" data-id="${id}">Edit ${esc(m.name)}</button>` : '');
    else body = portalBody(d, true);
    return NS.head(title, m ? esc(m.role || '') : '', `<a class="btn ghost" href="#/hq/portals">${icon('chevL', 15)}<span>All portals</span></a>`) + body;
  };

  V.portalContractor = () => {
    const p = Cloud.portal;
    if (ui.portal.id !== p.id && !ui.portal.loading) NS.loadPortal(p.id);
    const d = ui.portal.id === p.id ? ui.portal.data : null;
    const body = ui.portal.error ? NS.emptyState(esc(ui.portal.error)) : d ? portalBody(d, false) : '<div class="dim pad">Loading…</div>';
    return NS.head(`Welcome, ${p.name.split(' ')[0]}`, 'Your onboarding, your tasks and your files, in one place.') + body;
  };

  // ---------- actions ----------
  const pid = () => ui.portal.id;
  const after = (msg) => { if (msg) NS.toast(msg); NS.loadPortal(pid()); };

  A.sendInvite = async (el) => {
    el.disabled = true;
    try {
      await Cloud.invite(el.dataset.id);
      after('Login email sent');
    } catch (e) {
      el.disabled = false;
      NS.toast(e.message);
    }
  };
  A.itemStandard = async () => {
    try {
      for (let i = 0; i < STANDARD.length; i++) await Cloud.addItem({ portal_id: pid(), kind: 'owe_me', title: STANDARD[i][0], detail: STANDARD[i][1], sort: i });
      after('Onboarding checklist added');
    } catch (e) { NS.toast(e.message); }
  };
  const itemFields = [
    { k: 'title', label: 'Item', full: true },
    { k: 'detail', label: 'Details (optional)', type: 'textarea', full: true, rows: 2 },
  ];
  A.itemNew = (el) => {
    const kind = el.dataset.kind;
    const owner = isOwner();
    NS.openModal({
      title: owner ? (kind === 'owe_me' ? 'What they need to give you' : 'What you owe them') : 'Ask for something',
      body: NS.fields(itemFields, { title: '', detail: '' }) + (owner ? '' : '<p class="dim small">Logo files, access to an account, a payment, anything you need to do your work.</p>'),
      saveLabel: owner ? 'Add' : 'Send request',
      onSave: (form) => {
        const v = NS.readForm(form, itemFields);
        if (!v.title) { NS.toast('Write what it is'); return false; }
        Cloud.addItem({ portal_id: pid(), kind, title: v.title, detail: v.detail, requested_by: owner ? 'owner' : 'contractor', sort: 100 })
          .then(() => { after(owner ? 'Added' : 'Request sent'); if (!owner) Cloud.ping(`asked for: ${v.title}`); })
          .catch((e) => NS.toast(e.message));
      },
    });
  };
  A.itemStatus = async (el) => {
    const it = ui.portal.data.items.find((i) => i.id === el.dataset.id);
    try {
      await Cloud.updateItem(el.dataset.id, { status: el.dataset.v });
      if (!isOwner() && el.dataset.v === 'submitted') Cloud.ping(`finished “${it.title}”`);
      if (el.dataset.v === 'done') NS.celebrateEl(el.closest('.item'));
      after();
    } catch (e) { NS.toast(e.message); }
  };
  A.itemDelete = async (el) => {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.classList.add('danger'); NS.toast('Tap again to remove'); return; }
    try { await Cloud.deleteItem(el.dataset.id); after('Removed'); } catch (e) { NS.toast(e.message); }
  };
  C.itemUpload = async (el) => {
    const file = el.files[0];
    el.value = '';
    if (!file) return;
    const it = ui.portal.data.items.find((i) => i.id === el.dataset.id);
    NS.toast('Uploading…');
    try {
      const row = await Cloud.upload('portal', pid(), file);
      await Cloud.updateItem(it.id, { file_path: row.path, status: 'submitted' });
      Cloud.ping(`uploaded “${it.title}”`);
      after('Uploaded and sent for review');
    } catch (e) { NS.toast('Upload failed: ' + e.message); }
  };

  // contractor task: view details, tick checklists, change stage
  A.cTask = (el) => {
    const t = (ui.portal.data.tasks || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    ui.draft = NS.clone(t);
    const f = [{ k: 'stage', label: 'Stage', type: 'select', options: S.STAGES.filter((s) => s.k !== 'hold_money' || t.stage === 'hold_money') }];
    NS.openModal({
      title: t.name,
      wide: true,
      body: `<div class="ctask-meta">${t.deadline ? `<span>${icon('cal', 14)} Due ${NS.fmtDate(t.deadline, { day: 'numeric', month: 'short', year: 'numeric' })} · ${NS.rel(t.deadline)}</span>` : ''}${NS.chip(S.find(S.PRIOS, t.priority).label + ' priority', S.find(S.PRIOS, t.priority).color)}</div>
        ${t.notes ? `<div class="where"><span>Notes</span>${esc(t.notes)}</div>` : ''}
        ${NS.fields(f, ui.draft)}
        ${(t.subtasks || []).length ? `<div class="subed"><div class="subed-h"><span class="fl">Checklist</span></div>${t.subtasks.map((s, i) => `<div class="subitem"><div class="sub-row"><b class="grow">${esc(s.title)}</b>${s.due ? `<span class="dim small">${NS.fmtDate(s.due)}</span>` : ''}</div>
          ${(s.checklist || []).length ? `<div class="chk-list">${s.checklist.map((c, j) => `<label class="chk-row"><input type="checkbox" data-d="subtasks.${i}.checklist.${j}.done" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span></label>`).join('')}</div>`
            : `<label class="chk-row" style="margin-top:6px"><input type="checkbox" data-d="subtasks.${i}.done" ${s.done ? 'checked' : ''}><span>Done</span></label>`}</div>`).join('')}</div>` : ''}
        ${NS.fileSection('task', t.id)}`,
      onSave: (form) => {
        const v = NS.readForm(form, f);
        const nt = Object.assign(ui.draft, v);
        nt.subtasks.forEach((s) => { if ((s.checklist || []).length) s.done = s.checklist.every((c) => c.done); });
        if (nt.stage === 'done' && !nt.completed) nt.completed = NS.today();
        const moved = nt.stage !== t.stage;
        Cloud.updateTaskData(nt)
          .then(() => { Cloud.ping(moved ? `moved “${nt.name}” to ${S.find(S.STAGES, nt.stage).label}` : `updated “${nt.name}”`); after('Saved'); })
          .catch((e) => NS.toast(e.message));
      },
    });
    NS.loadFileSection();
  };
  NS.contractorMoveTask = async (id, stage) => {
    const t = (ui.portal.data.tasks || []).find((x) => x.id === id);
    if (!t || t.stage === stage || stage === 'hold_money') return;
    const nt = Object.assign(NS.clone(t), { stage });
    if (stage === 'done') nt.completed = NS.today();
    t.stage = stage; // optimistic
    NS.render();
    try {
      await Cloud.updateTaskData(nt);
      Cloud.ping(`moved “${t.name}” to ${S.find(S.STAGES, stage).label}`);
      if (stage === 'done') NS.celebrate(id);
      after();
    } catch (e) { NS.toast(e.message); after(); }
  };
})(window.NS);
