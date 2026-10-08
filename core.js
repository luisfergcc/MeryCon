/* MeryCon — base de datos local (IndexedDB), utilidades y componentes */

const DB_NAME = 'merycon';
const DB_VERSION = 1;
const STORES = ['checks', 'walks', 'sessions', 'exstate', 'exercises', 'docs', 'files', 'meds', 'intakes', 'appts', 'questions', 'clinical', 'fisio', 'tests', 'kv'];
const KEYS = { kv: 'key' };

const db = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: KEYS[s] || 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return this._p;
  },
  async tx(store, mode, fn) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      const r = fn(s);
      if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  },
  all(store) { return this.tx(store, 'readonly', s => s.getAll()).then(r => r || []); },
  get(store, id) { return this.tx(store, 'readonly', s => s.get(id)); },
  put(store, obj) { return this.tx(store, 'readwrite', s => s.put(obj)); },
  del(store, id) { return this.tx(store, 'readwrite', s => s.delete(id)); },
  clear(store) { return this.tx(store, 'readwrite', s => s.clear()); },
  async putMany(store, arr) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readwrite');
      const s = t.objectStore(store);
      for (const o of arr) s.put(o);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  },
  async kv(key, def) { const r = await this.get('kv', key); return r ? r.value : def; },
  setKv(key, value) { return this.put('kv', { key, value }); }
};

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const fmtDate = (s, o) => s ? parseYmd(s).toLocaleDateString('es-ES', o || { weekday: 'short', day: 'numeric', month: 'short' }) : '';
const fmtLong = s => fmtDate(s, { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = s => fmtDate(s, { day: 'numeric', month: 'short' });
const relDay = s => { const n = daysBetween(s, today()); if (n === 0) return 'Hoy'; if (n === 1) return 'Ayer'; if (n === -1) return 'Mañana'; if (n > 1 && n < 7) return `Hace ${n} días`; if (n < -1 && n > -14) return `En ${-n} días`; return fmtShort(s); };
const num = v => (v === '' || v === null || v === undefined || isNaN(+v)) ? null : +v;
const avg = arr => { const a = arr.filter(v => v !== null && v !== undefined && !isNaN(v)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const round1 = v => v === null || v === undefined ? '–' : (Math.round(v * 10) / 10).toLocaleString('es-ES');
const fmtBytes = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
const getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? undefined : a[k], o);
const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; a = a[k]; }); a[ks.at(-1)] = v; };
const sortBy = (arr, fn, desc) => arr.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1); });
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content; }

/* ---------- iconos (SVG en línea, estilo SF Symbols simplificado) ---------- */
const I = {
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C1 8.7 2.9 5 6.5 5c2.1 0 3.6 1.1 4.5 2.6C11.9 6.1 13.4 5 15.5 5 19.1 5 21 8.7 19.6 11.8 17.5 16.4 12 21 12 21z"/></svg>',
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/><circle cx="12" cy="15" r="2" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5M9 13h6M9 17h6"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  cross: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  walk: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="13" cy="4" r="2"/><path d="M10.6 8.2l2.6-.6c.8-.2 1.6.2 2 .9l1.4 2.6 2.6 1.1-.7 1.6-3.1-1.3-.9-1.6-1 3.9 2.5 2.6V22h-1.8v-4.1l-2.6-2.5-1 4.3-1.4 4.3H7.4l1.6-5.3 1.4-6.2-1.3.6v2.9H7.3V9.9z"/></svg>',
  dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="M9.2 8.3l5.6 7.4"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  question: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.5-5A8.5 8.5 0 1 1 21 12z"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 2-2.2 3.2M12 16.5h.01"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17.5" rx="2"/><path d="M9 4V2.5h6V4M9 10h6M9 14h6M9 18h3"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7.5" r="4"/><path d="M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z"/></svg>',
  stethoscope: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v6a5 5 0 0 0 10 0V3"/><path d="M10 14v2a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="11" r="2"/></svg>',
  ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5L1.5 21h21zM11 9h2v6h-2zm0 8h2v2h-2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  okcircle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.3 14.2L6.5 12l1.4-1.4 2.8 2.8 5.4-5.4 1.4 1.4z"/></svg>',
  stopcircle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2zm0 9h2v2h-2z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7.5 7.5L12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7.5 11.5L12 16l4.5-4.5M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0l-3 3"/></svg>'
};

