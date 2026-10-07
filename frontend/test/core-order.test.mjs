import test from 'node:test';
import assert from 'node:assert/strict';
import { orderClusterCores } from '../../templates/assets/ui/core-order.js';

test('cluster core ordering uses node/core identity and individual usage', () => {
  const cores = [
    { node: 'n10', index: 0, percent: 80 },
    { node: 'n2', index: 1, percent: 10 },
    { node: 'n2', index: 0, percent: 80 },
  ];
  assert.deepEqual(orderClusterCores(cores, 'node'), [cores[2], cores[1], cores[0]]);
  assert.deepEqual(orderClusterCores(cores, 'hottest'), [cores[2], cores[0], cores[1]]);
  assert.deepEqual(orderClusterCores(cores, 'coldest'), [cores[1], cores[2], cores[0]]);
  assert.equal(cores[0].node, 'n10');
});

test('EQ places hot cores at the center, preserving every core for odd and even counts', () => {
  for (const count of [0, 1, 2, 3, 4, 7, 8, 1024]) {
    const cores = Array.from({ length: count }, (_, index) => ({ node: 'n1', index, percent: index }));
    const ordered = orderClusterCores(cores, 'eq');
    assert.equal(new Set(ordered).size, count);
    assert.deepEqual(new Set(ordered), new Set(cores));
    const center = Math.floor((count - 1) / 2);
    if (count) assert.equal(ordered[center].percent, count - 1);
    for (let i = 1; i <= center; i++) assert(ordered[i - 1].percent <= ordered[i].percent);
    for (let i = center + 1; i < count; i++) assert(ordered[i - 1].percent >= ordered[i].percent);
  }
});
