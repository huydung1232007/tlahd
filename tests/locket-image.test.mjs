import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../public/locket-image.js',import.meta.url),'utf8'),context);
const {placement}=context.ChamLocketImage;
test('long photostrips, landscape grids and square photos fit completely inside the square',()=>{
  for(const [w,h]of [[684,2184],[684,1709],[1022,1018],[2000,500],[1200,1200]]){
    const b=placement(w,h);
    assert.ok(Math.abs(b.width/b.height-w/h)<1e-12,'must preserve original proportions');
    assert.ok(b.x>=71.99&&b.y>=71.99,'leave room for rounded Locket corners');
    assert.ok(b.x+b.width<=1128.01&&b.y+b.height<=1128.01);
    assert.ok(Math.abs(b.x*2+b.width-1200)<1e-9&&Math.abs(b.y*2+b.height-1200)<1e-9,'center both axes');
    assert.ok(Math.abs(Math.max(b.width,b.height)-1056)<1e-9);
  }
  for(const args of [[0,10],[10,NaN],[10,Infinity],[-2,10],[10,10,1200,.5]])assert.throws(()=>placement(...args));
});
