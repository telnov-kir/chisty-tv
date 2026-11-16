/* ЧИСТЫЙ ТВ · реальный режим по умолчанию; учебный пример — только по явному запросу. */
(() => {
    'use strict';
    const D = window.CTV_DATA;
    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const uid = () => Math.random().toString(36).slice(2, 9);
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const load = (k, f) => { try { const v = JSON.parse(localStorage.getItem('ctv3.' + k)); return v ?? f; } catch { return f; } };
    const save = () => {
        try {
            localStorage.setItem('ctv3.steps', JSON.stringify(S.stepsDone));
            localStorage.setItem('ctv3.views', JSON.stringify(S.savedViews));
            localStorage.setItem('ctv3.ignored', JSON.stringify(S.ignored));
            localStorage.setItem('ctv3.platform', JSON.stringify(S.wizPlatform));
        } catch { }
    };
    const icon = n => `<svg><use href="#i-${n}"/></svg>`;
    const fmtDate = ts => new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const fmtTime = ts => new Date(ts).toLocaleTimeString('ru-RU');

    const S = {
        mode: 'boot', server: false, adb: false, training: false,
        device: null, rawItems: [], enabledSet: new Set(), disabledSet: new Set(), protectedSet: new Set(),
        packages: [], plan: [], protocol: [], journals: [], scanResults: null, diag: null,
        view: 'wizard', wizPlatform: load('platform', 'identify'),
        stepsDone: load('steps', {}), savedViews: load('views', []), ignored: load('ignored', []),
        filters: { q: '', cat: 'all', status: 'all', sort: 'risk', verified: false },
        sel: new Set(), busy: false, drawerPkg: null
    };
    const dbAll = () => Object.values(D.packages).flat();
    const metaOf = n => dbAll().find(p => p.name === n) || { name: n, label: 'Пакет вне проверенной базы', cat: 'unknown', act: 'ask', risk: 'medium', note: 'Не входит в проверенную базу. Перед отключением найди назначение в теме своей модели на 4PDA.', src: null };
    const isProtectedName = n => S.protectedSet.has(n) || D.never.includes(n) || D.patterns.some(p => new RegExp(p, 'i').test(n)) || (S.device && (n === S.device.launcher || n === S.device.ime));

    const API = {
        async req(path, body) {
            const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
            const r = await fetch(path, opt); const j = await r.json(); if (j.error) throw new Error(j.error); return j;
        },
        state() { return this.req('/api/state'); }, adb() { return this.req('/api/adb', {}); },
        connect(b) { return this.req('/api/connect', b); }, packages() { return this.req('/api/packages'); },
        diag() { return this.req('/api/diag'); },
        disable(n) { return this.req('/api/disable', { names: n }); }, enable(n) { return this.req('/api/enable', { names: n }); },
        scan(k) { return this.req('/api/scan', { known: k }); }, journals() { return this.req('/api/journals'); },
        rollback(p) { return this.req('/api/rollback', { path: p }); }, protocol() { return this.req('/api/protocol'); },
        disconnect() { return this.req('/api/disconnect', {}); }
    };

    const T = {
        device: D.training.device, items: [...D.packages.yandex.map(p => p.name), ...D.training.extra],
        enabled: new Set(), disabled: new Set(['com.yandex.android.advid']), protocol: [],
        journals: [{ path: 'training/session-1', ts: Date.now() - 864e5, device: D.training.device.model, names: ['com.yandex.android.advid'], kind: 'clean', rolledBack: false }],
        log(c, o) { this.protocol.push({ ts: Date.now(), cmd: '[учебный] adb shell ' + c, out: o, sim: true }); }
    };
    T.items.forEach(n => { if (!T.disabled.has(n)) T.enabled.add(n); });
    const TR = {
        async state() { await delay(120); return { server: true, adb: true, connected: true, device: T.device }; },
        async adb() { return { ok: true }; },
        async connect() { await delay(400); T.log('connect 192.168.0.0:5555', 'connected (учебный)'); return { ok: true, device: T.device }; },
        async packages() { await delay(120); return { items: T.items, enabled: [...T.enabled], disabled: [...T.disabled], protected: [...D.never, T.device.launcher, T.device.ime], platform: 'yandex', device: T.device }; },
        async diag() {
            await delay(400); return {
                meminfo: 'MemTotal:        2048000 kB\nMemFree:          120000 kB\nMemAvailable:     260000 kB\n',
                loadavg: '2.85 2.40 1.90 3/412 12345', uptime: '86400.12 60000.44', cores: '4',
                top: 'Tasks: 412 total\n  PID USER      PR  NI VIRT  RES  SHR S [%CPU] %MEM  TIME+ ARGS\n 1234 u0_a12   10 -10 2.1g 180m  90m S  38.0  8.8   1:02 com.google.android.gms.persistent\n 2345 u0_a20   10 -10 1.8g 120m  70m S  22.0  5.9   0:41 com.google.android.katniss\n 3456 u0_a30   20   0 1.5g  90m  50m S  12.0  4.4   0:22 com.google.android.apps.tv.dreamx\n',
                df: 'Filesystem      Size  Used Avail Use% Mounted on\n/dev/block/dm-8  12G   11G  600M  95% /data',
                thermal: '/sys/class/thermal/thermal_zone0/temp 78000\n/sys/class/thermal/thermal_zone1/temp 61000'
            };
        },
        async disable(names) {
            await delay(220); const results = names.map(n => {
                if (isProtectedName(n)) { T.log('pm disable-user --user 0 ' + n, 'ЗАЩИЩЁН (учебный)'); return { name: n, ok: false, command: 'pm disable-user --user 0 ' + n, output: 'ЗАЩИЩЁН' }; }
                T.enabled.delete(n); T.disabled.add(n); T.log('pm disable-user --user 0 ' + n, 'Package ' + n + ' new state: disabled-user');
                return { name: n, ok: true, command: 'pm disable-user --user 0 ' + n, output: 'Package ' + n + ' new state: disabled-user' };
            });
            const done = results.filter(r => r.ok).map(r => r.name);
            if (done.length) T.journals.unshift({ path: 'training/' + uid(), ts: Date.now(), device: T.device.model, names: done, kind: 'clean', rolledBack: false });
            return { results };
        },
        async enable(names) { await delay(180); const results = names.map(n => { T.disabled.delete(n); T.enabled.add(n); T.log('pm enable ' + n, 'Package ' + n + ' new state: enabled'); return { name: n, ok: true, command: 'pm enable ' + n, output: 'enabled' }; }); return { results }; },
        async scan() { await delay(500); return { items: D.training.extra }; },
        async journals() { return { items: T.journals }; },
        async rollback(p) { const j = T.journals.find(x => x.path === p); if (j) { j.names.forEach(n => { T.disabled.delete(n); T.enabled.add(n); }); j.rolledBack = true; } return { results: (j ? j.names : []).map(n => ({ name: n, ok: true })) }; },
        async protocol() { return { items: T.protocol }; },
        async disconnect() { return { ok: true }; }
    };
    const BE = () => S.training ? TR : API;

    function toast(msg, { type = 'info', undo = null, timeout = 7000 } = {}) {
        const root = $('#toast-root'); while (root.children.length >= 4) root.firstChild.remove();
        const el = document.createElement('div'); el.className = 'toast ' + type;
        el.innerHTML = `${icon({ ok: 'check', warn: 'warn', err: 'x', info: 'info' }[type])}<span class="toast-msg">${esc(msg)}</span>${undo ? '<button class="toast-undo">Отменить</button>' : ''}<button class="toast-x">${icon('x')}</button><span class="toast-bar" style="animation-duration:${timeout}ms"></span>`;
        const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
        const t = setTimeout(kill, timeout);
        el.querySelector('.toast-x').onclick = () => { clearTimeout(t); kill(); };
        if (undo) el.querySelector('.toast-undo').onclick = () => { clearTimeout(t); kill(); undo(); };
        root.appendChild(el);
    }
    let modalCancel = null;
    function openModal({ title, body, confirmText = 'Подтвердить', danger = false, onConfirm }) {
        const root = $('#modal-root');
        root.innerHTML = `<div class="modal-wrap"><div class="modal"><h3>${esc(title)}</h3><div class="modal-body">${body}</div>
    <div class="modal-actions"><button class="btn btn-ghost" data-m="cancel">Отмена</button>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="ok">${esc(confirmText)}</button></div></div></div>`;
        const wrap = root.firstChild; const close = () => { root.innerHTML = ''; modalCancel = null; };
        modalCancel = close;
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        wrap.querySelector('[data-m=cancel]').onclick = close;
        const ok = wrap.querySelector('[data-m=ok]');
        ok.onclick = () => { const r = onConfirm ? onConfirm(wrap) : true; if (r !== false) close(); };
        ok.focus();
    }
    function openDrawer(n) { S.drawerPkg = n; renderDrawer(); $('#drawer').classList.add('open'); $('#scrim').hidden = false; }
    function closeDrawer() { S.drawerPkg = null; $('#drawer').classList.remove('open'); $('#scrim').hidden = true; }
    function renderDrawer() {
        if (!S.drawerPkg) return;
        const p = S.packages.find(x => x.name === S.drawerPkg) || { ...metaOf(S.drawerPkg), status: 'active', protected: isProtectedName(S.drawerPkg), verified: false };
        const cat = D.categories[p.cat] || D.categories.unknown;
        const cmd = p.status === 'disabled' ? 'adb shell pm enable ' + p.name : 'adb shell pm disable-user --user 0 ' + p.name;
        $('#drawer-body').innerHTML = `
    <div><div class="d-label">${esc(p.label)}</div><div class="d-name">${esc(p.name)}</div></div>
    <div class="d-badges"><span class="badge cat-${p.cat}">${esc(cat.label)}</span><span class="badge risk-${p.risk}">риск: ${esc(D.risks[p.risk])}</span>
      <span class="badge ${p.verified ? 'verified' : 'unverified'}">${p.verified ? 'в проверенной базе' : 'вне базы'}</span>
      <span class="status-pill st-${p.protected ? 'protected' : p.status}">${p.protected ? 'защищён' : p.status === 'disabled' ? 'отключён' : 'активен'}</span></div>
    <div class="d-note">${esc(p.note)}</div>
    ${p.protected ? `<div class="d-protect">${icon('lock')}<span>Защищён сервером: системная функция. Отключение невозможно.</span></div>` : ''}
    <div><div class="muted" style="font-size:12px;margin-bottom:6px">Точная команда:</div><div class="d-cmd">${esc(cmd)}</div></div>
    ${p.src ? `<a class="d-src" href="${D.SRC[p.src]}" target="_blank" rel="noopener">${icon('info')}Источник: ${p.src === 'habr' ? 'разбор на Хабре' : 'темы 4PDA'}</a>` : ''}
    <div class="d-actions">
      ${p.protected ? `<button class="btn btn-ghost" disabled>${icon('lock')}Защищён</button>`
                : p.status === 'disabled' ? `<button class="btn btn-primary" data-action="pkg-enable" data-name="${esc(p.name)}">${icon('undo')}Включить обратно</button>`
                    : `<button class="btn btn-danger" data-action="pkg-disable" data-name="${esc(p.name)}">${icon('zap')}Отключить пакет</button>
           <button class="btn btn-ghost" data-action="pkg-plan" data-name="${esc(p.name)}">${icon('plus')}Добавить в план</button>`}
      <button class="btn btn-ghost" data-action="copy-name" data-name="${esc(p.name)}">${icon('copy')}Скопировать имя</button></div>`;
    }

    function buildPackages() {
        S.packages = S.rawItems.map(n => {
            const m = dbAll().find(p => p.name === n);
            const prot = isProtectedName(n);
            const status = S.disabledSet.has(n) ? 'disabled' : 'active';
            return m ? { ...m, status, protected: prot, verified: true } : { ...metaOf(n), status, protected: prot, verified: false };
        });
    }
    async function loadWorkspace() {
        const j = await BE().packages();
        S.device = j.device; S.rawItems = j.items || [];
        S.enabledSet = new Set(j.enabled || []); S.disabledSet = new Set(j.disabled || []); S.protectedSet = new Set(j.protected || []);
        buildPackages();
        S.plan = S.packages.filter(p => p.verified && p.act === 'disable' && !p.protected && p.status === 'active').map(p => p.name);
        await refreshProtocol(); await refreshJournals();
    }
    async function refreshProtocol() { try { S.protocol = (await BE().protocol()).items || []; } catch { } }
    async function refreshJournals() { try { S.journals = (await BE().journals()).items || []; } catch { } }
    async function refreshAfterAction() {
        const j = await BE().packages();
        S.rawItems = j.items || []; S.enabledSet = new Set(j.enabled || []); S.disabledSet = new Set(j.disabled || []); S.protectedSet = new Set(j.protected || []);
        buildPackages(); await refreshProtocol(); await refreshJournals(); renderAll();
    }

    function renderHeader() {
        const cs = $('#chip-server'), ca = $('#chip-adb'), cd = $('#chip-device');
        if (S.training) { cs.textContent = 'учебный режим'; cs.className = 'chip warn'; ca.textContent = 'ADB: симуляция'; ca.className = 'chip warn'; }
        else if (S.mode === 'file') { cs.textContent = 'сервер: не запущен (file://)'; cs.className = 'chip err'; ca.textContent = 'ADB: недоступен'; ca.className = 'chip err'; }
        else if (!S.server) { cs.textContent = 'сервер: не запущен'; cs.className = 'chip err'; ca.textContent = 'ADB: —'; ca.className = 'chip'; }
        else { cs.textContent = 'сервер: запущен'; cs.className = 'chip ok'; ca.textContent = S.adb ? 'ADB: готов' : 'ADB: не скачан'; ca.className = 'chip ' + (S.adb ? 'ok' : 'warn'); }
        cd.textContent = S.device ? `ТВ: ${S.device.brand} ${S.device.model}` : 'ТВ: не подключён';
        cd.className = 'chip ' + (S.device ? 'ok' : '');
        $('#btn-disconnect').hidden = !S.device;
        $('#training-banner').hidden = !S.training;
        document.body.classList.toggle('training', S.training);
        const nav = S.device
            ? [['overview', 'grid', 'Обзор', ''], ['diag', 'gauge', 'Диагностика', ''], ['packages', 'box', 'Пакеты', S.packages.filter(p => p.verified && p.act === 'disable' && !p.protected && p.status === 'active').length], ['scan', 'radar', 'Скан', (S.scanResults || []).length], ['protocol', 'term', 'Протокол', S.protocol.length], ['journals', 'journal', 'Журналы', S.journals.filter(j => !j.rolledBack).length], ['wizard', 'plug', 'Подключение', '']]
            : [['wizard', 'plug', 'Подключение', '']];
        $('#sidebar').innerHTML = nav.map(([v, i, l, b]) => `<button class="nav-item ${S.view === v ? 'active' : ''}" data-action="nav" data-nav="${v}">${icon(i)}<span>${l}</span><em class="nav-badge">${b || ''}</em></button>`).join('') +
            `<div class="sidebar-foot"><div class="sf">${icon('shield')}<span>Только отключение.<br>Откат реальными командами.</span></div><div>v3.0 · localhost · offline</div></div>`;
    }
    function setView(v) { S.view = v; S.sel.clear(); document.body.dataset.view = v; renderAll(); window.scrollTo(0, 0); }

    function renderBackend() {
        const el = $('#backend-card');
        if (S.training) { el.innerHTML = ''; return; }
        if (S.mode === 'file') el.innerHTML = `<div class="card backend err"><h3>${icon('warn')}Шаг 0 · Открыто как файл — так не работает</h3>
    <p class="muted">Адрес начинается с <code>file://</code>: из файла браузер не запускает ADB. Закрой вкладку и запусти <code>start.cmd</code> — браузер откроется на <code>http://localhost:8765</code>.</p>
    <div class="cmd">start.cmd<button class="btn btn-ghost btn-sm" data-action="copy-cmd">${icon('copy')}скопировать</button></div></div>`;
        else if (!S.server) el.innerHTML = `<div class="card backend"><h3>${icon('warn')}Шаг 0 · Запусти сервер на ПК</h3>
    <p class="muted">Локальный сервер не отвечает — без него ADB-команды не выполняются.</p>
    <ol><li>Двойной клик по <code>start.cmd</code>.</li><li>Оставь окно сервера открытым.</li><li>Нажми «Проверить снова».</li></ol>
    <div class="cmd">start.cmd<button class="btn btn-ghost btn-sm" data-action="copy-cmd">${icon('copy')}скопировать</button></div>
    <div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-action="reprobe">${icon('refresh')}Проверить снова</button></div></div>`;
        else if (!S.adb) el.innerHTML = `<div class="card backend ok"><h3>${icon('check')}Шаг 0 · Сервер запущен, скачай ADB</h3>
    <p class="muted">Официальный инструмент Google (~5 МБ, dl.google.com).</p>
    <div style="margin-top:12px"><button class="btn btn-primary" data-action="get-adb">${icon('download')}Скачать ADB</button></div></div>`;
        else el.innerHTML = `<div class="card backend ok"><h3>${icon('check')}Шаг 0 · Сервер и ADB готовы</h3><p class="muted">Выполни шаги на ТВ и подключись.</p></div>`;
    }
    function renderWizard() {
        renderBackend();
        $('#plat-cards').innerHTML = Object.entries(D.platforms).map(([k, p]) => `<button class="plat-card ${S.wizPlatform === k ? 'active' : ''}" style="--pc:${p.color}" data-action="wiz-platform" data-plat="${k}"><span class="plat-code">${esc(p.code)}</span><span class="plat-name"><b>${esc(p.title)}</b><br>${esc(p.vendors)}</span></button>`).join('');
        const pl = D.platforms[S.wizPlatform];
        $('#steps-box').innerHTML = pl.steps.map((st, i) => {
            const key = S.wizPlatform + ':' + i; const done = !!S.stepsDone[key];
            return `<div class="card step ${done ? 'done' : ''}"><div class="step-num">${done ? icon('check') : i + 2}</div>
      <div><h3>${esc(st.t)}</h3><div class="step-body">${st.b.map(x => `<p>${esc(x)}</p>`).join('')}${st.w ? `<div class="step-warn">${icon('warn')}<span>${esc(st.w)}</span></div>` : ''}</div></div>
      <label class="step-check"><input type="checkbox" data-change="step-done" data-key="${key}" ${done ? 'checked' : ''}>сделано</label></div>`;
        }).join('');
        $('#trouble-box').innerHTML = D.trouble.map(([q, a]) => `<details class="trouble"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
        $('#unsupported-box').innerHTML = D.unsupported.map(([q, a]) => `<details class="trouble"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
        renderProtocolInto($('#wizard-protocol'));
    }
    function renderProtocolInto(el) {
        if (!S.protocol.length) { el.innerHTML = '<span class="t-dim">Протокол пуст. Здесь появятся реальные команды adb и ответы ТВ.</span>'; return; }
        el.innerHTML = S.protocol.slice(-60).map(e => `<span class="t-dim">[${fmtTime(e.ts)}]</span> ${e.sim ? '<span class="t-sim">[учебный]</span> ' : ''}<span class="${/fail|error|exception|ЗАЩИЩ/i.test(e.out || '') ? 't-warn' : ''}">${esc(e.cmd)}</span>\n<span class="t-dim">${esc(e.out)}</span>\n`).join('');
        el.scrollTop = el.scrollHeight;
    }

    function renderOverview() {
        const d = S.device; if (!d) return;
        $('#ov-title').textContent = `${d.brand} ${d.model}`;
        const outside = S.packages.filter(p => !p.verified).length;
        $('#ov-device').innerHTML = `<div class="dev-brand">${esc(d.brand)} · ${esc((D.platforms[d.platform] || {}).title || d.platform)}</div><div class="dev-model">${esc(d.model)}</div>
    <div class="dev-rows">
      <div class="dev-row"><span>Android</span><span>${esc(d.android)} (SDK ${esc(d.sdk)})</span></div>
      <div class="dev-row"><span>Адрес ADB</span><span>${esc(d.serial)}</span></div>
      <div class="dev-row"><span>Пакетов в системе</span><span>${d.packageCount} (вне базы: ${outside})</span></div>
      <div class="dev-row"><span>Лаунчер (защищён)</span><span>${esc(d.launcher || 'не определён')}</span></div>
      <div class="dev-row"><span>Клавиатура (защищена)</span><span>${esc(d.ime || '—')}</span></div>
      <div class="dev-row"><span>Build fingerprint</span><span>${esc(d.fingerprint || '—')}</span></div></div>`;
        const vt = S.packages.filter(p => p.verified && p.act === 'disable' && !p.protected);
        const dis = S.packages.filter(p => p.status === 'disabled');
        $('#ov-stats').innerHTML = `
    <div class="stat" style="--sc:var(--grad-hot)"><div class="stat-v">${vt.filter(p => p.status === 'active').length}</div><div class="stat-l">проверенных рекламных пакетов активны и готовы к отключению</div></div>
    <div class="stat" style="--sc:var(--grad-main)"><div class="stat-v">${dis.length}</div><div class="stat-l">пакетов уже отключено на этом ТВ</div></div>
    <div class="stat" style="--sc:var(--grad-warm)"><div class="stat-v">${S.packages.filter(p => p.protected).length}</div><div class="stat-l">пакетов под серверной защитой</div></div>
    <div class="stat" style="--sc:linear-gradient(120deg,var(--signal),var(--violet))"><div class="stat-v">${S.journals.filter(j => !j.rolledBack).length}</div><div class="stat-l">сессий с правом отката</div></div>`;
        $('#ov-disabled').innerHTML = `<div class="card-title">${icon('undo')}Уже отключено на этом ТВ (${dis.length})</div>` +
            (dis.length ? `<div class="journal-names">${dis.map(p => `<code>${esc(p.name)}</code>`).join('')}</div>
      <p class="muted" style="font-size:12.5px;margin-top:10px">Это текущее состояние телевизора, прочитанное командой <code>pm list packages -d</code>. Часть могла быть отключена ранее другими средствами. Включить обратно можно в «Пакеты» → фильтр «Отключены».</p>`
                : '<p class="muted">Сейчас на ТВ ничего не отключено.</p>');
        $('#plan-summary').textContent = S.plan.length ? `${S.plan.length} команд в плане · ничего не удаляется` : 'План пуст: всё уже отключено либо в базе нет активных целей для этого ТВ.';
        $('#btn-plan-run').disabled = !S.plan.length || S.busy;
        $('#plan-list').innerHTML = S.plan.length ? S.plan.map((n, i) => {
            const p = S.packages.find(x => x.name === n) || metaOf(n);
            return `<div class="plan-row" draggable="true" data-name="${esc(n)}"><span class="q-grip">${icon('grip')}</span><span class="q-num">${String(i + 1).padStart(2, '0')}</span>
      <div class="pkg-main"><div class="pkg-name">${esc(n)}</div><div class="pkg-label">${esc(p.label)}</div></div>
      <span class="badge risk-${p.risk}">${esc(D.risks[p.risk])}</span>
      <button class="mini-btn danger" data-action="plan-remove" data-name="${esc(n)}">${icon('x')}</button></div>`;
        }).join('')
            : `<div class="empty">${icon('shield')}<div>Активных проверенных целей нет. Открой «Диагностику», чтобы понять причину тормозов, и «Скан» — для кандидатов вне базы.</div></div>`;
        const prot = S.packages.filter(p => p.protected);
        $('#ov-protect').innerHTML = `<div class="card-title">${icon('shield')}Серверная защита — не отключатся никогда</div>` +
            (prot.length ? prot.slice(0, 12).map(p => `<div class="p-row">${icon('lock')}<b>${esc(p.name)}</b><span>${esc(p.label)}</span></div>`).join('') + (prot.length > 12 ? `<div class="muted" style="font-size:12px;padding-top:8px">…и ещё ${prot.length - 12} — в «Пакеты», фильтр «Защищены».</div>` : '') : '<div class="muted">Определяется после подключения.</div>');
    }
    function planPreview() {
        if (!S.plan.length) return;
        const rows = S.plan.map(n => {
            const p = S.packages.find(x => x.name === n) || metaOf(n);
            return `<div class="m-row"><div class="m-name">${esc(n)} <span class="badge risk-${p.risk}">${esc(D.risks[p.risk])}</span>${p.verified ? '' : '<span class="badge unverified">вне базы</span>'}</div>
      <div class="m-cmd">adb shell pm disable-user --user 0 ${esc(n)}</div><div class="m-note">${esc(p.note)}</div></div>`;
        }).join('');
        const unv = S.plan.filter(n => !(S.packages.find(x => x.name === n) || {}).verified);
        openModal({
            title: 'Предпросмотр: что будет сделано', danger: true, confirmText: `Выполнить ${S.plan.length} команд`,
            body: `<div>Команды <code>pm disable-user</code>. Пакеты <b>не удаляются</b>. Откат — <code>pm enable</code>.</div><div class="modal-list">${rows}</div>
      ${unv.length ? `<div class="modal-warn">${icon('warn')}<span>${unv.length} пакет(ов) вне базы — сверь на 4PDA.</span></div>` : ''}`,
            onConfirm: () => executePlan()
        });
    }
    async function executePlan() {
        if (S.busy) return; S.busy = true; renderOverview();
        const names = [...S.plan];
        try {
            const j = await BE().disable(names);
            const done = (j.results || []).filter(r => r.ok).map(r => r.name);
            const failed = (j.results || []).filter(r => !r.ok);
            S.plan = S.plan.filter(n => !done.includes(n));
            await refreshAfterAction();
            if (done.length) toast(`Отключено ${done.length}. Команды и ответы — в протоколе.`, { type: 'ok', undo: async () => { await BE().enable(done); await refreshAfterAction(); toast('Откат выполнен.', { type: 'ok' }); } });
            failed.forEach(f => toast(`${f.name}: ${f.output}`, { type: 'err', timeout: 9000 }));
            if (!done.length && !failed.length) toast('Ничего не изменилось.', { type: 'info' });
        } catch (e) { toast('Ошибка: ' + e.message, { type: 'err' }); }
        S.busy = false; renderAll();
    }

    /* ---------- диагностика ---------- */
    function parseDiag(d) {
        const mem = {}; (d.meminfo || '').split('\n').forEach(l => { const m = l.match(/^(\w+):\s+(\d+)/); if (m) mem[m[1]] = +m[2]; });
        const totalMB = Math.round((mem.MemTotal || 0) / 1024), availMB = Math.round((mem.MemAvailable || 0) / 1024);
        const la = (d.loadavg || '').trim().split(/\s+/); const load1 = parseFloat(la[0]) || 0;
        const cores = parseInt((d.cores || '').trim(), 10) || 1;
        const up = parseFloat((d.uptime || '').split(/\s+/)[0]) || 0;
        let usePct = null, availHuman = '';
        (d.df || '').split('\n').forEach(l => { if (/\/data\s*$/.test(l.trim())) { const c = l.trim().split(/\s+/); usePct = parseInt(c[4], 10); availHuman = c[3]; } });
        let maxTemp = 0; (d.thermal || '').split('\n').forEach(l => { const m = l.match(/(\d+)\s*$/); if (m) { let v = +m[1]; if (v > 1000) v = v / 1000; if (v > maxTemp && v < 150) maxTemp = v; } });
        const rows = []; const lines = (d.top || '').split('\n');
        let hi = -1, cpuI = -1, memI = -1, argsI = -1;
        lines.forEach((l, idx) => { if (/%CPU/.test(l) && /PID/.test(l)) { hi = idx; const c = l.split(/\s+/); cpuI = c.findIndex(x => x.includes('%CPU')); memI = c.findIndex(x => x.includes('%MEM')); argsI = c.findIndex(x => /ARGS|CMD|NAME/.test(x)); } });
        if (hi > -1) for (let i = hi + 1; i < lines.length && rows.length < 10; i++) {
            const c = lines[i].trim().split(/\s+/); if (!/^\d+$/.test(c[0])) continue;
            const cpu = parseFloat(c[cpuI]) || 0, memP = parseFloat(c[memI]) || 0;
            const args = c.slice(argsI > -1 ? argsI : c.length - 1).join(' ');
            rows.push({ pid: c[0], cpu, mem: memP, args });
        }
        rows.sort((a, b) => b.cpu - a.cpu);
        return { totalMB, availMB, load1, cores, upH: Math.round(up / 3600), usePct, availHuman, maxTemp: Math.round(maxTemp), rows };
    }
    function renderDiag() {
        const note = $('#diag-note'), grid = $('#diag-grid'), verdict = $('#diag-verdict'), top = $('#diag-top');
        if (!S.diag) {
            note.textContent = 'Нажми «Снять показания» — программа прочитает память, CPU, накопитель и температуру с ТВ.';
            grid.innerHTML = ''; verdict.innerHTML = ''; top.innerHTML = ''; return;
        }
        const p = S.diag;
        note.textContent = `Замер снят с ТВ · аптайм ~${p.upH} ч · ядер: ${p.cores}`;
        const memPct = p.totalMB ? Math.round(100 * (p.totalMB - p.availMB) / p.totalMB) : 0;
        const cells = [
            { v: `${p.availMB} МБ`, l: `свободно ОЗУ из ${p.totalMB} МБ (занято ${memPct}%)`, cls: memPct >= 85 ? 'bad' : memPct >= 70 ? 'warn' : 'good' },
            { v: p.load1.toFixed(2), l: `загрузка CPU за 1 мин при ${p.cores} ядрах`, cls: p.load1 / p.cores > 1.5 ? 'bad' : p.load1 / p.cores > 0.9 ? 'warn' : 'good' },
            { v: p.usePct == null ? '—' : p.usePct + '%', l: `накопитель /data заполнен (свободно ${p.availHuman || '—'})`, cls: p.usePct >= 90 ? 'bad' : p.usePct >= 80 ? 'warn' : 'good' },
            { v: p.maxTemp ? p.maxTemp + '°C' : '—', l: 'максимальная температура SoC', cls: p.maxTemp >= 80 ? 'bad' : p.maxTemp >= 70 ? 'warn' : 'good' }
        ];
        grid.innerHTML = cells.map(c => `<div class="diag-cell ${c.cls}"><div class="dv">${esc(c.v)}</div><div class="dl">${esc(c.l)}</div></div>`).join('');
        const v = [];
        if (p.totalMB && p.availMB / p.totalMB < 0.15) v.push(['bad', `ОЗУ почти заполнена: свободно ${p.availMB} МБ из ${p.totalMB}. На 2 ГБ Google TV 11 держит в фоне GMS, ассистент и заставку — тормоза идут от них, а не от открытых приложений. Отключи категорию «Производительность» (katniss, dreamx) и телеметрию.`]);
        else if (p.totalMB && p.availMB / p.totalMB < 0.3) v.push(['warn', `ОЗУ впритык: свободно ${p.availMB} МБ из ${p.totalMB}. Фоновые сервисы съедают заметную часть — отключение ассистента и заставки даст прирост.`]);
        if (p.usePct != null && p.usePct >= 90) v.push(['bad', `Накопитель заполнен на ${p.usePct}% (свободно ${p.availHuman}). При нехватке места Android тормозит: нет пространства для кэша и ART-профилей. Почисти кэш приложений и удали ненужные APK.`]);
        else if (p.usePct != null && p.usePct >= 80) v.push(['warn', `Накопитель заполнен на ${p.usePct}% — скоро начнутся тормоза из-за нехватки места.`]);
        if (p.maxTemp >= 80) v.push(['bad', `Троттлинг: SoC ${p.maxTemp}°C — процессор сбрасывает частоту, отсюда рывки интерфейса. Проверь вентиляцию/не стоит ли ТВ у батареи.`]);
        else if (p.maxTemp >= 70) v.push(['warn', `SoC греется до ${p.maxTemp}°C — возможен лёгкий троттлинг под нагрузкой.`]);
        if (p.load1 / p.cores > 1.5) v.push(['bad', `Фоновая загрузка CPU (${p.load1.toFixed(2)}) выше числа ядер (${p.cores}): что-то постоянно считает в фоне. Смотри топ процессов ниже — обычно это GMS-синхронизация, ассистент или заставка.`]);
        if (!v.length) v.push(['good', 'Показатели в норме. Если тупит — дело скорее в сети и лаунчере: Wi-Fi 4 (802.11n) и лента рекомендаций Google TV, которая постоянно тянет контент. Помогает замена лаунчера на Projectivy и отключение рекомендаций.']);
        v.push(['warn', 'Универсальный порядок для плавности на 2 ГБ: 1) отключить katniss (ассистент) и dreamx (заставку); 2) отключить телеметрию (feedback, backuptransport); 3) поставить SmartTube вместо официального YouTube; 4) заменить лаунчер на Projectivy (сначала установи и назначь главным, потом отключай штатный). Всё обратимо через «Журналы».']);
        verdict.innerHTML = `<div class="verdict">${v.map(([c, t]) => `<div class="verdict-row ${c}">${icon(c === 'good' ? 'check' : 'warn')}<span>${esc(t)}</span></div>`).join('')}</div>`;
        top.innerHTML = p.rows.length ? `<table class="diag-top"><tr><th>Процесс</th><th>PID</th><th>%CPU</th><th>%ОЗУ</th></tr>${p.rows.map(r => `<tr><td>${esc(r.args)}</td><td>${esc(r.pid)}</td><td>${r.cpu.toFixed(1)}</td><td>${r.mem.toFixed(1)}</td></tr>`).join('')}</table>` : '<p class="muted">Топ процессов не распознан (см. сырой вывод в протоколе).</p>';
    }
    async function runDiag() {
        if (S.busy) return; S.busy = true;
        const b = $('#btn-diag'); b.disabled = true; b.innerHTML = `${icon('refresh')}Снимаю показания…`;
        try { const raw = await BE().diag(); S.diag = parseDiag(raw); await refreshProtocol(); toast('Показания сняты с телевизора.', { type: 'ok' }); }
        catch (e) { toast('Ошибка: ' + e.message, { type: 'err' }); }
        b.disabled = false; b.innerHTML = `${icon('gauge')}Снять показания`; S.busy = false; renderAll();
    }

    /* ---------- пакеты ---------- */
    const catChips = [['all', 'Все', 'var(--acc)'], ['ads', 'Реклама', '#ff3d5e'], ['track', 'Слежка и ACR', '#8b7bff'], ['perf', 'Производительность', '#c6ff4d'], ['update', 'Обновления', '#ffb02e'], ['bloat', 'Bloatware', '#38c8ff'], ['media', 'Медиа', '#3dffa8'], ['system', 'Системные', '#8fa2bd'], ['unknown', 'Вне базы', '#5d6f8c']];
    function filteredPackages() {
        const f = S.filters; let l = [...S.packages];
        if (f.verified) l = l.filter(p => p.verified);
        if (f.cat === 'track') l = l.filter(p => p.cat === 'telemetry' || p.cat === 'acr');
        else if (f.cat !== 'all') l = l.filter(p => p.cat === f.cat);
        if (f.status === 'active') l = l.filter(p => p.status === 'active' && !p.protected);
        if (f.status === 'disabled') l = l.filter(p => p.status === 'disabled');
        if (f.status === 'protected') l = l.filter(p => p.protected);
        if (f.q) { const q = f.q.toLowerCase(); l = l.filter(p => (p.name + ' ' + p.label + ' ' + p.note).toLowerCase().includes(q)); }
        const ro = D.riskOrder;
        l.sort((a, b) => f.sort === 'name' ? a.name.localeCompare(b.name) : f.sort === 'cat' ? a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name) : ro[a.risk] - ro[b.risk] || a.name.localeCompare(b.name));
        return l;
    }
    function renderPackages() {
        $('#cat-chips').innerHTML = catChips.map(([v, l, c]) => `<button class="chip-btn ${S.filters.cat === v ? 'active' : ''}" style="--cc:${c}" data-action="chip-cat" data-cat="${v}">${l}</button>`).join('');
        $('#filter-status').value = S.filters.status; $('#filter-sort').value = S.filters.sort; $('#filter-verified').checked = S.filters.verified;
        if (document.activeElement !== $('#filter-q')) $('#filter-q').value = S.filters.q;
        const presets = [{ id: 'p1', name: 'Реклама к отключению', f: { q: '', cat: 'ads', status: 'active', sort: 'risk', verified: true } }, { id: 'p2', name: 'Производительность', f: { q: '', cat: 'perf', status: 'active', sort: 'risk', verified: true } }, { id: 'p3', name: 'Все защищённые', f: { q: '', cat: 'all', status: 'protected', sort: 'name', verified: false } }];
        $('#view-select').innerHTML = '<option value="">Сохранённые виды…</option>' + presets.map(p => `<option value="${p.id}">★ ${esc(p.name)}</option>`).join('') + S.savedViews.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
        const l = filteredPackages();
        $('#pkg-count').textContent = `Показано ${l.length} из ${S.packages.length} реальных пакетов ТВ`;
        const vis = l.filter(p => !p.protected);
        $('#sel-all').checked = vis.length > 0 && vis.every(p => S.sel.has(p.name));
        $('#bulkbar').hidden = S.sel.size === 0;
        $('#bulk-count').textContent = S.sel.size ? `Выбрано: ${S.sel.size}` : '';
        $('#pkg-list').innerHTML = l.length ? l.map(p => {
            const stCls = p.protected ? 'protected' : p.status;
            const stTxt = p.protected ? 'защищён' : p.status === 'disabled' ? 'отключён' : 'активен';
            return `<article class="pkg-row ${p.status === 'disabled' ? 'is-disabled' : ''} ${p.protected ? 'is-protected' : ''}" data-action="open" data-name="${esc(p.name)}" tabindex="0">
      <label class="pkg-check no-open"><input type="checkbox" data-change="row-check" data-name="${esc(p.name)}" ${S.sel.has(p.name) ? 'checked' : ''} ${p.protected ? 'disabled' : ''}></label>
      <div class="pkg-main"><div class="pkg-name">${esc(p.name)}</div><div class="pkg-label">${esc(p.label)}${p.verified ? '' : ' · вне базы'}</div></div>
      <span class="badge cat cat-${p.cat}">${esc((D.categories[p.cat] || {}).label || p.cat)}</span>
      <span class="badge risk risk-${p.risk}">${esc(D.risks[p.risk])}</span>
      <span class="status-pill st-${stCls}">${stTxt}</span>
      <span class="pkg-actions no-open">${p.protected ? `<button class="mini-btn" disabled>${icon('lock')}</button>` : p.status === 'disabled' ? `<button class="mini-btn" data-action="pkg-enable" data-name="${esc(p.name)}">${icon('undo')}</button>` : `<button class="mini-btn danger" data-action="pkg-disable" data-name="${esc(p.name)}">${icon('zap')}</button><button class="mini-btn" data-action="pkg-plan" data-name="${esc(p.name)}">${icon('plus')}</button>`}</span></article>`;
        }).join('')
            : `<div class="empty">${icon('search')}<div>Ничего не найдено. Измени фильтры или запрос.</div></div>`;
    }
    async function disableWithConfirm(names) {
        const unknown = names.filter(n => !(S.packages.find(x => x.name === n) || {}).verified);
        const rows = names.map(n => `<div class="m-row"><div class="m-name">${esc(n)}</div><div class="m-cmd">adb shell pm disable-user --user 0 ${esc(n)}</div></div>`).join('');
        openModal({
            title: `Отключить ${names.length} пакет(ов)?`, danger: true, confirmText: 'Выполнить команды',
            body: `<div>Точные команды ниже. Ничего не удаляется; откат доступен.</div><div class="modal-list">${rows}</div>${unknown.length ? `<div class="modal-warn">${icon('warn')}<span>${unknown.length} вне базы — проверь на 4PDA.</span></div>` : ''}`,
            onConfirm: async () => {
                try {
                    const j = await BE().disable(names); const done = (j.results || []).filter(r => r.ok).map(r => r.name);
                    S.sel.clear(); await refreshAfterAction();
                    if (done.length) toast(`Отключено: ${done.length}.`, { type: 'ok', undo: async () => { await BE().enable(done); await refreshAfterAction(); } });
                    (j.results || []).filter(r => !r.ok).forEach(f => toast(`${f.name}: ${f.output}`, { type: 'err', timeout: 9000 }));
                } catch (e) { toast('Ошибка: ' + e.message, { type: 'err' }); }
            }
        });
    }

    function renderScan() {
        const res = S.scanResults;
        $('#scan-note').textContent = res ? `Кандидатов: ${res.length}. В план — только после подтверждения.` : 'Скан читает реальный список пакетов и ищет подозрительные имена вне базы.';
        $('#scan-list').innerHTML = !res ? `<div class="empty">${icon('radar')}<div>Запусти скан.</div></div>` : !res.length ? `<div class="empty">${icon('check')}<div>Кандидатов нет.</div></div>` : res.map(n => `<div class="scan-row"><span class="badge cat-unknown">вне базы</span><span class="scan-name">${esc(n)}</span>
    <span class="scan-actions"><button class="btn btn-ghost btn-sm" data-action="scan-plan" data-name="${esc(n)}">${icon('plus')}В план</button>
    <button class="btn btn-ghost btn-sm" data-action="scan-ignore" data-name="${esc(n)}">${icon('x')}Скрыть</button></span></div>`).join('');
    }
    async function runScan() {
        if (S.busy) return; S.busy = true;
        const b = $('#btn-scan'); b.disabled = true; b.innerHTML = `${icon('refresh')}Сканирую…`;
        try {
            const j = await BE().scan(dbAll().map(p => p.name)); S.scanResults = (j.items || []).filter(n => !S.ignored.includes(n));
            await refreshProtocol(); toast(`Скан: ${S.scanResults.length} кандидатов.`, { type: S.scanResults.length ? 'warn' : 'ok' });
        } catch (e) { toast('Ошибка: ' + e.message, { type: 'err' }); }
        b.disabled = false; b.innerHTML = `${icon('radar')}Запустить скан`; S.busy = false; renderAll();
    }
    function renderProtocol() {
        $('#proto-count').textContent = `${S.protocol.length} записей · каждая команда и дословный ответ ТВ`;
        $('#proto-list').innerHTML = S.protocol.length ? [...S.protocol].reverse().map(e => `<div class="proto-entry"><div><span class="proto-time">${fmtTime(e.ts)}</span>${e.sim ? '<span class="proto-sim">[учебный]</span>' : ''}<span class="proto-cmd">${esc(e.cmd)}</span></div><div class="proto-out">${esc(e.out)}</div></div>`).join('') : `<div class="empty">${icon('term')}<div>Протокол пуст.</div></div>`;
    }
    function renderJournals() {
        $('#journal-list').innerHTML = S.journals.length ? S.journals.map(j => `<div class="card"><div class="journal-top"><span class="journal-date">${fmtDate(j.ts)}</span>
    <span class="journal-kind ${j.rolledBack ? 'rolled' : 'clean'}">${j.rolledBack ? 'откачен' : 'активна'}</span>
    <span class="muted">${esc(j.device)} · ${j.names.length} пакет(ов)</span>
    <span class="journal-actions"><button class="btn btn-ghost btn-sm" data-action="journal-export" data-id="${esc(j.path)}">${icon('download')}Экспорт</button>
    ${!j.rolledBack ? `<button class="btn btn-primary btn-sm" data-action="journal-rollback" data-id="${esc(j.path)}">${icon('undo')}Откатить</button>` : ''}</span></div>
    <div class="journal-names">${j.names.map(n => `<code>${esc(n)}</code>`).join('')}</div><div class="journal-path">${esc(j.path)}</div></div>`).join('')
            : `<div class="card"><div class="empty">${icon('journal')}<div>Журналов пока нет.</div></div></div>`;
    }

    async function doConnect() {
        if (S.busy) return;
        if (!S.training && !S.server) { toast('Сначала запусти сервер: start.cmd (шаг 0).', { type: 'err' }); return; }
        S.busy = true; const b = $('#btn-connect'); b.disabled = true; b.innerHTML = `${icon('refresh')}Подключаюсь…`;
        $('#rsa-note').hidden = true;
        const pair = $('#pair-mode').checked;
        const body = pair ? { pairAddr: $('#pair-addr').value.trim(), code: $('#pair-code').value.trim(), connectAddr: $('#conn-addr').value.trim() } : { ip: $('#conn-ip').value.trim() };
        try {
            const j = await BE().connect(body); await refreshProtocol();
            if (j.unauthorized) { $('#rsa-note').hidden = false; toast('Подтверди RSA на экране ТВ и повтори.', { type: 'warn' }); }
            else if (!j.ok) toast('Не подключилось. Смотри протокол и «Если не подключается».', { type: 'err' });
            else { S.device = j.device; S.adb = true; S.server = true; await loadWorkspace(); toast(`Подключено: ${j.device.brand} ${j.device.model}.`, { type: 'ok' }); setView('overview'); }
        } catch (e) { toast('Ошибка: ' + e.message, { type: 'err' }); await refreshProtocol(); }
        b.disabled = false; b.innerHTML = `${icon('plug')}Подключить`; S.busy = false; renderAll();
    }
    async function probe() {
        if (location.protocol === 'file:') { S.mode = 'file'; S.server = false; renderAll(); return; }
        try {
            const c = new AbortController(); setTimeout(() => c.abort(), 1500);
            const j = await (await fetch('/api/state', { signal: c.signal })).json();
            S.server = true; S.adb = !!j.adb; S.mode = 'server';
            if (j.connected && j.device) { S.device = j.device; await loadWorkspace(); S.view = 'overview'; }
            else { S.device = null; S.view = 'wizard'; }
        } catch { S.server = false; S.mode = 'no-server'; S.view = 'wizard'; }
        renderAll();
    }

    function renderAll() {
        renderHeader();
        $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + S.view));
        ({ wizard: renderWizard, overview: renderOverview, diag: renderDiag, packages: renderPackages, scan: renderScan, protocol: renderProtocol, journals: renderJournals })[S.view]();
        if (S.drawerPkg) renderDrawer();
    }

    document.addEventListener('click', e => {
        const t = e.target.closest('[data-action]'); if (!t) return;
        const a = t.dataset.action, name = t.dataset.name;
        switch (a) {
            case 'nav': setView(t.dataset.nav); break;
            case 'reprobe': probe(); break;
            case 'copy-cmd': copyText('start.cmd'); break;
            case 'get-adb': (async () => { try { toast('Скачиваю platform-tools…', { type: 'info' }); const j = await BE().adb(); S.adb = true; await refreshProtocol(); toast('ADB готов.', { type: 'ok' }); renderAll(); } catch (err) { toast('Ошибка: ' + err.message, { type: 'err' }); } })(); break;
            case 'wiz-platform': S.wizPlatform = t.dataset.plat; save(); renderWizard(); break;
            case 'conn-go': doConnect(); break;
            case 'disconnect': (async () => { try { await BE().disconnect(); } catch { } S.device = null; S.packages = []; S.plan = []; S.scanResults = null; S.diag = null; S.training = false; setView('wizard'); probe(); })(); break;
            case 'training-start': (async () => { S.training = true; S.device = T.device; await loadWorkspace(); S.view = 'overview'; renderAll(); toast('Учебный режим: вымышленный ТВ.', { type: 'warn', timeout: 9000 }); })(); break;
            case 'training-exit': S.training = false; S.device = null; S.packages = []; S.plan = []; S.scanResults = null; S.diag = null; setView('wizard'); probe(); break;
            case 'diag-run': runDiag(); break;
            case 'plan-preview': planPreview(); break;
            case 'plan-reset': S.plan = S.packages.filter(p => p.verified && p.act === 'disable' && !p.protected && p.status === 'active').map(p => p.name); renderOverview(); toast('План пересобран.', { type: 'info' }); break;
            case 'plan-remove': S.plan = S.plan.filter(n => n !== name); renderOverview(); break;
            case 'open': if (e.target.closest('input,button,a,.no-open')) return; openDrawer(name); break;
            case 'pkg-disable': disableWithConfirm([name]); break;
            case 'pkg-enable': (async () => { try { await BE().enable([name]); await refreshAfterAction(); toast('Пакет включён.', { type: 'ok' }); } catch (err) { toast('Ошибка: ' + err.message, { type: 'err' }); } })(); break;
            case 'pkg-plan': if (!S.plan.includes(name)) { S.plan.push(name); toast('Добавлено в план: ' + name, { type: 'ok' }); renderAll(); } break;
            case 'copy-name': copyText(name); break;
            case 'drawer-close': closeDrawer(); break;
            case 'chip-cat': S.filters.cat = t.dataset.cat; S.sel.clear(); renderPackages(); break;
            case 'bulk-disable': disableWithConfirm([...S.sel]); break;
            case 'bulk-enable': (async () => { const names = [...S.sel]; S.sel.clear(); try { await BE().enable(names); await refreshAfterAction(); toast(`Включено: ${names.length}.`, { type: 'ok' }); } catch (err) { toast('Ошибка: ' + err.message, { type: 'err' }); } })(); break;
            case 'bulk-plan': [...S.sel].forEach(n => { if (!S.plan.includes(n)) S.plan.push(n); }); S.sel.clear(); toast('Добавлены в план.', { type: 'ok' }); renderAll(); break;
            case 'bulk-clear': S.sel.clear(); renderPackages(); break;
            case 'save-view': openModal({
                title: 'Сохранить текущий вид', confirmText: 'Сохранить', body: '<div>Запомнит поиск, категорию, статус, сортировку.</div><input type="text" id="view-name-input" placeholder="Название вида" maxlength="40">',
                onConfirm: w => { const v = w.querySelector('#view-name-input').value.trim(); if (!v) return false; S.savedViews.push({ id: uid(), name: v, f: { ...S.filters } }); save(); renderPackages(); toast('Вид сохранён.', { type: 'ok' }); }
            }); break;
            case 'scan-run': runScan(); break;
            case 'scan-plan': openModal({
                title: 'Добавить пакет вне базы в план?', danger: true, confirmText: 'Добавить',
                body: `<div class="m-row"><div class="m-name">${esc(name)}</div><div class="m-note">Вне проверенной базы. Найди назначение в теме модели на 4PDA. Перед выполнением будет отдельное предупреждение.</div></div>`,
                onConfirm: () => { if (!S.plan.includes(name)) S.plan.push(name); toast('Добавлено (вне базы): ' + name, { type: 'warn' }); renderAll(); }
            }); break;
            case 'scan-ignore': S.ignored.push(name); S.scanResults = (S.scanResults || []).filter(n => n !== name); save(); renderAll(); break;
            case 'proto-refresh': refreshProtocol().then(renderAll); break;
            case 'proto-copy': copyText(S.protocol.map(e => `[${fmtTime(e.ts)}] ${e.cmd}\n${e.out}`).join('\n\n')); break;
            case 'proto-export': download('cleantv-protocol.txt', S.protocol.map(e => `[${fmtTime(e.ts)}] ${e.cmd}\n${e.out}`).join('\n\n')); break;
            case 'journal-export': { const j = S.journals.find(x => x.path === t.dataset.id); if (j) download('cleantv-journal.txt', ['ЧИСТЫЙ ТВ · журнал', fmtDate(j.ts), j.device, '', ...j.names].join('\n')); break; }
            case 'journal-rollback': {
                const j = S.journals.find(x => x.path === t.dataset.id); if (!j) return;
                openModal({
                    title: 'Откатить сессию?', confirmText: `pm enable для ${j.names.length}`,
                    body: `<div>Реальные команды включения:</div><div class="modal-list">${j.names.map(n => `<div class="m-row"><div class="m-cmd">adb shell pm enable ${esc(n)}</div></div>`).join('')}</div>`,
                    onConfirm: async () => { try { await BE().rollback(j.path); await refreshAfterAction(); toast('Откат выполнен.', { type: 'ok' }); } catch (err) { toast('Ошибка: ' + err.message, { type: 'err' }); } }
                }); break;
            }
        }
    });
    document.addEventListener('change', e => {
        const t = e.target, c = t.dataset.change; if (!c) return;
        switch (c) {
            case 'step-done': S.stepsDone[t.dataset.key] = t.checked; save(); renderWizard(); break;
            case 'pair-mode': $('#pair-fields').hidden = !t.checked; $('#conn-ip').disabled = t.checked;
                $('#conn-hint').textContent = t.checked ? 'Режим с кодом: сначала сопряжение (ip:port + код), затем подключение к ip:port с главного экрана отладки.' : 'Обычный режим: достаточно «Отладки по USB» — порт 5555 откроется сам.'; break;
            case 'row-check': t.checked ? S.sel.add(t.dataset.name) : S.sel.delete(t.dataset.name); renderPackages(); break;
            case 'sel-all': { const l = filteredPackages().filter(p => !p.protected); l.forEach(p => t.checked ? S.sel.add(p.name) : S.sel.delete(p.name)); renderPackages(); break; }
            case 'status-filter': S.filters.status = t.value; S.sel.clear(); renderPackages(); break;
            case 'sort': S.filters.sort = t.value; renderPackages(); break;
            case 'verified': S.filters.verified = t.checked; S.sel.clear(); renderPackages(); break;
            case 'saved-view': {
                const presets = [{ id: 'p1', f: { q: '', cat: 'ads', status: 'active', sort: 'risk', verified: true } }, { id: 'p2', f: { q: '', cat: 'perf', status: 'active', sort: 'risk', verified: true } }, { id: 'p3', f: { q: '', cat: 'all', status: 'protected', sort: 'name', verified: false } }];
                const v = presets.find(p => p.id === t.value) || S.savedViews.find(x => x.id === t.value); if (v) { S.filters = { ...v.f }; S.sel.clear(); renderPackages(); } break;
            }
        }
    });
    let qTimer = null;
    document.addEventListener('input', e => { if (e.target.id === 'filter-q') { clearTimeout(qTimer); qTimer = setTimeout(() => { S.filters.q = e.target.value; renderPackages(); }, 130); } });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (modalCancel) modalCancel(); else closeDrawer(); }
        if (e.key === '/' && S.view === 'packages' && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#filter-q').focus(); }
        if (e.key === 'Enter' && e.target.classList?.contains('pkg-row')) openDrawer(e.target.dataset.name);
    });
    let dragName = null;
    document.addEventListener('dragstart', e => { const r = e.target.closest('.plan-row'); if (!r) return; dragName = r.dataset.name; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    document.addEventListener('dragover', e => { const r = e.target.closest('.plan-row'); if (!r || !dragName || r.dataset.name === dragName) return; e.preventDefault(); r.classList.add('drop-target'); });
    document.addEventListener('dragleave', e => { const r = e.target.closest('.plan-row'); if (r) r.classList.remove('drop-target'); });
    document.addEventListener('drop', e => {
        const r = e.target.closest('.plan-row'); if (!r || !dragName) return; e.preventDefault();
        const from = S.plan.indexOf(dragName), to = S.plan.indexOf(r.dataset.name);
        if (from > -1 && to > -1) { S.plan.splice(from, 1); S.plan.splice(to, 0, dragName); }
        dragName = null; renderOverview();
    });
    document.addEventListener('dragend', () => { dragName = null; $$('.plan-row').forEach(x => x.classList.remove('dragging', 'drop-target')); });
    async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } toast('Скопировано.', { type: 'ok', timeout: 2200 }); }
    function download(f, t) { const b = new Blob([t], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = f; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1200); }
    setInterval(() => { if (!S.training && S.server && (S.view === 'wizard' || S.view === 'protocol')) refreshProtocol().then(() => { if (S.view === 'wizard') renderProtocolInto($('#wizard-protocol')); if (S.view === 'protocol') renderProtocol(); }); }, 3000);
    probe();
})();