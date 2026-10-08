/* MeryCon — arranque */
(async function boot() {
  try {
    await db.open();
  } catch (e) {
    $('#main').innerHTML = `<div class="card" style="margin-top:30vh">No se pudo abrir el almacenamiento local (${esc(e.message || e)}). Si estás en modo privado de Safari, ábrela en modo normal.</div>`;
    return;
  }
  try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) navigator.storage.persist(); } catch { }
  buildTabbar();
  render(0);
  // Recalcular la pantalla Hoy al volver a la app (p. ej. al cambiar de día)
  let lastDay = today();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && today() !== lastDay) { lastDay = today(); if (!Nav.stack.length) render(window.scrollY); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('Nueva versión lista: cierra y vuelve a abrir la app'); });
      });
    } catch (e) { console.warn('SW', e); }
  }
})();
