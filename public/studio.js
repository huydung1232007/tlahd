/* Local camera, full-bleed square viewfinder, Flash, 0.5x/Zoom, Digital Cam inside Photo, and Features drawer. */
(function(global){
'use strict';
const frames=global.ChamFrames;
const looks={
 natural:{name:'Gốc',css:'none'},
 ccd:{name:'CCD',css:'contrast(1.08) saturate(.82) brightness(1.04)'},
 warm:{name:'Nắng',css:'sepia(.2) saturate(.95)'},
 mono:{name:'Mono',css:'grayscale(1) contrast(1.12)'},
 fuji:{name:'Fuji Xanh',css:'contrast(1.05) saturate(.92) hue-rotate(-6deg) brightness(1.03)'},
 peach:{name:'Đào ấm',css:'contrast(1.03) saturate(1.08) sepia(.12) brightness(1.04)'},
 polaroid:{name:'Polaroid',css:'contrast(.94) saturate(.86) sepia(.18) brightness(1.05)'},
 neon:{name:'Đêm Film',css:'contrast(1.14) saturate(1.18) hue-rotate(-10deg) brightness(.98)'},
};
function geometry(count,layout,id='classic'){return frames.geometry(count,layout,id);}
function dateStamp(time){const d=new Date(time);return[d.getFullYear()%100,d.getMonth()+1,d.getDate()].map(n=>String(n).padStart(2,'0')).join('.');}
function pixels(data,look,grain=0,seed=1,tone=null){
 let state=seed>>>0;
 const br=tone?Number(tone.brightness||0)*1.6:0,ct=tone?1+Number(tone.contrast||0)/100:1,wm=tone?Number(tone.warmth||0):0;
 const hasTone=br!==0||ct!==1||wm!==0;
 for(let i=0;i<data.length;i+=4){
  let r=data[i],g=data[i+1],b=data[i+2];
  if(look==='mono'){const l=.299*r+.587*g+.114*b;r=g=b=(l-128)*1.12+128;}
  else if(look==='ccd'){r=(r-128)*1.08+128+3;g=(g-128)*1.08+128+6;b=(b-128)*1.08+128+12;const l=.299*r+.587*g+.114*b;r=l+(r-l)*.82;g=l+(g-l)*.82;b=l+(b-l)*.82;}
  else if(look==='warm'){r=r*1.02+11;g=g+4;b=b*.94-5;}
  else if(look==='fuji'){r=(r-128)*1.04+128-3;g=(g-128)*1.06+128+6;b=(b-128)*1.05+128+9;const l=.299*r+.587*g+.114*b;r=l+(r-l)*.9;g=l+(g-l)*.95;b=l+(b-l)*.95;}
  else if(look==='peach'){r=r*1.04+12;g=g*1.01+5;b=b*.97+2;}
  else if(look==='polaroid'){r=(r-128)*.9+136+8;g=(g-128)*.9+135+4;b=(b-128)*.88+132-6;}
  else if(look==='neon'){r=(r-128)*1.14+125+4;g=(g-128)*1.12+124-2;b=(b-128)*1.16+130+14;}
  if(hasTone){r=(r-128)*ct+128+br+wm*.9;g=(g-128)*ct+128+br+wm*.2;b=(b-128)*ct+128+br-wm*.9;}
  if(grain){state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=(state/4294967296-.5)*grain;r+=noise;g+=noise;b+=noise;}
  data[i]=Math.max(0,Math.min(255,Math.round(r)));data[i+1]=Math.max(0,Math.min(255,Math.round(g)));data[i+2]=Math.max(0,Math.min(255,Math.round(b)));
 }
 return data;
}
function cover(ctx,image,box,mirror=false,crop={}){const iw=image.videoWidth||image.naturalWidth||image.width,ih=image.videoHeight||image.naturalHeight||image.height;if(!iw||!ih)throw Error('Ảnh chưa sẵn sàng.');const b=global.ChamEdits.sourceBox(iw,ih,box.width,box.height,crop);ctx.save();if(mirror){ctx.translate(box.x+box.width,box.y);ctx.scale(-1,1);ctx.drawImage(image,b.x,b.y,b.width,b.height,0,0,box.width,box.height);}else ctx.drawImage(image,b.x,b.y,b.width,b.height,box.x,box.y,box.width,box.height);ctx.restore();}
function imageFrom(data){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Không đọc được ảnh này. Thử JPG, PNG hoặc WebP nhé.'));im.src=data;});}
const canvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
function styledFrame(image,width,height,options){const c=canvas(width,height),ctx=c.getContext('2d',{willReadFrequently:true});cover(ctx,image,{x:0,y:0,width,height},false,options.crop);const data=ctx.getImageData(0,0,width,height);pixels(data.data,options.look,options.grain,options.time%2147483647,options.tone);ctx.putImageData(data,0,0);if(options.look!=='natural'){const v=ctx.createRadialGradient(width/2,height/2,width*.2,width/2,height/2,Math.max(width,height)*.8);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.16)');ctx.fillStyle=v;ctx.fillRect(0,0,width,height);}if(options.stamp){ctx.font=`600 ${Math.round(width*.034)}px ui-monospace,monospace`;ctx.textAlign='right';ctx.fillStyle='#ffb66a';ctx.shadowColor='#18110b';ctx.shadowBlur=3;ctx.fillText(dateStamp(options.time),width-width*.05,height-height*.05);ctx.shadowBlur=0;}return c;}
function webp(c){if(global.ChamEdits?.exportCanvas)return global.ChamEdits.exportCanvas(c,.88);const data=c.toDataURL('image/webp',.88);if(data.startsWith('data:image/webp;base64,'))return data;const jpg=c.toDataURL('image/jpeg',.88);if(jpg.startsWith('data:image/jpeg;base64,'))return jpg;throw Error('Trình duyệt chưa xuất được ảnh.');}
async function compose(shots,options){const count=options.mode==='booth'?options.count:1;if(shots.length<count)throw Error(`Cần thêm ${count-shots.length} ảnh để ghép photobooth.`);const images=await Promise.all(shots.slice(0,count).map(s=>imageFrom(s.image)));if(options.mode!=='booth')return webp(styledFrame(images[0],1200,1200,{look:options.look||'natural',grain:options.grain||0,stamp:!!options.stamp,time:shots[0].time,crop:shots[0].crop,tone:options.tone}));const id=options.frameStyle||'classic',grid=geometry(count,options.layout,id),out=canvas(grid.width,grid.height),ctx=out.getContext('2d');frames.background(ctx,grid,id,options.frame,options.custom);images.forEach((image,i)=>{const slot=grid.slots[i];ctx.save();frames.slotPath(ctx,slot,id);ctx.clip();ctx.drawImage(styledFrame(image,slot.width,slot.height,{look:'natural',grain:0,stamp:false,time:shots[i].time,crop:shots[i].crop,tone:options.tone}),slot.x,slot.y);ctx.restore();});frames.overlay(ctx,grid,id,shots[0].time,options.frame,options.custom);return webp(out);}

async function composeDual(mainShot,pipShot,options){
 const [imMain,imPip]=await Promise.all([imageFrom(mainShot.image),imageFrom(pipShot.image)]);
 const out=styledFrame(imMain,1200,1200,{look:options.look||'natural',grain:options.grain||0,stamp:!!options.stamp,time:mainShot.time,tone:options.tone});
 const pip=styledFrame(imPip,348,448,{look:options.look||'natural',grain:Math.round((options.grain||0)*.6),stamp:false,time:pipShot.time,tone:options.tone});
 const ctx=out.getContext('2d'),x=52,y=52,w=348,h=448,r=52;
 const rr=()=>{ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();};
 ctx.save();ctx.shadowColor='rgba(0,0,0,.52)';ctx.shadowBlur=28;ctx.shadowOffsetY=10;ctx.fillStyle='#0d0d12';rr();ctx.fill();ctx.restore();
 ctx.save();rr();ctx.clip();ctx.drawImage(pip,x,y,w,h);ctx.restore();
 ctx.save();rr();ctx.lineWidth=6;ctx.strokeStyle='rgba(255,255,255,.9)';ctx.stroke();ctx.restore();
 return webp(out);
}
const bytesToB64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);};

const state={mode:'photo',look:'natural',grain:0,stamp:false,tone:{brightness:0,contrast:0,warmth:0},timer:0,flash:false,grid:false,dualCam:false,zoom:1,liveBooth:true,count:4,layout:'strip',frame:'#ffffff',frameStyle:'airmail',custom:{title:'',message:'',date:'',paper:'',ink:''},aiPrompt:'',retakeIndex:null,facing:'user',shots:[],output:'',aiResult:'',aiApplied:'',busy:false,countdown:0,status:''};
const svgIcons={
 gallery:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
 flip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>',
 flash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
 flashOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 8.5 8M6.2 11 4 14h7l-1 8 6.5-8.7M17 10h3l-3.5 4.7M3 3l18 18"/></svg>',
 dual:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="13" height="16" rx="3"/><rect x="11" y="8" width="10" height="12" rx="3"/></svg>',
 grid:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
 timer:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2h5"/></svg>',
 features:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 3.8L17.5 8.5l-3.8 1.7L12 14l-1.7-3.8L6.5 8.5l3.8-1.7Z"/><path d="M5 17h14M8 14v6M16 14v6"/></svg>',
 close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 send:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
 download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
};

let root=null,callbacks={},media=null,activeRecorder=null,liveClips=[],mounted=0,renderId=0,sequence=0,aiBusy=false,lastAIUser=null,toneTimer=null;
let timerOpen=false,featuresOpen=false,featureTab='digital',startingCamera=false,pickingFileUntil=0,needsFreshVideo=false,resumeTimer=null;
let videoClip=null,holdTimer=null,holdSession=null,holdElapsed=0,suppressNextClick=false,lastTapAt=0,lastTapX=0,lastTapY=0;
let usingUltraWideDevice=false,hwZoomApplied=1,pinchStartDist=0,pinchStartZoom=1,lensSwitching=false,zoomHudVisible=false,zoomHudTimer=null;
let aiState={available:false,reason:'Đăng nhập Locket để dùng AI.'};
const $=s=>root?.querySelector(s);
const need=()=>state.mode==='booth'?state.count:1;
const activeOutput=()=>state.aiApplied||state.output;
const hasLiveSet=()=>state.mode==='booth'&&liveClips.slice(0,need()).filter(Boolean).length===need();
const isDigitalActive=()=>state.mode==='photo'&&(state.look!=='natural'||state.grain>0||state.stamp);
const isToneActive=()=>!!(state.tone?.brightness||state.tone?.contrast||state.tone?.warmth);
const isCameraLive=()=>!!(media&&(!media.getVideoTracks||media.getVideoTracks().some(t=>t.readyState==='live'&&!t.muted)));
const effectiveDigitalZoom=()=>state.zoom>1&&hwZoomApplied<state.zoom?Math.min(4,state.zoom/Math.max(1,hwZoomApplied)):1;
function clearVideoClip(){
 if(videoClip?.blobUrl&&typeof URL!=='undefined'&&URL.revokeObjectURL){try{URL.revokeObjectURL(videoClip.blobUrl);}catch{}}
 videoClip=null;
 const vr=$('.studio-video-result');if(vr){try{vr.pause?.();vr.removeAttribute?.('src');}catch{}vr.hidden=true;}
}
function cancelHoldRecording(){
 clearTimeout(holdTimer);holdTimer=null;
 if(holdSession){try{holdSession.cancel();}catch{}holdSession=null;}
 holdElapsed=0;
}

function showZoomHud(){
 zoomHudVisible=true;
 clearTimeout(zoomHudTimer);
 zoomHudTimer=setTimeout(()=>{zoomHudVisible=false;if(root)update();},3000);
}
function hideZoomHud(){
 clearTimeout(zoomHudTimer);
 zoomHudVisible=false;
}

function stop(){cancelHoldRecording();sequence++;state.busy=false;state.countdown=0;startingCamera=false;hwZoomApplied=1;usingUltraWideDevice=false;try{activeRecorder?.cancel();}catch{}activeRecorder=null;if(media){media.getTracks().forEach(t=>{try{t.onended=null;t.stop();}catch{}});media=null;}const v=$('video');if(v)v.srcObject=null;}
function ensureCamera(){
 if(!root||state.busy||restoring||startingCamera)return;
 if((activeOutput()||videoClip)&&state.retakeIndex===null)return;
 if(isCameraLive()){const v=$('video');if(v&&v.paused)v.play?.().catch(()=>{});return;}
 if(typeof global.navigator==='undefined'||!global.navigator?.mediaDevices?.getUserMedia)return;
 start();
}
function startClipRecorder(stream,index){
 if(!state.liveBooth||!stream||typeof global.MediaRecorder!=='function')return null;
 try{
  const mime=['video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>global.MediaRecorder.isTypeSupported?.(t))||'';
  const rec=new global.MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:2500000}:undefined),chunks=[];
  let cancelled=false;
  rec.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
  const stopped=new Promise(resolve=>{rec.onstop=()=>{if(cancelled||!chunks.length){resolve(null);return;}const type=rec.mimeType||mime||'video/webm',ext=type.includes('mp4')?'mp4':'webm';resolve(new File(chunks,`live-${index+1}.${ext}`,{type:type.split(';')[0]}));};rec.onerror=()=>resolve(null);});
  rec.start(250);
  const handle={stop:async()=>{if(rec.state!=='inactive')try{rec.stop();}catch{return null;}return stopped;},cancel:()=>{cancelled=true;if(rec.state!=='inactive')try{rec.stop();}catch{}}};
  activeRecorder=handle;return handle;
 }catch{return null;}
}
function videoFilterCss(){
 const base=state.mode==='photo'&&(looks[state.look]?.css&&looks[state.look].css!=='none')?looks[state.look].css:'';
 const t=state.tone||{},parts=[];
 if(base)parts.push(base);
 if(t.brightness)parts.push(`brightness(${(1+t.brightness/100).toFixed(2)})`);
 if(t.contrast)parts.push(`contrast(${(1+t.contrast/100).toFixed(2)})`);
 if(t.warmth>0)parts.push(`sepia(${(t.warmth/120).toFixed(2)})`);
 return parts.length?parts.join(' '):'none';
}
function syncVideoBox(){
 const v=$('video'),vf=$('.viewfinder');if(!v)return;
 const vw=v.videoWidth||0,vh=v.videoHeight||0;
 const bw=vf?.clientWidth||1,bh=vf?.clientHeight||1;
 if(vw>0&&vh>0&&bw>0&&bh>0){
  const videoRatio=vw/vh,boxRatio=bw/bh;
  if(videoRatio>boxRatio){
   v.style.height='100%';
   v.style.width=((videoRatio/boxRatio)*100).toFixed(3)+'%';
  }else{
   v.style.width='100%';
   v.style.height=((boxRatio/videoRatio)*100).toFixed(3)+'%';
  }
 }else{v.style.width='100%';v.style.height='100%';}
}
function videoTransformCss(){
 const dz=effectiveDigitalZoom();
 const flipX=state.facing==='user'?-dz:dz;
 return `translate(-50%,-50%) scale(${flipX.toFixed(3)},${dz.toFixed(3)})`;
}
function formatCurrentZoom(z){
 const clean=Math.round(Number(z)*10)/10;
 return (Number.isInteger(clean)?String(clean):clean.toFixed(1))+'×';
}

function markup(){return `<div class="studio"><div class="camera-modes" role="group" aria-label="Chế độ chụp"><button data-studio="mode" data-value="photo">Ảnh</button><button data-studio="mode" data-value="booth">Photobooth</button><button data-view="video">Video</button></div><div class="studio-layout"><section class="camera-area"><div class="viewfinder" tabindex="0"><video autoplay playsinline webkit-playsinline muted disablepictureinpicture disableremoteplayback aria-label="Xem trước camera"></video><img class="frame-preview" alt="Xem trước khung photobooth" hidden><img class="studio-result" alt="Ảnh đang xem lại" hidden><video class="studio-video-result" loop playsinline webkit-playsinline disablepictureinpicture disableremoteplayback aria-label="Video vừa quay" hidden></video><div class="viewfinder-grid" aria-hidden="true" hidden><span class="grid-v1"></span><span class="grid-v2"></span><span class="grid-h1"></span><span class="grid-h2"></span></div><div class="viewfinder-empty"><span class="camera-outline">◎</span><strong>Đang mở camera…</strong><p>Cấp quyền camera hoặc chọn ảnh từ thư viện.</p></div><div class="camera-meta"><span class="mode-label">ẢNH</span><div class="camera-quick-tools"><button type="button" class="dual-trigger" data-studio="toggle-dual" aria-label="Camera Kép trước và sau" aria-pressed="false">${svgIcons.dual}</button><button type="button" class="grid-trigger" data-studio="toggle-grid" aria-label="Lưới bố cục 3x3" aria-pressed="false">${svgIcons.grid}</button><button type="button" class="flash-trigger" data-studio="toggle-flash" aria-label="Đèn Flash" aria-pressed="false">${svgIcons.flashOff}</button><div class="timer-control"><button type="button" class="timer-trigger" data-studio="toggle-timer" aria-label="Hẹn giờ chụp" aria-expanded="false">${svgIcons.timer}<span class="timer-badge"></span></button><div class="timer-popover" role="group" aria-label="Chọn hẹn giờ" hidden>${[0,3,5,10].map(s=>`<button type="button" data-studio="timer" data-value="${s}">${s?s+'s':'Tắt'}</button>`).join('')}</div></div><button type="button" class="features-trigger" data-studio="toggle-features" aria-label="Tính năng chỉnh ảnh" aria-expanded="false">${svgIcons.features}</button></div></div><div class="zoom-bar" role="group" aria-label="Thu phóng ống kính"></div><div class="countdown" aria-live="assertive"></div><div class="shutter-flash"></div></div><div class="retina-screen-flash" hidden></div><div class="camera-status" role="status"></div><div class="capture-controls"><button type="button" class="round-control" data-studio="files" aria-label="Chọn ảnh từ thư viện">${svgIcons.gallery}</button><button type="button" class="shutter" data-studio="capture" aria-label="Chụp ảnh hoặc nhấn giữ để quay video"><span></span></button><button type="button" class="round-control" data-studio="flip" aria-label="Đổi camera trước hoặc sau">${svgIcons.flip}</button></div><div class="capture-label" hidden></div><input type="file" class="studio-file-input" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden><button class="text-button cancel-retake" data-studio="cancel-retake" hidden>Giữ tấm cũ</button><div class="review-actions" hidden><button type="button" class="round-control review-icon-btn" data-studio="reset" aria-label="Chụp lại">${svgIcons.close}</button><button type="button" class="send-shutter" data-studio="use" aria-label="Đăng lên Locket">${svgIcons.send}</button><button type="button" class="round-control review-icon-btn" data-studio="download" aria-label="Tải xuống">${svgIcons.download}</button></div><div class="live-booth-bar" hidden><button type="button" class="secondary live-booth-btn" data-studio="open-live-booth">▷ Tạo Photobooth động</button></div><div class="booth-shots" aria-label="Ảnh trong photobooth"></div><div class="photo-edit-tools" hidden></div><div class="ai-comparison" hidden></div></section><aside class="studio-settings"><div class="settings-section studio-features-panel" hidden><div class="features-panel-head"><div class="features-tabs" role="tablist" aria-label="Tính năng chỉnh ảnh"><button type="button" data-studio="feature-tab" data-value="digital">Digital Cam</button><button type="button" data-studio="feature-tab" data-value="tone">Ánh sáng & độ ấm</button><button type="button" data-studio="feature-tab" data-value="ai">Chỉnh bằng AI</button></div><button type="button" class="icon-button features-close" data-studio="close-features" data-studio-close="1" aria-label="Đóng tính năng">${svgIcons.close}</button></div><div class="feature-pane feature-pane-digital"><div class="feature-subhead"><span>Màu film Digital Cam</span><button type="button" class="text-button" data-studio="reset-digital" hidden>Tắt Digital Cam</button></div><div class="look-buttons">${Object.entries(looks).map(([id,l])=>`<button type="button" data-studio="look" data-value="${id}"><span class="look-swatch ${id}"></span>${l.name}</button>`).join('')}</div><div class="digital-extras"><label class="range-label" for="grain">Hạt ảnh <output id="grain-value">0</output></label><input type="range" id="grain" min="0" max="32" step="1" value="0"><label class="switch-row">Dấu ngày trên ảnh <input type="checkbox" id="date-stamp"></label></div></div><div class="feature-pane feature-pane-tone" hidden><label class="range-label" for="tone-brightness">Độ sáng <output id="val-brightness">0</output></label><input type="range" id="tone-brightness" data-tone="brightness" min="-30" max="30" step="1" value="0"><label class="range-label" for="tone-contrast">Tương phản <output id="val-contrast">0</output></label><input type="range" id="tone-contrast" data-tone="contrast" min="-30" max="30" step="1" value="0"><label class="range-label" for="tone-warmth">Độ ấm <output id="val-warmth">0</output></label><input type="range" id="tone-warmth" data-tone="warmth" min="-30" max="30" step="1" value="0"><button type="button" class="text-button" data-studio="reset-tone" hidden>Đặt lại ánh sáng</button></div><div class="feature-pane feature-pane-ai" hidden><div class="ai-section-heading"><h2>Chỉnh ảnh bằng AI</h2><span class="ai-service-status">Đang kết nối</span></div><p class="ai-need-photo setting-hint" hidden>Chụp hoặc chọn ảnh trước để chạy AI. Bạn vẫn có thể chọn sẵn gợi ý bên dưới.</p><div class="ai-form"><label for="ai-prompt">Mô tả cách chỉnh</label><textarea id="ai-prompt" maxlength="2000" placeholder="Ví dụ: màu phim Nhật nắng chiều ấm áp, giữ nguyên người trong ảnh"></textarea><div class="prompt-tools"></div><p class="ai-provider-note">Ảnh và prompt chỉ được gửi tới dịch vụ AI khi bạn bấm Chỉnh ảnh.</p><button type="button" class="primary" data-studio="ai-run">Chỉnh ảnh</button><p class="ai-feedback" role="status"></p></div><div class="ai-compare" hidden><button type="button" class="secondary" data-studio="ai-original">Giữ ảnh gốc</button><button type="button" class="primary" data-studio="ai-use">Dùng ảnh AI</button></div><button type="button" class="text-button ai-revert" data-studio="ai-revert" hidden>Quay lại ảnh gốc trước AI</button></div></div><div class="settings-section booth-settings" hidden><div class="frame-picker-heading"><h2>Khung photobooth</h2><span class="frame-selected"></span></div><div class="frame-gallery" role="group" aria-label="Mẫu khung photobooth">${frames.presets.map(p=>`<button class="frame-option" data-studio="frame-style" data-value="${p.id}" aria-label="Khung ${p.name}"><img alt="" src="${frames.preview(p.id,3,'strip','#ffffff',96)}"><span>${p.name}</span></button>`).join('')}</div><div class="small-segments"><button data-studio="count" data-value="2">2 tấm</button><button data-studio="count" data-value="3">3 tấm</button><button data-studio="count" data-value="4">4 tấm</button></div><div class="small-segments"><button data-studio="layout" data-value="strip">Dải dọc</button><button data-studio="layout" data-value="grid">Ngang / Lưới</button></div><div class="frame-colors" aria-label="Màu khung"><button data-studio="frame" data-value="#ffffff" aria-label="Khung trắng" style="background:white"></button><button data-studio="frame" data-value="#161616" aria-label="Khung đen" style="background:#161616"></button><button data-studio="frame" data-value="#dfeaff" aria-label="Khung xanh nhạt" style="background:#dfeaff"></button></div><label class="switch-row live-booth-row">Ghi kèm clip động (Live) <input type="checkbox" id="live-booth" checked></label><div class="frame-custom-tools"></div><p class="setting-hint">Chụp cách nhau 3 giây (tự ghi kèm clip động nếu bật Live), hoặc chọn ảnh có sẵn.</p></div></aside></div></div>`;}

function update(){
 if(!root)return;
 const currentOutput=activeOutput(),hasVideo=!!videoClip,isRec=!!holdSession;
 const reviewing=(!!currentOutput||hasVideo)&&state.retakeIndex===null;
 if(state.mode==='booth'&&featureTab==='digital')featureTab='tone';
 $('.studio').classList.toggle('is-booth',state.mode==='booth');
 const showAside=(featuresOpen||state.mode==='booth')&&!hasVideo;
 $('.studio-settings').hidden=!showAside;
 $('.studio-layout').classList.toggle('single-col',!showAside);
 $('.studio-features-panel').hidden=!featuresOpen||hasVideo;
 $('.booth-settings').hidden=state.mode!=='booth';

 root.querySelectorAll('[data-studio="mode"]').forEach(b=>{b.classList.toggle('active',b.dataset.value===state.mode);b.setAttribute('aria-pressed',String(b.dataset.value===state.mode));b.disabled=state.busy||isRec||aiBusy||restoring;});
 for(const type of ['look','count','layout','frame','frameStyle','timer'])root.querySelectorAll(`[data-studio="${type==='frameStyle'?'frame-style':type}"]`).forEach(b=>{b.classList.toggle('active',String(state[type])===b.dataset.value);b.setAttribute('aria-pressed',String(state[type])===b.dataset.value);b.disabled=state.busy||isRec||aiBusy||restoring;});
 root.querySelectorAll('[data-studio="feature-tab"]').forEach(b=>{
  const val=b.dataset.value;
  if(val==='digital')b.hidden=state.mode!=='photo';
  b.classList.toggle('active',val===featureTab);
  b.setAttribute('aria-selected',String(val===featureTab));
 });
 $('.feature-pane-digital').hidden=featureTab!=='digital'||state.mode!=='photo';
 $('.feature-pane-tone').hidden=featureTab!=='tone';
 $('.feature-pane-ai').hidden=featureTab!=='ai';

 const dualBtn=$('.dual-trigger');
 if(dualBtn){
  dualBtn.hidden=state.mode==='booth'||reviewing||isRec;
  dualBtn.classList.toggle('active',state.dualCam);
  dualBtn.setAttribute('aria-pressed',String(state.dualCam));
  dualBtn.disabled=state.busy||isRec;
 }
 const gridBtn=$('.grid-trigger');
 if(gridBtn){
  gridBtn.hidden=reviewing||isRec;
  gridBtn.classList.toggle('active',state.grid);
  gridBtn.setAttribute('aria-pressed',String(state.grid));
  gridBtn.disabled=state.busy;
 }
 const flashBtn=$('.flash-trigger');
 if(flashBtn){
  flashBtn.hidden=reviewing||isRec;
  flashBtn.classList.toggle('active',state.flash);
  flashBtn.setAttribute('aria-pressed',String(state.flash));
  flashBtn.innerHTML=state.flash?svgIcons.flash:svgIcons.flashOff;
  flashBtn.disabled=state.busy||isRec;
 }

 const featBtn=$('.features-trigger');
 const anyFeatureOn=isDigitalActive()||isToneActive()||!!state.aiApplied||!!state.aiResult;
 if(featBtn){featBtn.hidden=hasVideo||isRec;featBtn.classList.toggle('open',featuresOpen);featBtn.classList.toggle('has-active',anyFeatureOn);featBtn.setAttribute('aria-expanded',String(featuresOpen));featBtn.disabled=state.busy;}
 const resetDig=$('[data-studio="reset-digital"]');if(resetDig)resetDig.hidden=!isDigitalActive();

 const timerCtrl=$('.timer-control'),timerTrig=$('.timer-trigger'),timerPop=$('.timer-popover'),timerBadge=$('.timer-badge');
 if(timerCtrl){const hideTimer=state.mode==='booth'||reviewing||isRec;timerCtrl.hidden=hideTimer;if(hideTimer)timerOpen=false;}
 if(timerTrig){timerTrig.classList.toggle('has-timer',state.timer>0);timerTrig.classList.toggle('open',timerOpen);timerTrig.setAttribute('aria-expanded',String(timerOpen));timerTrig.disabled=state.busy||isRec||aiBusy||restoring;}
 if(timerBadge)timerBadge.textContent=state.timer?state.timer+'s':'';
 if(timerPop)timerPop.hidden=!timerOpen||state.busy||isRec;

 const zoomBar=$('.zoom-bar');
 if(zoomBar){
  const showZoom=zoomHudVisible&&!reviewing&&!!media;
  zoomBar.hidden=!showZoom;
  zoomBar.innerHTML=showZoom?`<span class="zoom-pill active">${formatCurrentZoom(state.zoom)}</span>`:'';
 }

 $('#grain').disabled=state.busy||aiBusy||restoring;$('#date-stamp').disabled=state.busy||aiBusy||restoring;$('#live-booth').disabled=state.busy||aiBusy||restoring;
 $('#grain').value=state.grain;$('#grain-value').textContent=state.grain;$('#date-stamp').checked=state.stamp;$('#live-booth').checked=state.liveBooth;
 for(const k of['brightness','contrast','warmth']){const v=Number(state.tone?.[k]||0),inp=$('#tone-'+k),out=$('#val-'+k);if(inp){inp.value=v;inp.disabled=state.busy||aiBusy||restoring;}if(out)out.textContent=v>0?'+'+v:String(v);}
 const toneReset=$('[data-studio="reset-tone"]');if(toneReset)toneReset.hidden=!isToneActive();

 const digLabel=isDigitalActive()?`DIGITAL · ${(looks[state.look]?.name||'FILM').toUpperCase()}`:'ẢNH';
 const modeLabelEl=$('.mode-label');
 modeLabelEl.classList.toggle('is-rec',isRec);
 modeLabelEl.textContent=isRec?`● REC · ${holdElapsed.toFixed(1)}s / 10s`:hasVideo?`VIDEO · ${videoClip.duration.toFixed(1)}S`:state.mode==='booth'?`PHOTOBOOTH · ${Math.min(state.shots.length,need())}/${need()}`:state.dualCam?`DUAL CAM${isDigitalActive()?` · ${(looks[state.look]?.name||'FILM').toUpperCase()}`:''}`:(digLabel+(state.aiApplied?' · AI':''));

 const displayed=state.retakeIndex!==null||hasVideo?'':state.aiResult||currentOutput;
 $('.studio-result').hidden=!displayed;if(displayed)$('.studio-result').src=displayed;
 const vidRes=$('.studio-video-result');
 if(vidRes){
  const showVid=hasVideo&&state.retakeIndex===null;
  vidRes.hidden=!showVid;
  if(showVid&&videoClip.blobUrl&&vidRes.src!==videoClip.blobUrl){
   vidRes.src=videoClip.blobUrl;vidRes.muted=false;
   vidRes.play?.().catch(()=>{vidRes.muted=true;vidRes.play?.().catch(()=>{});});
  }
 }
 $('video').hidden=!!displayed||hasVideo||!media;
 syncVideoBox();
 $('video').style.filter=videoFilterCss();
 $('video').style.transform=videoTransformCss();
 const framePreview=state.mode==='booth'&&!displayed&&!hasVideo&&!media;
 const gridOverlay=$('.viewfinder-grid');if(gridOverlay)gridOverlay.hidden=!state.grid||reviewing||(!media&&!framePreview);
 $('.frame-preview').hidden=!framePreview;if(framePreview)$('.frame-preview').src=frames.preview(state.frameStyle,state.count,state.layout,state.frame,420,state.custom);
 $('.viewfinder-empty').hidden=!!displayed||hasVideo||!!media||framePreview;
 $('.viewfinder').classList.toggle('show-frame-preview',framePreview);
 $('.frame-selected').textContent=frames.preset(state.frameStyle).name;
 $('.frame-colors').hidden=state.frameStyle!=='classic';
 const layoutGridBtn=root.querySelector('[data-studio="layout"][data-value="grid"]');if(layoutGridBtn)layoutGridBtn.textContent=state.count===2?'Ghép ngang':'Dạng lưới';
 $('.viewfinder').classList.toggle('has-output',!!displayed||hasVideo);
 $('.viewfinder').classList.toggle('is-booth-output',!!displayed&&state.mode==='booth');
 $('.camera-status').textContent=state.status;$('.countdown').textContent=state.countdown||'';

 $('.review-actions').hidden=!reviewing;
 const liveBar=$('.live-booth-bar');if(liveBar)liveBar.hidden=!reviewing||hasVideo||!hasLiveSet()||!callbacks.onLiveBooth;
 $('.capture-controls').hidden=reviewing;
 const shutterBtn=$('[data-studio="capture"]');
 shutterBtn?.classList?.toggle?.('is-recording',isRec);
 const capLabel=$('.capture-label');if(capLabel){const labelTxt=isRec?'Thả tay để dừng quay':state.busy?'Chạm để dừng':state.retakeIndex!==null?'Chụp lại tấm '+(state.retakeIndex+1):state.mode==='booth'&&state.shots.length?`Còn ${need()-Math.min(state.shots.length,need())} tấm`:'';capLabel.textContent=labelTxt;capLabel.hidden=reviewing||!labelTxt;}
 $('.cancel-retake').hidden=state.retakeIndex===null;
 shutterBtn.setAttribute('aria-label',isRec?'Đang quay video':state.busy?'Dừng chụp':'Chụp ảnh');
 $('[data-studio="flip"]').disabled=state.busy||isRec;$('[data-studio="files"]').disabled=state.busy||isRec;
 $('.studio-file-input').multiple=state.mode==='booth';

 const needPhotoNote=$('.ai-need-photo');if(needPhotoNote)needPhotoNote.hidden=!!currentOutput;
 $('.ai-compare').hidden=!state.aiResult;
 $('.ai-revert').hidden=!state.aiApplied||!!state.aiResult||state.busy||aiBusy||restoring;
 $('.ai-service-status').textContent=aiState.available?(aiState.provider==='cloudflare'?'Cloudflare AI':'Gemini'):'Chưa sẵn sàng';
 const providerNote=$('.ai-provider-note');if(providerNote)providerNote.textContent=aiState.provider==='cloudflare'?'Chỉnh bằng Cloudflare Workers AI (FLUX.2 miễn phí theo ngày, tự dịch tiếng Việt).':'Ảnh và prompt chỉ gửi tới AI khi bạn bấm Chỉnh ảnh.';
 $('[data-studio="ai-run"]').disabled=!currentOutput||aiBusy||!aiState.available||state.busy||restoring;

 $('.booth-shots').hidden=state.mode!=='booth';
 const activeShot=global.ChamPhotoEditor?.selectedIndex?.()??0;
 $('.booth-shots').innerHTML=state.mode==='booth'?Array.from({length:need()},(_,i)=>{const isSelected=!!state.shots[i]&&i===activeShot;return `<button class="shot-slot ${isSelected?'active':''}" data-studio="edit-shot" data-index="${i}" aria-label="Chỉnh tấm ${i+1}" aria-current="${isSelected?'true':'false'}" ${state.shots[i]?'':'disabled'}>${state.shots[i]?`<img src="${state.shots[i].image}" alt="Tấm ${i+1}">`:`<span>${i+1}</span>`}</button>`;}).join(''):'';
 root.querySelectorAll('.review-actions button,.live-booth-bar button').forEach(b=>b.disabled=state.busy||aiBusy||restoring);
 global.ChamPhotoEditor?.refresh();global.ChamStudioTools?.refresh();
}

async function rebuild(){if(!root)return;if(state.shots.length<need()){state.output='';state.aiResult='';state.aiApplied='';state.status=state.mode==='booth'&&state.shots.length?`Đã có ${state.shots.length}/${need()} tấm.`:'';update();saveDraft();ensureCamera();return;}const id=++renderId,version=mounted;update();try{const data=await compose(state.shots,state);if(version!==mounted||id!==renderId||!root)return;state.output=data;state.aiResult='';state.aiApplied='';state.status='';update();saveDraft();}catch(e){if(root&&version===mounted&&id===renderId){state.status=e.message;update();}}}

async function findRearCameraDevice(wantUltraWide){
 if(!global.navigator?.mediaDevices?.enumerateDevices)return null;
 try{
  const list=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'&&d.deviceId);
  if(wantUltraWide){
   return list.find(d=>/ultra\s*wide|siêu\s*rộng|0\.5/i.test(d.label||''))||null;
  }
  return list.find(d=>/back|rear|sau|environment/i.test(d.label||'')&&!/ultra\s*wide|siêu\s*rộng|telephoto/i.test(d.label||''))||null;
 }catch{return null;}
}

async function syncHardwareTorch(enable){
 const track=media?.getVideoTracks?.()?.[0];
 if(!track?.getCapabilities||!track?.applyConstraints)return false;
 try{
  const caps=track.getCapabilities();
  if(caps?.torch){await track.applyConstraints({advanced:[{torch:!!enable}]});return true;}
 }catch{}
 return false;
}

async function applyTrackZoom(target){
 const track=media?.getVideoTracks?.()?.[0];
 hwZoomApplied=1;
 if(!track?.getCapabilities||!track?.applyConstraints)return false;
 try{
  const caps=track.getCapabilities();
  if(caps?.zoom&&typeof caps.zoom.min==='number'&&typeof caps.zoom.max==='number'){
   if(target>=caps.zoom.min&&target<=caps.zoom.max){
    await track.applyConstraints({advanced:[{zoom:target}]});
    hwZoomApplied=target;
    return true;
   }
   if(target>caps.zoom.max&&caps.zoom.max>1){
    await track.applyConstraints({advanced:[{zoom:caps.zoom.max}]});
    hwZoomApplied=caps.zoom.max;
    return true;
   }
  }
 }catch{}
 return false;
}

async function openCameraStream(preferUltraWide=false){
 const resHint={width:{ideal:1440},height:{ideal:1440}};
 if(state.facing==='environment'&&preferUltraWide){
  const uw=await findRearCameraDevice(true);
  if(uw){
   try{const s=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:uw.deviceId},...resHint},audio:false});usingUltraWideDevice=true;return s;}catch{}
  }
 }
 usingUltraWideDevice=false;
 if(state.facing==='environment'&&!preferUltraWide){
  const mainBack=await findRearCameraDevice(false);
  if(mainBack){
   try{return await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:mainBack.deviceId},...resHint},audio:false});}catch{}
  }
 }
 try{return await navigator.mediaDevices.getUserMedia({video:{facingMode:{exact:state.facing},...resHint},audio:false});}
 catch{
  try{return await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing},...resHint},audio:false});}
  catch{return navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing}},audio:false});}
 }
}

