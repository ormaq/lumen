/** Local project recovery. All reads are validated; storage failure never prevents editing. */
import {validateScene} from './optics.js';
export class ProjectStore {
  constructor(storage) { this.storage=storage; this.available=!!storage; this.key='lumen-projects-v5'; }
  read(key) { try{return this.storage?.getItem(key)||null;}catch{this.available=false;return null;} }
  records() {
    try {
      const raw=JSON.parse(this.read(this.key)||'[]');
      if(!Array.isArray(raw))return [];
      return raw.slice(0,8).flatMap(r=>{try{return [{savedAt:Number(r.savedAt)||0,scene:validateScene(r.scene)}];}catch{return [];}});
    } catch {return [];}
  }
  latest() {
    const records=this.records();if(records.length)return records[0].scene;
    try{const saved=JSON.parse(this.read(this.key)||'null');if(Array.isArray(saved))return null;}catch{}
    for(const key of ['lumen-scene-v5','lumen-scene-v4','lumen-scene-v3','lumen-scene-v2']) {
      try {const raw=this.read(key);if(raw)return validateScene(JSON.parse(raw));}catch{}
    }
    return null;
  }
  save(scene) {
    if(!this.storage){this.available=false;return false;}
    try {
      const clean=validateScene(scene),records=this.records().filter(r=>r.scene.uid!==clean.uid);
      records.unshift({savedAt:Date.now(),scene:clean});
      // One atomic key: no half-updated index/scene pair on a quota failure.
      this.storage.setItem(this.key,JSON.stringify(records.slice(0,8)));
      this.available=true;return true;
    } catch {this.available=false;return false;}
  }
  remove(uid) {
    try{this.storage.setItem(this.key,JSON.stringify(this.records().filter(r=>r.scene.uid!==uid)));return true;}catch{this.available=false;return false;}
  }
}
export function matchCommands(items,query) {
  const terms=String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
  return items.filter(item=>terms.every(t=>(item.title+' '+(item.group||'')+' '+(item.keywords||'')).toLowerCase().includes(t))).slice(0,50);
}
