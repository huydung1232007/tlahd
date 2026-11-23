import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

function createMiniDom(){
  const makeEl=(tag='div')=>{
    const sub=new Map();
    const node={
      tagName:tag.toUpperCase(),
      innerHTML:'',textContent:'',value:'',src:'',href:'',download:'',hidden:false,disabled:false,checked:false,open:false,
      dataset:{},style:{},attributes:{},listeners:{},children:[],parentElement:null,
      width:684,height:1872,naturalWidth:684,naturalHeight:1872,
      classList:{set:new Set(),add(...c){c.forEach(x=>this.set.add(x));},remove(...c){c.forEach(x=>this.set.delete(x));},toggle(c,f){const on=f===undefined?!this.set.has(c):!!f;on?this.set.add(c):this.set.delete(c);return on;},contains(c){return this.set.has(c);}},
      querySelector(sel){if(!sub.has(sel))sub.set(sel,makeEl(sel));return sub.get(sel);},
      querySelectorAll(){return[];},
      closest(){return makeEl('label');},
      setAttribute(k,v){this.attributes[k]=String(v);},removeAttribute(k){delete this.attributes[k];},
      addEventListener(k,fn){(this.listeners[k]||(this.listeners[k]=[])).push(fn);},
      removeEventListener(k,fn){if(this.listeners[k])this.listeners[k]=this.listeners[k].filter(f=>f!==fn);},
      replaceChildren(){this.children=[];this.value='';},
      append(child){this.children.push(child);},
      pause(){},load(){},click(){},
      getContext(){return{save(){},restore(){},translate(){},scale(){},rotate(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},arc(){},ellipse(){},rect(){},clip(){},fill(){},stroke(){},fillRect(){},strokeRect(){},clearRect(){},setLineDash(){},fillText(){},drawImage(){},getImageData:(_,__,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})};},
      toDataURL(type='image/webp'){return `data:${type};base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=`;}
    };
    return node;
  };
  return {makeEl};
}

