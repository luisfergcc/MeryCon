/* MeryCon — documentos, ficha (perfil, medicación, citas, preguntas, clínica, fisio) y ajustes */

/* ================= DOCUMENTOS ================= */
const isImg = t => (t || '').startsWith('image/');
const isPdf = t => (t || '') === 'application/pdf';
Views.docs = async () => {
  const docs = sortBy(await db.all('docs'), d => d.fecha || '', true);
  const st = { cat: '', q: '' };
  const node = el(`<div>
    ${largeHead('Documentos', '', `<button class="icon-btn" data-push="docForm" aria-label="Añadir documento">${I.plus}</button>`)}
    <div class="list" style="margin-bottom:10px"><div class="field" style="padding:8px 12px"><input type="search" placeholder="Buscar en títulos y notas" id="q" style="background:var(--card-2);border-radius:10px;padding:8px 12px"></div></div>
    <div class="filter-row"><button data-c="" class="on">Todos</button>${DOC_CATS.filter(c => docs.some(d => d.categoria === c)).map(c => `<button data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div id="list"></div>
    <button class="btn tinted" data-push="docForm" style="margin-top:6px">${I.plus}<span>Añadir informe o documento</span></button>
    <div class="footnote">Guarda cada informe con la fecha del documento (no la de hoy). Nunca se sobrescriben: cada versión nueva es un documento nuevo.</div>
  </div>`);
  const draw = () => {
    const q = st.q.toLowerCase();
    const xs = docs.filter(d => (!st.cat || d.categoria === st.cat) && (!q || [d.titulo, d.literal, d.notas, d.profesional, d.novedades].join(' ').toLowerCase().includes(q)));
    $('#list', node).innerHTML = xs.length ? `<div class="list">${xs.map(d => rowLink('docView', { id: d.id }, d.titulo || 'Sin título', `${d.fecha ? fmtLong(d.fecha) : 'Sin fecha'} · ${esc(d.categoria || 'Otros')}${(d.fileIds || []).length ? ` · ${(d.fileIds || []).length} archivo(s)` : ''}`, '', I.doc, 'var(--blue)')).join('')}</div>` : `<div class="empty">${I.folder}${docs.length ? 'Nada coincide con el filtro.' : 'Aún no hay documentos. Añade la RM, informes, recetas o análisis.'}</div>`;
  };
  $('#q', node).addEventListener('input', e => { st.q = e.target.value; draw(); });
  $$('[data-c]', node).forEach(b => b.addEventListener('click', () => { st.cat = b.dataset.c; $$('[data-c]', node).forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw();
  return node;
};

Views.docForm = async ({ id }) => {
  const existing = id ? await db.get('docs', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: '', categoria: DOC_CATS[0], fileIds: [], origen: 'oficial' };
  state.fileIds = state.fileIds || [];
  const metas = [];
  for (const fid of state.fileIds) { const f = await db.get('files', fid); if (f) metas.push({ id: fid, name: f.name, type: f.type, url: isImg(f.type) ? URL.createObjectURL(f.blob) : null, saved: true }); }
  const node = el(`<div>${navbar(existing ? 'Editar documento' : 'Nuevo documento', saveBtn())}
    <div class="caption">Archivos</div>
    <div class="card"><div class="thumbs" id="thumbs"></div>
      <div class="btn-row" style="margin-bottom:0"><label class="btn tinted sm">${I.camera}<span>Hacer foto</span><input type="file" accept="image/*" capture="environment" hidden id="cam"></label>
      <label class="btn tinted sm">${I.doc}<span>Elegir archivo</span><input type="file" accept="image/*,application/pdf" multiple hidden id="pick"></label></div>
      <div class="tiny muted" style="margin-top:8px">Fotos grandes se reducen automáticamente para ahorrar espacio. Un informe de varias páginas puede llevar varias fotos.</div></div>
    <div class="caption" style="margin-top:14px">Datos del documento</div>
    <div class="list">
      <div class="field"><label>Título</label><input type="text" name="titulo" placeholder="p. ej. RM lumbar"></div>
      <div class="field inline"><label>Fecha del documento</label><input type="date" name="fecha"></div>
      <div class="field"><label>Categoría</label>${selectHtml('categoria', DOC_CATS)}</div>
      <div class="field"><label>Profesional / centro</label><input type="text" name="profesional"></div>
      <div class="field"><label>Tipo</label>${segHtml('origen', [['oficial', 'Informe oficial'], ['nota', 'Nota propia']])}</div>
    </div>
    <div class="caption" style="margin-top:14px">Contenido</div>
    <div class="list">
      <div class="field"><label>Qué dice (texto literal)</label><div class="hint">Copia las conclusiones tal cual, sin interpretar.</div><textarea name="literal" style="min-height:110px"></textarea></div>
      <div class="field"><label>Qué información nueva aporta</label><textarea name="novedades" placeholder="Comparado con documentos anteriores…"></textarea></div>
      <div class="field"><label>Interpretación / notas propias</label><div class="hint">Separado del texto literal. No son diagnósticos.</div><textarea name="notas"></textarea></div>
      <div class="field"><label>Preguntas que surgen</label><textarea name="preguntas" placeholder="Una por línea; puedes pasarlas a la lista de preguntas"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar documento</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar documento</button>` : ''}
  </div>`);
  bindForm(node, state);
  const removed = [];
  const drawThumbs = () => {
    const t = $('#thumbs', node);
    t.innerHTML = metas.map((m, i) => `<div class="th">${m.url ? `<img src="${m.url}" alt="">` : `<span>${isPdf(m.type) ? 'PDF' : 'Archivo'}<br><span class="tiny">${esc(m.name.slice(0, 18))}</span></span>`}<button class="x" data-rm="${i}" aria-label="Quitar">✕</button></div>`).join('') || '<div class="small muted" style="grid-column:1/-1">Sin archivos adjuntos</div>';
    $$('[data-rm]', t).forEach(b => b.addEventListener('click', () => { const m = metas.splice(+b.dataset.rm, 1)[0]; if (m.saved) removed.push(m.id); drawThumbs(); }));
  };
  drawThumbs();
  const addFiles = async files => {
    for (let f of files) {
      f = await shrinkImage(f);
      metas.push({ id: 'f' + uid(), name: f.name || 'archivo', type: f.type || 'application/octet-stream', url: isImg(f.type) ? URL.createObjectURL(f) : null, file: f });
    }
    if (!state.titulo && files[0]) { state.titulo = files[0].name.replace(/\.\w+$/, ''); $('[name=titulo]', node).value = state.titulo; }
    drawThumbs();
  };
  $('#cam', node).addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
  $('#pick', node).addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!state.titulo) return alert('Ponle un título.');
    if (!state.fecha && !confirm('No has puesto la fecha del documento. ¿Guardar igualmente?')) return;
    for (const m of metas.filter(m => m.file)) await db.put('files', { id: m.id, name: m.name, type: m.type, size: m.file.size, blob: m.file });
    for (const r of removed) await db.del('files', r);
    state.fileIds = metas.map(m => m.id);
    state.updatedAt = new Date().toISOString();
    await db.put('docs', state); toast('Documento guardado');
    if (existing) pop(); else { Nav.stack.pop(); push('docView', { id: state.id }); }
  }));
  const del = $('#del', node);
  if (del) del.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este documento y sus archivos? No se puede deshacer.')) return;
    for (const f of state.fileIds) await db.del('files', f);
    await db.del('docs', state.id); pop(2);
  });
  return node;
};

