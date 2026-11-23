(function(global){
  'use strict';
  let root=null,callbacks={},selected=0,image=null,token=0,drag=null,scheduled=null;
  const $=s=>root?.querySelector(s);
  function render(){
    const shots=callbacks.shots?.()||[];if(!root)return;root.hidden=!shots.length||!callbacks.enabled?.();if(root.hidden)return;
    selected=Math.max(0,Math.min(selected,shots.length-1));
    const shot=shots[selected],crop=global.ChamEdits.crop(shot.crop);
    $('.edit-shot-label').textContent='Tấm '+(selected+1)+' / '+shots.length;
    $('.shot-zoom').value=crop.zoom;$('.shot-zoom-value').textContent=crop.zoom.toFixed(1)+'×';
    $('[data-edit="left"]').disabled=selected===0;$('[data-edit="right"]').disabled=selected===shots.length-1;
    root.parentElement?.querySelectorAll?.('.shot-slot').forEach((el,i)=>{const active=!el.disabled&&i===selected;el.classList.toggle('active',active);el.setAttribute('aria-current',String(active));});
    if(image?.source===shot.image){draw();return;}
    const version=++token,im=new Image();im.onload=()=>{if(root&&version===token){image={source:shot.image,im};draw();}};im.src=shot.image;
  }
  function draw(){if(!root||!image)return;const shot=callbacks.shots()[selected];if(!shot)return;const c=$('canvas'),ctx=c.getContext('2d'),b=global.ChamEdits.sourceBox(image.im.naturalWidth,image.im.naturalHeight,c.width,c.height,shot.crop);ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image.im,b.x,b.y,b.width,b.height,0,0,c.width,c.height);}
  function changed(){draw();clearTimeout(scheduled);scheduled=setTimeout(()=>callbacks.changed?.(),120);}
  function action(e){const b=e.target.closest('[data-edit]');if(!b)return;const shots=callbacks.shots();switch(b.dataset.edit){
    case'left':case'right':{const other=selected+(b.dataset.edit==='left'?-1:1);if(other<0||other>=shots.length)return;[shots[selected],shots[other]]=[shots[other],shots[selected]];selected=other;callbacks.changed();render();break;}
    case'reset':shots[selected].crop={zoom:1,x:0,y:0};callbacks.changed();render();break;
    case'replace':$('.shot-replacement').click();break;
    case'retake':callbacks.retake(selected);break;
  }}
  function mount(element,options){unmount();root=element;callbacks=options;
    root.innerHTML=`<details class="editor-disclosure"><summary>Chỉnh từng tấm <span class="edit-shot-label"></span></summary><p class="editor-help">Chạm một ô ảnh phía trên. Kéo ảnh để căn lại, hoặc phóng to bên dưới.</p><canvas width="480" height="360" class="shot-crop-canvas" aria-label="Kéo để căn vị trí ảnh" tabindex="0"></canvas><label class="range-label">Phóng to <output class="shot-zoom-value">1.0×</output></label><input class="shot-zoom" type="range" min="1" max="3" step=".05" value="1" aria-label="Phóng to tấm ảnh"><div class="editor-actions"><button data-edit="left">Đổi với ô trước</button><button data-edit="right">Đổi với ô sau</button><button data-edit="replace">Đổi ảnh</button><button data-edit="retake">Chụp lại tấm này</button><button data-edit="reset">Căn giữa</button></div><input class="shot-replacement" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden></details>`;
    root.addEventListener('click',action);$('.shot-replacement').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';if(file)callbacks.replace(selected,file);});
    $('.shot-zoom').addEventListener('input',e=>{const shot=callbacks.shots()[selected];shot.crop={...global.ChamEdits.crop(shot.crop),zoom:Number(e.target.value)};$('.shot-zoom-value').textContent=Number(e.target.value).toFixed(1)+'×';changed();});
    const canvas=$('canvas');canvas.addEventListener('pointerdown',e=>{if(!image)return;const c=global.ChamEdits.crop(callbacks.shots()[selected].crop);drag={x:e.clientX,y:e.clientY,crop:c};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;const bounds=canvas.getBoundingClientRect();callbacks.shots()[selected].crop=global.ChamEdits.crop({...drag.crop,x:drag.crop.x+(e.clientX-drag.x)/bounds.width*2,y:drag.crop.y+(e.clientY-drag.y)/bounds.height*2});changed();});
    const end=()=>{if(!drag)return;drag=null;clearTimeout(scheduled);callbacks.changed();};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
    canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const c=global.ChamEdits.crop(callbacks.shots()[selected].crop);if(e.key==='ArrowLeft')c.x-=.08;if(e.key==='ArrowRight')c.x+=.08;if(e.key==='ArrowUp')c.y-=.08;if(e.key==='ArrowDown')c.y+=.08;callbacks.shots()[selected].crop=global.ChamEdits.crop(c);changed();});render();
  }
  function select(index){selected=Number(index)||0;render();root?.querySelector('details')?.setAttribute('open','');}
  function unmount(){clearTimeout(scheduled);token++;root=null;callbacks={};image=null;drag=null;}
  global.ChamPhotoEditor={mount,refresh:render,select,selectedIndex:()=>selected,unmount};
})(typeof window!=='undefined'?window:globalThis);