async function start(preferUltraWide=state.facing==='environment'&&state.zoom<1){
 stop();startingCamera=true;const version=mounted,generation=sequence;state.status='';update();
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error();
  const s=await openCameraStream(preferUltraWide);
  if(!root||version!==mounted||generation!==sequence){s.getTracks().forEach(t=>t.stop());startingCamera=false;return;}
  media=s;
  s.getVideoTracks?.().forEach(t=>{t.onended=()=>{if(root&&!state.busy){media=null;ensureCamera();}};});
  let v=$('video');
  if(needsFreshVideo&&v?.parentNode&&typeof v.replaceWith==='function'&&global.document?.createElement){
   const fresh=global.document.createElement('video');
   fresh.autoplay=true;fresh.muted=true;fresh.playsInline=true;fresh.controls=false;
   fresh.setAttribute('playsinline','');fresh.setAttribute('webkit-playsinline','');
   fresh.setAttribute('disablepictureinpicture','');fresh.setAttribute('disableremoteplayback','');
   fresh.setAttribute('aria-label','Xem trước camera');
   v.replaceWith(fresh);v=fresh;needsFreshVideo=false;
  }
  v.controls=false;v.muted=true;
  v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
  v.setAttribute('disablepictureinpicture','');v.setAttribute('disableremoteplayback','');
  if(v.addEventListener){v.addEventListener('loadedmetadata',syncVideoBox);v.addEventListener('resize',syncVideoBox);}
  v.srcObject=s;
  await v.play();
  if(!v.videoWidth&&v.addEventListener){
   await new Promise(resolve=>{const done=()=>{v.removeEventListener('loadedmetadata',done);v.removeEventListener('resize',done);resolve();};v.addEventListener('loadedmetadata',done);v.addEventListener('resize',done);setTimeout(done,600);});
  }
  syncVideoBox();
  if(!usingUltraWideDevice&&state.zoom!==1)await applyTrackZoom(state.zoom);
  if(state.flash&&state.facing==='environment')await syncHardwareTorch(true);
  startingCamera=false;state.status='';update();
 }catch{startingCamera=false;if(version===mounted){state.status='Chưa mở được camera. Cấp quyền camera hoặc chọn ảnh từ thư viện.';update();}}
}