test('Studio ai-use preserves photobooth shots and full AI image across remount, and ai-revert restores original',async()=>{
  const {makeEl}=createMiniDom();
  const store=new Map(),prefs=new Map();
  const selectorCache=new Map();
  const root=makeEl('div');
  root.querySelector=sel=>{if(!selectorCache.has(sel))selectorCache.set(sel,makeEl(sel));return selectorCache.get(sel);};
  root.querySelectorAll=()=>[];
  let usedOutput=null;
  class FakeImage{set src(v){this._src=v;this.naturalWidth=684;this.naturalHeight=1872;this.width=684;this.height=1872;queueMicrotask(()=>this.onload?.());}}
  const context=vm.createContext({
    console,Image:FakeImage,setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},
    document:{activeElement:null,createElement:tag=>makeEl(tag)},
    ChamDrafts:{
      async get(k){return store.get(k)??null;},
      async put(k,v){store.set(k,structuredClone(v));},
      async remove(k){store.delete(k);},
      readPreference:(k,fb)=>prefs.get(k)??fb,
      writePreference:(k,v)=>{prefs.set(k,structuredClone(v));return true;}
    }
  });
  for(const file of ['edit-core.js','frames.js','photo-editor.js','studio-tools.js','studio.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  const shot='data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/vuUAAA=';
  const aiStrip='data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAIAAQAcJaQAA3AA/vuUAAA=';
  store.set('studio:uid-1',{version:1,mode:'booth',look:'ccd',grain:12,stamp:false,count:3,layout:'strip',frame:'#ffffff',frameStyle:'airmail',custom:{title:'An & Bảo',message:'',date:''},aiPrompt:'film look',aiResult:aiStrip,shots:[{image:shot,time:100},{image:shot,time:101},{image:shot,time:102}]});

  context.ChamStudio.mount(root,{draftScope:'uid-1',onUse:img=>{usedOutput=img;},onAI:async()=>({image:aiStrip}),onAIStatus:async()=>({available:true})});
  await new Promise(r=>setTimeout(r,30));
  const clickStudio=async val=>{for(const fn of root.listeners.click||[])await fn({target:{closest:()=>({dataset:{studio:val}})}});};
  await clickStudio('ai-use');

  const savedAfterUse=store.get('studio:uid-1');
  assert.equal(savedAfterUse.mode,'booth','must keep photobooth mode instead of flattening to single photo');
  assert.equal(savedAfterUse.shots.length,3,'must preserve all 3 original booth shots');
  assert.equal(savedAfterUse.aiApplied,aiStrip,'must persist applied AI image');

  // Unmount and remount (simulating switching tabs Chụp -> Ảnh -> Chụp)
  context.ChamStudio.unmount();
  selectorCache.clear();
  context.ChamStudio.mount(root,{draftScope:'uid-1',onUse:img=>{usedOutput=img;},onAI:async()=>({image:aiStrip}),onAIStatus:async()=>({available:true})});
  await new Promise(r=>setTimeout(r,30));
  await clickStudio('use');
  assert.equal(usedOutput,aiStrip,'posting after tab switch must still use the preserved AI image');

  // Revert back to original pre-AI booth composition
  await clickStudio('ai-revert');
  assert.equal(store.get('studio:uid-1').aiApplied,'');
  assert.equal(store.get('studio:uid-1').shots.length,3);
});

test('Studio tools support deleting saved frame templates and favorite prompts',async()=>{
  const {makeEl}=createMiniDom();
  const prefs=new Map([['frames:uid-1',[{name:'Mẫu A',frameStyle:'classic',frame:'#161616',count:3,layout:'strip',custom:{}},{name:'Mẫu B',frameStyle:'love',frame:'#ffffff',count:4,layout:'grid',custom:{}}]],['prompts:uid-1',['Prompt 1','Prompt 2']]]);
  const els=new Map(),root=makeEl('div');
  root.querySelector=sel=>{if(!els.has(sel))els.set(sel,makeEl(sel));return els.get(sel);};
  root.querySelectorAll=()=>[];
  const context=vm.createContext({
    console,setTimeout,clearTimeout,
    document:{activeElement:null,createElement:tag=>makeEl(tag)},
    ChamDrafts:{readPreference:(k,fb)=>prefs.get(k)??fb,writePreference:(k,v)=>{prefs.set(k,structuredClone(v));return true;}},
  });
  for(const file of ['edit-core.js','frames.js','studio-tools.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  const s={frameStyle:'classic',frame:'#ffffff',count:3,layout:'strip',custom:{},aiPrompt:'',aiResult:'',output:''};
  context.ChamStudioTools.mount(root,{state:()=>s,scope:()=>'uid-1',busy:()=>false,changed(){},draft(){}});
  els.get('.saved-frames').value='0';
  root.listeners.click[0]({target:{closest:()=>({dataset:{tool:'delete-frame'}})}});
  assert.deepEqual(prefs.get('frames:uid-1').map(f=>f.name),['Mẫu B']);

  els.get('.saved-prompts').value='1';
  root.listeners.click[0]({target:{closest:()=>({dataset:{tool:'delete-prompt'}})}});
  assert.deepEqual(prefs.get('prompts:uid-1'),['Prompt 1']);
});

test('Video editor keeps single and motion booth drafts separate when switching tabs and restores saved classic frame color',async()=>{
  const {makeEl}=createMiniDom();
  const store=new Map(),prefs=new Map([['frames:uid-1',[{name:'Đen tối giản',frameStyle:'classic',frame:'#161616',layout:'strip',custom:{title:'Chạm'}}]]]);
  const els=new Map(),root=makeEl('div');
  const singleRadio=makeEl('input');singleRadio.checked=true;singleRadio.value='self';
  const blackSwatch=makeEl('button');blackSwatch.dataset.motionColor='#161616';
  root.querySelector=sel=>{
    if(sel.includes('input[name="video-audience"]'))return singleRadio;
    if(!els.has(sel))els.set(sel,makeEl(sel));
    return els.get(sel);
  };
  root.querySelectorAll=sel=>sel==='[data-motion-color]'?[blackSwatch]:[];
  const clipBlob=new Blob([Buffer.from('0000ftypisom0000videocontent')],{type:'video/mp4'});
  store.set('video:uid-1',{version:2,kind:'single',records:[{file:clipBlob,name:'one.mp4',duration:6}],edit:{start:1,end:5,cover:2,mute:true},caption:'Single draft caption',audience:'self'});

  const context=vm.createContext({
    console,Blob,File,URL:{createObjectURL:()=>'blob:mock',revokeObjectURL(){}},AbortController,
    setTimeout:(fn)=>{fn();return 1;},clearTimeout(){},
    fetch:async()=>({ok:true,json:async()=>({available:true})}),
    document:{createElement:tag=>makeEl(tag)},
    ChamDrafts:{
      async get(k){return store.get(k)??null;},
      async put(k,v){store.set(k,v);},
      async remove(k){store.delete(k);},
      readPreference:(k,fb)=>prefs.get(k)??fb,
    }
  });
  for(const file of ['edit-core.js','frames.js','video.js']){
    vm.runInContext(await readFile(new URL('../public/'+file,import.meta.url),'utf8'),context);
  }
  context.ChamVideo.mount(root,{draftScope:'uid-1',onBack(){},onPost:async()=>null});
  await new Promise(r=>setTimeout(r,20));
  assert.equal(els.get('#video-caption').value,'Single draft caption');

  // Switch to Photobooth động: single draft must NOT be erased
  root.listeners.click[0]({target:{closest:()=>({dataset:{videoKind:'booth'}})}});
  assert.equal(els.get('#video-caption').value,'');
  assert.ok(store.get('video:uid-1')?.modes?.single,'single video draft must remain saved while viewing booth tab');

  // Apply saved classic black frame template in booth tab
  const tplSelect=els.get('.motion-template');
  tplSelect.listeners.change[0]({target:{value:'0'}});
  assert.equal(els.get('.booth-frame').value,'classic');
  assert.equal(els.get('.motion-frame-colors').hidden,false);
  assert.equal(blackSwatch.classList.contains('active'),true);

  // Switch back to Video đơn: original clip & caption are immediately restored
  root.listeners.click[0]({target:{closest:()=>({dataset:{videoKind:'single'}})}});
  assert.equal(els.get('#video-caption').value,'Single draft caption');
  assert.equal(els.get('.trim-start').value,1);
  assert.equal(els.get('.trim-end').value,5);
});
