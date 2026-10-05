import test from 'node:test';
import assert from 'node:assert/strict';
import { cpuHistoryDocument, observationCommands, coreObservationCommands, memoryMeter } from '../../templates/assets/ui/charts.js';
import { coreColor, coreBarsDocument } from '../../templates/assets/ui/core-charts.js';
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

test('per-core history breaks across missing vectors, heartbeat gaps and CPU count changes', () => {
 const values=[{at:1000,cores:[0,80]},{at:2000,cores:[30,90]},{at:3000},{at:4000,cores:[40,90]},{at:5000,cores:[50]},{at:15000,cores:[60]}].map(p=>({...p,average:20,peak:80,ttlSeconds:5}));
 assert.deepEqual(coreObservationCommands(values,0,0,20000).map(p=>p.command),['move','line','move','move','move']);
 assert.deepEqual(coreObservationCommands(values,1,0,20000).map(p=>p.command),['move','line','move']);
 assert.equal(coreObservationCommands(values,0,0,20000)[0].y,172);
});

test('idle core color is grey, activity increases saturation, and hue stays stable',()=>{
 assert.equal(coreColor(0,0),coreColor(1023,0));
 assert.equal(coreColor(0,0),'#46505b');
 const low=coreColor(15,10), high=coreColor(15,100);
 assert.equal(low.match(/hsl\((\d+)/)[1],high.match(/hsl\((\d+)/)[1]);
 assert(Number(low.match(/ (\d+)%/)[1])<Number(high.match(/ (\d+)%/)[1]));
 assert.notEqual(coreColor(14,100),high);
});

test('every logical CPU has its own bar, including zero, in large core sets',()=>{
 for(const count of [0,4,192,1024]) {
  const cores=Array.from({length:count},(_,index)=>({index,percent:index%101}));
  const svg=coreBarsDocument('rack <script>',cores,300,{border:'#29414f',text:'#f1f6f7'},'dark');
  assert.equal((svg.match(/data-core="/g)||[]).length,count);
  if(count) {assert.match(svg,/CPU 0: 0%/);assert.doesNotMatch(svg,/id="logical-cpus-cpu-0-fill"/);}
  assert.doesNotMatch(svg,/<script>|NaN|Infinity/);
  assert.equal(sceneFromSvg(svg).root.components['@pulsed/telemetry/core-bars'].data.cores.length,count);
 }
});

test('core history exports the displayed indices and actual observations',()=>{
 const values=points.map(p=>({...p,cores:Array.from({length:64},(_,i)=>i)}));
 const svg=cpuHistoryDocument({name:'big',servingNode:'peer',points:values,end:20000,windowMs:60000,width:640,theme:'dark',mode:'cores',coreStart:32,coreLimit:32,colors:{accent:'#65d5ef',peak:'#facc15',surface:'#0d1d27',border:'#29414f',text:'#f1f6f7',muted:'#9bb0bc'}});
 const data=sceneFromSvg(svg).root.components['@pulsed/telemetry/cpu-history'].data;
 assert.deepEqual(data.coreIndices,Array.from({length:32},(_,i)=>i+32));
 assert.equal(data.points[0].cores[0],32);
 assert.equal((svg.match(/data-core-trace="/g)||[]).length,32);
 assert.doesNotMatch(svg,/id="pulsed-cpu-history:average"/);
});
