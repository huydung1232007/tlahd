import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/\ninit\(\);\s*$/,'');
const photo=(id,author='friend-1')=>({id,author,caption:'Caption '+id,image:'https://example.com/'+id+'.webp',time:Date.now()});
function client(fetcher,preparer=async image=>"square:"+image){const elements=new Map(),handlers={},requests=[];function el(key){if(!elements.has(key))elements.set(key,{innerHTML:'',value:'',textContent:'',classList:{add(){},remove(){},contains(){return false;}},addEventListener(){},insertAdjacentHTML(){},setAttribute(){},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(key);}const context=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],addEventListener:(name,fn)=>handlers[name]=fn},window:{scrollTo(){},ChamLocketImage:{prepare:preparer}},URLSearchParams,FormData,Response,console,setTimeout:()=>1,clearTimeout(){},fetch:async(path,options)=>{requests.push(path);return fetcher(path,options);}});const run=s=>vm.runInContext(s,context);run(source);run('booting=false;view="home";account={id:"me",name:"Me"};people=[{id:"friend-1",name:"First"},{id:"friend-2",name:"Second"}];');return{run,requests,element:el,html:()=>el('#main').innerHTML,click:dataset=>handlers.click({target:{closest:()=>({dataset})}})};}
const ok=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}});
test('selecting a friend loads multiple historical photos instead of filtering latest snapshots',async()=>{const c=client(path=>{assert.equal(path,'/api/feed?user=friend-1');return ok({moments:[photo('old-1'),photo('old-2'),photo('old-3')],nextCursor:null,source:'history'});});c.run('timelineFor().items=[{id:"latest",author:"friend-1"}];timelineFor().loaded=true;');await c.click({person:'friend-1'});assert.equal(c.requests.length,1);assert.equal(c.run('timelineFor("friend-1").items.length'),3);assert.match(c.html(),/Caption old-1/);assert.match(c.html(),/Caption old-3/);assert.match(c.html(),/3 ảnh đã tải/);});
test('load-more appends older images, deduplicates overlaps, and stops at the final page',async()=>{let page=0;const c=client(path=>{page++;if(page===1)return ok({moments:[photo('new-1'),photo('old-1')],nextCursor:'page-two',source:'history'});assert.equal(path,'/api/feed?user=friend-1&cursor=page-two');return ok({moments:[photo('old-1'),photo('old-2')],nextCursor:null,source:'history'});});await c.click({person:'friend-1'});assert.match(c.html(),/Tải thêm ảnh/);await c.click({action:'timeline-more'});assert.equal(c.run('timelineFor("friend-1").items.length'),3);assert.equal((c.html().match(/<article class="moment"/g)||[]).length,3);assert.ok(!c.html().includes('data-action="timeline-more"'));assert.match(c.html(),/Đã tải hết ảnh/);});
test('switching friends keeps their photos and cursors separate, including late responses',async()=>{let resolveFirst;const pending=new Promise(r=>resolveFirst=r);const c=client(path=>path.includes('friend-1')?pending:ok({moments:[photo('second-photo','friend-2')],nextCursor:'second-cursor',source:'history'}));const first=c.click({person:'friend-1'});await c.click({person:'friend-2'});resolveFirst(ok({moments:[photo('first-photo')],nextCursor:'first-cursor',source:'history'}));await first;assert.equal(c.run('person'),'friend-2');assert.match(c.html(),/Caption second-photo/);assert.ok(!c.html().includes('Caption first-photo'));assert.equal(c.run('timelineFor("friend-2").nextCursor'),'second-cursor');assert.equal(c.run('timelineFor("friend-1").nextCursor'),'first-cursor');await c.click({person:'friend-1'});assert.equal(c.requests.length,2);assert.match(c.html(),/Caption first-photo/);});
test('failed pagination retains loaded photos and the cursor for retry',async()=>{let calls=0;const c=client(()=>{calls++;if(calls===1)return ok({moments:[photo('keep-this')],nextCursor:'retry-cursor',source:'history'});return new Response(JSON.stringify({error:{code:'UPSTREAM_UNAVAILABLE',message:'Temporary history failure'}}),{status:502});});await c.click({person:'friend-1'});await c.click({action:'timeline-more'});assert.match(c.html(),/Caption keep-this/);assert.match(c.html(),/Temporary history failure/);assert.equal(c.run('timelineFor("friend-1").nextCursor'),'retry-cursor');assert.equal(c.run('timelineFor("friend-1").loading'),false);});
test('a response from the previous account cannot populate the next account timeline',async()=>{let resolve;const pending=new Promise(r=>resolve=r);const c=client(()=>pending);const loading=c.run('loadTimeline("friend-1")');c.run('clearTimelines();account={id:"other-account",name:"Other"};');resolve(ok({moments:[photo('private-old-account-photo')],nextCursor:null,source:'history'}));await loading;assert.equal(c.run('timelines.size'),0);assert.ok(!c.html().includes('private-old-account-photo'));});
test('expired session clears cached photos rather than reusing them in a new login',async()=>{const c=client(()=>new Response(JSON.stringify({error:{code:'AUTH_REQUIRED',message:'Expired'}}),{status:401}));c.run('timelineFor("friend-1").items=[{id:"private"}];');await c.run('loadTimeline("friend-1")');assert.equal(c.run('account'),null);assert.equal(c.run('timelines.size'),0);assert.ok(!c.html().includes('private'));});
test('latest-only fallback is clearly labeled and does not claim complete history',()=>{const c=client(()=>{});c.run('Object.assign(timelineFor(),{items:[],loaded:true,source:"latest"});render();');assert.match(c.html(),/hiện chỉ có ảnh mới nhất/);assert.match(c.html(),/Thử tải lịch sử/);assert.ok(!c.html().includes('Đã tải hết ảnh'));});

