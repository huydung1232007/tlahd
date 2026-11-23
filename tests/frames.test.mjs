import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const context=vm.createContext({console});
vm.runInContext(await readFile(new URL('../public/frames.js',import.meta.url),'utf8'),context);
const frames=context.ChamFrames;
test('every frame leaves header and footer clear and keeps photo windows disjoint',()=>{
  assert.equal(new Set(frames.presets.map(p=>p.id)).size,7);
  for(const preset of frames.presets)for(const count of[3,4])for(const layout of['strip','grid']){
    const g=frames.geometry(count,layout,preset.id);
    assert.equal(g.slots.length,count);
    for(const [i,s]of g.slots.entries()){
      assert.ok(s.x>=g.padding&&s.y>=g.padding+g.header);
      assert.ok(s.x+s.width<=g.width-g.padding);
      assert.ok(s.y+s.height<=g.height-g.padding-g.footer);
      assert.ok(Math.abs(s.width/s.height-4/3)<.003);
      for(const other of g.slots.slice(i+1))assert.ok(s.x+s.width<=other.x||other.x+other.width<=s.x||s.y+s.height<=other.y||other.y+other.height<=s.y);
    }
  }
});
test('garden clips photograph to its oval; other frames preserve the full rectangle',()=>{
  const calls=[];const ctx={beginPath(){},ellipse(...args){calls.push(['oval',...args]);},rect(...args){calls.push(['rect',...args]);}};
  const slot={x:40,y:140,width:604,height:453};
  frames.slotPath(ctx,slot,'garden');assert.deepEqual(calls[0],['oval',342,366.5,302,226.5,0,0,Math.PI*2]);
  frames.slotPath(ctx,slot,'airmail');assert.deepEqual(calls[1],['rect',40,140,604,453]);
  assert.equal(frames.preset('unknown').id,'classic');
});
