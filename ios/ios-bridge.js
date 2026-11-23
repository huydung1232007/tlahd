/* Standalone native iOS runtime for Chạm (.ipa via Capacitor).
 * Runs Locket API, on-device MP4 Canvas encoder, and optional Cloudflare AI directly on iPhone (4G/Wi-Fi, no PC server required).
 * Zero credentials are embedded in source or build artifacts.
 */
(function(global){
'use strict';
const isNative=()=>!!(global.Capacitor?.isNativePlatform?.()||global.__CHAM_IOS_TEST__);
if(!isNative())return;

const KEY='AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So';
const APP_ID='1:641029076083:ios:cc8eb46290d69b234fa606';
const AUTH='https://identitytoolkit.googleapis.com/v1/accounts';
const STORAGE='https://firebasestorage.googleapis.com/v0/b/locket-img/o';
const VIDEO_STORAGE='https://firebasestorage.googleapis.com/v0/b/locket-video/o';
const CF_BASE='https://api.cloudflare.com/client/v4/accounts/';
const TTL=7*24*3600*1000;
const enc=new TextEncoder(),dec=new TextDecoder();
const nativeFetch=global.fetch.bind(global);

class ApiError extends Error{constructor(status,message,code='ERROR'){super(message);this.status=status;this.code=code;}}
const bytesToB64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
const b64ToBytes=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
const b64url=bytes=>bytesToB64(bytes).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url=s=>b64ToBytes(s.replace(/-/g,'+').replace(/_/g,'/'));

function detectMime(bytes){
 if(!bytes||bytes.length<12)return null;
 if(bytes.slice(0,8).every((n,i)=>n===[137,80,78,71,13,10,26,10][i]))return'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(dec.decode(bytes.slice(0,4))==='RIFF'&&dec.decode(bytes.slice(8,12))==='WEBP')return'image/webp';
 return null;
}
async function deviceKey(){
 let raw=localStorage.getItem('cham:ios-secret');
 if(!raw||raw.length<32){raw=b64url(crypto.getRandomValues(new Uint8Array(32)));localStorage.setItem('cham:ios-secret',raw);}
 const hash=await crypto.subtle.digest('SHA-256',enc.encode(raw));
 return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);
}
async function saveSession(s){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deviceKey(),enc.encode(JSON.stringify({uid:s.uid,refreshToken:s.refreshToken,installation:s.installation,expires:s.expires})));
 localStorage.setItem('cham:ios-session',b64url(iv)+'.'+b64url(new Uint8Array(ct)));
}
async function loadSession(){
 const raw=localStorage.getItem('cham:ios-session');
 if(!raw)throw new ApiError(401,'Đăng nhập Locket để tiếp tục.','AUTH_REQUIRED');
 try{
  const [ivPart,ctPart]=raw.split('.');
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64url(ivPart)},await deviceKey(),unb64url(ctPart));
  const s=JSON.parse(dec.decode(plain));
  if(!s.uid||!s.refreshToken||s.expires<Date.now())throw Error();
  return s;
 }catch{localStorage.removeItem('cham:ios-session');throw new ApiError(401,'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.','AUTH_REQUIRED');}
}

