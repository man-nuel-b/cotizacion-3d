'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Bridge=require('../core/model-cost-bridge');
const State=require('../core/project-state');
test('editar una ventana recalcula área neta y precio en la misma revisión',()=>{
 const store=Bridge.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,offset:0,bottom:1});
 const id=store.getState().openings[0].id;
 const before=store.getProjection(),events=[];
 store.subscribe((state,action,view)=>events.push({rev:state.revision,projected:view.revision,action:action.type}));
 const after=store.dispatch({type:'opening/update',id,width:'1.4',height:'1.2',offset:'0.2',bottom:'0.7'});
 assert.equal(after.openings[0].width,1.4);
 assert.equal(after.openings[0].height,1.2);
 assert.equal(after.revision,before.revision+1);
 assert.equal(store.getProjection().revision,after.revision);
 assert.equal(store.getProjection().bom.metrics.openingArea,1.68);
 assert.equal(store.getProjection().quote.lines.find(x=>x.code==='WINDOW').qty,1);
 assert.notEqual(store.getProjection().quote.total,before.quote.total);
 assert.deepEqual(events,[{rev:2,projected:2,action:'opening/update'}]);
});
test('edición de abertura inválida o superpuesta no afecta estado ni precios',()=>{
 const store=Bridge.createStore();
 store.dispatch({type:'opening/add',kind:'window',face:'A',width:1,height:1,bottom:1,offset:-1});
 store.dispatch({type:'opening/add',kind:'door',face:'A',width:.8,height:2,bottom:0,offset:1});
 const original=store.getState(),view=store.getProjection(),id=original.openings[0].id;
 for(const bad of [{width:'0'},{height:''},{width:'Infinity'},{width:2,offset:1},{bottom:5}]){
  assert.throws(()=>store.dispatch({type:'opening/update',id,...bad}));
  assert.deepEqual(store.getState(),original);
  assert.deepEqual(store.getProjection(),view);
 }
});
test('editar dimensiones de tabique recalcula m² sin otra fuente de verdad',()=>{
 const store=Bridge.createStore();
 store.dispatch({type:'partition/add',length:2,height:2,x:0,z:0,thickness:.08});
 const id=store.getState().partitions[0].id;
 const before=store.getProjection();
 const state=store.dispatch({type:'partition/update',id,length:'3',height:'2.3',x:'-.2',z:'0'});
 const view=store.getProjection();
 assert.equal(state.partitions[0].length,3);
 assert.equal(view.bom.lines.find(x=>x.code==='PARTITION').qty,13.8);
 assert.ok(view.quote.total>before.quote.total);
 assert.equal(view.revision,state.revision);
 const original=store.getState(),quote=store.getProjection();
 assert.throws(()=>store.dispatch({type:'partition/update',id,length:-2}),/inválido/);
 assert.deepEqual(store.getState(),original);
 assert.deepEqual(store.getProjection(),quote);
});
test('un listener fallido no cancela una modificación ni bloquea otros listeners',()=>{
 const events=[];
 const store=State.createStore(State.defaults(),{onListenerError:(error,action)=>events.push('error:'+action.type+':'+error.message)});
 store.subscribe(()=>{throw Error('render falló');});
 store.subscribe(s=>events.push('backup:'+s.revision));
 const next=store.dispatch({type:'project/rename',name:'Aprobado'});
 assert.equal(next.project.name,'Aprobado');
 assert.equal(next.revision,1);
 assert.deepEqual(events,['error:project/rename:render falló','backup:1']);
});
