import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readdir,readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

test('prepare-ios builds standalone www bundle with ios-bridge.js and zero secret files',async()=>{
  await exec(process.execPath,['scripts/prepare-ios.mjs'],{windowsHide:true});
  const files=await readdir(new URL('../ios-build/www',import.meta.url));
  assert.ok(files.includes('ios-bridge.js'));
  assert.ok(files.includes('index.html'));
  assert.ok(!files.some(f=>f.startsWith('.env')));
  const html=await readFile(new URL('../ios-build/www/index.html',import.meta.url),'utf8');
  assert.match(html,/<script src="\.\/ios-bridge\.js"><\/script><script src="\.\/drafts\.js"><\/script>/);
});

test('iOS WKWebView JPEG fallback works end-to-end and ios-bridge.js uploads JPEG with base64 dataType',async()=>{
  // 1. Verify ChamEdits.exportCanvas falls back cleanly to JPEG when WebKit returns PNG for image/webp
  const webkitCanvas={toDataURL(type){return type==='image/webp'?'data:image/png;base64,iVBORw0KGgo=':'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/';}};
  const editCtx=vm.createContext({});
  vm.runInContext(await readFile(new URL('../public/edit-core.js',import.meta.url),'utf8'),editCtx);
  assert.match(editCtx.ChamEdits.exportCanvas(webkitCanvas),/^data:image\/jpeg;base64,/);

  // 2. Verify ios-bridge.js standalone Locket login + encrypted session + base64 PUT upload
  const storage=new Map(),capCalls=[];
  const context=vm.createContext({
    __CHAM_IOS_TEST__:true,
    Capacitor:{
      isNativePlatform:()=>true,
      Plugins:{
        CapacitorHttp:{
          async request(opts){
            capCalls.push(opts);
            if(opts.url.includes(':signInWithPassword'))return{status:200,headers:{},data:{localId:'uid-ios',idToken:'id-ios',refreshToken:'ref-ios',email:'ios@example.invalid'}};
            if(opts.url.includes('securetoken.googleapis.com'))return{status:200,headers:{},data:{id_token:'id-ios-2',refresh_token:'ref-ios',user_id:'uid-ios'}};
            if(opts.url.includes('/fetchUserV2'))return{status:200,headers:{},data:{result:{status:200,data:{uid:'uid-ios',first_name:'iPhone',username:'cham_ios'}}}};
            if(opts.url.includes('uploadType=resumable'))return{status:200,headers:{'x-goog-upload-url':'https://firebasestorage.googleapis.com/ios-put'},data:{}};
            if(opts.url.endsWith('/ios-put'))return{status:200,headers:{},data:{downloadTokens:'ios-dl-tok'}};
            if(opts.url.includes('/postMomentV2'))return{status:200,headers:{},data:{result:{status:200,data:{canonical_uid:'ios-moment-1'}}}};
            throw Error('Unexpected CapacitorHttp call: '+opts.url);
          }
        }
      }
    },
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
    crypto:globalThis.crypto,TextEncoder,TextDecoder,URL,URLSearchParams,Response,FormData,Blob,btoa,atob,console,setTimeout,clearTimeout,
    fetch:async()=>{throw Error('Should intercept /api/* via ios-bridge');}
  });
  vm.runInContext(await readFile(new URL('../ios/ios-bridge.js',import.meta.url),'utf8'),context);

  const loginRes=await context.fetch('/api/login',{method:'POST',body:JSON.stringify({email:'ios@example.invalid',password:'pw'})});
  assert.equal(loginRes.status,200);
  assert.equal((await loginRes.json()).profile.name,'iPhone');
  assert.ok(storage.get('cham:ios-session')&&!storage.get('cham:ios-session').includes('ref-ios'),'refresh token must be AES-GCM encrypted at rest');

  const jpgBytes=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,1,1,1,0,72]);
  const jpgData='data:image/jpeg;base64,'+jpgBytes.toString('base64');
  const postRes=await context.fetch('/api/moments',{method:'POST',body:JSON.stringify({image:jpgData,caption:'From iPhone',audience:'selected',recipients:['friend-a'],overlayStyle:'sunset'})});
  assert.equal(postRes.status,200);
  const posted=await postRes.json();
  assert.equal(posted.confirmed,true);
  assert.equal(posted.moment.id,'ios-moment-1');

  const putCall=capCalls.find(c=>c.url.endsWith('/ios-put'));
  assert.equal(putCall.method,'PUT');
  assert.equal(putCall.dataType,'base64','must pass dataType=base64 so CapacitorHttp on iOS does not drop binary bytes');
});
