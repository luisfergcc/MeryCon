/* MeryCon — ejercicio: rutina, sesiones, biblioteca por niveles, progresión, pruebas funcionales */

const lvBadge = n => `<span class="level-badge lv${n}">N${n}</span>`;
function exFichaHtml(ex) {
  const F = [['Objetivo', 'objetivo'], ['Posición inicial', 'posicion'], ['Ejecución', 'ejecucion'], ['Repeticiones / tiempo', 'dosis'], ['Respiración', 'respiracion'], ['Sensaciones esperadas', 'esperadas'], ['Señales para PARAR', 'parar', 'stop'], ['Errores comunes', 'errores'], ['Adaptación más fácil', 'facil'], ['Progresión futura', 'progresion']];
  return `<dl class="ex-meta">${F.filter(f => ex[f[1]]).map(f => `<dt class="${f[2] || ''}">${f[0]}</dt><dd>${nl2br(ex[f[1]])}</dd>`).join('')}</dl>`;
}
function showFicha(ex) {
  sheet(ex.nombre, `<div><div class="chips" style="margin-bottom:6px">${lvBadge(ex.nivel)}<span class="chip">${esc(BLOQUES[ex.bloque] || 'Otros')}</span>${ex.fisio ? '<span class="chip yellow">Consultar con la fisio</span>' : ''}${ex.custom ? '<span class="chip blue">Pautado por la fisio</span>' : ''}</div>${exFichaHtml(ex)}</div>`);
}

