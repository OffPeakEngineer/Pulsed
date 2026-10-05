import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from 'esbuild';
import { authoredPage } from '../templates/assets/ui/pages-scenes.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = join(root, 'frontend/pages');
const dashboards = join(project, 'dashboards');
await mkdir(dashboards, { recursive: true });
for (const [index, id] of ['overview', 'node', 'history'].entries()) {
  await writeFile(join(dashboards, `${index + 1}_${id}.svg`), authoredPage(id) + '\n');
}
const nuxtPackage = JSON.parse(await readFile(join(root, 'node_modules/nuxt/package.json')));
const cli = join(root, 'node_modules/nuxt', nuxtPackage.bin.nuxi || nuxtPackage.bin.nuxt);
await new Promise((resolvePromise, reject) => {
  const process = spawn(globalThis.process.execPath, [cli, 'generate', project], {
    cwd: root, stdio: 'inherit', env: { ...globalThis.process.env, DEBUG: '', NODE_ENV: 'production', STASIS_PAGES_DIR: dashboards, NUXT_TELEMETRY_DISABLED: '1' },
  });
  process.on('error', reject);
  process.on('exit', code => code === 0 ? resolvePromise() : reject(new Error(`Stasis Pages generation exited ${code}`)));
});
const generated = join(project, '.output/public');
const target = join(root, 'templates/assets/pages');
// This script owns only this generated workspace directory.
if (!target.startsWith(root + '\\') && !target.startsWith(root + '/')) throw new Error('Output escaped the workspace');
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
let markup = await readFile(join(generated, 'index.html'), 'utf8');
const entryPattern = /<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*><\/script>/g;
const entries = [...markup.matchAll(entryPattern)];
if (entries.length !== 1 || !entries[0][1].startsWith('/pages/')) throw new Error('Expected one local Nuxt browser entry');
await build({
  entryPoints: [join(generated, entries[0][1].slice('/pages/'.length))],
  outfile: join(target, 'pulsed-pages.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', minify: true,
  legalComments: 'eof', logLevel: 'warning',
  alias: { '#entry': join(generated, entries[0][1].slice('/pages/'.length)) },
  plugins: [{ name: 'embedded-page-imports', setup(build) {
    build.onLoad({ filter: /\.js$/ }, async args => ({
      // Every JS chunk is now in this module; styles are linked below with the
      // peer query. Vite's original preload URLs would lose that routing query.
      contents: (await readFile(args.path, 'utf8')).replace(/__vite__mapDeps\(\[[\d,\s]*\]\)/g, '[]'), loader: 'js',
    }));
  } }],
});
// The rebundled application has no browser chunk imports or import-map needs.
markup = markup.replace(/<script\b[^>]*type="importmap"[^>]*>[\s\S]*?<\/script>/g, '');
markup = markup.replace(entryPattern, '<script type="module" src="/pages/pulsed-pages.js"></script>');
markup = markup.replace(/<link\b(?=[^>]*rel="modulepreload")[^>]*>/g, '');
markup = markup.replace(/<link\b(?=[^>]*rel="prefetch")[^>]*>/g, '');
// Nuxt's prerender timestamp is informational. Keep checked-in assets reproducible.
markup = markup.replace(/("prerenderedAt":\d+[^<]*?),\d{13},/, '$1,0,');
const linked = new Set([...markup.matchAll(/<link\b[^>]*href="\/pages\/([^"?]+\.css)"[^>]*>/g)].map(match => match[1]));
// Include scoped error-view styles too, so even recovery has no lazy assets.
for (const file of (await readdir(join(generated, '_nuxt'))).filter(file => file.endsWith('.css')).sort()) {
  const asset = '_nuxt/' + file;
  await mkdir(dirname(join(target, asset)), { recursive: true });
  await copyFile(join(generated, asset), join(target, asset));
  if (!linked.has(asset)) markup = markup.replace('</head>', `<link rel="stylesheet" href="/pages/${asset}"></head>`);
}
await writeFile(join(target, 'index.html'), markup + '\n');
console.log(`Embedded Stasis Pages generated at ${relative(root, target)}`);
