// Live monitoring must never replay a cached dashboard or snapshot. Only failed
// dashboard navigations receive this static offline response; API requests and
// all successful responses go directly to the server. No caches are created.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const base = new URL(self.registration.scope);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== base.origin) return;
  const routes = ['', 'index.html', 'dashboard.html', 'pages/', 'pages/index.html'];
  if (!routes.some(route => url.pathname === base.pathname + route)) return;
  event.respondWith(fetch(request, {cache: 'no-store'}).catch(() => new Response(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#071019"><title>Pulsed · offline</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#071019;color:#f1f6f7;font:18px system-ui}main{max-width:30em;padding:2em}p{line-height:1.6;color:#9bb0bc}button{font:inherit;padding:.7em 1.2em;background:#55e6c1;border:0;border-radius:.4em;cursor:pointer}</style>
<main><h1>Pulsed is offline</h1><p>The server cannot be reached. Live readings are unavailable. Reconnect, then retry to see current cluster health.</p><button onclick="location.reload()">Retry connection</button></main></html>`, {
    status: 503, headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'},
  })));
});
