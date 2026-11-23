import test from 'node:test';import assert from 'node:assert/strict';import{execFile}from'node:child_process';import{promisify}from'node:util';import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join,dirname,resolve,basename}from'node:path';
import{trimOptions,boothSlots,prepareBooth,prepareVideo,videoStatus}from'../scripts/video.mjs';const exec=promisify(execFile);
test('video trim validates actual range, cover, source duration and mute',()=>{
 assert.deepEqual(trimOptions(60,{start:20,end:30,cover:25,mute:'1'}),{start:20,end:30,cover:25,duration:10,mute:true});
 for(const value of[{start:-1,end:10},{start:5,end:22},{start:5,end:10,cover:11},{start:'NaN',end:10}])assert.throws(()=>trimOptions(60,value));assert.throws(()=>trimOptions(200,{start:0,end:10}));
 assert.throws(()=>boothSlots([{x:0,y:0,width:200,height:200},{x:10,y:10,width:200,height:200},{x:450,y:450,width:200,height:200}],3));
 assert.throws(()=>boothSlots([{x:-1,y:0,width:200,height:200}],1));
});
test('real motion booth preserves all three clip colors and chosen audio; muted trim has no audio',async t=>{
 if(!(await videoStatus()).available)return t.skip('FFmpeg not installed');const dir=await mkdtemp(join(tmpdir(),'cham-video-test-'));
 try{
  const clips=[];for(const [i,color]of['red','green','blue'].entries()){const p=join(dir,'clip'+i+'.mp4');await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c='+color+':s=160x120:r=12','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',p],{windowsHide:true,timeout:15000});clips.push(await readFile(p));}
  const slots=[{x:60,y:70,width:600,height:150},{x:60,y:270,width:600,height:150},{x:60,y:470,width:600,height:150}],png=join(dir,'frame.png');const filter='format=rgba,'+slots.map(s=>`drawbox=x=${s.x}:y=${s.y}:w=${s.width}:h=${s.height}:color=black@0:t=fill:replace=1`).join(',');
  await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=white:s=720x720','-vf',filter,'-frames:v','1','-threads','1','-y',png],{windowsHide:true,timeout:15000});
  const motion=await prepareBooth(clips,await readFile(png),slots,{duration:1,audio:0});assert.equal(motion.duration,1);assert.equal(motion.hasAudio,true);assert.ok(motion.bytes<6*1024*1024);
  const poster=join(dir,'poster.webp');await writeFile(poster,Buffer.from(motion.image.slice(23),'base64'));
  const values=[];for(const y of[145,345,545]){const result=await exec('ffmpeg',['-hide_banner','-loglevel','error','-i',poster,'-vf',`crop=2:2:360:${y}`,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,encoding:'buffer'});values.push([...result.stdout.subarray(0,3)]);}
  assert.ok(values[0][0]>200&&values[0][1]<40&&values[0][2]<40,'first clip should be red');assert.ok(values[1][1]>90&&values[1][0]<40&&values[1][2]<40,'second clip should be green');assert.ok(values[2][2]>200&&values[2][0]<40&&values[2][1]<40,'third clip should be blue');
  const muted=await prepareVideo(clips[0],{start:.5,end:1.5,cover:1,mute:true});assert.equal(muted.duration,1);assert.equal(muted.hasAudio,false);const out=join(dir,'muted.mp4');await writeFile(out,Buffer.from(muted.video.slice(22),'base64'));const info=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','stream=codec_type','-of','json',out],{windowsHide:true})).stdout);assert.ok(!info.streams.some(s=>s.codec_type==='audio'));
 }finally{if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith('cham-video-test-'))await rm(dir,{recursive:true,force:true});}
});
test('2-cut horizontal Live Photobooth accepts WebM camera recordings and outputs 720x720 MP4',async t=>{
 if(!(await videoStatus()).available)return t.skip('FFmpeg not installed');const dir=await mkdtemp(join(tmpdir(),'cham-video-test-'));
 try{
  const clips=[];
  for(const [i,color]of['red','blue'].entries()){
   const p=join(dir,'live'+i+'.webm');
   await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c='+color+':s=160x120:r=12','-t','1.5','-c:v','libvpx','-b:v','300k','-an','-y',p],{windowsHide:true,timeout:20000});
   clips.push(await readFile(p));
  }
  const slots=[{x:50,y:210,width:296,height:222},{x:374,y:210,width:296,height:222}],png=join(dir,'frame2.png');
  const filter='format=rgba,'+slots.map(s=>`drawbox=x=${s.x}:y=${s.y}:w=${s.width}:h=${s.height}:color=black@0:t=fill:replace=1`).join(',');
  await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=white:s=720x720','-vf',filter,'-frames:v','1','-threads','1','-y',png],{windowsHide:true,timeout:15000});
  const motion=await prepareBooth(clips,await readFile(png),slots,{duration:2,audio:-1,live:true});
  assert.equal(motion.width,720);assert.equal(motion.height,720);assert.equal(motion.hasAudio,false);
  assert.match(motion.video,/^data:video\/mp4;base64,/);
  const poster=join(dir,'poster2.webp');await writeFile(poster,Buffer.from(motion.image.slice(23),'base64'));
  const left=[...(await exec('ffmpeg',['-hide_banner','-loglevel','error','-i',poster,'-vf','crop=2:2:190:320','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,encoding:'buffer'})).stdout.subarray(0,3)];
  const right=[...(await exec('ffmpeg',['-hide_banner','-loglevel','error','-i',poster,'-vf','crop=2:2:520:320','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{windowsHide:true,encoding:'buffer'})).stdout.subarray(0,3)];
  assert.ok(left[0]>180&&left[2]<50,'left WebM slot should be red');
  assert.ok(right[2]>180&&right[0]<50,'right WebM slot should be blue');
 }finally{if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith('cham-video-test-'))await rm(dir,{recursive:true,force:true});}
});
