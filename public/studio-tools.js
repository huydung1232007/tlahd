(function(global){
  'use strict';
  let root=null,callbacks={},timer=null,scope='device',lastScope=null;
  const $=s=>root?.querySelector(s),state=()=>callbacks.state();
  function preferences(name){const result=global.ChamDrafts.readPreference(name+':'+scope,[]);return Array.isArray(result)?result:[];}
  function options(select,items,label){select.replaceChildren();const empty=document.createElement('option');empty.value='';empty.textContent=label;select.append(empty);items.forEach((item,index)=>{const option=document.createElement('option');option.value=index;option.textContent=String(item.name||item).slice(0,64);select.append(option);});}
  const aiChips=[
    ['Phim Nhật nắng chiều','Màu phim Nhật ấm áp nắng chiều vàng dịu, hạt phim nhẹ, giữ nguyên khuôn mặt và bố cục'],
    ['Flash máy cơ','Ánh đèn flash máy ảnh film thập niên 90, tương phản tự nhiên, giữ nguyên người trong ảnh'],
    ['Dịu da & trong trẻo','Làm sáng trong trẻo tự nhiên, dịu da nhẹ nhàng như chụp studio, giữ nguyên đường nét khuôn mặt'],
    ['Màu nước Ghibli','Chuyển sang phong cách màu nước anime Ghibli dịu mắt, bầu trời trong, giữ nguyên dáng và biểu cảm'],
    ['Polaroid cổ điển','Màu ảnh Polaroid hoài niệm hơi phai ấm, ánh sáng mềm mại, giữ nguyên người trong ảnh'],
    ['Đêm điện ảnh','Ánh sáng đêm lung linh tông xanh tím điện ảnh, làm nổi bật chủ thể, giữ nguyên khuôn mặt'],
  ];
  function defaultColors(s){
    const p=global.ChamFrames.preset(s.frameStyle);
    const paper=s.frameStyle==='classic'?(s.frame||'#ffffff'):p.paper;
    const ink=s.frameStyle==='classic'?(paper.toLowerCase()==='#161616'?'#ffffff':'#303030'):p.ink;
    return{paper,ink};
  }
  function refresh(force=false){if(!root)return;const s=state();scope=callbacks.scope();
    const savedFrames=preferences('frames'),savedPrompts=preferences('prompts');
    if(force||lastScope!==scope){options($('.saved-frames'),savedFrames,'Chọn mẫu đã lưu');options($('.saved-prompts'),savedPrompts,'Prompt yêu thích');lastScope=scope;}
    for(const key of['title','message','date']){const input=$('[data-frame-label="'+key+'"]');if(document.activeElement!==input)input.value=s.custom?.[key]||'';}
    const defs=defaultColors(s);
    const paperInput=$('[data-frame-color="paper"]'),inkInput=$('[data-frame-color="ink"]'),resetColors=$('[data-tool="reset-colors"]');
    if(paperInput&&document.activeElement!==paperInput)paperInput.value=s.custom?.paper||defs.paper;
    if(inkInput&&document.activeElement!==inkInput)inkInput.value=s.custom?.ink||defs.ink;
    if(resetColors)resetColors.hidden=!(s.custom?.paper||s.custom?.ink);
    $('.ai-comparison').hidden=!s.aiResult;
    if(s.aiResult){$('.compare-before').src=s.aiApplied||s.output;$('.compare-after').src=s.aiResult;}else{$('.compare-before').removeAttribute('src');$('.compare-after').removeAttribute('src');}
    const busy=callbacks.busy();
    root.querySelectorAll('.frame-custom-tools input,.frame-custom-tools select,.frame-custom-tools button,.ai-chip').forEach(el=>el.disabled=busy);
    const delFrame=$('[data-tool="delete-frame"]'),delPrompt=$('[data-tool="delete-prompt"]');
    if(delFrame){delFrame.hidden=!savedFrames.length;delFrame.disabled=busy||$('.saved-frames').value==='';}
    if(delPrompt){delPrompt.hidden=!savedPrompts.length;delPrompt.disabled=busy||$('.saved-prompts').value==='';}
  }
  function mount(element,optionsIn){unmount();root=element;callbacks=optionsIn;
    $('.frame-custom-tools').innerHTML=`<details class="editor-disclosure"><summary>Tùy biến & lưu khung</summary><div class="custom-color-row"><label>Màu giấy<input type="color" data-frame-color="paper" value="#ffffff"></label><label>Màu chữ<input type="color" data-frame-color="ink" value="#303030"></label><button type="button" class="text-button reset-colors" data-tool="reset-colors" hidden>Màu mặc định</button></div><label>Tên trên khung<input data-frame-label="title" maxlength="32" placeholder="Ví dụ: An & Bảo"></label><label>Lời nhắn<input data-frame-label="message" maxlength="60" placeholder="Một ngày thật vui"></label><label>Ngày kỷ niệm<input type="date" data-frame-label="date"></label><div class="saved-template"><label>Tên mẫu<input class="frame-template-name" maxlength="40" placeholder="Khung của tụi mình"></label><button class="secondary" data-tool="save-frame">Lưu mẫu khung</button><select class="saved-frames" aria-label="Mẫu khung đã lưu"></select><button class="text-button tool-delete" data-tool="delete-frame" hidden>Xóa mẫu đang chọn</button></div><p class="frame-tools-feedback" role="status"></p></details>`;
    $('.prompt-tools').innerHTML=`<div class="ai-chips" aria-label="Gợi ý chỉnh ảnh nhanh">${aiChips.map(([label],i)=>`<button type="button" class="ai-chip" data-tool="ai-chip" data-chip="${i}">${label}</button>`).join('')}</div><div class="editor-actions"><button class="secondary" data-tool="save-prompt">Lưu prompt</button><button class="text-button tool-delete" data-tool="delete-prompt" hidden>Xóa prompt đã chọn</button></div><select class="saved-prompts" aria-label="Prompt yêu thích"></select><p class="prompt-feedback" role="status"></p>`;
    $('.ai-comparison').innerHTML=`<h2>Trước / sau AI</h2><div class="comparison-images"><img class="compare-after" alt="Ảnh sau khi chỉnh AI"><div class="compare-original"><img class="compare-before" alt="Ảnh gốc trước khi chỉnh AI"></div><span class="comparison-line"></span><span class="comparison-label before-label">Gốc</span><span class="comparison-label after-label">AI</span></div><input class="compare-range" type="range" min="0" max="100" value="50" aria-label="Kéo để so sánh ảnh gốc và ảnh AI">`;
    root.addEventListener('click',action);
    const syncCustom=()=>{const entries=Object.fromEntries([...root.querySelectorAll('[data-frame-label]')].map(el=>[el.dataset.frameLabel,el.value]));state().custom=global.ChamEdits.custom({...state().custom,...entries});clearTimeout(timer);timer=setTimeout(()=>callbacks.changed(),180);};
    root.querySelectorAll('[data-frame-label]').forEach(input=>input.addEventListener('input',syncCustom));
    root.querySelectorAll('[data-frame-color]').forEach(input=>input.addEventListener('input',e=>{state().custom=global.ChamEdits.custom({...state().custom,[e.target.dataset.frameColor]:e.target.value});clearTimeout(timer);timer=setTimeout(()=>callbacks.changed(),120);refresh();}));
    $('.compare-range').addEventListener('input',e=>{$('.compare-original').style.clipPath='inset(0 '+(100-Number(e.target.value))+'% 0 0)';$('.comparison-line').style.left=e.target.value+'%';});
    $('.saved-frames').addEventListener('change',e=>{if(e.target.value===''){refresh();return;}const saved=preferences('frames')[Number(e.target.value)];if(!saved)return;const s=state();s.frameStyle=global.ChamFrames.preset(saved.frameStyle).id;s.frame=/^#[a-f0-9]{6}$/i.test(saved.frame||'')?saved.frame:'#ffffff';s.layout=saved.layout==='grid'?'grid':'strip';s.count=[2,3,4].includes(saved.count)?(s.layout==='grid'&&saved.count===3?4:saved.count):3;s.custom=global.ChamEdits.custom(saved.custom);callbacks.changed();refresh();});
    $('.saved-prompts').addEventListener('change',e=>{if(e.target.value!==''){const prompt=preferences('prompts')[Number(e.target.value)];if(typeof prompt==='string'){root.querySelector('#ai-prompt').value=prompt;state().aiPrompt=prompt;callbacks.draft();}}refresh();});
    refresh(true);
  }
  function action(e){const button=e.target.closest('[data-tool]');if(!button)return;
    if(button.dataset.tool==='ai-chip'){
      const chip=aiChips[Number(button.dataset.chip)];if(!chip)return;
      root.querySelector('#ai-prompt').value=chip[1];state().aiPrompt=chip[1];callbacks.draft();
      $('.prompt-feedback').textContent='Đã điền gợi ý “'+chip[0]+'”. Bấm Chỉnh ảnh để chạy.';
    }else if(button.dataset.tool==='reset-colors'){
      state().custom=global.ChamEdits.custom({...state().custom,paper:'',ink:''});callbacks.changed();refresh();
    }else if(button.dataset.tool==='save-frame'){
      const s=state(),name=$('.frame-template-name').value.trim()||s.custom?.title||global.ChamFrames.preset(s.frameStyle).name;
      const entry={name:name.slice(0,40),frameStyle:s.frameStyle,frame:s.frame,count:s.count,layout:s.layout,custom:global.ChamEdits.custom(s.custom)};
      const saved=[entry,...preferences('frames').filter(p=>p.name!==entry.name)].slice(0,12);
      $('.frame-tools-feedback').textContent=global.ChamDrafts.writePreference('frames:'+scope,saved)?'Đã lưu mẫu trên thiết bị này.':'Chưa lưu được mẫu. Kiểm tra bộ nhớ trình duyệt.';refresh(true);
    }else if(button.dataset.tool==='delete-frame'){
      const list=preferences('frames'),idx=Number($('.saved-frames').value);
      if($('.saved-frames').value===''||!list[idx]){$('.frame-tools-feedback').textContent='Chọn một mẫu trong danh sách để xóa.';return;}
      const next=list.filter((_,i)=>i!==idx);
      $('.frame-tools-feedback').textContent=global.ChamDrafts.writePreference('frames:'+scope,next)?'Đã xóa mẫu khung.':'Chưa xóa được mẫu.';refresh(true);
    }else if(button.dataset.tool==='save-prompt'){
      const prompt=root.querySelector('#ai-prompt').value.trim().slice(0,2000);if(!prompt){$('.prompt-feedback').textContent='Viết prompt trước khi lưu nhé.';return;}
      const saved=[prompt,...preferences('prompts').filter(p=>p!==prompt)].slice(0,20);
      $('.prompt-feedback').textContent=global.ChamDrafts.writePreference('prompts:'+scope,saved)?'Đã lưu prompt yêu thích.':'Chưa lưu được prompt.';refresh(true);
    }else if(button.dataset.tool==='delete-prompt'){
      const list=preferences('prompts'),idx=Number($('.saved-prompts').value);
      if($('.saved-prompts').value===''||typeof list[idx]!=='string'){$('.prompt-feedback').textContent='Chọn một prompt trong danh sách để xóa.';return;}
      const next=list.filter((_,i)=>i!==idx);
      $('.prompt-feedback').textContent=global.ChamDrafts.writePreference('prompts:'+scope,next)?'Đã xóa prompt yêu thích.':'Chưa xóa được prompt.';refresh(true);
    }
  }
  function unmount(){clearTimeout(timer);root?.removeEventListener('click',action);root=null;callbacks={};lastScope=null;}
  global.ChamStudioTools={mount,refresh,unmount};
})(typeof window!=='undefined'?window:globalThis);
