import { world, system, ItemStack } from "@minecraft/server";

// PortalMc 0.2.0 — Bedrock 1.20.80, @minecraft/server 1.10.0.
// Gun: usar = azul; usar agachado = laranja. Acoes no servidor.
// Previa: raycasting de baixa resolucao (paredes) — NAO e camera secundaria.
const GUN = "portalmc:portal_gun";
const NORMALS = {
  north: {x:0,y:0,z:-1}, south: {x:0,y:0,z:1},
  east: {x:1,y:0,z:0}, west: {x:-1,y:0,z:0},
  up: {x:0,y:1,z:0}, down: {x:0,y:-1,z:0}
};
const COLORS = ["blue", "orange"];
const portals = {blue:null, orange:null};
const cooldown = new Map();
const lastApproach = new Map();
const lastShot = new Map();
const preview = {blue:[], orange:[]};
const GRID_W = 4, GRID_H = 6;
const VIEW_RANGE = 12;
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const minus = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const plus = (a,b,k=1) => ({x:a.x+b.x*k,y:a.y+b.y*k,z:a.z+b.z*k});
const length = v => Math.sqrt(dot(v,v));
const norm = v => { const l=length(v)||1;return {x:v.x/l,y:v.y/l,z:v.z/l}; };
const right = n => ({x:n.z,y:0,z:-n.x});
const key = c => "portalmc:"+c;