async function httpRequest({url,method='GET',headers={},data,dataType,responseType}){
 const capHttp=global.Capacitor?.Plugins?.CapacitorHttp;
 if(!capHttp?.request){
  const body=dataType==='file'?b64ToBytes(data):typeof data==='string'?data:data!==undefined?JSON.stringify(data):undefined;
  const r=await nativeFetch(url,{method,headers,body});
  const ab=await r.arrayBuffer();
  return{status:r.status,headers:Object.fromEntries(r.headers.entries()),data:ab,text:()=>dec.decode(ab)};
 }
 const opts={url,method,headers,connectTimeout:90000,readTimeout:120000};
 if(data!==undefined)opts.data=data;
 if(dataType)opts.dataType=dataType;
 if(responseType)opts.responseType=responseType;
 else if(headers.Accept?.startsWith('image/'))opts.responseType='blob';
 const res=await capHttp.request(opts);
 const normHeaders=Object.fromEntries(Object.entries(res.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 return{status:res.status,headers:normHeaders,raw:res.data,json:()=>typeof res.data==='string'?JSON.parse(res.data):res.data,text:()=>typeof res.data==='string'?res.data:JSON.stringify(res.data??'')};
}
async function jsonHttp(opts,stage='data'){
 let res;try{res=await httpRequest(opts);}catch{throw new ApiError(502,'Chưa kết nối được máy chủ Locket. Kiểm tra mạng trên iPhone.','UPSTREAM_UNAVAILABLE');}
 let data;try{data=res.json?res.json():JSON.parse(res.text());}catch{data=null;}
 if(res.status<200||res.status>=300||data?.error||data?.errors){
  const raw=String(data?.error?.message||data?.error||'');
  if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(raw))throw new ApiError(401,'Email hoặc mật khẩu Locket chưa đúng.','INVALID_CREDENTIALS');
  if(res.status===429||/TOO_MANY|QUOTA|RATE_LIMIT/.test(raw))throw new ApiError(429,'Locket đang giới hạn số lần thử. Vui lòng chờ một chút.','RATE_LIMIT');
  if(res.status===401||/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED/.test(raw)){localStorage.removeItem('cham:ios-session');throw new ApiError(401,'Phiên Locket đã hết hạn. Vui lòng đăng nhập lại.','AUTH_REQUIRED');}
  if(/APP_CHECK|APPCHECK/.test(raw))throw new ApiError(502,'Locket đang yêu cầu xác minh ứng dụng (App Check).','APP_CHECK_REQUIRED');
  const msg=stage==='login'?'Locket chưa chấp nhận đăng nhập này (chỉ hỗ trợ email & mật khẩu).':stage==='post'?`Locket chưa xác nhận bài đăng (mã ${res.status}). Kiểm tra trong app Locket trước khi gửi lại.`:stage==='upload'?`Không tải được tệp lên Locket Storage (mã ${res.status}).`:stage==='refresh'?`Không làm mới được phiên Locket (mã ${res.status}).`:`Không lấy được dữ liệu từ Locket (mã ${res.status}).`;
  throw new ApiError(502,msg,'UPSTREAM_REJECTED');
 }
 return data;
}

const locketHeaders=()=>({'User-Agent':'com.locket.Locket/2.68.0 iPhone/18.1.0 hw/iPhone16,1','Content-Type':'application/json','Accept':'*/*','x-ios-bundle-identifier':'com.locket.Locket'});
const analytics=s=>({ios_version:'2.68.0.2523',installation_id:s.installation,platform:'ios',experiments:{flag_18:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'1203'},flag_7:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'800'},flag_10:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'505'}}});
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const stamp=d=>{if(typeof d==='object'&&d)return Number(d._seconds??d.seconds??0)*1000;const n=Number(d);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):Date.parse(d)||Date.now();};
const normProfile=(raw,uid)=>{const p=raw?.user||raw||{};return{id:uid||p.uid||p.user_uid,name:[p.first_name,p.last_name].filter(Boolean).join(' ')||p.username||'Bạn',username:String(p.username||''),image:safeUrl(p.profile_picture_url||p.profile_picture||p.avatar_url||''),email:String(p.email||'')};};
const REACTION_EMOJIS=['❤️','🔥','😂','😍','🥺','👏'];
function parseInlineReactions(raw){
 if(!raw)return[];
 const items=Array.isArray(raw)?raw:typeof raw==='object'?Object.entries(raw).map(([k,v])=>typeof v==='object'&&v?{user:k,...v}:{user:k,value:v}):[];
 return items.map(r=>({user:String(r?.user||r?.user_uid||r?.uid||''),emoji:String(r?.value||r?.reaction||r?.emoji||'❤️'),time:stamp(r?.date||r?.created_at||0)})).filter(r=>r.user);
}
const normMoment=(p,uid)=>({id:String(p.canonical_uid||p.moment_uid||p.id||''),author:String(p.user||p.user_uid||uid||''),caption:String(p.caption||p.overlays?.find(o=>o.overlay_type==='caption')?.data?.text||''),image:safeUrl(p.image_url||p.thumbnail_url),time:stamp(p.date||p.created_at),video:safeUrl(p.video_url||''),reactions:parseInlineReactions(p.reactions)});
async function fetchMomentReactions(s,id){
 if(!id||!/^[A-Za-z0-9_-]{1,128}$/.test(id))return{reactions:[]};
 const urls=[
  `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents/moments/${encodeURIComponent(id)}/reactions?pageSize=50`,
  `https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents/history/${encodeURIComponent(s.uid)}/entries/${encodeURIComponent(id)}/reactions?pageSize=50`,
 ];
 const seen=new Map();
 for(const targetUrl of urls){
  try{
   const res=await httpRequest({url:targetUrl,headers:{...locketHeaders(),Authorization:`Bearer ${s.idToken}`}});
   if(res.status<200||res.status>=300)continue;
   const d=res.json?res.json():JSON.parse(res.text());
   for(const doc of(d?.documents||[])){
    const f=Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,parseFsVal(v)]));
    const user=String(f.user||f.user_uid||f.uid||doc.name.split('/').pop()||'');
    if(!user)continue;
    seen.set(user,{user,emoji:String(f.value||f.reaction||f.emoji||'❤️'),time:stamp(f.date||f.created_at||doc.createTime)});
   }
   if(seen.size)break;
  }catch{}
 }
 return{reactions:[...seen.values()]};
}

