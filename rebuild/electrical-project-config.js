export const ELECTRICAL_PROFILES = Object.freeze({
  basico:{label:'Básico',circuits:2,outletsPerRoom:2,lightsPerRoom:1,switchesPerRoom:1,cableFactor:1.25,laborHoursPerPoint:.45},
  estandar:{label:'Estándar',circuits:3,outletsPerRoom:4,lightsPerRoom:2,switchesPerRoom:1,cableFactor:1.30,laborHoursPerPoint:.55},
  galpon_industrial:{label:'Galpón / taller',circuits:4,outletsPerRoom:3,lightsPerRoom:3,switchesPerRoom:1,cableFactor:1.35,laborHoursPerPoint:.65}
});

// La configuración eléctrica es geométrica; la estimación APU permanece separada.
export function defaultElectricalConfig() {
  return { profile:'estandar', rooms:1, show:true, points:[] };
}
export const ELECTRICAL_POINT_SIZES=Object.freeze({
  outlet:[.11,.12], switch:[.11,.12], light:[.35,.15], board:[.35,.45]
});
export const ELECTRICAL_MOUNTS=Object.freeze(['wall','partition','ceiling']);
export const ELECTRICAL_SNAP_MM=Object.freeze([1,10,50,100]);

export function snapElectricalCoordinate(valueM,stepMM=1) {
  if(!Number.isFinite(valueM)||!ELECTRICAL_SNAP_MM.includes(Number(stepMM))) throw Error('Coordenada o ajuste magnético inválidos');
  const rounded=Math.round(valueM*1000/stepMM)*stepMM/1000;
  return Object.is(rounded,-0)?0:rounded;
}

function surfaceKey(p) {
  const mount=p.mount||'wall';
  return mount==='partition' ? 'partition:'+p.partitionId+':'+p.face : mount==='ceiling' ? 'ceiling' : 'wall:'+p.face;
}

/** Retorna un error legible, o null cuando el punto cabe sin atravesar vanos ni otro punto. */
export function validateElectricalPoint(p,dims,openings=[],partitions=dims.partitions||[],priorPoints=[],interiorDoors=dims.interiorDoors||[]) {
  if(!p||typeof p!=='object')return 'Punto eléctrico inválido';
  const mount=p.mount||'wall',size=ELECTRICAL_POINT_SIZES[p.type];
  if(!size||!ELECTRICAL_MOUNTS.includes(mount)||!Number.isFinite(p.u)||!Number.isFinite(p.v)) {
    return 'Tipo o coordenadas eléctricas inválidas';
  }
  let span,height,marginU=.15,marginV=.10;
  if(mount==='wall'){
    if(!['A','B','C','D'].includes(p.face))return 'Cara de muro inválida';
    span=(p.face==='A'||p.face==='C')?dims.L:dims.W;
    height=dims.H;
  }else if(mount==='partition'){
    if(!['A','B'].includes(p.face)||typeof p.partitionId!=='string')return 'Cara o tabique anfitrión inválido';
    const host=partitions.find(x=>x.id===p.partitionId);
    if(!host||!['x','z'].includes(host.axis))return 'Tabique anfitrión inexistente';
    span=host.length;height=host.height;
    for(const door of interiorDoors){
      if(door.partitionId!==host.id)continue;
      const pad=.055;
      if(p.u+size[0]/2+pad>door.u&&p.u-size[0]/2-pad<door.u+door.w&&
         p.v+size[1]/2+pad>0&&p.v-size[1]/2-pad<door.h) return 'Punto eléctrico invade una puerta del tabique';
    }
  }else{
    if(p.type!=='light'||p.face!=='roof')return 'Solo luminarias pueden instalarse en cielo';
    span=dims.L;height=dims.W;marginU=.12;marginV=.12;
  }
  if(!Number.isFinite(span)||!Number.isFinite(height)||
     p.u<size[0]/2+marginU||p.u>span-size[0]/2-marginU||
     p.v<size[1]/2+marginV||p.v>height-size[1]/2-marginV)
    return 'Punto eléctrico fuera de los márgenes seguros';
  if(mount==='wall') for(const o of openings){
    if(o.face!==p.face)continue;
    const pad=.055;
    if(p.u+size[0]/2+pad>o.u&&p.u-size[0]/2-pad<o.u+o.w&&
       p.v+size[1]/2+pad>o.v&&p.v-size[1]/2-pad<o.v+o.h) {
      return 'Punto eléctrico invade una abertura';
    }
  }
  for(const q of priorPoints){
    if(q.id===p.id||surfaceKey(q)!==surfaceKey(p))continue;
    const other=ELECTRICAL_POINT_SIZES[q.type];
    if(!other)continue;
    if(Math.abs(p.u-q.u)<(size[0]+other[0])/2+.05&&
       Math.abs(p.v-q.v)<(size[1]+other[1])/2+.05)return 'Puntos eléctricos solapados';
  }
  return null;
}

