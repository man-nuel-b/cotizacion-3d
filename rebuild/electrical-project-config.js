export const ELECTRICAL_PROFILES = Object.freeze({
  basico:{label:'Básico',circuits:2,outletsPerRoom:2,lightsPerRoom:1,switchesPerRoom:1,cableFactor:1.25,laborHoursPerPoint:.45},
  estandar:{label:'Estándar',circuits:3,outletsPerRoom:4,lightsPerRoom:2,switchesPerRoom:1,cableFactor:1.30,laborHoursPerPoint:.55},
  galpon_industrial:{label:'Galpón / taller',circuits:4,outletsPerRoom:3,lightsPerRoom:3,switchesPerRoom:1,cableFactor:1.35,laborHoursPerPoint:.65}
});
// Estado eléctrico del proyecto: se valida al importar, no se confía en JSON externo.
export function defaultElectricalConfig() {
  return { profile:'estandar', rooms:1, show:true, points:[] };
}
const ELECTRICAL_POINT_SIZES=Object.freeze({
  outlet:[.11,.12], switch:[.11,.12], light:[.35,.15], board:[.35,.45]
});
export function sanitizeElectricalConfig(raw, dims, openings=[]) {
  if(raw===undefined || raw===null) return defaultElectricalConfig();
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Configuración eléctrica inválida');
  const profile=raw.profile??'estandar', rooms=raw.rooms??1, show=raw.show??true;
  if(!Object.hasOwn(ELECTRICAL_PROFILES, profile)) throw Error('Perfil eléctrico inválido');
  if(!Number.isInteger(rooms)||rooms<1||rooms>200) throw Error('Cantidad de recintos eléctricos inválida');
  if(typeof show!=='boolean') throw Error('Visibilidad eléctrica inválida');
  const source=raw.points??[];
  if(!Array.isArray(source)||source.length>200) throw Error('Lista de puntos eléctricos inválida');
  const ids=new Set(), points=[];
  for(const rawPoint of source) {
    if(!rawPoint || typeof rawPoint!=='object' || Array.isArray(rawPoint))
      throw Error('Punto eléctrico inválido');
    const {id,type,face,u,v}=rawPoint, size=ELECTRICAL_POINT_SIZES[type];
    if(typeof id!=='string' || !/^el-[1-9]\d*$/.test(id) || ids.has(id) ||
       !size || !['A','B','C','D'].includes(face) ||
       !Number.isFinite(u) || !Number.isFinite(v)) throw Error('Identificador o coordenadas eléctricas inválidas');
    ids.add(id);
    const span=(face==='A'||face==='C')?dims.L:dims.W;
    if(u<size[0]/2+.15 || u>span-size[0]/2-.15 ||
       v<size[1]/2+.10 || v>dims.H-size[1]/2-.10)
      throw Error('Punto eléctrico fuera de los márgenes seguros');
    for(const opening of openings) {
      if(opening.face!==face)continue;
      if(u+size[0]/2+.055>opening.u && u-size[0]/2-.055<opening.u+opening.w &&
         v+size[1]/2+.055>opening.v && v-size[1]/2-.055<opening.v+opening.h)
        throw Error('Punto eléctrico invade una abertura');
    }
    for(const prior of points) {
      if(prior.face!==face)continue;
      const other=ELECTRICAL_POINT_SIZES[prior.type];
      if(Math.abs(u-prior.u)<(size[0]+other[0])/2+.05 &&
         Math.abs(v-prior.v)<(size[1]+other[1])/2+.05)
        throw Error('Puntos eléctricos solapados');
    }
    points.push({id,type,face,u,v});
  }
  return {profile,rooms,show,points};
}

