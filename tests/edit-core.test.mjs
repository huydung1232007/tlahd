import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';
const context=vm.createContext({});vm.runInContext(await readFile(new URL('../public/edit-core.js',import.meta.url),'utf8'),context);const core=context.ChamEdits;
test('photo crop preserves target ratio and never samples outside the original at zoom/pan extremes',()=>{
 for(const[iw,ih]of[[1600,900],[900,1600],[100,100]])for(const zoom of[1,1.5,3])for(const x of[-1,0,1])for(const y of[-1,0,1]){const b=core.sourceBox(iw,ih,604,453,{zoom,x,y});assert.ok(b.x>=-1e-8&&b.y>=-1e-8);assert.ok(b.x+b.width<=iw+1e-8&&b.y+b.height<=ih+1e-8);assert.ok(Math.abs(b.width/b.height-604/453)<1e-10);}
 assert.equal(core.crop({zoom:100,x:5,y:-8}).zoom,3);assert.throws(()=>core.sourceBox(0,100,100,100));
});
test('frame labels are bounded and video cover must remain inside the selected segment',()=>{
 assert.equal(core.custom({title:'x'.repeat(100)}).title.length,32);assert.equal(core.custom({message:'x'.repeat(100)}).message.length,60);assert.equal(core.custom({date:'invalid'}).date,'');assert.equal(core.trim(90,30,45,40).duration,15);
 for(const args of[[90,0,20,2],[90,20,30,2],[90,-1,4,2],[90,80,91,85]])assert.throws(()=>core.trim(...args));
});
