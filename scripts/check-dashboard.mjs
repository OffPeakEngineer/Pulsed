// Optional browser regression check; see docs/05_building/README.md.
const {chromium} = await import(process.env.PULSED_PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.PULSED_CHROME,headless:true});
const baseURL = process.env.PULSED_PREVIEW_URL || 'http://127.0.0.1:4319/dashboard.html';
const output = process.env.PULSED_SCREENSHOTS;
if (output) await (await import('node:fs/promises')).mkdir(output, {recursive:true});
try {
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(baseURL);
 await page.getByRole('button',{name:'Pause refresh',exact:true}).click();
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
 await page.getByRole('button',{name:'Refresh now',exact:true}).click();
 await page.waitForLoadState('load');
 await page.waitForFunction(()=>document.querySelector('[data-name^="large-host"] details').open);
 assert.equal(await detail.evaluate(el=>el.scrollTop),700);
 assert.equal(await page.getByRole('button',{name:'Resume refresh',exact:true}).count(),1);
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

 // Same-origin refresh must fetch a new document even if only view state changes.
 const auto = await browser.newPage();
 const documents=[];
 auto.on('request',request=>{if(request.isNavigationRequest()) documents.push(request.url());});
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
 console.log(JSON.stringify({sizes,errors,checks:'layout, bounded 1024-core detail, refresh state, search, filters, theme'},null,2));
} finally { await browser.close(); }