Views.ejercicio = async () => {
  const [es, sessions, walks, tests, prof] = await Promise.all([exerciseState(), db.all('sessions'), db.all('walks'), db.all('tests'), getProfile()]);
  const { lib, info, routine } = es;
  const rEx = routine.map(id => lib.find(e => e.id === id)).filter(Boolean);
  const mins = Math.round(rEx.reduce((a, e) => a + (e.min || 1.5), 0));
  const ws = await walkSuggestion();
  const lastWalks = sortBy(walks, w => w.fecha + (w.hora || ''), true).slice(0, 3);
  const lastTest = sortBy(tests, x => x.fecha, true)[0];
  const due = lastTest ? addDays(lastTest.fecha, 14) : today();
  const lastSess = sortBy(sessions, s => s.fecha, true)[0];
  const node = el(`<div>
    ${largeHead('Ejercicio')}
    <div class="card">
      <div class="card-head" style="color:var(--green)">${I.dumbbell}<span>Rutina actual</span><span class="meta">~${mins} min</span></div>
      <div class="small muted" style="margin-bottom:6px">${lastSess ? `Última sesión: ${relDay(lastSess.fecha).toLowerCase()}` : 'Aún no hay sesiones registradas'}</div>
    </div>
    <div class="list" style="margin-top:-6px">${rEx.map(e => `<button class="row" data-push="exerciseView" data-p="${P({ id: e.id })}">${lvBadge(e.nivel)}<div class="grow"><div class="title ellipsis">${esc(e.nombre)}</div><div class="sub">${esc(e.dosis || '')}</div></div>${info[e.id]?.ready ? '<span class="chip purple">Listo</span>' : ''}<span class="chev">${I.chev}</span></button>`).join('') || '<div class="row muted">La rutina está vacía</div>'}</div>
    <div class="btn-row"><button class="btn green" data-push="sessionForm" data-p="${P({ date: today() })}">Registrar sesión</button><button class="btn secondary" data-push="routineEdit">Editar rutina</button></div>
    <div class="footnote" style="margin-bottom:8px">Si el semáforo de hoy es amarillo, haz solo los ejercicios sentada/tumbada; si es rojo, no hagas la rutina.</div>

    <div class="section"><div class="section-head"><h2>Caminata</h2><button class="link" id="wt">Objetivo</button></div>
      <div class="card"><div class="card-head" style="color:var(--orange)">${I.walk}<span>Objetivo actual</span></div>
        <div class="big-num">${ws.target}<small>min</small></div>
        ${ws.suggest ? `<div class="small" style="margin-top:4px">Las 3 últimas caminatas fueron bien. Se podría subir a <b>${ws.suggest} min</b>. <button class="link" style="color:var(--blue)" id="apply">Aplicar</button></div>` : '<div class="small muted">Sube 1-2 min cuando varias caminatas seguidas salgan en verde y sin empeorar al día siguiente.</div>'}
      </div>
      ${lastWalks.length ? `<div class="list">${lastWalks.map(w => rowLink('walkForm', { id: w.id }, `${w.duracion} min · ${w.lugar === 'dentro' ? 'en casa' : 'fuera'}`, `${relDay(w.fecha)}${w.hora ? ' · ' + esc(w.hora) : ''}`, w.semaforo ? `<span class="dot ${w.semaforo}"></span>` : '')).join('')}</div>` : ''}
      <button class="btn tinted" data-push="walkForm" data-p="${P({ date: today() })}">${I.plus}<span>Registrar caminata</span></button>
    </div>

    <div class="section"><div class="section-head"><h2>Pruebas funcionales</h2><button class="link" data-push="testsHistory">Historial</button></div>
      <div class="card"><div class="card-head" style="color:var(--indigo)">${I.ruler}<span>Cada 14 días</span><span class="meta">${lastTest ? 'Última ' + relDay(lastTest.fecha).toLowerCase() : 'Sin mediciones'}</span></div>
        <div class="small">${due <= today() ? '<b>Toca hacerlas.</b> ' : `Próximas: ${fmtLong(due)}. `}Silla 30 s, tolerancias, equilibrio con apoyo, escalones, autonomía y peso.</div></div>
      <button class="btn tinted" data-push="testForm">${I.plus}<span>Hacer pruebas</span></button>
    </div>

    <div class="section"><div class="section-head"><h2>Biblioteca por niveles</h2></div>
      <div class="list">${[1, 2, 3, 4, 5].map(n => { const exs = lib.filter(e => e.nivel === n); const dom = exs.filter(e => info[e.id].estado === 'dominado').length; const disp = exs.filter(e => info[e.id].estado === 'disponible').length; return `<button class="row" data-push="library" data-p="${P({ nivel: n })}">${lvBadge(n)}<div class="grow"><div class="title">${LEVELS[n].nombre}</div><div class="sub">${dom} dominados · ${disp} disponibles · ${exs.length - dom - disp} bloqueados</div></div><span class="chev">${I.chev}</span></button>`; }).join('')}</div>
      <div class="footnote">Un ejercicio se considera <b>listo para progresar</b> con 6 sesiones en "Sí" en las últimas 3 semanas, sin síntomas y sin peor respuesta a las 24 h. Al marcarlo como dominado se desbloquea el siguiente. <b>Un cambio cada vez</b> (máximo uno por semana). Lo que indique la fisio tiene prioridad.</div>
      <button class="btn secondary" style="margin-top:10px" data-push="exerciseForm">${I.plus}<span>Añadir ejercicio pautado por la fisio</span></button>
    </div>
  </div>`);
  const setTarget = async v => { const p = await getProfile(); p.walkTarget = v; await db.setKv('profile', p); toast(`Objetivo: ${v} min`); render(window.scrollY); };
  $('#wt', node).addEventListener('click', () => {
    const tmp = { v: ws.target };
    sheet('Objetivo de caminata', `<div><div class="list"><div class="field inline"><label>Minutos</label><input type="number" inputmode="numeric" name="v"></div></div><button class="btn" id="ok">Guardar</button></div>`, (s, close) => { bindForm(s, tmp); $('#ok', s).addEventListener('click', () => { if (num(tmp.v)) { close(); setTarget(num(tmp.v)); } }); });
  });
  const ap = $('#apply', node); if (ap) ap.addEventListener('click', () => setTarget(ws.suggest));
  return node;
};

