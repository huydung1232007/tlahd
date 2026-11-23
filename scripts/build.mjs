import {readFile,mkdir,writeFile} from 'node:fs/promises';
const assets={};
for(const file of ['index.html','style.css','frames.css','app.js','studio.js','frames.js','locket-image.js','video.js','video.css','drafts.js','edit-core.js','photo-editor.js','studio-tools.js','editor.css','motion-frame.js','icon.svg'])assets['/'+(file==='index.html'?'':file)]={body:await readFile(new URL('../public/'+file,import.meta.url),'utf8'),type:({'index.html':'text/html','style.css':'text/css','frames.css':'text/css','app.js':'text/javascript','studio.js':'text/javascript','frames.js':'text/javascript','locket-image.js':'text/javascript','video.js':'text/javascript','video.css':'text/css','drafts.js':'text/javascript','edit-core.js':'text/javascript','photo-editor.js':'text/javascript','studio-tools.js':'text/javascript','editor.css':'text/css','motion-frame.js':'text/javascript','icon.svg':'image/svg+xml'})[file]+'; charset=utf-8'};
const template=await readFile(new URL('../worker/index.mjs',import.meta.url),'utf8');
await mkdir(new URL('../dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/server/index.js',import.meta.url),template.replace('/*CHAM_ASSETS*/{}',JSON.stringify(assets)));
console.log('Built self-contained Worker with 16 frontend assets.');
