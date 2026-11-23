import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';

export const VIDEO_INPUT_LIMIT=40*1024*1024;
export const VIDEO_OUTPUT_LIMIT=6*1024*1024-1;
export class VideoError extends Error{constructor(status,message){super(message);this.status=status;}}
export function mp4Header(bytes){return bytes.length>=16&&Buffer.from(bytes.subarray(4,8)).toString()==='ftyp';}
export function webmHeader(bytes){return bytes.length>=4&&bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3;}
export function clipHeader(bytes){return mp4Header(bytes)||webmHeader(bytes);}
function run(command,args,timeout=90000){return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
  let out='',settled=false;const finish=(err,value)=>{if(settled)return;settled=true;clearTimeout(timer);err?reject(err):resolve(value);};
  const timer=setTimeout(()=>{child.kill();finish(new VideoError(422,'Xử lý video quá lâu. Hãy thử clip ngắn hơn.'));},timeout);
  child.stdout.on('data',data=>{out+=data.toString();if(out.length>1024*1024){child.kill();finish(new VideoError(422,'Không đọc được thông tin video.'));}});
  child.stderr.on('data',()=>{});
  child.on('error',()=>finish(new VideoError(503,'Máy chưa có FFmpeg và FFprobe. Hãy cài FFmpeg rồi mở lại bản local.')));
  child.on('close',code=>finish(code===0?null:new VideoError(422,'Không xử lý được video này. Hãy thử xuất lại MP4 H.264.'),out));
});}
let available;
export async function videoStatus(){if(!available)available=Promise.all([run('ffmpeg',['-version'],5000),run('ffprobe',['-version'],5000)]).then(()=>({available:true})).catch(e=>({available:false,reason:e.message}));return available;}
async function probe(input){return JSON.parse(await run('ffprobe',['-v','error','-protocol_whitelist','file,pipe','-show_entries','format=duration:stream=codec_type,width,height','-of','json',input],10000));}
export function trimOptions(sourceDuration,options={}){
 const start=options.start===undefined?0:Number(options.start),end=options.end===undefined?sourceDuration:Number(options.end),cover=options.cover===undefined?start:Number(options.cover);
 if(![sourceDuration,start,end,cover].every(Number.isFinite)||sourceDuration<=0||sourceDuration>120.1||start<0||end>sourceDuration+.05||end<=start||end-start>15.05||cover<start||cover>end)throw new VideoError(400,'Chọn đoạn tối đa 15 giây, ảnh bìa nằm trong đoạn đã chọn. Video gốc tối đa 2 phút.');
 return{start,end,cover,duration:end-start,mute:options.mute===true||options.mute==='1'};
}
function outputArgs(output){return['-c:v','libx264','-preset','veryfast','-crf','23','-maxrate','1800k','-bufsize','3600k','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-ac','2','-threads','2','-movflags','+faststart','-map_metadata','-1','-map_chapters','-1','-y',output];}
async function posterAndData(output,poster,options,hasAudio){
 const offset=Math.max(0,Math.min(options.duration-.05,options.cover-options.start));
 await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-ss',String(offset),'-i',output,'-frames:v','1','-c:v','libwebp','-quality','85','-y',poster],15000);
 const [video,image]=await Promise.all([readFile(output),readFile(poster)]);
 if(video.length>VIDEO_OUTPUT_LIMIT)throw new VideoError(413,'Video sau xử lý vẫn lớn hơn 6 MB. Hãy chọn đoạn ngắn hơn.');
 return{video:'data:video/mp4;base64,'+video.toString('base64'),image:'data:image/webp;base64,'+image.toString('base64'),duration:options.duration,width:720,height:720,bytes:video.length,hasAudio:hasAudio&&!options.mute};
}
export async function prepareVideo(bytes,options={}){
 if(bytes.length>VIDEO_INPUT_LIMIT)throw new VideoError(413,'Chọn video nhỏ hơn 40 MB.');if(!mp4Header(bytes))throw new VideoError(400,'Chọn một tệp MP4 hợp lệ.');
 const dir=await mkdtemp(join(tmpdir(),'cham-video-'));
 try{
  const input=join(dir,'input.mp4'),output=join(dir,'square.mp4'),poster=join(dir,'poster.webp');await writeFile(input,bytes);const info=await probe(input),stream=info.streams?.find(s=>s.codec_type==='video');
  if(!stream||!stream.width||!stream.height||stream.width>4096||stream.height>4096)throw new VideoError(400,'Chọn MP4 có hình ảnh, độ phân giải tối đa 4K.');
  const opts=trimOptions(Number(info.format?.duration),options);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','file,pipe','-ss',String(opts.start),'-i',input,'-map','0:v:0',...(opts.mute?['-an']:['-map','0:a:0?']),'-t',String(opts.duration),'-vf','scale=632:632:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=720:720:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=24',...outputArgs(output)]);
  return await posterAndData(output,poster,opts,info.streams.some(s=>s.codec_type==='audio'));
 }finally{if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith('cham-video-'))await rm(dir,{recursive:true,force:true});}
}
export function boothSlots(slots,count){
 if(!Array.isArray(slots)||slots.length!==count||![2,3,4].includes(count))throw new VideoError(400,'Photobooth động cần từ 2 đến 4 clip.');
 const result=slots.map(s=>{if(!['x','y','width','height'].every(k=>Number.isFinite(s?.[k])))throw new VideoError(400,'Khung video không hợp lệ.');const b={x:Math.round(s.x),y:Math.round(s.y),width:Math.floor(s.width/2)*2,height:Math.floor(s.height/2)*2};if(b.x<0||b.y<0||b.width<20||b.height<20||b.x+b.width>720||b.y+b.height>720)throw new VideoError(400,'Khung video nằm ngoài ảnh.');return b;});
 for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const a=result[i],b=result[j];if(!(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y))throw new VideoError(400,'Các ô video không được chồng nhau.');}return result;
}
export async function prepareBooth(clips,frame,slots,options={}){
 const boxes=boothSlots(slots,clips.length),isLive=options.live===true||options.live==='1';
 if(clips.some(b=>!clipHeader(b))||clips.reduce((n,b)=>n+b.length,0)>VIDEO_INPUT_LIMIT)throw new VideoError(400,'Chọn 2 đến 4 clip MP4/WebM, tổng dung lượng tối đa 40 MB.');
 if(frame.length>1024*1024||frame.length<8||frame.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new VideoError(400,'Ảnh khung PNG không hợp lệ.');
 const requested=Number(options.duration||3),audio=Number(options.audio??-1);
 if(!Number.isFinite(requested)||requested<.25||requested>10||!Number.isInteger(audio)||audio<-1||audio>=clips.length)throw new VideoError(400,'Chọn thời lượng từ 0.25 đến 10 giây và một nguồn âm thanh.');
 const dir=await mkdtemp(join(tmpdir(),'cham-video-'));
 try{
  const inputs=[],infos=[],durations=[];for(let i=0;i<clips.length;i++){const ext=webmHeader(clips[i])?'webm':'mp4',input=join(dir,'clip-'+i+'.'+ext);await writeFile(input,clips[i]);const info=await probe(input),v=info.streams?.find(s=>s.codec_type==='video'),d=Number(info.format?.duration);if(!v||v.width>4096||v.height>4096||(Number.isFinite(d)&&(d>120.1||(!isLive&&d<requested-.1))))throw new VideoError(400,'Mỗi clip cần đủ dài cho đoạn ghép và không quá 2 phút, tối đa 4K.');if(Number.isFinite(d)&&d>0)durations.push(d);inputs.push(input);infos.push(info);}
  const duration=isLive&&durations.length?Math.max(.5,Math.min(requested,...durations)):requested;
  const overlay=join(dir,'frame.png'),output=join(dir,'booth.mp4'),poster=join(dir,'poster.webp');await writeFile(overlay,frame);
  const filters=[`color=c=white:s=720x720:r=24:d=${duration}[base]`];let last='base';
  boxes.forEach((b,i)=>{filters.push(`[${i}:v]setpts=PTS-STARTPTS,scale=${b.width}:${b.height}:force_original_aspect_ratio=increase,crop=${b.width}:${b.height},setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=2[v${i}]`);filters.push(`[${last}][v${i}]overlay=${b.x}:${b.y}:shortest=1[m${i}]`);last='m'+i;});
  filters.push(`[${last}][${clips.length}:v]overlay=0:0:shortest=1[out]`);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-nostdin','-filter_complex_threads','1',...inputs.flatMap(p=>['-protocol_whitelist','file,pipe','-i',p]),'-loop','1','-framerate','24','-i',overlay,'-filter_complex',filters.join(';'),'-map','[out]',...(audio<0?['-an']:['-map',audio+':a:0?']),'-t',String(duration),...outputArgs(output)],120000);
  return await posterAndData(output,poster,{duration,start:0,cover:0,mute:audio<0},audio>=0&&infos[audio].streams.some(s=>s.codec_type==='audio'));
 }finally{if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith('cham-video-'))await rm(dir,{recursive:true,force:true});}
}