/* ---------- Sesión de rutina ---------- */
Views.sessionForm = async ({ id, date }) => {
  const es = await exerciseState();
  const existing = id ? await db.get('sessions', id) : null;
  const d = existing ? existing.fecha : (date || today());
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: d, items: {}, sint: {} };
  state.items = state.items || {}; state.sint = state.sint || {};
  const ids = existing ? [...new Set([...Object.keys(state.items), ...es.routine])] : es.routine;
  const exs = ids.map(i => es.lib.find(e => e.id === i)).filter(Boolean);
  const check = await db.get('checks', d);
  const node = el(`<div>
    ${navbar(existing ? 'Sesión' : 'Nueva sesión', saveBtn())}
    ${check ? lightHtml(evaluate(check, await getProfile()), true) : `<div class="banner warn small">No hay check para este día. Antes de la rutina, comprueba que no hay señales de alarma. <button class="link" style="color:var(--blue)" data-push="checkForm" data-p="${P({ date: d })}">Hacer check</button></div>`}
    <div class="list"><div class="field inline"><label>Fecha</label><input type="date" name="fecha" max="${today()}"></div></div>
    <div class="caption" style="margin-top:14px">Ejercicios · toca el nombre para ver la ficha</div>
    <div class="list">${exs.map(e => `<div class="field"><button type="button" class="label" data-ficha="${e.id}" style="text-align:left;display:flex;gap:8px;align-items:center">${lvBadge(e.nivel)}<span>${esc(e.nombre)}</span></button>
      ${segHtml('items.' + e.id, [['si', 'Sí'], ['parcial', 'Parcial'], ['no', 'No']], 'done sm')}
      <label class="check-row" style="padding:8px 0 0"><input type="checkbox" name="sint.${e.id}"><span class="box" style="width:20px;height:20px"></span><span class="txt small">Produjo síntomas</span></label></div>`).join('')}</div>
    <div class="list" style="margin-top:14px">
      <div class="field"><label>Cómo fue durante</label><textarea name="durante" placeholder="Molestias, qué ejercicio, qué notó"></textarea></div>
      <div class="field"><label>Respuesta a las 24 h</label><div class="hint">Se rellena al día siguiente. La progresión depende de esto, no solo de cómo se sintió durante.</div>${segHtml('resp24', [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor']])}
        <div style="margin-top:8px"><textarea name="resp24txt" placeholder="Cómo se encontró al día siguiente"></textarea></div></div>
      <div class="field"><label>Notas</label><textarea name="notas"></textarea></div>
    </div>
    <div class="card small" id="adh"></div>
    <button class="btn" data-save>Guardar sesión</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar sesión</button>` : ''}
  </div>`);
  const upd = () => { const done = exs.filter(e => state.items[e.id] === 'si').length; $('#adh', node).innerHTML = `<div class="card-head">Adherencia<span class="meta">${done}/${exs.length}</span></div><div class="bar"><i style="width:${exs.length ? Math.round(done / exs.length * 100) : 0}%"></i></div>`; };
  bindForm(node, state, upd); upd();
  $$('[data-ficha]', node).forEach(b => b.addEventListener('click', () => showFicha(es.lib.find(e => e.id === b.dataset.ficha))));
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!Object.values(state.items).some(Boolean)) return alert('Marca al menos un ejercicio (Sí, Parcial o No).');
    const c = await db.get('checks', state.fecha);
    state.semaforo = c ? c.semaforo : null;
    for (const k of Object.keys(state.items)) if (!state.items[k]) delete state.items[k];
    state.updatedAt = new Date().toISOString();
    await db.put('sessions', state); toast('Sesión guardada'); pop();
  }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar esta sesión?')) { await db.del('sessions', state.id); pop(); } });
  return node;
};

/* ---------- Biblioteca ---------- */
Views.library = async ({ nivel }) => {
  const es = await exerciseState();
  const exs = es.lib.filter(e => e.nivel === nivel);
  const node = el(`<div>${navbar('Nivel ' + nivel)}
    <div class="large-head" style="padding-top:4px"><div><div class="date">Nivel ${nivel}</div><h1 class="large-title">${LEVELS[nivel].nombre}</h1></div></div>
    <div class="banner small">${esc(LEVELS[nivel].desc)}</div>
    <div class="list">${exs.map(e => {
      const st = es.info[e.id]; const prev = e.previo ? es.lib.find(x => x.id === e.previo) : null;
      const sub = st.estado === 'dominado' ? '✓ Dominado' : st.estado === 'bloqueado' ? `Se desbloquea al dominar: ${esc(prev?.nombre || '')}` : st.enRutina ? 'En la rutina' : 'Disponible';
      return `<button class="row ${st.estado === 'bloqueado' ? 'locked' : ''}" data-push="exerciseView" data-p="${P({ id: e.id })}"><span class="ico" style="background:${st.estado === 'dominado' ? 'var(--green)' : st.estado === 'bloqueado' ? 'var(--text-3)' : 'var(--blue)'}">${st.estado === 'dominado' ? I.check : st.estado === 'bloqueado' ? I.lock : I.dumbbell}</span><div class="grow"><div class="title">${esc(e.nombre)}</div><div class="sub">${sub}</div></div>${st.ready ? '<span class="chip purple">Listo</span>' : ''}${e.fisio ? '<span class="chip yellow">Fisio</span>' : ''}<span class="chev">${I.chev}</span></button>`;
    }).join('')}</div></div>`);
  return node;
};

Views.exerciseView = async ({ id }) => {
  const es = await exerciseState();
  const ex = es.lib.find(e => e.id === id);
  if (!ex) return el(`<div>${navbar('Ejercicio')}<div class="empty">No encontrado</div></div>`);
  const st = es.info[id];
  const prev = ex.previo ? es.lib.find(x => x.id === ex.previo) : null;
  const nexts = nextOf(es.lib, id);
  const node = el(`<div>${navbar('Ejercicio')}
    <div class="large-head" style="padding-top:4px"><div><div class="date">Nivel ${ex.nivel} · ${esc(BLOQUES[ex.bloque] || 'Otros')}</div><h1 class="large-title" style="font-size:28px">${esc(ex.nombre)}</h1></div></div>
    <div class="chips" style="margin-bottom:10px">
      <span class="chip ${st.estado === 'dominado' ? 'green' : st.estado === 'bloqueado' ? '' : 'blue'}">${st.estado === 'dominado' ? 'Dominado' : st.estado === 'bloqueado' ? 'Bloqueado' : 'Disponible'}</span>
      ${st.enRutina ? '<span class="chip green">En la rutina</span>' : ''}${st.ready ? '<span class="chip purple">Listo para progresar</span>' : ''}${ex.fisio ? '<span class="chip yellow">Consultar con la fisio antes</span>' : ''}${ex.custom ? '<span class="chip blue">Pautado por la fisio</span>' : ''}
    </div>
    ${st.estado === 'bloqueado' && prev ? `<div class="banner small">Se desbloquea al dominar <b>${esc(prev.nombre)}</b>.</div>` : ''}
    ${st.enRutina ? `<div class="card"><div class="card-head">Progreso hacia "dominado"<span class="meta">${Math.min(st.good, 6)}/6</span></div><div class="bar"><i style="width:${Math.min(100, st.good / 6 * 100)}%"></i></div><div class="small muted" style="margin-top:6px">Sesiones en "Sí", sin síntomas, en las últimas 3 semanas.</div></div>` : ''}
    <div class="card">${exFichaHtml(ex)}</div>
    ${nexts.length ? `<div class="caption" style="margin-top:14px">Siguiente paso</div><div class="list">${nexts.map(n => rowLink('exerciseView', { id: n.id }, n.nombre, `Nivel ${n.nivel}${n.fisio ? ' · consultar con la fisio' : ''}`)).join('')}</div>` : ''}
    <div class="stack" id="acts" style="margin-top:14px"></div>
  </div>`);
  const acts = $('#acts', node);
  const btn = (label, cls, fn) => { const b = el(`<button class="btn ${cls}">${label}</button>`); b.addEventListener('click', fn); acts.append(b); };
  const setRoutine = async r => { await db.setKv('routine', r); };
  if (st.estado !== 'bloqueado') {
    if (st.enRutina) btn('Quitar de la rutina', 'secondary', async () => { await setRoutine(es.routine.filter(x => x !== id)); toast('Quitado de la rutina'); render(window.scrollY); });
    else btn('Añadir a la rutina', 'tinted', async () => {
      if (ex.fisio && !confirm('Este ejercicio conviene confirmarlo con la fisio antes de empezarlo. ¿Lo añades?')) return;
      await setRoutine([...es.routine, id]); toast('Añadido a la rutina'); render();
    });
  }
  if (st.estado === 'disponible') btn('Marcar como dominado', 'green', async () => {
    if (!st.ready && !confirm('Todavía no cumple el criterio automático (6 sesiones bien, sin síntomas). ¿Marcarlo igualmente como dominado?')) return;
    if (!es.canProgress && !confirm(`Hace ${es.daysSinceProg} días que hiciste otro cambio. La recomendación es progresar una sola cosa cada vez. ¿Continuar?`)) return;
    await db.put('exstate', { id, estado: 'dominado', fecha: today() });
    await db.setKv('lastProgression', today());
    const nx = nextOf(es.lib, id);
    if (!nx.length) { toast('Marcado como dominado'); render(); return; }
    sheet('Siguiente paso', `<div><p class="small muted" style="margin:0 2px 12px">Se ha desbloqueado. Puedes sustituirlo en la rutina (un cambio cada vez) o mantener el actual.</p>
      <div class="list">${nx.map(n => `<div class="row"><div class="grow"><div class="title">${esc(n.nombre)}</div><div class="sub">Nivel ${n.nivel}${n.fisio ? ' · consultar con la fisio' : ''}</div></div><button class="btn sm" style="width:auto" data-swap="${n.id}">Sustituir</button></div>`).join('')}</div>
      <button class="btn secondary" id="keep">Mantener la rutina como está</button></div>`, (s, close) => {
      $$('[data-swap]', s).forEach(b => b.addEventListener('click', async () => { const r = es.routine.map(x => x === id ? b.dataset.swap : x); await setRoutine(r); close(); toast('Rutina actualizada'); render(window.scrollY); }));
      $('#keep', s).addEventListener('click', () => { close(); render(window.scrollY); });
    });
  });
  if (st.estado === 'dominado') btn('Desmarcar "dominado"', 'secondary', async () => { await db.del('exstate', id); toast('Desmarcado'); render(window.scrollY); });
  if (st.estado === 'bloqueado') btn('Desbloquear (indicado por la fisio)', 'secondary', async () => { if (!confirm('¿La fisio ha indicado empezar este ejercicio?')) return; await db.put('exstate', { id, estado: 'desbloqueado', fecha: today() }); toast('Desbloqueado'); render(window.scrollY); });
  if (ex.custom) {
    btn('Editar ejercicio', 'secondary', () => push('exerciseForm', { id }));
    btn('Eliminar ejercicio', 'danger', async () => { if (!confirm('¿Eliminar este ejercicio?')) return; await db.del('exercises', id); await setRoutine(es.routine.filter(x => x !== id)); pop(); });
  }
  return node;
};

Views.exerciseForm = async ({ id }) => {
  const existing = id ? await db.get('exercises', id) : null;
  const state = existing ? structuredClone(existing) : { id: 'x' + uid(), nivel: 1, bloque: 'otros', fuente: 'fisio', fecha: today() };
  const F = [['nombre', 'Nombre', 'input'], ['objetivo', 'Objetivo'], ['posicion', 'Posición inicial'], ['ejecucion', 'Ejecución'], ['dosis', 'Repeticiones / tiempo', 'input'], ['respiracion', 'Respiración', 'input'], ['esperadas', 'Sensaciones esperadas'], ['parar', 'Señales para PARAR'], ['errores', 'Errores comunes'], ['facil', 'Adaptación más fácil'], ['progresion', 'Progresión futura']];
  const node = el(`<div>${navbar(existing ? 'Editar ejercicio' : 'Nuevo ejercicio', saveBtn())}
    <div class="banner small">Para ejercicios que pauta la fisioterapeuta. Copia sus indicaciones tal cual.</div>
    <div class="list">${F.map(([k, l, t]) => `<div class="field"><label>${l}</label>${t === 'input' ? `<input type="text" name="${k}">` : `<textarea name="${k}"></textarea>`}</div>`).join('')}
      <div class="field"><label>Nivel</label>${segHtml('nivel', [1, 2, 3, 4, 5].map(n => [n, 'N' + n]))}</div>
      <div class="field inline"><label>Minutos aprox.</label><input type="number" inputmode="decimal" name="min"></div>
      <div class="field inline"><label>Fecha de pauta</label><input type="date" name="fecha"></div></div>
    <button class="btn" data-save>Guardar</button></div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!state.nombre) return alert('Ponle un nombre.');
    state.nivel = +state.nivel || 1;
    await db.put('exercises', state);
    if (!existing) { const r = await getRoutine(); if (confirm('¿Añadirlo también a la rutina?')) await db.setKv('routine', [...r, state.id]); }
    toast('Guardado'); pop();
  }));
  return node;
};

