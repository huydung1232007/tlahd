import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const localEnv=new URL('../.env.local',import.meta.url);
if(existsSync(localEnv))process.loadEnvFile(fileURLToPath(localEnv));
import http from 'node:http';
import {handleVideoLocal,VIDEO_INPUT_LIMIT} from './video.mjs';
import {randomBytes} from 'node:crypto';
const jsonError=(res,status,code,message)=>{if(res.headersSent)return res.end();res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({error:{code,message}}));};
export function createLocalListener(worker,env){
 return async(req,res)=>{const pathname=req.url?.split('?')[0]||'';try{const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);let body;if(!['GET','HEAD'].includes(req.method)){const isVideo=['/api/video/prepare','/api/video/booth'].includes(pathname),max=isVideo?VIDEO_INPUT_LIMIT+1024*1024:10*1024*1024,chunks=[];let length=0;for await(const c of req){length+=c.length;if(length>max){req.resume();jsonError(res,413,'TOO_LARGE',isVideo?'Tổng video cần nhỏ hơn 40 MB.':'Dữ liệu gửi lên quá lớn.');return;}chunks.push(c);}body=Buffer.concat(chunks);}const request=new Request('http://'+(req.headers.host||'127.0.0.1')+req.url,{method:req.method,headers,body});const response=await handleVideoLocal(request)||await worker.fetch(request,env,{});res.writeHead(response.status,{...Object.fromEntries(response.headers),...(process.env.CHAM_LOCAL_INSTANCE?{'X-Cham-Instance':process.env.CHAM_LOCAL_INSTANCE,'X-Cham-Build':process.env.CHAM_LOCAL_BUILD}:{})});res.end(Buffer.from(await response.arrayBuffer()));}catch{if(pathname.startsWith('/api/'))jsonError(res,500,'SERVER_ERROR','Máy chủ local gặp sự cố. Vui lòng thử lại.');else if(!res.headersSent)res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'}).end('Local server error');else res.end();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {default:worker}=await import(pathToFileURL(process.cwd()+'/dist/server/index.js').href);
 const env={CHAM_AI_PROVIDER:process.env.CHAM_AI_PROVIDER,CLOUDFLARE_ACCOUNT_ID:process.env.CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN:process.env.CLOUDFLARE_API_TOKEN,CLOUDFLARE_IMAGE_MODEL:process.env.CLOUDFLARE_IMAGE_MODEL,GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_IMAGE_MODEL:process.env.GEMINI_IMAGE_MODEL,CHAM_AI_OWNER_UID:process.env.CHAM_AI_OWNER_UID,CHAM_SESSION_SECRET:process.env.CHAM_SESSION_SECRET||randomBytes(32).toString('base64url')};
 http.createServer(createLocalListener(worker,env)).listen(Number(process.env.CHAM_PORT)||4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+(process.env.CHAM_PORT||4173)));
}
