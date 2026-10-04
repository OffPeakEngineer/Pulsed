// Serve the generated synthetic fixture, including its embedded browser modules.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(process.env.PULSED_PREVIEW_DIR || '.ci/preview');
const port = Number(process.env.PULSED_PREVIEW_PORT || 4321);
http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (pathname === '/' ? '/dashboard.html' : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(content);
  });
}).listen(port, '127.0.0.1', () => console.log(`Synthetic dashboard: http://127.0.0.1:${port}/dashboard.html`));
