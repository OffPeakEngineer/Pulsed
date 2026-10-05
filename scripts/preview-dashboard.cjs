// Serve the generated synthetic fixture, including its embedded browser modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.PULSED_PREVIEW_DIR || '.ci/preview');
const port = Number(process.env.PULSED_PREVIEW_PORT || 4321);
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let pathname = url.pathname;
  if (pathname.includes('/api/v1/')) pathname = '/snapshot.json';
  else if (pathname.includes('/pages/')) pathname = '/assets/pages/' + pathname.split('/pages/').at(-1);
  if (pathname.endsWith('/')) pathname += pathname === '/' ? 'dashboard.html' : 'index.html';
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    if (url.pathname.includes('/api/v1/')) {
      const data = JSON.parse(content), requested = url.searchParams.getAll('include_cores');
      for (const node of data.nodes) { if (!requested.includes(node.name)) delete node.cpu.cores; }
      for (const [name, points] of Object.entries(data.history)) {
        if (name !== url.searchParams.get('history_cores')) for (const point of points) delete point.coreTenths;
      }
      content = JSON.stringify(data);
    }
    response.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
    if (file.endsWith('pages' + path.sep + 'index.html')) {
      const base = url.pathname.slice(0, url.pathname.lastIndexOf('/pages/')) + '/pages/';
      content = content.toString().replace(/(src|href)="(\/pages\/[^"#]*)"/g, (_, attribute, asset) => {
        const target = new URL(base + asset.slice('/pages/'.length), url);
        target.search = url.search;
        return `${attribute}="${target.pathname + target.search.replaceAll('&', '&amp;')}"`;
      }).replaceAll('"/pages/"', JSON.stringify(base))
        .replaceAll('href="../"', `href="${(base.slice(0,-'pages/'.length)+url.search).replaceAll('&','&amp;')}"`);
    }
    response.setHeader('Cache-Control', 'no-store');
    response.end(content);
  });
}).listen(port, '127.0.0.1', () => console.log(`Synthetic dashboard: http://127.0.0.1:${port}/dashboard.html`));