function announce(player,msg) {
  try {player.onScreenDisplay.setActionBar(msg);}
  catch (_) { try {player.sendMessage(msg);} catch (_) {} }
}
function save(color) {
  try {world.setDynamicProperty(key(color),portals[color]?JSON.stringify(portals[color]):undefined);}
  catch (e) {console.warn("PortalMc save: "+e);}
}
function removeEntity(id) {
  if (!id) return;
  try {const e=world.getEntity(id);if(e&&e.isValid())e.remove();} catch (_) {}
}
function purgePreview(color) {
  for (const tile of preview[color]) removeEntity(tile.id);
  preview[color] = [];
}
function clearOldPreview(dim,at) {
  try {
    for(const e of dim.getEntities({type:"portalmc:portal_pixel",location:at,maxDistance:2.3})) e.remove();
  } catch (_) {}
}
function replaceVisual(spec,color) {
  const dim=world.getDimension(spec.dimension);
  const type="portalmc:portal_"+color+"_"+(spec.normal.y?"floor":"wall");
  const entity=dim.spawnEntity(type,spec.position);
  if(!spec.normal.y) entity.setRotation({x:0,y:Math.atan2(-spec.normal.x,spec.normal.z)*180/Math.PI});
  spec.visualId=entity.id;
}
function installPortal(player,color) {
  try {
    const hit=player.getBlockFromViewDirection({maxDistance:28,includePassableBlocks:false,includeLiquidBlocks:false});
    if(!hit){announce(player,"§cMire em um bloco sólido, até 28 blocos.");return;}
    const face=String(hit.face).toLowerCase();
    const n=NORMALS[face];
    if(!n){announce(player,"§cOrientação de bloco não suportada.");return;}
    if(hit.block.typeId==="minecraft:bedrock"){announce(player,"§cNão é possível colocar portal na rocha-mãe.");return;}
    const p=hit.block.location;
    const center={x:p.x+0.5,y:p.y+0.5,z:p.z+0.5};
    const spec={dimension:player.dimension.id,position:plus(center,n,0.51),normal:n,visualId:null};
    // Nao substituir o portal anterior ate a nova entidade ter sido criada.
    replaceVisual(spec,color);
    const previous=portals[color];
    portals[color]=spec;
    save(color);
    purgePreview(color);
    if(previous){removeEntity(previous.visualId);clearOldPreview(world.getDimension(previous.dimension),previous.position);}
    announce(player,color==="blue"?"§9Portal azul disparado":"§6Portal laranja disparado");
    try {player.playSound("random.orb",{volume:0.8,pitch:color==="blue"?1.4:0.8});} catch (_) {}
  } catch (e) {console.warn("PortalMc shoot: "+e);announce(player,"§cNão foi possível criar o portal.");}
}
function clearAll() {
  for(const color of COLORS){
    purgePreview(color);
    const spec=portals[color];
    if(spec){
      removeEntity(spec.visualId);
      try{clearOldPreview(world.getDimension(spec.dimension),spec.position);}catch(_){}
    }
    portals[color]=null;save(color);
  }
}
function fire(player,itemId) {
  if(itemId!==GUN)return;
  const tick=system.currentTick;
  if(tick-(lastShot.get(player.id)??-200)<5)return;
  lastShot.set(player.id,tick);
  installPortal(player,player.isSneaking?"orange":"blue");
}
world.afterEvents.itemUse.subscribe(e=>fire(e.source,e.itemStack?.typeId));
world.afterEvents.itemCompleteUse.subscribe(e=>{
  if(e.itemStack?.typeId!==GUN)return;
  fire(e.source,GUN);
  // O disparador 1.20.80 usa item consumivel com reposicao.
  const player=e.source, slot=player.selectedSlotIndex;
  system.run(()=>{
    try{
      const inv=player.getComponent("minecraft:inventory")?.container;
      if(!inv)return;
      const current=inv.getItem(slot);
      if(!current) inv.setItem(slot,new ItemStack(GUN,1));
      else if(current.typeId!==GUN) inv.addItem(new ItemStack(GUN,1));
    }catch(err){console.warn("PortalMc gun restore: "+err);}
  });
});
// Limpeza sem outro item; requer permissao para usar /scriptevent.
system.afterEvents.scriptEventReceive.subscribe(e=>{
  if(e.id!=="portalmc:clear")return;
  clearAll();
  try{if(e.sourceEntity)announce(e.sourceEntity,"§7Portais removidos.");}catch(_){}
});
function planeOffset(entry,entity) {
  // Centraliza a colisao na altura do corpo, nao nos pes do jogador.
  const body=entity.typeId==="minecraft:player"
    ? plus(entity.location,{x:0,y:1,z:0})
    : plus(entity.location,{x:0,y:0.45,z:0});
  return minus(body,entry.position);
}
function shouldEnter(entity,entry) {
  const delta=planeOffset(entry,entity);
  const dist=dot(delta,entry.normal);
  if(dist< -0.2 || dist>1.12)return false;
  if(entry.normal.y===0) {
    const side=Math.abs(dot(delta,right(entry.normal)));
    if(side>0.68||Math.abs(delta.y)>1.08)return false;
  } else {
    if(Math.abs(delta.x)>0.66||Math.abs(delta.z)>0.66)return false;
  }
  const velocity=entity.getVelocity();
  const inward=-dot(velocity,entry.normal);
  const id=entity.id+"|"+(entry.visualId||"");
  const old=lastApproach.get(id);
  lastApproach.set(id,{dist,tick:system.currentTick});
  if(inward>0.012)return true;
  if(old&&system.currentTick-old.tick<=3&&old.dist-dist>0.005)return true;
  // Na colisao com a parede, a velocidade ja pode ter sido zerada;
  // se o jogador esta muito perto e olha para o portal, transferir imediatamente.
  if(entity.typeId==="minecraft:player"&&entry.normal.y===0&&dist<0.76) {
    return dot(entity.getViewDirection(),entry.normal)<-0.58;
  }
  return false;
}
function exitLocation(entity,exit) {
  if(exit.normal.y!==0) {
    const footY=exit.normal.y>0?0.23:-2.12;
    return {x:exit.position.x,y:exit.position.y+footY,z:exit.position.z};
  }
  // Na parede o portal tem altura visual ~1.9 bloco.
  // Ajuste central do corpo para uma saida fora da parede.
  const y=entity.typeId==="minecraft:player"?-0.9:-0.4;
  return plus(plus(exit.position,{x:0,y,z:0}),exit.normal,1.32);
}
function transfer(entity,entry,exit){
  const location=exitLocation(entity,exit);
  const velocity=entity.getVelocity();
  const speed=Math.min(1.1,Math.max(0.14,length(velocity)));
  const y= Math.atan2(-exit.normal.x,exit.normal.z)*180/Math.PI;
  const oldRotation=entity.getRotation();
  entity.teleport(location,{
    dimension:world.getDimension(exit.dimension),
    rotation:{x:exit.normal.y?oldRotation.x:0,y},
    keepVelocity:false,checkForBlocks:false
  });
  cooldown.set(entity.id,system.currentTick+9);
  const outgoing=exit.normal.y?exit.normal:{x:exit.normal.x,y:0.1,z:exit.normal.z};
  try{entity.applyImpulse(plus({x:0,y:0,z:0},outgoing,speed));}catch(_){}
}
function teleportTick(){
  if(!portals.blue||!portals.orange)return;
  for(const [entry,exit] of [[portals.blue,portals.orange],[portals.orange,portals.blue]]){
    try{
      const dimension=world.getDimension(entry.dimension);
      // Em vez de 2 ticks e limite 0.86, inspeciona a area de aproximacao todo tick.
      for(const entity of dimension.getEntities({location:entry.position,maxDistance:2.4})){
        if(entity.typeId.startsWith("portalmc:portal_"))continue;
        if((cooldown.get(entity.id)||0)>system.currentTick)continue;
        try{if(shouldEnter(entity,entry))transfer(entity,entry,exit);}
        catch(err){console.warn("PortalMc transfer: "+err);}
      }
    }catch(_){}
  }
}
system.runInterval(teleportTick,1);

