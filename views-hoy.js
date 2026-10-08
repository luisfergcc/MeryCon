/* MeryCon — pantalla Hoy, check diario, caminatas, tomas de medicación */

Views.hoy = async () => {
  const t = today();
  const [prof, check, notices, meds, intake, checks, walks, sessions, appts] = await Promise.all([
    getProfile(), db.get('checks', t), getNotices(), db.all('meds'), db.get('intakes', t), db.all('checks'), db.all('walks'), db.all('sessions'), db.all('appts')
  ]);
  const ev = check ? evaluate(check, prof) : null;
  const active = activeMeds(meds, t);
  const node = el(`<div>
    ${largeHead('Hoy', fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' }), `<button class="icon-btn" data-push="ajustes" aria-label="Ajustes">${I.gear}</button>`)}
    ${ev ? `${lightHtml(ev)}<button class="btn secondary" data-push="checkForm" data-p="${P({ date: t })}">Ver / editar el check de hoy</button>`
      : `<button class="btn" style="background:var(--accent)" data-push="checkForm" data-p="${P({ date: t })}">${I.heart}<span>Hacer el check de hoy</span></button>`}
    <div id="notices" style="margin-top:10px"></div>
    <div class="section"><div class="quick">
      <button data-push="checkForm" data-p="${P({ date: t })}"><span class="qi" style="background:var(--accent)">${I.heart}</span>Check</button>
      <button data-push="walkForm" data-p="${P({ date: t })}"><span class="qi" style="background:var(--orange)">${I.walk}</span>Caminata</button>
      <button data-push="sessionForm" data-p="${P({ date: t })}"><span class="qi" style="background:var(--green)">${I.dumbbell}</span>Rutina</button>
      <button data-push="intakesForm" data-p="${P({ date: t })}"><span class="qi" style="background:var(--teal)">${I.pill}</span>Tomas</button>
    </div></div>
    <div class="section"><div class="section-head"><h2>Tomas de hoy</h2><button class="link" data-push="intakesForm" data-p="${P({ date: t })}">Abrir</button></div>
      <div id="tomas"></div></div>
    <div class="section"><div class="section-head"><h2>Últimos 7 días</h2><button class="link" data-push="historial">Historial</button></div>
      <div id="semana"></div></div>
    <div class="section" id="citas"></div>
  </div>`);

  // Avisos
  const nb = $('#notices', node);
  notices.forEach(n => {
    const b = el(`<button class="notice"><span class="ni" style="background:${n.color}">${n.icon}</span><div><b>${esc(n.title)}</b><span>${esc(n.sub || '')}</span></div></button>`);
    b.addEventListener('click', () => n.tab ? goTab(n.tab) : push(...n.push));
    nb.append(b);
  });

  // Tomas
  const tb = $('#tomas', node);
  if (!active.length) tb.innerHTML = `<div class="card small muted">No hay medicación registrada. Añádela en Ficha → Medicación.</div>`;
  else {
    const grid = el(`<div class="grid-2"></div>`);
    MOMENTOS.filter(m => m.id !== 'demanda').forEach(m => {
      const list = active.filter(x => x.momento === m.id); if (!list.length) return;
      const done = list.filter(x => intake && intake.tomas && intake.tomas[x.id]).length;
      const full = done === list.length;
      grid.append(el(`<button class="card tap" style="text-align:left" data-push="intakesForm" data-p="${P({ date: t })}"><div class="card-head" style="color:var(--teal)">${I.pill}<span>${m.nombre}</span></div><div class="big-num">${done}<small>/ ${list.length}</small></div><div class="small ${full ? '' : 'muted'}" style="${full ? 'color:var(--st-green-ink)' : ''}">${full ? 'Toma completa' : done ? 'Incompleta' : 'Sin marcar'}</div></button>`));
    });
    tb.append(grid);
    const dem = (intake && intake.extra) || [];
    if (dem.length) tb.append(el(`<div class="footnote">Según necesidad hoy: ${dem.map(d => esc(d.med) + (d.hora ? ' ' + esc(d.hora) : '')).join(', ')}</div>`));
  }

  // Semana
  const from = addDays(t, -6), prevFrom = addDays(t, -13), prevTo = addDays(t, -7);
  const inR = (d, a, b) => d >= a && d <= b;
  const wk = checks.filter(c => inR(c.fecha, from, t)), pw = checks.filter(c => inR(c.fecha, prevFrom, prevTo));
  const wWalks = walks.filter(w => inR(w.fecha, from, t)), pWalks = walks.filter(w => inR(w.fecha, prevFrom, prevTo));
  const sumMin = arr => arr.reduce((a, w) => a + (num(w.duracion) || 0), 0);
  const wSess = sessions.filter(s => inR(s.fecha, from, t));
  const aL = avg(wk.map(c => c.dolorLumbar)), pL = avg(pw.map(c => c.dolorLumbar));
  const aP = avg(wk.map(c => c.pasos)), pP = avg(pw.map(c => c.pasos));
  const delta = (a, b, lowerBetter) => { if (a == null || b == null) return ''; const d = a - b; if (Math.abs(d) < 0.05) return '<span class="muted small">= que la semana anterior</span>'; const good = lowerBetter ? d < 0 : d > 0; return `<span class="small ${good ? 'delta-up' : 'delta-down'}">${d > 0 ? '▲' : '▼'} ${round1(Math.abs(d))} vs semana anterior</span>`; };
  let strip = '';
  for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); const c = checks.find(x => x.fecha === d); strip += `<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><span class="dot ${c ? c.semaforo : 'none'}" style="width:14px;height:14px"></span><span class="tiny muted">${fmtDate(d, { weekday: 'narrow' })}</span></div>`; }
  $('#semana', node).append(el(`<div>
    <div class="card"><div class="card-head">Semáforo<span class="meta">${wk.length}/7 checks</span></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:6px">${strip}</div></div>
    <div class="grid-2">
      <div class="card"><div class="card-head" style="color:var(--red)">${I.heart}<span>Dolor lumbar</span></div><div class="big-num">${round1(aL)}<small>/10</small></div>${delta(aL, pL, true)}</div>
      <div class="card"><div class="card-head" style="color:var(--orange)">${I.walk}<span>Caminata</span></div><div class="big-num">${sumMin(wWalks)}<small>min</small></div>${wWalks.length || pWalks.length ? delta(sumMin(wWalks), sumMin(pWalks), false) : '<span class="small muted">Sin caminatas</span>'}</div>
      <div class="card"><div class="card-head" style="color:var(--orange)">${I.walk}<span>Pasos/día</span></div><div class="big-num">${aP == null ? '–' : Math.round(aP).toLocaleString('es-ES')}</div>${delta(aP, pP, false)}</div>
      <div class="card"><div class="card-head" style="color:var(--green)">${I.dumbbell}<span>Rutina</span></div><div class="big-num">${wSess.length}<small>sesiones</small></div><span class="small muted">Constancia antes que intensidad</span></div>
    </div></div>`));

  // Citas
  const next = sortBy(appts.filter(a => a.estado !== 'realizada' && a.fecha >= t), a => a.fecha).slice(0, 2);
  if (next.length) $('#citas', node).append(el(`<div><div class="section-head"><h2>Próximas citas</h2><button class="link" data-push="appts">Todas</button></div><div class="list">${next.map(a => rowLink('apptView', { id: a.id }, a.profesional || 'Cita', `${fmtLong(a.fecha)}${a.hora ? ' · ' + esc(a.hora) : ''}`, relDay(a.fecha), I.calendar, 'var(--blue)')).join('')}</div></div>`));
  return node;
};