async function setZoom(nextZoom,showHud=true){
 const minZ=state.facing==='environment'?0.5:1;
 const clamped=Math.max(minZ,Math.min(4,Math.round(Number(nextZoom)*10)/10||1));
 state.zoom=clamped;
 if(showHud)showZoomHud();
 if(!isCameraLive()){update();return;}
 if(state.facing==='environment'){
  if(clamped<1){
   const ok=await applyTrackZoom(clamped);
   if(!ok&&!usingUltraWideDevice){
    if(lensSwitching)return;
    const uw=await findRearCameraDevice(true);
    if(uw){lensSwitching=true;try{await start(true);}finally{lensSwitching=false;}if(showHud)showZoomHud();update();return;}
    state.zoom=1;
   }
  }else{
   if(usingUltraWideDevice){
    if(lensSwitching)return;
    lensSwitching=true;try{await start(false);}finally{lensSwitching=false;}if(showHud)showZoomHud();update();return;
   }
   await applyTrackZoom(clamped);
  }
 }else{
  await applyTrackZoom(clamped);
 }
 update();
}

async function withFlashCapture(takeFn){
 if(!state.flash)return takeFn();
 if(state.facing==='environment'){
  const lit=await syncHardwareTorch(true);
  if(lit)await new Promise(r=>setTimeout(r,220));
  try{return await takeFn();}finally{if(lit&&!state.flash)await syncHardwareTorch(false);}
 }
 const screenFlash=$('.retina-screen-flash');
 if(screenFlash)screenFlash.hidden=false;
 await new Promise(r=>setTimeout(r,340));
 try{return await takeFn();}finally{if(screenFlash)screenFlash.hidden=true;}
}