test('post dialog previews the prepared square and does not send the original photostrip',async()=>{
  const prepared=[];const c=client(()=>{},async image=>{prepared.push(image);return 'square-result';});
  await c.run('upload("long-photostrip")');
  assert.deepEqual(prepared,['long-photostrip']);assert.equal(c.run('draft'),'square-result');
  assert.match(c.element('#drop-zone').innerHTML,/square-result/);
  assert.equal(c.element('#post-submit').disabled,false);assert.equal(c.requests.length,0);
});
test('closing or replacing the draft prevents a late square conversion from restoring it',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const c=client(()=>{},()=>pending);
  const loading=c.run('upload("old-photostrip")');c.run('uploadGeneration++;modal.open=false;');
  finish('late-square');await loading;assert.equal(c.run('draft'),null);
});
test('image conversion failure leaves no draft available for posting',async()=>{
  const c=client(()=>{},async()=>{throw Error('Cannot read image');});
  await c.run('upload("invalid-image")');assert.equal(c.run('draft'),null);
  assert.equal(c.element('#post-error').hidden,false);assert.equal(c.element('#post-error').textContent,'Cannot read image');
});
test('search box hides on non-searchable views, updates placeholder, and filters memories',async()=>{
  const elements=new Map(),handlers={};
  const el=k=>{if(!elements.has(k))elements.set(k,{innerHTML:'',value:'',textContent:'',hidden:false,placeholder:'',classList:{add(){},remove(){},contains(){return false;}},addEventListener(){},insertAdjacentHTML(){},setAttribute(){},close(){this.open=false;},showModal(){this.open=true;}});return elements.get(k);};
  const ctx=vm.createContext({document:{querySelector:el,querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers[n]=fn},window:{scrollTo(){},ChamLocketImage:{prepare:async x=>x}},URL,URLSearchParams,FormData,Response,console,setTimeout:()=>1,clearTimeout(){},fetch:async()=>ok({moments:[photo('mem-1','me'),photo('mem-2','me')],nextCursor:null,source:'history'})});
  vm.runInContext(source,ctx);
  vm.runInContext('booting=false;account={id:"me",name:"Me"};view="camera";render();',ctx);
  assert.equal(el('.search-box').hidden,true);
  vm.runInContext('view="profile";render();',ctx);
  assert.equal(el('.search-box').hidden,true);assert.match(el('#main').innerHTML,/data-action="copy-uid"/);
  vm.runInContext('view="friends";render();',ctx);
  assert.equal(el('.search-box').hidden,false);assert.equal(el('#search').placeholder,'Tìm bạn bè…');
  await vm.runInContext('navigate("memories")',ctx);
  assert.equal(el('.search-box').hidden,false);assert.equal(el('#search').placeholder,'Tìm ảnh…');
  vm.runInContext('query="mem-2";render();',ctx);
  assert.match(el('#main').innerHTML,/Caption mem-2/);assert.ok(!el('#main').innerHTML.includes('Caption mem-1'));
  await handlers.click({target:{closest:()=>({dataset:{action:'detail',id:'mem-2'}})}});
  assert.match(el('#modal-content').innerHTML,/Mở \/ tải ảnh/);
});
test('friend filter dropdown toggles menu, highlights active selection, and renders compact card metadata',async()=>{
  const c=client(()=>ok({moments:[{id:'m-1',author:'friend-1',caption:'',image:'https://example.com/m-1.webp',time:Date.now()-10*60000}],nextCursor:null,source:'history'}));
  c.run('timelineFor().items=[{id:"m-1",author:"friend-1",caption:"",image:"https://example.com/m-1.webp",time:Date.now()-10*60000}];timelineFor().loaded=true;render();');
  assert.match(c.html(),/Tất cả bạn bè/);
  assert.match(c.html(),/1 ảnh/);
  assert.match(c.html(),/First/);
  assert.match(c.html(),/10 phút/);
  assert.ok(!c.html().includes('friend-dropdown-menu'));
  await c.click({action:'toggle-friend-menu'});
  assert.match(c.html(),/friend-dropdown-menu/);
  assert.match(c.html(),/First/);
  assert.match(c.html(),/Second/);
  await c.click({person:'friend-1'});
  assert.ok(!c.html().includes('friend-dropdown-menu'));
  assert.match(c.html(),/friend-filter-label">First</);
});
test('detail modal supports continuous next/prev navigation, multi-emoji reactions, and viewing who reacted',async()=>{
  const postedBodies=[];
  const c=client((path,opts)=>{
    if(path==='/api/reaction'){postedBodies.push(JSON.parse(opts.body));return ok({ok:true,emoji:'🔥'});}
    if(path.startsWith('/api/reactions?id=mine-1'))return ok({reactions:[{user:'friend-1',emoji:'😍',time:Date.now()}]});
    return ok({reactions:[]});
  });
  c.run('timelineFor().items=[{id:"p-1",author:"friend-1",caption:"Tấm 1",image:"https://example.com/1.webp",time:Date.now()},{id:"p-2",author:"friend-2",caption:"Tấm 2",image:"https://example.com/2.webp",time:Date.now()-60000}];timelineFor().loaded=true;render();');
  await c.click({action:'detail',id:'p-1'});
  assert.match(c.element('#modal-content').innerHTML,/1 \/ 2/);
  assert.match(c.element('#modal-content').innerHTML,/emoji-reaction-bar/);
  await c.click({action:'react',id:'p-1',emoji:'🔥'});
  assert.deepEqual(postedBodies,[{id:'p-1',emoji:'🔥'}]);
  assert.match(c.element('#modal-content').innerHTML,/emoji-react-btn active[^>]*data-emoji="🔥"/);
  await c.click({action:'detail-nav',id:'p-2'});
  assert.match(c.element('#modal-content').innerHTML,/2 \/ 2/);
  assert.match(c.element('#modal-content').innerHTML,/Tấm 2/);

  c.run('filter="mine";timelineFor("me").items=[{id:"mine-1",author:"me",caption:"Ảnh của tôi",image:"https://example.com/m.webp",time:Date.now(),reactions:[{user:"friend-1",emoji:"😍",time:Date.now()}]}];timelineFor("me").loaded=true;render();');
  await c.click({action:'detail',id:'mine-1'});
  assert.match(c.element('#modal-content').innerHTML,/Đã thả cảm xúc \(1\)/);
  assert.match(c.element('#modal-content').innerHTML,/First/);
  assert.match(c.element('#modal-content').innerHTML,/😍/);
});