Views.routineEdit = async () => {
  const es = await exerciseState();
  const avail = sortBy(es.lib.filter(e => es.info[e.id].estado !== 'bloqueado'), e => e.nivel * 100 + (e.orden || 50));
  const sel = new Set(es.routine);
  const node = el(`<div>${navbar('Editar rutina', saveBtn())}
    <div class="card small" id="tot"></div>
    <div class="footnote" style="margin:-4px 0 12px">La rutina inicial no debería pasar de ~10 minutos salvo indicación de la fisio. Solo aparecen ejercicios desbloqueados.</div>
    ${[1, 2, 3, 4, 5].map(n => { const xs = avail.filter(e => e.nivel === n); return xs.length ? `<div class="caption">Nivel ${n} · ${LEVELS[n].nombre}</div><div class="list">${xs.map(e => `<label class="check-row"><input type="checkbox" data-id="${e.id}" ${sel.has(e.id) ? 'checked' : ''}><span class="box"></span><span class="txt">${esc(e.nombre)}<small>${esc(e.dosis || '')}${e.fisio ? ' · consultar con la fisio' : ''}</small></span></label>`).join('')}</div>` : ''; }).join('')}
  </div>`);
  const upd = () => { const m = Math.round(avail.filter(e => sel.has(e.id)).reduce((a, e) => a + (e.min || 1.5), 0)); $('#tot', node).innerHTML = `<div class="card-head">Duración estimada<span class="meta" style="${m > 12 ? 'color:var(--red)' : ''}">~${m} min · ${sel.size} ejercicios</span></div>`; };
  $$('input[data-id]', node).forEach(i => i.addEventListener('change', () => { i.checked ? sel.add(i.dataset.id) : sel.delete(i.dataset.id); upd(); }));
  upd();
  onSave(node, async () => { const order = avail.map(e => e.id).filter(x => sel.has(x)); await db.setKv('routine', order); toast('Rutina guardada'); pop(); });
  return node;
};

