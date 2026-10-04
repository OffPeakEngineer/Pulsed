// Optional browser regression check; see docs/05_building/README.md.
import {pathToFileURL} from 'node:url';
const playwrightModule = process.env.PULSED_PLAYWRIGHT_MODULE;
const {chromium} = await import(playwrightModule ? pathToFileURL(playwrightModule).href : 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.PULSED_CHROME,headless:true});
const baseURL = process.env.PULSED_PREVIEW_URL || 'http://127.0.0.1:4319/dashboard.html';
const output = process.env.PULSED_SCREENSHOTS;
if (output) await (await import('node:fs/promises')).mkdir(output, {recursive:true});
try {
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL);
 await page.waitForFunction(()=>document.documentElement.classList.contains('versytl-ready'));
 await page.getByRole('button',{name:'Pause refresh',exact:true}).click();
 assert.equal(await page.locator('#cpu-history svg').count(),1);
 await page.locator('[data-name="compute-192"] .inspect-history').click();
 assert.equal(await page.locator('#inspect-node').inputValue(),'compute-192');
 assert.equal(await page.locator('#inspect-title').textContent(),'compute-192');
 await page.locator('#history-window').selectOption('60000');
 assert.match(await page.locator('#history-note').textContent(),/observed readings/);
 const exported=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export SVG',exact:true}).click();
 const download=await exported;
 const content=await (await import('node:fs/promises')).readFile(await download.path(),'utf8');
 assert.match(content,/metadata id="stasis-page"/);
 assert.match(content,/@versytl\/shipkit\/dashboard-widget/);
 assert.match(content,/compute-192 CPU history/);
 await page.locator('#inspect-node').selectOption('rack-07');
 assert.match(await page.locator('#history-note').textContent(),/No CPU history/);
 assert(await page.locator('#export-history').isDisabled());
 await page.locator('#inspect-node').selectOption('compute-192');
 const sizes=[];
 for (const width of [320,390,768,1024,1440,2560]) {
  await page.setViewportSize({width,height:900});
  for (const density of ['comfortable','compact']) {
   await page.locator('#density-select').selectOption(density);
   const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.cell')].map(c=>({h:c.offsetHeight,w:c.offsetWidth,font:getComputedStyle(c).fontSize,overflow:c.scrollWidth>c.clientWidth}))}));
   assert(layout.scroll<=width,`overflow at ${width}/${density}: ${layout.scroll}`);
   assert(layout.cards.every(c=>!c.overflow),`card overflow ${width}/${density}`);
   assert(layout.cards.every(c=>c.h<550),`oversized collapsed card ${width}/${density}`);
   sizes.push({width,density,card:layout.cards[0]});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#density-select').selectOption('comfortable');
 if (output) await page.screenshot({path:output+'/desktop.png',fullPage:true});
 await page.getByText('Inspect 1024 logical CPUs',{exact:true}).click();
 const detail=page.locator('[data-name^="large-host"] .core-scroll');
 assert((await detail.boundingBox()).height<=280);
 assert.equal(await detail.locator('.core-reading').count(),1024);
 await detail.evaluate(el=>{el.scrollTop=700;});
 await page.evaluate(()=>{window.pulsedUpdates=0;document.addEventListener('pulsed:snapshot',()=>window.pulsedUpdates++);window.documentIdentity=crypto.randomUUID();});
 const documentIdentity=await page.evaluate(()=>window.documentIdentity);
 await page.route('**/dashboard.html*',async route=>{
  const response=await route.fetch();
  const html=await page.evaluate(source=>{
   const next=new DOMParser().parseFromString(source,'text/html');
   const seed=next.getElementById('snapshot-data');
   const snapshot=JSON.parse(seed.dataset.snapshot);
   snapshot.nodes.find(node=>node.Name==='compute-192').CPUAvg=74;
   seed.dataset.snapshot=JSON.stringify(snapshot);
   const card=next.querySelector('[data-name="compute-192"]');
   card.dataset.cpuAvg='74.000';
   card.querySelector('[aria-label="CPU summary"] strong').innerHTML='74<small>% avg</small>';
   return next.documentElement.outerHTML;
  },await response.text());
  await route.fulfill({response,body:html});
 },{times:1});
 await page.getByRole('button',{name:'Refresh now',exact:true}).click();
 await page.waitForFunction(()=>window.pulsedUpdates>0);
 assert.equal(await page.evaluate(()=>window.documentIdentity),documentIdentity,'same-view refresh replaced the document');
 await page.waitForFunction(()=>document.querySelector('[data-name^="large-host"] details').open);
 assert.equal(await detail.evaluate(el=>el.scrollTop),700);
 assert.equal(await page.getByRole('button',{name:'Resume refresh',exact:true}).count(),1);
 assert.equal(await page.locator('#inspect-node').inputValue(),'compute-192');
 assert.equal(await page.locator('#history-window').inputValue(),'60000');
 assert.match(await page.locator('#inspect-cpu').textContent(),/^74\.0% mean/);
 assert.equal(await page.locator('[data-name="compute-192"]').getAttribute('data-cpu-avg'),'74.000');
 await page.locator('#node-search').fill('compute-192');
 assert.equal(await page.locator('.cell:visible').count(),1);
 await page.locator('#node-search').fill('no-match');
 assert(await page.locator('#empty-state').isVisible());
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();
 assert.equal(await page.locator('.cell:visible').count(),12);
 await page.locator('#hide-offline').check(); assert.equal(await page.locator('.cell:visible').count(),11);
 await page.locator('#hide-stale').check(); assert.equal(await page.locator('.cell:visible').count(),10);
 await detail.evaluate(el=>{el.scrollTop=700;});
 await page.locator('#sort-select').selectOption('memTotal');
 assert.equal(await detail.evaluate(el=>el.scrollTop),700);
 await page.getByText('Appearance',{exact:true}).click();
 await page.locator('#theme-select').selectOption('light');
 if (output) await page.screenshot({path:output+'/light.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 if (output) await page.screenshot({path:output+'/mobile.png',fullPage:false});

 // Phone controls remain readable and tappable with appearance and CPU details open.
 const phone = await browser.newContext({viewport:{width:320,height:740},isMobile:true,hasTouch:true});
 const mobile = await phone.newPage();
 await mobile.goto(baseURL);
 await mobile.getByRole('button',{name:'Pause refresh',exact:true}).click();
 await mobile.getByText('Appearance',{exact:true}).click();
 await mobile.getByText('Inspect 1024 logical CPUs',{exact:true}).click();
 for (const width of [320,390,480,844]) {
  await mobile.setViewportSize({width,height:740});
  assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`phone overflow at ${width}`);
  const targets=await mobile.locator('button:visible, select:visible, input[type="search"], summary:visible, .filters label').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
  assert(targets.every(h=>h>=44),`small touch target at ${width}`);
  const cores=mobile.locator('[data-name^="large-host"] .core-scroll');
  assert(await cores.evaluate(el=>el.scrollWidth<=el.clientWidth),`CPU detail overflow at ${width}`);
  if (width<=480) {
   assert(await mobile.locator('#node-search, select').evaluateAll(els=>els.every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)),'phone input text too small');
  }
 }
 await mobile.setViewportSize({width:390,height:844});
 if (output) await mobile.screenshot({path:output+'/mobile-touch.png',fullPage:true});
 await phone.close();

 // Same-origin refresh fetches fresh snapshots while retaining the document.
 const auto = await browser.newPage();
 const documents=[];
 auto.on('request',request=>{if(request.url().split('#')[0].includes('dashboard.html') || request.url().split('#')[0]===baseURL) documents.push(request.url());});
 await auto.goto(baseURL);
 await auto.waitForTimeout(3600);
 assert(documents.length>=2,'automatic refresh did not request a new document');
 await auto.getByRole('button',{name:'Pause refresh',exact:true}).click();
 const count=documents.length;
 await auto.waitForTimeout(3600);
 assert.equal(documents.length,count,'paused view refreshed');
 await auto.getByRole('button',{name:'Resume refresh',exact:true}).click();
 await auto.waitForTimeout(6700);
 assert(documents.length>=count+2,'resume did not sustain refreshing');
 // URL-carried inspection state also works on a different origin.
 const cross = await browser.newPage();
 const view={sort:'cpuMax',search:'compute',density:'compact',stale:true,offline:true,paused:true,expanded:[{name:'compute-192',scroll:120}]};
 await cross.goto(baseURL.replace('127.0.0.1','localhost')+'#view='+encodeURIComponent(JSON.stringify(view)));
 assert.equal(await cross.locator('.cell:visible').count(),1);
 assert.equal(await cross.locator('#density-select').inputValue(),'compact');
 assert(await cross.locator('[data-name="compute-192"] details').getAttribute('open') !== null);
 assert.equal(await cross.locator('[data-name="compute-192"] .core-scroll').evaluate(el=>el.scrollTop),120);
 // Blocked storage must not break the controls or refresh setup.
 const restricted = await browser.newPage();
 await restricted.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable');}});});
 await restricted.goto(baseURL);
 await restricted.locator('#node-search').fill('edge-01');
 assert.equal(await restricted.locator('.cell:visible').count(),1);
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:800}});
 const fallback=await noJS.newPage();
 await fallback.goto(baseURL);
 await fallback.getByText('Inspect 192 logical CPUs',{exact:true}).click();
 assert.equal(await fallback.locator('[data-name="compute-192"] .core-reading').count(),192);
 assert(await fallback.locator('[data-name="compute-192"] .core-scroll').isVisible());
 assert.deepEqual(errors,[]);
 const failed=await browser.newPage();
 await failed.goto(baseURL);
 await failed.getByRole('button',{name:'Pause refresh',exact:true}).click();
 await failed.route('**/dashboard.html*',route=>route.fulfill({status:503,body:'temporarily unavailable'}),{times:1});
 await failed.getByRole('button',{name:'Refresh now',exact:true}).click();
 await failed.locator('#snapshot-notice').waitFor({state:'visible'});
 assert.equal(await failed.locator('.cell').count(),12,'failed refresh discarded last snapshot');
 assert.equal(await failed.getByRole('button',{name:'Resume refresh',exact:true}).count(),1);
 await failed.getByRole('button',{name:'Refresh now',exact:true}).click();
 await failed.locator('#snapshot-notice').waitFor({state:'hidden'});
 console.log(JSON.stringify({sizes,errors,checks:'Versytl charts, SVG export, missing history, layout, bounded 1024-core detail, in-place refresh state, search, filters, theme'},null,2));
} finally { await browser.close(); }