Views.docView = async ({ id }) => {
  const d = await db.get('docs', id);
  if (!d) return el(`<div>${navbar('Documento')}<div class="empty">No encontrado</div></div>`);
  const files = []; for (const fid of d.fileIds || []) { const f = await db.get('files', fid); if (f) files.push(f); }
  const node = el(`<div>${navbar('Documento', `<button class="nav-btn" data-push="docForm" data-p="${P({ id })}">Editar</button>`)}
    <div class="large-head" style="padding-top:4px"><div><div class="date">${d.fecha ? fmtLong(d.fecha) : 'Sin fecha'} · ${esc(d.categoria || '')}</div><h1 class="large-title" style="font-size:28px">${esc(d.titulo)}</h1></div></div>
    <div class="chips" style="margin-bottom:10px">${d.origen === 'nota' ? '<span class="chip">Nota propia</span>' : '<span class="chip green">Informe oficial</span>'}${d.profesional ? `<span class="chip">${esc(d.profesional)}</span>` : ''}${d.fecha && daysBetween(d.fecha, today()) > 365 ? `<span class="chip yellow">Antiguo (${Math.floor(daysBetween(d.fecha, today()) / 365)} año/s)</span>` : ''}</div>
    ${d.literal ? `<div class="caption">Texto literal</div><div class="card" style="font-size:15px;line-height:1.45">${nl2br(d.literal)}</div>` : ''}
    ${d.novedades ? `<div class="caption">Información nueva que aporta</div><div class="card" style="font-size:15px">${nl2br(d.novedades)}</div>` : ''}
    ${d.notas ? `<div class="caption">Interpretación / notas (no diagnóstico)</div><div class="card" style="font-size:15px">${nl2br(d.notas)}</div>` : ''}
    ${d.preguntas ? `<div class="caption">Preguntas que surgen</div><div class="card" style="font-size:15px">${nl2br(d.preguntas)}<button class="btn tinted sm" style="margin-top:10px" id="toq">Pasar a la lista de preguntas</button></div>` : ''}
    <div class="caption">Archivos (${files.length})</div>
    <div class="viewer stack" id="files"></div>
  </div>`);
  const box = $('#files', node);
  if (!files.length) box.innerHTML = '<div class="card small muted">Sin archivos adjuntos.</div>';
  files.forEach(f => {
    const url = URL.createObjectURL(f.blob);
    const item = el(`<div class="card" style="padding:10px"><div class="card-head"><span class="ellipsis">${esc(f.name)}</span><span class="meta">${fmtBytes(f.size || f.blob.size)}</span></div>
      ${isImg(f.type) ? `<img src="${url}" alt="${esc(f.name)}">` : isPdf(f.type) ? `<iframe src="${url}" title="${esc(f.name)}"></iframe>` : ''}
      <div class="btn-row" style="margin-bottom:0"><button class="btn secondary sm" data-open>Pantalla completa</button><button class="btn tinted sm" data-share>${I.share}<span>Compartir</span></button></div></div>`);
    $('[data-share]', item).addEventListener('click', () => shareFile(f.blob, f.name));
    $('[data-open]', item).addEventListener('click', () => openViewer(url, f));
    box.append(item);
  });
  const toq = $('#toq', node);
  if (toq) toq.addEventListener('click', async () => {
    const lines = d.preguntas.split('\n').map(s => s.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
    const para = { 'Traumatología': 'Traumatología', 'Neurocirugía': 'Neurocirugía', 'Neurología': 'Neurología', 'Fisioterapia': 'Fisioterapeuta', 'Atención primaria': 'Médico de familia' }[d.categoria] || 'Médico de familia';
    for (const t of lines) await db.put('questions', { id: uid(), texto: t, para, estado: 'pendiente', creada: today(), origen: d.titulo });
    toast(`${lines.length} pregunta(s) añadida(s) para ${para}`);
  });
  return node;
};

function openViewer(url, f) {
  const ov = el(`<div style="position:fixed;inset:0;z-index:70;background:#000;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:calc(env(safe-area-inset-top) + 6px) 12px 6px;color:#fff"><span class="ellipsis small" style="max-width:65vw">${esc(f.name)}</span><button class="nav-btn bold" style="color:#fff" id="cl">Cerrar</button></div>
    <div style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch;background:#111">${isImg(f.type) ? `<img src="${url}" style="width:100%;display:block" alt="">` : `<iframe src="${url}" style="width:100%;height:100%;border:0;background:#fff" title="${esc(f.name)}"></iframe>`}</div></div>`);
  $('#cl', ov).addEventListener('click', () => ov.remove());
  document.body.append(ov);
}

/* ================= FICHA ================= */
Views.ficha = async () => {
  const [prof, meds, appts, qs, clin, fisio] = await Promise.all([getProfile(), db.all('meds'), db.all('appts'), db.all('questions'), db.all('clinical'), db.all('fisio')]);
  const t = today();
  const act = activeMeds(meds, t);
  const next = sortBy(appts.filter(a => a.estado !== 'realizada' && a.fecha >= t), a => a.fecha)[0];
  const pend = qs.filter(q => q.estado !== 'respondida').length;
  const lastF = sortBy(fisio, f => f.fecha, true)[0];
  const node = el(`<div>
    ${largeHead('Ficha')}
    <button class="card tap" style="width:100%;text-align:left;display:flex;gap:14px;align-items:center" data-push="perfil">
      <span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#ff6b8b,#ff2d55);display:grid;place-items:center;color:#fff;flex:none">${I.person.replace('<svg', '<svg width="30" height="30"')}</span>
      <div class="grow" style="flex:1"><div style="font-size:20px;font-weight:700">${esc(prof.nombre || 'Perfil')}</div><div class="small muted">${[prof.edad ? prof.edad + ' años' : '', prof.altura ? prof.altura + ' m' : '', prof.peso ? prof.peso + ' kg' : ''].filter(Boolean).join(' · ') || 'Datos básicos y línea base'}</div></div><span class="chev" style="color:var(--text-3)">${I.chev}</span></button>
    <div class="caption" style="margin-top:16px">Seguimiento médico</div>
    <div class="list">
      ${rowLink('meds', {}, 'Medicación', `${act.length} activa(s)`, '', I.pill, 'var(--teal)')}
      ${rowLink('appts', {}, 'Citas', next ? `Próxima: ${esc(next.profesional || '')} · ${relDay(next.fecha).toLowerCase()}` : 'Sin citas próximas', '', I.calendar, 'var(--blue)')}
      ${rowLink('questions', {}, 'Preguntas para profesionales', `${pend} pendiente(s)`, '', I.question, 'var(--indigo)')}
    </div>
    <div class="caption" style="margin-top:16px">Información clínica</div>
    <div class="list">
      ${rowLink('clinical', {}, 'Diagnósticos, hallazgos e incertidumbres', `${clin.length} elementos`, '', I.cross, 'var(--red)')}
      ${rowLink('fisio', {}, 'Valoración fisioterapéutica', lastF ? `Actual: ${fmtLong(lastF.fecha)}` : 'Pendiente', '', I.stethoscope, 'var(--green)')}
      ${rowLink('alarmsRef', {}, 'Señales de alarma y semáforo', '', '', I.warn, 'var(--orange)')}
    </div>
    <div class="caption" style="margin-top:16px">App</div>
    <div class="list">${rowLink('ajustes', {}, 'Ajustes y copia de seguridad', '', '', I.gear, '#8e8e93')}</div>
  </div>`);
  return node;
};

Views.perfil = async () => {
  const state = await getProfile();
  const node = el(`<div>${navbar('Perfil', saveBtn())}
    <div class="list">
      <div class="field inline"><label>Nombre</label><input type="text" name="nombre"></div>
      <div class="field inline"><label>Edad</label><input type="number" inputmode="numeric" name="edad"></div>
      <div class="field inline"><label>Altura (m)</label><input type="number" inputmode="decimal" step="0.01" name="altura"></div>
      <div class="field inline"><label>Peso (kg)</label><input type="number" inputmode="decimal" step="0.1" name="peso"></div>
    </div>
    <div class="caption" style="margin-top:16px">Línea base (para comparar)</div>
    <div class="list">
      <div class="field inline"><label>Fecha de la línea base</label><input type="date" name="baseFecha"></div>
      <div class="field inline"><label>Dolor lumbar habitual</label><input type="number" inputmode="numeric" name="baseLumbar"></div>
      <div class="field inline"><label>Dolor de pierna habitual</label><input type="number" inputmode="numeric" name="basePierna"></div>
      <div class="field inline"><label>Miedo a caerse</label><input type="number" inputmode="numeric" name="baseMiedo"></div>
      <div class="field inline"><label>Pasos/día</label><input type="number" inputmode="numeric" name="basePasos"></div>
      <div class="field inline"><label>Caminata continua (min)</label><input type="number" inputmode="numeric" name="baseCaminata"></div>
      <div class="field inline"><label>De pie tolerado (min)</label><input type="number" inputmode="numeric" name="basePie"></div>
      <div class="field inline"><label>Horas sentada/día</label><input type="number" inputmode="decimal" name="baseSentada"></div>
      <div class="field"><label>Puede</label><textarea name="puede"></textarea></div>
      <div class="field"><label>Le cuesta</label><textarea name="cuesta"></textarea></div>
    </div>
    <div class="footnote">El semáforo se pone en amarillo cuando el dolor supera en 2 puntos el habitual.</div>
    <div class="caption" style="margin-top:16px">Objetivos</div>
    <div class="list">
      <div class="field inline"><label>Objetivo de pasos/día</label><input type="number" inputmode="numeric" name="objetivoPasos"></div>
      <div class="field inline"><label>Objetivo caminata (min)</label><input type="number" inputmode="numeric" name="walkTarget"></div>
      <div class="field"><label>Objetivos generales</label><textarea name="objetivos"></textarea></div>
      <div class="field"><label>Mejor momento para la actividad</label><textarea name="momento" placeholder="Despierta y alerta, antes de la medicación de la noche…"></textarea></div>
      <div class="field"><label>Qué le alivia</label><textarea name="alivia"></textarea></div>
      <div class="field"><label>Notas</label><textarea name="notas"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar</button></div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { await db.setKv('profile', state); toast('Perfil guardado'); pop(); }));
  return node;
};

/* ---------- Medicación ---------- */
function medTotals(list) {
  const by = {};
  list.filter(m => m.momento !== 'demanda').forEach(m => { const mg = /^\s*(\d+(?:[.,]\d+)?)\s*mg\s*$/i.exec(m.dosis || ''); const k = m.nombre.trim().toLowerCase(); (by[k] = by[k] || { nombre: m.nombre, n: 0, mg: 0, ok: true }); by[k].n++; if (mg) by[k].mg += +mg[1].replace(',', '.'); else by[k].ok = false; });
  return Object.values(by).filter(x => x.n > 1);
}
Views.meds = async () => {
  const all = await db.all('meds');
  const t = today();
  const act = activeMeds(all, t), past = sortBy(all.filter(m => m.hasta && m.hasta <= t), m => m.hasta, true);
  const totals = medTotals(act);
  const node = el(`<div>${navbar('Medicación', `<button class="nav-btn" data-push="medForm">${I.plus}</button>`)}
    <div class="banner small"><b>Solo registro.</b> No modificar, suspender ni cambiar dosis u horarios sin indicación médica. Cuando el médico cambie algo, usa "Registrar cambio de pauta" para conservar el histórico.</div>
    ${MOMENTOS.map(m => { const xs = act.filter(x => x.momento === m.id); return xs.length ? `<div class="caption" style="margin-top:14px">${m.nombre}</div><div class="list">${xs.map(x => rowLink('medForm', { id: x.id }, `${x.nombre} ${x.dosis || ''}`, `${x.estado === 'confirmada' ? '<span class="chip green">Confirmada por médico</span>' : '<span class="chip blue">Declarada</span>'} ${x.indicacion ? esc(x.indicacion) : ''}`)).join('')}</div>` : ''; }).join('') || `<div class="empty">${I.pill}No hay medicación registrada.</div>`}
    ${totals.length ? `<div class="caption" style="margin-top:14px">Total diario (tomas fijas)</div><div class="card small">${totals.map(x => `<div style="display:flex;justify-content:space-between;padding:3px 0"><span>${esc(x.nombre)}</span><b>${x.ok ? x.mg + ' mg/día' : x.n + ' tomas'}</b></div>`).join('')}</div>` : ''}
    <button class="btn tinted" data-push="medForm" style="margin-top:10px">${I.plus}<span>Añadir medicamento</span></button>
    ${past.length ? `<div class="caption" style="margin-top:18px">Histórico (ya no activas)</div><div class="list">${past.map(x => rowLink('medForm', { id: x.id }, `${x.nombre} ${x.dosis || ''}`, `${MOMENTOS.find(m => m.id === x.momento)?.nombre || ''} · ${x.desde ? fmtShort(x.desde) : '?'} → ${fmtShort(x.hasta)}${x.motivoFin ? ' · ' + esc(x.motivoFin) : ''}`)).join('')}</div>` : ''}
  </div>`);
  return node;
};

Views.medForm = async ({ id }) => {
  const existing = id ? await db.get('meds', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), momento: 'manana', estado: 'declarada', desde: today() };
  const ended = existing && existing.hasta && existing.hasta <= today();
  const node = el(`<div>${navbar(existing ? 'Medicamento' : 'Nuevo medicamento', ended ? '' : saveBtn())}
    ${ended ? `<div class="banner warn small">Pauta finalizada el ${fmtLong(existing.hasta)}${existing.motivoFin ? ': ' + esc(existing.motivoFin) : ''}. Se conserva como histórico.</div>` : ''}
    <div class="list">
      <div class="field"><label>Nombre</label><input type="text" name="nombre" placeholder="p. ej. Pregabalina"></div>
      <div class="field"><label>Dosis</label><input type="text" name="dosis" placeholder="p. ej. 100 mg"></div>
      <div class="field"><label>Momento</label>${segHtml('momento', MOMENTOS.map(m => [m.id, m.nombre]), 'sm')}</div>
      <div class="field"><label>Estado de la información</label>${segHtml('estado', [['declarada', 'Declarada'], ['confirmada', 'Confirmada por médico']], 'sm')}</div>
      <div class="field"><label>Para qué es (según el médico)</label><input type="text" name="indicacion"></div>
      <div class="field"><label>Prescrito por</label><input type="text" name="prescriptor"></div>
      <div class="field inline"><label>Desde</label><input type="date" name="desde"></div>
      <div class="field"><label>Notas</label><textarea name="notas" placeholder="Efectos notados, dudas para el médico/farmacéutico…"></textarea></div>
    </div>
    ${ended ? '' : `<button class="btn" data-save>${existing ? 'Guardar corrección' : 'Guardar'}</button>`}
    ${existing && !ended ? `<div class="footnote" style="margin-bottom:10px">"Guardar corrección" es para arreglar un error de escritura. Si el médico ha cambiado la pauta, usa:</div>
      <button class="btn secondary" id="chg">Registrar cambio de pauta (indicado por el médico)</button>
      <button class="btn danger" id="stop" style="margin-top:10px">Finalizar (indicado por el médico)</button>` : ''}
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Borrar registro (error)</button>` : ''}
  </div>`);
  bindForm(node, state);
  const ask = (title, cb) => {
    const tmp = { fecha: today(), motivo: '' };
    sheet(title, `<div><div class="list"><div class="field inline"><label>Fecha del cambio</label><input type="date" name="fecha"></div><div class="field"><label>Motivo / quién lo indicó</label><input type="text" name="motivo" placeholder="p. ej. Neurólogo, revisión"></div></div><button class="btn" id="ok">Confirmar</button></div>`, (s, close) => { bindForm(s, tmp); $('#ok', s).addEventListener('click', async () => { if (!tmp.fecha) return; close(); await cb(tmp); }); });
  };
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { if (!state.nombre) return alert('Indica el nombre.'); await db.put('meds', state); toast('Guardado'); pop(); }));
  const chg = $('#chg', node);
  if (chg) chg.addEventListener('click', () => ask('Cambio de pauta', async ({ fecha, motivo }) => {
    if (!state.nombre) return;
    await db.put('meds', Object.assign({}, existing, { hasta: fecha, motivoFin: 'Cambio de pauta' + (motivo ? ': ' + motivo : '') }));
    await db.put('meds', Object.assign({}, state, { id: uid(), desde: fecha, hasta: null, motivoFin: null, anterior: existing.id }));
    toast('Cambio registrado con histórico'); pop();
  }));
  const stop = $('#stop', node);
  if (stop) stop.addEventListener('click', () => ask('Finalizar medicamento', async ({ fecha, motivo }) => { await db.put('meds', Object.assign({}, existing, { hasta: fecha, motivoFin: motivo || 'Finalizado por indicación médica' })); toast('Finalizado'); pop(); }));
  const del = $('#del', node);
  if (del) del.addEventListener('click', async () => { if (confirm('Esto borra el registro por completo (solo si fue un error). Para cambios reales usa "Registrar cambio" o "Finalizar". ¿Borrar?')) { await db.del('meds', state.id); pop(); } });
  return node;
};

