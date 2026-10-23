import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const bundle = readFileSync(new URL('../../templates/assets/ui/dashboard.js', import.meta.url), 'utf8');

function dashboard(restoredOrder) {
  // DOMContentLoaded reaches document before window. The inline controller
  // registers on window before the deferred dashboard module runs.
  const events = () => {
    const listeners = new Map();
    return {
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(listener);
      },
      dispatch(type, target) { for (const listener of listeners.get(type) || []) listener({ target }); },
    };
  };
  const bars = readings => readings.map(([node, index, percent]) => ({ dataset: { node, core: String(index), percent: String(percent) } }));
  let select = { id: 'core-order', value: 'node' };
  let host = {
    children: bars([['n1', 0, 10], ['n1', 1, 90], ['n2', 0, 50], ['n2', 1, 70]]),
    querySelectorAll() { return this.children; },
    replaceChildren(...children) { this.children = children; },
  };
  const empty = { hidden: false };
  const document = {
    ...events(),
    getElementById(id) { return { 'core-order': select, 'cluster-cores': host, 'cluster-cores-empty': empty }[id]; },
    querySelectorAll() { return []; },
    documentElement: { classList: { add() {} } },
  };
  const window = events();
  const saved = new Map();
  window.addEventListener('DOMContentLoaded', () => { select.value = restoredOrder; });
  runInNewContext(bundle, { document, window, localStorage: { setItem: (key, value) => saved.set(key, value) } });
  return {
    load() { document.dispatch('DOMContentLoaded'); window.dispatch('DOMContentLoaded'); },
    indices() { return host.children.map(bar => `${bar.dataset.node}/${bar.dataset.core}`); },
    order: () => select.value,
    change(order) { select.value = order; document.dispatch('change', select); },
    refresh() {
      const currentOrder = select.value;
      // Same-host refresh replaces the summary, restores its selection, then
      // dispatches pulsed:snapshot with newly collected readings.
      select = { id: 'core-order', value: currentOrder };
      host = { ...host, children: bars([['n1', 0, 80], ['n1', 1, 5], ['n2', 0, 50], ['n2', 1, 70]]) };
      document.dispatch('pulsed:snapshot');
    },
    saved,
  };
}

for (const [order, initial, refreshed] of [
  ['node', ['n1/0', 'n1/1', 'n2/0', 'n2/1'], ['n1/0', 'n1/1', 'n2/0', 'n2/1']],
  ['hottest', ['n1/1', 'n2/1', 'n2/0', 'n1/0'], ['n1/0', 'n2/1', 'n2/0', 'n1/1']],
  ['coldest', ['n1/0', 'n2/0', 'n2/1', 'n1/1'], ['n1/1', 'n2/0', 'n2/1', 'n1/0']],
  ['eq', ['n2/0', 'n1/1', 'n2/1', 'n1/0'], ['n2/0', 'n1/0', 'n2/1', 'n1/1']],
]) {
  test(`restored ${order} ordering applies after host navigation and subsequent same-host refresh`, () => {
    const page = dashboard(order);
    page.load();
    assert.equal(page.order(), order);
    assert.deepEqual(page.indices(), initial);
    page.refresh();
    assert.equal(page.order(), order);
    assert.deepEqual(page.indices(), refreshed);
  });
}

test('changing the replacement dropdown persists and applies the new order', () => {
  const page = dashboard('hottest');
  page.load();
  page.refresh();
  page.change('coldest');
  assert.equal(page.saved.get('pulsed-core-order'), 'coldest');
  assert.deepEqual(page.indices(), ['n1/1', 'n2/0', 'n2/1', 'n1/0']);
});
