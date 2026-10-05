import {spawn} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const process=spawn(globalThis.process.execPath,[join(root,'node_modules/nuxt/bin/nuxt.mjs'),'typecheck',join(root,'frontend/pages')],{
 cwd:root,stdio:'inherit',env:{...globalThis.process.env,DEBUG:'',STASIS_PAGES_DIR:join(root,'frontend/pages/dashboards'),NUXT_TELEMETRY_DISABLED:'1'},
});
process.on('error',error=>{console.error(error);globalThis.process.exitCode=1;});
process.on('exit',code=>{globalThis.process.exitCode=code ?? 1;});