function palette(block){
  if(!block)return 0;
  const s=block.typeId;
  if(s.includes("water")||s.includes("ice"))return 7;
  if(s.includes("lava")||s.includes("fire"))return 8;
  if(s.includes("grass")||s.includes("moss"))return 2;
  if(s.includes("leaves")||s.includes("vine"))return 3;
  if(s.includes("dirt")||s.includes("mud")||s.includes("clay"))return 4;
  if(s.includes("plank")||s.includes("log")||s.includes("wood"))return 5;
  if(s.includes("sand")||s.includes("end_stone"))return 6;
  if(s.includes("snow")||s.includes("quartz")||s.includes("white"))return 9;
  if(s.includes("obsidian")||s.includes("deepslate")||s.includes("black"))return 10;
  if(s.includes("ore")||s.includes("copper")||s.includes("iron"))return 11;
  return 1;
}
function createPreview(color) {
  const spec=portals[color];
  purgePreview(color);
  if(!spec||spec.normal.y!==0||!portals[other(color)]||portals[other(color)].normal.y!==0)return;
  const dim=world.getDimension(spec.dimension);
  clearOldPreview(dim,spec.position);
  const r=right(spec.normal),up={x:0,y:1,z:0};
  const yaw=Math.atan2(-spec.normal.x,spec.normal.z)*180/Math.PI;
  for(let iy=0;iy<GRID_H;iy++)for(let ix=0;ix<GRID_W;ix++){
    const u=(ix+0.5)/GRID_W-0.5;
    const v=(GRID_H-iy-0.5)/GRID_H-0.5;
    const point=plus(plus(plus(spec.position,r,u),up,v*1.8),spec.normal,0.072);
    try{
      const e=dim.spawnEntity("portalmc:portal_pixel",point);
      e.setRotation({x:0,y:yaw});
      preview[color].push({id:e.id,ix,iy,u,v,prev:-1});
    }catch(err){console.warn("PortalMc preview tile: "+err);return;}
  }
}
function other(color){return color==="blue"?"orange":"blue";}
function viewTick() {
  for(const color of COLORS){
    const entry=portals[color],exit=portals[other(color)];
    if(!entry||!exit||entry.normal.y!==0||exit.normal.y!==0) {
      if(preview[color].length)purgePreview(color);
      continue;
    }
    // Ativa somente se houver jogador na frente e proximo ao portal.
    let viewer=null,min=Infinity;
    for(const p of world.getPlayers()){
      if(p.dimension.id!==entry.dimension)continue;
      const to=minus(p.location,entry.position),distance=length(to);
      if(distance>9||dot(to,entry.normal)<-1)continue;
      if(distance<min){viewer=p;min=distance;}
    }
    if(!viewer){if(preview[color].length)purgePreview(color);continue;}
    if(preview[color].length!==GRID_W*GRID_H)createPreview(color);
    if(preview[color].length!==GRID_W*GRID_H)continue;
    try {
      const head=viewer.getHeadLocation();
      const relation=minus(head,entry.position);
      const entryR=right(entry.normal),exitR=right(exit.normal),up={x:0,y:1,z:0};
      const camera=plus(plus(plus(exit.position,exitR,dot(relation,entryR)),up,dot(relation,up)),exit.normal,-Math.max(0.45,dot(relation,entry.normal)));
      const dimension=world.getDimension(exit.dimension);
      for(const tile of preview[color]){
        const sample=plus(plus(exit.position,exitR,tile.u),up,tile.v*1.8);
        const direction=norm(minus(sample,camera));
        const start=plus(sample,direction,0.16);
        const hit=dimension.getBlockFromRay(start,direction,{maxDistance:VIEW_RANGE,includePassableBlocks:false,includeLiquidBlocks:true});
        const val=palette(hit?.block);
        if(tile.prev!==val){
          const e=world.getEntity(tile.id);
          if(e&&e.isValid()){e.setProperty("portalmc:sample",val);tile.prev=val;}
        }
      }
    }catch(err){console.warn("PortalMc preview tick: "+err);}
  }
}
system.runInterval(viewTick,8);
system.runInterval(()=>{
  const tick=system.currentTick;
  for(const [id,until] of cooldown)if(until<=tick)cooldown.delete(id);
  for(const [id,value] of lastApproach)if(tick-value.tick>12)lastApproach.delete(id);
  if(lastShot.size>80)lastShot.clear();
},40);
system.runTimeout(()=>{
  for(const color of COLORS){
    try{
      const v=world.getDynamicProperty(key(color));
      if(typeof v!=="string")continue;
      const spec=JSON.parse(v);
      if(!spec?.position||!spec?.normal||!spec?.dimension)continue;
      portals[color]=spec;
      const entity=spec.visualId?world.getEntity(spec.visualId):null;
      if(!entity||!entity.isValid()){replaceVisual(spec,color);save(color);}
      clearOldPreview(world.getDimension(spec.dimension),spec.position);
    }catch(err){console.warn("PortalMc reload: "+err);}
  }
},20);
system.runInterval(()=>{
  for(const p of world.getPlayers()){
    try{
      const item=p.getComponent("minecraft:inventory")?.container?.getItem(p.selectedSlotIndex);
      if(item?.typeId===GUN)announce(p,p.isSneaking?"§6Portal laranja • Solte o agachar para azul":"§9Portal azul • Agache para laranja");
    }catch(_){}
  }
},20);
