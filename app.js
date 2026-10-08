/* MeryCon — navegación, lógica (semáforo, progresión, avisos) y copia de seguridad */

const APP_VERSION = '1.0.0';
const Views = {};
const Nav = { tab: 'hoy', stack: [], rootScroll: {} };

/* ---------- navegación ---------- */
const TABS = [
  { id: 'hoy', name: 'Hoy', icon: I.today },
  { id: 'ejercicio', name: 'Ejercicio', icon: I.dumbbell },
  { id: 'evolucion', name: 'Evolución', icon: I.chart },
  { id: 'docs', name: 'Documentos', icon: I.folder },
  { id: 'ficha', name: 'Ficha', icon: I.heart }
];
function buildTabbar() {
  const bar = el(`<nav class="tabbar">${TABS.map(t => `<button data-tab="${t.id}">${t.icon}<span>${t.name}</span></button>`).join('')}</nav>`);
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    if (Nav.tab === b.dataset.tab && !Nav.stack.length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (!Nav.stack.length) Nav.rootScroll[Nav.tab] = window.scrollY;
    Nav.tab = b.dataset.tab; Nav.stack = []; render(Nav.rootScroll[Nav.tab] || 0);
  });
  document.body.append(bar);
}
function push(view, params = {}) {
  const cur = Nav.stack.at(-1); if (cur) cur.scroll = window.scrollY; else Nav.rootScroll[Nav.tab] = window.scrollY;
  Nav.stack.push({ view, params }); render(0);
}
function pop(n = 1) { for (let i = 0; i < n; i++) Nav.stack.pop(); const cur = Nav.stack.at(-1); render(cur ? cur.scroll || 0 : Nav.rootScroll[Nav.tab] || 0); }
function goTab(tab, view, params) { Nav.tab = tab; Nav.stack = view ? [{ view, params: params || {} }] : []; render(0); }
let renderSeq = 0;
async function render(scroll = 0) {
  const seq = ++renderSeq;
  const top = Nav.stack.at(-1);
  const fn = Views[top ? top.view : Nav.tab];
  let node;
  try { node = await fn(top ? top.params : {}); }
  catch (err) { console.error(err); node = el(`<div><div class="large-head"><h1 class="large-title">Error</h1></div><div class="card">${esc(err.message || err)}</div><button class="btn" data-back>Volver</button></div>`); }
  if (seq !== renderSeq) return;
  $('#main').replaceChildren(node);
  $$('.tabbar [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === Nav.tab));
  window.scrollTo(0, scroll);
  if (node._after) node._after();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-back]'); if (b) { e.preventDefault(); pop(); return; }
  const p = e.target.closest('[data-push]');
  if (p) { e.preventDefault(); let params = {}; try { params = p.dataset.p ? JSON.parse(p.dataset.p) : {}; } catch { } push(p.dataset.push, params); }
});
const P = obj => esc(JSON.stringify(obj));

/* Cabeceras */
const navbar = (title, right = '', backLabel = 'Atrás') => `<div class="navbar"><div class="left"><button class="nav-btn" data-back>${I.back}<span>${esc(backLabel)}</span></button></div><div class="title">${esc(title)}</div><div class="right">${right}</div></div>`;
const saveBtn = (label = 'Guardar') => `<button class="nav-btn bold" data-save>${esc(label)}</button>`;
const largeHead = (title, sub = '', right = '') => `<div class="large-head"><div>${sub ? `<div class="date">${esc(sub)}</div>` : ''}<h1 class="large-title">${esc(title)}</h1></div>${right}</div>`;
const rowLink = (view, params, title, sub = '', value = '', icon = '', color = '') => `<button class="row ${icon ? 'with-icon' : ''}" data-push="${view}" data-p="${P(params || {})}">${icon ? `<span class="ico" style="background:${color}">${icon}</span>` : ''}<div class="grow"><div class="title ellipsis">${esc(title)}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${value ? `<span class="value">${value}</span>` : ''}<span class="chev">${I.chev}</span></button>`;
function onSave(node, fn) { const b = $('[data-save]', node); if (b) b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { console.error(e); alert('No se pudo guardar: ' + (e.message || e)); } finally { b.disabled = false; } }); }

