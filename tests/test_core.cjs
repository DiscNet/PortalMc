"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const callbacks = {};
const intervals = [];
const entities = new Map();
const saved = new Map();
let nextId = 0;
let shot = 0;
const item = "portalmc:portal_gun";
class ItemStack {
  constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; }
}
const dim = {
  id: "minecraft:overworld",
  spawnEntity(typeId, location) {
    const entity = {
      id: "entity_" + ++nextId, typeId, location: {...location}, valid: true, props: {},
      setRotation(rotation) {this.rotation = rotation;},
      setProperty(k,v) {this.props[k] = v;},
      remove() {this.valid = false;entities.delete(this.id);},
      isValid() {return this.valid;}
    };
    entities.set(entity.id, entity);
    return entity;
  },
  getEntities(options) {
    let result = [...entities.values()];
    if (options.type) result = result.filter(x => x.typeId === options.type);
    if (!options.type && !options.location) return result;
    if (!options.type) result.push(player);
    if (options.location && options.maxDistance) result = result.filter(x =>
      Math.hypot(x.location.x-options.location.x,x.location.y-options.location.y,
        x.location.z-options.location.z)<=options.maxDistance);
    return result;
  },
  getBlockFromRay() {return {block:{typeId:"minecraft:stone"}};}
};
const player = {
  id: "player1", typeId:"minecraft:player", isSneaking:false,
  selectedSlotIndex:0, dimension:dim,location:{x:0.5,y:0.5,z:-0.6},
  getBlockFromViewDirection(){return {
    face:"north",block:{typeId:"minecraft:stone",location:{x:shot++ ? 10:0,y:1,z:0}}
  };},
  getComponent(){return {container:{getItem(){return new ItemStack(item,1);},
    setItem(){},addItem(){}}};},
  getHeadLocation(){return {...this.location,y:this.location.y+1.62};},
  getVelocity(){return {x:0,y:0,z:0};},
  getViewDirection(){return {x:0,y:0,z:1};},
  getRotation(){return {x:0,y:0};},
  teleport(loc,options){this.location={...loc};this.dimension=options.dimension;this.rotation=options.rotation;},
  applyImpulse(){},
  playSound(){},
  onScreenDisplay:{setActionBar(){}},
  sendMessage(){}
};
const world = {
  afterEvents: {
    itemUse:{subscribe(fn){callbacks.use=fn;}},
    itemCompleteUse:{subscribe(fn){callbacks.complete=fn;}}
  },
  getPlayers(){return [player];},
  getDimension(){return dim;},
  getEntity(id){return entities.get(id);},
  getDynamicProperty(k){return saved.get(k);},
  setDynamicProperty(k,v){saved.set(k,v);}
};
const system = {
  currentTick:0,
  afterEvents:{scriptEventReceive:{subscribe(fn){callbacks.script=fn;}}},
  runInterval(fn,ticks){intervals.push({fn,ticks});},
  runTimeout(){},
  run(fn){fn();}
};
const js=fs.readFileSync("behavior_pack/scripts/main.js","utf8").replace(/^import .*?;\s*/m,"");
vm.runInNewContext(js,{world,system,ItemStack,console,Map,Math}, {filename:"main.js"});
assert.equal(intervals.some(i=>i.ticks===1),true,"teleport must run every tick");
system.currentTick=1;
callbacks.use({source:player,itemStack:new ItemStack(item,1)});
assert.ok(saved.get("portalmc:blue"),"normal use must create blue portal");
system.currentTick=9;player.isSneaking=true;
callbacks.use({source:player,itemStack:new ItemStack(item,1)});
assert.ok(saved.get("portalmc:orange"),"sneak use must create orange portal");
player.isSneaking=false;
assert.equal([...entities.values()].filter(e=>e.typeId.startsWith("portalmc:portal_")).length,2);
const teleport=intervals.find(i=>i.ticks===1);
system.currentTick=10;teleport.fn();
assert.ok(player.location.x>9,"stationary player facing entrance near wall should teleport in one tick");
const prev=intervals.find(i=>i.ticks===8);
prev.fn();
assert.ok([...entities.values()].some(e=>e.typeId==="portalmc:portal_pixel"),
  "preview should create sampled tiles when viewer is near a wall portal");
assert.ok([...entities.values()].some(e=>e.typeId==="portalmc:portal_pixel"&&e.props["portalmc:sample"]===1),
  "raycasting should synchronize stone palette to preview entities");
callbacks.script({id:"portalmc:clear",sourceEntity:player});
assert.equal(saved.get("portalmc:blue"),undefined);
assert.equal(saved.get("portalmc:orange"),undefined);
console.log("PortalMc mock Script API tests OK: single gun, color switching, fast wall teleport, previews, clear");