function activeMeds(meds, date) { return meds.filter(m => (!m.desde || m.desde <= date) && (!m.hasta || m.hasta > date)); }

/* ---------- Check diario ---------- */
Views.checkForm = async ({ date }) => {
  const prof = await getProfile();
  const existing = await db.get('checks', date);
  const state = existing ? structuredClone(existing) : { id: date, fecha: date, alarmas: {} };
  const orig = date;
  const node = el(`<div>
    ${navbar(existing ? 'Check diario' : 'Nuevo check', saveBtn())}
    <div class="list"><div class="field inline"><label>Fecha</label><input type="date" name="fecha" max="${today()}"></div></div>
    <div class="footnote" style="margin:-4px 0 14px">Los valores se refieren a cómo está <b>hoy</b>; pasos y caminata, al <b>día anterior</b>.</div>

    <div class="caption">1 · Seguridad primero</div>
    <div class="list">
      <div class="field"><div class="label">¿Ha aparecido alguno de estos cambios respecto a lo habitual?</div><div class="hint">Si no hay ninguno, deja todo sin marcar.</div></div>
      ${ALARMS.map(a => `<label class="check-row alarm"><input type="checkbox" name="alarmas.${a.id}"><span class="box"></span><span class="txt">${esc(a.texto)}</span></label>`).join('')}
    </div>

    <div class="caption" style="margin-top:18px">2 · Dolor</div>
    <div class="list">
      <div class="field"><label>Dolor lumbar</label>${scaleHtml('dolorLumbar', 'Nada', 'Máximo')}</div>
      <div class="field"><label>Dolor de pierna / ciática</label>${scaleHtml('dolorPierna', 'Nada', 'Máximo')}
        <div style="margin-top:10px">${segHtml('ladoPierna', [['der', 'Derecha'], ['izq', 'Izquierda'], ['ambas', 'Ambas']], 'sm')}</div></div>
      <div class="field"><label>Otras zonas con dolor hoy</label><input type="text" name="otrasZonas" placeholder="Rodillas, cadera, espalda alta…"></div>
    </div>

    <div class="caption" style="margin-top:18px">3 · Cómo está</div>
    <div class="list">
      <div class="field"><label>Energía</label>${scaleHtml('energia', 'Sin energía', 'Mucha')}</div>
      <div class="field"><label>Somnolencia</label>${scaleHtml('somnolencia', 'Despierta', 'Muy dormida')}</div>
      <div class="field"><label>Mareo</label>${scaleHtml('mareo', 'Nada', 'Mucho')}</div>
      <div class="field"><label>Miedo a caerse</label>${scaleHtml('miedo', 'Ninguno', 'Máximo')}</div>
      <div class="field"><label>Ánimo</label>${scaleHtml('animo', 'Muy bajo', 'Muy bueno')}</div>
    </div>

    <div class="caption" style="margin-top:18px">4 · Sueño</div>
    <div class="list">
      <div class="field"><label>Calidad del sueño</label>${segHtml('sueno', [['buena', 'Buena'], ['regular', 'Regular'], ['mala', 'Mala']])}</div>
      <div class="field inline"><label>Horas aprox.</label><input type="number" inputmode="decimal" step="0.5" name="horasSueno" placeholder="–"></div>
      <div class="field"><label>¿Tomó la mirtazapina anoche?</label><div class="hint">Solo para relacionarlo con la somnolencia; no implica cambiar nada.</div>${segHtml('mirtazapina', [['si', 'Sí'], ['no', 'No']])}</div>
    </div>

    <div class="caption" style="margin-top:18px">5 · Actividad del día anterior</div>
    <div class="list">
      <div class="field inline"><label>Pasos</label><input type="number" inputmode="numeric" name="pasos" placeholder="–"></div>
      <div class="field inline"><label>Minutos caminando</label><input type="number" inputmode="numeric" name="minCaminando" placeholder="–"></div>
      <div class="field inline"><label>Horas sentada aprox.</label><input type="number" inputmode="decimal" step="0.5" name="horasSentada" placeholder="–"></div>
    </div>

    <div class="caption" style="margin-top:18px">6 · Síntomas y respuesta</div>
    <div class="list">
      <div class="field"><label>¿Algún síntoma neurológico nuevo?</label><div class="hint">Hormigueo distinto, adormecimiento, debilidad… (si es importante, márcalo arriba en seguridad).</div>${segHtml('neuro', [['no', 'No'], ['si', 'Sí']])}
        <div data-show="neuro=si" style="margin-top:8px"><textarea name="neuroTxt" placeholder="Qué, dónde, desde cuándo, cuánto duró"></textarea></div></div>
      <div class="field"><label>¿Cambios urinarios o intestinales?</label>${segHtml('urinario', [['no', 'No'], ['si', 'Sí']])}
        <div data-show="urinario=si" style="margin-top:8px"><textarea name="urinarioTxt" placeholder="Describe el cambio"></textarea></div></div>
      <div class="field"><label>Respuesta al último ejercicio</label>${segHtml('respEjercicio', [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor'], ['nohizo', 'No hizo']], 'sm')}</div>
      <div class="field"><label>¿Algún ejercicio produjo síntomas?</label><textarea name="ejSintomas" placeholder="Cuál y qué notó"></textarea></div>
      <div class="field"><label>Cómo se encontró en las horas posteriores</label><textarea name="horasPost"></textarea></div>
      <div class="field"><label>Observaciones</label><textarea name="obs"></textarea></div>
    </div>

    <div class="caption" style="margin-top:18px">Resultado</div>
    <div id="res"></div>
    <button class="btn" data-save style="margin-top:6px">Guardar check</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar este check</button>` : ''}
  </div>`);
  const upd = () => { $('#res', node).innerHTML = lightHtml(evaluate(state, prof)); };
  bindForm(node, state, upd); upd();
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!state.fecha) return alert('Indica la fecha.');
    if (state.fecha !== orig || !existing) {
      const other = await db.get('checks', state.fecha);
      if (other && state.fecha !== orig && !confirm(`Ya hay un check del ${fmtLong(state.fecha)}. ¿Sustituirlo?`)) return;
    }
    const ev = evaluate(state, prof);
    state.id = state.fecha; state.semaforo = ev.color; state.updatedAt = new Date().toISOString();
    await db.put('checks', state);
    if (existing && state.fecha !== orig) await db.del('checks', orig);
    toast(ev.color === 'rojo' ? 'Guardado · semáforo ROJO' : 'Check guardado');
    pop();
  }));
  const del = $('#del', node);
  if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar este check?')) { await db.del('checks', orig); toast('Eliminado'); pop(); } });
  return node;
};

/* ---------- Caminata ---------- */
Views.walkForm = async ({ id, date }) => {
  const existing = id ? await db.get('walks', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: date || today(), hora: nowTime(), lugar: 'fuera' };
  const node = el(`<div>
    ${navbar(existing ? 'Caminata' : 'Nueva caminata', saveBtn())}
    <div class="list">
      <div class="field inline"><label>Fecha</label><input type="date" name="fecha" max="${today()}"></div>
      <div class="field inline"><label>Hora</label><input type="time" name="hora"></div>
      <div class="field inline"><label>Duración (min)</label><input type="number" inputmode="decimal" name="duracion" placeholder="–"></div>
      <div class="field inline"><label>Distancia</label><input type="text" name="distancia" placeholder="p. ej. 500 m"></div>
      <div class="field"><label>Dónde</label>${segHtml('lugar', [['fuera', 'Fuera de casa'], ['dentro', 'Dentro de casa']])}</div>
    </div>
    <div class="caption" style="margin-top:18px">Dolor</div>
    <div class="list">
      <div class="field"><label>Dolor antes (lumbar o pierna, el mayor)</label>${scaleHtml('dolorAntes')}</div>
      <div class="field"><label>Dolor al terminar</label>${scaleHtml('dolorDespues')}</div>
    </div>
    <div class="caption" style="margin-top:18px">Síntomas</div>
    <div class="list">
      <div class="field"><label>Durante</label><textarea name="durante" placeholder="Qué notó y en qué minuto"></textarea></div>
      <div class="field"><label>Inmediatamente después</label><textarea name="despues"></textarea></div>
      <div class="field"><label>Unas horas después</label><textarea name="horasDespues"></textarea></div>
      <div class="field"><label>Al día siguiente</label>${segHtml('diaSig', [['mejor', 'Mejor'], ['igual', 'Igual'], ['peor', 'Peor']])}<div style="margin-top:8px"><textarea name="diaSigTxt" placeholder="Cómo amaneció"></textarea></div></div>
      <div class="field"><label>¿El dolor de pierna mejora al sentarse o inclinarse hacia delante?</label><div class="hint">Si se repite, es un patrón útil para la fisio y el médico.</div>${segHtml('mejoraSentarse', [['si', 'Sí'], ['no', 'No'], ['na', 'No aplica']])}</div>
    </div>
    <div class="caption" style="margin-top:18px">Valoración</div>
    <div class="list">
      <div class="field"><label>Semáforo de la caminata</label>${segHtml('semaforo', [['verde', 'Verde'], ['amarillo', 'Amarillo'], ['rojo', 'Rojo']])}</div>
      <div class="field"><label>Observaciones</label><textarea name="notas"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar caminata</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar</button>` : ''}
  </div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!num(state.duracion)) return alert('Indica la duración en minutos.');
    state.updatedAt = new Date().toISOString();
    await db.put('walks', state); toast('Caminata guardada'); pop();
  }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar esta caminata?')) { await db.del('walks', state.id); pop(); } });
  return node;
};

/* ---------- Tomas de medicación ---------- */
Views.intakesForm = async ({ date }) => {
  const d = date || today();
  const meds = activeMeds(await db.all('meds'), d);
  const existing = await db.get('intakes', d);
  const state = existing ? structuredClone(existing) : { id: d, fecha: d, tomas: {}, extra: [] };
  state.extra = state.extra || [];
  const node = el(`<div>
    ${navbar('Tomas', saveBtn())}
    <div class="list"><div class="field inline"><label>Fecha</label><input type="date" id="fd" value="${d}" max="${today()}"></div></div>
    <div class="banner small">Registro de lo que ha tomado. Para cambiar la pauta (por indicación médica) ve a Ficha → Medicación.</div>
    <div id="moms"></div>
    <div class="caption" style="margin-top:18px">Según necesidad</div>
    <div class="list" id="extra"></div>
    <div class="field" style="padding:0"><button class="btn tinted sm" id="addx">${I.plus}<span>Añadir toma puntual</span></button></div>
    <div class="list" style="margin-top:14px"><div class="field"><label>Notas</label><textarea name="notas" placeholder="Olvidos, efectos notados…"></textarea></div></div>
    <button class="btn" data-save>Guardar tomas</button>
  </div>`);
  $('#fd', node).addEventListener('change', e => { Nav.stack.at(-1).params.date = e.target.value; render(0); });
  const moms = $('#moms', node);
  if (!meds.length) moms.innerHTML = `<div class="empty">${I.pill}No hay medicación activa en esta fecha.<br><button class="btn tinted sm" style="margin-top:12px" data-push="meds">Ir a Medicación</button></div>`;
  MOMENTOS.filter(m => m.id !== 'demanda').forEach(m => {
    const list = meds.filter(x => x.momento === m.id); if (!list.length) return;
    const box = el(`<div><div class="caption" style="margin-top:14px;display:flex;justify-content:space-between"><span>${m.nombre}</span><button class="link" style="color:var(--blue);text-transform:none" data-all="${m.id}">Marcar toda</button></div>
      <div class="list">${list.map(x => `<label class="check-row"><input type="checkbox" name="tomas.${x.id}"><span class="box"></span><span class="txt">${esc(x.nombre)} <span class="muted">${esc(x.dosis || '')}</span></span></label>`).join('')}</div></div>`);
    moms.append(box);
  });
  bindForm(node, state);
  $$('[data-all]', node).forEach(b => b.addEventListener('click', () => {
    const ids = meds.filter(x => x.momento === b.dataset.all).map(x => x.id);
    const all = ids.every(i => state.tomas[i]);
    ids.forEach(i => { state.tomas[i] = !all; const inp = $(`input[name="tomas.${i}"]`, node); if (inp) inp.checked = !all; });
  }));
  const demanda = meds.filter(x => x.momento === 'demanda');
  const drawExtra = () => {
    const ex = $('#extra', node);
    ex.innerHTML = state.extra.length ? state.extra.map((x, i) => `<div class="row"><div class="grow"><div class="title">${esc(x.med)}</div><div class="sub">${esc(x.hora || '')}${x.motivo ? ' · ' + esc(x.motivo) : ''}</div></div><button class="nav-btn" data-rm="${i}" style="color:var(--red)">${I.trash}</button></div>`).join('') : `<div class="row muted small">Ninguna</div>`;
    $$('[data-rm]', ex).forEach(b => b.addEventListener('click', () => { state.extra.splice(+b.dataset.rm, 1); drawExtra(); }));
  };
  drawExtra();
  $('#addx', node).addEventListener('click', () => {
    const tmp = { med: demanda[0]?.nombre || 'Paracetamol', hora: nowTime(), motivo: '' };
    sheet('Toma puntual', `<div><div class="list">
      <div class="field"><label>Medicamento</label><input type="text" name="med" list="dl-dem"><datalist id="dl-dem">${demanda.map(x => `<option value="${esc(x.nombre)}">`).join('')}<option value="Paracetamol"></datalist></div>
      <div class="field inline"><label>Hora</label><input type="time" name="hora"></div>
      <div class="field"><label>Motivo</label><input type="text" name="motivo" placeholder="Más dolor lumbar…"></div></div>
      <button class="btn" id="ok">Añadir</button></div>`, (s, close) => {
      bindForm(s, tmp);
      $('#ok', s).addEventListener('click', () => { if (!tmp.med) return; state.extra.push({ ...tmp }); drawExtra(); close(); });
    });
  });
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { state.updatedAt = new Date().toISOString(); await db.put('intakes', state); toast('Tomas guardadas'); pop(); }));
  return node;
};
