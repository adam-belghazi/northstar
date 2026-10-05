(function (NS) {
  const esc = NS.esc;
  const icon = NS.icon;

  NS.ui = { route: 'home', draft: null, modal: null, cal: {}, scroll: {} };
  NS.A = {}; // click actions:   data-a="name"
  NS.C = {}; // change handlers: data-c="name"
  NS.V = {}; // views

  // ---------- small components ----------
  NS.ring = (p, { size = 120, stroke = 6, color = 'var(--p1)', label = '', sub = '' } = {}) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - NS.clamp(p || 0, 0, 1));
    const h = size / 2;
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
        <circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${h} ${h})"/>
      </svg>
      <div class="ring-in"><div class="ring-v num">${label}</div>${sub ? `<div class="ring-s">${sub}</div>` : ''}</div>
    </div>`;
  };
  NS.bar = (p, color, cls = '') =>
    `<div class="bar ${cls}" style="--c:${color || 'var(--blue)'}"><i style="width:${NS.clamp(p || 0, 0, 1) * 100}%"></i></div>`;
  NS.chip = (label, color) => `<span class="chip" style="--c:${color || 'var(--muted)'}">${esc(label)}</span>`;
  NS.seg = (opts, cur, action, extra = '') =>
    `<div class="seg" role="group">${opts
      .map(
        (o) =>
          `<button type="button" class="${o.k === cur ? 'on' : ''}" data-a="${action}" data-v="${o.k}" ${extra}>${o.icon ? icon(o.icon, 15) : ''}<span>${esc(o.label)}</span></button>`
      )
      .join('')}</div>`;
  NS.head = (title, sub, actions = '') => {
    const r = NS.ui.route || '';
    const sec = r.startsWith('hq') ? 'HQ · PawMinds' : r.startsWith('life') ? 'Life' : '';
    return `<div class="top"><div class="top-t">${sec ? `<div class="sec-eyebrow">${sec}</div>` : ''}<h1>${esc(title)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="top-act">${actions}</div></div>`;
  };
  NS.emptyState = (msg, btn = '') => `<div class="emptyst">${icon('star', 22)}<p>${msg}</p>${btn}</div>`;
  NS.stat = (label, value, sub = '', color = '') =>
    `<div class="card stat" ${color ? `style="--c:${color}"` : ''}><div class="stat-l">${label}</div><div class="big num">${value}</div>${sub ? `<div class="stat-s">${sub}</div>` : ''}</div>`;
  NS.disp = (v, cur) => {
    const to = NS.S.state.settings.currency;
    return NS.fmtMoney(NS.convert(Number(v) || 0, cur || 'AED', to), to);
  };

  // ---------- toast ----------
  let toastT;
  NS.toast = (msg) => {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('show'), 2600);
  };

  // ---------- modal ----------
  NS.openModal = ({ title, body, onSave, onDelete, saveLabel = 'Save', wide = false }) => {
    NS.ui.modal = { onSave, onDelete };
    document.getElementById('modal-root').innerHTML = `
      <div class="mback" data-a="mClose">
        <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
          <div class="m-h"><h2>${esc(title)}</h2><button type="button" class="btn ghost sm icon-only" data-a="mClose" aria-label="Close">${icon('x')}</button></div>
          <form id="mform" class="m-b" autocomplete="off">${body}</form>
          <div class="m-f">
            ${onDelete ? `<button type="button" class="btn ghost danger" data-a="mDelete">${icon('trash', 15)}<span>Delete</span></button>` : ''}
            <span class="spacer"></span>
            <button type="button" class="btn ghost" data-a="mClose">Cancel</button>
            ${onSave ? `<button type="button" class="btn pri" data-a="mSave">${esc(saveLabel)}</button>` : ''}
          </div>
        </div>
      </div>`;
    document.body.classList.add('modal-open');
    if (window.matchMedia('(min-width: 861px)').matches) {
      setTimeout(() => {
        const f = document.querySelector('#mform input:not([type=checkbox]):not([type=hidden]), #mform textarea');
        f && f.focus();
      }, 30);
    }
  };
  NS.closeModal = () => {
    document.getElementById('modal-root').innerHTML = '';
    document.body.classList.remove('modal-open');
    NS.ui.modal = null;
    NS.ui.draft = null;
  };
  NS.confirm = (title, msg, onYes, label = 'Confirm') =>
    NS.openModal({ title, body: `<p class="muted">${msg}</p>`, saveLabel: label, onSave: () => { onYes(); } });

  NS.A.mClose = (el, e) => {
    if (el.classList.contains('mback') && e.target !== el) return;
    NS.closeModal();
  };
  NS.A.mSave = () => {
    const m = NS.ui.modal;
    if (!m || !m.onSave) return;
    const res = m.onSave(document.getElementById('mform'));
    if (res === false) return;
    NS.S.save();
    NS.closeModal();
    NS.render();
  };
  NS.A.mDelete = (el) => {
    if (!el.dataset.armed) {
      el.dataset.armed = '1';
      el.querySelector('span').textContent = 'Click again to delete';
      return;
    }
    NS.ui.modal.onDelete();
    NS.S.save();
    NS.closeModal();
    NS.render();
  };

  // ---------- forms ----------
  const opt = (o) => (typeof o === 'string' ? { k: o, label: o } : o);
  NS.field = (f, obj) => {
    const v = obj[f.k];
    const cls = 'fld' + (f.full ? ' full' : '');
    const lab = `<span class="fl">${esc(f.label)}</span>`;
    const hint = f.hint ? `<em class="hint">${f.hint}</em>` : '';
    switch (f.type) {
      case 'check':
        return `<label class="${cls} chk"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span>${hint}</label>`;
      case 'textarea':
        return `<label class="${cls}">${lab}<textarea name="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>${hint}</label>`;
      case 'select': {
        const opts = f.options.map(opt);
        if (v && !opts.some((o) => String(o.k) === String(v))) opts.push({ k: v, label: v });
        return `<label class="${cls}">${lab}<select name="${f.k}">${opts
          .map((o) => `<option value="${esc(o.k)}" ${String(v) === String(o.k) ? 'selected' : ''}>${esc(o.label)}</option>`)
          .join('')}</select>${hint}</label>`;
      }
      case 'money':
        return `<label class="${cls}">${lab}<div class="money-in"><input type="number" step="any" min="0" name="${f.k}" value="${v ?? ''}" placeholder="0"><select name="${f.cur}">${['AED', 'USD']
          .map((c) => `<option ${(obj[f.cur] || 'AED') === c ? 'selected' : ''}>${c}</option>`)
          .join('')}</select></div>${hint}</label>`;
      case 'multi': {
        if (!f.options.length) return `<div class="${cls}">${lab}<div class="dim small">${f.empty || 'Nothing to pick yet'}</div></div>`;
        const set = new Set(v || []);
        return `<div class="${cls}">${lab}<div class="multi">${f.options
          .map(
            (o) =>
              `<label class="mopt"><input type="checkbox" name="${f.k}" value="${esc(o.k)}" ${set.has(o.k) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`
          )
          .join('')}</div>${hint}</div>`;
      }
      case 'datalist':
        return `<label class="${cls}">${lab}<input name="${f.k}" value="${esc(v)}" list="dl_${f.k}" placeholder="${esc(f.ph || '')}"><datalist id="dl_${f.k}">${f.options
          .map((o) => `<option value="${esc(o)}">`)
          .join('')}</datalist>${hint}</label>`;
      case 'static':
        return `<div class="${cls}">${lab}<div class="static">${f.html}</div></div>`;
      default:
        return `<label class="${cls}">${lab}<input type="${f.type || 'text'}" name="${f.k}" value="${esc(v)}" ${f.type === 'number' ? 'step="any"' : ''} placeholder="${esc(f.ph || '')}">${hint}</label>`;
    }
  };
  NS.fields = (list, obj) => `<div class="fgrid">${list.map((f) => NS.field(f, obj)).join('')}</div>`;
  NS.readForm = (form, list) => {
    const o = {};
    for (const f of list) {
      if (f.type === 'static') continue;
      if (f.type === 'multi') {
        o[f.k] = [...form.querySelectorAll(`input[name="${f.k}"]:checked`)].map((i) => i.value);
        continue;
      }
      const el = form.elements.namedItem(f.k);
      if (!el) continue;
      if (f.type === 'check') o[f.k] = el.checked;
      else if (f.type === 'number' || f.type === 'money') o[f.k] = el.value === '' ? null : parseFloat(el.value);
      else o[f.k] = el.value.trim();
      if (f.type === 'money') o[f.cur] = form.elements.namedItem(f.cur).value;
    }
    return o;
  };

  // ---------- draft editors (subtasks / checklists / attachments) ----------
  NS.subEditor = (mode) => {
    const d = NS.ui.draft;
    const subs = d.subtasks || (d.subtasks = []);
    const done = subs.filter((s) => NS.S.subPct(s) === 1).length;
    const rows = subs
      .map((s, i) => {
        const hasChk = mode === 'task' && s.checklist && s.checklist.length;
        const p = NS.S.subPct(s);
        const checklist =
          mode === 'task'
            ? `<div class="chk-list">${(s.checklist || [])
                .map(
                  (c, j) => `<div class="chk-row">
                    <input type="checkbox" data-d="subtasks.${i}.checklist.${j}.done" ${c.done ? 'checked' : ''} aria-label="Done">
                    <input class="grow" data-d="subtasks.${i}.checklist.${j}.text" value="${esc(c.text)}" placeholder="Checklist item">
                    <button type="button" class="btn ghost sm icon-only" data-a="dDelChk" data-i="${i}" data-j="${j}" aria-label="Remove">${icon('x', 14)}</button>
                  </div>`
                )
                .join('')}
                <div class="chk-foot"><button type="button" class="btn ghost sm" data-a="dAddChk" data-i="${i}">${icon('plus', 13)}<span>Checklist item</span></button>
                ${hasChk ? `<div class="grow">${NS.bar(p, 'var(--p1)', 'sm')}</div><span class="num small dim">${NS.pct(p)}</span>` : ''}</div>
              </div>`
            : '';
        return `<div class="subitem">
          <div class="sub-row">
            <input type="checkbox" data-d="subtasks.${i}.done" ${(hasChk ? p === 1 : s.done) ? 'checked' : ''} ${hasChk ? 'disabled title="Completes when its checklist is done"' : ''} aria-label="Done">
            <input class="grow" data-d="subtasks.${i}.title" value="${esc(s.title)}" placeholder="Subtask">
            <input type="date" data-d="subtasks.${i}.due" value="${esc(s.due || '')}" aria-label="Due date">
            <button type="button" class="btn ghost sm icon-only" data-a="dDelSub" data-i="${i}" aria-label="Remove subtask">${icon('trash', 14)}</button>
          </div>${checklist}
        </div>`;
      })
      .join('');
    return `<div class="subed" id="subed" data-mode="${mode}">
      <div class="subed-h"><span class="fl">${mode === 'task' ? 'Subtasks & checklists' : 'Subtasks'}</span><span class="dim small">${done}/${subs.length} done</span></div>
      ${rows}
      <button type="button" class="btn sm" data-a="dAddSub">${icon('plus', 14)}<span>Add subtask</span></button>
    </div>`;
  };
  NS.attEditor = () => {
    const d = NS.ui.draft;
    const atts = d.attachments || (d.attachments = []);
    return `<div class="subed" id="atted">
      <div class="subed-h"><span class="fl">Attached files (links)</span><span class="dim small">Uploads arrive with cloud sync in Phase 2</span></div>
      ${atts
        .map(
          (a, i) => `<div class="sub-row">
            ${icon('clip', 15)}
            <input data-d="attachments.${i}.name" value="${esc(a.name)}" placeholder="Name">
            <input class="grow" data-d="attachments.${i}.url" value="${esc(a.url)}" placeholder="https://drive.google.com/…">
            <button type="button" class="btn ghost sm icon-only" data-a="dDelAtt" data-i="${i}" aria-label="Remove">${icon('x', 14)}</button>
          </div>`
        )
        .join('')}
      <button type="button" class="btn sm" data-a="dAddAtt">${icon('plus', 14)}<span>Add link</span></button>
    </div>`;
  };
  NS.refreshDraft = (focusSel) => {
    const se = document.getElementById('subed');
    if (se) se.outerHTML = NS.subEditor(se.dataset.mode);
    const ae = document.getElementById('atted');
    if (ae) ae.outerHTML = NS.attEditor();
    if (focusSel) {
      const el = document.querySelector(focusSel);
      el && el.focus();
    }
  };
  NS.A.dAddSub = () => {
    const subs = NS.ui.draft.subtasks;
    subs.push({ id: NS.uid(), title: '', due: '', done: false, checklist: [] });
    NS.refreshDraft(`[data-d="subtasks.${subs.length - 1}.title"]`);
  };
  NS.A.dDelSub = (el) => {
    NS.ui.draft.subtasks.splice(+el.dataset.i, 1);
    NS.refreshDraft();
  };
  NS.A.dAddChk = (el) => {
    const i = +el.dataset.i;
    const s = NS.ui.draft.subtasks[i];
    (s.checklist = s.checklist || []).push({ id: NS.uid(), text: '', done: false });
    NS.refreshDraft(`[data-d="subtasks.${i}.checklist.${s.checklist.length - 1}.text"]`);
  };
  NS.A.dDelChk = (el) => {
    NS.ui.draft.subtasks[+el.dataset.i].checklist.splice(+el.dataset.j, 1);
    NS.refreshDraft();
  };
  NS.A.dAddAtt = () => {
    const a = NS.ui.draft.attachments;
    a.push({ name: '', url: '' });
    NS.refreshDraft(`[data-d="attachments.${a.length - 1}.name"]`);
  };
  NS.A.dDelAtt = (el) => {
    NS.ui.draft.attachments.splice(+el.dataset.i, 1);
    NS.refreshDraft();
  };

  // ---------- timeline (gantt) ----------
  NS.gantt = (items, key) => {
    const T = NS.today();
    const rows = items
      .filter((i) => i.start || i.end)
      .map((i) => {
        const start = i.start || i.end;
        let end = i.end || i.start;
        if (end < start) end = start;
        return Object.assign({}, i, { start, end });
      })
      .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    const undated = items.filter((i) => !i.start && !i.end);
    const undatedNote = undated.length
      ? `<div class="dim small" style="margin-top:10px">No dates yet: ${undated.map((u) => esc(u.label)).join(', ')}</div>`
      : '';
    if (!rows.length) return NS.emptyState('Add start and due dates to see the timeline.') + undatedNote;

    let min = [T, ...rows.map((r) => r.start)].sort()[0];
    let max = [T, ...rows.map((r) => r.end)].sort().pop();
    min = NS.addDays(min, -4);
    max = NS.addDays(max, 10);
    const days = NS.diff(min, max) + 1;
    const dw = Math.max(4, Math.min(34, Math.floor(1100 / days)));
    const W = days * dw;

    let months = '';
    let wk = '';
    let wkLab = '';
    for (let i = 0; i < days; i++) {
      const dt = NS.parse(NS.addDays(min, i));
      if (dt.getDate() === 1 || (i === 0 && dt.getDate() < 22)) {
        months += `<div class="g-month" style="left:${i * dw}px">${dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</div>`;
      }
      if (dt.getDay() === 1) {
        wk += `<div class="g-wk" style="left:${i * dw}px"></div>`;
        if (dw >= 9) wkLab += `<div class="g-day" style="left:${i * dw}px">${dt.getDate()}</div>`;
      }
    }
    const tx = NS.diff(min, T) * dw + dw / 2;
    const lab = rows
      .map(
        (r) =>
          `<div class="g-lab" ${r.attrs || ''}><span class="dot" style="--c:${r.color}"></span><div class="g-lt"><div class="g-t">${esc(r.label)}</div>${r.sub ? `<div class="g-s">${esc(r.sub)}</div>` : ''}</div></div>`
      )
      .join('');
    const bars = rows
      .map((r) => {
        const x = NS.diff(min, r.start) * dw;
        const w = Math.max(dw, (NS.diff(r.start, r.end) + 1) * dw);
        const late = r.end < T && (r.pct || 0) < 1;
        return `<div class="g-row"><button type="button" class="g-bar ${late ? 'late' : ''}" style="left:${x}px;width:${w}px;--c:${r.color}" ${r.attrs || ''}
          title="${esc(r.label)} · ${NS.fmtDate(r.start)} → ${NS.fmtDate(r.end)}"><i style="width:${(r.pct || 0) * 100}%"></i>${w > 54 ? `<span>${NS.pct(r.pct)}</span>` : ''}</button></div>`;
      })
      .join('');
    return `<div class="gantt">
      <div class="g-left"><div class="g-head"></div>${lab}</div>
      <div class="g-scroll" data-keep="${key}" data-today="${tx}">
        <div class="g-track" style="width:${W}px">
          <div class="g-head">${months}${wkLab}</div>
          <div class="g-body">${wk}${bars}<div class="g-today" style="left:${tx}px"><span>Today</span></div></div>
        </div>
      </div>
    </div>${undatedNote}`;
  };

  // ---------- month calendar ----------
  NS.calendar = (key, events) => {
    const T = NS.today();
    const ym = NS.ui.cal[key] || T.slice(0, 7);
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const off = (first.getDay() + 6) % 7;
    const dim = new Date(y, m, 0).getDate();
    const weeks = Math.ceil((off + dim) / 7);
    const start = NS.addDays(NS.iso(first), -off);
    const byDate = {};
    events.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push(e));
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const ds = NS.addDays(start, i);
      const evs = byDate[ds] || [];
      cells += `<div class="cal-c ${ds.slice(0, 7) === ym ? '' : 'out'} ${ds === T ? 'today' : ''}">
        <div class="cal-d">${NS.parse(ds).getDate()}</div>
        ${evs
          .slice(0, 3)
          .map(
            (e) =>
              `<button type="button" class="ev ${e.done ? 'done' : ''}" style="--c:${e.color}" ${e.attrs || ''} title="${esc(e.label)}">${esc(e.label)}</button>`
          )
          .join('')}
        ${evs.length > 3 ? `<div class="ev-more">+${evs.length - 3} more</div>` : ''}
      </div>`;
    }
    const title = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `<div class="card cal flush">
      <div class="cal-h">
        <button type="button" class="btn ghost sm icon-only" data-a="calNav" data-k="${key}" data-v="-1" aria-label="Previous month">${icon('chevL')}</button>
        <div class="cal-t">${title}</div>
        <button type="button" class="btn ghost sm icon-only" data-a="calNav" data-k="${key}" data-v="1" aria-label="Next month">${icon('chevR')}</button>
        <span class="spacer"></span>
        <button type="button" class="btn sm" data-a="calNav" data-k="${key}" data-v="0">Today</button>
      </div>
      <div class="cal-g">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div class="cal-wd">${d}</div>`).join('')}${cells}</div>
    </div>`;
  };
  // ---------- motion: a small "done" moment ----------
  NS.celebrate = (id) => (NS.ui.celebrate = id);
  NS.celebrateEl = (el) => {
    if (!el) return;
    el.classList.remove('just-done');
    void el.offsetWidth;
    el.classList.add('just-done');
  };
  NS.afterRender = () => {
    const id = NS.ui.celebrate;
    if (!id) return;
    NS.ui.celebrate = null;
    document.querySelectorAll(`[data-drag="${id}"]`).forEach(NS.celebrateEl);
  };

  // ---------- tiny, safe Markdown (for AI reviews) ----------
  NS.md = (src) => {
    const inline = (s) =>
      esc(s)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
    const out = [];
    let list = null;
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    String(src || '').split(/\r?\n/).forEach((line) => {
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      const ul = line.match(/^\s*[-*•]\s+(.*)$/);
      const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (h) { close(); out.push(`<h${Math.min(4, h[1].length + 1)}>${inline(h[2])}</h${Math.min(4, h[1].length + 1)}>`); }
      else if (ul) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(ul[1])}</li>`); }
      else if (ol) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(ol[1])}</li>`); }
      else if (!line.trim()) close();
      else { close(); out.push(`<p>${inline(line)}</p>`); }
    });
    close();
    return out.join('');
  };

  // ---------- sync status ----------
  NS.syncBadge = () => {
    const C = NS.Cloud;
    const map = {
      local: ['On this device only', 'dim'],
      synced: ['Synced', 'ok'],
      saving: ['Saving…', 'busy'],
      offline: ['Offline · saved here', 'warn'],
      error: ['Sync problem · retrying', 'warn'],
    };
    const [label, cls] = map[C ? C.status : 'local'] || map.local;
    return `<span id="sync" class="sync ${cls}" title="${esc((C && C.error) || label)}"><span class="sync-dot"></span>${label}</span>`;
  };

  // ---------- theme (per device) ----------
  NS.getTheme = () => {
    try { return localStorage.getItem('northstar.theme') || 'system'; } catch (e) { return 'system'; }
  };
  NS.applyTheme = () => {
    const t = NS.getTheme();
    const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#131316' : '#F6F6F4';
  };
  NS.setTheme = (t) => {
    try { localStorage.setItem('northstar.theme', t); } catch (e) { /* per-device preference only */ }
    NS.applyTheme();
  };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', NS.applyTheme);

  NS.A.calNav = (el) => {
    const k = el.dataset.k;
    const v = +el.dataset.v;
    if (!v) delete NS.ui.cal[k];
    else {
      const cur = NS.ui.cal[k] || NS.today().slice(0, 7);
      const [y, m] = cur.split('-').map(Number);
      NS.ui.cal[k] = NS.iso(new Date(y, m - 1 + v, 1)).slice(0, 7);
    }
    NS.render();
  };
})(window.NS);
