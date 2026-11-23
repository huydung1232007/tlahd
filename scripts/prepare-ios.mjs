import {mkdir,readdir,readFile,rm,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const pubDir=join(root,'public');
const outDir=join(root,'ios-build','www');

await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

const entries=await readdir(pubDir);
for(const name of entries){
  if(name.startsWith('.env')||name.endsWith('.log'))throw Error('Refusing to bundle secret or log file: '+name);
  await copyFile(join(pubDir,name),join(outDir,name));
}
await copyFile(join(root,'ios','ios-bridge.js'),join(outDir,'ios-bridge.js'));

const html=await readFile(join(outDir,'index.html'),'utf8');
const injected=html.replace('<script src="./drafts.js"></script>','<script src="./ios-bridge.js"></script><script src="./drafts.js"></script>');
await writeFile(join(outDir,'index.html'),injected,'utf8');
console.log('Prepared standalone iOS web bundle in ios-build/www with ios-bridge.js.');