/* ---------- toast, hoja, confirmación ---------- */
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = el('<div id="toast" class="toast"></div>'); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}
function sheet(title, bodyHtml, bind) {
  const back = el(`<div class="sheet-back"><div class="sheet" role="dialog" aria-label="${esc(title)}"><div class="grab"></div>${title ? `<h3>${esc(title)}</h3>` : ''}<div class="sheet-body"></div></div></div>`);
  const body = $('.sheet-body', back);
  body.append(typeof bodyHtml === 'string' ? el(bodyHtml) : bodyHtml);
  const close = () => back.remove();
  back.addEventListener('click', e => { if (e.target === back) close(); });
  document.body.append(back);
  if (bind) bind(back, close);
  return close;
}

/* ---------- formularios ---------- */
function scaleHtml(name, lo = '', hi = '') {
  let b = '';
  for (let i = 0; i <= 10; i++) b += `<button type="button" data-v="${i}">${i}</button>`;
  return `<div class="scale" data-scale="${name}">${b}</div>${lo || hi ? `<div class="scale-legend"><span>${esc(lo)}</span><span>${esc(hi)}</span></div>` : ''}`;
}
function segHtml(name, opts, cls = '') {
  return `<div class="seg ${cls}" data-seg="${name}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button type="button" data-v="${esc(v)}">${esc(l)}</button>`; }).join('')}</div>`;
}
function switchHtml(name, cls = '') { return `<label class="switch ${cls}"><input type="checkbox" name="${name}"><span></span></label>`; }
function selectHtml(name, opts, placeholder) {
  return `<select name="${name}">${placeholder !== undefined ? `<option value="">${esc(placeholder)}</option>` : ''}${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}">${esc(l)}</option>`; }).join('')}</select>`;
}

/* Enlaza un formulario a un objeto de estado. onChange se llama tras cada cambio. */
function bindForm(root, state, onChange) {
  const fire = () => onChange && onChange(state);
  $$('input[name], textarea[name], select[name]', root).forEach(inp => {
    const n = inp.name; const v = getPath(state, n);
    if (inp.type === 'checkbox') inp.checked = !!v;
    else if (inp.type === 'radio') inp.checked = v === inp.value;
    else if (v !== undefined && v !== null) inp.value = v;
    const h = () => {
      let val;
      if (inp.type === 'checkbox') val = inp.checked;
      else if (inp.type === 'number') val = inp.value === '' ? null : +String(inp.value).replace(',', '.');
      else val = inp.value;
      setPath(state, n, val); fire();
    };
    inp.addEventListener('input', h); inp.addEventListener('change', h);
  });
  $$('[data-scale]', root).forEach(sc => {
    const n = sc.dataset.scale;
    const paint = () => { const v = getPath(state, n); $$('button', sc).forEach(b => b.classList.toggle('on', v !== null && v !== undefined && +b.dataset.v === v)); };
    paint();
    sc.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const v = +b.dataset.v; setPath(state, n, getPath(state, n) === v ? null : v); paint(); fire(); });
  });
  $$('[data-seg]', root).forEach(sg => {
    const n = sg.dataset.seg;
    const paint = () => { const v = getPath(state, n); $$('button', sg).forEach(b => b.classList.toggle('on', String(v) === b.dataset.v)); };
    paint();
    sg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v; setPath(state, n, String(getPath(state, n)) === v ? null : v); paint(); fire(); });
  });
  // Mostrar/ocultar bloques según un valor: data-show="campo=valor"
  const vis = () => $$('[data-show]', root).forEach(x => { const [k, val] = x.dataset.show.split('='); const cur = getPath(state, k); x.classList.toggle('hidden', val === undefined ? !cur : String(cur) !== val); });
  vis(); root.addEventListener('click', () => setTimeout(vis)); root.addEventListener('change', vis);
}