/* ---------- configuración / perfil ---------- */
async function getProfile() {
  return Object.assign({ nombre: 'Mamá', baseLumbar: 5, basePierna: 5, objetivoPasos: 3000, walkTarget: 5 }, await db.kv('profile', {}));
}

/* ---------- semáforo ---------- */
function evaluate(c, prof) {
  const baseL = num(prof?.baseLumbar) ?? 5, baseP = num(prof?.basePierna) ?? 5;
  const alarms = ALARMS.filter(a => c.alarmas && c.alarmas[a.id]);
  if (alarms.length) return { color: 'rojo', urgent: alarms.some(a => a.nivel === 'urgente'), reasons: alarms.map(a => a.texto), cautions: [] };
  const r = [];
  if (c.dolorLumbar != null && c.dolorLumbar >= baseL + 2) r.push(`Dolor lumbar ${c.dolorLumbar}/10, por encima de lo habitual (${baseL})`);
  if (c.dolorPierna != null && c.dolorPierna >= baseP + 2) r.push(`Dolor de pierna ${c.dolorPierna}/10, por encima de lo habitual (${baseP})`);
  if (c.sueno === 'mala') r.push('Ha dormido mal');
  if (c.energia != null && c.energia <= 3) r.push(`Energía baja (${c.energia}/10)`);
  if (c.somnolencia != null && c.somnolencia >= 6) r.push(`Somnolencia alta (${c.somnolencia}/10)`);
  if (c.mareo != null && c.mareo >= 3) r.push(`Mareo (${c.mareo}/10)`);
  if (c.neuro === 'si') r.push('Síntoma neurológico nuevo (leve): anotarlo y comentarlo con su médico/fisio si se repite o va a más');
  if (c.urinario === 'si') r.push('Cambio urinario o intestinal (leve): vigilar y comentarlo con su médico');
  if (c.respEjercicio === 'peor') r.push('Respondió peor al ejercicio anterior');
  const cautions = [];
  if ((c.somnolencia ?? 0) >= 5 || (c.mareo ?? 0) >= 3) cautions.push('Con somnolencia o mareo: hoy nada de ejercicios de equilibrio ni levantarse sin alguien al lado.');
  return { color: r.length ? 'amarillo' : 'verde', reasons: r, cautions, urgent: false };
}
const LIGHT_TXT = {
  verde: { t: 'Verde', d: 'Sin señales de alarma y estado estable.', rec: ['Rutina completa (~10 min) dentro del límite.', 'Caminata según el objetivo actual.', 'Hacerlo cuando esté despierta y alerta, antes de la medicación de la noche.'] },
  amarillo: { t: 'Amarillo', d: 'Día más flojo: reducir volumen o intensidad.', rec: ['Solo respiración y ejercicios sentada o tumbada (5 min).', 'Caminata corta (3-5 min) o dentro de casa.', 'Mañana valorar cómo responde antes de volver a la rutina completa.', 'Un día malo no significa que el plan haya fallado.'] },
  rojo: { t: 'Rojo', d: 'Hay un cambio importante respecto a su estado habitual.', rec: ['No hacer la rutina hoy.', 'No se trata de "hacer reposo" sin más: este cambio debe valorarlo un médico.'] }
};
function lightHtml(ev, compact) {
  const L = LIGHT_TXT[ev.color];
  let rec = L.rec.slice();
  if (ev.color === 'rojo') rec.unshift(ev.urgent ? 'Valoración médica urgente: acudir a Urgencias hoy. Si no puede moverse o el cuadro es muy intenso, llamar al 112.' : 'Contactar hoy con su médico (o con Urgencias si no es posible).');
  return `<div class="light ${ev.color}"><div class="lh">${ev.color === 'verde' ? I.okcircle : ev.color === 'rojo' ? I.stopcircle : I.warn}<span>Semáforo ${L.t}</span></div>
    <p>${esc(L.d)}</p>
    ${ev.reasons.length ? `<ul>${ev.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${compact ? '' : `<p><b>Hoy:</b></p><ul>${rec.map(x => `<li>${esc(x)}</li>`).join('')}${(ev.cautions || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}</div>`;
}

/* ---------- ejercicios y progresión ---------- */
async function getLibrary() {
  const custom = await db.all('exercises');
  return EXERCISES.concat(custom.map(c => Object.assign({ custom: true, nivel: c.nivel || 1, bloque: c.bloque || 'otros' }, c)));
}
async function getRoutine() { return await db.kv('routine', EXERCISES.filter(e => e.nivel === 1).map(e => e.id)); }
async function exerciseState() {
  const [lib, states, sessions, routine, lastProg] = await Promise.all([getLibrary(), db.all('exstate'), db.all('sessions'), getRoutine(), db.kv('lastProgression', null)]);
  const st = Object.fromEntries(states.map(s => [s.id, s]));
  const dominated = new Set(states.filter(s => s.estado === 'dominado').map(s => s.id));
  const sorted = sortBy(sessions, s => s.fecha, true);
  const cutoff = addDays(today(), -21);
  const info = {};
  for (const ex of lib) {
    const s = st[ex.id];
    let estado = 'bloqueado';
    if (s && s.estado === 'dominado') estado = 'dominado';
    else if (!ex.previo || dominated.has(ex.previo) || (s && s.estado === 'desbloqueado') || ex.custom) estado = 'disponible';
    const recent = sorted.filter(x => x.fecha >= cutoff && x.items && x.items[ex.id]);
    const good = recent.filter(x => x.items[ex.id] === 'si' && !(x.sint && x.sint[ex.id]) && x.semaforo !== 'rojo').length;
    const last3 = recent.slice(0, 3);
    const clean = last3.every(x => !(x.sint && x.sint[ex.id]) && x.resp24 !== 'peor');
    const ready = estado === 'disponible' && routine.includes(ex.id) && good >= 6 && clean;
    info[ex.id] = { estado, good, ready, enRutina: routine.includes(ex.id), total: recent.length };
  }
  const daysSinceProg = lastProg ? daysBetween(lastProg, today()) : 999;
  return { lib, info, routine, dominated, daysSinceProg, canProgress: daysSinceProg >= 7 };
}
const nextOf = (lib, id) => lib.filter(e => e.previo === id);

/* ---------- caminata: sugerencia de objetivo ---------- */
async function walkSuggestion() {
  const prof = await getProfile();
  const target = num(prof.walkTarget) ?? 5;
  const walks = sortBy((await db.all('walks')).filter(w => w.fecha >= addDays(today(), -10)), w => w.fecha + (w.hora || ''), true).slice(0, 3);
  const ok = walks.length === 3 && walks.every(w => (num(w.duracion) ?? 0) >= target && w.semaforo === 'verde' && w.diaSig !== 'peor');
  return { target, suggest: ok ? target + 1 : null };
}

/* ---------- avisos de la pantalla Hoy ---------- */
async function getNotices() {
  const out = [];
  const t = today();
  const [check, tests, appts, questions, lastBackup, sessions, walks, counts] = await Promise.all([
    db.get('checks', t), db.all('tests'), db.all('appts'), db.all('questions'), db.kv('lastBackup', null), db.all('sessions'), db.all('walks'), dataCount()
  ]);
  if (!check) out.push({ color: 'var(--accent)', icon: I.heart, title: 'Check de hoy pendiente', sub: 'Dolor, energía, sueño y señales de alarma.', push: ['checkForm', { date: t }] });
  const lastTest = sortBy(tests, x => x.fecha, true)[0];
  const dTest = lastTest ? daysBetween(lastTest.fecha, t) : null;
  if (dTest === null || dTest >= 14) out.push({ color: 'var(--indigo)', icon: I.ruler, title: 'Tocan las pruebas funcionales', sub: dTest === null ? 'Aún no hay ninguna medición registrada.' : `Última hace ${dTest} días (cada 14 días).`, push: ['testForm', {}] });
  const soon = sortBy(appts.filter(a => a.estado !== 'realizada' && a.fecha >= t && daysBetween(t, a.fecha) <= 7), a => a.fecha);
  for (const a of soon) {
    const nq = questions.filter(q => q.estado !== 'respondida' && q.para === a.profesional).length;
    out.push({ color: 'var(--blue)', icon: I.calendar, title: `Cita ${relDay(a.fecha).toLowerCase()}: ${a.profesional || 'cita'}`, sub: `${a.hora ? a.hora + ' · ' : ''}${a.lugar || ''}${nq ? ` · ${nq} pregunta(s) pendiente(s)` : ''}`, push: ['apptView', { id: a.id }] });
  }
  const y = addDays(t, -1);
  const sessPend = sessions.find(s => s.fecha === y && !s.resp24);
  if (sessPend) out.push({ color: 'var(--orange)', icon: I.dumbbell, title: '¿Cómo respondió al ejercicio de ayer?', sub: 'Registrar la respuesta a las 24 h.', push: ['sessionForm', { id: sessPend.id }] });
  const walkPend = walks.find(w => w.fecha === y && !w.diaSig);
  if (walkPend) out.push({ color: 'var(--orange)', icon: I.walk, title: '¿Cómo amaneció tras la caminata de ayer?', sub: 'Completar "al día siguiente".', push: ['walkForm', { id: walkPend.id }] });
  const ws = await walkSuggestion();
  if (ws.suggest) out.push({ color: 'var(--green)', icon: I.walk, title: `Caminata: se podría probar ${ws.suggest} min`, sub: 'Las 3 últimas caminatas alcanzaron el objetivo sin empeorar.', tab: 'ejercicio' });
  const es = await exerciseState();
  const ready = es.lib.filter(e => es.info[e.id].ready);
  if (ready.length && es.canProgress) out.push({ color: 'var(--purple)', icon: I.star, title: `${ready[0].nombre}: listo para progresar`, sub: 'Varias sesiones bien hechas y sin síntomas. Un cambio cada vez.', push: ['exerciseView', { id: ready[0].id }] });
  if (counts > 0 && (!lastBackup || daysBetween(lastBackup.slice(0, 10), t) >= 7)) out.push({ color: 'var(--text-2)', icon: I.download, title: 'Haz una copia de seguridad', sub: lastBackup ? `Última: ${relDay(lastBackup.slice(0, 10)).toLowerCase()}.` : 'Todavía no has hecho ninguna.', push: ['ajustes', {}] });
  return out;
}
async function dataCount() {
  let n = 0; for (const s of ['checks', 'walks', 'sessions', 'docs', 'tests']) n += (await db.all(s)).length; return n;
}

/* ---------- copia de seguridad ---------- */
async function exportBackup() {
  const data = {};
  for (const s of STORES) if (s !== 'files') data[s] = await db.all(s);
  const files = [];
  for (const f of await db.all('files')) files.push({ id: f.id, name: f.name, type: f.type, size: f.size, b64: await blobToB64(f.blob) });
  const payload = { app: 'MeryCon', version: 1, appVersion: APP_VERSION, exportedAt: new Date().toISOString(), data, files };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const ok = await shareFile(blob, `MeryCon-copia-${today()}.json`);
  if (ok) await db.setKv('lastBackup', new Date().toISOString());
  return ok;
}
async function importBackup(file, mode) {
  const txt = await file.text();
  let p; try { p = JSON.parse(txt); } catch { throw new Error('El archivo no es una copia válida de MeryCon.'); }
  if (!p || p.app !== 'MeryCon' || !p.data) throw new Error('El archivo no es una copia válida de MeryCon.');
  if (mode === 'replace') for (const s of STORES) await db.clear(s);
  for (const [s, arr] of Object.entries(p.data)) {
    if (!STORES.includes(s) || s === 'files' || !Array.isArray(arr)) continue;
    if (s === 'kv' && mode !== 'replace') {
      for (const item of arr) {
        if (item.key === 'profile') { const cur = await db.kv('profile', {}); await db.setKv('profile', Object.assign({}, item.value, cur)); }
        else if (item.key === 'lastBackup' || item.key === 'lastProgression') continue;
        else if ((await db.get('kv', item.key)) === undefined) await db.put('kv', item);
      }
      continue;
    }
    await db.putMany(s, arr);
  }
  for (const f of p.files || []) await db.put('files', { id: f.id, name: f.name, type: f.type, size: f.size, blob: b64ToBlob(f.b64, f.type) });
  return p;
}
