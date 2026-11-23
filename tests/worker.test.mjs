import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';
const origin='https://cham.example';
const env={CHAM_SESSION_SECRET:'automated-test-key-not-used-in-production-123456789'};
const originalFetch=globalThis.fetch;
let calls=[],postPayload,postFailure=false,storageFailure=false,timeoutPost=false,redirectAuth=false,historyRows=null,rejectHistory=false,aiMode='ok',videoFailure=false,videoTokenMissing=false,videoRedirect=false;
const ok=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
function historyDoc(id,user,date='2026-11-22T02:00:00.000Z',owner='uid-alpha'){return {name:`projects/locket-4252a/databases/locket/documents/history/${owner}/entries/${id}`,fields:{user:{stringValue:user},canonical_uid:{stringValue:id},thumbnail_url:{stringValue:'https://example.com/'+id+'.webp'},caption:{stringValue:id==='moment-one'?'Hello Locket':id},date:{timestampValue:date}}};}
globalThis.fetch=async(url,opt={})=>{if(opt.redirect==='error')throw new TypeError('Cloudflare Workers only supports follow or manual redirect modes');url=String(url);calls.push({url,opt});const b=typeof opt.body==='string'?JSON.parse(opt.body.startsWith('{')?opt.body:'{}'):{};
 if(url.startsWith('https://api.cloudflare.com/client/v4/accounts/')){
  if(url.includes('/ai/models/search')){
   if(aiMode==='cf-bad-token')return new Response(JSON.stringify({success:false,errors:[{code:10000,message:'Authentication error for secret-cf-token'}]}),{status:401});
   return ok({success:true,result:[{name:'@cf/black-forest-labs/flux-2-klein-9b'}]});
  }
  if(url.includes('llama-3.1-8b-instruct-fast'))return ok({success:true,result:{response:'Warm Japanese sunset film look, keep original face and framing'}});
  if(aiMode==='cf-bad-token')return new Response(JSON.stringify({success:false,errors:[{code:10000,message:'Authentication error for secret-cf-token'}]}),{status:401});
  if(aiMode==='cf-quota')return new Response(JSON.stringify({success:false,errors:[{code:3036,message:'Daily free neurons quota exceeded'}]}),{status:429});
  if(aiMode==='cf-binary'){
   const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
   return new Response(png,{status:200,headers:{'Content-Type':'image/png'}});
  }
  const jpg=Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]);
  return ok({success:true,result:{image:jpg.toString('base64')}});
 }
 if(url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')){
  if(!url.endsWith(':generateContent'))return ok({name:'models/gemini-2.5-flash-image',supportedGenerationMethods:['generateContent']});
  if(aiMode==='bad-key')return new Response(JSON.stringify({error:{status:'INVALID_ARGUMENT',message:'Do not echo test-Gemini-key',details:[{reason:'API_KEY_INVALID'}]}}),{status:400});
  if(aiMode==='quota')return new Response(JSON.stringify({error:{status:'RESOURCE_EXHAUSTED'}}),{status:429});
  if(aiMode==='forbidden')return new Response('{}',{status:403});
  if(aiMode==='unavailable')return new Response('{}',{status:503});
  if(aiMode==='blocked')return ok({promptFeedback:{blockReason:'SAFETY'}});
  if(aiMode==='text-only')return ok({candidates:[{finishReason:'STOP',content:{parts:[{text:'No edited image'}]}}]});
  if(aiMode==='invalid')return ok({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.from('not an image').toString('base64')}}]}}]});
  if(aiMode==='thought-only')return ok({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,inlineData:{mimeType:'image/webp',data:Buffer.from('RIFF0000WEBPVP8 thought').toString('base64')}}]}}]});
  const mime=aiMode==='png'?'image/png':aiMode==='jpeg'?'image/jpeg':'image/webp',bytes=mime==='image/png'?Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]):mime==='image/jpeg'?Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]):Buffer.from('RIFF0000WEBPVP8 edited result');
  return ok({candidates:[{finishReason:'STOP',content:{parts:[{text:'Edited image'},{inlineData:{mimeType:mime,data:bytes.toString('base64')}}]}}]});
 }
 if(url.includes(':signInWithPassword')){if(redirectAuth)return new Response(null,{status:302,headers:{Location:'https://untrusted.example/collect'}});if(b.password==='wrong')return new Response(JSON.stringify({error:{message:'INVALID_LOGIN_CREDENTIALS'}}),{status:400});const uid=b.email.startsWith('beta')?'uid-beta':b.email.startsWith('ai-')?b.email.split('@')[0]:'uid-alpha';return ok({idToken:'test-id-'+uid,refreshToken:'test-refresh-'+uid,localId:uid,email:b.email,expiresIn:'3600'});}
 if(url.includes('securetoken.googleapis.com')){const token=new URLSearchParams(opt.body).get('refresh_token');const uid=token.slice('test-refresh-'.length);return ok({id_token:'test-id-'+uid,refresh_token:token,user_id:uid});}
 if(url.includes('/fetchUserV2'))return ok({result:{status:200,data:{uid:b.data.user_uid,first_name:b.data.user_uid==='uid-beta'?'Beta':'Alpha',username:'test',profile_picture_url:'https://example.com/avatar.jpg'}}});
 if(url.includes('/friends?'))return ok({documents:[{name:'users/uid-alpha/friends/friend-1'}]});
 if(url.includes('/getLatestMomentV2'))return ok({result:{status:200,data:[{canonical_uid:'moment-one',user:'friend-1',thumbnail_url:'https://example.com/photo.webp',date:{_seconds:1760000000},overlays:[{overlay_type:'caption',data:{text:'Hello Locket'}}]}]}});
 if(url.includes(':runQuery')){if(rejectHistory)return new Response(JSON.stringify({error:{message:'PERMISSION_DENIED'}}),{status:403});const q=b.structuredQuery,owner=url.includes('/uid-beta:')?'uid-beta':'uid-alpha',user=q.where?.fieldFilter.value.stringValue;let docs=(historyRows||[historyDoc('moment-one','friend-1',undefined,owner),historyDoc('own-one',owner,'2026-11-22T01:00:00.000Z',owner)]).filter(d=>!user||d.fields.user.stringValue===user).sort((a,b)=>b.fields.date.timestampValue.localeCompare(a.fields.date.timestampValue)||b.name.localeCompare(a.name));if(q.startAt){assert.equal(q.startAt.before,false);const index=docs.findIndex(d=>d.name===q.startAt.values[1].referenceValue);assert.notEqual(index,-1);docs=docs.slice(index+1);}return ok(docs.slice(0,q.limit).map(document=>({document})));}
 if(url.includes('/b/locket-video/o/')&&url.includes('uploadType=resumable')){if(videoFailure)return new Response('{}',{status:403});return new Response('{}',{headers:{'x-goog-upload-url':videoRedirect?'https://evil.invalid/upload':'https://firebasestorage.googleapis.com/video-session'}});}
 if(url.endsWith('/video-session'))return ok(videoTokenMissing?{}:{downloadTokens:'test-video-token'});
 if(url.includes('/b/locket-video/o/'))return ok({});
 if(url.startsWith('https://firebasestorage.googleapis.com/v0/b/locket-img/o/memory-ok'))return new Response(Buffer.from('RIFF0000WEBPVP8 memory photo'),{status:200,headers:{'Content-Type':'image/webp'}});
 if(url.includes('uploadType=resumable')){if(storageFailure)return new Response('{}',{status:403});return new Response('{}',{headers:{'x-goog-upload-url':'https://firebasestorage.googleapis.com/upload-session'}});}
 if(url.endsWith('/upload-session'))return ok({downloadTokens:'test-download-token'});
 if(url.includes('/postMomentV2')){postPayload=b.data;if(timeoutPost)throw Error('simulated timeout');return ok({result:{status:200,data:postFailure?{}:{canonical_uid:'confirmed-id'}}});}
 if(url.includes('/reactToMoment'))return ok({result:{status:200,data:{ok:true}}});
 throw Error('Unexpected upstream request '+url);
};
let requestId=1;
const req=(path,{method='GET',body,cookie,originHeader=origin,ip}={})=>new Request(origin+'/api/'+path,{method,headers:{...(method==='POST'?{'Origin':originHeader,'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{}),'cf-connecting-ip':ip||'test-'+requestId++},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
const perform=(path,args)=>worker.fetch(req(path,args),env,{});
async function signIn(email='alpha@example.invalid'){const r=await perform('login',{method:'POST',body:{email,password:'test-password'}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
const webp='data:image/webp;base64,'+Buffer.from('RIFF0000WEBPVP8 test image content').toString('base64');
test('Locket integration and account boundary',async t=>{
 await t.test('requires login and never exposes a token',async()=>{const r=await perform('session');assert.equal(r.status,401);assert.equal((await r.json()).error.code,'AUTH_REQUIRED');});
 let cookieA,cookieB;
 await t.test('login produces encrypted HttpOnly per-browser session',async()=>{const r=await perform('login',{method:'POST',body:{email:'alpha@example.invalid',password:'test-password'}});assert.equal(r.status,200);const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Strict/);assert.ok(c.length<4096);assert.ok(!c.includes('test-refresh'));assert.ok(!c.includes('uid-alpha'));assert.ok(!c.includes('test-password'));const body=await r.text();assert.ok(!body.includes('idToken'));assert.ok(!body.includes('refreshToken'));cookieA=c.split(';')[0];cookieB=await signIn('beta@example.invalid');});
 await t.test('refresh validates identity and keeps accounts separate',async()=>{const a=await(await perform('session',{cookie:cookieA})).json(),b=await(await perform('session',{cookie:cookieB})).json();assert.equal(a.profile.id,'uid-alpha');assert.equal(b.profile.id,'uid-beta');});
 await t.test('rejects tampered cookie without upstream requests',async()=>{const length=calls.length;const r=await perform('session',{cookie:cookieA.slice(0,-5)+'abcde'});assert.equal(r.status,401);assert.equal(calls.length,length);});
 await t.test('loads actual normalized feed and friends',async()=>{const r=await perform('bootstrap',{cookie:cookieA});assert.equal(r.status,200);const d=await r.json();assert.equal(d.moments[0].caption,'Hello Locket');assert.equal(d.moments[0].author,'friend-1');assert.equal(d.friends[0].id,'friend-1');assert.deepEqual(d.warnings,[]);});
 await t.test('history query is scoped to authenticated uid',async()=>{const r=await perform('history',{cookie:cookieA});assert.equal(r.status,200);assert.equal((await r.json()).moments[0].author,'uid-alpha');const call=calls.findLast(c=>c.url.includes(':runQuery'));assert.equal(JSON.parse(call.opt.body).structuredQuery.where.fieldFilter.value.stringValue,'uid-alpha');});
 await t.test('received history paginates through multiple older photos with tied timestamps',async()=>{historyRows=Array.from({length:7},(_,i)=>historyDoc('entry-'+i,i%2?'friend-2':'friend-1'));try{let cursor=null;const ids=[];do{const r=await perform('feed?limit=2'+(cursor?'&cursor='+encodeURIComponent(cursor):''),{cookie:cookieA});assert.equal(r.status,200);const page=await r.json();assert.equal(page.source,'history');assert.ok(page.moments.every(p=>p.author.startsWith('friend-')));ids.push(...page.moments.map(p=>p.id));cursor=page.nextCursor;}while(cursor);assert.deepEqual(ids,['entry-6','entry-5','entry-4','entry-3','entry-2','entry-1','entry-0']);assert.equal(new Set(ids).size,7);const query=JSON.parse(calls.findLast(c=>c.url.includes(':runQuery')).opt.body).structuredQuery;assert.deepEqual(query.orderBy.map(o=>o.field.fieldPath),['date','__name__']);}finally{historyRows=null;}});
 await t.test('selecting a friend queries their shared history in the viewer account',async()=>{historyRows=Array.from({length:8},(_,i)=>historyDoc('friend-photo-'+i,i%2?'friend-2':'friend-1'));try{const first=await(await perform('feed?user=friend-1&limit=2',{cookie:cookieA})).json();assert.equal(first.moments.length,2);assert.ok(first.nextCursor);const second=await(await perform('feed?user=friend-1&limit=2&cursor='+encodeURIComponent(first.nextCursor),{cookie:cookieA})).json();assert.equal(second.moments.length,2);assert.equal(second.nextCursor,null);assert.ok([...first.moments,...second.moments].every(p=>p.author==='friend-1'));const queryCall=calls.findLast(c=>c.url.includes(':runQuery'));assert.match(queryCall.url,/history\/uid-alpha:runQuery/);assert.equal(JSON.parse(queryCall.opt.body).structuredQuery.where.fieldFilter.value.stringValue,'friend-1');const count=calls.filter(c=>c.url.includes(':runQuery')).length;assert.equal((await perform('feed?user=friend-2&cursor='+encodeURIComponent(first.nextCursor),{cookie:cookieA})).status,400);assert.equal((await perform('feed?user=friend-1&cursor='+encodeURIComponent(first.nextCursor),{cookie:cookieB})).status,400);assert.equal(calls.filter(c=>c.url.includes(':runQuery')).length,count);}finally{historyRows=null;}});
 await t.test('empty history, malformed cursors and invalid limits have explicit results',async()=>{historyRows=[];try{const r=await perform('feed',{cookie:cookieA});assert.equal(r.status,200);assert.deepEqual(await r.json(),{moments:[],nextCursor:null,source:'history'});for(const path of ['feed?cursor=invalid','feed?limit=0','feed?limit=51','feed?user=bad%2Fpath'])assert.equal((await perform(path,{cookie:cookieA})).status,400);}finally{historyRows=null;}});
 await t.test('history failure is not reported as an empty successful page',async()=>{rejectHistory=true;try{assert.equal((await perform('feed',{cookie:cookieA})).status,502);const r=await perform('bootstrap',{cookie:cookieA});assert.equal(r.status,200);const data=await r.json();assert.equal(data.feedSource,'latest');assert.equal(data.nextCursor,null);assert.equal(data.moments[0].id,'moment-one');}finally{rejectHistory=false;}});
 await t.test('sends WebP to user storage and creates a confirmed Locket moment',async()=>{const r=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'A real caption',audience:'all'}});assert.equal(r.status,200);const d=await r.json();assert.equal(d.confirmed,true);assert.equal(d.moment.id,'confirmed-id');assert.equal(d.moment.author,'uid-alpha');assert.equal(postPayload.sent_to_all,true);assert.equal(postPayload.sent_to_self_only,false);assert.equal(postPayload.overlays[0].data.text,'A real caption');assert.match(postPayload.thumbnail_url,/users%2Fuid-alpha%2Fmoments/);assert.match(postPayload.thumbnail_url,/test-download-token/);});
 await t.test('self-only choice is sent to Locket',async()=>{await perform('moments',{method:'POST',cookie:cookieB,body:{image:webp,caption:'',audience:'self'}});assert.equal(postPayload.sent_to_all,false);assert.equal(postPayload.sent_to_self_only,true);assert.match(postPayload.thumbnail_url,/users%2Fuid-beta%2Fmoments/);});
 await t.test('no fake success on unconfirmed post',async()=>{postFailure=true;const r=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'',audience:'self'}});postFailure=false;assert.equal(r.status,502);assert.equal((await r.json()).error.code,'POST_UNCONFIRMED');});
 await t.test('storage failure never creates a moment',async()=>{storageFailure=true;const count=calls.filter(c=>c.url.includes('/postMomentV2')).length;const r=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'',audience:'self'}});storageFailure=false;assert.equal(r.status,502);assert.equal(calls.filter(c=>c.url.includes('/postMomentV2')).length,count);});
 await t.test('uncertain connection result warns against duplicate retry',async()=>{timeoutPost=true;const r=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'',audience:'self'}});timeoutPost=false;assert.equal((await r.json()).error.code,'POST_UNCONFIRMED');});
 await t.test('CSRF rejects foreign-origin mutations before touching upstream',async()=>{const count=calls.length;const r=await perform('moments',{method:'POST',cookie:cookieA,originHeader:'https://evil.example',body:{image:webp,audience:'all'}});assert.equal(r.status,403);assert.equal(calls.length,count);});
 await t.test('rejects oversized login bodies, URL images, fake WebP and invalid audience',async()=>{assert.equal((await perform('login',{method:'POST',body:'x'.repeat(9000)})).status,413);for(const body of [{image:'https://example.com/p.webp',audience:'all'},{image:'data:image/webp;base64,ZmFrZQ==',audience:'all'},{image:webp,audience:'strangers'}])assert.equal((await perform('moments',{method:'POST',cookie:cookieA,body})).status,400);});
 await t.test('login errors are sanitized, no cookie is created',async()=>{const r=await perform('login',{method:'POST',body:{email:'alpha@example.invalid',password:'wrong'}});assert.equal(r.status,401);assert.equal((await r.json()).error.code,'INVALID_CREDENTIALS');assert.equal(r.headers.get('set-cookie'),null);});
 await t.test('refuses redirects without forwarding password to a new host',async()=>{redirectAuth=true;let r;try{r=await perform('login',{method:'POST',body:{email:'alpha@example.invalid',password:'test-password'}});}finally{redirectAuth=false;}assert.equal(r.status,502);assert.equal((await r.json()).error.code,'UPSTREAM_REDIRECT');assert.equal(r.headers.get('set-cookie'),null);assert.ok(!calls.some(c=>c.url.startsWith('https://untrusted.example/')));assert.equal(calls.at(-1).opt.redirect,'manual');});
 await t.test('rate limits repeated login attempts',async()=>{for(let i=0;i<10;i++)await perform('login',{method:'POST',ip:'same-ip-rate-test',body:{email:'alpha@example.invalid',password:'wrong'}});const r=await perform('login',{method:'POST',ip:'same-ip-rate-test',body:{email:'alpha@example.invalid',password:'wrong'}});assert.equal(r.status,429);});
 await t.test('logout clears secure cookie',async()=>{const r=await perform('logout',{method:'POST',cookie:cookieA,body:{}});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);});
 await t.test('Gemini stays private to owner and sends image editing JSON without exposing its key',async()=>{
  const aiEnv={...env,GEMINI_API_KEY:'test-Gemini-key',CHAM_AI_OWNER_UID:'uid-alpha'};
  const count=calls.filter(c=>c.url.includes('generativelanguage.googleapis.com')).length;
  const blocked=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieB,body:{image:webp,prompt:'Warm film look'}}),aiEnv,{});assert.equal(blocked.status,403);assert.equal(calls.filter(c=>c.url.includes('generativelanguage.googleapis.com')).length,count);
  const status=await worker.fetch(req('ai/status',{cookie:cookieA}),aiEnv,{});assert.equal(status.status,200);const statusText=await status.text();assert.ok(!statusText.includes('test-Gemini-key'));assert.equal(JSON.parse(statusText).available,true);assert.equal(JSON.parse(statusText).provider,'gemini');
  const edited=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieA,body:{image:webp,prompt:'Warm film look'}}),aiEnv,{});assert.equal(edited.status,200);assert.match((await edited.json()).image,/^data:image\/webp;base64,/);
  const call=calls.findLast(c=>c.url.endsWith(':generateContent'));assert.equal(call.opt.headers['x-goog-api-key'],'test-Gemini-key');assert.ok(!call.url.includes('test-Gemini-key'));assert.equal(call.opt.headers.Authorization,undefined);const payload=JSON.parse(call.opt.body);assert.equal(payload.contents[0].parts[0].text,'Warm film look');assert.equal(payload.contents[0].parts[1].inlineData.mimeType,'image/webp');assert.equal(payload.contents[0].parts[1].inlineData.data,webp.slice(23));assert.deepEqual(payload.generationConfig.responseModalities,['TEXT','IMAGE']);
  const invalid=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieA,body:{image:'https://example.com/x',prompt:'x'}}),aiEnv,{});assert.equal(invalid.status,400);
  aiMode='bad-key';const failed=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieA,body:{image:webp,prompt:'x'}}),aiEnv,{});aiMode='ok';assert.equal(failed.status,502);const error=await failed.text();assert.ok(!error.includes('test-Gemini-key'));assert.equal(JSON.parse(error).error.code,'AI_KEY_INVALID');
  assert.ok(!calls.some(c=>c.url.includes('api.openai.com')));
 });
 await t.test('Gemini accepts PNG and JPEG outputs while rejecting malformed images and text-only results',async()=>{
  const owner='ai-output',cookie=await signIn(owner+'@example.invalid'),aiEnv={...env,GEMINI_API_KEY:'test-Gemini-output-key',CHAM_AI_OWNER_UID:owner};
  try{for(const [mode,status,code]of[['png',200],['jpeg',200],['invalid',502,'AI_INVALID_RESPONSE'],['text-only',502,'AI_NO_IMAGE'],['thought-only',502,'AI_NO_IMAGE']]){aiMode=mode;const response=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Warm film'}}),aiEnv,{});assert.equal(response.status,status);const data=await response.json();if(code)assert.equal(data.error.code,code);else assert.ok(data.image.startsWith('data:image/'+mode+';base64,'));}}finally{aiMode='ok';}
 });
 await t.test('Gemini reports quota, permission, safety and service failures without reflecting provider messages',async()=>{
  const owner='ai-errors',cookie=await signIn(owner+'@example.invalid'),aiEnv={...env,GEMINI_API_KEY:'test-Gemini-error-key',CHAM_AI_OWNER_UID:owner};
  try{for(const [mode,status,code]of[['quota',429,'AI_QUOTA'],['forbidden',403,'AI_MODEL_ACCESS'],['blocked',422,'AI_CONTENT_BLOCKED'],['unavailable',502,'AI_UNAVAILABLE']]){aiMode=mode;const response=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Warm film'}}),aiEnv,{});assert.equal(response.status,status);const text=await response.text();assert.equal(JSON.parse(text).error.code,code);assert.ok(!text.includes('test-Gemini-error-key'));}}finally{aiMode='ok';}
 });
 await t.test('Gemini remains disabled without an owner UID and rejects invalid model paths',async()=>{
  const before=calls.length;const missingOwner=await worker.fetch(req('ai/status',{cookie:cookieA}),{...env,GEMINI_API_KEY:'test-key'},{});assert.equal((await missingOwner.json()).available,false);const invalid=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieA,body:{image:webp,prompt:'x'}}),{...env,GEMINI_API_KEY:'test-key',CHAM_AI_OWNER_UID:'uid-alpha',GEMINI_IMAGE_MODEL:'../outside'},{});assert.equal(invalid.status,503);assert.equal(calls.filter(c=>c.url.includes('generativelanguage.googleapis.com')).length,calls.slice(0,before).filter(c=>c.url.includes('generativelanguage.googleapis.com')).length);
 });
 await t.test('Gemini upstream and key errors do not consume hourly AI quota while successful edits enforce 5/hour',async()=>{
  const owner='ai-quota-rollback',cookie=await signIn(owner+'@example.invalid'),aiEnv={...env,GEMINI_API_KEY:'test-Gemini-quota-key',CHAM_AI_OWNER_UID:owner};
  try{
   for(const mode of ['bad-key','quota','forbidden','unavailable','bad-key','unavailable']){
    aiMode=mode;const failed=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Test'}}),aiEnv,{});
    assert.notEqual(failed.status,429===failed.status&&mode!=='quota'?429:0);
    assert.notEqual((await failed.json()).error.code,'AI_RATE_LIMIT');
   }
   aiMode='ok';
   for(let i=0;i<5;i++){const okRes=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Edit '+i}}),aiEnv,{});assert.equal(okRes.status,200);}
   const limited=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Edit 6'}}),aiEnv,{});
   assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'AI_RATE_LIMIT');
  }finally{aiMode='ok';}
 });
 await t.test('Cloudflare Workers AI runs owner-only FLUX.2 multipart edits, hides credentials, and takes priority over dead Gemini keys',async()=>{
  const owner='ai-cf-owner',cookie=await signIn(owner+'@example.invalid');
  const cfEnv={...env,CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',CLOUDFLARE_API_TOKEN:'secret-cf-token',GEMINI_API_KEY:'unused-free-gemini-key',CHAM_AI_OWNER_UID:owner};
  try{
   const blocked=await worker.fetch(req('ai/edit',{method:'POST',cookie:cookieB,body:{image:webp,prompt:'Warm sunlight'}}),cfEnv,{});
   assert.equal(blocked.status,403);
   const status=await worker.fetch(req('ai/status',{cookie}),cfEnv,{});
   assert.equal(status.status,200);const statusText=await status.text();
   assert.ok(!statusText.includes('secret-cf-token'));assert.ok(!statusText.includes('0123456789abcdef'));
   assert.equal(JSON.parse(statusText).provider,'cloudflare');

   const edited=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Warm film tones'}}),cfEnv,{});
   assert.equal(edited.status,200);const editedJson=await edited.json();
   assert.equal(editedJson.provider,'cloudflare');assert.match(editedJson.image,/^data:image\/jpeg;base64,/);
   const cfCall=calls.findLast(c=>c.url.includes('/ai/run/@cf/black-forest-labs/flux-2-klein-9b'));
   assert.ok(cfCall);assert.equal(cfCall.opt.headers.Authorization,'Bearer secret-cf-token');
   assert.match(cfCall.opt.headers['Content-Type'],/^multipart\/form-data;\s*boundary=/);
   const parsedForm=await new Response(cfCall.opt.body,{headers:{'Content-Type':cfCall.opt.headers['Content-Type']}}).formData();
   assert.equal(parsedForm.get('prompt'),'Warm film tones');
   assert.ok(parsedForm.get('input_image_0') instanceof Blob);

   aiMode='cf-binary';
   const binRes=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Soft mono'}}),{...cfEnv,CLOUDFLARE_IMAGE_MODEL:'@cf/runwayml/stable-diffusion-v1-5-img2img'},{});
   assert.equal(binRes.status,200);assert.match((await binRes.json()).image,/^data:image\/png;base64,/);

   aiMode='cf-bad-token';
   const badTok=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Test'}}),cfEnv,{});
   assert.equal(badTok.status,502);const badText=await badTok.text();
   assert.ok(!badText.includes('secret-cf-token'));assert.equal(JSON.parse(badText).error.code,'AI_KEY_INVALID');

   aiMode='cf-quota';
   const quotaRes=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Test'}}),cfEnv,{});
   assert.equal(quotaRes.status,429);assert.equal((await quotaRes.json()).error.code,'AI_QUOTA');

   const badPath=await worker.fetch(req('ai/edit',{method:'POST',cookie,body:{image:webp,prompt:'Test'}}),{...cfEnv,CLOUDFLARE_ACCOUNT_ID:'../escape'},{});
   assert.equal(badPath.status,503);
  }finally{aiMode='ok';}
 });
 await t.test('video uploads use the owner video bucket and include thumbnail and video URLs',async()=>{
   const video='data:video/mp4;base64,'+Buffer.from('0000ftypisom0000videocontent').toString('base64');
   const r=await perform('videos',{method:'POST',cookie:cookieA,body:{video,image:webp,duration:2,caption:'Moving day',audience:'self'}});
   assert.equal(r.status,200);const data=await r.json();assert.equal(data.confirmed,true);assert.match(data.moment.video,/locket-video/);assert.match(postPayload.video_url,/test-video-token/);assert.match(postPayload.thumbnail_url,/locket-img/);assert.equal(postPayload.sent_to_self_only,true);assert.equal(postPayload.sent_to_all,false);
   const start=calls.findLast(c=>c.url.includes('locket-video')&&c.url.includes('uploadType'));assert.match(start.url,/users%2Fuid-alpha%2Fmoments%2Fvideos%2F/);assert.equal(start.opt.headers['x-goog-upload-content-type'],'video/mp4');
 });
 await t.test('invalid video and absent thumbnail never start a media upload',async()=>{
   const video='data:video/mp4;base64,'+Buffer.from('0000ftypisom0000videocontent').toString('base64');
   const before=calls.filter(c=>c.url.includes('uploadType')).length;
   for(const body of [{video:'https://external.invalid/v.mp4',image:webp,duration:2,audience:'self'},{video,image:webp,duration:16,audience:'self'},{video,image:'bad-poster',duration:2,audience:'self'}])assert.equal((await perform('videos',{method:'POST',cookie:cookieA,body})).status,400);
   assert.equal(calls.filter(c=>c.url.includes('uploadType')).length,before);
 });
 await t.test('failed video storage, missing download token or foreign upload host never create a moment',async()=>{
   const video='data:video/mp4;base64,'+Buffer.from('0000ftypisom0000videocontent').toString('base64');
   for(const mode of ['storage','token','redirect']){videoFailure=mode==='storage';videoTokenMissing=mode==='token';videoRedirect=mode==='redirect';const before=calls.filter(c=>c.url.includes('postMomentV2')).length;try{assert.equal((await perform('videos',{method:'POST',cookie:cookieA,body:{video,image:webp,duration:2,audience:'self'}})).status,502);assert.equal(calls.filter(c=>c.url.includes('postMomentV2')).length,before);assert.ok(!calls.some(c=>c.url.includes('evil.invalid')));}finally{videoFailure=videoTokenMissing=videoRedirect=false;}}
 });
 await t.test('video does not report success without a confirmed moment ID',async()=>{
   const video='data:video/mp4;base64,'+Buffer.from('0000ftypisom0000videocontent').toString('base64');postFailure=true;
   try{const r=await perform('videos',{method:'POST',cookie:cookieA,body:{video,image:webp,duration:2,audience:'self'}});assert.equal(r.status,502);assert.equal((await r.json()).error.code,'POST_UNCONFIRMED');}finally{postFailure=false;}
 });
 await t.test('supports selected-friend recipients, Locket caption overlay styles, memory proxy, and Vietnamese CF prompt translation',async()=>{
  const selRes=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'Secret note',audience:'selected',recipients:['friend-1','friend-2','friend-1'],overlayStyle:'matcha'}});
  assert.equal(selRes.status,200);
  assert.equal(postPayload.sent_to_all,false);assert.equal(postPayload.sent_to_self_only,false);
  assert.deepEqual(postPayload.recipients,['friend-1','friend-2']);
  assert.equal(postPayload.overlays[0].overlay_id,'caption:party');
  assert.equal(postPayload.overlays[0].data.text_color,'#243319');
  assert.deepEqual(postPayload.overlays[0].data.background.colors,['#DCECCB','#B7D99C']);

  const timeRes=await perform('moments',{method:'POST',cookie:cookieA,body:{image:webp,caption:'',audience:'self',overlayStyle:'time',timeLabel:'12:30'}});
  assert.equal(timeRes.status,200);
  assert.equal(postPayload.overlays[0].data.text,'🕒 12:30');

  for(const bad of [{image:webp,audience:'selected',recipients:[]},{image:webp,audience:'selected',recipients:['uid-alpha']},{image:webp,audience:'self',overlayStyle:'unknown'}]){
   assert.equal((await perform('moments',{method:'POST',cookie:cookieA,body:bad})).status,400);
  }

  const memOk=await perform('moment-image',{method:'POST',cookie:cookieA,body:{url:'https://firebasestorage.googleapis.com/v0/b/locket-img/o/memory-ok.webp?alt=media'}});
  assert.equal(memOk.status,200);assert.match((await memOk.json()).image,/^data:image\/webp;base64,/);
  const memBad=await perform('moment-image',{method:'POST',cookie:cookieA,body:{url:'https://evil.invalid/v0/b/locket-img/o/x.webp'}});
  assert.equal(memBad.status,400);

  const viOwner='ai-cf-vi',viCookie=await signIn(viOwner+'@example.invalid');
  const cfEnv={...env,CLOUDFLARE_ACCOUNT_ID:'0123456789abcdef0123456789abcdef',CLOUDFLARE_API_TOKEN:'secret-cf-token',CHAM_AI_OWNER_UID:viOwner};
  const viRes=await worker.fetch(req('ai/edit',{method:'POST',cookie:viCookie,body:{image:webp,prompt:'Màu phim Nhật nắng chiều ấm áp'}}),cfEnv,{});
  assert.equal(viRes.status,200);
  const fluxCall=calls.findLast(c=>c.url.includes('/ai/run/@cf/black-forest-labs/flux-2-klein-9b'));
  const form=await new Response(fluxCall.opt.body,{headers:{'Content-Type':fluxCall.opt.headers['Content-Type']}}).formData();
  assert.equal(form.get('prompt'),'Warm Japanese sunset film look, keep original face and framing');
 });
 await t.test('unconfigured server fails closed',async()=>{const r=await worker.fetch(req('login',{method:'POST',body:{email:'alpha@example.invalid',password:'test'}}),{},{});assert.equal(r.status,503);assert.equal((await r.json()).error.code,'NOT_CONFIGURED');});
});
test.after(()=>{globalThis.fetch=originalFetch;});