/* ---------- gráfica SVG (línea / barras) con tooltip táctil ---------- */
function chart(container, cfg) {
  const { series, from, to, yMin = 0, yMax: yMaxCfg, type = 'line', height = 170, unit = '', ref } = cfg;
  const has = series.some(s => s.points.length);
  if (!has) { container.innerHTML = `<div class="empty-chart">Sin datos en este periodo</div>`; return; }
  const W = Math.max(280, container.clientWidth || 340), H = height, pl = 30, pr = 8, pt = 10, pb = 22;
  const days = Math.max(1, daysBetween(from, to));
  const allY = series.flatMap(s => s.points.map(p => p.y));
  let yMax = yMaxCfg ?? Math.max(...allY, ref ?? 0);
  let lo = yMin ?? Math.min(...allY);
  if (yMaxCfg === undefined) { const span = yMax - lo || 1; const step = niceStep(span / 4); yMax = Math.ceil(yMax / step) * step; if (cfg.yMin === null) lo = Math.floor(Math.min(...allY) / step) * step; }
  const X = d => pl + (daysBetween(from, d) / days) * (W - pl - pr);
  const Y = v => pt + (1 - (v - lo) / ((yMax - lo) || 1)) * (H - pt - pb);
  const step = niceStep((yMax - lo) / 4);
  let grid = '', axis = '';
  for (let v = lo; v <= yMax + 1e-9; v += step) { const y = Y(v).toFixed(1); grid += `<line x1="${pl}" x2="${W - pr}" y1="${y}" y2="${y}"/>`; axis += `<text x="${pl - 6}" y="${+y + 3}" text-anchor="end">${round1(v)}</text>`; }
  const ticks = days <= 14 ? [from, addDays(from, Math.round(days / 2)), to] : [from, addDays(from, Math.round(days / 3)), addDays(from, Math.round(2 * days / 3)), to];
  ticks.forEach((d, i) => { axis += `<text x="${X(d).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}">${fmtShort(d)}</text>`; });
  let marks = '';
  if (ref !== undefined && ref !== null) marks += `<line x1="${pl}" x2="${W - pr}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="var(--text-3)" stroke-dasharray="4 4" stroke-width="1"/>`;
  if (type === 'bar') {
    const s = series[0]; const bw = Math.max(3, Math.min(18, (W - pl - pr) / (days + 1) - 2));
    s.points.forEach(p => { const x = X(p.x) - bw / 2, y = Y(p.y), h = Math.max(1, Y(lo) - y); marks += `<path d="${roundTopRect(x, y, bw, h, Math.min(4, bw / 2))}" fill="${s.color}"/>`; });
  } else {
    series.forEach(s => {
      const pts = sortBy(s.points, p => p.x);
      if (pts.length > 1) marks += `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts.map(p => `${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')}"/>`;
      if (pts.length <= 40) pts.forEach(p => { marks += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${s.color}" stroke="var(--card)" stroke-width="2"/>`; });
    });
  }
  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(cfg.label || 'Gráfica')}"><g class="grid">${grid}</g><g class="axis">${axis}</g>${marks}<line class="cross" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--text-2)" stroke-width="1" visibility="hidden"/></svg><div class="tip"></div>`;
  const svg = $('svg', container), tip = $('.tip', container), cross = $('.cross', container);
  const dates = [...new Set(series.flatMap(s => s.points.map(p => p.x)))].sort();
  const show = ev => {
    const r = svg.getBoundingClientRect(); const px = (ev.clientX - r.left) * (W / r.width);
    let best = null, bd = 1e9; dates.forEach(d => { const dd = Math.abs(X(d) - px); if (dd < bd) { bd = dd; best = d; } });
    if (!best) return;
    const x = X(best);
    cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${fmtDate(best)}</b>` + series.map(s => { const p = s.points.find(q => q.x === best); return p ? `<div><i style="background:${s.color}"></i>${esc(s.name)}: <strong>${round1(p.y)}</strong>${unit ? ' ' + esc(unit) : ''}</div>` : ''; }).join('');
    tip.style.display = 'block';
    const left = Math.min(Math.max(x * r.width / W, 70), r.width - 70); tip.style.left = left + 'px';
  };
  const hide = () => { tip.style.display = 'none'; cross.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointerdown', show); svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) show(e); });
  svg.addEventListener('pointerleave', hide); svg.addEventListener('pointerup', () => setTimeout(hide, 1800));
}
function niceStep(raw) { if (raw <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function roundTopRect(x, y, w, h, r) { r = Math.min(r, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; }
function legendHtml(series) { return series.length < 2 ? '' : `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`; }

/* ---------- imágenes: reducir tamaño de fotos grandes ---------- */
async function shrinkImage(file, max = 2200, quality = 0.85) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 1.2e6) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch { return file; }
}
const blobToB64 = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(b); });
const b64ToBlob = (b64, type) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: type || 'application/octet-stream' }); };

/* Compartir o descargar un archivo (en iPhone abre la hoja de compartir → "Guardar en Archivos") */
async function shareFile(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
