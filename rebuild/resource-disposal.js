// Gestión de propiedad de recursos gráficos. Independiente de Three.js para
// poder verificar que un recurso compartido solo se libera una vez.
export function createDisposalContext(persistentTextures = []) {
  return {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set(),
    persistentTextures: new Set(persistentTextures)
  };
}

export function disposeTexture(texture, ctx) {
  if (!texture?.isTexture || ctx.persistentTextures.has(texture) || ctx.textures.has(texture)) return;
  ctx.textures.add(texture);
  texture.dispose();
}

export function disposeMaterial(material, ctx) {
  if (!material || ctx.materials.has(material)) return;
  ctx.materials.add(material);
  for (const value of Object.values(material)) {
    if (value?.isTexture) disposeTexture(value, ctx);
  }
  material.dispose();
}

export function disposeHierarchy(object, ctx) {
  object.traverse(child => {
    if (child.geometry && !ctx.geometries.has(child.geometry)) {
      ctx.geometries.add(child.geometry);
      child.geometry.dispose();
    }
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach(m => disposeMaterial(m, ctx));
      else disposeMaterial(child.material, ctx);
    }
  });
}
