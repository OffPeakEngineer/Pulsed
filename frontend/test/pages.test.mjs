import test from 'node:test';
import assert from 'node:assert/strict';
import { pulsedSource, pulsedBridge, parsePulsedSnapshot, pagesURL, snapshotURL, classicURL } from '../../templates/assets/ui/pulsed-source.js';
import { authoredPage, hydratePage } from '../../templates/assets/ui/pages-scenes.js';
import { parseStasisSvg } from '../../templates/assets/ui/vendor/stasis/index.js';
import { sceneFromSvg, sceneToSvg } from '../../templates/assets/ui/vendor/scene/svg.js';

const node = {name:'constructor',state:'fresh',ageSeconds:0,updatedAt:20000,ttlSeconds:15,version:'test',webURL:'',cpu:{average:0,peak:0,count:2},memory:{percent:25,label:'25 / 100'},load:[0,0,0]};
const snapshot = {schemaVersion:1,generatedAt:20000,servingNode:'peer-a',refreshMs:3000,refreshURL:'',historyWindowMs:300000,summary:{fresh:1,stale:0,offline:0,hottest:'constructor'},nodes:[node],history:{}};
const colors={accent:'#65d5ef',peak:'#facc15',surface:'#0d1d27',border:'#29414f',text:'#f1f6f7',muted:'#9bb0bc'};
function page(id, svg=authoredPage(id)) { const parsed=parseStasisSvg(svg); return {id,label:id,eyebrow:'Cluster',title:parsed.title,description:parsed.description,order:0,file:id+'.svg',svg,metadata:parsed.metadata}; }

test('typed source preserves zero and absent history, rejects malformed or unsupported snapshots',()=>{
 const parsed=parsePulsedSnapshot(snapshot);
 assert.equal(parsed.nodes[0].cpu.average,0);
 assert.equal(parsed.history.constructor,undefined);
 for(const value of [{...snapshot,schemaVersion:2},{...snapshot,nodes:[node,node]},{...snapshot,nodes:[{...node,cpu:{...node.cpu,average:NaN}}]}]) assert.throws(()=>parsePulsedSnapshot(value));
});
test('Bridge uses an explicit trusted source and bound browser fetch',async()=>{
 const adapter=pulsedBridge.source('pulsed/snapshot',1);
 let request;
 const result=await adapter.read({url:'/proxy/api/v1/snapshot?pulsed_node=a'},{fetch:async function(url,options){assert.equal(this,globalThis); request={url,options};return new Response(JSON.stringify(snapshot));},now:()=>new Date(20000)});
 assert.equal(result.observedAt,new Date(20000).toISOString());
 assert.equal(result.data.nodes.length,1);assert.equal(request.options.cache,'no-store');
 assert.throws(()=>pulsedBridge.source('pulsed/snapshot',2));
 for(const url of ['https://other.example/api','//other.example/api','/\\other.example/api']) await assert.rejects(pulsedSource.read({url},{fetch(){throw Error('unexpected fetch')},now:()=>new Date()}));
 await assert.rejects(adapter.read({url:'/api/v1/snapshot'},{fetch:async()=>new Response('failure',{status:503}),now:()=>new Date()}));
});
test('peer and resource routing preserve target identity, proxy prefix and operator state',()=>{
 const current='https://cluster.example/proxy/pages/?pulsed_node=a&focus=constructor&theme=light&paused=1#history';
 const target=new URL(pagesURL('https://cluster.example/proxy/?pulsed_node=b',current));
 assert.equal(target.pathname,'/proxy/pages/');assert.equal(target.searchParams.get('pulsed_node'),'b');assert.equal(target.searchParams.get('paused'),'1');assert.equal(target.hash,'#history');
 const api=new URL(snapshotURL(current,'constructor'),'https://cluster.example');
 assert.equal(api.pathname,'/proxy/api/v1/snapshot');assert.equal(api.searchParams.get('include_cores'),'constructor');assert.equal(api.searchParams.get('pulsed_node'),'a');
 assert.equal(new URL(classicURL(current),'https://cluster.example').pathname,'/proxy/');
 assert.throws(()=>pagesURL('javascript:alert(1)',current));
});
test('portable pages retain trusted provider and Shipkit payloads after hydration',()=>{
 const context={snapshot:parsePulsedSnapshot(snapshot),selected:node.name,nodes:[node],windowMs:60000,width:960,colors};
 for(const id of ['overview','node','history']) {
  const result=hydratePage(page(id),context);assert.equal(result.supported,true);
  assert(sceneFromSvg(result.svg).root.components['@pulsed/dashboard/'+id]);
  assert.equal(parseStasisSvg(result.svg).metadata.source.type,'pulsed');
  assert.equal(hydratePage(page(id,result.svg),context).supported,true);
  assert.doesNotMatch(result.svg,/NaN|Infinity|<script>/);
 }
 const overview=hydratePage(page('overview'),{...context,nodes:[{...node,name:'rack <script> $& $1'}]});
 assert.match(overview.svg,/data-pulsed-node="rack &lt;script&gt; \$&amp; \$1"/);
 assert.match(overview.svg,/CPU 0.0%/);
 const detail=hydratePage(page('node'),context);
 assert.match(detail.svg,/@versytl\/shipkit\/dashboard-widget/);
 function find(node,id) {if(node.id===id)return node;return node.kind==='group' ? node.children.map(n=>find(n,id)).find(Boolean) : undefined;}
 assert.equal(find(sceneFromSvg(detail.svg).root,'node-memory:fill').fill.color,colors.accent);
});
test('unknown or unsupported page providers preserve the saved view',()=>{
 const original=sceneFromSvg(authoredPage('overview'));
 for(const components of [{'@pulsed/dashboard/overview':{version:99,data:{}}},{'@example/unknown/view':{version:1,data:{}}}]) {
  const svg=sceneToSvg({...original,root:{...original.root,components}});
  const result=hydratePage(page('overview',svg),{snapshot,selected:'',nodes:[],windowMs:60000,width:960,colors});
  assert.equal(result.supported,false);assert.equal(result.svg,svg);
 }
});
