// Installation remains a browser action. Register only on secure origins that
// support workers; ordinary HTTP dashboards continue to work as before.
(() => {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  const source = new URL(document.currentScript.src);
  const base = new URL(source.pathname.endsWith('/pages/pwa.js') ? '../' : './', source);
  const worker = new URL('sw.js', base);
  worker.search = source.search;
  navigator.serviceWorker.register(worker.href, {scope: base.pathname, updateViaCache: 'none'})
    .catch(error => console.warn('Pulsed offline support unavailable:', error));
})();
