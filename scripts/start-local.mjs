import {spawn,spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),statePath=new URL('../.local-server.json',import.meta.url);
const port=Number(process.env.CHAM_PORT)||4173,url='http://127.0.0.1:'+port;
async function probe(){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});return{app:r.ok&&(await r.text()).includes('<title>Chạm'),instance:r.headers.get('x-cham-instance'),build:r.headers.get('x-cham-build')};}catch{return null;}}
let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{}
try{
 const current=await probe(),owned=current?.app&&current.instance&&current.instance===state?.instance&&state.port===port&&Number.isInteger(state.pid);
 if(process.argv.includes('--stop')){if(owned){process.kill(state.pid);console.log('Da dung Cham local.');}else console.log('Khong co may chu Cham do launcher nay quan ly.');}
 else{
  const built=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'inherit',windowsHide:true});if(built.status!==0)throw Error('Build failed');
  const build=createHash('sha256').update(await readFile(new URL('../dist/server/index.js',import.meta.url))).digest('hex');
  if(current&&!current.app)throw Error('Cong '+port+' dang duoc ung dung khac su dung.');
  if(current?.app&&current.build!==build){if(!owned)throw Error('Hay dong cua so Cham cu roi mo lai start-local.cmd.');process.kill(state.pid);await new Promise(resolve=>setTimeout(resolve,400));}
  if(!current||current.build!==build){
   const instance=randomUUID(),out=openSync(new URL('../.local-server.out.log',import.meta.url),'a'),err=openSync(new URL('../.local-server.err.log',import.meta.url),'a');
   const child=spawn(process.execPath,[fileURLToPath(new URL('./dev.mjs',import.meta.url))],{cwd:root,env:{...process.env,CHAM_PORT:String(port),CHAM_LOCAL_INSTANCE:instance,CHAM_LOCAL_BUILD:build},detached:true,windowsHide:true,stdio:['ignore',out,err]});closeSync(out);closeSync(err);let failure=null;child.on('error',e=>failure=e);child.unref();
   await writeFile(statePath,JSON.stringify({pid:child.pid,instance,port}));
   let ready=false;for(let i=0;i<40;i++){if(failure)throw failure;const p=await probe();if(p?.app&&p.instance===instance){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}
   if(!ready)throw Error('Chua khoi dong duoc may chu. Xem .local-server.err.log trong thu muc Cham.');
  }
  console.log('Cham dang chay tai '+url+' . Dung app bang stop-local.cmd.');
  if(!process.argv.includes('--no-browser')){
   const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
   const args=process.platform==='win32'?['/d','/c','start','',url]:[url];
   const opened=spawn(command,args,{stdio:'ignore',detached:true,windowsHide:true});opened.on('error',()=>console.log('Mo trinh duyet va truy cap '+url));opened.unref();
  }
 }
}catch(e){console.error(e.message);process.exitCode=1;}
