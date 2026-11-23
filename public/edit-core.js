(function(global){
  'use strict';
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  function crop(value={}){return{zoom:clamp(value.zoom||1,1,3),x:clamp(value.x,-1,1),y:clamp(value.y,-1,1)};}
  function sourceBox(iw,ih,tw,th,value={}){
    if(![iw,ih,tw,th].every(n=>Number.isFinite(n)&&n>0))throw Error('Kích thước ảnh chưa hợp lệ.');
    const c=crop(value),scale=Math.max(tw/iw,th/ih)*c.zoom,sw=tw/scale,sh=th/scale;
    return{x:(iw-sw)*(1-c.x)/2,y:(ih-sh)*(1-c.y)/2,width:sw,height:sh};
  }
  function custom(value={}){
    const hex=v=>/^#[a-f0-9]{6}$/i.test(v||'')?String(v).toLowerCase():'';
    return{title:String(value.title||'').slice(0,32),message:String(value.message||'').slice(0,60),date:/^\d{4}-\d{2}-\d{2}$/.test(value.date||'')?value.date:'',paper:hex(value.paper),ink:hex(value.ink)};
  }
  function tone(value={}){return{brightness:clamp(value.brightness,-30,30),contrast:clamp(value.contrast,-30,30),warmth:clamp(value.warmth,-30,30)};}
  const captionStyles=[
    {id:'standard',name:'Mặc định',bg:'rgba(32,32,32,.68)',fg:'#ffffff'},
    {id:'time',name:'Giờ chụp',bg:'rgba(32,32,32,.68)',fg:'#ffffff',time:true},
    {id:'music',name:'Đang nghe',bg:'linear-gradient(135deg,#2B1E4A,#4A2C6D)',fg:'#ffffff',prefix:'🎵 '},
    {id:'sunset',name:'Hoàng hôn',bg:'linear-gradient(135deg,#FF6B6B,#FFA94D)',fg:'#ffffff'},
    {id:'matcha',name:'Matcha',bg:'linear-gradient(135deg,#DCECCB,#B7D99C)',fg:'#243319'},
    {id:'berry',name:'Hồng đào',bg:'linear-gradient(135deg,#FFD6E0,#FFACC7)',fg:'#4A192C'},
    {id:'night',name:'Đêm sao',bg:'linear-gradient(135deg,#141E30,#243B55)',fg:'#ffffff'},
  ];
  function timeLabel(date=new Date()){return date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false});}
  function formatCaptionPreview(text='',styleId='standard',clock=timeLabel()){
    const s=captionStyles.find(x=>x.id===styleId)||captionStyles[0],clean=String(text||'').trim();
    if(s.time)return{...s,text:clean?`🕒 ${clock} · ${clean}`:`🕒 ${clock}`};
    if(s.prefix)return{...s,text:clean?(clean.startsWith('🎵')?clean:s.prefix+clean):'🎵 Thêm tên bài hát…'};
    return{...s,text:clean||'Xem trước dòng chữ trên ảnh…'};
  }
  function trim(duration,start=0,end=Math.min(duration,15),cover=start){
    if(![duration,start,end,cover].every(Number.isFinite)||duration<=0||start<0||end>duration+.05||end<=start||end-start>15.05||cover<start||cover>end)throw Error('Chọn đoạn dài tối đa 15 giây và ảnh bìa nằm trong đoạn đó.');
    return{start,end,cover,duration:end-start};
  }
  function exportCanvas(c,quality=.88){
    const webp=c.toDataURL('image/webp',quality);
    if(webp.startsWith('data:image/webp;base64,'))return webp;
    const jpg=c.toDataURL('image/jpeg',quality);
    if(jpg.startsWith('data:image/jpeg;base64,'))return jpg;
    throw Error('Trình duyệt chưa hỗ trợ xuất ảnh.');
  }
  async function aiImage(data){
    if(typeof data!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(data)||data.length>9*1024*1024)throw Error('Ảnh kết quả AI chưa hợp lệ. Ảnh gốc vẫn được giữ lại.');
    const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Không đọc được ảnh kết quả AI. Ảnh gốc vẫn được giữ lại.'));im.src=data;});
    const scale=Math.min(1,1600/Math.max(image.naturalWidth,image.naturalHeight)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(image.naturalWidth*scale));c.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,0,0,c.width,c.height);const output=exportCanvas(c,.92);
    if(output.length>7*1024*1024)throw Error('Ảnh kết quả AI quá lớn. Hãy thử lại.');
    return output;
  }
  global.ChamEdits={clamp,crop,sourceBox,custom,tone,trim,exportCanvas,aiImage,captionStyles,timeLabel,formatCaptionPreview};
})(typeof window!=='undefined'?window:globalThis);