/* ---------- Citas ---------- */
Views.appts = async () => {
  const all = await db.all('appts'); const t = today();
  const next = sortBy(all.filter(a => a.estado !== 'realizada' && a.fecha >= t), a => a.fecha);
  const past = sortBy(all.filter(a => !(a.estado !== 'realizada' && a.fecha >= t)), a => a.fecha, true);
  const row = a => rowLink('apptView', { id: a.id }, a.profesional || 'Cita', `${fmtLong(a.fecha)}${a.hora ? ' · ' + esc(a.hora) : ''}${a.lugar ? ' · ' + esc(a.lugar) : ''}`, a.estado === 'realizada' ? '<span class="chip green">Hecha</span>' : a.fecha < t ? '<span class="chip yellow">Sin resultado</span>' : relDay(a.fecha));
  return el(`<div>${navbar('Citas', `<button class="nav-btn" data-push="apptForm">${I.plus}</button>`)}
    <div class="caption">Próximas</div><div class="list">${next.map(row).join('') || '<div class="row muted">Ninguna</div>'}</div>
    <button class="btn tinted" data-push="apptForm">${I.plus}<span>Nueva cita</span></button>
    ${past.length ? `<div class="caption" style="margin-top:18px">Anteriores</div><div class="list">${past.map(row).join('')}</div>` : ''}</div>`);
};
Views.apptForm = async ({ id }) => {
  const existing = id ? await db.get('appts', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: today(), estado: 'pendiente', profesional: PROFESIONALES[0] };
  const node = el(`<div>${navbar(existing ? 'Editar cita' : 'Nueva cita', saveBtn())}
    <div class="list">
      <div class="field"><label>Profesional</label>${selectHtml('profesional', PROFESIONALES)}</div>
      <div class="field"><label>Nombre / centro</label><input type="text" name="lugar" placeholder="Dr./Dra., hospital, centro de salud"></div>
      <div class="field inline"><label>Fecha</label><input type="date" name="fecha"></div>
      <div class="field inline"><label>Hora</label><input type="time" name="hora"></div>
      <div class="field"><label>Motivo</label><input type="text" name="motivo"></div>
      <div class="field"><label>Estado</label>${segHtml('estado', [['pendiente', 'Pendiente'], ['realizada', 'Realizada']])}</div>
    </div>
    <div class="caption" style="margin-top:16px">Resultado (tras la cita)</div>
    <div class="list">
      <div class="field"><label>Qué dijeron</label><textarea name="resumen" placeholder="Lo más literal posible"></textarea></div>
      <div class="field"><label>Cambios indicados (medicación, pruebas, ejercicio)</label><textarea name="cambios"></textarea></div>
      <div class="field"><label>Próximos pasos</label><textarea name="pasos"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar cita</button>` : ''}</div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { if (!state.fecha) return alert('Pon la fecha.'); await db.put('appts', state); toast('Cita guardada'); pop(); }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar la cita?')) { await db.del('appts', state.id); pop(2); } });
  return node;
};
Views.apptView = async ({ id }) => {
  const a = await db.get('appts', id);
  if (!a) return el(`<div>${navbar('Cita')}<div class="empty">No encontrada</div></div>`);
  const qs = (await db.all('questions')).filter(q => q.para === a.profesional);
  const pend = qs.filter(q => q.estado !== 'respondida');
  const node = el(`<div>${navbar('Cita', `<button class="nav-btn" data-push="apptForm" data-p="${P({ id })}">Editar</button>`)}
    <div class="large-head" style="padding-top:4px"><div><div class="date">${fmtDate(a.fecha, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${a.hora ? ' · ' + esc(a.hora) : ''}</div><h1 class="large-title" style="font-size:28px">${esc(a.profesional || 'Cita')}</h1></div></div>
    <div class="card small">${a.lugar ? `<div><b>Dónde:</b> ${esc(a.lugar)}</div>` : ''}${a.motivo ? `<div><b>Motivo:</b> ${esc(a.motivo)}</div>` : ''}<div><b>Estado:</b> ${a.estado === 'realizada' ? 'Realizada' : 'Pendiente'}</div></div>
    <div class="section-head" style="margin-top:14px"><h2 style="font-size:20px">Preguntas pendientes</h2><button class="link" data-push="questionForm" data-p="${P({ para: a.profesional })}">Añadir</button></div>
    <div class="list" id="ql"></div>
    ${a.estado === 'realizada' || a.resumen ? `<div class="caption" style="margin-top:14px">Resultado</div><div class="card" style="font-size:15px">${a.resumen ? `<p><b>Qué dijeron:</b><br>${nl2br(a.resumen)}</p>` : ''}${a.cambios ? `<p style="margin-top:8px"><b>Cambios:</b><br>${nl2br(a.cambios)}</p>` : ''}${a.pasos ? `<p style="margin-top:8px"><b>Próximos pasos:</b><br>${nl2br(a.pasos)}</p>` : ''}</div>` : `<button class="btn" data-push="apptForm" data-p="${P({ id })}" style="margin-top:12px">Registrar resultado de la cita</button>`}
  </div>`);
  const ql = $('#ql', node);
  ql.innerHTML = pend.length ? pend.map(q => `<div class="row"><div class="grow"><div class="title" style="white-space:normal">${esc(q.texto)}</div>${q.prioridad === 'alta' ? '<div class="sub" style="color:var(--red)">Prioritaria</div>' : ''}</div><button class="btn sm tinted" style="width:auto" data-ans="${q.id}">Responder</button></div>`).join('') : '<div class="row muted small">No hay preguntas pendientes para este profesional.</div>';
  $$('[data-ans]', ql).forEach(b => b.addEventListener('click', () => answerQuestion(b.dataset.ans)));
  return node;
};
async function answerQuestion(qid) {
  const q = await db.get('questions', qid);
  const tmp = { respuesta: q.respuesta || '' };
  sheet('Respuesta', `<div><p class="small" style="margin:0 2px 10px">${esc(q.texto)}</p><div class="list"><div class="field"><textarea name="respuesta" placeholder="Qué contestó (lo más literal posible)"></textarea></div></div><button class="btn" id="ok">Guardar como respondida</button></div>`, (s, close) => {
    bindForm(s, tmp);
    $('#ok', s).addEventListener('click', async () => { Object.assign(q, { respuesta: tmp.respuesta, estado: 'respondida', fechaRespuesta: today() }); await db.put('questions', q); close(); toast('Respondida'); render(window.scrollY); });
  });
}

