/* MeryCon — evolución (gráficas, patrones) e historial */

Views.evolucion = async () => {
  const range = (await db.kv('evolRange', '30'));
  const [checks, walks, sessions, tests, prof, es] = await Promise.all([db.all('checks'), db.all('walks'), db.all('sessions'), db.all('tests'), getProfile(), exerciseState()]);
  const to = today();
  const firstDate = [...checks.map(c => c.fecha), ...walks.map(w => w.fecha), ...sessions.map(s => s.fecha)].sort()[0] || addDays(to, -13);
  const from = range === 'all' ? (firstDate < addDays(to, -13) ? firstDate : addDays(to, -13)) : addDays(to, -(+range - 1));
  const inR = d => d >= from && d <= to;
  const C = sortBy(checks.filter(c => inR(c.fecha)), c => c.fecha);
  const W = walks.filter(w => inR(w.fecha));
  const S = sessions.filter(s => inR(s.fecha));
  const pts = (arr, k) => arr.filter(c => c[k] != null && c[k] !== '').map(c => ({ x: c.fecha, y: +c[k] }));
  const walkDays = {}; W.forEach(w => { walkDays[w.fecha] = (walkDays[w.fecha] || 0) + (num(w.duracion) || 0); });
  const walkPts = Object.entries(walkDays).map(([x, y]) => ({ x, y }));
  const adhPts = S.map(s => { const v = Object.values(s.items || {}); return { x: s.fecha, y: v.length ? Math.round(v.filter(z => z === 'si').length / v.length * 100) : 0 }; });

  // calendario de semáforo
  const nDays = daysBetween(from, to) + 1;
  const cmap = Object.fromEntries(checks.map(c => [c.fecha, c.semaforo]));
  let cells = ''; const startPad = 14 - (nDays % 14 || 14);
  for (let i = 0; i < startPad; i++) cells += '<div style="visibility:hidden"></div>';
  for (let i = 0; i < nDays; i++) { const d = addDays(from, i); cells += `<div class="${cmap[d] || ''}" title="${fmtDate(d)}"></div>`; }
  const cnt = k => C.filter(c => c.semaforo === k).length;

  // patrones
  const pat = [];
  const mejora = W.filter(w => w.mejoraSentarse === 'si').length;
  if (mejora) pat.push(`En ${mejora} de ${W.length} caminatas el dolor de pierna mejoró al sentarse o inclinarse. Es un dato útil para la fisio/médico.`);
  const somSi = avg(C.filter(c => c.mirtazapina === 'si').map(c => c.somnolencia)), somNo = avg(C.filter(c => c.mirtazapina === 'no').map(c => c.somnolencia));
  if (somSi != null && somNo != null) pat.push(`Somnolencia media al día siguiente: ${round1(somSi)}/10 cuando tomó mirtazapina y ${round1(somNo)}/10 cuando no. Solo como dato para comentar con su médico; no cambiar nada por cuenta propia.`);
  const neuro = C.filter(c => c.neuro === 'si').length; if (neuro) pat.push(`${neuro} día(s) con síntomas neurológicos nuevos anotados en este periodo.`);
  const peorWalk = W.filter(w => w.diaSig === 'peor').length; if (peorWalk) pat.push(`${peorWalk} caminata(s) con peor estado al día siguiente: revisar duración antes de progresar.`);
  const pierLado = C.filter(c => c.ladoPierna).reduce((a, c) => { a[c.ladoPierna] = (a[c.ladoPierna] || 0) + 1; return a; }, {});
  if (Object.keys(pierLado).length) pat.push(`Lado del dolor de pierna: ${Object.entries(pierLado).map(([k, v]) => `${{ der: 'derecha', izq: 'izquierda', ambas: 'ambas' }[k]} ${v} día(s)`).join(', ')}.`);

  const node = el(`<div>
    ${largeHead('Evolución')}
    ${segHtml('r', [['14', '2 sem'], ['30', '1 mes'], ['90', '3 meses'], ['all', 'Todo']])}
    <div class="section" style="margin-top:14px"><div class="card"><div class="card-head">Semáforo<span class="meta">${C.length} checks</span></div>
      <div class="strip" style="margin-top:6px">${cells}</div>
      <div class="strip-legend"><span>${fmtShort(from)}</span><span><span class="dot verde"></span> ${cnt('verde')} · <span class="dot amarillo"></span> ${cnt('amarillo')} · <span class="dot rojo"></span> ${cnt('rojo')}</span><span>${fmtShort(to)}</span></div></div></div>
    <div id="charts"></div>
    ${pat.length ? `<div class="section"><div class="section-head"><h2>Patrones observados</h2></div><div class="card"><ul style="margin:0;padding-left:18px;font-size:15px;line-height:1.45">${pat.map(p => `<li style="margin-bottom:6px">${esc(p)}</li>`).join('')}</ul><div class="small muted">Tendencias de los registros, no diagnósticos. No sobreinterpretar un único día.</div></div></div>` : ''}
    <div class="section"><div class="list">
      ${rowLink('historial', {}, 'Historial de registros', '', '', I.clipboard, 'var(--blue)')}
      ${rowLink('testsHistory', {}, 'Pruebas funcionales', `${tests.length} registro(s)`, '', I.ruler, 'var(--indigo)')}
    </div></div>
  </div>`);
  const st = { r: range };
  bindForm(node, st, async () => { if (st.r) await db.setKv('evolRange', st.r); render(window.scrollY); });

  node._after = () => {
    const box = $('#charts', node);
    const add = (title, meta, cfg) => {
      const c = el(`<div class="card"><div class="card-head">${esc(title)}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</div>${legendHtml(cfg.series)}<div class="chart"></div></div>`);
      box.append(c); chart($('.chart', c), Object.assign({ from, to, label: title }, cfg));
    };
    add('Dolor', '0-10', { series: [{ name: 'Lumbar', color: 'var(--series-1)', points: pts(C, 'dolorLumbar') }, { name: 'Pierna', color: 'var(--series-2)', points: pts(C, 'dolorPierna') }], yMin: 0, yMax: 10 });
    add('Energía y somnolencia', '0-10', { series: [{ name: 'Energía', color: 'var(--series-1)', points: pts(C, 'energia') }, { name: 'Somnolencia', color: 'var(--series-2)', points: pts(C, 'somnolencia') }], yMin: 0, yMax: 10 });
    add('Miedo a caerse', '0-10', { series: [{ name: 'Miedo', color: 'var(--series-1)', points: pts(C, 'miedo') }], yMin: 0, yMax: 10 });
    add('Pasos', `objetivo ${(num(prof.objetivoPasos) || 0).toLocaleString('es-ES')}`, { series: [{ name: 'Pasos', color: 'var(--series-1)', points: pts(C, 'pasos') }], type: 'bar', ref: num(prof.objetivoPasos), yMin: 0 });
    add('Minutos caminando', 'caminatas registradas', { series: [{ name: 'Minutos', color: 'var(--series-1)', points: walkPts }], type: 'bar', ref: num(prof.walkTarget), yMin: 0, unit: 'min' });
    add('Adherencia a la rutina', '% en "Sí"', { series: [{ name: 'Adherencia', color: 'var(--series-1)', points: adhPts }], type: 'bar', yMin: 0, yMax: 100, unit: '%' });
    add('Horas de sueño', '', { series: [{ name: 'Horas', color: 'var(--series-1)', points: pts(C, 'horasSueno') }], yMin: 0, unit: 'h' });
    const peso = sortBy(tests.filter(t => t.valores && t.valores.peso), t => t.fecha).map(t => ({ x: t.fecha, y: t.valores.peso }));
    if (peso.length) add('Peso', 'kg', { series: [{ name: 'Peso', color: 'var(--series-1)', points: peso }], from: peso[0].x < from ? peso[0].x : from, yMin: null, unit: 'kg' });
  };
  return node;
};

