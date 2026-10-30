import { world, system, ItemStack } from "@minecraft/server";

// PortalMc 0.1.0 — API estavel 1.10.0, alvo Bedrock 1.20.80.
// Um par de portais global por mundo. A renderizacao do destino NAO e implementada.
const ITEM_PREFIX = "portalmc:portal_gun_";
const RESET_ITEM = "portalmc:portal_reset";
const COLORS = ["blue", "orange"];
const NORMALS = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 }
};
const portals = { blue: null, orange: null };
const cooldowns = new Map();
const shots = new Map();
const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add = (a,b,k=1) => ({x:a.x+b.x*k,y:a.y+b.y*k,z:a.z+b.z*k});
const len = a => Math.sqrt(dot(a,a));
const key = c => "portalmc:" + c;

function tell(player, message) {
  try { player.onScreenDisplay.setActionBar(message); }
  catch (_) { try { player.sendMessage(message); } catch (_) {} }
}
function persist(color) {
  try { world.setDynamicProperty(key(color), portals[color] ? JSON.stringify(portals[color]) : undefined); }
  catch (error) { console.warn("PortalMc persist: " + error); }
}
function removeVisual(spec) {
  if (!spec || !spec.visualId) return;
  try { const entity = world.getEntity(spec.visualId); if (entity && entity.isValid()) entity.remove(); }
  catch (_) { /* unloaded dimension: old model might persist until loaded */ }
}
function makeVisual(spec, color) {
  const dim = world.getDimension(spec.dimension);
  const kind = spec.normal.y ? "floor" : "wall";
  const entity = dim.spawnEntity("portalmc:portal_" + color + "_" + kind, spec.position);
  if (!spec.normal.y) {
    entity.setRotation({ x: 0, y: Math.atan2(-spec.normal.x, spec.normal.z) * 180 / Math.PI });
  }
  spec.visualId = entity.id;
}
function placePortal(player, color) {
  try {
    const hit = player.getBlockFromViewDirection({ maxDistance: 28, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit) { tell(player, "§cMire em um bloco solido (ate 28 blocos)."); return; }
    const face = String(hit.face).toLowerCase();
    const normal = NORMALS[face];
    if (!normal) { tell(player, "§cFace de bloco nao suportada."); return; }
    const block = hit.block;
    if (block.typeId === "minecraft:bedrock") { tell(player, "§cEsse bloco nao aceita portais."); return; }
    // O portal ocupa uma face 1 x 1. A superficie nao altera blocos.
    const center = { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 };
    const position = add(center, normal, 0.51);
    const spec = { dimension: player.dimension.id, position, normal, support: block.location, visualId: null };
    const previous = portals[color];
    makeVisual(spec, color);
    portals[color] = spec;
    persist(color);
    removeVisual(previous);
    tell(player, color === "blue" ? "§9Portal azul criado!" : "§6Portal laranja criado!");
    try { player.playSound("random.orb", { volume: 0.7, pitch: color === "blue" ? 1.25 : 0.85 }); } catch (_) {}
  } catch (error) {
    console.warn("PortalMc shot: " + error);
    tell(player, "§cFalha ao posicionar o portal.");
  }
}
function clearPortals(player) {
  for (const color of COLORS) {
    removeVisual(portals[color]);
    portals[color] = null;
    persist(color);
  }
  tell(player, "§7Portais removidos.");
}
function useWeapon(player, itemId) {
  if (!itemId || (!itemId.startsWith(ITEM_PREFIX) && itemId !== RESET_ITEM)) return;
  const now = system.currentTick;
  const shotId = player.id + ":" + itemId;
  if (now - (shots.get(shotId) ?? -100) < 5) return;
  shots.set(shotId, now);
  if (itemId === RESET_ITEM) clearPortals(player);
  else {
    const color = itemId.slice(ITEM_PREFIX.length);
    if (COLORS.includes(color)) placePortal(player, color);
  }
}
// 1.20.80 nao possui custom item components estaveis; os itens usam
// o comportamento de uso tipo food para gerar eventos no toque do Android.
world.afterEvents.itemUse.subscribe(event => {
  useWeapon(event.source, event.itemStack?.typeId);
});
world.afterEvents.itemCompleteUse.subscribe(event => {
  const itemId = event.itemStack?.typeId;
  useWeapon(event.source, itemId);
  if (!itemId || (!itemId.startsWith(ITEM_PREFIX) && itemId !== RESET_ITEM)) return;
  // Repõe o item consumido: a arma deve ser reutilizavel.
  const player = event.source;
  const slot = player.selectedSlotIndex;
  system.run(() => {
    try {
      const inv = player.getComponent("minecraft:inventory")?.container;
      if (inv && (!inv.getItem(slot) || inv.getItem(slot).typeId === itemId)) {
        inv.setItem(slot, new ItemStack(itemId, 1));
      } else {
        player.runCommandAsync("give @s " + itemId + " 1");
      }
    } catch (error) { console.warn("PortalMc restore: " + error); }
  });
});

function crosses(entry, entity) {
  const relative = sub(entity.location, entry.position);
  const signed = dot(relative, entry.normal);
  // Proximidade na frente do portal, evitando ativacao por tras da parede.
  if (signed < -0.3 || signed > 0.86) return false;
  if (entry.normal.y) {
    const radial = Math.sqrt(relative.x ** 2 + relative.z ** 2);
    if (radial > 0.72) return false;
  } else {
    const side = entry.normal.x ? Math.abs(relative.z) : Math.abs(relative.x);
    if (side > 0.69 || Math.abs(relative.y) > 1.32) return false;
  }
  let velocity;
  try { velocity = entity.getVelocity(); } catch (_) { return false; }
  // Requer movimento em direcao ao plano.
  return dot(velocity, entry.normal) < -0.025;
}
function teleportEntity(entity, entry, exit) {
  const destDimension = world.getDimension(exit.dimension);
  const destination = add(exit.position, exit.normal, exit.normal.y ? 1.42 : 1.17);
  if (exit.normal.y === 0) destination.y -= 0.24;
  const velocity = entity.getVelocity();
  const speed = Math.min(1.45, Math.max(0.17, len(velocity)));
  const previousRotation = entity.getRotation();
  const outgoingYaw = Math.atan2(-exit.normal.x, exit.normal.z) * 180 / Math.PI;
  entity.teleport(destination, {
    dimension: destDimension,
    rotation: { x: exit.normal.y ? previousRotation.x : 0, y: outgoingYaw },
    keepVelocity: false,
    checkForBlocks: false
  });
  // Impulso moderado, nao uma simulacao perfeita da conservacao vetorial.
  try { entity.applyImpulse({x:exit.normal.x * speed * 0.75, y:exit.normal.y * speed * 0.75, z:exit.normal.z * speed * 0.75}); }
  catch (_) {}
  cooldowns.set(entity.id, system.currentTick + 22);
}
function step() {
  const blue = portals.blue, orange = portals.orange;
  if (!blue || !orange) return;
  for (const [entry, exit] of [[blue, orange], [orange, blue]]) {
    try {
      const dimension = world.getDimension(entry.dimension);
      for (const entity of dimension.getEntities({ location: entry.position, maxDistance: 2.0 })) {
        if (entity.typeId.startsWith("portalmc:portal_")) continue;
        if ((cooldowns.get(entity.id) ?? 0) > system.currentTick) continue;
        if (!crosses(entry, entity)) continue;
        try { teleportEntity(entity, entry, exit); }
        catch (error) { console.warn("PortalMc teleport: " + error); }
      }
    } catch (_) { /* chunks unloaded: retry later */ }
  }
}
system.runInterval(step, 2);
system.runInterval(() => {
  for (const [id, until] of cooldowns) if (until <= system.currentTick) cooldowns.delete(id);
  if (shots.size > 100) shots.clear();
}, 80);
system.runTimeout(() => {
  for (const color of COLORS) {
    try {
      const value = world.getDynamicProperty(key(color));
      if (typeof value !== "string") continue;
      const spec = JSON.parse(value);
      if (!spec || !spec.position || !spec.normal || !spec.dimension) continue;
      portals[color] = spec;
      try {
        const visual = spec.visualId && world.getEntity(spec.visualId);
        if (!visual || !visual.isValid()) { makeVisual(spec, color); persist(color); }
      } catch (_) { /* visual recriado quando a regiao for carregada */ }
    } catch (error) { console.warn("PortalMc load: " + error); }
  }
}, 20);
