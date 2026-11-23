/* Locket protocol adapted from hmk8386/locket.js. See THIRD_PARTY_NOTICES.md. */
const ASSETS = /*CHAM_ASSETS*/{};
const KEY='AIzaSyCQngaaXQIfJaH0aS2l7REgIjD7nL431So'; // Public Firebase application identifier, not a credential.
const APP_ID='1:641029076083:ios:cc8eb46290d69b234fa606';
const AUTH='https://identitytoolkit.googleapis.com/v1/accounts';
const STORAGE='https://firebasestorage.googleapis.com/v0/b/locket-img/o';
const COOKIE='__Host-cham_locket';
const TTL=7*24*3600;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const loginAttempts=new Map();
const aiUsage=new Map();
let aiModelCache=null;
class ApiError extends Error{constructor(status,message,code='ERROR'){super(message);this.status=status;this.code=code;}}
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function unbase64(str){try{return Uint8Array.from(atob(str.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{throw new ApiError(401,'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.','AUTH_REQUIRED');}}
async function sessionKey(env){if(!env.CHAM_SESSION_SECRET)throw new ApiError(503,'Kết nối Locket chưa được cấu hình trên máy chủ.','NOT_CONFIGURED');const hash=await crypto.subtle.digest('SHA-256',encoder.encode(env.CHAM_SESSION_SECRET));return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);}
async function seal(session,env){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode('cham-locket-v1')},await sessionKey(env),encoder.encode(JSON.stringify({uid:session.uid,refreshToken:session.refreshToken,installation:session.installation,expires:session.expires})));return base64url(iv)+'.'+base64url(new Uint8Array(encrypted));}
async function unseal(value,env){try{const parts=value.split('.');if(parts.length!==2)throw Error();const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(parts[0]),additionalData:encoder.encode('cham-locket-v1')},await sessionKey(env),unbase64(parts[1]));const s=JSON.parse(decoder.decode(decoded));if(!s.uid||!s.refreshToken||!s.installation||s.expires<Date.now())throw Error();return s;}catch(e){if(e.code==='NOT_CONFIGURED')throw e;throw new ApiError(401,'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.','AUTH_REQUIRED');}}
const cookie=value=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL}`;
const clearCookie=()=>`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
function headers(session){return {'User-Agent':'com.locket.Locket/2.68.0 iPhone/18.1.0 hw/iPhone16,1','Content-Type':'application/json','Accept':'*/*','x-ios-bundle-identifier':'com.locket.Locket'};}
const analytics=s=>({ios_version:'2.68.0.2523',installation_id:s.installation,platform:'ios',experiments:{flag_18:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'1203'},flag_7:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'800'},flag_10:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'505'}}});
async function remote(url,options={},timeout=25000){let response;try{response=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(timeout)});}catch(e){console.error(JSON.stringify({event:'locket_upstream_failed',host:new URL(url).hostname,error:['TypeError','AbortError','TimeoutError'].includes(e?.name)?e.name:'NetworkError'}));throw new ApiError(502,'Chưa nhận được phản hồi từ Locket. Vui lòng thử lại sau.','UPSTREAM_UNAVAILABLE');}if(response.status>=300&&response.status<400){await response.body?.cancel();throw new ApiError(502,'Máy chủ Locket chuyển hướng yêu cầu ngoài dự kiến. Vui lòng thử lại sau.','UPSTREAM_REDIRECT');}return response;}
function upstreamError(data,status,stage){const raw=String(data?.error?.message||data?.error||data?.errors||'');if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(raw))return new ApiError(401,'Email hoặc mật khẩu Locket chưa đúng.','INVALID_CREDENTIALS');if(/TOO_MANY|QUOTA|RATE_LIMIT/.test(raw)||status===429)return new ApiError(429,'Locket đang giới hạn số lần thử. Vui lòng chờ rồi thử lại.','RATE_LIMIT');if(/USER_DISABLED/.test(raw))return new ApiError(403,'Tài khoản này đã bị Locket vô hiệu hóa.','ACCOUNT_DISABLED');if(/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND/.test(raw)||status===401)return new ApiError(401,'Phiên Locket đã hết hạn. Vui lòng đăng nhập lại.','AUTH_REQUIRED');if(/APP_CHECK|APPCHECK/.test(raw))return new ApiError(502,'Locket đang yêu cầu xác minh ứng dụng. Kết nối không chính thức hiện chưa đáp ứng được.','APP_CHECK_REQUIRED');return new ApiError(502,stage==='login'?'Locket chưa chấp nhận đăng nhập này. Bản này chỉ hỗ trợ email và mật khẩu, chưa hỗ trợ OTP.':stage==='post'?'Locket chưa xác nhận đăng ảnh. Hãy kiểm tra trong app Locket trước khi thử lại.':'Không lấy được dữ liệu từ Locket. Vui lòng thử lại sau.','UPSTREAM_REJECTED');}
async function jsonRemote(url,options,stage){const res=await remote(url,options);let data;try{data=await res.json();}catch{throw upstreamError(null,res.status,stage);}if(!res.ok||data?.error||data?.errors)throw upstreamError(data,res.status,stage);return data;}
async function call(s,endpoint,payload={}){const d=await jsonRemote(`https://api.locketcamera.com/${endpoint}`,{method:'POST',headers:{...headers(s),Authorization:`Bearer ${s.idToken}`},body:JSON.stringify({data:{...payload,analytics:analytics(s)}})},endpoint==='postMomentV2'?'post':'data');const result=d?.result??d;if(result?.error||result?.errors||(result?.status!=null&&Number(result.status)!==200&&Number(result.status)!==304))throw upstreamError(result,Number(result?.status)||502,endpoint==='postMomentV2'?'post':'data');return result?.data??result;}
async function login(email,password){const s={installation:crypto.randomUUID().replaceAll('-','').slice(0,22),expires:Date.now()+TTL*1000};const d=await jsonRemote(`${AUTH}:signInWithPassword?key=${KEY}`,{method:'POST',headers:headers(s),body:JSON.stringify({email,password,returnSecureToken:true})},'login');if(!d.idToken||!d.refreshToken||!d.localId)throw upstreamError(null,502,'login');return {...s,uid:d.localId,idToken:d.idToken,refreshToken:d.refreshToken,email:d.email||email};}
async function authenticated(request,env){const value=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!value)throw new ApiError(401,'Đăng nhập Locket để tiếp tục.','AUTH_REQUIRED');const s=await unseal(value,env);const d=await jsonRemote(`https://securetoken.googleapis.com/v1/token?key=${KEY}`,{method:'POST',headers:{...headers(s),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken}).toString()},'refresh');if(!d.id_token||d.user_id!==s.uid)throw new ApiError(401,'Phiên Locket không hợp lệ. Vui lòng đăng nhập lại.','AUTH_REQUIRED');s.idToken=d.id_token;s.refreshToken=d.refresh_token||s.refreshToken;return s;}
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function profile(raw,uid){const p=raw?.user||raw||{};return {id:uid||p.uid||p.user_uid,name:[p.first_name,p.last_name].filter(Boolean).join(' ')||p.username||'Bạn',username:String(p.username||''),image:safeUrl(p.profile_picture_url||p.profile_picture||p.avatar_url||''),email:String(p.email||'')};}
const getProfile=async(s,uid=s.uid)=>profile(await call(s,'fetchUserV2',{user_uid:uid}),uid);
function stamp(d){if(typeof d==='object'&&d)return Number(d._seconds??d.seconds??0)*1000;const n=Number(d);return Number.isFinite(n)&&n>0?(n<1e12?n*1000:n):Date.parse(d)||Date.now();}
function moment(p,uid){return {id:String(p.canonical_uid||p.moment_uid||p.id||''),author:String(p.user||p.user_uid||uid||''),caption:String(p.caption||p.overlays?.find(o=>o.overlay_type==='caption')?.data?.text||''),image:safeUrl(p.image_url||p.thumbnail_url),time:stamp(p.date||p.created_at),video:safeUrl(p.video_url||'')};}
async function friends(s){const d=await jsonRemote(`https://firestore.googleapis.com/v1/projects/locket-4252a/databases/(default)/documents/users/${encodeURIComponent(s.uid)}/friends?pageSize=100`,{headers:{Authorization:`Bearer ${s.idToken}`}},'data');const ids=(d.documents||[]).map(d=>d.name.split('/').pop()).slice(0,100);const result=[];for(let i=0;i<ids.length;i+=5){result.push(...await Promise.all(ids.slice(i,i+5).map(async id=>{try{return await getProfile(s,id);}catch{return {id,name:'Người bạn',username:'',image:''};}})));}return result;}
async function feed(s){const result=await call(s,'getLatestMomentV2',{should_count_missed_moments:true});const rows=Array.isArray(result)?result:Array.isArray(result?.moments)?result.moments:[];return rows.map(p=>moment(p)).filter(p=>p.id&&p.image);}
function parseValue(v){if(!v)return null;if('stringValue'in v)return v.stringValue;if('timestampValue'in v)return v.timestampValue;if('integerValue'in v)return Number(v.integerValue);if('mapValue'in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,v])=>[k,parseValue(v)]));if('arrayValue'in v)return(v.arrayValue.values||[]).map(parseValue);return null;}
function historyCursor(token,s,user){if(!token)return null;try{if(token.length>3000)throw Error();const c=JSON.parse(decoder.decode(unbase64(token)));const prefix=`projects/locket-4252a/databases/locket/documents/history/${s.uid}/entries/`;if(c.version!==1||c.owner!==s.uid||c.user!==(user||null)||typeof c.date!=='string'||!Number.isFinite(Date.parse(c.date))||typeof c.docName!=='string'||!c.docName.startsWith(prefix)||!c.docName.slice(prefix.length)||c.docName.slice(prefix.length).includes('/'))throw Error();return c;}catch{throw new ApiError(400,'Trang ảnh đã thay đổi. Hãy làm mới danh sách ảnh.','INVALID_CURSOR');}}
async function historyPage(s,{user=null,cursor=null,limit=30}={}){
 if(user!==null&&(typeof user!=='string'||!user||user.length>128||!/^[A-Za-z0-9_-]+$/.test(user)))throw new ApiError(400,'Người gửi ảnh không hợp lệ.','INVALID_INPUT');
 const size=Number(limit);if(!Number.isInteger(size)||size<1||size>50)throw new ApiError(400,'Số ảnh mỗi trang phải từ 1 đến 50.','INVALID_INPUT');
 const start=historyCursor(cursor,s,user);
 const structuredQuery={from:[{collectionId:'entries'}],orderBy:[{field:{fieldPath:'date'},direction:'DESCENDING'},{field:{fieldPath:'__name__'},direction:'DESCENDING'}],limit:size+1,...(user?{where:{fieldFilter:{field:{fieldPath:'user'},op:'EQUAL',value:{stringValue:user}}}}:{}),...(start?{startAt:{values:[{timestampValue:start.date},{referenceValue:start.docName}],before:false}}:{})};
 // Always query the signed-in viewer's received history, never a friend's private history.
 const rows=await jsonRemote(`https://firestore.googleapis.com/v1/projects/locket-4252a/databases/locket/documents/history/${encodeURIComponent(s.uid)}:runQuery`,{method:'POST',headers:{...headers(s),Authorization:`Bearer ${s.idToken}`},body:JSON.stringify({structuredQuery})},'data');
 if(!Array.isArray(rows))throw new ApiError(502,'Locket chưa trả về lịch sử ảnh hợp lệ.','HISTORY_UNAVAILABLE');
 const documents=rows.filter(r=>r.document).map(r=>r.document),page=documents.slice(0,size),seen=new Set();
 const moments=page.map(doc=>{const p=Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,parseValue(v)]));return moment({...p,id:p.canonical_uid||p.moment_uid||doc.name.split('/').pop(),date:p.date||doc.createTime,user:p.user||p.user_uid||user||''});}).filter(p=>{if(!p.id||!p.image||seen.has(p.id))return false;seen.add(p.id);return true;});
 const last=page.at(-1);let nextCursor=null;
 if(documents.length>size&&last){const date=last.fields?.date?.timestampValue||last.createTime;if(date&&last.name){const next={version:1,owner:s.uid,user:user||null,date,docName:last.name};nextCursor=base64url(encoder.encode(JSON.stringify(next)));}}
 return {moments,nextCursor,source:'history'};
}
async function timeline(s){try{return await historyPage(s);}catch(e){if(e.code==='AUTH_REQUIRED')throw e;return {moments:await feed(s),nextCursor:null,source:'latest'};}}
async function uploadImage(s,bytes,mime='image/webp'){const ext=mime==='image/jpeg'?'jpg':'webp',objectPath=`users/${s.uid}/moments/thumbnails/${crypto.randomUUID().replaceAll('-','').slice(0,20)}.${ext}`;const encoded=encodeURIComponent(objectPath);const init=await remote(`${STORAGE}/${encoded}?uploadType=resumable&name=${encoded}`,{method:'POST',headers:{...headers(s),Authorization:`Firebase ${s.idToken}`,'x-goog-upload-protocol':'resumable','x-goog-upload-command':'start','x-goog-upload-content-type':mime,'x-goog-upload-content-length':String(bytes.length),'x-firebase-storage-version':'ios/12.12.1','x-firebase-gmpid':APP_ID},body:JSON.stringify({bucket:'',contentType:mime,name:objectPath,metadata:{visibility:'private',creator:s.uid},cacheControl:'public, max-age=604800'})});if(!init.ok)throw upstreamError(null,init.status,'upload');let target;try{target=new URL(init.headers.get('x-goog-upload-url'));}catch{throw new ApiError(502,'Locket chưa cấp địa chỉ tải ảnh.','UPLOAD_FAILED');}if(target.protocol!=='https:'||!target.hostname.endsWith('.googleapis.com')||target.username||target.password)throw new ApiError(502,'Địa chỉ tải ảnh không hợp lệ.','UPLOAD_FAILED');const uploaded=await jsonRemote(target.href,{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-goog-upload-protocol':'resumable','x-goog-upload-command':'upload, finalize','x-goog-upload-offset':'0','x-goog-upload-content-length':String(bytes.length)},body:bytes},'upload');let token=uploaded.downloadTokens?.split(',')[0];if(!token){const metadata=await jsonRemote(`${STORAGE}/${encoded}`,{headers:{Authorization:`Firebase ${s.idToken}`}},'upload');token=metadata.downloadTokens?.split(',')[0];}if(!token)throw new ApiError(502,'Ảnh đã tải lên nhưng Locket chưa cấp liên kết ảnh. Chưa tạo bài đăng.','UPLOAD_FAILED');return `${STORAGE}/${encoded}?alt=media&token=${encodeURIComponent(token)}`;}
const CAPTION_STYLES={
 standard:{colors:[],textColor:'#FFFFFFE6',prefix:''},
 time:{colors:[],textColor:'#FFFFFFE6',time:true},
 music:{colors:['#2B1E4A','#4A2C6D'],textColor:'#FFFFFF',prefix:'🎵 '},
 sunset:{colors:['#FF6B6B','#FFA94D'],textColor:'#FFFFFF',prefix:''},
 matcha:{colors:['#DCECCB','#B7D99C'],textColor:'#243319',prefix:''},
 berry:{colors:['#FFD6E0','#FFACC7'],textColor:'#4A192C',prefix:''},
 night:{colors:['#141E30','#243B55'],textColor:'#FFFFFF',prefix:''},
};
function buildOverlays(cap,style='standard',timeLabel=''){
 if(!CAPTION_STYLES[style])throw new ApiError(400,'Kiểu thẻ caption không hợp lệ.','INVALID_INPUT');
 const cfg=CAPTION_STYLES[style];let text=cap;
 if(cfg.time){
  const fallback=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const clock=/^\d{1,2}:\d{2}(\s?[AP]M)?$/i.test(String(timeLabel||'').trim())?String(timeLabel).trim():fallback;
  text=cap?`🕒 ${clock} · ${cap}`:`🕒 ${clock}`;
 }else if(cfg.prefix&&cap&&!cap.startsWith('🎵'))text=cfg.prefix+cap;
 if(!text)return{overlays:[],caption:cap};
 const hasBg=cfg.colors.length>0;
 return{caption:text,overlays:[{overlay_type:'caption',overlay_id:hasBg?'caption:party':'caption:standard',alt_text:text,data:{text,type:hasBg?'party':'standard',text_color:cfg.textColor,max_lines:{value:'4','@type':'type.googleapis.com/google.protobuf.Int64Value'},background:hasBg?{colors:cfg.colors}:{material_blur:'ultra_thin',colors:[]}}}]};
}
async function momentImageProxy(b){
 let target;try{target=new URL(String(b?.url||''));}catch{throw new ApiError(400,'Liên kết ảnh không hợp lệ.','INVALID_INPUT');}
 if(target.protocol!=='https:'||target.hostname!=='firebasestorage.googleapis.com'||target.username||target.password||!/^\/v0\/b\/locket-(img|video)\/o\//.test(target.pathname))throw new ApiError(400,'Chỉ hỗ trợ tải ảnh từ Locket Storage.','INVALID_INPUT');
 const res=await remote(target.href,{headers:{Accept:'image/*'}},20000);
 if(!res.ok)throw new ApiError(502,'Không tải được ảnh kỷ niệm từ Locket.','UPSTREAM_REJECTED');
 const bytes=new Uint8Array(await res.arrayBuffer());
 if(bytes.length>5*1024*1024)throw new ApiError(413,'Ảnh kỷ niệm vượt quá 5 MB.','TOO_LARGE');
 const mime=detectImageMime(bytes);if(!mime)throw new ApiError(502,'Dữ liệu ảnh kỷ niệm không hợp lệ.','INVALID_IMAGE');
 return{image:`data:${mime};base64,${bytesToBase64(bytes)}`};
}
function parseClientImage(image,missingMsg='Ảnh cần được chuẩn bị trước khi gửi.'){
 if(typeof image!=='string'||!/^data:image\/(webp|jpeg);base64,/.test(image))throw new ApiError(400,missingMsg,'INVALID_IMAGE');
 const expected=image.startsWith('data:image/jpeg;base64,')?'image/jpeg':'image/webp',raw=image.slice(image.indexOf(',')+1);
 let bytes;try{bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));}catch{throw new ApiError(400,'Không đọc được ảnh.','INVALID_IMAGE');}
 if(bytes.length<12||bytes.length>5*1024*1024||detectImageMime(bytes)!==expected)throw new ApiError(400,'Ảnh không hợp lệ hoặc lớn hơn 5 MB.','INVALID_IMAGE');
 return{bytes,mime:expected,base64:raw};
}
async function post(s,body,video=null){const cap=String(body.caption||'').trim();if(cap.length>150)throw new ApiError(400,'Caption tối đa 150 ký tự.','INVALID_INPUT');if(!['all','self','selected'].includes(body.audience))throw new ApiError(400,'Hãy chọn người nhận ảnh.','INVALID_INPUT');let recipients=[];if(body.audience==='selected'){if(!Array.isArray(body.recipients))throw new ApiError(400,'Hãy chọn ít nhất một người bạn nhận ảnh.','INVALID_INPUT');recipients=[...new Set(body.recipients.map(v=>typeof v==='string'?v.trim():''))].filter(Boolean);if(!recipients.length||recipients.length>50||recipients.some(id=>!/^[A-Za-z0-9_-]{1,128}$/.test(id)||id===s.uid))throw new ApiError(400,'Danh sách người nhận chưa hợp lệ.','INVALID_INPUT');}const overlayStyle=body.overlayStyle===undefined?'standard':String(body.overlayStyle);const built=buildOverlays(cap,overlayStyle,body.timeLabel);const parsed=parseClientImage(body.image);const thumbnail=await uploadImage(s,parsed.bytes,parsed.mime);const videoUrl=video?await uploadVideo(s,video):null;const result=await call(s,'postMomentV2',{thumbnail_url:thumbnail,...(videoUrl?{video_url:videoUrl}:{}),overlays:built.overlays,sent_to_self_only:body.audience==='self',sent_to_all:body.audience==='all',recipients,md5:`${crypto.randomUUID().replaceAll('-','')}_${Math.floor(Date.now()/1000)}`});const id=result?.canonical_uid||result?.id;if(!id)throw new ApiError(502,'Chưa nhận được mã bài đăng từ Locket. Hãy kiểm tra trong app Locket trước khi gửi lại.','POST_UNCONFIRMED');return {confirmed:true,moment:{id,author:s.uid,caption:built.caption,image:thumbnail,...(videoUrl?{video:videoUrl}:{}),time:Date.now()}};}
function videoBytes(body){
 if(!body||typeof body.video!=='string'||!body.video.startsWith('data:video/mp4;base64,')||!Number.isFinite(body.duration)||body.duration<=0||body.duration>15.05)throw new ApiError(400,'Chọn video MP4 đã xử lý, tối đa 15 giây.','INVALID_VIDEO');
 let bytes;try{bytes=Uint8Array.from(atob(body.video.slice(22)),c=>c.charCodeAt(0));}catch{throw new ApiError(400,'Không đọc được video.','INVALID_VIDEO');}
 if(bytes.length<16||bytes.length>=6*1024*1024||decoder.decode(bytes.slice(4,8))!=='ftyp')throw new ApiError(400,'Video MP4 không hợp lệ hoặc lớn hơn 6 MB.','INVALID_VIDEO');
 return bytes;
}
async function uploadVideo(s,bytes){
 const storage='https://firebasestorage.googleapis.com/v0/b/locket-video/o',objectPath=`users/${s.uid}/moments/videos/${crypto.randomUUID().replaceAll('-','').slice(0,20)}.mp4`,encoded=encodeURIComponent(objectPath);
 const init=await remote(`${storage}/${encoded}?uploadType=resumable&name=${encoded}`,{method:'POST',headers:{...headers(s),Authorization:`Firebase ${s.idToken}`,'x-goog-upload-protocol':'resumable','x-goog-upload-command':'start','x-goog-upload-content-type':'video/mp4','x-goog-upload-content-length':String(bytes.length),'x-firebase-storage-version':'ios/12.12.1','x-firebase-gmpid':APP_ID},body:JSON.stringify({bucket:'',contentType:'video/mp4',name:objectPath,metadata:{visibility:'private',creator:s.uid},cacheControl:'public, max-age=604800'})});
 if(!init.ok)throw upstreamError(null,init.status,'upload');
 let target;try{target=new URL(init.headers.get('x-goog-upload-url'));}catch{throw new ApiError(502,'Locket chưa cấp địa chỉ tải video.','UPLOAD_FAILED');}
 if(target.protocol!=='https:'||!['firebasestorage.googleapis.com','storage.googleapis.com'].includes(target.hostname)||target.username||target.password)throw new ApiError(502,'Địa chỉ tải video không hợp lệ.','UPLOAD_FAILED');
 const res=await remote(target.href,{method:'PUT',headers:{'Content-Type':'application/octet-stream','x-goog-upload-protocol':'resumable','x-goog-upload-command':'upload, finalize','x-goog-upload-offset':'0','x-goog-upload-content-length':String(bytes.length)},body:bytes},120000);
 if(!res.ok)throw upstreamError(null,res.status,'upload');
 let data;try{data=await res.json();}catch{throw new ApiError(502,'Locket chưa xác nhận tải video.','UPLOAD_FAILED');}
 let token=data.downloadTokens?.split(',')[0];
 if(!token){const metadata=await jsonRemote(`${storage}/${encoded}`,{headers:{Authorization:`Firebase ${s.idToken}`}},'upload');token=metadata.downloadTokens?.split(',')[0];}
 if(!token)throw new ApiError(502,'Locket chưa cấp liên kết video. Chưa tạo bài đăng.','UPLOAD_FAILED');
 return `${storage}/${encoded}?alt=media&token=${encodeURIComponent(token)}`;
}

async function readJson(request,max){if(Number(request.headers.get('content-length'))>max)throw new ApiError(413,'Dữ liệu gửi lên quá lớn.','TOO_LARGE');const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'Thiếu dữ liệu.','INVALID_INPUT');const chunks=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new ApiError(413,'Dữ liệu gửi lên quá lớn.','TOO_LARGE');}chunks.push(value);}const joined=new Uint8Array(total);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.length;}return JSON.parse(decoder.decode(joined));}catch(e){if(e instanceof ApiError)throw e;throw new ApiError(400,'Dữ liệu gửi lên không hợp lệ.','INVALID_INPUT');}}
const GEMINI_BASE='https://generativelanguage.googleapis.com/v1beta/models/';
const CF_BASE='https://api.cloudflare.com/client/v4/accounts/';
const bytesToBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};
function detectImageMime(bytes){
 if(!bytes||bytes.length<12)return null;
 if(bytes.slice(0,8).every((n,i)=>n===[137,80,78,71,13,10,26,10][i]))return'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return'image/jpeg';
 if(decoder.decode(bytes.slice(0,4))==='RIFF'&&decoder.decode(bytes.slice(8,12))==='WEBP')return'image/webp';
 return null;
}
function webpTargetSize(bytes){
 let w=0,h=0;const kind=bytes.length>=16?decoder.decode(bytes.slice(12,16)):'';
 if(kind==='VP8X'&&bytes.length>=30){w=(bytes[24]|(bytes[25]<<8)|(bytes[26]<<16))+1;h=(bytes[27]|(bytes[28]<<8)|(bytes[29]<<16))+1;}
 else if(kind==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a){w=(bytes[26]|(bytes[27]<<8))&0x3fff;h=(bytes[28]|(bytes[29]<<8))&0x3fff;}
 else if(kind==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){const bits=(bytes[21]|(bytes[22]<<8)|(bytes[23]<<16)|(bytes[24]<<24))>>>0;w=(bits&0x3fff)+1;h=((bits>>>14)&0x3fff)+1;}
 if(w>0&&h>0){const scale=Math.min(1,1024/Math.max(w,h)),snap=n=>Math.max(256,Math.min(1024,Math.round(n*scale/32)*32));return{width:snap(w),height:snap(h)};}
 return{width:768,height:960};
}
function aiModel(env){const model=env.GEMINI_IMAGE_MODEL||'gemini-2.5-flash-image';if(!/^gemini-[a-z0-9.-]+$/.test(model))throw new ApiError(503,'Tên model Gemini chưa hợp lệ.','AI_CONFIG_INVALID');return model;}
function cfConfig(env){
 const accountId=String(env.CLOUDFLARE_ACCOUNT_ID||'').trim();
 if(!/^[a-z0-9_-]{16,64}$/i.test(accountId))throw new ApiError(503,'CLOUDFLARE_ACCOUNT_ID chưa hợp lệ.','AI_CONFIG_INVALID');
 const model=String(env.CLOUDFLARE_IMAGE_MODEL||'@cf/black-forest-labs/flux-2-klein-9b').trim();
 if(!/^@(cf|hf)\/[a-z0-9][a-z0-9._/-]*$/i.test(model)||model.includes('..'))throw new ApiError(503,'Tên model Cloudflare chưa hợp lệ.','AI_CONFIG_INVALID');
 return{accountId,model};
}
function aiAccess(s,env){
 const pref=String(env.CHAM_AI_PROVIDER||'').trim().toLowerCase();
 if(pref&&!['cloudflare','gemini'].includes(pref))throw new ApiError(503,'CHAM_AI_PROVIDER chỉ nhận cloudflare hoặc gemini.','AI_CONFIG_INVALID');
 const hasCf=!!(env.CLOUDFLARE_ACCOUNT_ID||env.CLOUDFLARE_API_TOKEN);
 const provider=pref||(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_API_TOKEN?'cloudflare':env.GEMINI_API_KEY?'gemini':hasCf?'cloudflare':'');
 if(!provider)return{available:false,reason:'AI chưa được cấu hình trên máy chủ (.env.local).'};
 if(provider==='cloudflare'){
  if(!env.CLOUDFLARE_ACCOUNT_ID||!env.CLOUDFLARE_API_TOKEN)return{available:false,reason:'Điền đủ CLOUDFLARE_ACCOUNT_ID và CLOUDFLARE_API_TOKEN vào .env.local.'};
  if(!env.CHAM_AI_OWNER_UID)return{available:false,reason:'Chưa chọn UID Locket được phép dùng AI (CHAM_AI_OWNER_UID).'};
  if(s.uid!==env.CHAM_AI_OWNER_UID)return{available:false,reason:'AI hiện chỉ mở cho tài khoản chủ app.'};
  const cf=cfConfig(env);
  return{available:true,provider:'cloudflare',model:cf.model,accountId:cf.accountId,reason:'Đã kết nối Cloudflare Workers AI (gói miễn phí theo ngày).'};
 }
 if(!env.GEMINI_API_KEY)return{available:false,reason:'Gemini chưa được cấu hình trên máy chủ.'};
 if(!env.CHAM_AI_OWNER_UID)return{available:false,reason:'Chưa chọn UID Locket được phép dùng Gemini.'};
 if(s.uid!==env.CHAM_AI_OWNER_UID)return{available:false,reason:'AI hiện chỉ mở cho tài khoản chủ app.'};
 return{available:true,provider:'gemini',model:aiModel(env),reason:'Đã kết nối Gemini. Chỉ xử lý khi bạn bấm Chỉnh ảnh.'};
}
const publicAiAccess=({accountId,...rest})=>rest;
function geminiFailure(status,data){
 const apiStatus=data?.error?.status,msg=String(data?.error?.message||''),invalidKey=Array.isArray(data?.error?.details)&&data.error.details.some(detail=>detail.reason==='API_KEY_INVALID');
 if(status===401||invalidKey)throw new ApiError(502,'API key Gemini chưa hợp lệ. Chủ app cần cập nhật key.','AI_KEY_INVALID');
 if(status===429||apiStatus==='RESOURCE_EXHAUSTED')throw new ApiError(429,/limit:\s*0\b|free_tier/i.test(msg)?'Key Gemini đang ở gói Free (hạn mức tạo ảnh = 0). Hãy dùng Cloudflare Workers AI miễn phí hoặc bật Billing trong AI Studio.':'Gemini hết hạn mức hoặc đang giới hạn lượt dùng. Kiểm tra quota và thanh toán trong Google AI Studio.','AI_QUOTA');
 if(status===403||status===404)throw new ApiError(403,'API chưa có quyền dùng model Gemini chỉnh ảnh này. Kiểm tra model, key và dự án Google.','AI_MODEL_ACCESS');
 if(status>=500)throw new ApiError(502,'Gemini đang bận. Ảnh gốc vẫn được giữ lại.','AI_UNAVAILABLE');
 throw new ApiError(502,'Gemini chưa chỉnh được ảnh này. Thử mô tả khác hoặc kiểm tra tài khoản API.','AI_REJECTED');
}
function cloudflareFailure(status,data){
 const errors=Array.isArray(data?.errors)?data.errors:[],codes=errors.map(e=>Number(e?.code)),raw=errors.map(e=>String(e?.message||'')).join(' ');
 if(status===401||status===403||codes.some(c=>[10000,9109,7003].includes(c))||/authentication|unauthorized|not authorized|invalid.*token/i.test(raw))throw new ApiError(502,'Cloudflare Account ID hoặc API Token chưa đúng, hoặc thiếu quyền Workers AI (Edit).','AI_KEY_INVALID');
 if(status===429||codes.some(c=>[3036,4006].includes(c))||/quota|daily.*limit|neurons|rate limit/i.test(raw))throw new ApiError(429,'Đã hết lượt miễn phí hôm nay trên Cloudflare Workers AI (tự làm mới lúc 07:00 sáng).','AI_QUOTA');
 if(status===404||/no such model|model.*not found/i.test(raw))throw new ApiError(403,'Không tìm thấy model chỉnh ảnh trên Cloudflare Workers AI.','AI_MODEL_ACCESS');
 if(/nsfw|safety|blocked|moderation/i.test(raw))throw new ApiError(422,'Cloudflare AI từ chối yêu cầu này vì bộ lọc an toàn. Hãy thử ảnh hoặc mô tả khác.','AI_CONTENT_BLOCKED');
 if(status>=500)throw new ApiError(502,'Cloudflare Workers AI đang bận. Ảnh gốc vẫn được giữ lại.','AI_UNAVAILABLE');
 throw new ApiError(502,'Cloudflare Workers AI chưa chỉnh được ảnh này. Hãy thử viết mô tả rõ hơn (tiếng Anh hoặc tiếng Việt ngắn gọn).','AI_REJECTED');
}
async function aiStatus(s,env){
 const access=aiAccess(s,env);if(!access.available)return publicAiAccess(access);
 const secret=access.provider==='cloudflare'?env.CLOUDFLARE_ACCOUNT_ID+':'+env.CLOUDFLARE_API_TOKEN:env.GEMINI_API_KEY;
 const fingerprint=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(access.provider+':'+secret+':'+access.model))));
 if(aiModelCache?.fingerprint===fingerprint&&aiModelCache.until>Date.now())return aiModelCache.result;
 let result;try{
  if(access.provider==='cloudflare'){
   const search=encodeURIComponent(access.model.split('/').pop()||'flux');
   const r=await remote(`${CF_BASE}${access.accountId}/ai/models/search?per_page=5&search=${search}`,{headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`}},15000);
   let data;try{data=await r.json();}catch{throw Error();}
   if(!r.ok||data?.success===false)cloudflareFailure(r.status,data);
   result=publicAiAccess(access);
  }else{
   const r=await remote(GEMINI_BASE+access.model,{headers:{'x-goog-api-key':env.GEMINI_API_KEY}},15000);
   let data;try{data=await r.json();}catch{throw Error();}
   if(!r.ok)geminiFailure(r.status,data);
   result=data?.supportedGenerationMethods?.includes('generateContent')?publicAiAccess(access):{available:false,reason:'Model Gemini chưa hỗ trợ generateContent.'};
  }
 }catch(e){result={available:false,reason:e instanceof ApiError?e.message:`Chưa kết nối được ${access.provider==='cloudflare'?'Cloudflare Workers AI':'Gemini'}. Ảnh gốc vẫn được giữ lại.`};}
 aiModelCache={fingerprint,until:Date.now()+120000,result};return result;
}
function geminiImage(data){
 if(data?.promptFeedback?.blockReason&&data.promptFeedback.blockReason!=='BLOCK_REASON_UNSPECIFIED')throw new ApiError(422,'Gemini không thể chỉnh ảnh theo yêu cầu này. Hãy thử ảnh hoặc mô tả khác.','AI_CONTENT_BLOCKED');
 const candidates=Array.isArray(data?.candidates)?data.candidates:[];
 for(const candidate of candidates){
  if(candidate.finishReason&&candidate.finishReason!=='STOP')continue;
  for(const part of Array.isArray(candidate.content?.parts)?candidate.content.parts:[]){
   if(part.thought===true)continue;
   const image=part.inlineData;if(!image)continue;
   if(!['image/png','image/jpeg','image/webp'].includes(image.mimeType)||typeof image.data!=='string'||image.data.length>9*1024*1024)throw new ApiError(502,'Ảnh kết quả Gemini không hợp lệ hoặc quá lớn.','AI_INVALID_RESPONSE');
   let bytes;try{bytes=Uint8Array.from(atob(image.data),c=>c.charCodeAt(0));}catch{throw new ApiError(502,'Không đọc được ảnh Gemini.','AI_INVALID_RESPONSE');}
   const mime=detectImageMime(bytes);
   if(mime!==image.mimeType)throw new ApiError(502,'Dữ liệu trả về chưa phải ảnh hợp lệ.','AI_INVALID_RESPONSE');
   return{image:'data:'+image.mimeType+';base64,'+image.data,provider:'gemini'};
  }
 }
 if(candidates.some(c=>['SAFETY','IMAGE_SAFETY','BLOCKLIST','PROHIBITED_CONTENT','RECITATION'].includes(c.finishReason)))throw new ApiError(422,'Gemini không thể chỉnh ảnh theo yêu cầu này. Hãy thử ảnh hoặc mô tả khác.','AI_CONTENT_BLOCKED');
 throw new ApiError(502,'Gemini chưa trả về ảnh kết quả. Hãy mô tả rõ cách muốn chỉnh ảnh.','AI_NO_IMAGE');
}
async function translatePromptForCloudflare(access,env,prompt){
 if(!/[^\x00-\x7F]/.test(prompt))return prompt;
 try{
  const r=await remote(`${CF_BASE}${access.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,{method:'POST',headers:{Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'Translate the Vietnamese photo-editing instruction into a concise English image-to-image prompt under 55 words. Keep the original person, face, pose, and framing intact unless explicitly requested otherwise. Output ONLY the English prompt.'},{role:'user',content:prompt}],max_tokens:120,temperature:0.2})},6000);
  if(!r.ok)return prompt;
  const d=await r.json(),out=String(d?.result?.response||'').trim().replace(/^["']|["']$/g,'');
  return out&&out.length<=600?out:prompt;
 }catch{return prompt;}
}
async function cloudflareEdit(access,env,rawPrompt,bytes,rollback,inputMime='image/webp'){
 const prompt=await translatePromptForCloudflare(access,env,rawPrompt);
 const size=webpTargetSize(bytes),multipart=/\/flux-2-/i.test(access.model);
 let headers={Authorization:`Bearer ${env.CLOUDFLARE_API_TOKEN}`},reqBody;
 if(multipart){
  const form=new FormData();
  form.append('prompt',prompt);form.append('width',String(size.width));form.append('height',String(size.height));
  form.append('input_image_0',new Blob([bytes],{type:inputMime}),inputMime==='image/jpeg'?'input.jpg':'input.webp');
  const serialized=new Response(form);headers['Content-Type']=serialized.headers.get('Content-Type');reqBody=await serialized.arrayBuffer();
 }else{
  headers['Content-Type']='application/json';
  reqBody=JSON.stringify({prompt,image_b64:bytesToBase64(bytes),strength:0.65,num_steps:20,width:size.width,height:size.height});
 }
 let res;try{res=await remote(`${CF_BASE}${access.accountId}/ai/run/${access.model}`,{method:'POST',headers,body:reqBody},120000);}catch{rollback();throw new ApiError(502,'Cloudflare Workers AI chưa phản hồi. Ảnh gốc vẫn được giữ lại.','AI_UNAVAILABLE');}
 if(!res.ok){let errData=null;try{errData=await res.json();}catch{}rollback();cloudflareFailure(res.status,errData);}
 if(res.headers.get('content-type')?.startsWith('image/')){
  const out=new Uint8Array(await res.arrayBuffer());
  if(out.length>9*1024*1024){rollback();throw new ApiError(502,'Ảnh kết quả Cloudflare quá lớn.','AI_INVALID_RESPONSE');}
  const mime=detectImageMime(out);if(!mime){rollback();throw new ApiError(502,'Dữ liệu trả về từ Cloudflare chưa phải ảnh hợp lệ.','AI_INVALID_RESPONSE');}
  return{image:`data:${mime};base64,${bytesToBase64(out)}`,provider:'cloudflare'};
 }
 let data;try{data=await res.json();}catch{rollback();throw new ApiError(502,'Cloudflare trả về dữ liệu không hợp lệ.','AI_INVALID_RESPONSE');}
 if(data?.success===false){rollback();cloudflareFailure(res.status,data);}
 const b64=data?.result?.image;
 if(typeof b64!=='string'||!b64||b64.length>9*1024*1024)throw new ApiError(502,'Cloudflare chưa trả về ảnh kết quả. Hãy mô tả rõ cách muốn chỉnh ảnh.','AI_NO_IMAGE');
 let out;try{out=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));}catch{throw new ApiError(502,'Không đọc được ảnh kết quả từ Cloudflare.','AI_INVALID_RESPONSE');}
 const mime=detectImageMime(out);if(!mime)throw new ApiError(502,'Dữ liệu ảnh từ Cloudflare không hợp lệ.','AI_INVALID_RESPONSE');
 return{image:`data:${mime};base64,${b64}`,provider:'cloudflare'};
}
async function aiEdit(s,env,body){
 const access=aiAccess(s,env);if(!access.available)throw new ApiError(403,access.reason,'AI_NOT_AVAILABLE');
 if(!body||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>2000)throw new ApiError(400,'Mô tả chỉnh ảnh cần từ 1 đến 2000 ký tự.','INVALID_INPUT');
 const parsed=parseClientImage(body?.image,'Chọn ảnh trước khi dùng AI.');
 const hourlyLimit=access.provider==='cloudflare'?15:5;
 const now=Date.now();let quota=aiUsage.get(s.uid);if(!quota||quota.until<now)quota={count:0,until:now+3600000};
 if(quota.count>=hourlyLimit)throw new ApiError(429,`Đã dùng ${hourlyLimit} lượt AI trong giờ này. Vui lòng thử lại sau.`,'AI_RATE_LIMIT');quota.count++;aiUsage.set(s.uid,quota);
 const rollback=()=>{quota.count=Math.max(0,quota.count-1);};
 if(access.provider==='cloudflare')return cloudflareEdit(access,env,body.prompt.trim(),parsed.bytes,rollback,parsed.mime);
 const payload={contents:[{role:'user',parts:[{text:body.prompt.trim()},{inlineData:{mimeType:parsed.mime,data:parsed.base64}}]}],generationConfig:{responseModalities:['TEXT','IMAGE'],candidateCount:1}};
 let res;try{res=await remote(GEMINI_BASE+access.model+':generateContent',{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)},120000);}catch{rollback();throw new ApiError(502,'Gemini chưa phản hồi. Ảnh gốc vẫn được giữ lại. Kiểm tra hạn mức API trước khi thử lại.','AI_UNAVAILABLE');}
 let data;try{data=await res.json();}catch{rollback();throw new ApiError(502,'Gemini trả về dữ liệu không hợp lệ.','AI_INVALID_RESPONSE');}
 if(!res.ok){rollback();geminiFailure(res.status,data);}return geminiImage(data);
}
const baseHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Type':'application/json; charset=utf-8'};
function json(value,status=200,cookieValue){return new Response(JSON.stringify(value),{status,headers:{...baseHeaders,...(cookieValue?{'Set-Cookie':cookieValue}:{})}});}
async function rateLimit(request){const ip=request.headers.get('cf-connecting-ip')||'unknown';const key=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(ip))));const now=Date.now();if(loginAttempts.size>2000)for(const[k,v]of loginAttempts)if(v.until<now)loginAttempts.delete(k);if(loginAttempts.size>4000)throw new ApiError(429,'Máy chủ đang bận. Vui lòng thử lại sau.','RATE_LIMIT');let count=loginAttempts.get(key);if(!count||count.until<now)count={value:0,until:now+15*60000};if(count.value>=10)throw new ApiError(429,'Bạn đã thử nhiều lần. Vui lòng chờ 15 phút.','RATE_LIMIT');count.value++;loginAttempts.set(key,count);}
export default {async fetch(request,env){const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/')){if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});const asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(self), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});}
try{const methods={'/api/login':'POST','/api/logout':'POST','/api/session':'GET','/api/bootstrap':'GET','/api/feed':'GET','/api/history':'GET','/api/moments':'POST','/api/videos':'POST','/api/moment-image':'POST','/api/reaction':'POST','/api/ai/status':'GET','/api/ai/edit':'POST'};if(!methods[path])throw new ApiError(404,'Không tìm thấy chức năng.','NOT_FOUND');if(request.method!==methods[path])throw new ApiError(405,'Phương thức không hợp lệ.','METHOD_NOT_ALLOWED');if(request.method==='POST'){if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')throw new ApiError(403,'Yêu cầu không hợp lệ. Hãy tải lại trang.','ORIGIN_REJECTED');if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new ApiError(415,'Dữ liệu phải ở định dạng JSON.','CONTENT_TYPE');}
if(path==='/api/logout')return json({ok:true},200,clearCookie());
await sessionKey(env);
if(path==='/api/login'){await rateLimit(request);const b=await readJson(request,8192);if(typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>254||typeof b.password!=='string'||b.password.length<1||b.password.length>1024)throw new ApiError(400,'Nhập email và mật khẩu Locket của bạn.','INVALID_INPUT');const s=await login(b.email.trim(),b.password);let p;try{p=await getProfile(s);}catch{p={id:s.uid,name:'Bạn',username:'',image:'',email:s.email};}return json({connected:true,profile:p},200,cookie(await seal(s,env)));}
const s=await authenticated(request,env);const refreshed=()=>seal(s,env).then(cookie);
if(path==='/api/ai/status')return json(await aiStatus(s,env),200,await refreshed());
if(path==='/api/ai/edit'){if(!aiAccess(s,env).available)throw new ApiError(403,aiAccess(s,env).reason,'AI_NOT_AVAILABLE');const body=await readJson(request,7*1024*1024);return json(await aiEdit(s,env,body),200,await refreshed());}
if(path==='/api/session')return json({connected:true,profile:await getProfile(s)},200,await refreshed());
if(path==='/api/bootstrap'){const results=await Promise.allSettled([getProfile(s),friends(s),timeline(s)]);const warnings=[];['profile','friends','feed'].forEach((name,i)=>{if(results[i].status==='rejected')warnings.push(name);});const page=results[2].status==='fulfilled'?results[2].value:{moments:[],nextCursor:null,source:'unavailable'};return json({connected:true,profile:results[0].status==='fulfilled'?results[0].value:{id:s.uid,name:'Bạn',username:'',image:''},friends:results[1].status==='fulfilled'?results[1].value:[],moments:page.moments,nextCursor:page.nextCursor,feedSource:page.source,warnings},200,await refreshed());}
if(path==='/api/feed'||path==='/api/history'){const page=await historyPage(s,{user:path==='/api/history'?s.uid:url.searchParams.get('user')||null,cursor:url.searchParams.get('cursor'),limit:url.searchParams.has('limit')?Number(url.searchParams.get('limit')):30});return json(page,200,await refreshed());}
if(path==='/api/moments'||path==='/api/videos'){const body=await readJson(request,path==='/api/videos'?10*1024*1024:7*1024*1024);const video=path==='/api/videos'?videoBytes(body):null;let result;try{result=await post(s,body,video);}catch(e){if(e.code==='UPSTREAM_UNAVAILABLE')throw new ApiError(502,'Kết nối bị gián đoạn. Hãy kiểm tra trong Locket trước khi gửi lại để tránh đăng trùng.','POST_UNCONFIRMED');throw e;}return json(result,200,await refreshed());}
if(path==='/api/moment-image')return json(await momentImageProxy(await readJson(request,4096)),200,await refreshed());
if(path==='/api/reaction'){const b=await readJson(request,2048);if(typeof b.id!=='string'||b.id.length>128||!b.id)throw new ApiError(400,'Thiếu mã khoảnh khắc.','INVALID_INPUT');await call(s,'reactToMoment',{moment_uid:b.id,reaction:'❤️',from_memory:false,intensity:{'@type':'type.googleapis.com/google.protobuf.Int64Value',value:'0'}});return json({ok:true},200,await refreshed());}
}catch(e){const status=e instanceof ApiError?e.status:500;return json({error:{code:e instanceof ApiError?e.code:'SERVER_ERROR',message:e instanceof ApiError?e.message:'Máy chủ gặp sự cố. Vui lòng thử lại sau.'}},status,status===401&&e.code==='AUTH_REQUIRED'?clearCookie():undefined);}}};
