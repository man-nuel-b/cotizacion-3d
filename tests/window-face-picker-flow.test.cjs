'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const SOURCE=fs.readFileSync(path.join(__dirname,'..','faces-mounted.js'),'utf8');
function buildHarness(options={}){
  const state={
    container:'20hc',
    counts:{window:2,door:1,ac:0,electrical:0},
    layout:{window:[{face:'B',x:-2.31},{face:'B',x:2.31}],
      door:[{face:options.blockEnd?'C':'A',x:0}],ac:[],electrical:[]}
  };
  let rendered=0;
  const notifications=[];
  const classes=new Set(['hidden']);
  const modal={classList:{add(name){classes.add(name)},remove(name){classes.delete(name)}}};
  const feedback={textContent:''};
  const title={textContent:''},description={textContent:''};
  const fakeElements={
    'face-ui-style':{},
    'mounted-face-modal':modal,
    'mounted-face-title':title,
    'mounted-face-desc':description,
    'mounted-face-feedback':feedback,
    'face-label-toggle':{}
  };
  const document={
    getElementById(id){return fakeElements[id]||null},
    querySelector(){return null},
    createElement(){throw new Error('unexpected DOM creation in harness')}
  };
  const ctx={
    window:{},document,
    DATA:{containers:{'20hc':{length:6.06,width:2.44,height:2.89}},extras:{window:{max:8},door:{max:6},ac:{max:4},electrical:{max:24}}},
    state,
    originalAdjustCount(){throw new Error('unexpected fallback for mounted item')},
    defaultWallX(index,count,length,padding){if(count<=1)return 0;const usable=Math.max(.1,length-2*padding);return -usable/2+usable*index/(count-1)},
    pushHistory(){},
    renderAll(){rendered++},
    focusFace(){},
    toast(message){notifications.push(message)},
    selectedEditable:null,
    console
  };
  vm.createContext(ctx);
  vm.runInContext(SOURCE,ctx,{filename:'faces-mounted.js'});
  return {ctx,state,classes,feedback,title,description,notifications,get rendered(){return rendered}};
}
test('Window selection opens face picker and does not add a window until A/B/C/D selection',()=>{
  const h=buildHarness();
  h.ctx.adjustCount('window',1);
  assert.equal(h.state.counts.window,2);
  assert.ok(h.classes.has('flex'));
  assert.ok(!h.classes.has('hidden'));
  assert.match(h.title.textContent,/ventana/i);
  h.ctx.addMountedToFace('A');
  assert.equal(h.state.counts.window,3);
  assert.equal(h.state.layout.window[2].face,'A');
  assert.equal(h.rendered,1);
  assert.ok(h.classes.has('hidden'));
});
test('Legacy Ventana action shares face modal and cannot silently fail due to removed legacy modal',()=>{
  const h=buildHarness();
  h.ctx.openWindowFacePicker();
  assert.equal(h.state.counts.window,2);
  assert.ok(h.classes.has('flex'));
  h.ctx.addWindowToFace('D');
  assert.equal(h.state.counts.window,3);
  assert.equal(h.state.layout.window[2].face,'D');
  assert.equal(h.rendered,1);
});
test('Rejected face shows persistent reason and does not add; selecting valid face succeeds',()=>{
  const h=buildHarness({blockEnd:true});
  h.ctx.adjustCount('window',1);
  h.ctx.addMountedToFace('C'); // 2.44 m end wall already contains a centered pedestrian door
  assert.equal(h.state.counts.window,2);
  assert.equal(h.rendered,0);
  assert.match(h.feedback.textContent,/No hay espacio suficiente/i);
  assert.ok(h.classes.has('flex'));
  h.ctx.addMountedToFace('D');
  assert.equal(h.state.counts.window,3);
  assert.equal(h.state.layout.window[2].face,'D');
  assert.equal(h.rendered,1);
});
test('Both picker implementations close consistently without adding a window',()=>{
  const h=buildHarness();
  h.ctx.openWindowFacePicker();
  h.ctx.closeWindowFacePicker();
  assert.equal(h.state.counts.window,2);
  assert.ok(h.classes.has('hidden'));
});
