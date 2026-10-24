// Opening system integration with interior cladding and editor close behavior.
// Does not wrap rebuild3D: it reuses the existing opening list from windowsForFace().
(function(){
  if(window.BAT_KUBIQUEITOR_OPENING_INTERIOR_INTEGRATION) return;

  function ready(){
    return Boolean(
      window.BAT_KUBIQUEITOR_OPENING_SYSTEM&&
      typeof THREE!=='undefined'&&typeof state!=='undefined'&&typeof DATA!=='undefined'&&
      typeof ensureInteriorSystem==='function'&&typeof interiorSystemMaterial==='function'&&
      typeof windowsForFace==='function'&&typeof box==='function'&&typeof rebuild3D==='function'
    );
  }

  function clamp(v,min,max){return Math.min(max,Math.max(min,v));}

  function mergedIntervals(intervals,min,max){
    const sorted=intervals
      .map(([a,b])=>[Math.max(min,a),Math.min(max,b)])
      .filter(([a,b])=>b-a>.001)
      .sort((a,b)=>a[0]-b[0]);
    const out=[];
    sorted.forEach(pair=>{
      const last=out[out.length-1];
      if(!last||pair[0]>last[1]+.001) out.push(pair.slice());
      else last[1]=Math.max(last[1],pair[1]);
    });
    return out;
  }

  function openings(face,c){
    try{return windowsForFace(face,c)||[];}catch(e){return [];}
  }

  function addSegmentedWall(group,{axis,axisMin,axisMax,yMin,yMax,position,thickness,material,openingList}){
    const breaks=[axisMin,axisMax];
    openingList.forEach(open=>{
      const center=Number(open.center)||0,width=Math.max(0,Number(open.width)||0);
      breaks.push(clamp(center-width/2,axisMin,axisMax));
      breaks.push(clamp(center+width/2,axisMin,axisMax));
    });
    const points=[...new Set(breaks.map(v=>Number(v.toFixed(4))))].sort((a,b)=>a-b);

    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1];
      if(b-a<.002) continue;
      const mid=(a+b)/2;
      const blocked=mergedIntervals(
        openingList
          .filter(open=>{
            const center=Number(open.center)||0,width=Math.max(0,Number(open.width)||0);
            return mid>center-width/2+.0005&&mid<center+width/2-.0005;
          })
          .map(open=>[
            Number.isFinite(Number(open.bottom))?Number(open.bottom):yMin,
            Number.isFinite(Number(open.top))?Number(open.top):yMax
          ]),
        yMin,yMax
      );

      let cursor=yMin;
      const addPiece=(low,high)=>{
        if(high-low<.002) return;
        const span=b-a,height=high-low,center=(a+b)/2,y=(low+high)/2;
        if(axis==='x') group.add(box(span,height,thickness,material,center,y,position));
        else group.add(box(thickness,height,span,material,position,y,center));
      };
      blocked.forEach(([low,high])=>{addPiece(cursor,low);cursor=Math.max(cursor,high);});
      addPiece(cursor,yMax);
    }
  }

  function installInteriorCut(){
    addInteriorCladdingVisuals=function(){
      if(!containerGroup) return;
      const s=ensureInteriorSystem(),c=DATA.containers[state.container];
      const L=c.length,W=c.width,H=c.height,lining=interiorSystemMaterial(),th=.018;
      const g=new THREE.Group();
      g.name='interior-cladding-system';
      const yMin=.15,yMax=H-.15;

      if(s.liningFaces.B) addSegmentedWall(g,{axis:'x',axisMin:-L/2+.15,axisMax:L/2-.15,yMin,yMax,position:-W/2+.082,thickness:th,material:lining,openingList:openings('B',c)});
      if(s.liningFaces.A&&!state.cutaway) addSegmentedWall(g,{axis:'x',axisMin:-L/2+.15,axisMax:L/2-.15,yMin,yMax,position:W/2-.082,thickness:th,material:lining,openingList:openings('A',c)});
      if(s.liningFaces.D) addSegmentedWall(g,{axis:'z',axisMin:-W/2+.15,axisMax:W/2-.15,yMin,yMax,position:-L/2+.095,thickness:th,material:lining,openingList:openings('D',c)});
      if(s.liningFaces.C) addSegmentedWall(g,{axis:'z',axisMin:-W/2+.15,axisMax:W/2-.15,yMin,yMax,position:L/2-.095,thickness:th,material:lining,openingList:openings('C',c)});
      if(s.liningFaces.E&&!state.cutaway) g.add(box(L-.30,th,W-.30,lining,0,H-.085,0));
      containerGroup.add(g);
    };
  }

  function installEditorClose(){
    const panel=document.getElementById('object-editor');
    if(!panel) return;
    const close=[...panel.querySelectorAll('button')].find(btn=>btn.querySelector('.fa-xmark'));
    if(!close) return;
    close.onclick=function(event){
      event?.preventDefault?.();
      if(typeof selectEditable==='function') selectEditable(null);
      else if(typeof selectedEditable!=='undefined') selectedEditable=null;
      if(typeof hideEditorPanel==='function') hideEditorPanel();
      if(typeof rebuild3D==='function') rebuild3D();
    };
  }

  function install(){
    if(!ready()) return false;
    installInteriorCut();
    installEditorClose();
    window.BAT_KUBIQUEITOR_OPENING_INTERIOR_INTEGRATION={version:1};
    rebuild3D();
    return true;
  }

  if(!install()){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(install()||tries>=160) clearInterval(timer);
    },80);
  }
})();