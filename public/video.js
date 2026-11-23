(function(global){
 'use strict';
 let root=null,callbacks={},revision=0,mountId=0,controller=null,urls=[],records=[],prepared=null,busy=false,sending=false,posted=false,dirty=false,available=false,kind='single',scope='device',saveTimer=null,restoring=false,sourceVideo=null;
 let edit={start:0,end:0,cover:0,mute:false},booth={duration:3,audio:-1,layout:'grid',frameStyle:'love',frame:'#ffffff',live:false,custom:{title:'',message:'',date:'',paper:'',ink:''}};
 let postMeta={overlayStyle:'standard',recipients:[]};
 let byKind={single:null,booth:null};
 const $=s=>root?.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validColor=v=>/^#[a-f0-9]{6}$/i.test(v||'')?v:'#ffffff';
 function resetKindSettings(target=kind){if(target==='single')edit={start:0,end:0,cover:0,mute:false};else booth={duration:3,audio:-1,layout:'grid',frameStyle:'love',frame:'#ffffff',live:false,custom:{title:'',message:'',date:'',paper:'',ink:''}};postMeta={overlayStyle:'standard',recipients:[]};}
 function resetSettings(){kind='single';resetKindSettings('single');resetKindSettings('booth');byKind={single:null,booth:null};}
 function validateFile(file,allowWebm=false){
  if(!file||!Number.isFinite(file.size)||file.size<=0)throw Error('Chọn video MP4.');
  if(file.size>40*1024*1024)throw Error('Video cần nhỏ hơn 40 MB.');
  if(allowWebm&&(/\.webm$/i.test(file.name)||file.type?.startsWith('video/webm')))return;
  if(!/\.mp4$/i.test(file.name)||file.type&&!file.type.startsWith('video/mp4'))throw Error('Chọn MP4. Bạn có thể xuất lại video sang MP4 rồi chọn.');
 }
 function validClipHead(head,allowWebm=false){
  if(head.length>=16&&String.fromCharCode(...head.slice(4,8))==='ftyp')return true;
  if(allowWebm&&head.length>=4&&head[0]===0x1a&&head[1]===0x45&&head[2]===0xdf&&head[3]===0xa3)return true;
  return false;
 }
 function blob(data,type){return new Blob([Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0))],{type});}
 function url(file){const value=URL.createObjectURL(file);urls.push(value);return value;}
 function release(){for(const value of urls)URL.revokeObjectURL(value);urls=[];}
 function status(text){if(root)$('.video-status').textContent=text;}
 function draftStatus(text){if(root)$('.video-restore-status').textContent=text;}
 function currentAudience(){return $('input[name="video-audience"]:checked')?.value||'self';}
 function modeEntry(){const cap=$('#video-caption')?.value||'';return records.length||cap.trim()?{records:records.map(r=>({file:r.file,name:r.file.name,duration:r.duration})),edit:{...edit},booth:{...booth,frame:validColor(booth.frame),custom:{...booth.custom}},prepared,posted,dirty,caption:cap,audience:currentAudience(),overlayStyle:postMeta.overlayStyle,recipients:[...postMeta.recipients]}:null;}
 function snapshot(){const current=modeEntry();byKind[kind]=current;return{version:2,kind,records:(current?.records||[]),edit:{...edit},booth:{...booth,frame:validColor(booth.frame),custom:{...booth.custom}},prepared,posted,dirty,caption:$('#video-caption')?.value||'',audience:currentAudience(),overlayStyle:postMeta.overlayStyle,recipients:[...postMeta.recipients],modes:{single:byKind.single,booth:byKind.booth}};}
 function save(){if(!root||restoring)return;clearTimeout(saveTimer);const data=snapshot(),key=scope;saveTimer=setTimeout(()=>global.ChamDrafts.put('video:'+key,data).then(()=>{if(root&&scope===key)draftStatus('Đã lưu nháp video trên thiết bị');}).catch(e=>{if(root&&scope===key)draftStatus(e.message);}),400);}
 function renderPostExtras(){
  if(!root)return;
  const styles=global.ChamEdits.captionStyles||[];
  root.querySelectorAll('[data-video-overlay]').forEach(b=>{const on=b.dataset.videoOverlay===postMeta.overlayStyle;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  const prev=$('.video-caption-preview');
  if(prev&&global.ChamEdits.formatCaptionPreview){const p=global.ChamEdits.formatCaptionPreview($('#video-caption')?.value||'',postMeta.overlayStyle);prev.textContent=p.text;prev.style.background=p.bg;prev.style.color=p.fg;}
  const picker=$('.video-recipient-picker');
  if(picker){
   const aud=currentAudience(),friends=callbacks.friends?.()||[];
   picker.hidden=aud!=='selected';
   if(aud==='selected')picker.innerHTML=friends.length?`<div class="recipient-head"><span>Đã chọn ${postMeta.recipients.length}/${friends.length} bạn</span><button type="button" class="text-button" data-video="toggle-all-friends">${postMeta.recipients.length===friends.length?'Bỏ chọn hết':'Chọn tất cả'}</button></div><div class="recipient-list">${friends.map(f=>{const on=postMeta.recipients.includes(f.id);return `<button type="button" class="recipient-chip ${on?'active':''}" data-video-recipient="${esc(f.id)}" aria-pressed="${on}">${esc(f.name)}</button>`;}).join('')}</div>`:'<p class="editor-help">Đăng nhập Locket và có bạn bè trong danh sách để gửi riêng.</p>';
  }
 }
 function update(){if(!root)return;
  $('.video-pick').disabled=busy||sending||!available;$('.video-pick').textContent=kind==='booth'?'Chọn 2–4 clip MP4/WebM':'Chọn video MP4';$('.video-input').multiple=kind==='booth';$('.video-input').accept=kind==='booth'?'video/mp4,video/webm,.mp4,.webm':'video/mp4,.mp4';
  $('.video-upload').disabled=!prepared||dirty||sending||posted;$('.video-download').disabled=!prepared||dirty||sending;$('.video-reset').disabled=sending;$('.video-actions').hidden=!prepared;$('.video-post-fields').hidden=!records.length;$('.video-edit-panel').hidden=!records.length;$('.single-video-editor').hidden=kind!=='single';$('.motion-video-editor').hidden=kind!=='booth';
  root.querySelectorAll('[data-video-back],.video-post-fields input,.video-post-fields textarea,[data-video-kind],[data-motion-color],[data-video-overlay],[data-video-recipient],.video-edit-panel input,.video-edit-panel select').forEach(b=>b.disabled=sending||busy);
  root.querySelectorAll('[data-video-kind]').forEach(b=>{b.classList.toggle('active',b.dataset.videoKind===kind);b.setAttribute('aria-pressed',String(b.dataset.videoKind===kind));});
  $('[data-video="cover-current"]').disabled=busy||sending;$('.video-apply').disabled=busy||sending||!records.length;$('.video-apply').textContent=busy?'Đang xử lý…':kind==='booth'?'Tạo photobooth động':'Áp dụng chỉnh sửa';$('.video-upload').textContent=sending?'Đang đăng video…':posted?'Đã đăng lên Locket':'Đăng video lên Locket';
  $('.video-info').textContent=prepared?`${prepared.duration.toFixed(1)} giây · ${(prepared.bytes/1024/1024).toFixed(1)} MB · ${prepared.hasAudio?'Có âm thanh':'Không có âm thanh'}`:'';
  $('.video-source-info').textContent=records.length?(kind==='single'?`Video gốc ${records[0].duration.toFixed(1)} giây. Chọn đoạn tối đa 15 giây.`:`${records.length} clip${booth.live?' (Live từ Camera)':''} · Mỗi clip phát trong thời lượng ghép.`):'';
  renderPostExtras();
 }
 function controls(){if(!root)return;
  $('.trim-start').value=edit.start;$('.trim-end').value=edit.end;$('.cover-time').min=edit.start;$('.cover-time').max=Math.max(edit.start,edit.end);$('.cover-time').value=edit.cover;$('.cover-time-label').textContent=edit.cover.toFixed(1)+' giây';$('.video-mute').checked=edit.mute;
  $('.booth-duration').value=booth.duration;$('.booth-layout').value=booth.layout;$('.booth-frame').value=booth.frameStyle;
  $('.motion-frame-colors').hidden=booth.frameStyle!=='classic';
  root.querySelectorAll('[data-motion-color]').forEach(b=>{const active=validColor(booth.frame).toLowerCase()===(b.dataset.motionColor||'').toLowerCase();b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  for(const key of['title','message','date'])$('[data-motion-label="'+key+'"]').value=booth.custom[key]||'';
  const preset=global.ChamFrames.preset(booth.frameStyle),defPaper=booth.frameStyle==='classic'?validColor(booth.frame):preset.paper,defInk=booth.frameStyle==='classic'?(defPaper.toLowerCase()==='#161616'?'#ffffff':'#303030'):preset.ink;
  const pCol=$('[data-motion-color-pick="paper"]'),iCol=$('[data-motion-color-pick="ink"]'),rCol=$('[data-video="reset-motion-colors"]');
  if(pCol)pCol.value=booth.custom.paper||defPaper;if(iCol)iCol.value=booth.custom.ink||defInk;if(rCol)rCol.hidden=!(booth.custom.paper||booth.custom.ink);
  $('.booth-audio').innerHTML='<option value="-1">Tắt âm toàn bộ</option>'+records.map((_,i)=>'<option value="'+i+'">Âm thanh clip '+(i+1)+'</option>').join('');$('.booth-audio').value=booth.audio;
  $('.clip-list').innerHTML=kind==='booth'?records.map((r,i)=>`<div class="clip-row"><span>${i+1}. ${esc(r.file.name)} · ${r.duration.toFixed(1)}s</span><button data-video-shift="${i}" data-step="-1" ${i===0?'disabled':''} aria-label="Đưa clip ${i+1} lên">↑</button><button data-video-shift="${i}" data-step="1" ${i===records.length-1?'disabled':''} aria-label="Đưa clip ${i+1} xuống">↓</button></div>`).join(''):'';
  const templates=global.ChamDrafts.readPreference('frames:'+scope,[]);$('.motion-template').innerHTML='<option value="">Dùng mẫu khung đã lưu</option>'+(Array.isArray(templates)?templates:[]).map((t,i)=>'<option value="'+i+'">'+esc(t.name)+'</option>').join('');
 }
 function detachPlayer(){sourceVideo?.pause();sourceVideo=null;const v=$('video');if(v){v.pause();v.removeAttribute('src');v.removeAttribute('poster');v.load();v.hidden=true;}$('.video-empty').hidden=false;$('.video-cover-preview')?.removeAttribute('src');release();}
 function hydrateEntry(entry){
  detachPlayer();resetKindSettings(kind);records=[];prepared=null;dirty=false;posted=false;
  if(!entry){$('#video-caption').value='';const selfR=$('input[name="video-audience"][value="self"]');if(selfR)selfR.checked=true;status(available?'Chọn video để bắt đầu.':'Đang kiểm tra xử lý video…');return;}
  if(kind==='single'&&entry.edit)edit={...edit,...entry.edit};
  if(kind==='booth'&&entry.booth)booth={...booth,...entry.booth,frameStyle:global.ChamFrames.preset(entry.booth.frameStyle).id,frame:validColor(entry.booth.frame),custom:global.ChamEdits.custom(entry.booth.custom)};
  postMeta={overlayStyle:(global.ChamEdits.captionStyles||[]).some(s=>s.id===entry.overlayStyle)?entry.overlayStyle:'standard',recipients:Array.isArray(entry.recipients)?entry.recipients.filter(x=>typeof x==='string'):[]};
  records=(entry.records||[]).slice(0,kind==='booth'?4:1).filter(r=>r.file instanceof Blob&&Number.isFinite(r.duration)).map(r=>{const name=r.name||'draft.mp4',type=/\.webm$/i.test(name)?'video/webm':'video/mp4';const file=r.file instanceof File?r.file:new File([r.file],name,{type});return{file,duration:r.duration,url:url(file)};});
  if(kind==='booth'&&records.length===3&&booth.layout==='grid')booth.layout='strip';
  prepared=entry.prepared?.video?.startsWith('data:video/mp4;base64,')?entry.prepared:null;dirty=!!entry.dirty;posted=!!entry.posted;
  $('#video-caption').value=String(entry.caption||'').slice(0,150);
  const aud=['all','self','selected'].includes(entry.audience)?entry.audience:'self';
  const radio=$('input[name="video-audience"][value="'+aud+'"]');if(radio)radio.checked=true;
  if(records.length){
   $('.video-empty').hidden=true;$('video').hidden=false;$('video').src=prepared?url(blob(prepared.video,'video/mp4')):records[0].url;
   if(prepared){$('video').poster=prepared.image;$('.video-cover-preview').src=prepared.image;}$('video').load();
   if(kind==='single'){sourceVideo=document.createElement('video');sourceVideo.preload='auto';sourceVideo.muted=true;sourceVideo.src=records[0].url;sourceVideo.load();}
   status(prepared&&!dirty?'Video đã sẵn sàng. Xem lại trước khi đăng lên Locket.':'Đã khôi phục video. Bạn có thể chỉnh sửa hoặc đăng tiếp.');
  }else status(available?'Chọn video để bắt đầu.':'Đang kiểm tra xử lý video…');
 }
 function changed(){if(!records.length)return;dirty=true;posted=false;status('Có chỉnh sửa mới. Bấm Áp dụng để xem lại trước khi đăng.');update();save();}
 function metadata(video,value){return new Promise((resolve,reject)=>{
  let done=false;const finish=error=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener('loadedmetadata',loaded);video.removeEventListener('error',failed);error?reject(error):resolve(video.duration);},loaded=()=>finish(),failed=()=>finish(Error('Không đọc được video. Hãy thử MP4 H.264.'));const timer=setTimeout(()=>finish(Error('Đọc video quá lâu. Hãy thử clip khác.')),12000);
  video.addEventListener('loadedmetadata',loaded);video.addEventListener('error',failed);video.src=value;video.load();
 });}
 async function chooseFiles(files){
  if(!root||sending||!files.length)return;const token=++revision;restoring=false;controller?.abort();prepared=null;dirty=true;posted=false;busy=true;records=[];detachPlayer();update();
  try{
   const allowWebm=kind==='booth',selected=allowWebm?[...files].slice(0,4):[files[0]];
   if(allowWebm&&![2,3,4].includes(selected.length))throw Error('Chọn 2, 3 hoặc 4 clip cùng lúc để tạo photobooth động.');
   if(selected.reduce((n,f)=>n+f.size,0)>40*1024*1024)throw Error('Tổng các clip cần nhỏ hơn 40 MB.');
   const next=[];for(const file of selected){validateFile(file,allowWebm);const head=new Uint8Array(await file.slice(0,16).arrayBuffer());if(!validClipHead(head,allowWebm))throw Error('Có tệp chưa phải video MP4/WebM hợp lệ.');const probe=document.createElement('video');probe.preload='auto';probe.muted=true;probe.playsInline=true;const value=url(file);let duration=await metadata(probe,value);if(allowWebm&&duration===Infinity)duration=3;if(token!==revision||!root){probe.pause();return;}if(!Number.isFinite(duration)||duration<=0||duration>120.05)throw Error('Video gốc cần dài tối đa 2 phút.');next.push({file,duration,url:value});probe.pause();if(next.length===1)sourceVideo=probe;}
   if(token!==revision||!root)return;records=next;booth.live=false;edit={start:0,end:Math.min(15,records[0].duration),cover:0,mute:false};booth.duration=Math.min(3,...records.map(r=>r.duration));booth.layout=[2,4].includes(records.length)&&booth.layout==='grid'?'grid':records.length===4?'grid':'strip';booth.audio=-1;$('.video-empty').hidden=true;$('video').hidden=false;$('video').src=records[0].url;$('video').load();controls();busy=false;update();save();await apply();
  }catch(e){if(root&&token===revision)status(e.message);}
  finally{if(root&&token===revision){busy=false;update();}}
 }
 async function loadLiveBooth(payload){
  if(!root||sending||!Array.isArray(payload?.clips)||![2,3,4].includes(payload.clips.length))return;
  const token=++revision;restoring=false;controller?.abort();byKind[kind]=modeEntry();kind='booth';detachPlayer();
  booth={duration:3,audio:-1,layout:[2,4].includes(payload.count)&&payload.layout==='grid'?'grid':'strip',frameStyle:global.ChamFrames.preset(payload.frameStyle).id,frame:validColor(payload.frame),live:true,custom:global.ChamEdits.custom(payload.custom)};
  records=payload.clips.map((f,i)=>{const file=f instanceof File?f:new File([f],`live-${i+1}.webm`,{type:f.type||'video/webm'});return{file,duration:3,url:url(file)};});
  prepared=null;dirty=true;posted=false;$('.video-empty').hidden=true;$('video').hidden=false;$('video').src=records[0].url;$('video').load();
  controls();update();save();
  if(token===revision)await apply();
 }
 async function apply(){
  if(!root||busy||sending||!records.length)return;const token=++revision;controller?.abort();controller=new AbortController();busy=true;dirty=true;update();status(kind==='booth'?'Đang ghép các clip vào khung…':'Đang cắt video, tạo ảnh bìa và xử lý âm thanh…');
  try{
   let path,body,headers={};if(kind==='single'){global.ChamEdits.trim(records[0].duration,edit.start,edit.end,edit.cover);path='/api/video/prepare?'+new URLSearchParams({start:edit.start,end:edit.end,cover:edit.cover,mute:edit.mute?'1':'0'});body=records[0].file;headers={'Content-Type':'video/mp4'};}
   else{if(![2,3,4].includes(records.length)||!Number.isFinite(booth.duration)||booth.duration<.25||(!booth.live&&booth.duration>Math.min(10,...records.map(r=>r.duration))))throw Error('Chọn thời lượng không quá 10 giây và không dài hơn clip ngắn nhất.');const frame=await global.ChamMotionFrame.create(booth,records.length);path='/api/video/booth';body=new FormData();records.forEach(r=>body.append('clips',r.file,r.file.name));body.append('frame',frame.frame,'frame.png');body.append('slots',JSON.stringify(frame.slots));body.append('duration',booth.duration);body.append('audio',booth.audio);if(booth.live)body.append('live','1');}
   const res=await fetch(path,{method:'POST',credentials:'same-origin',headers,body,signal:controller.signal});let data;try{data=await res.json();}catch{throw Error('Máy chủ local chưa phản hồi đúng định dạng.');}if(!res.ok)throw Error(data.error?.message||'Không xử lý được video.');if(!root||token!==revision)return;
   if(!data.video?.startsWith('data:video/mp4;base64,')||!/^data:image\/(webp|jpeg);base64,/.test(data.image||'')||data.width!==720||data.height!==720)throw Error('Chưa nhận được video hợp lệ.');
   prepared=data;dirty=false;posted=false;$('video').pause();$('video').src=url(blob(data.video,'video/mp4'));$('video').poster=data.image;$('video').load();$('.video-cover-preview').src=data.image;status('Video đã sẵn sàng. Xem lại trước khi đăng lên Locket.');update();save();
  }catch(e){if(root&&token===revision&&e.name!=='AbortError')status(e.message);}
  finally{if(root&&token===revision){busy=false;update();}}
 }
 async function coverPreview(){if(!sourceVideo||kind!=='single'||!root)return;const token=revision,time=edit.cover;
  try{if(Math.abs(sourceVideo.currentTime-time)>.02||sourceVideo.readyState<2)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error());},5000);const cleanup=()=>{clearTimeout(timer);sourceVideo?.removeEventListener('seeked',done);sourceVideo?.removeEventListener('loadeddata',done);};const done=()=>{if(sourceVideo?.readyState>=2){cleanup();resolve();}};sourceVideo.addEventListener('seeked',done);sourceVideo.addEventListener('loadeddata',done);sourceVideo.currentTime=Math.max(0,Math.min(records[0].duration-.05,time));});if(!root||token!==revision)return;const c=document.createElement('canvas');c.width=320;c.height=180;c.getContext('2d').drawImage(sourceVideo,0,0,320,180);$('.video-cover-preview').src=c.toDataURL('image/webp',.8);}catch{}
 }
 async function send(){
  if(!prepared||dirty||sending||posted)return;const aud=currentAudience();
  if(aud==='selected'&&!postMeta.recipients.length){status('Hãy chọn ít nhất một người bạn nhận video.');return;}
  const token=revision,body={video:prepared.video,image:prepared.image,duration:prepared.duration,caption:$('#video-caption').value.trim(),audience:aud,overlayStyle:postMeta.overlayStyle,timeLabel:global.ChamEdits.timeLabel?.()||'',...(aud==='selected'?{recipients:postMeta.recipients}:{})};
  sending=true;update();status('Đang đăng video lên Locket…');
  try{const result=await callbacks.onPost(body);if(!root||token!==revision)return;if(result===null){status('Đăng nhập Locket trước khi gửi video.');return;}if(!result?.confirmed||!result.moment?.id)throw Error('Locket chưa xác nhận. Hãy kiểm tra trong app trước khi gửi lại.');posted=true;status('Đã đăng video lên Locket thành công.');save();}catch(e){if(root&&token===revision)status(e.message);}finally{sending=false;if(root&&token===revision)update();}
 }
 async function clear(erase=true){revision++;restoring=false;controller?.abort();clearTimeout(saveTimer);detachPlayer();records=[];prepared=null;dirty=false;posted=false;busy=false;resetKindSettings(kind);$('#video-caption').value='';if(erase){byKind[kind]=null;const other=byKind[kind==='single'?'booth':'single'];if(other)save();else await global.ChamDrafts.remove('video:'+scope);}else byKind={single:null,booth:null};draftStatus(erase?'Đã xóa nháp video đang mở':'Nháp tự lưu trên thiết bị');status('Chọn video để bắt đầu.');controls();update();}
 function switchKind(next){if(busy||sending||next===kind||!['single','booth'].includes(next))return;revision++;controller?.abort();byKind[kind]=modeEntry();kind=next;hydrateEntry(byKind[kind]);controls();update();save();}
 async function setScope(next='device'){
  if(!root||next===scope){renderPostExtras();return;}if(!restoring)global.ChamDrafts.put('video:'+scope,snapshot()).catch(()=>{});scope=next;resetSettings();await clear(false);if(root&&scope===next){const selfR=$('input[name="video-audience"][value="self"]');if(selfR)selfR.checked=true;await restore();}
 }
 async function restore(){
  const token=revision;restoring=true;try{const saved=await global.ChamDrafts.get('video:'+scope);if(!root||token!==revision||saved?.version!==2)return;
   byKind={single:saved.modes?.single||(saved.kind!=='booth'&&saved.records?.length?saved:null),booth:saved.modes?.booth||(saved.kind==='booth'&&saved.records?.length?saved:null)};
   kind=saved.kind==='booth'?'booth':'single';hydrateEntry(byKind[kind]||(saved.records?.length||saved.caption?saved:null));
   if(records.length)draftStatus('Đã khôi phục nháp video trên thiết bị');controls();update();
  }catch(e){if(root&&token===revision)draftStatus(e.message);}finally{if(root&&token===revision)restoring=false;}
 }
 async function action(e){
  const button=e.target.closest('[data-video],[data-video-back],[data-video-kind],[data-video-shift],[data-motion-color],[data-video-overlay],[data-video-recipient]');if(!button||sending)return;
  if(button.dataset.videoBack){callbacks.onBack(button.dataset.videoBack);return;}
  if(button.dataset.videoKind){switchKind(button.dataset.videoKind);return;}
  if(button.dataset.motionColor){if(busy)return;booth.frame=validColor(button.dataset.motionColor);booth.frameStyle='classic';controls();changed();return;}
  if(button.dataset.videoOverlay){postMeta.overlayStyle=button.dataset.videoOverlay;renderPostExtras();save();return;}
  if(button.dataset.videoRecipient){const id=button.dataset.videoRecipient;postMeta.recipients=postMeta.recipients.includes(id)?postMeta.recipients.filter(x=>x!==id):[...postMeta.recipients,id];renderPostExtras();save();return;}
  if(button.dataset.videoShift!==undefined){if(busy)return;const i=Number(button.dataset.videoShift),j=i+Number(button.dataset.step);if(j<0||j>=records.length)return;[records[i],records[j]]=[records[j],records[i]];controls();changed();return;}
  switch(button.dataset.video){case'pick':$('.video-input').click();break;case'apply':await apply();break;case'send':await send();break;case'reset':await clear();break;case'reset-motion-colors':booth.custom=global.ChamEdits.custom({...booth.custom,paper:'',ink:''});controls();changed();break;case'toggle-all-friends':{const all=(callbacks.friends?.()||[]).map(f=>f.id);postMeta.recipients=postMeta.recipients.length===all.length?[]:all;renderPostExtras();save();break;}case'download':if(prepared&&!dirty){const a=document.createElement('a');a.href=url(blob(prepared.video,'video/mp4'));a.download=kind==='booth'?'cham-photobooth-dong.mp4':'cham-video.mp4';a.click();}break;case'cover-current':edit.cover=Math.max(edit.start,Math.min(edit.end,prepared&&!dirty?edit.start+$('video').currentTime:$('video').currentTime));controls();changed();coverPreview();break;}
 }
 function mount(element,options){
  unmount();root=element;callbacks=options;scope=options.draftScope||'device';records=[];prepared=null;posted=false;dirty=false;resetSettings();const token=++mountId;
  const styles=global.ChamEdits.captionStyles||[];
  root.innerHTML=`<div class="studio video-studio"><span class="video-restore-status" hidden></span><div class="camera-modes" aria-label="Chế độ chụp"><button data-video-back="photo">Ảnh</button><button data-video-back="digital">Digital</button><button data-video-back="booth">Photobooth</button><button class="active" aria-pressed="true">Video</button></div><div class="video-kind"><button data-video-kind="single" class="active">Video đơn</button><button data-video-kind="booth">Photobooth động</button></div><div class="video-layout"><section><div class="video-viewfinder"><video controls playsinline preload="metadata" aria-label="Xem trước video sẽ gửi lên Locket" hidden></video><div class="video-empty"><span class="camera-outline">▷</span><strong>Giữ trọn một chút chuyển động.</strong><p>Chọn MP4 tối đa 2 phút (hoặc 2–4 clip cho Photobooth động), tổng 40 MB.</p></div></div><p class="video-info"></p><p class="video-status" role="status">Đang kiểm tra xử lý video…</p><div class="video-pick-row"><button class="secondary video-pick" data-video="pick" disabled>Chọn video MP4</button><button class="text-button video-reset" data-video="reset">Đặt lại</button></div><input class="video-input" type="file" accept="video/mp4,.mp4" hidden><div class="clip-list"></div></section><aside class="video-settings"><h2>Chỉnh trước khi gửi.</h2><p>Căn vuông, giữ đủ khung hình. Chỉ đăng khi bạn bấm xác nhận.</p><details class="editor-disclosure video-edit-panel" open hidden><summary>Chỉnh sửa video</summary><p class="video-source-info editor-help"></p><div class="single-video-editor"><div class="video-trim-grid"><label>Bắt đầu (giây)<input class="trim-start" type="number" min="0" step=".1" value="0"></label><label>Kết thúc (giây)<input class="trim-end" type="number" min=".1" step=".1" value="0"></label></div><label>Ảnh bìa <span class="cover-time-label">0.0 giây</span><input class="cover-time" type="range" min="0" max="15" step=".1" value="0"></label><img class="video-cover-preview" alt="Ảnh bìa video" style="width:100%;border-radius:8px"><button class="secondary" data-video="cover-current">Lấy khung hình đang xem</button><label class="mute-label"><input type="checkbox" class="video-mute"> Tắt âm thanh</label></div><div class="motion-video-editor" hidden><label>Thời lượng ghép (giây)<input class="booth-duration" type="number" min=".25" max="10" step=".25" value="3"></label><label>Bố cục<select class="booth-layout"><option value="grid">Ngang (2) / Lưới (4)</option><option value="strip">Dải dọc</option></select></label><label>Frame<select class="booth-frame">${global.ChamFrames.presets.map(p=>'<option value="'+p.id+'">'+p.name+'</option>').join('')}</select></label><div class="frame-colors motion-frame-colors" aria-label="Màu khung tối giản" hidden><button type="button" data-motion-color="#ffffff" aria-label="Khung trắng" style="background:white"></button><button type="button" data-motion-color="#161616" aria-label="Khung đen" style="background:#161616"></button><button type="button" data-motion-color="#dfeaff" aria-label="Khung xanh nhạt" style="background:#dfeaff"></button></div><div class="custom-color-row"><label>Màu giấy<input type="color" data-motion-color-pick="paper" value="#ffffff"></label><label>Màu chữ<input type="color" data-motion-color-pick="ink" value="#303030"></label><button type="button" class="text-button reset-colors" data-video="reset-motion-colors" hidden>Màu mặc định</button></div><label>Mẫu yêu thích<select class="motion-template"></select></label><label>Âm thanh<select class="booth-audio"><option value="-1">Tắt âm toàn bộ</option></select></label><div class="video-frame-options"><label>Tên trên khung<input class="text-field" data-motion-label="title" maxlength="32"></label><label>Lời nhắn<input class="text-field" data-motion-label="message" maxlength="60"></label><label>Ngày kỷ niệm<input class="text-field" type="date" data-motion-label="date"></label></div></div><button class="primary video-apply" data-video="apply">Áp dụng chỉnh sửa</button></details><div class="video-post-fields" hidden><label class="field-label" for="video-caption">Một dòng gửi kèm</label><textarea id="video-caption" class="text-field" maxlength="150" placeholder="Hôm nay của bạn thế nào?"></textarea><div class="caption-style-picker" role="group" aria-label="Kiểu thẻ chữ Locket">${styles.map(s=>`<button type="button" class="caption-style-chip" data-video-overlay="${s.id}">${s.name}</button>`).join('')}</div><div class="caption-pill-preview video-caption-preview"></div><fieldset class="audience"><legend>Gửi đến ai trên Locket?</legend><label><input type="radio" name="video-audience" value="self" checked> Chỉ mình tôi trên Locket</label><label><input type="radio" name="video-audience" value="all"> Tất cả bạn bè Locket</label><label><input type="radio" name="video-audience" value="selected"> Chọn bạn cụ thể</label></fieldset><div class="recipient-picker video-recipient-picker" hidden></div></div><div class="video-actions" hidden><button class="primary video-upload" data-video="send" disabled>Đăng video lên Locket</button><button class="secondary video-download" data-video="download" disabled>Tải video đã xử lý</button></div></aside></div></div>`;
  root.addEventListener('click',action);$('.video-input').addEventListener('change',e=>{const files=[...e.target.files];e.target.value='';chooseFiles(files);});
  for(const name of['trim-start','trim-end'])$('.'+name).addEventListener('input',()=>{edit.start=Number($('.trim-start').value);edit.end=Number($('.trim-end').value);if(Number.isFinite(edit.start)&&Number.isFinite(edit.end)&&edit.end>=edit.start){edit.cover=Math.max(edit.start,Math.min(edit.end,edit.cover));$('.cover-time').min=edit.start;$('.cover-time').max=edit.end;$('.cover-time').value=edit.cover;$('.cover-time-label').textContent=edit.cover.toFixed(1)+' giây';}changed();});
  $('.cover-time').addEventListener('input',e=>{edit.cover=Number(e.target.value);$('.cover-time-label').textContent=edit.cover.toFixed(1)+' giây';changed();coverPreview();});$('.video-mute').addEventListener('change',e=>{edit.mute=e.target.checked;changed();});
  for(const [selector,key]of[['booth-duration','duration'],['booth-audio','audio'],['booth-layout','layout'],['booth-frame','frameStyle']])$('.'+selector).addEventListener('change',e=>{booth[key]=['duration','audio'].includes(key)?Number(e.target.value):e.target.value;if(key==='layout'&&records.length===3&&booth.layout==='grid'){booth.layout='strip';e.target.value='strip';}controls();changed();});
  root.querySelectorAll('[data-motion-label]').forEach(input=>input.addEventListener('input',()=>{booth.custom=global.ChamEdits.custom({...booth.custom,...Object.fromEntries([...root.querySelectorAll('[data-motion-label]')].map(el=>[el.dataset.motionLabel,el.value]))});changed();}));
  root.querySelectorAll('[data-motion-color-pick]').forEach(input=>input.addEventListener('input',e=>{booth.custom=global.ChamEdits.custom({...booth.custom,[e.target.dataset.motionColorPick]:e.target.value});controls();changed();}));
  $('.motion-template').addEventListener('change',e=>{if(e.target.value==='')return;const saved=global.ChamDrafts.readPreference('frames:'+scope,[])[Number(e.target.value)];if(saved){booth.frameStyle=global.ChamFrames.preset(saved.frameStyle).id;booth.frame=validColor(saved.frame);booth.layout=records.length===3?'strip':saved.layout==='grid'?'grid':'strip';booth.custom=global.ChamEdits.custom(saved.custom);controls();changed();}});
  $('#video-caption').addEventListener('input',()=>{renderPostExtras();save();});root.querySelectorAll('input[name="video-audience"]').forEach(input=>input.addEventListener('change',()=>{renderPostExtras();save();}));controls();restore();
  fetch('/api/video/status',{credentials:'same-origin'}).then(r=>r.json()).then(data=>{if(root&&token===mountId){available=data.available===true;if(!records.length)status(available?'Chọn video để bắt đầu.':data.reason||'Hãy mở bản local để xử lý video.');update();}}).catch(()=>{if(root&&token===mountId)status('Chưa kết nối được máy chủ local. Hãy mở lại start-local.cmd.');});
 }
 function unmount(){if(!root)return;if(!restoring)global.ChamDrafts?.put('video:'+scope,snapshot()).catch(()=>{});clearTimeout(saveTimer);revision++;mountId++;controller?.abort();sourceVideo?.pause();root.querySelector('video')?.pause();root.removeEventListener('click',action);release();root=null;callbacks={};records=[];prepared=null;busy=false;sending=false;posted=false;dirty=false;available=false;restoring=false;sourceVideo=null;byKind={single:null,booth:null};}
 global.ChamVideo={mount,unmount,setScope,loadLiveBooth,testing:{validateFile}};
})(typeof window!=='undefined'?window:globalThis);