/* ---------- Pruebas funcionales ---------- */
Views.testForm = async ({ id }) => {
  const existing = id ? await db.get('tests', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: today(), valores: {}, extras: {}, autonomia: {} };
  const node = el(`<div>${navbar(existing ? 'Pruebas' : 'Nuevas pruebas', saveBtn())}
    <div class="banner small"><b>Seguridad:</b> solo en día verde, despierta y alerta (nunca tras la medicación de la noche), con alguien al lado y un apoyo estable cerca. Deja en blanco lo que no se haga.</div>
    <div class="list"><div class="field inline"><label>Fecha</label><input type="date" name="fecha" max="${today()}"></div></div>
    ${['Fuerza', 'Tolerancia', 'Equilibrio', 'Escalones', 'Peso'].map(g => `<div class="caption" style="margin-top:16px">${g}</div><div class="list">${TESTS.filter(x => x.grupo === g).map(x => `
      <div class="field"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><label style="margin:0">${esc(x.nombre)}${x.fisio ? ' <span class="chip yellow">Fisio</span>' : ''}</label>
        <div style="display:flex;align-items:center;gap:6px;flex:none"><input type="number" inputmode="decimal" step="${x.step || 1}" name="valores.${x.id}" style="width:84px;text-align:right" placeholder="–"><span class="muted small">${esc(x.unidad)}</span></div></div>
        <details style="margin-top:6px"><summary class="small" style="color:var(--blue)">Cómo se hace</summary><div class="small muted" style="margin-top:4px">${esc(x.como)}</div></details>
        ${x.extra ? `<div style="margin-top:8px">${segHtml('extras.' + x.extra.key, x.extra.opts, 'sm')}</div>` : ''}</div>`).join('')}</div>`).join('')}
    <div class="caption" style="margin-top:16px">Autonomía · dificultad (0 ninguna – 10 no puede)</div>
    <div class="list">${AUTONOMY.map(a => `<div class="field"><label>${esc(a.nombre)}</label>${scaleHtml('autonomia.' + a.id, 'Ninguna', 'No puede')}</div>`).join('')}</div>
    <div class="caption" style="margin-top:16px">Respuesta</div>
    <div class="list">
      <div class="field"><label>Dolor antes de las pruebas</label>${scaleHtml('dolorAntes')}</div>
      <div class="field"><label>Dolor al terminar</label>${scaleHtml('dolorDespues')}</div>
      <div class="field"><label>Notas</label><textarea name="notas" placeholder="Cómo se encontró, si algo le costó especialmente…"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar pruebas</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar</button>` : ''}
  </div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    for (const k of Object.keys(state.valores)) if (state.valores[k] === null || state.valores[k] === '') delete state.valores[k];
    state.updatedAt = new Date().toISOString();
    await db.put('tests', state);
    if (state.valores.peso) { const p = await getProfile(); p.peso = state.valores.peso; await db.setKv('profile', p); }
    toast('Pruebas guardadas'); pop();
  }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar estas pruebas?')) { await db.del('tests', state.id); pop(); } });
  return node;
};

