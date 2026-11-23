import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {Readable} from 'node:stream';
import {prepareVideo,videoStatus,handleVideoLocal,VIDEO_INPUT_LIMIT} from '../scripts/video.mjs';
import {createLocalListener} from '../scripts/dev.mjs';
const exec=promisify(execFile);
test('local video endpoint rejects foreign origins and invalid MP4 before processing',async()=>{
  const base='http://127.0.0.1:4173';
  assert.equal((await handleVideoLocal(new Request(base+'/api/video/prepare',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'video/mp4'},body:'invalid'}))).status,403);
  assert.equal((await handleVideoLocal(new Request(base+'/api/video/prepare',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'}))).status,415);
  await assert.rejects(()=>prepareVideo(Buffer.from('not a video')),e=>e.status===400);
});
test('local HTTP listener returns valid JSON on 413 oversized uploads and 500 API errors',async()=>{
  const callListener=async(listener,url,method,chunkSize)=>{
    const req=Readable.from([Buffer.alloc(chunkSize)]);
    Object.assign(req,{url,method,headers:{host:'127.0.0.1:4175',origin:'http://127.0.0.1:4175','content-type':'video/mp4'},resume(){}});
    let status=0,headers={},body='';
    const res={headersSent:false,writeHead(s,h={}){status=s;headers=h;this.headersSent=true;return this;},end(chunk=''){body+=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);}};
    await listener(req,res);
    return{status,headers,data:JSON.parse(body)};
  };
  const okWorker={async fetch(){return new Response('{}',{status:200});}};
  const tooLarge=await callListener(createLocalListener(okWorker,{}),'/api/video/prepare','POST',VIDEO_INPUT_LIMIT+1024*1024+16);
  assert.equal(tooLarge.status,413);assert.equal(tooLarge.data.error.code,'TOO_LARGE');assert.match(tooLarge.data.error.message,/40 MB/);
  const brokenWorker={async fetch(){throw Error('boom');}};
  const failed=await callListener(createLocalListener(brokenWorker,{}),'/api/session','GET',0);
  assert.equal(failed.status,500);assert.equal(failed.data.error.code,'SERVER_ERROR');
});
test('FFmpeg prepares a real square H264 video with AAC audio and WebP poster',async t=>{
  if(!(await videoStatus()).available)return t.skip('FFmpeg/FFprobe not installed');
  const dir=await mkdtemp(join(tmpdir(),'cham-video-test-'));
  try{
    const input=join(dir,'input.mp4');
    await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=15','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',input],{windowsHide:true,timeout:30000});
    const data=await prepareVideo(await readFile(input));assert.equal(data.width,720);assert.equal(data.height,720);assert.equal(data.hasAudio,true);assert.ok(data.duration>=1.9&&data.duration<2.2);assert.ok(data.bytes<6*1024*1024);assert.match(data.image,/^data:image\/webp;base64,/);
    const output=join(dir,'output.mp4');await writeFile(output,Buffer.from(data.video.slice(22),'base64'));
    const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height','-of','json',output],{windowsHide:true})).stdout);
    assert.ok(probe.streams.some(s=>s.codec_name==='h264'&&s.width===720&&s.height===720));assert.ok(probe.streams.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'));
    // Duration is checked on the server, not just trusted from the browser.
    const long=join(dir,'long.mp4');await exec('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=64x64:r=1','-t','16','-c:v','libx264','-y',long],{windowsHide:true,timeout:30000});
    await assert.rejects(()=>readFile(long).then(prepareVideo),e=>e.status===400&&e.message.includes('15 giây'));
  }finally{if(dirname(resolve(dir))===resolve(tmpdir())&&basename(dir).startsWith('cham-video-test-'))await rm(dir,{recursive:true,force:true});}
});
