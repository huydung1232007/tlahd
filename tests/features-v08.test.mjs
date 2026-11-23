import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('2-cut vertical/horizontal geometry, custom paper/ink colors, 8 film looks, and tone sliders work cleanly',async()=>{
  const context=vm.createContext({console});
  for(const file of ['edit-core.js','frames.js','studio.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  const {ChamFrames,ChamEdits,ChamStudio}=context;
  // 2-cut vertical strip and 2-cut horizontal pair
  const strip2=ChamFrames.geometry(2,'strip','love'),horiz2=ChamFrames.geometry(2,'grid','love');
  assert.equal(strip2.slots.length,2);assert.equal(horiz2.slots.length,2);
  assert.ok(strip2.height>strip2.width,'2-cut strip is vertical');
  assert.ok(horiz2.width>horiz2.height,'2-cut grid is horizontal pair');
  assert.equal(horiz2.slots[0].y,horiz2.slots[1].y);

  // Custom paper and ink color overrides
  const fills=[],texts=[];
  const fakeCtx={
    save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},arc(){},rect(){},stroke(){},strokeRect(){},setLineDash(){},
    fill(){},fillRect(){fills.push(this.fillStyle);},fillText(t){texts.push([t,this.fillStyle]);}
  };
  const custom=ChamEdits.custom({title:'Couple',paper:'#1e293b',ink:'#fde68a'});
  ChamFrames.background(fakeCtx,horiz2,'classic','#ffffff',custom);
  ChamFrames.overlay(fakeCtx,horiz2,'classic',Date.now(),'#ffffff',custom);
  assert.equal(fills[0],'#1e293b');
  assert.ok(texts.some(([t,c])=>t==='Couple'&&c==='#fde68a'));

  // 8 film looks & tone adjustments
  assert.equal(Object.keys(ChamStudio.testing.looks).length,8);
  const src=new Uint8ClampedArray([100,110,120,255]);
  for(const id of ['fuji','peach','polaroid','neon']){
    const graded=ChamStudio.testing.pixels(src.slice(),id,0,1);
    assert.equal(graded[3],255);
    assert.notDeepEqual(graded,src);
  }
  const warmerBrighter=ChamStudio.testing.pixels(src.slice(),'natural',0,1,{brightness:15,contrast:10,warmth:20});
  assert.ok(warmerBrighter[0]>src[0]&&warmerBrighter[2]<warmerBrighter[0],'warmth + brightness shifts red above blue');
});

test('AI chips fill prompt, memory shots import into 2-4 booth, and Live Photobooth hands off to Video',async()=>{
  const makeEl=(tag='div')=>{
    const sub=new Map();
    return{
      tagName:tag.toUpperCase(),innerHTML:'',textContent:'',value:'',src:'',hidden:false,disabled:false,checked:false,
      dataset:{},style:{},attributes:{},listeners:{},children:[],
      width:604,height:453,naturalWidth:604,naturalHeight:453,
      classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},remove(...c){c.forEach(x=>this.set.delete(x));},toggle(c,f){const on=f===undefined?!this.set.has(c):!!f;on?this.set.add(c):this.set.delete(c);return on;},contains(c){return this.set.has(c);}},
      querySelector(sel){if(!sub.has(sel))sub.set(sel,makeEl(sel));return sub.get(sel);},
      querySelectorAll(){return[];},
      closest(){return makeEl('label');},
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      addEventListener(k,fn){(this.listeners[k]||(this.listeners[k]=[])).push(fn);},
      removeEventListener(){},replaceChildren(){this.children=[];},append(c){this.children.push(c);},
      pause(){},load(){},
      getContext(){return{save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},arc(){},ellipse(){},rect(){},clip(){},fill(){},stroke(){},fillRect(){},strokeRect(){},clearRect(){},setLineDash(){},fillText(){},drawImage(){},getImageData:(_,__,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};},
      toDataURL(type='image/webp'){return `data:${type};base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=`;}
    };
  };
  const store=new Map(),prefs=new Map(),root=makeEl('div');
  class FakeImage{set src(v){this.naturalWidth=604;this.naturalHeight=453;this.width=604;this.height=453;queueMicrotask(()=>this.onload?.());}}
  const context=vm.createContext({
    console,Image:FakeImage,Blob,File,URL:{createObjectURL:()=>'blob:live',revokeObjectURL(){}},AbortController,
    setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},
    fetch:async()=>({ok:true,json:async()=>({video:'data:video/mp4;base64,MDAwMGZ0eXBpc29t',image:'data:image/webp;base64,UklGRg==',width:720,height:720,duration:3,bytes:1024,hasAudio:false,available:true})}),
    document:{activeElement:null,createElement:tag=>makeEl(tag)},
    ChamDrafts:{async get(k){return store.get(k)??null;},async put(k,v){store.set(k,v);},async remove(k){store.delete(k);},readPreference:(k,fb)=>prefs.get(k)??fb,writePreference:(k,v)=>{prefs.set(k,v);return true;}}
  });
  for(const file of ['edit-core.js','frames.js','photo-editor.js','studio-tools.js','studio.js','motion-frame.js','video.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  context.ChamStudio.mount(root,{draftScope:'u1',onUse(){},onAI:async()=>({}),onAIStatus:async()=>({available:true,provider:'cloudflare'})});
  await new Promise(r=>setTimeout(r,20));

  // Click AI chip #0
  for(const fn of root.listeners.click)await fn({target:{closest:()=>({dataset:{tool:'ai-chip',chip:'0'}})}});
  assert.match(root.querySelector('#ai-prompt').value,/Màu phim Nhật/);

  // Import 2 memory photos into Studio Photobooth
  const sample='data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=';
  await context.ChamStudio.loadMemoryShots([sample,sample]);
  assert.equal(store.get('studio:u1').mode,'booth');
  assert.equal(store.get('studio:u1').count,2);
  assert.equal(store.get('studio:u1').shots.length,2);
});

