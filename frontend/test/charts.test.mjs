import test from 'node:test';
import assert from 'node:assert/strict';
import { cpuHistoryDocument, observationCommands, memoryMeter } from '../../templates/assets/ui/charts.js';
import { parseStasisSvg } from '../../templates/assets/ui/vendor/stasis/index.js';
import { sceneFromSvg } from '../../templates/assets/ui/vendor/scene/svg.js';

const points = [
  {at:1000,average:20,peak:50,ttlSeconds:5},
  {at:3000,average:25,peak:70,ttlSeconds:5},
  {at:13000,average:50,peak:90,ttlSeconds:5},
];
test('timestamp spacing, fixed percentage scale, and heartbeat gaps', () => {
  const commands = observationCommands(points, 'average', 0, 20000);
  assert.deepEqual(commands.map(point => point.command), ['move','line','move']);
  assert(Math.abs(commands[1].x - commands[0].x - 48.4) < 1e-10);
  assert.equal(commands[2].y, 109);
  assert.equal(observationCommands(points, 'peak', 10000, 20000).length, 1);
});
test('real Shipkit chart survives portable Stasis and Scene round trips', () => {
  const svg = cpuHistoryDocument({name:'rack <script>alert(1)</script> & edge $& $1',servingNode:'peer-a',points,end:20000,windowMs:60000,width:640,theme:'dark',colors:{accent:'#65d5ef',peak:'#facc15',surface:'#0d1d27',border:'#29414f',text:'#f1f6f7',muted:'#9bb0bc'}});
  const document = parseStasisSvg(svg);
  const scene = sceneFromSvg(svg);
  assert.equal(document.metadata.source.type, 'pulsed');
  assert.equal(document.title, 'rack <script>alert(1)</script> & edge $& $1 CPU history');
  assert.equal(scene.root.components['@pulsed/telemetry/cpu-history'].data.points.length, 3);
  assert.match(svg, /@versytl\/shipkit\/dashboard-widget/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /pulsed-cpu-history:average/);
  assert.match(svg, /pulsed-cpu-history:peak/);
});
test('empty and single-sample histories export valid documents', () => {
  for (const values of [[],points.slice(0,1)]) {
    const svg = cpuHistoryDocument({name:'solo',servingNode:'peer-a',points:values,end:20000,windowMs:60000,width:320,theme:'light',colors:{accent:'#2563eb',peak:'#b45309',surface:'#ffffff',border:'#cbd5e1',text:'#0f172a',muted:'#475569'}});
    assert.equal(sceneFromSvg(svg).width, 320);
    assert.match(parseStasisSvg(svg).description, new RegExp(`${values.length} observed`));
    assert.doesNotMatch(svg, /NaN|Infinity/);
  }
});
test('focused meter uses the Shipkit progress component', () => {
  assert.match(memoryMeter(25,{accent:'#65d5ef',border:'#29414f'}), /@versytl\/shipkit\/progress-bar/);
});