function snapshot(){
 const v=$('video');if(!v?.videoWidth)throw Error('Camera chưa sẵn sàng.');
 const c=canvas(1200,state.mode==='booth'?900:1200);
 const dz=effectiveDigitalZoom();
 cover(c.getContext('2d'),v,{x:0,y:0,width:c.width,height:c.height},state.facing==='user',dz>1?{zoom:dz,x:0,y:0}:{});
 return{image:c.toDataURL('image/jpeg',.92),time:Date.now()};
}
function flashShutter(){const el=$('.shutter-flash');if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');}
async function downloadOutput(){
 if(videoClip){
  pickingFileUntil=Date.now()+20000;
  const ext=videoClip.isMp4?'mp4':'webm',name=`cham-video-${Date.now()}.${ext}`;
  if(global.Capacitor?.isNativePlatform?.()&&global.navigator?.share&&videoClip.bytes){
   try{
    const file=new File([videoClip.bytes],name,{type:videoClip.isMp4?'video/mp4':'video/webm'});
    if(!global.navigator.canShare||global.navigator.canShare({files:[file]})){await global.navigator.share({files:[file]});return;}
   }catch(e){if(e?.name==='AbortError')return;}
  }
  const link=document.createElement('a');link.href=videoClip.blobUrl||videoClip.video;link.download=name;link.click();
  return;
 }
 const out=activeOutput();if(!out)return;
 pickingFileUntil=Date.now()+20000;
 const isJpg=out.startsWith('data:image/jpeg'),ext=isJpg?'jpg':'webp',name=`cham-${state.aiApplied?state.mode+'-ai':state.mode}-${Date.now()}.${ext}`;
 if(global.Capacitor?.isNativePlatform?.()&&global.navigator?.share){
  try{
   const b64=out.slice(out.indexOf(',')+1),bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   const file=new File([bytes],name,{type:isJpg?'image/jpeg':'image/webp'});
   if(!global.navigator.canShare||global.navigator.canShare({files:[file]})){await global.navigator.share({files:[file]});return;}
  }catch(e){if(e?.name==='AbortError')return;}
 }
 const link=document.createElement('a');link.href=out;link.download=name;link.click();
}
async function flipCamera(){
 if(state.busy||holdSession||lensSwitching)return;
 hideZoomHud();
 state.facing=state.facing==='user'?'environment':'user';
 state.zoom=1;
 await start(false);
}
async function captureDualCam(){
 const primaryFacing=state.facing,secondaryFacing=primaryFacing==='user'?'environment':'user';
 state.busy=true;const generation=++sequence,version=mounted;state.status='';update();
 try{
  if(state.timer){
   for(let n=state.timer;n>0;n--){if(generation!==sequence||version!==mounted||!root)return;state.countdown=n;update();await new Promise(r=>setTimeout(r,1000));}
   if(generation!==sequence||version!==mounted||!root)return;
   state.countdown=0;
  }
  const mainShot=await withFlashCapture(async()=>snapshot());
  flashShutter();
  state.status='Giữ máy · đang chụp cam còn lại…';update();
  state.facing=secondaryFacing;state.zoom=1;
  await start(false);
  if(generation!==sequence||version!==mounted||!root)return;
  await new Promise(r=>setTimeout(r,480));
  if(generation!==sequence||version!==mounted||!root)return;
  const pipShot=snapshot();
  flashShutter();
  state.facing=primaryFacing;
  stop();
  const merged=await composeDual(mainShot,pipShot,state);
  if(version!==mounted||!root)return;
  state.shots=[mainShot];state.output=merged;state.aiResult='';state.aiApplied='';state.busy=false;state.status='';
  update();saveDraft();
 }catch(e){
  state.facing=primaryFacing;state.busy=false;state.countdown=0;state.status=e.message||'Chưa chụp được Camera Kép.';update();ensureCamera();
 }
}
async function beginHoldVideo(){
 if(!root||state.mode!=='photo'||state.dualCam||state.busy||aiBusy||restoring||activeOutput()||videoClip||holdSession)return;
 if(typeof global.MediaRecorder!=='function'){state.status='Thiết bị chưa hỗ trợ quay video trực tiếp.';update();return;}
 if(!isCameraLive()){await start();if(!isCameraLive())return;}
 const v=$('video');if(!v?.videoWidth)return;
 const mime=['video/mp4','video/mp4;codecs=avc1.42E01E','video/webm;codecs=vp9','video/webm'].find(m=>global.MediaRecorder.isTypeSupported?.(m))||'';
 const recCanvas=canvas(720,720),ctx=recCanvas.getContext('2d');
 if(!recCanvas.captureStream){state.status='Trình duyệt chưa hỗ trợ ghi khung hình camera.';update();return;}
 const drawOnce=()=>{
  const lv=$('video');if(!lv?.videoWidth)return;
  const dz=effectiveDigitalZoom(),flt=videoFilterCss();
  ctx.save();if(flt&&flt!=='none')ctx.filter=flt;
  cover(ctx,lv,{x:0,y:0,width:720,height:720},state.facing==='user',dz>1?{zoom:dz,x:0,y:0}:{});
  ctx.restore();
 };
 drawOnce();
 const poster=webp(recCanvas);
 let cancelled=false,finished=false,pump=null,micStream=null;
 const cStream=recCanvas.captureStream(24),chunks=[],t0=Date.now();
 holdElapsed=0;
 const session={
  stop:()=>finalize(),
  cancel:()=>{cancelled=true;finalize();}
 };
 holdSession=session;
 if(state.flash&&state.facing==='environment')syncHardwareTorch(true);
 update();
 if(global.navigator?.mediaDevices?.getUserMedia){
  try{
   const ms=await global.navigator.mediaDevices.getUserMedia({audio:true,video:false});
   if(cancelled||finished||holdSession!==session){ms.getTracks().forEach(t=>t.stop());}
   else{micStream=ms;ms.getAudioTracks().forEach(t=>cStream.addTrack(t));}
  }catch{}
 }
 if(cancelled||finished||holdSession!==session){cStream.getTracks().forEach(t=>t.stop());return;}
 let rec;
 try{rec=new global.MediaRecorder(cStream,mime?{mimeType:mime,videoBitsPerSecond:2200000}:undefined);}
 catch{rec=new global.MediaRecorder(cStream);}
 rec.ondataavailable=e=>{if(e.data?.size>0)chunks.push(e.data);};
 const recDone=new Promise(r=>{rec.onstop=r;rec.onerror=r;});
 rec.start(200);
 pump=setInterval(()=>{
  if(cancelled||finished||!root){clearInterval(pump);return;}
  drawOnce();
  holdElapsed=Math.min(10,(Date.now()-t0)/1000);
  update();
  if(holdElapsed>=10)finalize();
 },42);
 async function finalize(){
  if(finished)return;
  finished=true;
  clearInterval(pump);
  holdSession=null;
  const dur=Math.max(0.5,Math.min(10,(Date.now()-t0)/1000));
  holdElapsed=0;
  if(state.facing==='environment')syncHardwareTorch(false);
  try{if(rec&&rec.state!=='inactive')rec.stop();}catch{}
  await recDone;
  micStream?.getTracks?.().forEach(t=>{try{t.stop();}catch{}});
  cStream.getTracks?.().forEach(t=>{try{t.stop();}catch{}});
  if(cancelled||!root||!chunks.length){update();return;}
  const actualMime=(rec?.mimeType||mime||'video/mp4').split(';')[0];
  const isMp4=actualMime.includes('mp4');
  const blobObj=new Blob(chunks,{type:isMp4?'video/mp4':'video/webm'});
  const bytes=new Uint8Array(await blobObj.arrayBuffer());
  const dataUrl=`data:${isMp4?'video/mp4':'video/webm'};base64,${bytesToB64(bytes)}`;
  const blobUrl=typeof URL!=='undefined'&&URL.createObjectURL?URL.createObjectURL(blobObj):dataUrl;
  clearVideoClip();
  videoClip={video:dataUrl,blob:blobObj,bytes,blobUrl,image:poster,duration:dur,isMp4};
  state.status='';
  update();
 }
}
function bindShutterHold(btn){
 if(!btn?.addEventListener)return;
 let pointerActive=false;
 const release=()=>{
  if(!pointerActive&&!holdTimer&&!holdSession)return;
  pointerActive=false;
  if(holdTimer){clearTimeout(holdTimer);holdTimer=null;}
  if(holdSession){holdSession.stop();}
 };
 btn.addEventListener('pointerdown',e=>{
  if(e.button!==undefined&&e.button!==0)return;
  if(state.mode!=='photo'||state.dualCam||state.busy||aiBusy||restoring||activeOutput()||videoClip||holdSession)return;
  pointerActive=true;
  clearTimeout(holdTimer);
  holdTimer=setTimeout(()=>{
   holdTimer=null;
   if(!pointerActive)return;
   suppressNextClick=true;
   beginHoldVideo();
  },260);
 });
 btn.addEventListener('pointerup',release);
 btn.addEventListener('pointercancel',release);
 btn.addEventListener('lostpointercapture',release);
 btn.addEventListener('contextmenu',e=>e.preventDefault?.());
}
async function capture(){
 timerOpen=false;
 if(suppressNextClick){suppressNextClick=false;return;}
 if(holdSession){holdSession.stop();return;}
 if(aiBusy)return;
 if(state.busy){sequence++;state.busy=false;state.countdown=0;try{activeRecorder?.cancel();}catch{}activeRecorder=null;const rf=$('.retina-screen-flash');if(rf)rf.hidden=true;state.status='';update();ensureCamera();return;}
 if(!isCameraLive()){await start();if(!isCameraLive())return;}
 if(state.retakeIndex!==null){
  const idx=state.retakeIndex;state.busy=true;const generation=++sequence,version=mounted;update();
  const rec=startClipRecorder(media,idx);
  try{
   for(let n=3;n>0;n--){if(generation!==sequence||version!==mounted||!root){rec?.cancel();return;}state.countdown=n;state.status=`Chụp lại tấm ${idx+1}`;update();await new Promise(r=>setTimeout(r,1000));}
   if(generation!==sequence||version!==mounted||!root){rec?.cancel();return;}
   state.countdown=0;state.shots[idx]=await withFlashCapture(async()=>snapshot());const clip=await rec?.stop();activeRecorder=null;if(clip)liveClips[idx]=clip;flashShutter();state.retakeIndex=null;state.busy=false;await rebuild();
  }catch(e){rec?.cancel();state.busy=false;state.status=e.message;update();}finally{if(version===mounted){state.busy=false;state.countdown=0;update();}}
  return;
 }
 if(state.mode!=='booth'){
  if(state.dualCam){await captureDualCam();return;}
  if(!state.timer){try{state.shots=[await withFlashCapture(async()=>snapshot())];flashShutter();await rebuild();}catch(e){state.status=e.message;update();}return;}
  state.busy=true;const generation=++sequence,version=mounted;update();
  try{
   for(let n=state.timer;n>0;n--){if(generation!==sequence||version!==mounted||!root)return;state.countdown=n;state.status='';update();await new Promise(r=>setTimeout(r,1000));}
   if(generation!==sequence||version!==mounted||!root)return;
   state.countdown=0;state.shots=[await withFlashCapture(async()=>snapshot())];flashShutter();state.busy=false;await rebuild();
  }catch(e){state.busy=false;state.status=e.message;update();}finally{if(version===mounted){state.busy=false;state.countdown=0;update();}}
  return;
 }
 state.busy=true;const generation=++sequence,version=mounted;if(!state.shots.length)liveClips=[];update();
 try{
  while(state.shots.length<need()){
   const idx=state.shots.length,rec=startClipRecorder(media,idx);
   for(let n=3;n>0;n--){if(generation!==sequence||version!==mounted||!root){rec?.cancel();return;}state.countdown=n;state.status=`Tấm ${idx+1}/${need()}`;update();await new Promise(r=>setTimeout(r,1000));}
   if(generation!==sequence||version!==mounted||!root){rec?.cancel();return;}
   state.countdown=0;state.shots.push(await withFlashCapture(async()=>snapshot()));const clip=await rec?.stop();activeRecorder=null;if(clip)liveClips[idx]=clip;flashShutter();update();
  }
  state.busy=false;await rebuild();
 }catch(e){state.busy=false;state.status=e.message;update();}finally{if(version===mounted){state.busy=false;state.countdown=0;update();}}
}
async function files(list){pickingFileUntil=0;if(state.busy||aiBusy||restoring)return;const version=mounted,token=++renderId;const selected=[...list].slice(0,state.mode==='booth'?Math.max(0,need()-state.shots.length):1);if(!selected.length){state.status='Photobooth đã đủ ảnh. Bấm ✕ để chụp bộ mới.';update();return;}state.status='';update();const results=[];try{for(const file of selected){if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Chọn tệp ảnh nhỏ hơn 20 MB.');const url=URL.createObjectURL(file);try{const im=await imageFrom(url),scale=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),c=canvas(Math.round(im.naturalWidth*scale),Math.round(im.naturalHeight*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);results.push({image:c.toDataURL('image/jpeg',.92),time:Date.now()});}finally{URL.revokeObjectURL(url);}}if(version!==mounted||token!==renderId||!root)return;clearVideoClip();liveClips=[];state.shots=state.mode==='booth'?[...state.shots,...results].slice(0,need()):results;await rebuild();}catch(e){if(version===mounted){state.status=e.message;update();}}}
async function ai(){const source=activeOutput();if(aiBusy||!source)return;const prompt=$('#ai-prompt').value.trim(),feedback=$('.ai-feedback');if(!aiState.available){feedback.textContent=aiState.reason;return;}if(!prompt){feedback.textContent='Viết một mô tả để AI biết bạn muốn chỉnh gì nhé.';return;}const version=mounted;aiBusy=true;feedback.textContent='AI đang chỉnh ảnh. Quá trình này có thể mất vài chục giây…';$('[data-studio="ai-run"]').disabled=true;update();try{const result=await callbacks.onAI(source,prompt);if(!root||version!==mounted)return;const image=await global.ChamEdits.aiImage(result.image);if(!root||version!==mounted)return;state.aiResult=image;saveDraft();feedback.textContent='Ảnh AI đã sẵn sàng. Chọn dùng ảnh AI hoặc giữ ảnh gốc.';update();}catch(e){if(root&&version===mounted)feedback.textContent=e.message;}finally{if(version===mounted){aiBusy=false;if(root){$('[data-studio="ai-run"]').disabled=false;update();}}}}

function clearAfterPost(){
 clearTimeout(draftTimer);cancelHoldRecording();clearVideoClip();liveClips=[];state.retakeIndex=null;renderId++;
 state.shots=[];state.output='';state.aiResult='';state.aiApplied='';state.status='';
 if(draftScope)global.ChamDrafts?.remove('studio:'+draftScope).catch(()=>{});
 if(root){update();ensureCamera();}
}

async function action(e){
 const b=e.target.closest('[data-studio]');
 if(!b){if(timerOpen){timerOpen=false;update();}return;}
 if(!root)return;
 const a=b.dataset.studio;
 if(a!=='toggle-timer'&&a!=='timer'&&timerOpen)timerOpen=false;
 if(aiBusy&&!['ai-original','toggle-features','close-features','feature-tab'].includes(a))return;
 if(state.busy&&a!=='capture')return;
 switch(a){
  case'edit-shot':global.ChamPhotoEditor.select(Number(b.dataset.index));update();break;
  case'cancel-retake':state.retakeIndex=null;await rebuild();break;
  case'clear-draft':clearAfterPost();global.ChamDrafts?.remove('post:'+draftScope).catch(()=>{});break;
  case'mode':clearVideoClip();state.retakeIndex=null;state.mode=b.dataset.value==='booth'?'booth':'photo';state.aiResult='';state.aiApplied='';await rebuild();break;
  case'toggle-dual':state.dualCam=!state.dualCam;update();break;
  case'toggle-grid':state.grid=!state.grid;update();break;
  case'toggle-flash':state.flash=!state.flash;if(state.facing==='environment')await syncHardwareTorch(state.flash);update();break;
  case'zoom':await setZoom(Number(b.dataset.value));break;
  case'toggle-timer':timerOpen=!timerOpen;update();break;
  case'timer':state.timer=[0,3,5,10].includes(Number(b.dataset.value))?Number(b.dataset.value):0;timerOpen=false;update();break;
  case'toggle-features':featuresOpen=!featuresOpen;if(featuresOpen&&state.mode==='booth'&&featureTab==='digital')featureTab='tone';update();break;
  case'close-features':featuresOpen=false;update();break;
  case'feature-tab':if(['digital','tone','ai'].includes(b.dataset.value)){featureTab=b.dataset.value;featuresOpen=true;update();}break;
  case'reset-digital':state.look='natural';state.grain=0;state.stamp=false;await rebuild();break;
  case'reset-tone':state.tone={brightness:0,contrast:0,warmth:0};await rebuild();break;
  case'look':{
   const next=b.dataset.value;
   if(next==='natural'){state.look='natural';state.grain=0;state.stamp=false;}
   else{if(state.look==='natural'&&state.grain===0&&!state.stamp){state.grain=10;state.stamp=true;}state.look=next;}
   await rebuild();break;
  }
  case'count':state.count=Number(b.dataset.value);if(state.count===3&&state.layout==='grid')state.layout='strip';await rebuild();break;
  case'layout':state.layout=b.dataset.value;if(state.layout==='grid'&&state.count===3)state.count=4;await rebuild();break;
  case'frame-style':state.frameStyle=b.dataset.value;await rebuild();break;
  case'frame':state.frame=b.dataset.value;state.frameStyle='classic';await rebuild();break;
  case'files':pickingFileUntil=Date.now()+25000;$('.studio-file-input').click();break;
  case'capture':await capture();break;
  case'flip':await flipCamera();break;
  case'reset':clearAfterPost();break;
  case'open-live-booth':if(hasLiveSet()&&callbacks.onLiveBooth){stop();callbacks.onLiveBooth({clips:liveClips.slice(0,need()),count:need(),layout:state.layout,frameStyle:state.frameStyle,frame:state.frame,custom:{...state.custom}});}break;
  case'use':if(videoClip){callbacks.onUseVideo?.(videoClip);}else if(activeOutput())callbacks.onUse(activeOutput());break;
  case'download':await downloadOutput();break;
  case'ai-open':featuresOpen=true;featureTab='ai';if(!aiState.available)$('.ai-feedback').textContent=aiState.reason;update();break;
  case'ai-run':await ai();break;
  case'ai-original':state.aiResult='';saveDraft();$('.ai-feedback').textContent=state.aiApplied?'Đã giữ bản đang chọn.':'Đã giữ ảnh gốc.';update();break;
  case'ai-use':state.aiApplied=state.aiResult;state.aiResult='';state.status='';$('.ai-feedback').textContent='Đã chọn ảnh AI.';update();saveDraft();break;
  case'ai-revert':state.aiApplied='';state.aiResult='';state.status='';$('.ai-feedback').textContent='Đã quay lại ảnh gốc trước AI.';update();saveDraft();break;
 }
}

let draftScope=null,draftTimer=null,restoring=false,scopeEpoch=0,loadedDraft=false;
const initialState=JSON.parse(JSON.stringify(state));
function draftSnapshot(){return{version:1,mode:state.mode,look:state.look,grain:state.grain,stamp:state.stamp,tone:{...global.ChamEdits.tone(state.tone)},liveBooth:state.liveBooth,count:state.count,layout:state.layout,frame:state.frame,frameStyle:state.frameStyle,custom:{...state.custom},aiPrompt:state.aiPrompt,aiResult:state.aiResult,aiApplied:state.aiApplied,shots:state.shots.map(s=>({image:s.image,time:s.time,crop:{...global.ChamEdits.crop(s.crop)}}))};}
function saveDraft(){if(!root||restoring||!loadedDraft||!global.ChamDrafts)return;clearTimeout(draftTimer);const key=draftScope,data=draftSnapshot(),epoch=scopeEpoch;draftTimer=setTimeout(()=>{global.ChamDrafts.put('studio:'+key,data).catch(()=>{});},350);}
async function setScope(scope='device'){
 if(!root||scope===draftScope&&(loadedDraft||restoring))return;
 if(loadedDraft&&!restoring&&draftScope)global.ChamDrafts?.put('studio:'+draftScope,draftSnapshot()).catch(()=>{});
 clearTimeout(draftTimer);scopeEpoch++;const epoch=scopeEpoch;liveClips=[];mounted++;renderId++;aiBusy=false;timerOpen=false;draftScope=scope;loadedDraft=false;restoring=true;Object.assign(state,JSON.parse(JSON.stringify(initialState)));update();
 try{
  const saved=await global.ChamDrafts.get('studio:'+scope);if(!root||epoch!==scopeEpoch)return;
  if(saved?.version===1){
   for(const key of['mode','look','layout','frameStyle'])if(typeof saved[key]==='string')state[key]=saved[key];
   state.mode=state.mode==='booth'?'booth':'photo';
   if(!looks[state.look])state.look='natural';state.frameStyle=frames.preset(state.frameStyle).id;state.layout=state.layout==='grid'?'grid':'strip';state.count=[2,3,4].includes(saved.count)?(state.layout==='grid'&&saved.count===3?4:saved.count):(state.layout==='grid'?4:3);state.grain=global.ChamEdits.clamp(saved.grain,0,32);state.stamp=!!saved.stamp;state.tone=global.ChamEdits.tone(saved.tone);state.timer=0;state.liveBooth=saved.liveBooth!==false;state.frame=/^#[a-f0-9]{6}$/i.test(saved.frame||'')?saved.frame:'#ffffff';state.custom=global.ChamEdits.custom(saved.custom);state.aiPrompt=String(saved.aiPrompt||'').slice(0,2000);
   state.shots=(Array.isArray(saved.shots)?saved.shots:[]).slice(0,4).filter(s=>typeof s.image==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(s.image)).map(s=>({image:s.image,time:Number(s.time)||Date.now(),crop:global.ChamEdits.crop(s.crop)}));
   const ai=typeof saved.aiResult==='string'&&saved.aiResult.startsWith('data:image/')?saved.aiResult:'';
   const applied=typeof saved.aiApplied==='string'&&saved.aiApplied.startsWith('data:image/')?saved.aiApplied:'';
   await rebuild();if(!root||epoch!==scopeEpoch)return;state.aiResult=ai;state.aiApplied=applied;if(ai){featuresOpen=true;featureTab='ai';}$('#ai-prompt').value=state.aiPrompt;
  }
 }catch{}
 finally{if(root&&epoch===scopeEpoch){loadedDraft=true;restoring=false;update();global.ChamStudioTools.refresh(true);ensureCamera();}}
}
async function replaceShot(index,file){
 pickingFileUntil=0;
 if(state.busy||aiBusy||restoring||!state.shots[index])return;const version=mounted,id=++renderId;
 try{if(!file.type.startsWith('image/')||file.size>20*1024*1024)throw Error('Chọn ảnh nhỏ hơn 20 MB.');const url=URL.createObjectURL(file);let shot;try{const im=await imageFrom(url),scale=Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight)),c=canvas(Math.round(im.naturalWidth*scale),Math.round(im.naturalHeight*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);shot={image:c.toDataURL('image/jpeg',.92),time:Date.now(),crop:{zoom:1,x:0,y:0}};}finally{URL.revokeObjectURL(url);}if(!root||version!==mounted||id!==renderId)return;liveClips[index]=null;state.shots[index]=shot;await rebuild();}
 catch(e){if(root&&version===mounted){state.status=e.message;update();}}
}
async function retakeShot(index){if(!state.shots[index]||state.busy||aiBusy||restoring)return;state.retakeIndex=index;state.status='Chụp lại tấm '+(index+1);update();if(!isCameraLive())await start();}
async function loadMemoryShots(images){
 if(!root||!Array.isArray(images)||images.length<2)return;
 liveClips=[];state.retakeIndex=null;state.mode='booth';state.count=Math.min(4,images.length);if(state.count===3&&state.layout==='grid')state.layout='strip';
 state.shots=images.slice(0,4).map((image,i)=>({image,time:Date.now()+i,crop:{zoom:1,x:0,y:0}}));
 state.aiResult='';state.aiApplied='';await rebuild();
}

function bindPinchZoom(vf){
 if(!vf?.addEventListener)return;
 const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
 let hadMultiTouch=false;
 vf.addEventListener('touchstart',e=>{
  if(e.touches?.length>=2){
   hadMultiTouch=true;
   if(e.touches.length===2&&isCameraLive()){
    pinchStartDist=dist(e.touches);pinchStartZoom=state.zoom;
    clearTimeout(zoomHudTimer);zoomHudVisible=true;update();
   }
  }else if(e.touches?.length===1){
   hadMultiTouch=false;
  }
 },{passive:true});
 vf.addEventListener('touchmove',e=>{
  if(e.touches?.length===2&&pinchStartDist>10&&isCameraLive()&&!state.busy&&!lensSwitching){
   e.preventDefault?.();
   const ratio=dist(e.touches)/pinchStartDist;
   const minZ=state.facing==='environment'?0.5:1;
   const raw=pinchStartZoom*ratio;
   const next=state.facing==='environment'&&raw<0.82?0.5:Math.max(state.facing==='environment'&&usingUltraWideDevice&&raw<0.95?0.5:1,Math.min(4,Math.round(Math.max(minZ,raw)*10)/10));
   clearTimeout(zoomHudTimer);zoomHudVisible=true;
   if(Math.abs(next-state.zoom)>=0.1)setZoom(next,true);
   else update();
  }
 },{passive:false});
 vf.addEventListener('touchend',e=>{
  if(!e.touches||e.touches.length<2){
   pinchStartDist=0;
   if(zoomHudVisible)showZoomHud();
  }
  if(!hadMultiTouch&&(!e.touches||e.touches.length===0)&&e.changedTouches?.length===1&&!e.target?.closest?.('button')){
   const pt=e.changedTouches[0],now=Date.now();
   if(now-lastTapAt<300&&Math.hypot(pt.clientX-lastTapX,pt.clientY-lastTapY)<44){
    lastTapAt=0;
    if(isCameraLive()&&!state.busy&&!holdSession&&!activeOutput()&&!videoClip)flipCamera();
   }else{
    lastTapAt=now;lastTapX=pt.clientX;lastTapY=pt.clientY;
   }
  }
 },{passive:true});
 vf.addEventListener('dblclick',e=>{
  if(e.target?.closest?.('button'))return;
  if(isCameraLive()&&!state.busy&&!holdSession&&!activeOutput()&&!videoClip)flipCamera();
 });
 vf.addEventListener('wheel',e=>{
  if(!isCameraLive()||state.busy||lensSwitching)return;
  e.preventDefault?.();
  const minZ=state.facing==='environment'?0.5:1;
  const step=e.deltaY<0?0.2:-0.2;
  const next=state.facing==='environment'&&state.zoom<=1&&step<0?0.5:state.facing==='environment'&&state.zoom<1&&step>0?1:Math.max(minZ,Math.min(4,Math.round((state.zoom+step)*10)/10));
  setZoom(next,true);
 },{passive:false});
}

function onVisibility(){
 if(!root)return;
 clearTimeout(resumeTimer);
 const vis=global.document?.visibilityState;
 if(vis==='hidden'){
  hideZoomHud();
  needsFreshVideo=true;
  stop();
  if(Date.now()>pickingFileUntil){
   global.ChamDrafts?.clearAll?.().catch?.(()=>{});
   clearVideoClip();liveClips=[];state.retakeIndex=null;renderId++;state.shots=[];state.output='';state.aiResult='';state.aiApplied='';state.status='';featuresOpen=false;timerOpen=false;update();
  }
 }else if(vis==='visible'){
  resumeTimer=setTimeout(()=>{if(root&&global.document?.visibilityState==='visible')ensureCamera();},120);
 }
}
function mount(element,options){unmount();root=element;callbacks=options;lastAIUser=null;timerOpen=false;featuresOpen=false;featureTab='digital';hideZoomHud();state.timer=0;state.flash=false;state.dualCam=false;state.zoom=1;root.innerHTML=markup();bindPinchZoom($('.viewfinder'));bindShutterHold($('[data-studio="capture"]'));global.ChamPhotoEditor.mount($('.photo-edit-tools'),{shots:()=>state.shots,enabled:()=>state.mode==='booth'&&state.retakeIndex===null,changed:()=>rebuild(),replace:replaceShot,retake:retakeShot});global.ChamStudioTools.mount(root,{state:()=>state,scope:()=>draftScope||'device',busy:()=>state.busy||aiBusy||restoring,changed:()=>rebuild(),draft:saveDraft});$('#ai-prompt').value=state.aiPrompt;$('#ai-prompt').addEventListener('input',e=>{state.aiPrompt=e.target.value;saveDraft();});setScope(options.draftScope||'device');root.addEventListener('click',action);global.document?.addEventListener?.('visibilitychange',onVisibility);root.querySelector('.studio-file-input').addEventListener('change',e=>{files(e.target.files);e.target.value='';});root.querySelector('#grain').addEventListener('input',async e=>{state.grain=Number(e.target.value);await rebuild();});root.querySelector('#date-stamp').addEventListener('change',async e=>{state.stamp=e.target.checked;await rebuild();});root.querySelector('#live-booth').addEventListener('change',e=>{state.liveBooth=e.target.checked;saveDraft();});root.querySelectorAll('[data-tone]').forEach(inp=>inp.addEventListener('input',e=>{state.tone=global.ChamEdits.tone({...state.tone,[e.target.dataset.tone]:Number(e.target.value)});update();clearTimeout(toneTimer);toneTimer=setTimeout(()=>rebuild(),120);}));update();}
function unmount(){if(root&&loadedDraft&&!restoring)global.ChamDrafts?.put('studio:'+draftScope,draftSnapshot()).catch(()=>{});clearTimeout(draftTimer);clearTimeout(toneTimer);clearTimeout(resumeTimer);cancelHoldRecording();clearVideoClip();hideZoomHud();scopeEpoch++;restoring=false;timerOpen=false;featuresOpen=false;global.ChamPhotoEditor?.unmount();global.ChamStudioTools?.unmount();stop();aiBusy=false;mounted++;renderId++;global.document?.removeEventListener?.('visibilitychange',onVisibility);if(root){const key=$('#ai-key');if(key)key.value='';root.removeEventListener('click',action);}root=null;callbacks={};}
async function refreshAI(user=''){if(!root||user===lastAIUser)return;lastAIUser=user;const version=mounted;try{const result=await callbacks.onAIStatus();if(root&&version===mounted&&lastAIUser===user){aiState=result;update();}}catch(e){if(root&&version===mounted&&lastAIUser===user){aiState={available:false,reason:e.message};update();}}}
global.ChamStudio={mount,unmount,refreshAI,setScope,loadMemoryShots,ensureCamera,clearAfterPost,setMode:mode=>{if(['photo','digital','booth'].includes(mode)){state.mode=mode==='booth'?'booth':'photo';if(mode==='digital'&&state.look==='natural'){state.look='ccd';state.grain=10;state.stamp=true;}if(root)rebuild();}},testing:{geometry,dateStamp,pixels,cover,looks,composeDual}};
})(typeof window!=='undefined'?window:globalThis);