Views.testsHistory = async () => {
  const tests = sortBy(await db.all('tests'), t => t.fecha);
  const node = el(`<div>${navbar('Pruebas funcionales')}
    <div class="large-head" style="padding-top:4px"><h1 class="large-title" style="font-size:28px">Comparativa</h1></div>
    <div id="cmp"></div>
    <div class="section"><div class="section-head"><h2>Evolución</h2></div><div id="charts"></div></div>
    <div class="section"><div class="section-head"><h2>Registros</h2></div>
      <div class="list">${tests.slice().reverse().map(t => rowLink('testForm', { id: t.id }, fmtLong(t.fecha), `${Object.keys(t.valores || {}).length} mediciones`)).join('') || '<div class="row muted">Sin registros</div>'}</div></div>
  </div>`);
  if (!tests.length) { $('#cmp', node).innerHTML = `<div class="empty">${I.ruler}Todavía no hay pruebas registradas.</div>`; return node; }
  const first = tests[0], last = tests.at(-1), prev = tests.length > 1 ? tests.at(-2) : null;
  const rows = TESTS.map(x => {
    const vals = tests.filter(t => t.valores && t.valores[x.id] != null);
    if (!vals.length) return '';
    const f = vals[0].valores[x.id], l = vals.at(-1).valores[x.id];
    const d = l - f; const good = x.mejor === 'mas' ? d > 0 : x.mejor === 'menos' ? d < 0 : null;
    return `<tr><td>${esc(x.corto)}<div class="tiny muted">${esc(x.unidad)}</div></td><td class="num">${round1(f)}<div class="tiny muted">${fmtShort(vals[0].fecha)}</div></td><td class="num"><b>${round1(l)}</b><div class="tiny muted">${fmtShort(vals.at(-1).fecha)}</div></td><td class="num ${d === 0 || good === null ? '' : good ? 'delta-up' : 'delta-down'}">${vals.length > 1 ? (d > 0 ? '+' : '') + round1(d) : '–'}</td></tr>`;
  }).join('');
  const arows = AUTONOMY.map(a => {
    const vals = tests.filter(t => t.autonomia && t.autonomia[a.id] != null); if (!vals.length) return '';
    const f = vals[0].autonomia[a.id], l = vals.at(-1).autonomia[a.id], d = l - f;
    return `<tr><td>${esc(a.nombre)}</td><td class="num">${f}</td><td class="num"><b>${l}</b></td><td class="num ${d < 0 ? 'delta-up' : d > 0 ? 'delta-down' : ''}">${vals.length > 1 ? (d > 0 ? '+' : '') + d : '–'}</td></tr>`;
  }).join('');
  $('#cmp', node).innerHTML = `<div class="card"><table class="table"><thead><tr><th>Prueba</th><th class="num">Inicio</th><th class="num">Última</th><th class="num">Cambio</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${arows ? `<div class="card"><div class="card-head">Autonomía <span class="meta">dificultad 0-10, menos es mejor</span></div><table class="table"><thead><tr><th>Tarea</th><th class="num">Inicio</th><th class="num">Última</th><th class="num">Cambio</th></tr></thead><tbody>${arows}</tbody></table></div>` : ''}
    <div class="footnote">Verde = mejora; rojo = empeora. Compara siempre con la línea base y mira la tendencia, no una sola medición.</div>`;
  node._after = () => {
    const box = $('#charts', node);
    TESTS.forEach(x => {
      const pts = tests.filter(t => t.valores && t.valores[x.id] != null).map(t => ({ x: t.fecha, y: t.valores[x.id] }));
      if (pts.length < 2) return;
      const c = el(`<div class="card"><div class="card-head">${esc(x.nombre)}<span class="meta">${esc(x.unidad)}</span></div><div class="chart"></div></div>`);
      box.append(c);
      chart($('.chart', c), { series: [{ name: x.corto, color: 'var(--series-1)', points: pts }], from: pts[0].x, to: pts.at(-1).x, yMin: x.id === 'peso' ? null : 0, unit: x.unidad, height: 140, label: x.nombre });
    });
    if (!box.children.length) box.innerHTML = '<div class="card small muted">Las gráficas aparecen a partir de dos mediciones.</div>';
  };
  return node;
};