async function authed(){
 const s=await loadSession();
 const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken}).toString();
 const d=await jsonHttp({url:`https://securetoken.googleapis.com/v1/token?key=${KEY}`,method:'POST',headers:{...locketHeaders(),'Content-Type':'application/x-www-form-urlencoded'},data:body},'refresh');
 if(!d.id_token||d.user_id!==s.uid){localStorage.removeItem('cham:ios-session');throw new ApiError(401,'Phiên Locket không hợp lệ.','AUTH_REQUIRED');}
 s.idToken=d.id_token;s.refreshToken=d.refresh_token||s.refreshToken;
 await saveSession(s);return s;
}
async function callLocket(s,endpoint,payload={}){
 const d=await jsonHttp({url:`https://api.locketcamera.com/${endpoint}`,method:'POST',headers:{...locketHeaders(),Authorization:`Bearer ${s.idToken}`},data:{data:{...payload,analytics:analytics(s)}}},endpoint==='postMomentV2'?'post':'data');
 const res=d?.result??d;
 if(res?.error||res?.errors||(res?.status!=null&&Number(res.status)!==200&&Number(res.status)!==304))throw new ApiError(502,'Locket từ chối yêu cầu này.','UPSTREAM_REJECTED');
 return res?.data??res;
}
const getProfile=async(s,uid=s.uid)=>normProfile(await callLocket(s,'fetchUserV2',{user_uid:uid}),uid);

function parseFsVal(v){if(!v)return null;if('stringValue'in v)return v.stringValue;if('timestampValue'in v)return v.timestampValue;if('integerValue'in v)return Number(v.integerValue);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,parseFsVal(x)]));if('arrayValue'in v)return(v.arrayValue.values||[]).map(parseFsVal);return null;}
async function historyPage(s,{user=null,cursor=null,limit=30}={}){
 const size=Math.min(50,Math.max(1,Number(limit)||30));
 let start=null;if(cursor){try{start=JSON.parse(dec.decode(unb64url(cursor)));}catch{throw new ApiError(400,'Trang ảnh đã thay đổi.','INVALID_CURSOR');}}
 const structuredQuery={from:[{collectionId:'entries'}],orderBy:[{field:{fieldPath:'date'},direction:'DESCENDING'},{field:{fieldPath:'__name__'},direction:'DESCENDING'}],limit:size+1,...(user?{where:{fieldFilter:{field:{fieldPath:'user'},op:'EQUAL',value:{stringValue:user}}}}:{}),...(start?{startAt:{values:[{timestampValue:start.date},{referenceValue:start.docName}],before:false}}:{})};
 const rows=await jsonHttp({url:`https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents/history/${encodeURIComponent(s.uid)}:runQuery`,method:'POST',headers:{...locketHeaders(),Authorization:`Bearer ${s.idToken}`},data:{structuredQuery}});
 if(!Array.isArray(rows))throw new ApiError(502,'Locket chưa trả về lịch sử ảnh.','HISTORY_UNAVAILABLE');
 const docs=rows.filter(r=>r.document).map(r=>r.document),page=docs.slice(0,size),seen=new Set();
 const moments=page.map(doc=>{const p=Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,parseFsVal(v)]));return normMoment({...p,id:p.canonical_uid||p.moment_uid||doc.name.split('/').pop(),date:p.date||doc.createTime,user:p.user||p.user_uid||user||''});}).filter(p=>{if(!p.id||!p.image||seen.has(p.id))return false;seen.add(p.id);return true;});
 const last=page.at(-1);let nextCursor=null;
 if(docs.length>size&&last){const date=last.fields?.date?.timestampValue||last.createTime;if(date&&last.name)nextCursor=b64url(enc.encode(JSON.stringify({version:1,owner:s.uid,user:user||null,date,docName:last.name})));}
 return{moments,nextCursor,source:'history'};
}
async function latestFeed(s){
 const r=await callLocket(s,'getLatestMomentV2',{should_count_missed_moments:true});
 const rows=Array.isArray(r)?r:Array.isArray(r?.moments)?r.moments:[];
 return rows.map(p=>normMoment(p)).filter(p=>p.id&&p.image);
}
async function timeline(s){try{return await historyPage(s);}catch(e){if(e.code==='AUTH_REQUIRED')throw e;return{moments:await latestFeed(s),nextCursor:null,source:'latest'};}}
async function friendsList(s){
 const d=await jsonHttp({url:`https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/${encodeURIComponent(s.uid)}/friends?pageSize=100`,headers:{Authorization:`Bearer ${s.idToken}`}});
 const ids=(d.documents||[]).map(doc=>doc.name.split('/').pop()).slice(0,100),out=[];
 for(let i=0;i<ids.length;i+=5)out.push(...await Promise.all(ids.slice(i,i+5).map(async id=>{try{return await getProfile(s,id);}catch{return{id,name:'Người bạn',username:'',image:''};}})));
 return out;
}