let processing=false;
export async function handleVideoLocal(request){
  const url=new URL(request.url);
  if(url.pathname==='/api/video/status'&&request.method==='GET')return Response.json(await videoStatus(),{headers:{'Cache-Control':'no-store'}});
  if(!['/api/video/prepare','/api/video/booth'].includes(url.pathname))return null;
  if(request.method!=='POST')return Response.json({error:{message:'Phương thức không hợp lệ.'}},{status:405});
  if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return Response.json({error:{message:'Yêu cầu không hợp lệ.'}},{status:403});
  if(url.pathname==='/api/video/prepare'&&request.headers.get('Content-Type')?.split(';')[0]!=='video/mp4')return Response.json({error:{message:'Chọn một video MP4.'}},{status:415});
  if(processing)return Response.json({error:{message:'Một video khác đang được xử lý. Hãy thử lại sau.'}},{status:429});
  processing=true;
  try{if(Number(request.headers.get('content-length'))>VIDEO_INPUT_LIMIT+1024*1024)throw new VideoError(413,'Tổng video cần nhỏ hơn 40 MB.');let data;if(url.pathname==='/api/video/booth'){if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data'))throw new VideoError(415,'Chưa nhận được các clip photobooth.');const form=await request.formData(),files=form.getAll('clips'),frame=form.get('frame');if(![2,3,4].includes(files.length)||!frame?.arrayBuffer||files.some(f=>!f.arrayBuffer))throw new VideoError(400,'Chọn từ 2 đến 4 clip và khung.');let slots;try{slots=JSON.parse(String(form.get('slots')));}catch{throw new VideoError(400,'Các ô video chưa hợp lệ.');}data=await prepareBooth(await Promise.all(files.map(async f=>Buffer.from(await f.arrayBuffer()))),Buffer.from(await frame.arrayBuffer()),slots,{duration:Number(form.get('duration')),audio:Number(form.get('audio')),live:form.get('live')==='1'});}else data=await prepareVideo(Buffer.from(await request.arrayBuffer()),Object.fromEntries(url.searchParams));return Response.json(data,{headers:{'Cache-Control':'no-store'}});}
  catch(e){return Response.json({error:{code:'VIDEO_PREPARE_FAILED',message:e instanceof VideoError?e.message:'Không xử lý được video. Hãy thử clip khác.'}},{status:e instanceof VideoError?e.status:500});}
  finally{processing=false;}
}