/** Geometría pura (m) compartida por render y editor. */
export function electricalPointWorld(p,dims,floor=.14) {
  const mount=p.mount||'wall';
  if(mount==='ceiling') return [p.u-dims.L/2,floor+dims.H-.045,p.v-dims.W/2];
  if(mount==='partition'){
    const host=(dims.partitions||[]).find(x=>x.id===p.partitionId);
    if(!host)return null;
    const side=p.face==='A'?1:-1,offset=host.thickness/2+.034;
    if(host.axis==='x')return [host.cx-host.length/2+p.u,floor+p.v,host.cz+side*offset];
    return [host.cx+side*offset,floor+p.v,host.cz-host.length/2+p.u];
  }
  const len=(p.face==='A'||p.face==='C')?dims.L:dims.W;
  const along=p.u-len/2,y=floor+p.v,offset=.095;
  if(p.face==='A')return [along,y,dims.W/2-offset];
  if(p.face==='B')return [dims.L/2-offset,y,-along];
  if(p.face==='C')return [-along,y,-dims.W/2+offset];
  if(p.face==='D')return [-dims.L/2+offset,y,along];
  return null;
}

export function sanitizeElectricalConfig(raw,dims,openings=[],partitions=dims.partitions||[],interiorDoors=dims.interiorDoors||[]) {
  if(raw===undefined||raw===null)return defaultElectricalConfig();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Configuración eléctrica inválida');
  const profile=raw.profile??'estandar',rooms=raw.rooms??1,show=raw.show??true;
  if(!Object.hasOwn(ELECTRICAL_PROFILES,profile))throw Error('Perfil eléctrico inválido');
  if(!Number.isInteger(rooms)||rooms<1||rooms>200)throw Error('Cantidad de recintos eléctricos inválida');
  if(typeof show!=='boolean')throw Error('Visibilidad eléctrica inválida');
  const source=raw.points??[];
  if(!Array.isArray(source)||source.length>200)throw Error('Lista de puntos eléctricos inválida');
  const ids=new Set(),points=[];
  for(const rawPoint of source){
    if(!rawPoint||typeof rawPoint!=='object'||Array.isArray(rawPoint))throw Error('Punto eléctrico inválido');
    const {id,type,face,u,v}=rawPoint,mount=rawPoint.mount||'wall';
    if(typeof id!=='string'||!/^el-[1-9]\d*$/.test(id)||ids.has(id)||
       !Object.hasOwn(ELECTRICAL_POINT_SIZES,type)||
       !Number.isFinite(u)||!Number.isFinite(v)) {
      throw Error('Identificador o coordenadas eléctricas inválidas');
    }
    const p={id,type,face,u,v};
    // No reescribir el esquema JSON de respaldos antiguos (mount omitido = muro).
    if(rawPoint.mount!==undefined)p.mount=mount;
    if(mount==='partition')p.partitionId=rawPoint.partitionId;
    const issue=validateElectricalPoint(p,dims,openings,partitions,points,interiorDoors);
    if(issue)throw Error(issue);
    ids.add(id);points.push(p);
  }
  return {profile,rooms,show,points};
}