async function uploadResumable(s,baseUrl,objectPath,mime,b64Data,byteLength){
 const encoded=encodeURIComponent(objectPath);
 const init=await httpRequest({url:`${baseUrl}/${encoded}?uploadType=resumable&name=${encoded}`,method:'POST',headers:{...locketHeaders(),Authorization:`Firebase ${s.idToken}`,'x-goog-upload-protocol':'resumable','x-goog-upload-command':'start','x-goog-upload-content-type':mime,'x-goog-upload-content-length':String(byteLength),'x-firebase-storage-version':'ios/12.12.1','x-firebase-gmpid':APP_ID},data:{bucket:'',contentType:mime,name:objectPath,metadata:{visibility:'private',creator:s.uid},cacheControl:'public, max-age=604800'}});
 if(init.status<200||init.status>=300)throw new ApiError(502,`Locket chưa cấp địa chỉ tải tệp (mã ${init.status}).`,'UPLOAD_FAILED');
 const uploadUrl=init.headers['x-goog-upload-url'];if(!uploadUrl)throw new ApiError(502,'Thiếu liên kết tải lên từ Locket.','UPLOAD_FAILED');
 // CapacitorHttp iOS (CapacitorUrlRequest.swift) requires dataType='file' to decode Base64 into raw binary Data
 const uploaded=await jsonHttp({url:uploadUrl,method:'PUT',headers:{'Content-Type':'application/octet-stream','x-goog-upload-protocol':'resumable','x-goog-upload-command':'upload, finalize','x-goog-upload-offset':'0','x-goog-upload-content-length':String(byteLength)},data:b64Data,dataType:'file'},'upload');
 let token=uploaded?.downloadTokens?.split(',')[0];
 if(!token){const meta=await jsonHttp({url:`${baseUrl}/${encoded}`,headers:{'User-Agent':locketHeaders()['User-Agent'],'x-ios-bundle-identifier':'com.locket.Locket',Authorization:`Firebase ${s.idToken}`}},'upload');token=meta?.downloadTokens?.split(',')[0];}
 if(!token)throw new ApiError(502,'Locket chưa cấp mã truy cập tệp.','UPLOAD_FAILED');
 return `${baseUrl}/${encoded}?alt=media&token=${encodeURIComponent(token)}`;
}

const STYLES={
 standard:{colors:[],textColor:'#FFFFFFE6'},
 time:{colors:[],textColor:'#FFFFFFE6',time:true},
 music:{colors:['#2B1E4A','#4A2C6D'],textColor:'#FFFFFF',prefix:'🎵 '},
 sunset:{colors:['#FF6B6B','#FFA94D'],textColor:'#FFFFFF'},
 matcha:{colors:['#DCECCB','#B7D99C'],textColor:'#243319'},
 berry:{colors:['#FFD6E0','#FFACC7'],textColor:'#4A192C'},
 night:{colors:['#141E30','#243B55'],textColor:'#FFFFFF'},
};
function buildOverlays(cap,style='standard',timeLabel=''){
 const cfg=STYLES[style]||STYLES.standard;let text=cap;
 if(cfg.time){const clock=timeLabel||new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false});text=cap?`🕒 ${clock} · ${cap}`:`🕒 ${clock}`;}
 else if(cfg.prefix&&cap&&!cap.startsWith('🎵'))text=cfg.prefix+cap;
 if(!text)return{overlays:[],caption:cap};
 const hasBg=cfg.colors.length>0;
 return{caption:text,overlays:[{overlay_type:'caption',overlay_id:hasBg?'caption:party':'caption:standard',alt_text:text,data:{text,type:hasBg?'party':'standard',text_color:cfg.textColor,max_lines:{value:'4','@type':'type.googleapis.com/google.protobuf.Int64Value'},background:hasBg?{colors:cfg.colors}:{material_blur:'ultra_thin',colors:[]}}}]};
}

