/* Чистый ТВ v4.4 · сервисная консоль.
   Реальный режим по умолчанию; учебный пример — только по явному запросу. */
(() => {
    'use strict';
    const D = window.CTV_DATA;
    const $ = s => document.querySelector(s);
    const $$ = s => [...document.querySelectorAll(s)];
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const uid = () => Math.random().toString(36).slice(2, 9);
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const icon = n => `<svg><use href="#i-${n}"/></svg>`;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const store = (k, f) => { try { const v = JSON.parse(localStorage.getItem('ctv4.' + k)); return v ?? f; } catch { return f; } };
    const fmtDate = ts => { const n = Number(ts); return Number.isFinite(n) && n > 0 ? new Date(n).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'дата неизвестна'; };
    const fmtTime = ts => { const n = Number(ts); return Number.isFinite(n) && n > 0 ? new Date(n).toLocaleTimeString('ru-RU') : '--:--:--'; };
    const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

    function normNames(raw) {
        const out = [], seen = new Set(); let repaired = 0;
        const push = v => {
            let s = '';
            if (typeof v === 'string') s = v;
            else if (v && typeof v === 'object' && typeof v.name === 'string') { s = v.name; repaired++; }
            else if (v != null) { s = String(v); repaired++; }
            s = s.trim();
            if (/^[A-Za-z0-9._]+$/.test(s) && !seen.has(s)) { seen.add(s); out.push(s); } else if (s) repaired++;
        };
        if (raw == null) return { names: out, repaired };
        if (Array.isArray(raw)) raw.forEach(push); else push(raw);
        return { names: out, repaired };
    }
    const normJournal = j => {
        const { names, repaired } = normNames(j && j.names);
        return {
            path: String((j && j.path) || ''), ts: Number(j && j.ts) || 0, device: String((j && j.device) || 'устройство'),
            kind: String((j && j.kind) || 'clean'), expert: !!(j && j.expert), rolledBack: !!(j && j.rolledBack), names, repaired
        };
    };

    const S = {
        mode: 'boot', server: false, adb: false, training: false,
        device: null, items: [], enabled: new Set(), disabled: new Set(), locked: new Set(), running: new Set(), thirdParty: new Set(),
        packages: [], plan: [], planState: {}, protocol: [], journals: [], scan: null, diag: null,
        expert: false, expertLeft: 0, custom: store('custom', []),
        view: 'wizard', platform: store('platform', 'identify'), steps: store('steps', {}),
        views: store('views', []), ignored: store('ignored', []),
        filters: { q: '', cat: 'all', status: 'all', sort: 'verdict', known: false, hideLocked: true },
        opts: { force: true, home: true, verify: true },
        sel: new Set(), kbSel: new Set(), kbQ: '', busy: false, drawer: null, apply: null
    };
    const persist = () => {
        try {
            localStorage.setItem('ctv4.platform', JSON.stringify(S.platform));
            localStorage.setItem('ctv4.steps', JSON.stringify(S.steps));
            localStorage.setItem('ctv4.views', JSON.stringify(S.views));
            localStorage.setItem('ctv4.ignored', JSON.stringify(S.ignored));
            localStorage.setItem('ctv4.custom', JSON.stringify(S.custom));
        } catch { }
    };

    const dbAll = () => Object.values(D.packages).flat();
    const unknownMeta = n => ({
        name: n, label: 'Пакет без описания в базе', cat: 'unknown', risk: 'medium', verdict: 'caution',
        what: 'Назначение не описано в базе программы.', gain: 'Неизвестно.',
        loss: 'Последствия неизвестны. Выгрузи список в «Базе знаний», получи описание и импортируй его.', src: null
    });
    const metaOf = n => S.custom.find(p => p.name === n) || dbAll().find(p => p.name === n) || unknownMeta(n);
    const isFloor = n => D.floor.includes(n);
    const unknownList = () => S.packages.filter(p => !p.known);
    const verdictOf = p => D.verdicts[p && p.verdict] || D.verdicts.caution;
    const riskOf = p => D.risks[p && p.risk] || 'средний';
    function guessCat(n) {
        if (/advertis|\.ads?\.|adservice|promo|recommend/i.test(n)) return 'ads';
        if (/analytic|telemetr|metric|tracker|statistic/i.test(n)) return 'telemetry';
        if (/\.acr\.|acr$/i.test(n)) return 'acr';
        if (/upgrad|update|\.ota\./i.test(n)) return 'update';
        if (/^com\.android\.|^android$|systemui|settings|providers|permission|webview|inputmethod|packageinstaller|keychain|networkstack|tethering|wifi|bluetooth/i.test(n)) return 'system';
        if (/youtube|netflix|video|music|player|media|gallery|browser/i.test(n)) return 'media';
        return 'apps';
    }

    const API = {
        async req(path, body) {
            const opt = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
            const r = await fetch(path, opt); const j = await r.json();
            if (j.error) throw new Error(j.error); return j;
        },
        state() { return this.req('/api/state'); }, adb() { return this.req('/api/adb', {}); },
        connect(b) { return this.req('/api/connect', b); }, packages() { return this.req('/api/packages'); },
        diag() { return this.req('/api/diag'); }, disable(b) { return this.req('/api/disable', b); },
        enable(names) { return this.req('/api/enable', { names }); }, home() { return this.req('/api/home', {}); },
        reboot() { return this.req('/api/reboot', {}); }, privacy(items) { return this.req('/api/privacy', { items }); },
        expert(b) { return this.req('/api/expert', b); }, scan(known) { return this.req('/api/scan', { known }); },
        journals() { return this.req('/api/journals'); }, rollback(path) { return this.req('/api/rollback', { path }); },
        protocol() { return this.req('/api/protocol'); }, disconnect() { return this.req('/api/disconnect', {}); }
    };

    const T = {
        dev: D.training.device,
        items: [...D.packages.googletv.map(p => p.name), 'com.google.android.apps.tv.launcherx', 'com.google.android.gms',
            'com.android.externalstorage', 'com.android.shell', 'android', 'com.tcl.suspension', 'com.tcl.waterfall.overseas',
            'com.tcl.gallery', 'ru.kinopoisk.tv', 'com.vk.tv', 'com.google.android.leanback.ime', ...D.training.extra],
        off: new Set(['com.google.android.feedback']),
        run: new Set(['com.google.android.katniss', 'com.google.android.apps.tv.launcherx', 'com.tcl.gallery', 'com.google.android.gms']),
        third: new Set(['ru.kinopoisk.tv', 'com.vk.tv']), proto: [], expert: false, until: 0,
        priv: {
            'global.tcl_diagnostic_status': '1', 'global.tcl_uxp_status': '1', 'global.send_action_app_error': '1',
            'secure.send_action_app_error': '1', 'global.activity_starts_logging_enabled': '1', 'secure.backup_enabled': '0', 'secure.screensaver_enabled': '1'
        },
        journals: [{ path: 'training/s1', ts: Date.now() - 864e5, device: D.training.device.model, names: ['com.google.android.feedback'], kind: 'clean', expert: false, rolledBack: false }],
        log(c, o) { this.proto.push({ ts: Date.now(), cmd: '[учебный] adb shell ' + c, out: o, sim: true }); },
        flags() { return Object.entries(this.priv).map(([id, value]) => ({ id, ns: id.split('.')[0], key: id.split('.')[1], value })); }
    };
    const TR = {
        async state() { await delay(80); return { server: true, adb: true, connected: true, device: T.dev, expert: T.expert, expertLeft: Math.max(0, T.until - Date.now()), floor: D.floor }; },
        async adb() { return { ok: true, path: 'учебный режим' }; },
        async connect() { await delay(400); T.log('connect 192.168.0.0:5555', 'connected'); return { ok: true, device: T.dev }; },
        async packages() {
            await delay(100); return {
                items: T.items, enabled: T.items.filter(n => !T.off.has(n)), disabled: [...T.off],
                thirdParty: [...T.third], running: [...T.run], protected: T.expert ? D.floor : [...D.never, T.dev.launcher, T.dev.ime],
                platform: 'googletv', device: T.dev, expert: T.expert, expertLeft: Math.max(0, T.until - Date.now())
            };
        },
        async diag() {
            await delay(500); return {
                meminfo: 'MemTotal:        2097152 kB\nMemFree:          162624 kB\nMemAvailable:     646516 kB\nSwapTotal:        614396 kB\nSwapFree:         166292 kB\nCmaTotal:         880640 kB\nMemReserved:      291188 kB\n',
                loadavg: '21.93 21.38 21.58 7/2104 2762', uptime: '516680.74 339948.58', cores: '4',
                top: 'Tasks: 327 total\n400%cpu  56%user   3%nice  61%sys 281%idle   0%iow\nPID USER         PR  NI VIRT  RES  SHR S[%CPU] %MEM     TIME+ ARGS\n1649 u0_a41       10 -10 1.4G 177M 109M S 33.3   8.6  46:42.56 com.google.android.apps.tv.launcherx\n429 system       -3  -8 122M  17M 7.9M S 27.7   0.8  96:57.32 surfaceflinger\n453 root         20   0 233M  20M 172K S  5.5   0.9  68:29.70 sitatvservice all 7\n414 root         20   0  16M 2.5M 1.9M S  5.5   0.1  58:36.55 rtdlog\n134 root         20   0    0    0    0 D  2.7   0.0   1:13.11 [VPQ_detect_tsk]\n',
                df: 'Filesystem       Size  Used Avail Use% Mounted on\n/dev/block/dm-11 8.5G  6.0G  2.3G  73% /storage/emulated/0/Android/obb',
                thermal: 'Cached temperatures:', running: [...T.run], privacy: T.flags()
            };
        },
        async disable(b) {
            await delay(240); const results = [];
            for (const n of normNames(b.names).names) {
                if (D.floor.includes(n)) { T.log('pm disable-user --user 0 ' + n, 'ABSOLUTE FLOOR'); results.push({ name: n, ok: false, output: 'АБСОЛЮТНЫЙ ЗАПРЕТ' }); continue; }
                if (!T.expert && (D.never.includes(n) || (!T.third.has(n) && !D.allowed.includes(n)))) {
                    T.log('pm disable-user --user 0 ' + n, 'BLOCKED'); results.push({ name: n, ok: false, output: 'ЗАЩИЩЕНО: включи экспертный режим.' }); continue;
                }
                const was = T.run.has(n); T.off.add(n); T.run.delete(n);
                T.log('pm disable-user --user 0 ' + n, 'Package ' + n + ' new state: disabled-user');
                results.push({ name: n, ok: true, output: 'Package ' + n + ' new state: disabled-user', verified: true, wasRunning: was, nowRunning: false, persistent: false });
            }
            const done = results.filter(r => r.ok).map(r => r.name);
            if (done.length) {
                const j = T.journals.find(x => x.path === 'training/' + b.session);
                if (j) j.names = [...new Set([...j.names, ...done])];
                else T.journals.unshift({ path: 'training/' + b.session, ts: Date.now(), device: T.dev.model, names: done, kind: T.expert ? 'expert' : 'clean', expert: T.expert, rolledBack: false });
            }
            return { results, expert: T.expert, left: Math.max(0, T.until - Date.now()) };
        },
        async enable(names) { await delay(180); return { results: normNames(names).names.map(n => { T.off.delete(n); T.log('pm enable ' + n, 'enabled'); return { name: n, ok: true, verified: true, output: 'enabled' }; }) }; },
        async home() { await delay(140); T.log('input keyevent KEYCODE_HOME', ''); return { ok: true }; },
        async reboot() { await delay(200); T.log('reboot', ''); return { ok: true, message: 'Учебный режим: перезагрузка не выполнялась.' }; },
        async privacy(b) { await delay(200); const results = (b.items || []).map(it => { T.priv[it.id] = String(it.value); T.log('settings put ' + it.id.replace('.', ' ') + ' ' + it.value, ''); return { id: it.id, ok: true, output: String(it.value) }; }); return { results, flags: T.flags() }; },
        async expert(b) {
            await delay(180);
            if (b.action === 'on') { if (b.confirm !== 'I-ACCEPT-RISK') throw new Error('Подтверждение не принято.'); T.expert = true; T.until = Date.now() + 1800000; }
            else { T.expert = false; T.until = 0; }
            return { expert: T.expert, left: Math.max(0, T.until - Date.now()), protected: T.expert ? D.floor : [...D.never, T.dev.launcher, T.dev.ime] };
        },
        async scan() { await delay(500); return { items: D.training.extra }; },
        async journals() { return { items: T.journals }; },
        async rollback(p) { const j = T.journals.find(x => x.path === p); if (j) { normNames(j.names).names.forEach(n => T.off.delete(n)); j.rolledBack = true; } return { results: normNames(j ? j.names : []).names.map(n => ({ name: n, ok: true })) }; },
        async protocol() { return { items: T.proto }; },
        async disconnect() { T.expert = false; T.until = 0; return { ok: true }; }
    };
    const BE = () => S.training ? TR : API;

    function toast(msg, { type = 'info', undo = null, timeout = 7000 } = {}) {
        const root = $('#toast-root'); if (!root) return;
        while (root.children.length >= 4) root.firstChild.remove();
        const el = document.createElement('div'); el.className = 'toast ' + type;
        el.innerHTML = `${icon({ ok: 'check', warn: 'warn', err: 'warn', info: 'info' }[type])}<div class="toast-msg">${msg}</div>${undo ? '<button class="toast-undo">Отменить</button>' : ''}<button class="icon-btn toast-x">${icon('x')}</button><span class="toast-bar" style="animation-duration:${timeout}ms"></span>`;
        const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
        const t = setTimeout(kill, timeout);
        el.querySelector('.toast-x').onclick = () => { clearTimeout(t); kill(); };
        if (undo) el.querySelector('.toast-undo').onclick = () => { clearTimeout(t); kill(); undo(); };
        root.appendChild(el);
    }
    let modalClose = null;
    function modal({ title, body, ok = 'Подтвердить', danger = false, onOk }) {
        const root = $('#modal-root');
        root.innerHTML = `<div class="modal-wrap"><div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3>
    <div class="modal-body">${body}</div>
    <div class="modal-actions"><button class="btn btn-quiet" data-m="x">Отмена</button>
    <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="ok">${esc(ok)}</button></div></div></div>`;
        const wrap = root.firstChild; const close = () => { root.innerHTML = ''; modalClose = null; };
        modalClose = close;
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        wrap.querySelector('[data-m=x]').onclick = close;
        const btn = wrap.querySelector('[data-m=ok]');
        btn.onclick = async () => { btn.disabled = true; const r = onOk ? await onOk(wrap) : true; btn.disabled = false; if (r !== false) close(); };
        setTimeout(() => { const i = wrap.querySelector('input[type=text],textarea'); (i || btn).focus(); }, 30);
    }

    function rebuild() {
        S.packages = S.items.map(n => {
            const c = S.custom.find(p => p.name === n), m = c || dbAll().find(p => p.name === n);
            const base = m ? { ...m, known: true, custom: !!c } : { ...unknownMeta(n), known: false, custom: false };
            return {
                ...base, locked: S.locked.has(n) || isFloor(n), floor: isFloor(n),
                status: S.disabled.has(n) ? 'disabled' : 'active', running: S.running.has(n), userApp: S.thirdParty.has(n)
            };
        });
    }
    function ingest(j) {
        S.device = j.device || S.device;
        S.items = normNames(j.items).names;
        S.enabled = new Set(normNames(j.enabled).names);
        S.disabled = new Set(normNames(j.disabled).names);
        S.locked = new Set(normNames(j.protected).names);
        S.running = new Set(normNames(j.running).names);
        S.thirdParty = new Set(normNames(j.thirdParty).names);
        if (typeof j.expert === 'boolean') { S.expert = j.expert; S.expertLeft = j.expertLeft || 0; }
        rebuild();
    }
    async function loadAll() {
        ingest(await BE().packages());
        S.plan = S.plan.filter(n => S.items.includes(n) && !S.disabled.has(n));
        await Promise.all([refreshProtocol(), refreshJournals()]);
    }
    async function refreshProtocol() {
        try {
            const it = (await BE().protocol()).items;
            S.protocol = (Array.isArray(it) ? it : []).map(e => ({ ts: Number(e && e.ts) || 0, cmd: String((e && e.cmd) || ''), out: String((e && e.out) ?? ''), sim: !!(e && e.sim) }));
        } catch { S.protocol = []; }
    }
    async function refreshJournals() {
        try {
            const it = (await BE().journals()).items;
            S.journals = (Array.isArray(it) ? it : it ? [it] : []).map(normJournal).sort((a, b) => b.ts - a.ts);
        } catch { S.journals = []; }
    }
    async function reload() { ingest(await BE().packages()); await Promise.all([refreshProtocol(), refreshJournals()]); render(); }

    function renderTop() {
        const cs = $('#chip-server'), cd = $('#chip-device'), cg = $('#chip-guard');
        if (S.training) { cs.textContent = 'учебный режим'; cs.className = 'stat-chip warn'; }
        else if (S.mode === 'file') { cs.textContent = 'сервер не запущен'; cs.className = 'stat-chip err'; }
        else if (!S.server) { cs.textContent = 'сервер не отвечает'; cs.className = 'stat-chip err'; }
        else { cs.textContent = S.adb ? 'сервер и ADB готовы' : 'ADB не скачан'; cs.className = 'stat-chip ' + (S.adb ? 'ok' : 'warn'); }
        cd.textContent = S.device ? `${S.device.brand} ${S.device.model}` : 'телевизор не подключён';
        cd.className = 'stat-chip ' + (S.device ? 'ok' : '');
        cg.textContent = S.device ? (S.expert ? 'ограничения сняты' : 'ограничения включены') : 'защита';
        cg.className = 'stat-chip ' + (S.device ? (S.expert ? 'err' : 'ok') : '');
        $('#btn-disconnect').hidden = !S.device; $('#btn-recheck').hidden = !S.device;
        $('#guard-strip').hidden = !S.expert; $('#training-strip').hidden = !S.training;
        document.body.classList.toggle('strip-on', S.expert || S.training);
        if (S.expert) $('#guard-timer').textContent = mmss(S.expertLeft);
        const ready = S.packages.filter(p => p.verdict === 'safe' && !p.locked && p.status === 'active').length;
        const nav = S.device ? [
            ['overview', 'gauge', 'Обзор', ''], ['packages', 'list', 'Пакеты', ready || ''],
            ['kb', 'db', 'База знаний', unknownList().length || ''], ['plan', 'layers', 'План', S.plan.length || ''],
            ['diag', 'activity', 'Диагностика', ''], ['protocol', 'terminal', 'Протокол', S.protocol.length || ''],
            ['journals', 'archive', 'Журналы', S.journals.filter(j => !j.rolledBack).length || ''], ['wizard', 'plug', 'Подключение', '']
        ] : [['wizard', 'plug', 'Подключение', '']];
        $('#rail').innerHTML = nav.map(([v, i, l, b]) => `<button class="rail-item ${S.view === v ? 'active' : ''}" data-action="nav" data-nav="${v}">${icon(i)}<span>${l}</span><em class="rail-badge">${b}</em></button>`).join('') +
            `<div class="rail-foot"><div class="rf">${icon('shield')}<span>Отключение, а не удаление. Откат реальными командами.</span></div><div>v4.4 · localhost · offline</div></div>`;
    }
    function go(v) { S.view = v; S.sel.clear(); document.body.dataset.view = v; render(); window.scrollTo(0, 0); }

    function renderBackend() {
        const el = $('#backend-card'); if (S.training) { el.innerHTML = ''; return; }
        if (S.mode === 'file') el.innerHTML = `<div class="panel backend-card err"><h2>${icon('warn')}Шаг 0. Программа открыта как файл</h2>
    <p class="lede">Адрес начинается с <code>file://</code> — из файла браузер не может обращаться к серверу и запускать ADB.</p>
    <ol><li>Закрой вкладку.</li><li>Двойной клик по <code>start.cmd</code>.</li><li>Оставь окно сервера открытым.</li></ol>
    <div class="cmd-line">start.cmd<button class="btn btn-quiet btn-sm" data-action="copy-cmd">${icon('copy')}скопировать</button></div></div>`;
        else if (!S.server) el.innerHTML = `<div class="panel backend-card"><h2>${icon('warn')}Шаг 0. Запусти сервер</h2>
    <p class="lede">Локальный сервер не отвечает: без него команды телевизору не отправляются.</p>
    <ol><li>Двойной клик по <code>start.cmd</code> в папке проекта.</li><li>Не закрывай окно сервера.</li><li>Нажми «Проверить снова».</li></ol>
    <div style="margin-top:12px"><button class="btn btn-primary btn-sm" data-action="recheck">${icon('refresh')}Проверить снова</button></div></div>`;
        else if (!S.adb) el.innerHTML = `<div class="panel backend-card ok"><h2>${icon('check')}Шаг 0. Нужен ADB</h2>
    <p class="lede">Официальный инструмент Google, около 5 МБ, скачивается с dl.google.com.</p>
    <div style="margin-top:12px"><button class="btn btn-primary" data-action="get-adb">${icon('download')}Скачать ADB</button></div></div>`;
        else el.innerHTML = `<div class="panel backend-card ok"><h2>${icon('check')}Шаг 0. Сервер и ADB готовы</h2>
    <p class="lede">Выполни шаги ниже на телевизоре и подключись.</p></div>`;
    }
    function renderWizard() {
        renderBackend();
        $('#platform-grid').innerHTML = Object.entries(D.platforms).map(([k, p]) => `<button class="platform ${S.platform === k ? 'active' : ''}" data-action="platform" data-k="${k}"><span class="code">${esc(p.code)}</span><b>${esc(p.title)}</b><small>${esc(p.vendors)}</small></button>`).join('');
        const pl = D.platforms[S.platform];
        $('#steps-box').innerHTML = pl.steps.map((st, i) => {
            const key = S.platform + ':' + i, done = !!S.steps[key];
            return `<div class="panel step ${done ? 'done' : ''}"><div class="step-n">${done ? icon('check') : i + 2}</div>
      <div><h3>${esc(st.t)}</h3><div class="step-body">${st.b.map(x => `<p>${esc(x)}</p>`).join('')}
      ${st.w ? `<div class="notice warn">${icon('warn')}<div>${esc(st.w)}</div></div>` : ''}</div></div>
      <label class="switch-line compact"><input type="checkbox" data-change="step" data-key="${key}" ${done ? 'checked' : ''}><span class="switch"></span><span>готово</span></label></div>`;
        }).join('');
        $('#trouble-box').innerHTML = D.trouble.map(([q, a]) => `<details class="qa"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
        $('#unsupported-box').innerHTML = D.unsupported.map(([q, a]) => `<details class="qa"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
        consoleInto($('#wizard-console'));
    }
    function consoleInto(el) {
        if (!el) return;
        if (!S.protocol.length) { el.innerHTML = '<span class="t">Протокол пуст. Здесь появятся реальные команды adb и ответы телевизора.</span>'; return; }
        el.innerHTML = S.protocol.slice(-70).map(e => {
            const bad = /fail|error|exception|blocked|floor|защищ|запрет|persistent/i.test(e.out);
            return `<span class="t">[${fmtTime(e.ts)}]</span> ${e.sim ? '<span class="s">[учебный]</span> ' : ''}<span class="${bad ? 'w' : 'c'}">${esc(e.cmd)}</span>\n<span class="o">${esc(e.out)}</span>\n`;
        }).join('');
        el.scrollTop = el.scrollHeight;
    }

    function renderOverview() {
        const d = S.device; if (!d) return;
        $('#ov-title').textContent = `${d.brand} ${d.model}`;
        $('#ov-device').innerHTML = `<div class="device-sub">${esc(d.brand)} · ${esc((D.platforms[d.platform] || {}).title || d.platform)}</div>
    <div class="device-title">${esc(d.model)}</div>
    <div class="kv">
      <div class="kv-row"><span>Система</span><span>Android ${esc(d.android)} · SDK ${esc(d.sdk)}</span></div>
      <div class="kv-row"><span>Платформа / ABI</span><span>${esc(d.soc || '—')} · ${esc(d.abi || '—')}</span></div>
      <div class="kv-row"><span>Адрес отладки</span><span>${esc(d.serial)}</span></div>
      <div class="kv-row"><span>Пакетов в системе</span><span>${d.packageCount} · без описания ${unknownList().length}</span></div>
      <div class="kv-row"><span>Главный экран</span><span>${esc(d.launcher || 'не определён')}</span></div>
      <div class="kv-row"><span>Клавиатура</span><span>${esc(d.ime || '—')}</span></div>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-quiet btn-sm" data-action="home">${icon('home')}Обновить экран ТВ</button>
      <button class="btn btn-danger btn-sm" data-action="reboot">${icon('power')}Перезагрузить ТВ</button>
    </div>`;
        const ready = S.packages.filter(p => p.verdict === 'safe' && !p.locked && p.status === 'active').length;
        const off = S.packages.filter(p => p.status === 'disabled');
        const run = S.packages.filter(p => p.running && !p.locked && p.status === 'active').length;
        $('#ov-metrics').innerHTML = `
    <div class="metric ok"><div class="metric-v">${ready}</div><div class="metric-l">пакетов можно отключить смело</div></div>
    <div class="metric accent"><div class="metric-v">${off.length}</div><div class="metric-l">уже отключено на телевизоре</div></div>
    <div class="metric warn"><div class="metric-v">${run}</div><div class="metric-l">запущено сейчас и доступно к отключению</div></div>
    <div class="metric"><div class="metric-v">${S.packages.filter(p => p.locked).length}</div><div class="metric-l">под защитой сервера</div></div>`;
        const g = $('#ov-guard'); g.className = 'panel guard-panel' + (S.expert ? ' expert' : '');
        const lockedList = S.packages.filter(p => p.locked);
        g.innerHTML = `<div class="gp-top"><div class="gp-icon">${icon(S.expert ? 'unlock' : 'shield')}</div>
    <div><h2>${S.expert ? 'Ограничения сняты' : 'Ограничения включены'}</h2>
      <p>${S.expert ? 'Экспертный режим активен: сервер разрешает отключать системные пакеты. Каждый шаг пишется в журнал с пометкой «эксперт». Абсолютный запрет остаётся на двух пакетах.' : 'Отключаются только установленные тобой приложения и пакеты из проверенной базы. Флешки, HDMI, пульт, сеть и аккаунт Google защищены сервером.'}</p></div>
    <div class="gp-actions">${S.expert ? `<span class="guard-timer">${mmss(S.expertLeft)}</span><button class="btn btn-quiet btn-sm" data-action="expert-off">${icon('lock')}Вернуть ограничения</button>` : `<button class="btn btn-danger btn-sm" data-action="expert-on">${icon('unlock')}Снять ограничения</button>`}</div></div>
    <div class="guard-list">${lockedList.slice(0, 12).map(p => `<div class="guard-row">${icon('lock')}<span class="mono">${esc(p.name)}</span><span class="why">${esc(p.label)}</span></div>`).join('') || '<div class="guard-row">Защищены только два пакета абсолютного запрета.</div>'}
    ${lockedList.length > 12 ? `<div class="hint" style="padding:4px 8px">…и ещё ${lockedList.length - 12}. Полный список — «Пакеты», статус «заблокирован».</div>` : ''}</div>`;
        const groups = [['safe', 'Отключить безопасное', 'Подтверждённая реклама и телеметрия.', 'power'],
        ['perf', 'Ускорить интерфейс', 'Ассистент и заставка — главные потребители памяти.', 'gauge'],
        ['track', 'Убрать слежку', 'Телеметрия, отчёты, распознавание контента.', 'eye'],
        ['apps', 'Убрать лишние приложения', 'Кинотеатры и сервисы, которыми не пользуешься.', 'trash'],
        ['kb', 'Выгрузить неизвестные', 'Отдай список ИИ и получи описания.', 'db']];
        $('#ov-quick').innerHTML = groups.map(([k, t, s, i]) => {
            const list = k === 'kb' ? unknownList() : pickGroup(k);
            return `<button class="quick" data-action="${k === 'kb' ? 'go-kb' : 'quick'}" data-k="${k}" ${list.length ? '' : 'disabled'}><b>${icon(i)}${esc(t)}</b><small>${esc(s)}</small><span class="count">${list.length ? list.length + ' пакет(ов)' : 'нечего добавлять'}</span></button>`;
        }).join('');
        $('#ov-disabled-count').textContent = off.length ? `${off.length} шт.` : '';
        $('#ov-disabled').innerHTML = off.length ? `<div class="tag-list">${off.map(p => `<span class="tag">${esc(p.name)}</span>`).join('')}</div>
    <p class="hint" style="margin-top:10px">Прочитано командой pm list packages -d. Включить обратно — «Пакеты», статус «отключён». Для persistent-приложений нужна перезагрузка.</p>`: '<p class="hint">Сейчас на телевизоре ничего не отключено.</p>';
    }
    function pickGroup(k) {
        const l = S.packages.filter(p => !p.locked && p.status === 'active');
        if (k === 'safe') return l.filter(p => p.verdict === 'safe');
        if (k === 'perf') return l.filter(p => p.cat === 'perf');
        if (k === 'track') return l.filter(p => ['telemetry', 'acr'].includes(p.cat));
        if (k === 'apps') return l.filter(p => p.cat === 'apps' || p.userApp);
        return [];
    }

    function kbVisible() { let l = unknownList(); if (S.kbQ) { const q = S.kbQ.toLowerCase(); l = l.filter(p => p.name.toLowerCase().includes(q)); } return l.sort((a, b) => a.name.localeCompare(b.name)); }
    function kbScope() { const vis = kbVisible(); const picked = vis.filter(p => S.kbSel.has(p.name)); return picked.length ? picked : vis; }
    function renderKB() {
        const unk = unknownList(), known = S.packages.filter(p => p.known && !p.custom).length;
        $('#kb-stats').innerHTML = `
    <div class="kb-stat"><div class="v">${S.packages.length}</div><div class="l">пакетов на телевизоре</div></div>
    <div class="kb-stat ok"><div class="v">${known}</div><div class="l">описано во встроенной базе</div></div>
    <div class="kb-stat accent"><div class="v">${S.custom.length}</div><div class="l">моих описаний</div></div>
    <div class="kb-stat warn"><div class="v">${unk.length}</div><div class="l">без описания</div></div>`;
        const vis = kbVisible();
        $('#kb-unknown-count').textContent = `${unk.length} шт.`;
        $('#kb-sel-count').textContent = S.kbSel.size ? `выбрано: ${S.kbSel.size}` : 'ничего не выбрано — выгрузятся все видимые';
        $('#kb-all').checked = vis.length > 0 && vis.every(p => S.kbSel.has(p.name));
        if (document.activeElement !== $('#kb-q')) $('#kb-q').value = S.kbQ;
        $('#kb-list').innerHTML = vis.length ? vis.map(p => `<div class="kb-row">
    <label class="r-check"><input type="checkbox" data-change="kb-pick" data-name="${esc(p.name)}" ${S.kbSel.has(p.name) ? 'checked' : ''}></label>
    <div class="kb-name">${esc(p.name)}</div>
    <span class="kb-guess ${guessCat(p.name)}">предположение: ${esc(D.categories[guessCat(p.name)] || guessCat(p.name))}</span>
    ${p.running ? '<span class="kb-run">запущен</span>' : '<span class="hint">не запущен</span>'}
    <button class="mini" data-action="kb-copy-one" data-name="${esc(p.name)}">${icon('copy')}</button></div>`).join('')
            : `<div class="kb-empty">${icon('check')}<div>${unk.length ? 'Ничего не найдено по фильтру.' : 'Все пакеты уже описаны.'}</div></div>`;
        $('#kb-custom-count').textContent = S.custom.length ? `${S.custom.length} шт.` : '';
        $('#kb-custom').innerHTML = S.custom.length ? S.custom.map(c => `<div class="kb-custom-row">
    <div><div class="t">${esc(c.label)}</div><div class="n">${esc(c.name)}</div></div>
    <span class="pill ${verdictOf(c).tone}">${esc(verdictOf(c).label)}</span>
    <span class="kb-guess">${esc(D.categories[c.cat] || c.cat)}</span>
    <button class="mini" data-action="kb-custom-del" data-name="${esc(c.name)}">${icon('trash')}</button></div>`).join('')
            : `<div class="kb-empty">${icon('db')}<div>Пока пусто. Выгрузи неизвестные, получи описания и импортируй их выше.</div></div>`;
    }
    function buildPrompt(names) {
        const d = S.device || {};
        return ['Ты — эксперт по системным и прикладным пакетам Android TV / Google TV.',
            `Устройство: ${d.brand || '?'} ${d.model || '?'} · Android ${d.android || '?'} · платформа ${(D.platforms[d.platform] || {}).title || d.platform || '?'} · SoC ${d.soc || '?'}.`,
            'Ниже пакеты, которых нет в моей базе описаний. Для КАЖДОГО верни объект строго по схеме:',
            '{"name":"точное.имя.пакета","label":"краткое русское название","cat":"ads|telemetry|acr|update|bloat|perf|media|apps|system","risk":"low|medium|high|critical","verdict":"safe|optional|caution|forbidden","what":"что это и зачем стоит на телевизоре","gain":"что даст отключение","loss":"что конкретно перестанет работать"}',
            'Правила:',
            '- Системные пакеты, отключение которых ломает флешки, HDMI, пульт, сеть, загрузку или аккаунт: verdict="forbidden", risk="high" или "critical", в loss — точные последствия.',
            '- Реклама, телеметрия и ненужный bloat: verdict="safe" или "optional".',
            '- Если не уверен: verdict="caution", в what честно напиши что это предположение, в loss — что проверить.',
            '- Не выдумывай факты. Лучше caution, чем ложная уверенность.',
            'Ответь ТОЛЬКО JSON-массивом объектов, без markdown-ограждений и пояснений.', '', 'Список пакетов:', ...names].join('\n');
    }
    function parseImport(text) {
        let t = String(text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
        const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a > -1 && b > a) t = t.slice(a, b + 1);
        const arr = JSON.parse(t); if (!Array.isArray(arr)) throw new Error('Ожидался JSON-массив объектов.');
        const ok = [], bad = [];
        for (const raw of arr) {
            if (!raw || typeof raw !== 'object') { bad.push({ name: '(не объект)', reason: 'элемент не объект' }); continue; }
            const name = String(raw.name || '').trim();
            if (!/^[A-Za-z0-9._]+$/.test(name)) { bad.push({ name: name || '(пусто)', reason: 'недопустимое имя' }); continue; }
            const label = String(raw.label || '').trim();
            if (!label) { bad.push({ name, reason: 'нет label' }); continue; }
            ok.push({
                name, label, cat: D.categories[raw.cat] ? raw.cat : 'unknown', risk: D.risks[raw.risk] ? raw.risk : 'medium',
                verdict: D.verdicts[raw.verdict] ? raw.verdict : 'caution',
                what: String(raw.what || 'Назначение уточняется.').trim(), gain: String(raw.gain || 'Неизвестно.').trim(),
                loss: String(raw.loss || 'Последствия неизвестны: проверь перед отключением.').trim(), src: raw.src || null
            });
        }
        return { ok, bad };
    }
    function doImport() {
        const ta = $('#kb-import'), box = $('#kb-import-msg');
        let p; try { p = parseImport(ta.value); } catch (e) { box.innerHTML = `<div class="notice err">${icon('warn')}<div>Не удалось разобрать JSON: ${esc(e.message)}</div></div>`; return; }
        if (!p.ok.length) { box.innerHTML = `<div class="notice err">${icon('warn')}<div>Подходящих записей нет.</div></div>`; return; }
        const names = new Set(p.ok.map(x => x.name));
        const replaced = S.custom.filter(c => names.has(c.name)).length;
        S.custom = [...S.custom.filter(c => !names.has(c.name)), ...p.ok];
        persist(); rebuild();
        box.innerHTML = `<div class="notice ok">${icon('check')}<div>Добавлено: <b>${p.ok.length - replaced}</b>${replaced ? `, обновлено: ${replaced}` : ''}. Уже применено к списку пакетов.</div></div>` +
            (p.bad.length ? `<div class="notice warn">${icon('warn')}<div>Отклонено: ${p.bad.length}. ${p.bad.slice(0, 4).map(b => esc(b.name) + ': ' + esc(b.reason)).join('; ')}</div></div>` : '');
        ta.value = ''; toast(`Импортировано описаний: <b>${p.ok.length}</b>.`, { type: 'ok' }); render();
    }
    function customAsDataJs() {
        const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\s*\n\s*/g, ' ');
        return S.custom.map(c => `P('${q(c.name)}', '${q(c.label)}', '${q(c.cat)}', '${q(c.risk)}', '${q(c.verdict)}', '${q(c.what)}', '${q(c.gain)}', '${q(c.loss)}'${c.src ? `, '${q(c.src)}'` : ''}),`).join('\n');
    }

    const CATS = [['all', 'Все'], ['ads', 'Реклама'], ['track', 'Слежка и ACR'], ['perf', 'Производительность'], ['apps', 'Приложения'], ['bloat', 'Предустановленное'], ['media', 'Медиа'], ['update', 'Обновления'], ['system', 'Система'], ['unknown', 'Без описания']];
    const VORDER = { safe: 0, optional: 1, caution: 2, forbidden: 3 };
    function visible() {
        const f = S.filters; let l = [...S.packages];
        if (f.hideLocked) l = l.filter(p => !p.locked);
        if (f.known) l = l.filter(p => p.known);
        if (f.cat === 'track') l = l.filter(p => ['telemetry', 'acr'].includes(p.cat));
        else if (f.cat !== 'all') l = l.filter(p => p.cat === f.cat);
        if (f.status === 'active') l = l.filter(p => p.status === 'active' && !p.locked);
        if (f.status === 'disabled') l = l.filter(p => p.status === 'disabled');
        if (f.status === 'locked') l = l.filter(p => p.locked);
        if (f.status === 'running') l = l.filter(p => p.running);
        if (f.q) { const q = f.q.toLowerCase(); l = l.filter(p => (p.name + ' ' + p.label + ' ' + p.what + ' ' + p.gain + ' ' + p.loss).toLowerCase().includes(q)); }
        l.sort((a, b) => f.sort === 'name' ? a.name.localeCompare(b.name)
            : f.sort === 'cat' ? a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name)
                : f.sort === 'risk' ? (D.riskOrder[a.risk] ?? 9) - (D.riskOrder[b.risk] ?? 9) || a.name.localeCompare(b.name)
                    : (VORDER[a.verdict] ?? 9) - (VORDER[b.verdict] ?? 9) || (D.riskOrder[a.risk] ?? 9) - (D.riskOrder[b.risk] ?? 9) || a.name.localeCompare(b.name));
        return l;
    }
    function renderPackages() {
        $('#cat-chips').innerHTML = CATS.map(([v, l]) => `<button class="chip ${S.filters.cat === v ? 'active' : ''}" data-action="cat" data-k="${v}">${l}</button>`).join('');
        $('#f-status').value = S.filters.status; $('#f-sort').value = S.filters.sort;
        $('#f-known').checked = S.filters.known; $('#f-hide-locked').checked = S.filters.hideLocked;
        if (document.activeElement !== $('#q')) $('#q').value = S.filters.q;
        const presets = [{ id: 'v1', name: 'Безопасное к отключению', f: { q: '', cat: 'all', status: 'active', sort: 'verdict', known: true, hideLocked: true } },
        { id: 'v2', name: 'Производительность', f: { q: '', cat: 'perf', status: 'active', sort: 'risk', known: true, hideLocked: true } },
        { id: 'v3', name: 'Запущено сейчас', f: { q: '', cat: 'all', status: 'running', sort: 'risk', known: false, hideLocked: true } },
        { id: 'v4', name: 'Заблокированные', f: { q: '', cat: 'all', status: 'locked', sort: 'name', known: false, hideLocked: false } },
        { id: 'v5', name: 'Без описания', f: { q: '', cat: 'unknown', status: 'all', sort: 'name', known: false, hideLocked: false } }];
        $('#f-view').innerHTML = '<option value="">выбрать…</option>' + presets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('') + S.views.map(v => `<option value="${v.id}">${esc(v.name)}</option>`).join('');
        const l = visible();
        $('#pkg-counter').textContent = `${l.length} из ${S.packages.length}`;
        const unk = unknownList().length;
        $('#pkg-unknown-btn').innerHTML = `${icon('db')}<span>Неизвестные${unk ? ': ' + unk : ''}</span>`;
        const pickable = l.filter(p => !p.locked);
        $('#sel-all').checked = pickable.length > 0 && pickable.every(p => S.sel.has(p.name));
        $('#bulk').hidden = S.sel.size === 0;
        $('#bulk-count').textContent = S.sel.size ? `Выбрано: ${S.sel.size}` : '';
        $('#pkg-head').hidden = !l.length;
        $('#pkg-table').innerHTML = l.length ? l.map(rowHtml).join('') : `<div class="empty">${icon('search')}<div>Ничего не найдено. Измени фильтры или запрос.</div></div>`;
    }
    function rowHtml(p) {
        const work = S.apply && S.apply.current === p.name, v = verdictOf(p);
        const state = work ? ['working', 'применяется'] : p.locked ? ['locked', 'заблокирован'] : p.status === 'disabled' ? ['disabled', 'отключён'] : ['active', 'активен'];
        return `<article class="row ${p.locked ? 'locked' : ''} ${p.status === 'disabled' ? 'off' : ''} ${work ? 'working' : ''}" data-action="open" data-name="${esc(p.name)}" tabindex="0">
    <label class="r-check" data-stop><input type="checkbox" data-change="pick" data-name="${esc(p.name)}" ${S.sel.has(p.name) ? 'checked' : ''} ${p.locked ? 'disabled' : ''}></label>
    <div class="r-main">
      <div class="r-name">${esc(p.name)}${p.running ? '<span class="run-dot" title="запущен сейчас"></span>' : ''}${p.custom ? '<span class="run-dot" style="background:var(--accent)" title="моё описание"></span>' : ''}</div>
      <div class="r-label">${esc(p.label)}</div>
      <div class="r-effect ${p.locked ? 'bad' : ''}"><span class="k">${p.locked ? 'Нельзя:' : 'Что пропадёт:'}</span> ${esc(p.loss)}</div>
    </div>
    <div class="r-cat"><span class="cat-tag">${esc(D.categories[p.cat] || p.cat)}</span></div>
    <div><span class="pill ${p.locked ? 'danger' : v.tone}">${esc(p.locked ? 'нельзя' : v.label)}</span></div>
    <div><span class="state ${state[0]}">${state[1]}</span></div>
    <div class="r-actions" data-stop>${p.locked ? `<button class="mini" disabled>${icon('lock')}</button>`
                : p.status === 'disabled' ? `<button class="mini" data-action="enable" data-name="${esc(p.name)}" title="Включить обратно">${icon('undo')}</button>`
                    : `<button class="mini danger" data-action="apply-one" data-name="${esc(p.name)}" title="Отключить сейчас">${icon('power')}</button>
         <button class="mini" data-action="to-plan" data-name="${esc(p.name)}" title="В план">${icon('plus')}</button>`}</div></article>`;
    }

    function confirmApply(names) {
        const all = normNames(names).names;
        const list = all.filter(n => { const p = S.packages.find(x => x.name === n); return p && !p.locked && p.status !== 'disabled'; });
        const skipped = all.length - list.length;
        if (!list.length) { toast('Нечего применять: пакеты заблокированы или уже отключены.', { type: 'warn' }); return; }
        const risky = list.filter(n => { const p = S.packages.find(x => x.name === n); return p && (p.risk === 'high' || p.risk === 'critical' || !p.known); });
        const needPhrase = list.length > 3 || risky.length > 0 || S.expert;
        const items = list.map(n => {
            const p = S.packages.find(x => x.name === n);
            return `<div class="m-item"><div class="m-top"><span class="m-title">${esc(p.label)}</span><span class="pill ${verdictOf(p).tone}">${esc(verdictOf(p).label)}</span>${p.running ? '<span class="pill neutral">запущен</span>' : ''}</div>
      <div class="m-name">${esc(p.name)}</div><div class="m-loss">Пропадёт: ${esc(p.loss)}</div>
      <div class="m-gain">Даст: ${esc(p.gain)}</div>
      <div class="m-cmd">pm disable-user --user 0 ${esc(p.name)}${S.opts.force ? ' → am force-stop ' + esc(p.name) : ''}</div></div>`;
        }).join('');
        modal({
            title: `Отключить ${list.length} пакет(ов)`, danger: true, ok: 'Применить',
            body: `<div>Ничего не удаляется. Откат — <code>pm enable</code>. ${S.opts.force ? 'Процессы останавливаются сразу.' : ''} ${S.opts.home ? 'После применения экран вернётся на главный.' : ''}
      ${skipped ? `<br><b>${skipped}</b> пропущено.` : ''}<br>Persistent-приложения не умирают от force-stop — для них нужна перезагрузка.</div>
      <div class="modal-list">${items}</div>
      ${risky.length ? `<div class="notice err">${icon('warn')}<div>${risky.length} пакет(ов) с высоким риском или без описания.</div></div>` : ''}
      ${needPhrase ? `<div class="notice warn" style="margin-top:10px">${icon('warn')}<div>Впиши слово <b>ОТКЛЮЧИТЬ</b>.</div></div><input type="text" id="phrase" placeholder="ОТКЛЮЧИТЬ" autocomplete="off">` : ''}`,
            onOk: async w => { if (needPhrase && (w.querySelector('#phrase').value || '').trim().toUpperCase() !== 'ОТКЛЮЧИТЬ') { w.querySelector('#phrase').focus(); return false; } await applyNames(list); }
        });
    }
    async function applyNames(names) {
        if (S.busy) return; S.busy = true;
        const sid = 's' + Date.now().toString(36) + uid();
        S.apply = { total: names.length, current: null }; S.sel.clear();
        const ok = [], failed = [], persistent = [];
        showProgress(0, names.length, 'Подготовка…'); render();
        for (let i = 0; i < names.length; i++) {
            const n = names[i]; S.apply.current = n; showProgress(i, names.length, n); markRow(n, true);
            try {
                const j = await BE().disable({ names: [n], session: sid, forceStop: S.opts.force });
                if (typeof j.expert === 'boolean') { S.expert = j.expert; S.expertLeft = j.left || 0; }
                const r = (j.results || [])[0] || { ok: false, output: 'нет ответа' };
                if (r.ok) {
                    ok.push(n); S.disabled.add(n); S.enabled.delete(n); S.running.delete(n);
                    S.plan = S.plan.filter(x => x !== n); S.planState[n] = { ok: true, verified: !!r.verified };
                    if (r.persistent) { persistent.push(n); toast(`<b>${esc(metaOf(n).label)}</b>: процесс не остановился (persistent). Нужна перезагрузка ТВ.`, { type: 'warn', timeout: 10000 }); }
                    else toast(`<b>${esc(metaOf(n).label)}</b> отключён${r.verified ? ', проверено' : ''}${r.wasRunning ? ', процесс остановлен' : ''}.`, { type: 'ok', timeout: 3500 });
                    rebuild();
                } else { failed.push(r); S.planState[n] = { ok: false, error: r.output }; toast(`<b>${esc(n)}</b>: ${esc(r.output)}`, { type: 'err', timeout: 9000 }); }
            } catch (e) { failed.push({ name: n, output: e.message }); S.planState[n] = { ok: false, error: e.message }; toast('Ошибка: ' + esc(e.message), { type: 'err' }); }
            markRow(n, false); showProgress(i + 1, names.length, n);
            try { renderTop(); renderPlan(); renderPackages(); } catch (e) { console.error(e); }
        }
        if (S.opts.home && ok.length) { try { await BE().home(); } catch { } }
        await reload(); S.apply = null; S.busy = false; hideProgress(); render();
        if (ok.length) toast(`<b>Готово: ${ok.length}</b> отключено${persistent.length ? `, из них ${persistent.length} требуют перезагрузки` : ''}.`,
            { type: 'ok', timeout: 12000, undo: async () => { try { await BE().enable(ok); await BE().home(); await reload(); toast('Откат выполнен.', { type: 'ok' }); } catch (e) { toast('Ошибка отката: ' + esc(e.message), { type: 'err' }); } } });
        if (failed.length && !ok.length) toast('Ничего не отключено. Причины — в тостах и протоколе.', { type: 'warn' });
    }
    function markRow(name, on) {
        const el = $(`.row[data-name="${CSS.escape(name)}"]`); if (!el) return;
        el.classList.toggle('working', on); if (!on) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    }
    function showProgress(done, total, label) {
        const w = $('#apply-progress'); if (!w) return; w.hidden = false;
        $('#apply-label').textContent = label; $('#apply-count').textContent = `${done} / ${total}`;
        $('#apply-bar').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
    }
    function hideProgress() { const w = $('#apply-progress'); if (w) w.hidden = true; }

    function renderPlan() {
        $('#opt-force').checked = S.opts.force; $('#opt-home').checked = S.opts.home;
        const ov = $('#opt-verify'); if (ov) ov.checked = S.opts.verify;
        $('#plan-summary').textContent = S.plan.length ? `${S.plan.length} пакет(ов)` : '';
        $('#btn-apply').disabled = !S.plan.length || S.busy;
        $('#plan-list').innerHTML = S.plan.length ? S.plan.map((n, i) => {
            const p = S.packages.find(x => x.name === n) || { ...metaOf(n), locked: false };
            const st = S.planState[n], work = S.apply && S.apply.current === n;
            const state = work ? '<span class="work">применяется…</span>' : st && st.ok ? `<span class="ok">отключён${st.verified ? ' · проверено' : ''}</span>` : st && !st.ok ? '<span class="fail">отказ</span>' : '<span class="hint">в очереди</span>';
            return `<div class="plan-row" draggable="true" data-name="${esc(n)}">
      <span class="grip">${icon('grip')}</span><span class="plan-n">${String(i + 1).padStart(2, '0')}</span>
      <div class="r-main"><div class="r-name">${esc(n)}</div><div class="r-label">${esc(p.label)}</div>
        <div class="r-effect ${p.locked ? 'bad' : ''}"><span class="k">Что пропадёт:</span> ${esc(p.loss)}</div></div>
      <div><span class="pill ${p.locked ? 'danger' : verdictOf(p).tone}">${esc(p.locked ? 'нельзя' : verdictOf(p).label)}</span></div>
      <div class="plan-state">${state}</div>
      <button class="mini" data-action="plan-del" data-name="${esc(n)}">${icon('x')}</button></div>`;
        }).join('')
            : `<div class="empty">${icon('layers')}<div>План пуст. Добавь пакеты из «Пакеты», быстрыми действиями в «Обзоре» или вручную.</div></div>`;
    }
    function addToPlan(names) {
        let added = 0, skipped = 0;
        normNames(names).names.forEach(n => {
            const p = S.packages.find(x => x.name === n);
            if (!p || p.locked || p.status === 'disabled' || S.plan.includes(n)) { skipped++; return; } S.plan.push(n); added++;
        });
        toast(added ? `В план добавлено: <b>${added}</b>${skipped ? `, пропущено ${skipped}` : ''}.` : 'Нечего добавлять: уже в плане, отключены или заблокированы.', { type: added ? 'ok' : 'warn' });
        S.sel.clear(); render();
    }

    function parseTop(raw) {
        const lines = String(raw || '').split('\n'); let hi = -1, cols = null;
        lines.forEach((l, i) => { if (hi < 0 && /PID/.test(l) && /%CPU/.test(l)) { hi = i; cols = l.trim().split(/\s+/); } });
        if (hi < 0) return [];
        const cpuI = cols.findIndex(c => c.includes('%CPU')), memI = cols.findIndex(c => c.includes('%MEM'));
        if (cpuI < 0 || memI < 0) return [];
        const shift = /\S\[%CPU\]/.test(cols[cpuI]) ? 1 : 0;
        const rows = [];
        for (let i = hi + 1; i < lines.length; i++) {
            const c = lines[i].trim().split(/\s+/); if (!/^\d+$/.test(c[0])) continue;
            rows.push({
                pid: c[0], cpu: parseFloat(c[cpuI + shift]) || 0, mem: parseFloat(c[memI + shift]) || 0,
                res: c[5] || '', args: c.slice(memI + shift + 2).join(' ')
            });
        }
        return rows.sort((a, b) => b.cpu - a.cpu).slice(0, 12);
    }
    function parseDiag(d) {
        const mem = {}; String(d.meminfo || '').split('\n').forEach(l => { const m = l.match(/^(\w+):\s+(\d+)/); if (m) mem[m[1]] = +m[2]; });
        const totalMB = Math.round((mem.MemTotal || 0) / 1024), availMB = Math.round((mem.MemAvailable || 0) / 1024);
        const swapTotalMB = Math.round((mem.SwapTotal || 0) / 1024), swapFreeMB = Math.round((mem.SwapFree || 0) / 1024);
        const swapUsedMB = Math.max(0, swapTotalMB - swapFreeMB);
        const cmaMB = Math.round((mem.CmaTotal || 0) / 1024);
        const load1 = parseFloat(String(d.loadavg || '').trim().split(/\s+/)[0]) || 0;
        const cores = parseInt(String(d.cores || '').trim(), 10) || 1;
        const upH = Math.round((parseFloat(String(d.uptime || '').split(/\s+/)[0]) || 0) / 3600);
        const idleM = String(d.top || '').match(/(\d+)%idle/), totM = String(d.top || '').match(/(\d+)%cpu/);
        const cpuBusy = (idleM && totM && +totM[1] > 0) ? clamp(Math.round(100 * (1 - idleM[1] / totM[1])), 0, 100) : null;
        let usePct = null, free = '', mount = '';
        String(d.df || '').split('\n').forEach(l => {
            const c = l.trim().split(/\s+/); const p = c.findIndex(x => /^\d+%$/.test(x));
            if (p > 0) { usePct = parseInt(c[p], 10); free = c[p - 1]; mount = c.slice(p + 1).join(' '); }
        });
        let temp = 0, tempSrc = '';
        String(d.thermal || '').split('\n').forEach(l => {
            let m = l.match(/mValue=([\d.]+)/);
            if (m) { const v = parseFloat(m[1]); if (v > temp && v < 150) { temp = v; tempSrc = 'thermalservice'; } return; }
            m = l.match(/(\d+)\s*$/);
            if (m) { let v = +m[1]; if (v > 1000) v /= 1000; if (v > temp && v < 150) { temp = v; tempSrc = 'sysfs'; } }
        });
        return {
            totalMB, availMB, swapTotalMB, swapUsedMB, cmaMB, load1, cores, upH, cpuBusy, usePct, free, mount,
            temp: Math.round(temp), tempSrc, rows: parseTop(d.top), flags: Array.isArray(d.privacy) ? d.privacy : []
        };
    }
    function renderDiag() {
        const meters = $('#diag-meters'), verdict = $('#diag-verdict'), top = $('#diag-top'), run = $('#diag-running');
        if (!S.diag) {
            meters.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('gauge')}<div>Нажми «Снять показания»: программа прочитает память, процессор, накопитель, температуру и параметры приватности.</div></div>`;
            verdict.innerHTML = ''; top.innerHTML = ''; run.innerHTML = ''; $('#diag-running-count').textContent = ''; return;
        }
        const p = S.diag;
        const memPct = p.totalMB ? clamp(Math.round(100 * (p.totalMB - p.availMB) / p.totalMB), 0, 100) : 0;
        const swapPct = p.swapTotalMB ? clamp(Math.round(100 * p.swapUsedMB / p.swapTotalMB), 0, 100) : 0;
        const cells = [
            { name: 'Память', v: `${p.availMB} МБ`, pct: memPct, tone: memPct >= 85 ? 'bad' : memPct >= 70 ? 'warn' : 'ok', l: `свободно из ${p.totalMB} МБ · занято ${memPct}%${p.cmaMB ? ` · ${p.cmaMB} МБ отдано видеотракту (CMA)` : ''}` },
            { name: 'Процессор', v: p.cpuBusy == null ? '—' : p.cpuBusy + '%', pct: p.cpuBusy || 0, tone: p.cpuBusy >= 85 ? 'bad' : p.cpuBusy >= 60 ? 'warn' : 'ok', l: `реальная занятость по top · ${p.cores} ядра · loadavg ${p.load1.toFixed(1)}` },
            { name: 'Подкачка', v: p.swapTotalMB ? `${p.swapUsedMB} МБ` : '—', pct: swapPct, tone: swapPct >= 70 ? 'bad' : swapPct >= 40 ? 'warn' : 'ok', l: p.swapTotalMB ? `занято ${swapPct}% из ${p.swapTotalMB} МБ zram` : 'подкачка не используется' },
            { name: 'Накопитель', v: p.usePct == null ? '—' : p.usePct + '%', pct: p.usePct || 0, tone: p.usePct >= 90 ? 'bad' : p.usePct >= 80 ? 'warn' : 'ok', l: `свободно ${p.free || '—'}${p.mount ? ` · ${p.mount}` : ''}` },
            { name: 'Температура', v: p.temp ? p.temp + '°C' : 'нет датчика', pct: p.temp ? clamp(p.temp, 0, 100) : 0, tone: p.temp >= 80 ? 'bad' : p.temp >= 70 ? 'warn' : 'ok', l: p.temp ? `максимум по ${p.tempSrc === 'thermalservice' ? 'thermalservice' : 'датчикам SoC'}` : 'прошивка не отдаёт температуру ни через sysfs, ни через thermalservice' }
        ];
        meters.innerHTML = cells.map(c => `<div class="meter ${c.tone}"><div class="meter-top"><span class="meter-v">${esc(c.v)}</span><span class="meter-name">${esc(c.name)}</span></div>
    <div class="meter-track"><div class="meter-fill" style="width:${c.pct}%"></div></div><div class="meter-l">${esc(c.l)}</div></div>`).join('');
        const v = [];
        if (p.totalMB && p.availMB / p.totalMB < .15) v.push(['bad', `Память почти заполнена: свободно ${p.availMB} МБ из ${p.totalMB}${p.cmaMB ? `, при этом ${p.cmaMB} МБ отрезано под видеотракт` : ''}. Тормоза дают фоновые сервисы, а не открытые приложения.`]);
        else if (p.totalMB && p.availMB / p.totalMB < .3) v.push(['warn', `Память впритык: ${p.availMB} МБ свободно. Отключение ассистента и заставки даст прирост.`]);
        if (swapPct >= 70) v.push(['bad', `Подкачка занята на ${swapPct}% (${p.swapUsedMB} МБ). Система перекладывает страницы в zram — это источник рывков. Освободи память: заставка, ассистент, лишние приложения.`]);
        else if (swapPct >= 40) v.push(['warn', `Подкачка занята на ${swapPct}% — памяти уже не хватает.`]);
        if (p.usePct != null && p.usePct >= 90) v.push(['bad', `Накопитель занят на ${p.usePct}%, свободно ${p.free}. Почисти кэш приложений.`]);
        if (p.temp >= 80) v.push(['bad', `Троттлинг: ${p.temp}°C. Процессор сбрасывает частоту, отсюда рывки.`]);
        if (p.cpuBusy != null && p.cpuBusy >= 70) v.push(['bad', `Процессор занят на ${p.cpuBusy}% — смотри таблицу процессов ниже.`]);
        if (p.load1 / p.cores > 1.5 && p.cpuBusy != null && p.cpuBusy < 50) v.push(['info', `loadavg ${p.load1.toFixed(1)} при ${p.cores} ядрах, но реальная занятость всего ${p.cpuBusy}%. На TV-прошивках loadavg набит драйверными потоками в состоянии ожидания и не означает нагрузку.`]);
        if (!v.length) v.push(['ok', 'Показатели в норме. Если интерфейс тормозит — дело в ленте рекомендаций лаунчера и сети. Помогает замена лаунчера на Projectivy.']);
        const priv = p.flags.filter(f => /^(global|secure)\./.test(f.id) && f.value !== 'null');
        if (priv.length) {
            const on = priv.filter(f => ['global.tcl_diagnostic_status', 'global.tcl_uxp_status', 'global.send_action_app_error', 'secure.send_action_app_error', 'global.activity_starts_logging_enabled'].includes(f.id) && f.value === '1');
            if (on.length) v.push(['warn', `Сбор данных прошивкой всё ещё включён (${on.length} параметр(ов)). Отключение пакетов его не выключает — используй блок «Приватность» ниже.`]);
            v.push(['privacy', '']);
        }
        verdict.innerHTML = `<div class="verdicts">${v.map(([t, x]) => t === 'privacy' ? privacyHtml(priv) : `<div class="vrow ${t}">${icon(t === 'ok' ? 'check' : t === 'info' ? 'info' : 'warn')}<div>${esc(x)}</div></div>`).join('')}</div>`;
        const max = Math.max(1, ...p.rows.map(r => r.cpu));
        top.innerHTML = p.rows.length ? `<table class="dtable"><thead><tr><th>Процесс</th><th>PID</th><th>Процессор</th><th class="num">Память</th><th class="num">RES</th></tr></thead><tbody>
    ${p.rows.map(r => `<tr><td class="proc">${esc(r.args)}</td><td>${esc(r.pid)}</td>
      <td class="bar-cell"><i style="width:${Math.round(r.cpu / max * 54)}px"></i><span style="padding-left:62px">${r.cpu.toFixed(1)}%</span></td>
      <td class="num">${r.mem.toFixed(1)}%</td><td class="num">${esc(r.res)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="empty">Топ процессов не распознан. Сырой вывод — в протоколе.</div>';
        const running = S.packages.filter(x => x.running);
        $('#diag-running-count').textContent = running.length ? `${running.length} шт.` : '';
        run.innerHTML = running.length ? `<div class="run-list">${running.map(x => `<div class="run-item">${icon('cpu')}<span class="mono">${esc(x.name)}</span>
    <span class="pill ${x.locked ? 'danger' : x.status === 'disabled' ? 'ok' : 'neutral'}">${x.locked ? 'защищён' : x.status === 'disabled' ? 'отключён' : 'активен'}</span></div>`).join('')}</div>`
            : '<div class="empty">Список запущенных процессов пуст в этом замере.</div>';
    }
    function privacyHtml(flags) {
        const rows = flags.map(f => {
            const meta = (D.privacyLabels || {})[f.id] || [f.key, ''];
            const editable = ['global.tcl_diagnostic_status', 'global.tcl_uxp_status', 'global.send_action_app_error', 'secure.send_action_app_error', 'global.activity_starts_logging_enabled', 'secure.backup_enabled', 'secure.screensaver_enabled'].includes(f.id);
            const isOn = f.value === '1';
            return `<div class="m-item"><div class="m-top"><span class="m-title">${esc(meta[0])}</span><span class="pill ${isOn ? 'warn' : 'ok'}">${esc(f.value)}</span></div>
      <div class="m-name">${esc(f.id)}</div><div class="m-note">${esc(meta[1])}</div>
      ${editable ? `<div style="margin-top:7px;display:flex;gap:7px">
        <button class="btn btn-quiet btn-sm" data-action="priv-set" data-id="${esc(f.id)}" data-v="0">Выключить (0)</button>
        <button class="btn btn-quiet btn-sm" data-action="priv-set" data-id="${esc(f.id)}" data-v="1">Включить (1)</button></div>` : ''}</div>`;
        }).join('');
        return `<div class="vrow info">${icon('eye')}<div><b>Приватность прошивки.</b> Это параметры настроек, а не пакеты: отключение приложений их не меняет.</div></div>
    <div class="modal-list" style="max-height:none">${rows}</div>`;
    }
    async function runDiag() {
        if (S.busy) return; S.busy = true;
        const b = $('#btn-diag'); b.disabled = true; b.classList.add('spin'); b.innerHTML = `${icon('refresh')}Снимаю…`;
        try {
            const raw = await BE().diag(); S.diag = parseDiag(raw);
            const rn = normNames(raw.running).names; if (rn.length) { S.running = new Set(rn); rebuild(); }
            await refreshProtocol(); toast('Показания сняты с телевизора.', { type: 'ok' });
        } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); }
        b.disabled = false; b.classList.remove('spin'); b.innerHTML = `${icon('gauge')}Снять показания`; S.busy = false; render();
    }
    async function setPrivacy(id, value) {
        try {
            const j = await BE().privacy([{ id, value }]); const r = (j.results || [])[0];
            if (S.diag && Array.isArray(j.flags)) S.diag.flags = j.flags;
            await refreshProtocol(); render();
            toast(r && r.ok ? `<b>${esc(id)}</b> = ${esc(value)} — проверено чтением.` : `Не удалось изменить ${esc(id)}: ${esc(r ? r.output : 'нет ответа')}`, { type: r && r.ok ? 'ok' : 'err' });
        } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); }
    }

    async function runScan() {
        if (S.busy) return; S.busy = true; render();
        try {
            const j = await BE().scan([...dbAll().map(p => p.name), ...S.custom.map(p => p.name)]);
            const items = normNames(j.items).names.filter(n => !S.ignored.includes(n));
            S.scan = items; await refreshProtocol();
            modal({
                title: `Найдено кандидатов: ${items.length}`, ok: 'Добавить выбранные в план',
                body: `<div>Пакеты вне базы. Проверь каждый в теме модели на 4PDA или выгрузи в «Базе знаний».</div>
        <div class="modal-list">${items.length ? items.map(n => `<label class="m-item" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">
          <input type="checkbox" class="scan-pick" value="${esc(n)}" style="margin-top:3px;accent-color:var(--accent)">
          <span><span class="m-name" style="font-size:12px;color:var(--text)">${esc(n)}</span>
          <span class="m-loss" style="display:block">Назначение неизвестно.</span></span></label>`).join('') : '<div class="empty">Кандидатов нет.</div>'}</div>`,
                onOk: w => { const picked = [...w.querySelectorAll('.scan-pick:checked')].map(i => i.value); if (picked.length) addToPlan(picked); }
            });
        } catch (e) { toast('Ошибка скана: ' + esc(e.message), { type: 'err' }); }
        S.busy = false; render();
    }
    function renderProtocol() {
        $('#proto-count').textContent = `Протокол · ${S.protocol.length} записей`;
        $('#proto-list').innerHTML = S.protocol.length ? [...S.protocol].reverse().map(e => `<div class="proto-line"><span class="t">[${fmtTime(e.ts)}]</span> ${e.sim ? '<span class="s">[учебный]</span> ' : ''}<span class="c">${esc(e.cmd)}</span><span class="o">${esc(e.out)}</span></div>`).join('')
            : `<div class="empty">${icon('terminal')}<div>Протокол пуст.</div></div>`;
    }
    function journalCard(j) {
        try {
            const names = normNames(j.names).names;
            return `<div class="journal"><div class="journal-top"><span class="journal-date">${fmtDate(j.ts)}</span>
      <span class="pill ${j.rolledBack ? 'neutral' : j.expert ? 'danger' : 'ok'}">${j.rolledBack ? 'откачен' : j.expert ? 'эксперт' : 'применено'}</span>
      <span class="hint">${esc(j.device)} · ${names.length} пакет(ов)</span>
      ${j.repaired ? `<span class="pill warn">исправлено: ${j.repaired}</span>` : ''}
      <span class="journal-actions"><button class="btn btn-quiet btn-sm" data-action="j-export" data-id="${esc(j.path)}">${icon('download')}Экспорт</button>
      ${!j.rolledBack && names.length ? `<button class="btn btn-primary btn-sm" data-action="j-rollback" data-id="${esc(j.path)}">${icon('undo')}Откатить</button>` : ''}</span></div>
      ${names.length ? `<div class="tag-list" style="margin-top:10px">${names.map(n => `<span class="tag">${esc(n)}</span>`).join('')}</div>`
                    : `<div class="notice warn" style="margin-top:10px">${icon('warn')}<div>В журнале нет читаемых имён. Откат по нему невозможен.</div></div>`}
      <div class="journal-path">${esc(j.path)}</div></div>`;
        } catch (e) { return `<div class="journal"><div class="notice err">${icon('warn')}<div>Журнал повреждён: ${esc(e.message)}</div></div></div>`; }
    }
    function renderJournals() {
        $('#journal-list').innerHTML = S.journals.length ? S.journals.map(journalCard).join('')
            : `<div class="panel"><div class="empty">${icon('archive')}<div>Журналов пока нет. Каждое применение создаёт запись с правом отката.</div></div></div>`;
    }

    function openDrawer(name) { S.drawer = name; renderDrawer(); $('#drawer').classList.add('open'); $('#scrim').hidden = false; }
    function closeDrawer() { S.drawer = null; $('#drawer').classList.remove('open'); $('#scrim').hidden = true; }
    function renderDrawer() {
        if (!S.drawer) return;
        const p = S.packages.find(x => x.name === S.drawer) || { ...metaOf(S.drawer), locked: S.locked.has(S.drawer), status: 'active', running: false, known: false, custom: false };
        const v = verdictOf(p);
        const cmd = p.status === 'disabled' ? `adb shell pm enable ${p.name}` : `adb shell pm disable-user --user 0 ${p.name}${S.opts.force ? `\nadb shell am force-stop ${p.name}` : ''}`;
        $('#drawer-body').innerHTML = `
    <div><div class="d-title">${esc(p.label)}</div><div class="d-name">${esc(p.name)}</div></div>
    <div class="d-badges"><span class="pill ${p.locked ? 'danger' : v.tone}">${esc(p.locked ? 'заблокирован' : v.label)}</span>
      <span class="pill neutral">${esc(D.categories[p.cat] || p.cat)}</span>
      <span class="pill neutral">риск: ${esc(riskOf(p))}</span>
      <span class="pill ${p.status === 'disabled' ? 'ok' : 'neutral'}">${p.status === 'disabled' ? 'отключён' : 'активен'}</span>
      ${p.running ? '<span class="pill info">запущен сейчас</span>' : ''}${p.custom ? '<span class="pill info">моё описание</span>' : ''}</div>
    <div class="d-block what"><h4>Что это</h4><p>${esc(p.what)}</p></div>
    <div class="d-block gain"><h4>Что даст отключение</h4><p>${esc(p.gain)}</p></div>
    <div class="d-block loss"><h4>Что перестанет работать</h4><p>${esc(p.loss)}</p></div>
    <div class="notice ${p.locked ? 'err' : 'info'}">${icon(p.locked ? 'lock' : 'info')}<div>${esc(p.locked ? (p.floor ? 'Абсолютный запрет: пакет разрывает связь с компьютером или ломает загрузку.' : 'Системная функция. В обычном режиме сервер откажет. Снять ограничения можно в «Обзоре» под свою ответственность.') : v.hint)}</div></div>
    ${!p.known ? `<button class="btn btn-quiet" data-action="go-kb">${icon('db')}Получить описание в «Базе знаний»</button>` : ''}
    <div><div class="hint" style="margin-bottom:5px">Точные команды</div><div class="d-cmd">${esc(cmd)}</div></div>
    ${p.src ? `<a class="btn btn-quiet btn-sm" href="${D.SRC[p.src]}" target="_blank" rel="noopener">${icon('info')}Источник: ${p.src === 'habr' ? 'разбор на Хабре' : 'темы 4PDA'}</a>` : ''}
    <div class="d-actions">${p.locked ? `<button class="btn btn-quiet" disabled>${icon('lock')}Заблокировано сервером</button>`
                : p.status === 'disabled' ? `<button class="btn btn-primary" data-action="enable" data-name="${esc(p.name)}">${icon('undo')}Включить обратно</button>`
                    : `<button class="btn btn-danger" data-action="apply-one" data-name="${esc(p.name)}">${icon('power')}Отключить сейчас</button>
         <button class="btn btn-quiet" data-action="to-plan" data-name="${esc(p.name)}">${icon('layers')}Добавить в план</button>`}
      <button class="btn btn-quiet" data-action="copy-name" data-name="${esc(p.name)}">${icon('copy')}Скопировать имя</button></div>`;
    }

    function expertOn() {
        modal({
            title: 'Снять ограничения', danger: true, ok: 'Принимаю ответственность',
            body: `<div>Экспертный режим разрешает отключать <b>системные пакеты</b>: флешки, HDMI, пульт, сеть, аккаунт Google, загрузку.</div>
      <ul class="liability"><li>Флешки и USB-диски могут перестать читаться.</li><li>Может пропасть меню источников и переключение HDMI.</li>
      <li>Может отвалиться пульт, клавиатура или голосовой ввод.</li><li>Возможны циклическая перезагрузка и сброс до заводских.</li>
      <li>Часть последствий устраняется только сбросом телевизора.</li></ul>
      <div class="notice info">${icon('info')}<div>Режим на 30 минут. Абсолютный запрет остаётся на <code>android</code> и <code>com.android.shell</code>.</div></div>
      <label class="switch-line" style="margin-top:12px"><input type="checkbox" id="liab"><span class="switch"></span><span>Я понимаю последствия и принимаю ответственность</span></label>
      <input type="text" id="phrase" placeholder="Впиши: Я ПОНИМАЮ РИСК" autocomplete="off">`,
            onOk: async w => {
                if (!w.querySelector('#liab').checked) { toast('Отметь принятие ответственности.', { type: 'warn' }); return false; }
                if ((w.querySelector('#phrase').value || '').trim().toUpperCase() !== 'Я ПОНИМАЮ РИСК') { w.querySelector('#phrase').focus(); return false; }
                try {
                    const j = await BE().expert({ action: 'on', confirm: 'I-ACCEPT-RISK' });
                    S.expert = j.expert; S.expertLeft = j.left; const pn = normNames(j.protected).names;
                    S.locked = new Set(pn.length ? pn : D.floor); rebuild(); await refreshProtocol(); render();
                    toast('<b>Ограничения сняты на 30 минут.</b> Действуй по одному и проверяй телевизор.', { type: 'warn', timeout: 12000 });
                } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); return false; }
            }
        });
    }
    async function expertOff() {
        try {
            const j = await BE().expert({ action: 'off' });
            S.expert = false; S.expertLeft = 0; S.locked = new Set(normNames(j.protected).names);
            rebuild(); await refreshProtocol(); render(); toast('Ограничения восстановлены.', { type: 'ok' });
        } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); }
    }
    function confirmReboot() {
        modal({
            title: 'Перезагрузить телевизор?', danger: true, ok: 'Перезагрузить',
            body: `<div>Это единственный способ убрать из памяти persistent-приложения после отключения и заставить оболочку перечитать состояние пакетов.</div>
      <div class="notice info" style="margin-top:10px">${icon('info')}<div>Связь по ADB оборвётся на 30–60 секунд. После загрузки нажми «Подключить» снова. Отключённые пакеты останутся отключёнными.</div></div>`,
            onOk: async () => {
                try {
                    const j = await BE().reboot(); toast(esc(j.message || 'Команда перезагрузки отправлена.'), { type: 'warn', timeout: 12000 });
                    S.device = null; S.packages = []; S.plan = []; S.diag = null; S.expert = false; go('wizard');
                } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); }
            }
        });
    }

    async function connect() {
        if (S.busy) return;
        if (!S.training && !S.server) { toast('Сначала запусти сервер: start.cmd.', { type: 'err' }); return; }
        S.busy = true; const b = $('#btn-connect'); b.disabled = true; b.classList.add('spin'); b.innerHTML = `${icon('refresh')}Подключаюсь…`;
        $('#rsa-note').hidden = true;
        const pair = $('#pair-mode').checked;
        const body = pair ? { pairAddr: $('#pair-addr').value.trim(), code: $('#pair-code').value.trim(), connectAddr: $('#conn-addr').value.trim() } : { ip: $('#conn-ip').value.trim() };
        try {
            const j = await BE().connect(body); await refreshProtocol();
            if (j.unauthorized) { $('#rsa-note').hidden = false; toast('Подтверди запрос отладки на экране телевизора и повтори.', { type: 'warn' }); }
            else if (!j.ok) toast('Не подключилось. Смотри протокол и «Если не подключается».', { type: 'err' });
            else { S.device = j.device; S.server = true; S.adb = true; await loadAll(); go('overview'); toast(`Подключено: <b>${esc(j.device.brand)} ${esc(j.device.model)}</b>.`, { type: 'ok' }); }
        } catch (e) { toast('Ошибка: ' + esc(e.message), { type: 'err' }); await refreshProtocol(); }
        b.disabled = false; b.classList.remove('spin'); b.innerHTML = `${icon('plug')}Подключить`; S.busy = false; render();
    }
    async function probe() {
        if (location.protocol === 'file:') { S.mode = 'file'; S.server = false; render(); return; }
        try {
            const c = new AbortController(); setTimeout(() => c.abort(), 1600);
            const j = await (await fetch('/api/state', { signal: c.signal })).json();
            S.server = true; S.adb = !!j.adb; S.mode = 'server'; S.expert = !!j.expert; S.expertLeft = j.expertLeft || 0;
            if (j.connected && j.device) { S.device = j.device; await loadAll(); if (S.view === 'wizard') S.view = 'overview'; }
            else { S.device = null; S.view = 'wizard'; }
        } catch { S.server = false; S.mode = 'no-server'; S.view = 'wizard'; }
        render();
    }

    const VIEWS = {
        wizard: renderWizard, overview: renderOverview, packages: renderPackages, kb: renderKB,
        plan: renderPlan, diag: renderDiag, protocol: renderProtocol, journals: renderJournals
    };
    function render() {
        try { renderTop(); } catch (e) { console.error('renderTop', e); }
        $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + S.view));
        $$('.render-error').forEach(n => n.remove());
        const host = $('#view-' + S.view);
        try { (VIEWS[S.view] || (() => { }))(); }
        catch (e) {
            console.error('render ' + S.view, e);
            if (host) host.insertAdjacentHTML('beforeend', `<div class="panel render-error"><div class="notice err">${icon('warn')}<div><b>Раздел не смог отрисоваться.</b> ${esc(e.message)}<br>Данные не потеряны: нажми «Проверить» или обнови страницу с Ctrl+F5.</div></div></div>`);
        }
        if (S.drawer) { try { renderDrawer(); } catch (e) { console.error('renderDrawer', e); } }
    }

    document.addEventListener('click', e => {
        const t = e.target.closest('[data-action]'); if (!t) return;
        const a = t.dataset.action, name = t.dataset.name;
        if (a === 'open' && e.target.closest('[data-stop],input,button,a')) return;
        switch (a) {
            case 'nav': go(t.dataset.nav); break;
            case 'go-kb': go('kb'); break;
            case 'recheck': S.device ? reload().then(() => toast('Состояние телевизора перечитано.', { type: 'ok', timeout: 3000 })) : probe(); break;
            case 'copy-cmd': copyText('start.cmd'); break;
            case 'get-adb': (async () => { try { toast('Скачиваю platform-tools…', { type: 'info' }); await BE().adb(); S.adb = true; await refreshProtocol(); render(); toast('ADB готов.', { type: 'ok' }); } catch (err) { toast('Ошибка: ' + esc(err.message), { type: 'err' }); } })(); break;
            case 'platform': S.platform = t.dataset.k; persist(); renderWizard(); break;
            case 'connect': connect(); break;
            case 'home': (async () => { try { await BE().home(); await refreshProtocol(); toast('Экран телевизора возвращён на главный.', { type: 'ok' }); } catch (err) { toast('Ошибка: ' + esc(err.message), { type: 'err' }); } })(); break;
            case 'reboot': confirmReboot(); break;
            case 'priv-set': setPrivacy(t.dataset.id, t.dataset.v); break;
            case 'disconnect': (async () => { try { await BE().disconnect(); } catch { } S.device = null; S.packages = []; S.plan = []; S.diag = null; S.expert = false; S.training = false; S.sel.clear(); S.kbSel.clear(); go('wizard'); probe(); })(); break;
            case 'training-start': (async () => { S.training = true; S.device = T.dev; await loadAll(); go('overview'); toast('<b>Учебный режим.</b> Данные вымышленные.', { type: 'warn', timeout: 9000 }); })(); break;
            case 'training-exit': S.training = false; S.device = null; S.packages = []; S.plan = []; S.diag = null; S.expert = false; go('wizard'); probe(); break;
            case 'expert-on': expertOn(); break;
            case 'expert-off': expertOff(); break;
            case 'quick': addToPlan(pickGroup(t.dataset.k).map(p => p.name)); go('plan'); break;
            case 'cat': S.filters.cat = t.dataset.k; S.sel.clear(); renderPackages(); break;
            case 'open': openDrawer(name); break;
            case 'drawer-close': closeDrawer(); break;
            case 'copy-name': copyText(name); break;
            case 'apply-one': confirmApply([name]); break;
            case 'to-plan': addToPlan([name]); break;
            case 'enable': (async () => {
                try {
                    const j = await BE().enable([name]); const r = (j.results || [])[0]; await BE().home(); await reload();
                    toast(r && r.ok ? `<b>${esc(metaOf(name).label)}</b> включён обратно${r.verified ? ', проверено' : ''}.` : 'Не удалось включить пакет.', { type: r && r.ok ? 'ok' : 'err' });
                } catch (err) { toast('Ошибка: ' + esc(err.message), { type: 'err' }); }
            })(); break;
            case 'bulk-plan': addToPlan([...S.sel]); break;
            case 'bulk-apply': confirmApply([...S.sel]); break;
            case 'bulk-enable': (async () => { const list = [...S.sel]; S.sel.clear(); try { await BE().enable(list); await BE().home(); await reload(); toast(`Включено обратно: ${list.length}.`, { type: 'ok' }); } catch (err) { toast('Ошибка: ' + esc(err.message), { type: 'err' }); } })(); break;
            case 'bulk-clear': S.sel.clear(); renderPackages(); break;
            case 'save-view': modal({
                title: 'Сохранить текущий вид', ok: 'Сохранить',
                body: '<div>Запомнит поиск, категорию, статус, сортировку и переключатели.</div><input type="text" id="vname" placeholder="Название вида" maxlength="40">',
                onOk: w => { const v = w.querySelector('#vname').value.trim(); if (!v) return false; S.views.push({ id: uid(), name: v, f: { ...S.filters } }); persist(); renderPackages(); toast('Вид сохранён.', { type: 'ok' }); }
            }); break;
            case 'plan-del': S.plan = S.plan.filter(n => n !== name); delete S.planState[name]; renderPlan(); renderTop(); break;
            case 'plan-clear': S.plan = []; S.planState = {}; renderPlan(); renderTop(); break;
            case 'plan-add': modal({
                title: 'Добавить пакет вручную', ok: 'Добавить в план',
                body: '<div>Введи точное имя установленного пакета.</div><input type="text" id="manual" placeholder="com.example.package" autocomplete="off">',
                onOk: w => {
                    const n = w.querySelector('#manual').value.trim();
                    if (!/^[A-Za-z0-9._]+$/.test(n)) { toast('Недопустимое имя пакета.', { type: 'err' }); return false; }
                    if (!S.items.includes(n)) { toast('Такого пакета нет на телевизоре.', { type: 'err' }); return false; }
                    addToPlan([n]);
                }
            }); break;
            case 'plan-apply': confirmApply([...S.plan]); break;
            case 'diag-run': runDiag(); break;
            case 'proto-refresh': refreshProtocol().then(render); break;
            case 'proto-copy': copyText(S.protocol.map(x => `[${fmtTime(x.ts)}] ${x.cmd}\n${x.out}`).join('\n\n')); break;
            case 'proto-export': download('cleantv-protocol.txt', S.protocol.map(x => `[${fmtTime(x.ts)}] ${x.cmd}\n${x.out}`).join('\n\n')); break;
            case 'j-export': { const j = S.journals.find(x => x.path === t.dataset.id); if (j) download('cleantv-journal.txt', ['Чистый ТВ · журнал', fmtDate(j.ts), j.device, j.expert ? 'Экспертный режим' : 'Обычный режим', '', ...normNames(j.names).names].join('\n')); break; }
            case 'j-rollback': {
                const j = S.journals.find(x => x.path === t.dataset.id); if (!j) return;
                const names = normNames(j.names).names;
                if (!names.length) { toast('В журнале нет читаемых имён.', { type: 'err' }); break; }
                modal({
                    title: 'Откатить сессию', ok: `Включить ${names.length} пакет(ов)`,
                    body: `<div>Реальные команды включения, затем возврат на главный экран.</div>
          <div class="modal-list">${names.map(n => `<div class="m-item"><div class="m-title">${esc(metaOf(n).label)}</div><div class="m-cmd">adb shell pm enable ${esc(n)}</div></div>`).join('')}</div>`,
                    onOk: async () => { try { await BE().rollback(j.path); await BE().home(); await reload(); toast('Откат выполнен. Для persistent-приложений перезагрузи ТВ.', { type: 'ok', timeout: 10000 }); } catch (err) { toast('Ошибка: ' + esc(err.message), { type: 'err' }); } }
                }); break;
            }
            case 'kb-copy-one': copyText(name); break;
            case 'kb-copy-list': { const n = kbScope().map(p => p.name); if (!n.length) { toast('Нечего выгружать.', { type: 'warn' }); break; } copyText(n.join('\n')); toast(`Скопировано имён: <b>${n.length}</b>.`, { type: 'ok' }); break; }
            case 'kb-txt': { const n = kbScope().map(p => p.name); if (!n.length) { toast('Нечего выгружать.', { type: 'warn' }); break; } download('cleantv-unknown.txt', n.join('\n')); break; }
            case 'kb-json': {
                const n = kbScope().map(p => p.name); if (!n.length) { toast('Нечего выгружать.', { type: 'warn' }); break; }
                const d = S.device || {}; download('cleantv-unknown.json', JSON.stringify({ tool: 'chisty-tv', version: '4.4', exportedAt: new Date().toISOString(), device: { brand: d.brand, model: d.model, android: d.android, platform: d.platform, soc: d.soc }, count: n.length, packages: n.map(x => ({ name: x, guess: guessCat(x) })) }, null, 2)); break;
            }
            case 'kb-prompt': {
                const n = kbScope().map(p => p.name); if (!n.length) { toast('Все пакеты описаны.', { type: 'warn' }); break; }
                const prompt = buildPrompt(n);
                modal({
                    title: `Запрос к ИИ · ${n.length} пакетов`, ok: 'Скопировать запрос',
                    body: `<div>Скопируй блок и отправь ИИ. Ответ — JSON-массив — вставь в поле импорта ниже.</div><pre class="kb-prompt-pre">${esc(prompt)}</pre>`,
                    onOk: () => { copyText(prompt); }
                }); break;
            }
            case 'kb-import': doImport(); break;
            case 'kb-import-example': modal({
                title: 'Формат описания', ok: 'Понятно',
                body: `<div>Обязательны <code>name</code> и <code>label</code>, остальное подставится по умолчанию.</div>
        <pre class="kb-prompt-pre">${esc(JSON.stringify([{ name: 'com.example.package', label: 'Краткое название', cat: 'system', risk: 'high', verdict: 'forbidden', what: 'Что это', gain: 'Что даст отключение', loss: 'Что перестанет работать' }], null, 2))}</pre>
        <div class="hint">cat: ${Object.keys(D.categories).join(', ')} · risk: ${Object.keys(D.risks).join(', ')} · verdict: ${Object.keys(D.verdicts).join(', ')}</div>`
            }); break;
            case 'kb-custom-del': S.custom = S.custom.filter(c => c.name !== name); persist(); rebuild(); render(); toast('Описание удалено.', { type: 'ok', timeout: 3000 }); break;
            case 'kb-custom-clear': modal({
                title: 'Очистить мои описания', danger: true, ok: `Удалить ${S.custom.length}`,
                body: `<div>Импортированные описания (${S.custom.length}) будут удалены. Встроенная база останется.</div>`,
                onOk: () => { S.custom = []; persist(); rebuild(); render(); toast('Мои описания очищены.', { type: 'ok' }); }
            }); break;
            case 'kb-custom-export': {
                if (!S.custom.length) { toast('Нечего экспортировать.', { type: 'warn' }); break; }
                const code = customAsDataJs();
                modal({
                    title: `Строки для data.js · ${S.custom.length}`, ok: 'Скопировать',
                    body: `<div>Вставь в нужный массив в <code>web/data.js</code>, чтобы описания стали частью встроенной базы.</div><pre class="kb-prompt-pre">${esc(code)}</pre>`,
                    onOk: () => { copyText(code); }
                }); break;
            }
        }
    });
    document.addEventListener('change', e => {
        const t = e.target, c = t.dataset.change;
        if (t.id === 'pair-mode') { $('#pair-fields').hidden = !t.checked; $('#conn-ip').disabled = t.checked; return; }
        if (t.id === 'opt-force') { S.opts.force = t.checked; return; }
        if (t.id === 'opt-home') { S.opts.home = t.checked; return; }
        if (t.id === 'opt-verify') { S.opts.verify = t.checked; return; }
        if (!c) return;
        switch (c) {
            case 'step': S.steps[t.dataset.key] = t.checked; persist(); renderWizard(); break;
            case 'pick': t.checked ? S.sel.add(t.dataset.name) : S.sel.delete(t.dataset.name); renderPackages(); break;
            case 'sel-all': { const l = visible().filter(p => !p.locked); l.forEach(p => t.checked ? S.sel.add(p.name) : S.sel.delete(p.name)); renderPackages(); break; }
            case 'kb-pick': t.checked ? S.kbSel.add(t.dataset.name) : S.kbSel.delete(t.dataset.name); renderKB(); break;
            case 'kb-all': { const l = kbVisible(); l.forEach(p => t.checked ? S.kbSel.add(p.name) : S.kbSel.delete(p.name)); renderKB(); break; }
            case 'f-status': S.filters.status = t.value; S.sel.clear(); renderPackages(); break;
            case 'f-sort': S.filters.sort = t.value; renderPackages(); break;
            case 'f-known': S.filters.known = t.checked; S.sel.clear(); renderPackages(); break;
            case 'f-hide-locked': S.filters.hideLocked = t.checked; S.sel.clear(); renderPackages(); break;
            case 'f-view': {
                const presets = [{ id: 'v1', f: { q: '', cat: 'all', status: 'active', sort: 'verdict', known: true, hideLocked: true } },
                { id: 'v2', f: { q: '', cat: 'perf', status: 'active', sort: 'risk', known: true, hideLocked: true } },
                { id: 'v3', f: { q: '', cat: 'all', status: 'running', sort: 'risk', known: false, hideLocked: true } },
                { id: 'v4', f: { q: '', cat: 'all', status: 'locked', sort: 'name', known: false, hideLocked: false } },
                { id: 'v5', f: { q: '', cat: 'unknown', status: 'all', sort: 'name', known: false, hideLocked: false } }];
                const v = presets.find(p => p.id === t.value) || S.views.find(x => x.id === t.value);
                if (v) { S.filters = { ...v.f }; S.sel.clear(); renderPackages(); } break;
            }
        }
    });
    let qt = null, kqt = null;
    document.addEventListener('input', e => {
        if (e.target.id === 'q') { clearTimeout(qt); qt = setTimeout(() => { S.filters.q = e.target.value; renderPackages(); }, 120); }
        if (e.target.id === 'kb-q') { clearTimeout(kqt); kqt = setTimeout(() => { S.kbQ = e.target.value; renderKB(); }, 120); }
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (modalClose) modalClose(); else closeDrawer(); }
        if (e.key === '/' && S.view === 'packages' && !/input|select|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
        if (e.key === 'Enter' && e.target.classList?.contains('row')) openDrawer(e.target.dataset.name);
        if (e.key.toLowerCase() === 's' && e.altKey && S.device) { e.preventDefault(); runScan(); }
    });
    let drag = null;
    document.addEventListener('dragstart', e => { const r = e.target.closest('.plan-row'); if (!r) return; drag = r.dataset.name; r.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag); });
    document.addEventListener('dragover', e => { const r = e.target.closest('.plan-row'); if (!r || !drag || r.dataset.name === drag) return; e.preventDefault(); r.classList.add('over'); });
    document.addEventListener('dragleave', e => { const r = e.target.closest('.plan-row'); if (r) r.classList.remove('over'); });
    document.addEventListener('drop', e => {
        const r = e.target.closest('.plan-row'); if (!r || !drag) return; e.preventDefault();
        const from = S.plan.indexOf(drag), to = S.plan.indexOf(r.dataset.name);
        if (from > -1 && to > -1) { S.plan.splice(from, 1); S.plan.splice(to, 0, drag); } drag = null; renderPlan();
    });
    document.addEventListener('dragend', () => { drag = null; $$('.plan-row').forEach(x => x.classList.remove('dragging', 'over')); });
    async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } toast('Скопировано в буфер обмена.', { type: 'ok', timeout: 2500 }); }
    function download(name, text) {
        const b = new Blob([text], { type: 'text/plain;charset=utf-8' }), u = URL.createObjectURL(b);
        const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1200);
    }
    setInterval(() => {
        if (S.expert) {
            S.expertLeft = Math.max(0, S.expertLeft - 1000);
            const el = $('#guard-timer'); if (el) el.textContent = mmss(S.expertLeft);
            if (S.expertLeft <= 0 && !S.busy) { S.expert = false; reload().then(() => toast('Срок экспертного режима истёк. Ограничения восстановлены.', { type: 'info' })); }
        }
    }, 1000);
    setInterval(() => {
        if (!S.server || S.busy) return;
        if (S.view === 'wizard' || S.view === 'protocol') refreshProtocol().then(() => { if (S.view === 'wizard') consoleInto($('#wizard-console')); if (S.view === 'protocol') renderProtocol(); });
    }, 3500);
    probe();
})();