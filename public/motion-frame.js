(function(global){
 'use strict';
 async function create(options,count){
  const layout=[2,4].includes(count)&&options.layout==='grid'?'grid':'strip',id=global.ChamFrames.preset(options.frameStyle).id,g=global.ChamFrames.geometry(count,layout,id);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=720;const ctx=canvas.getContext('2d'),scale=Math.min(632/g.width,632/g.height),x=(720-g.width*scale)/2,y=(720-g.height*scale)/2;
  ctx.fillStyle='#fff';ctx.fillRect(0,0,720,720);ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);global.ChamFrames.background(ctx,g,id,options.frame||'#ffffff',options.custom);
  for(const slot of g.slots){ctx.save();global.ChamFrames.slotPath(ctx,slot,id);ctx.clip();ctx.clearRect(slot.x-1,slot.y-1,slot.width+2,slot.height+2);ctx.restore();}
  global.ChamFrames.overlay(ctx,g,id,Date.now(),options.frame||'#ffffff',options.custom);ctx.restore();
  const frame=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Không tạo được khung video.')),'image/png'));
  const slots=g.slots.map(s=>({x:Math.round(x+s.x*scale),y:Math.round(y+s.y*scale),width:Math.floor(s.width*scale/2)*2,height:Math.floor(s.height*scale/2)*2}));
  return{frame,slots};
 }
 global.ChamMotionFrame={create};
})(typeof window!=='undefined'?window:globalThis);