/* ---------- Preguntas ---------- */
Views.questions = async () => {
  const all = await db.all('questions');
  const st = { f: '' };
  const node = el(`<div>${navbar('Preguntas', `<button class="nav-btn" data-push="questionForm">${I.plus}</button>`)}
    <div class="filter-row"><button data-f="" class="on">Todas</button>${PROFESIONALES.filter(p => all.some(q => q.para === p)).map(p => `<button data-f="${esc(p)}">${esc(p)}</button>`).join('')}</div>
    <div id="l"></div>
    <button class="btn tinted" data-push="questionForm" style="margin-top:6px">${I.plus}<span>Nueva pregunta</span></button></div>`);
  const draw = () => {
    const xs = all.filter(q => !st.f || q.para === st.f);
    const pend = sortBy(xs.filter(q => q.estado !== 'respondida'), q => (q.prioridad === 'alta' ? '0' : '1') + (q.creada || ''));
    const done = sortBy(xs.filter(q => q.estado === 'respondida'), q => q.fechaRespuesta || '', true);
    const row = q => `<button class="row" data-push="questionForm" data-p="${P({ id: q.id })}"><div class="grow"><div class="title" style="white-space:normal;font-size:16px">${esc(q.texto)}</div><div class="sub">${esc(q.para || '')}${q.prioridad === 'alta' ? ' · <span style="color:var(--red)">prioritaria</span>' : ''}${q.respuesta ? '<br>→ ' + esc(q.respuesta) : ''}</div></div><span class="chev">${I.chev}</span></button>`;
    $('#l', node).innerHTML = `<div class="caption">Pendientes (${pend.length})</div><div class="list">${pend.map(row).join('') || '<div class="row muted">Ninguna</div>'}</div>${done.length ? `<div class="caption" style="margin-top:14px">Respondidas (${done.length})</div><div class="list">${done.map(row).join('')}</div>` : ''}`;
  };
  $$('[data-f]', node).forEach(b => b.addEventListener('click', () => { st.f = b.dataset.f; $$('[data-f]', node).forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw(); return node;
};
Views.questionForm = async ({ id, para }) => {
  const existing = id ? await db.get('questions', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), para: para || PROFESIONALES[0], estado: 'pendiente', prioridad: 'normal', creada: today() };
  const node = el(`<div>${navbar(existing ? 'Pregunta' : 'Nueva pregunta', saveBtn())}
    <div class="list">
      <div class="field"><label>Para</label>${selectHtml('para', PROFESIONALES)}</div>
      <div class="field"><label>Pregunta</label><textarea name="texto"></textarea></div>
      <div class="field"><label>Prioridad</label>${segHtml('prioridad', [['normal', 'Normal'], ['alta', 'Prioritaria']])}</div>
      <div class="field"><label>Estado</label>${segHtml('estado', [['pendiente', 'Pendiente'], ['respondida', 'Respondida']])}</div>
      <div class="field" data-show="estado=respondida"><label>Respuesta</label><textarea name="respuesta"></textarea></div>
    </div>
    <button class="btn" data-save>Guardar</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar</button>` : ''}</div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { if (!state.texto) return alert('Escribe la pregunta.'); if (state.estado === 'respondida' && !state.fechaRespuesta) state.fechaRespuesta = today(); await db.put('questions', state); toast('Guardada'); pop(); }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar la pregunta?')) { await db.del('questions', state.id); pop(); } });
  return node;
};

/* ---------- Información clínica ---------- */
Views.clinical = async () => {
  const all = await db.all('clinical');
  const node = el(`<div>${navbar('Información clínica', `<button class="nav-btn" data-push="clinicalForm">${I.plus}</button>`)}
    <div class="banner small">Cada dato se clasifica según su certeza. Relacionar siempre <b>imagen + síntomas + exploración + función + evolución</b>; una alteración en una prueba no explica por sí sola todos los síntomas.</div>
    ${Object.entries(ESTADOS_INFO).map(([k, e]) => { const xs = sortBy(all.filter(c => c.estado === k), c => c.categoria + c.texto); return xs.length ? `<div class="caption" style="margin-top:14px;display:flex;gap:8px;align-items:center"><span class="chip ${e.color}">${e.nombre}</span><span style="text-transform:none">${e.desc}</span></div><div class="list">${xs.map(c => `<button class="row" data-push="clinicalForm" data-p="${P({ id: c.id })}"><div class="grow"><div class="title" style="white-space:normal;font-size:16px">${esc(c.texto)}</div><div class="sub">${esc(c.categoria || '')}${c.fuente ? ' · ' + esc(c.fuente) : ''}${c.fecha ? ' · ' + fmtShort(c.fecha) : ''}</div></div><span class="chev">${I.chev}</span></button>`).join('')}</div>` : ''; }).join('') || `<div class="empty">${I.cross}Sin información. Importa los datos iniciales en Ajustes o añade elementos.</div>`}
    <button class="btn tinted" data-push="clinicalForm" style="margin-top:10px">${I.plus}<span>Añadir</span></button></div>`);
  return node;
};
Views.clinicalForm = async ({ id }) => {
  const existing = id ? await db.get('clinical', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), estado: 'referido', categoria: CLIN_CATS[0], fecha: today() };
  const node = el(`<div>${navbar(existing ? 'Editar' : 'Nuevo elemento', saveBtn())}
    <div class="list">
      <div class="field"><label>Texto</label><textarea name="texto"></textarea></div>
      <div class="field"><label>Categoría</label>${selectHtml('categoria', CLIN_CATS)}</div>
      <div class="field"><label>Certeza</label>${selectHtml('estado', Object.entries(ESTADOS_INFO).map(([k, e]) => [k, `${e.nombre} — ${e.desc}`]))}</div>
      <div class="field"><label>Fuente</label><input type="text" name="fuente" placeholder="Informe, quién lo dijo…"></div>
      <div class="field inline"><label>Fecha</label><input type="date" name="fecha"></div>
      <div class="field"><label>Notas</label><textarea name="notas"></textarea></div>
    </div>
    ${existing && existing.historial && existing.historial.length ? `<div class="caption" style="margin-top:14px">Cambios anteriores</div><div class="card small">${existing.historial.map(h => `<div style="padding:3px 0">${fmtShort(h.fecha)}: ${esc(ESTADOS_INFO[h.estado]?.nombre || h.estado)} — ${esc(h.texto)}</div>`).join('')}</div>` : ''}
    <button class="btn" data-save>Guardar</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar</button>` : ''}</div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => {
    if (!state.texto) return alert('Escribe el texto.');
    if (existing && (existing.estado !== state.estado || existing.texto !== state.texto)) state.historial = [...(existing.historial || []), { fecha: today(), estado: existing.estado, texto: existing.texto }];
    await db.put('clinical', state); toast('Guardado'); pop();
  }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar?')) { await db.del('clinical', state.id); pop(); } });
  return node;
};

/* ---------- Valoración fisioterapéutica ---------- */
const FISIO_F = [['fuerza', 'Fuerza'], ['movilidad', 'Movilidad'], ['dolor', 'Dolor'], ['sensibilidad', 'Sensibilidad'], ['marcha', 'Marcha'], ['equilibrio', 'Equilibrio'], ['pruebas', 'Pruebas realizadas'], ['respuesta', 'Respuesta a las pruebas'], ['ejercicios', 'Ejercicios prescritos'], ['restricciones', 'Restricciones'], ['recomendaciones', 'Recomendaciones'], ['objetivos', 'Objetivos de la fisioterapeuta']];
Views.fisio = async () => {
  const all = sortBy(await db.all('fisio'), f => f.fecha, true);
  const cur = all[0];
  const node = el(`<div>${navbar('Fisioterapia', `<button class="nav-btn" data-push="fisioForm">${I.plus}</button>`)}
    ${cur ? `<div class="caption">Valoración fisioterapéutica actual</div>
      <div class="card"><div class="card-head">${fmtLong(cur.fecha)}<span class="meta">${esc(cur.fisio || '')}</span></div>
      <dl class="ex-meta">${FISIO_F.filter(([k]) => cur[k]).map(([k, l]) => `<dt>${l}</dt><dd>${nl2br(cur[k])}</dd>`).join('')}</dl>
      <button class="btn secondary sm" style="margin-top:12px" data-push="fisioForm" data-p="${P({ id: cur.id })}">Editar</button></div>
      <div class="banner small">Lo que observa la fisioterapeuta en la exploración tiene prioridad sobre las hipótesis generales. Si algo parece contradictorio, conviértelo en pregunta.</div>
      <div class="btn-row"><button class="btn tinted sm" data-push="exerciseForm">Añadir ejercicio pautado</button><button class="btn tinted sm" data-push="questionForm" data-p="${P({ para: 'Fisioterapeuta' })}">Añadir pregunta</button></div>`
      : `<div class="empty">${I.stethoscope}Todavía no hay valoración fisioterapéutica.<br>Tras la primera cita, regístrala aquí.</div><button class="btn" data-push="fisioForm">Registrar valoración</button>`}
    ${all.length > 1 ? `<div class="caption" style="margin-top:16px">Valoraciones anteriores</div><div class="list">${all.slice(1).map(f => rowLink('fisioForm', { id: f.id }, fmtLong(f.fecha), esc(f.fisio || ''))).join('')}</div>` : ''}
  </div>`);
  return node;
};
Views.fisioForm = async ({ id }) => {
  const existing = id ? await db.get('fisio', id) : null;
  const state = existing ? structuredClone(existing) : { id: uid(), fecha: today() };
  const node = el(`<div>${navbar(existing ? 'Valoración' : 'Nueva valoración', saveBtn())}
    <div class="list"><div class="field inline"><label>Fecha</label><input type="date" name="fecha"></div><div class="field"><label>Fisioterapeuta / centro</label><input type="text" name="fisio"></div></div>
    <div class="list" style="margin-top:14px">${FISIO_F.map(([k, l]) => `<div class="field"><label>${l}</label><textarea name="${k}"></textarea></div>`).join('')}<div class="field"><label>Notas</label><textarea name="notas"></textarea></div></div>
    <button class="btn" data-save>Guardar</button>
    ${existing ? `<button class="btn danger" id="del" style="margin-top:10px">Eliminar</button>` : ''}</div>`);
  bindForm(node, state);
  $$('[data-save]', node).forEach(b => b.addEventListener('click', async () => { await db.put('fisio', state); toast('Valoración guardada'); pop(); }));
  const del = $('#del', node); if (del) del.addEventListener('click', async () => { if (confirm('¿Eliminar esta valoración?')) { await db.del('fisio', state.id); pop(); } });
  return node;
};

Views.alarmsRef = async () => el(`<div>${navbar('Señales de alarma')}
  <div class="light rojo"><div class="lh">${I.stopcircle}<span>Valoración urgente (Urgencias hoy / 112 si es grave)</span></div><ul>${ALARMS.filter(a => a.nivel === 'urgente').map(a => `<li>${esc(a.texto)}</li>`).join('')}</ul></div>
  <div class="light rojo" style="opacity:.92"><div class="lh">${I.warn}<span>Consultar hoy con su médico</span></div><ul>${ALARMS.filter(a => a.nivel === 'hoy').map(a => `<li>${esc(a.texto)}</li>`).join('')}</ul></div>
  <div class="light amarillo"><div class="lh">${I.warn}<span>Amarillo: reducir volumen</span></div><ul><li>Dolor 2 o más puntos por encima de lo habitual</li><li>Ha dormido mal o energía ≤ 3</li><li>Somnolencia ≥ 6 o mareo ≥ 3</li><li>Síntoma neurológico leve nuevo, o cambio urinario/intestinal leve</li><li>Peor respuesta al ejercicio anterior</li></ul></div>
  <div class="light verde"><div class="lh">${I.okcircle}<span>Verde: rutina completa</span></div><p>Sin señales de alarma, dolor estable, energía suficiente y sin mareo significativo.</p></div>
  <div class="footnote">Con antecedente de episodios de adormecimiento de cintura para abajo, cualquier síntoma neurológico nuevo se trata como prioritario. Estas pautas no sustituyen lo que indiquen sus médicos.</div></div>`);

/* ================= AJUSTES ================= */
Views.ajustes = async () => {
  const lastBackup = await db.kv('lastBackup', null);
  let est = null, persisted = null;
  try { est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch { }
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const nFiles = (await db.all('files')).length;
  const node = el(`<div>${navbar('Ajustes')}
    <div class="large-head" style="padding-top:4px"><h1 class="large-title" style="font-size:28px">Ajustes</h1></div>
    ${!standalone ? `<div class="banner warn small"><b>Instálala en la pantalla de inicio</b> para que funcione como app y los datos se conserven mejor: en Safari, botón Compartir → "Añadir a pantalla de inicio".</div>` : ''}
    <div class="caption">Copia de seguridad</div>
    <div class="card small">Los datos viven <b>solo en este iPhone</b>. Si se borran los datos de Safari o cambias de móvil, solo se recuperan con una copia. Guárdala en iCloud Drive (Archivos) una vez por semana.<div style="margin-top:8px" class="muted">Última copia: ${lastBackup ? new Date(lastBackup).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca'}</div></div>
    <button class="btn" id="exp">${I.download}<span>Exportar copia completa</span></button>
    <label class="btn secondary" style="margin-top:10px">${I.share}<span>Restaurar desde una copia</span><input type="file" accept="application/json,.json" hidden id="imp"></label>
    <div class="caption" style="margin-top:18px">Datos iniciales</div>
    <div class="card small">Importa el archivo <b>merycon_datos_iniciales.json</b> (perfil, medicación declarada, RM 2022, línea base, información clínica y preguntas para la fisio). Se combina con lo que ya haya.</div>
    <label class="btn tinted">${I.plus}<span>Importar datos iniciales</span><input type="file" accept="application/json,.json" hidden id="ini"></label>
    <div class="caption" style="margin-top:18px">Almacenamiento</div>
    <div class="list">
      <div class="row"><div class="grow"><div class="title">Espacio usado</div></div><span class="value">${est ? fmtBytes(est.usage || 0) : '–'}</span></div>
      <div class="row"><div class="grow"><div class="title">Archivos adjuntos</div></div><span class="value">${nFiles}</span></div>
      <div class="row"><div class="grow"><div class="title">Almacenamiento persistente</div><div class="sub">Pide al sistema que no borre los datos</div></div><span class="value">${persisted === null ? '–' : persisted ? 'Sí' : 'No'}</span></div>
      ${persisted === false ? '<button class="row center" id="pers">Solicitar almacenamiento persistente</button>' : ''}
    </div>
    <div class="caption" style="margin-top:18px">Acerca de</div>
    <div class="list"><div class="row"><div class="grow"><div class="title">MeryCon</div><div class="sub">Seguimiento personal. No sustituye a médicos ni fisioterapeutas.</div></div><span class="value">v${APP_VERSION}</span></div>
      <button class="row center" id="upd">Buscar actualización</button></div>
    <div class="list" style="margin-top:18px"><button class="row center danger" id="wipe"><span class="title" style="color:var(--red)">Borrar todos los datos</span></button></div>
  </div>`);
  $('#exp', node).addEventListener('click', async e => { const b = e.currentTarget; b.disabled = true; b.querySelector('span').textContent = 'Preparando…'; try { const ok = await exportBackup(); if (ok) toast('Copia exportada'); } catch (err) { alert('Error al exportar: ' + err.message); } render(window.scrollY); });
  const doImport = async (file, mode) => { try { const p = await importBackup(file, mode); toast(mode === 'replace' ? 'Copia restaurada' : 'Datos importados'); goTab('hoy'); } catch (err) { alert(err.message); } };
  $('#imp', node).addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    sheet('Restaurar copia', `<div><p class="small" style="margin:0 2px 12px">${esc(f.name)}</p><button class="btn danger" id="rep">Reemplazar todo lo actual</button><button class="btn secondary" id="mer" style="margin-top:10px">Combinar con lo actual</button></div>`, (s, close) => {
      $('#rep', s).addEventListener('click', () => { if (confirm('Se borrará todo lo que hay ahora en la app y se sustituirá por la copia. ¿Seguir?')) { close(); doImport(f, 'replace'); } });
      $('#mer', s).addEventListener('click', () => { close(); doImport(f, 'merge'); });
    });
  });
  $('#ini', node).addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) doImport(f, 'merge'); });
  const pers = $('#pers', node); if (pers) pers.addEventListener('click', async () => { const ok = await navigator.storage.persist(); toast(ok ? 'Concedido' : 'El sistema no lo ha concedido (instálala en inicio y úsala a menudo)'); render(window.scrollY); });
  $('#upd', node).addEventListener('click', async () => { const r = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (r) { await r.update(); toast('Comprobado. Si hay versión nueva se aplicará al reabrir.'); } else location.reload(); });
  $('#wipe', node).addEventListener('click', async () => {
    if (!confirm('¿Borrar TODOS los datos de MeryCon de este iPhone?')) return;
    if (prompt('Escribe BORRAR para confirmar') !== 'BORRAR') return;
    for (const s of STORES) await db.clear(s); toast('Datos borrados'); goTab('hoy');
  });
  return node;
};