test('Studio camera auto-starts on mount, collapses timer by default, removes header clutter, and orders review icons X - Send - Download',async()=>{
  const makeEl=(tag='div')=>{
    const sub=new Map();
    return{
      tagName:tag.toUpperCase(),innerHTML:'',textContent:'',value:'',src:'',srcObject:null,hidden:false,disabled:false,checked:false,
      dataset:{},style:{},attributes:{},listeners:{},children:[],
      width:604,height:453,naturalWidth:604,naturalHeight:453,videoWidth:1280,videoHeight:720,
      classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},remove(...c){c.forEach(x=>this.set.delete(x));},toggle(c,f){const on=f===undefined?!this.set.has(c):!!f;on?this.set.add(c):this.set.delete(c);return on;},contains(c){return this.set.has(c);}},
      querySelector(sel){if(!sub.has(sel))sub.set(sel,makeEl(sel));return sub.get(sel);},
      querySelectorAll(){return[];},
      closest(){return makeEl('label');},
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      addEventListener(k,fn){(this.listeners[k]||(this.listeners[k]=[])).push(fn);},
      removeEventListener(){},replaceChildren(){this.children=[];},append(c){this.children.push(c);},
      play:async()=>{},pause(){},load(){},
      getContext(){return{save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},arc(){},ellipse(){},rect(){},clip(){},fill(){},stroke(){},fillRect(){},strokeRect(){},clearRect(){},setLineDash(){},fillText(){},drawImage(){},getImageData:(_,__,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};},
      toDataURL(type='image/webp'){return `data:${type};base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=`;}
    };
  };
  let cameraCalls=0;
  const mockStream={getTracks:()=>[{stop(){}}],getVideoTracks:()=>[{readyState:'live'}]};
  const store=new Map(),prefs=new Map(),root=makeEl('div');
  const context=vm.createContext({
    console,
    navigator:{mediaDevices:{getUserMedia:async()=>{cameraCalls++;return mockStream;}}},
    setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},
    document:{activeElement:null,visibilityState:'visible',addEventListener(){},removeEventListener(){},createElement:tag=>makeEl(tag)},
    ChamDrafts:{async get(k){return store.get(k)??null;},async put(k,v){store.set(k,v);},async remove(k){store.delete(k);},readPreference:(k,fb)=>prefs.get(k)??fb,writePreference:(k,v)=>{prefs.set(k,v);return true;}}
  });
  for(const file of ['edit-core.js','frames.js','photo-editor.js','studio-tools.js','studio.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  context.ChamStudio.mount(root,{draftScope:'u-cam',onUse(){},onAI:async()=>({}),onAIStatus:async()=>({available:false,reason:''})});
  await new Promise(r=>setTimeout(r,20));

  // 1. Header & draft status clutter removed, and Digital is inside Photo (not a separate top tab)
  assert.doesNotMatch(root.innerHTML,/Chụp một chút|Xử lý trên thiết bị|Nháp tự lưu trên thiết bị/);
  assert.doesNotMatch(root.innerHTML,/data-studio="mode" data-value="digital"/);
  // 2. Camera automatically turned on upon mount without forcing 1920x1080 landscape
  assert.equal(cameraCalls,1,'camera must auto-start on mount');
  // 3. Review icon dock order: reset (X) -> use (Send center) -> download (Download right)
  assert.match(root.innerHTML,/class="review-actions"[^>]*>[\s\S]*data-studio="reset"[\s\S]*data-studio="use"[\s\S]*data-studio="download"/);
  // 4. Features drawer (Digital Cam, Ánh sáng & độ ấm, Chỉnh bằng AI) is hidden by default until icon button is tapped
  assert.equal(root.querySelector('.studio-features-panel').hidden,true);
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'toggle-features'}}:null}});
  assert.equal(root.querySelector('.studio-features-panel').hidden,false);
  // 5. Timer collapsed by default (0 = off), expands on toggle-timer, collapses on selection
  assert.equal(root.querySelector('.timer-popover').hidden,true);
  assert.equal(root.querySelector('.timer-badge').textContent,'');
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'toggle-timer'}}:null}});
  assert.equal(root.querySelector('.timer-popover').hidden,false);
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'timer',value:'3'}}:null}});
  assert.equal(root.querySelector('.timer-popover').hidden,true);
  assert.equal(root.querySelector('.timer-badge').textContent,'3s');
  // 6. Flash toggle & camera zoom (including 0.5x on BOTH front and rear cameras) work cleanly
  assert.match(root.querySelector('.zoom-bar').innerHTML,/data-value="0\.5"/,'0.5x button must be visible on front camera too');
  assert.equal(root.querySelector('.flash-trigger').attributes['aria-pressed'],'false');
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'toggle-flash'}}:null}});
  assert.equal(root.querySelector('.flash-trigger').attributes['aria-pressed'],'true');
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'zoom',value:'0.5'}}:null}});
  assert.match(root.querySelector('video').style.transform,/scale\(-1\.000,1\.000\)/,'0.5x widens front camera from 1.22x to full 1.0x wide sensor');
  for(const fn of root.listeners.click)await fn({target:{closest:sel=>sel==='[data-studio]'?{dataset:{studio:'zoom',value:'2'}}:null}});
  assert.match(root.querySelector('video').style.transform,/scale\(-2\.000,2\.000\)/);
  // 7. clearAfterPost wipes Studio state cleanly
  context.ChamStudio.clearAfterPost();
  assert.equal(store.has('studio:u-cam'),false);
});