Views.historial = async () => {
  const [checks, walks, sessions, tests, intakes] = await Promise.all([db.all('checks'), db.all('walks'), db.all('sessions'), db.all('tests'), db.all('intakes')]);
  const items = [];
  checks.forEach(c => items.push({ d: c.fecha, k: 'c', html: rowLink('checkForm', { date: c.fecha }, 'Check diario', `Lumbar ${c.dolorLumbar ?? '–'} · Pierna ${c.dolorPierna ?? '–'} · Energía ${c.energia ?? '–'}`, `<span class="dot ${c.semaforo || 'none'}"></span>`, I.heart, 'var(--accent)') }));
  walks.forEach(w => items.push({ d: w.fecha, k: 'w', html: rowLink('walkForm', { id: w.id }, `Caminata ${w.duracion} min`, `${w.hora || ''} ${w.lugar === 'dentro' ? 'en casa' : 'fuera'}${w.diaSig ? ' · día sig.: ' + w.diaSig : ''}`, w.semaforo ? `<span class="dot ${w.semaforo}"></span>` : '', I.walk, 'var(--orange)') }));
  sessions.forEach(s => { const v = Object.values(s.items || {}); items.push({ d: s.fecha, k: 's', html: rowLink('sessionForm', { id: s.id }, 'Rutina', `${v.filter(x => x === 'si').length}/${v.length} completos${s.resp24 ? ' · 24 h: ' + s.resp24 : ''}`, '', I.dumbbell, 'var(--green)') }); });
  tests.forEach(t => items.push({ d: t.fecha, k: 't', html: rowLink('testForm', { id: t.id }, 'Pruebas funcionales', `${Object.keys(t.valores || {}).length} mediciones`, '', I.ruler, 'var(--indigo)') }));
  intakes.forEach(i => items.push({ d: i.fecha, k: 'i', html: rowLink('intakesForm', { date: i.fecha }, 'Tomas de medicación', `${Object.values(i.tomas || {}).filter(Boolean).length} marcadas${(i.extra || []).length ? ` · ${(i.extra || []).length} puntual(es)` : ''}`, '', I.pill, 'var(--teal)') }));
  const byDay = {}; items.forEach(x => (byDay[x.d] = byDay[x.d] || []).push(x));
  const days = Object.keys(byDay).sort().reverse();
  const st = { f: 'todo' };
  const node = el(`<div>${navbar('Historial')}
    <div class="filter-row">${[['todo', 'Todo'], ['c', 'Checks'], ['w', 'Caminatas'], ['s', 'Rutina'], ['t', 'Pruebas'], ['i', 'Tomas']].map(([k, l]) => `<button data-f="${k}" class="${k === 'todo' ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="list"></div></div>`);
  const draw = () => {
    const html = days.map(d => { const xs = byDay[d].filter(x => st.f === 'todo' || x.k === st.f); return xs.length ? `<div class="caption" style="margin-top:12px">${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div><div class="list">${xs.map(x => x.html).join('')}</div>` : ''; }).join('');
    $('#list', node).innerHTML = html || `<div class="empty">${I.clipboard}Todavía no hay registros.</div>`;
  };
  $$('[data-f]', node).forEach(b => b.addEventListener('click', () => { st.f = b.dataset.f; $$('[data-f]', node).forEach(x => x.classList.toggle('on', x === b)); draw(); }));
  draw();
  return node;
};
