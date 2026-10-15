// Run through TestAppBrowser to exercise the embedded Go HTTP handler.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium} = await import(process.env.PULSED_PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PULSED_PLAYWRIGHT_MODULE).href : 'playwright');
for (const route of ['/', '/pages/', '/proxy/', '/proxy/pages/']) {
  // Installability is disabled in incognito contexts. Use an isolated disposable
  // profile to test the same browser criteria as a normal window.
  const profile = await mkdtemp(join(tmpdir(), 'pulsed-pwa-'));
  const context = await chromium.launchPersistentContext(profile, {executablePath: process.env.PULSED_CHROME, headless: true});
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const target = new URL(route + '?pulsed_node=browser-test&theme=light', process.env.PULSED_PREVIEW_URL);
    await page.goto(target.href);
    if (route.endsWith('/pages/')) {
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    }
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true}));
      }
    });
    const base = route.replace(/pages\/$/, '');
    const worker = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {scope: registration.scope, script: registration.active.scriptURL};
    });
    assert.equal(new URL(worker.scope).pathname, base);
    assert.equal(new URL(worker.script).searchParams.get('pulsed_node'), 'browser-test');
    const cdp = await context.newCDPSession(page);
    const result = await cdp.send('Page.getAppManifest');
    assert.deepEqual(result.errors, [], `manifest errors for ${route}`);
    const manifest = JSON.parse(result.data);
    const launch = new URL(manifest.start_url, result.url);
    assert.equal(launch.pathname, route);
    assert.equal(launch.searchParams.get('pulsed_node'), 'browser-test');
    assert.equal(launch.searchParams.get('theme'), 'light');
    assert.equal(manifest.display, 'standalone');
    const installability = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installability.installabilityErrors, [], `installability errors for ${route}`);
    assert.deepEqual(await page.evaluate(() => caches.keys()), []);
    await context.setOffline(true);
    const offline = await page.goto(target.href);
    assert.equal(offline.status(), 503);
    await page.getByRole('heading', {name: 'Pulsed is offline', exact: true}).waitFor();
    assert.equal(await page.locator('[data-name], [data-pulsed-node]').count(), 0);
    const apiAvailable = await page.evaluate(async api => {
      try { await fetch(api); return true; } catch { return false; }
    }, new URL(base + 'api/v1/snapshot', target).href);
    assert.equal(apiAvailable, false, 'offline telemetry must not be replayed');
    assert.deepEqual(await page.evaluate(() => caches.keys()), []);
    await context.setOffline(false);
    await page.getByRole('button', {name: 'Retry connection'}).click();
    if (route.endsWith('/pages/')) {
      await page.waitForFunction(() => Boolean(document.querySelector('#__nuxt')?.__vue_app__));
    }
    await page.locator('link[rel="manifest"]').waitFor({state: 'attached'});
    assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
    const recovered = new URL(page.url());
    assert.equal(recovered.origin, target.origin);
    assert.equal(recovered.pathname, target.pathname);
    for (const [key, value] of target.searchParams) assert.equal(recovered.searchParams.get(key), value);
    assert.deepEqual(errors, []);
    console.log(`Installable, scoped, offline and recovered: ${route}`);
  } finally {
    await context.close();
    await rm(profile, {recursive: true, force: true});
  }
}