// On-device Cloudflare AI settings (stored privately on user's iPhone only)
function readAiConfig(){try{return JSON.parse(localStorage.getItem('cham:ios-cf-ai')||'{}');}catch{return{};}}
function writeAiConfig(cfg){localStorage.setItem('cham:ios-cf-ai',JSON.stringify(cfg));}
async function iosAiEdit(body){
 const cfg=readAiConfig();
 if(!cfg.accountId||!cfg.token)throw new ApiError(403,'Mở tab Tài khoản để điền Account ID & Token Cloudflare AI trên iPhone.','AI_NOT_AVAILABLE');
 const promptRaw=String(body?.prompt||'').trim();if(!promptRaw)throw new ApiError(400,'Nhập mô tả chỉnh ảnh.','INVALID_INPUT');
 const imgStr=String(body?.image||'');if(!/^data:image\/(webp|jpeg);base64,/.test(imgStr))throw new ApiError(400,'Chọn ảnh trước khi chỉnh AI.','INVALID_IMAGE');
 const mime=imgStr.startsWith('data:image/jpeg')?'image/jpeg':'image/webp',rawB64=imgStr.slice(imgStr.indexOf(',')+1).replace(/\s+/g,''),bytes=b64ToBytes(rawB64);
 let prompt=promptRaw;
 if(/[^\x00-\x7F]/.test(promptRaw)){
  try{const tr=await jsonHttp({url:`${CF_BASE}${cfg.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,method:'POST',headers:{Authorization:`Bearer ${cfg.token}`,'Content-Type':'application/json'},data:{messages:[{role:'system',content:'Translate this Vietnamese photo-editing prompt into concise English under 55 words, keeping face and framing intact. Output ONLY the English prompt.'},{role:'user',content:promptRaw}],max_tokens:120,temperature:0.2}});if(tr?.result?.response)prompt=String(tr.result.response).trim();}catch{}
 }
 const model=cfg.model||'@cf/black-forest-labs/flux-2-klein-9b';
 const form=new FormData();form.append('prompt',prompt);form.append('width','832');form.append('height','1024');
 form.append('input_image_0',new Blob([bytes],{type:mime}),mime==='image/jpeg'?'input.jpg':'input.webp');
 const serialized=new Response(form),ct=serialized.headers.get('Content-Type'),ab=new Uint8Array(await serialized.arrayBuffer());
 const res=await httpRequest({url:`${CF_BASE}${cfg.accountId}/ai/run/${model}`,method:'POST',headers:{Authorization:`Bearer ${cfg.token}`,'Content-Type':ct},data:bytesToB64(ab),dataType:'file',responseType:'blob'});
 if(res.status>=200&&res.status<300&&res.headers['content-type']?.startsWith('image/')){
  const rawOut=typeof res.raw==='string'?res.raw:bytesToB64(new Uint8Array(res.data));
  const outMime=detectMime(b64ToBytes(rawOut))||'image/jpeg';
  return{image:`data:${outMime};base64,${rawOut}`,provider:'cloudflare'};
 }
 let data;try{data=res.json?res.json():JSON.parse(res.text());}catch{data=null;}
 if(res.status<200||res.status>=300||data?.success===false)throw new ApiError(res.status===429?429:502,res.status===429?'Đã hết lượt miễn phí hôm nay trên Cloudflare AI.':'Cloudflare AI chưa chỉnh được ảnh. Kiểm tra lại Account ID & Token trong Tài khoản.','AI_REJECTED');
 const outB64=data?.result?.image;if(!outB64)throw new ApiError(502,'Cloudflare chưa trả về ảnh.','AI_NO_IMAGE');
 const outMime=detectMime(b64ToBytes(outB64))||'image/jpeg';
 return{image:`data:${outMime};base64,${outB64}`,provider:'cloudflare'};
}

// On-device iPhone Canvas + Hardware H.264 MediaRecorder Video Composer (works offline from PC!)
function pickMp4RecorderMime(){
 if(typeof MediaRecorder==='undefined')return'';
 return['video/mp4','video/mp4;codecs=avc1.42E01E','video/webm'].find(m=>MediaRecorder.isTypeSupported?.(m))||'';
}
async function prepareSingleOnDevice(fileBytes,params){
 const mime=pickMp4RecorderMime();if(!mime.startsWith('video/mp4'))throw new ApiError(503,'Phiên bản iOS này chưa hỗ trợ xuất MP4 trực tiếp trên máy.');
 const blobUrl=URL.createObjectURL(new Blob([fileBytes],{type:'video/mp4'}));
 try{
  const vid=document.createElement('video');vid.playsInline=true;vid.muted=true;vid.src=blobUrl;
  await new Promise((res,rej)=>{vid.onloadedmetadata=res;vid.onerror=()=>rej(new ApiError(400,'Không đọc được video MP4.'));vid.load();});
  const start=Number(params.start||0),end=Number(params.end||Math.min(15,vid.duration)),duration=Math.max(.3,Math.min(15,end-start));
  const c=document.createElement('canvas');c.width=c.height=720;const ctx=c.getContext('2d');
  const scale=Math.min(632/vid.videoWidth,632/vid.videoHeight),dw=vid.videoWidth*scale,dh=vid.videoHeight*scale,dx=(720-dw)/2,dy=(720-dh)/2;
  vid.currentTime=start;await new Promise(r=>{vid.onseeked=r;});
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,720,720);ctx.drawImage(vid,dx,dy,dw,dh);
  const poster=global.ChamEdits?.exportCanvas?global.ChamEdits.exportCanvas(c,.86):c.toDataURL('image/jpeg',.86);
  const stream=c.captureStream(24),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1800000}),chunks=[];
  rec.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
  const done=new Promise(r=>{rec.onstop=r;});
  rec.start(200);await vid.play();
  const t0=performance.now();
  while(performance.now()-t0<duration*1000&&!vid.ended){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,720,720);ctx.drawImage(vid,dx,dy,dw,dh);await new Promise(r=>requestAnimationFrame(r));}
  vid.pause();if(rec.state!=='inactive')rec.stop();await done;
  const outBytes=new Uint8Array(await new Blob(chunks,{type:'video/mp4'}).arrayBuffer());
  return{video:'data:video/mp4;base64,'+bytesToB64(outBytes),image:poster,duration,width:720,height:720,bytes:outBytes.length,hasAudio:false};
 }finally{URL.revokeObjectURL(blobUrl);}
}
async function prepareBoothOnDevice(form){
 const mime=pickMp4RecorderMime();if(!mime.startsWith('video/mp4'))throw new ApiError(503,'Phiên bản iOS này chưa hỗ trợ ghép MP4 trực tiếp.');
 const files=form.getAll('clips'),frameBlob=form.get('frame'),slots=JSON.parse(String(form.get('slots')||'[]')),duration=Math.max(.5,Math.min(10,Number(form.get('duration')||3)));
 const urls=[],vids=[];
 try{
  const frameUrl=URL.createObjectURL(frameBlob);urls.push(frameUrl);
  const frameImg=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=frameUrl;});
  for(const f of files){const u=URL.createObjectURL(f);urls.push(u);const v=document.createElement('video');v.playsInline=true;v.muted=true;v.loop=true;v.src=u;await new Promise((res,rej)=>{v.onloadeddata=res;v.onerror=()=>rej(new ApiError(400,'Không đọc được clip ghép.'));v.load();});vids.push(v);}
  const c=document.createElement('canvas');c.width=c.height=720;const ctx=c.getContext('2d');
  const drawFrame=()=>{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,720,720);vids.forEach((v,i)=>{const s=slots[i];if(!s||!v.videoWidth)return;const b=global.ChamEdits.sourceBox(v.videoWidth,v.videoHeight,s.width,s.height);ctx.drawImage(v,b.x,b.y,b.width,b.height,s.x,s.y,s.width,s.height);});ctx.drawImage(frameImg,0,0,720,720);};
  drawFrame();const poster=global.ChamEdits?.exportCanvas?global.ChamEdits.exportCanvas(c,.86):c.toDataURL('image/jpeg',.86);
  const stream=c.captureStream(24),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2000000}),chunks=[];
  rec.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
  const done=new Promise(r=>{rec.onstop=r;});
  await Promise.all(vids.map(v=>v.play().catch(()=>{})));rec.start(200);
  const t0=performance.now();
  while(performance.now()-t0<duration*1000){drawFrame();await new Promise(r=>requestAnimationFrame(r));}
  vids.forEach(v=>v.pause());if(rec.state!=='inactive')rec.stop();await done;
  const outBytes=new Uint8Array(await new Blob(chunks,{type:'video/mp4'}).arrayBuffer());
  return{video:'data:video/mp4;base64,'+bytesToB64(outBytes),image:poster,duration,width:720,height:720,bytes:outBytes.length,hasAudio:false};
 }finally{urls.forEach(u=>URL.revokeObjectURL(u));}
}

const jsonResp=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});

async function handleApi(url,init={}){
 const u=new URL(url,'https://cham.ios'),path=u.pathname,method=(init.method||'GET').toUpperCase();
 try{
  if(path==='/api/video/status')return jsonResp({available:pickMp4RecorderMime().startsWith('video/mp4'),reason:'Cần iOS 15+ để xử lý video trực tiếp trên iPhone.'});
  if(path==='/api/video/prepare')return jsonResp(await prepareSingleOnDevice(new Uint8Array(await new Response(init.body).arrayBuffer()),Object.fromEntries(u.searchParams)));
  if(path==='/api/video/booth')return jsonResp(await prepareBoothOnDevice(init.body instanceof FormData?init.body:await new Response(init.body,{headers:init.headers}).formData()));
  if(path==='/api/logout'&&method==='POST'){localStorage.removeItem('cham:ios-session');return jsonResp({ok:true});}
  const body=init.body&&typeof init.body==='string'?JSON.parse(init.body):{};
  if(path==='/api/login'&&method==='POST'){
   const installation=crypto.randomUUID().replaceAll('-','').slice(0,22);
   const d=await jsonHttp({url:`${AUTH}:signInWithPassword?key=${KEY}`,method:'POST',headers:locketHeaders(),data:{email:String(body.email||'').trim(),password:String(body.password||''),returnSecureToken:true}},'login');
   const s={uid:d.localId,idToken:d.idToken,refreshToken:d.refreshToken,installation,expires:Date.now()+TTL};
   await saveSession(s);
   let p;try{p=await getProfile(s);}catch{p={id:s.uid,name:'Bạn',username:'',image:'',email:d.email};}
   return jsonResp({connected:true,profile:p});
  }
  const s=await authed();
  if(path==='/api/session')return jsonResp({connected:true,profile:await getProfile(s)});
  if(path==='/api/ai/status'){const cfg=readAiConfig();return jsonResp(cfg.accountId&&cfg.token?{available:true,provider:'cloudflare',reason:'Cloudflare AI đã sẵn sàng trên iPhone.'}:{available:false,reason:'Mở mục Tài khoản để nhập Cloudflare Account ID & Token trên iPhone.'});}
  if(path==='/api/ai/edit')return jsonResp(await iosAiEdit(body));
  if(path==='/api/bootstrap'){
   const res=await Promise.allSettled([getProfile(s),friendsList(s),timeline(s)]);
   const warnings=[];['profile','friends','feed'].forEach((n,i)=>{if(res[i].status==='rejected')warnings.push(n);});
   const page=res[2].status==='fulfilled'?res[2].value:{moments:[],nextCursor:null,source:'unavailable'};
   return jsonResp({connected:true,profile:res[0].status==='fulfilled'?res[0].value:{id:s.uid,name:'Bạn',username:'',image:''},friends:res[1].status==='fulfilled'?res[1].value:[],moments:page.moments,nextCursor:page.nextCursor,feedSource:page.source,warnings});
  }
  if(path==='/api/feed'||path==='/api/history')return jsonResp(await historyPage(s,{user:path==='/api/history'?s.uid:u.searchParams.get('user')||null,cursor:u.searchParams.get('cursor'),limit:u.searchParams.get('limit')||30}));
  if(path==='/api/moment-image'){
   const target=new URL(String(body.url||''));
   if(target.hostname!=='firebasestorage.googleapis.com')throw new ApiError(400,'Liên kết ảnh không hợp lệ.');
   const r=await httpRequest({url:target.href,headers:{Accept:'image/*'}});
   if(r.status<200||r.status>=300)throw new ApiError(502,'Không tải được ảnh kỷ niệm từ Locket.','UPSTREAM_REJECTED');
   const b64=typeof r.raw==='string'?r.raw:bytesToB64(new Uint8Array(r.data));
   const mime=detectMime(b64ToBytes(b64))||'image/webp';
   return jsonResp({image:`data:${mime};base64,${b64}`});
  }
  if(path==='/api/moments'||path==='/api/videos'){
   const imgStr=String(body.image||'');
   if(!/^data:image\/(webp|jpeg);base64,/.test(imgStr))throw new ApiError(400,'Ảnh chưa sẵn sàng để gửi lên Locket.','INVALID_IMAGE');
   const mime=imgStr.startsWith('data:image/jpeg')?'image/jpeg':'image/webp',ext=mime==='image/jpeg'?'jpg':'webp';
   const imgB64=imgStr.slice(imgStr.indexOf(',')+1).replace(/\s+/g,''),imgBytes=b64ToBytes(imgB64);
   const thumbUrl=await uploadResumable(s,STORAGE,`users/${s.uid}/moments/thumbnails/${crypto.randomUUID().replaceAll('-','').slice(0,20)}.${ext}`,mime,imgB64,imgBytes.length);
   let videoUrl=null;
   if(path==='/api/videos'){
    const vStr=String(body.video||'');
    if(!vStr.startsWith('data:video/mp4')||!vStr.includes(','))throw new ApiError(400,'Chọn video MP4 đã xử lý trước khi đăng.','INVALID_VIDEO');
    const vB64=vStr.slice(vStr.indexOf(',')+1).replace(/\s+/g,''),vBytes=b64ToBytes(vB64);
    videoUrl=await uploadResumable(s,VIDEO_STORAGE,`users/${s.uid}/moments/videos/${crypto.randomUUID().replaceAll('-','').slice(0,20)}.mp4`,'video/mp4',vB64,vBytes.length);
   }
   const built=buildOverlays(String(body.caption||'').trim(),body.overlayStyle||'standard',body.timeLabel);
   const recipients=body.audience==='selected'&&Array.isArray(body.recipients)?body.recipients:[];
   const created=await callLocket(s,'postMomentV2',{thumbnail_url:thumbUrl,...(videoUrl?{video_url:videoUrl}:{}),overlays:built.overlays,sent_to_self_only:body.audience==='self',sent_to_all:body.audience==='all',recipients,md5:`${crypto.randomUUID().replaceAll('-','')}_${Math.floor(Date.now()/1000)}`});
   const id=created?.canonical_uid||created?.id;if(!id)throw new ApiError(502,'Chưa nhận được mã xác nhận từ Locket.','POST_UNCONFIRMED');
   return jsonResp({confirmed:true,moment:{id,author:s.uid,caption:built.caption,image:thumbUrl,...(videoUrl?{video:videoUrl}:{}),time:Date.now()}});
  }
  if(path==='/api/reactions')return jsonResp(await fetchMomentReactions(s,u.searchParams.get('id')||''));
  if(path==='/api/reaction'){const emoji=REACTION_EMOJIS.includes(body.emoji)?body.emoji:'❤️';await callLocket(s,'reactToMoment',{moment_uid:String(body.id||''),reaction:emoji,from_memory:false,intensity:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'0'}});return jsonResp({ok:true,emoji});}
  throw new ApiError(404,'Không tìm thấy chức năng.','NOT_FOUND');
 }catch(e){
  return jsonResp({error:{code:e instanceof ApiError?e.code:'SERVER_ERROR',message:e.message||'Đã xảy ra lỗi trên iPhone.'}},e instanceof ApiError?e.status:500);
 }
}

global.fetch=(input,init)=>{
 const url=typeof input==='string'?input:input?.url||'';
 if(url.startsWith('/api/'))return handleApi(url,init);
 return nativeFetch(input,init);
};

// Inject personal Cloudflare AI config panel into Profile card when on iPhone
if(typeof MutationObserver!=='undefined'&&global.document?.body){
 const injectAiSettings=()=>{
  const card=document.querySelector('.profile-card');
  if(!card||card.querySelector('.ios-ai-card'))return;
  const cfg=readAiConfig();
  const box=document.createElement('div');
  box.className='editor-disclosure ios-ai-card';
  box.innerHTML=`<details><summary>Cloudflare AI trên iPhone ${cfg.accountId&&cfg.token?'· Đã lưu':''}</summary><p class="editor-help">Lưu trực tiếp trên iPhone của bạn để chỉnh ảnh AI qua 4G/Wi-Fi không cần bật máy tính.</p><label>Account ID<input type="text" id="ios-cf-acc" value="${cfg.accountId||''}" placeholder="32 ký tự Account ID"></label><label>API Token<input type="password" id="ios-cf-tok" value="${cfg.token||''}" placeholder="Cloudflare Workers AI Token"></label><button type="button" class="primary" id="ios-cf-save" style="width:100%;margin-top:8px">Lưu cấu hình AI trên iPhone</button></details>`;
  card.insertBefore(box,card.querySelector('.logout-button'));
  box.querySelector('#ios-cf-save')?.addEventListener('click',()=>{
   writeAiConfig({accountId:box.querySelector('#ios-cf-acc').value.trim(),token:box.querySelector('#ios-cf-tok').value.trim()});
   const toast=document.querySelector('#toast');if(toast){toast.textContent='Đã lưu Cloudflare AI trên iPhone';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000);}
  });
 };
 new MutationObserver(injectAiSettings).observe(document.body,{childList:true,subtree:true});
}
})(typeof window!=='undefined'?window:globalThis);
