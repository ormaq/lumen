import {PRESETS,createPreset,isSource,clamp} from './optics.js';
import {DEMO_INFO,buildDemoScene,LivePreview} from './preview.js';
import {matchCommands} from './session.js';
export function initLauncher(ctx){
 const el=id=>document.getElementById(id),root=el('home-dialog'),escape=ctx.escapeHTML,svg=ctx.icon;
 let preview=null,previewFailure=false,key='inverse',corrected=true,all=false,allRecent=false,forgetId=null,currentDemo=null;
 function startPreview(){
  if(preview||previewFailure)return;
  try{preview=new LivePreview(el('home-canvas'),text=>el('preview-status').textContent=text);}
  catch(error){previewFailure=true;el('preview-error').textContent='Live preview unavailable in this browser. The experiments can still be opened. '+error.message;}
 }
 function motionButton(){const running=!!preview?.motion;el('preview-motion').innerHTML=svg(running?'pause':'play');el('preview-motion').title=running?'Pause preview motion':'Play preview motion';el('preview-motion').setAttribute('aria-label',el('preview-motion').title);el('preview-motion').setAttribute('aria-pressed',String(running));el('preview-live-text').textContent=running?'LIVE 3D PREVIEW':'3D PREVIEW · PAUSED';}
 function selectDemo(next){
  key=PRESETS[next]?next:'inverse';const d=DEMO_INFO[key],p=PRESETS[key];
  currentDemo=buildDemoScene(key,corrected);el('preview-title').textContent=d?.title||p.title;el('preview-tag').textContent=d?.tag||'OPTICS EXPERIMENT';el('preview-compare').hidden=key!=='inverse';el('preview-original').classList.toggle('active',!corrected);el('preview-corrected').classList.toggle('active',corrected);
  el('preview-original').setAttribute('aria-pressed',String(!corrected));el('preview-corrected').setAttribute('aria-pressed',String(corrected));
  startPreview();if(preview){preview.setScene(currentDemo);preview.show(root.open);}motionButton();renderChoices();
 }
 function renderChoices(){
  const term=el('home-search').value.toLowerCase().trim(),keys=all?Object.keys(PRESETS).filter(k=>k!=='empty'):Object.keys(DEMO_INFO);
  el('home-demo-list').classList.toggle('all-demos',all);el('home-demo-list').innerHTML=keys.filter(k=>(PRESETS[k].title+' '+PRESETS[k].subtitle+' '+(DEMO_INFO[k]?.tag||'')).toLowerCase().includes(term)).map(k=>`<button class="demo-choice" data-demo="${k}" style="--demo-accent:${DEMO_INFO[k]?.color||'#a6cfbf'}" aria-pressed="${key===k}">${svg(PRESETS[k].icon)}<span><strong>${escape(PRESETS[k].title)}</strong><small>${escape(DEMO_INFO[k]?.short||PRESETS[k].subtitle)}</small></span><span class="demo-arrow">↗</span></button>`).join('')||'<p class="command-empty">No experiments match that search.</p>';
  el('home-all-demos').textContent=all?'Featured ↙':'All experiments ↗';el('home-search').hidden=!all;el('demo-list-heading').textContent=all?'ALL EXPERIMENTS':'PICK AN EXPERIMENT';
 }
 function renderRecents(){
  let records=ctx.store.records();if(!records.length&&ctx.legacy)records=[{scene:ctx.legacy,savedAt:0}];
  el('home-all-recent').hidden=records.length<=3;el('home-all-recent').textContent=allRecent?'Show fewer':'Show all '+records.length;el('home-recent-list').classList.toggle('all-recents',allRecent);
  el('home-recent-list').innerHTML=records.slice(0,allRecent?8:3).map(r=>{const s=r.scene;const date=r.savedAt?new Date(r.savedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Earlier Lumen project';return `<div class="recent-card"><button data-recover="${escape(s.uid)}">${svg('folder')}<span><strong>${escape(s.name)}</strong><small>${s.objects.length} objects · ${escape(date)}</small></span></button><button data-forget="${escape(s.uid)}" title="Remove local recovery copy" aria-label="Remove recovery copy of ${escape(s.name)}">${svg('close')}</button></div>`;}).join('')||`<div class="recent-empty">${svg('save')}<div><b>Your next experiment belongs here.</b> Open a scene and start editing. Up to eight projects are kept locally when browser storage is available.</div></div>`;
  el('home-storage-note').textContent=ctx.store.available?'Automatic local recovery':'Storage unavailable · use Save JSON';
 }
 function hide(){root.close();preview?.show(false);ctx.onClose();}
 function launch(scene,options={}){hide();ctx.openScene(scene,options);}
 function show(){ctx.beforeShow();el('home-back').hidden=!ctx.hasWorkspace();el('home-on-launch').checked=ctx.getPreferences().startScreen!==false;renderRecents();if(!root.open)root.showModal();if(!currentDemo)selectDemo(key);else {preview?.show(true);motionButton();}root.scrollTop=0;el('home-launch').focus({preventScroll:true});}
 root.addEventListener('cancel',e=>{if(!ctx.hasWorkspace())e.preventDefault();});root.addEventListener('close',()=>{preview?.show(false);ctx.onClose();});
 el('home-demo-list').addEventListener('click',e=>{const b=e.target.closest('[data-demo]');if(b)selectDemo(b.dataset.demo);});
 el('home-search').addEventListener('input',renderChoices);
 el('home-all-demos').addEventListener('click',()=>{all=!all;el('home-search').value='';renderChoices();if(all)el('home-search').focus();});
 el('home-blank').addEventListener('click',()=>launch(createPreset('empty'),{blank:true}));
 el('home-launch').addEventListener('click',()=>{if(currentDemo)launch(buildDemoScene(key,corrected),{demo:key});});
 el('home-import').addEventListener('click',()=>ctx.importFile());
 el('home-help').addEventListener('click',()=>el('guide-dialog').showModal());
 el('home-back').addEventListener('click',hide);
 el('home-all-recent').addEventListener('click',()=>{allRecent=!allRecent;renderRecents();});
 el('home-on-launch').addEventListener('change',e=>ctx.setPreference('startScreen',e.target.checked));
 el('preview-original').addEventListener('click',()=>{corrected=false;selectDemo(key);});el('preview-corrected').addEventListener('click',()=>{corrected=true;selectDemo(key);});
 el('preview-motion').addEventListener('click',()=>{preview?.toggle();motionButton();});el('preview-reset').addEventListener('click',()=>selectDemo(key));
 el('home-canvas').addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();preview?.toggle();motionButton();}if(e.key==='Home'){e.preventDefault();selectDemo(key);}});
 el('home-recent-list').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const uid=b.dataset.recover||b.dataset.forget,record=ctx.store.records().find(r=>r.scene.uid===uid)|| (ctx.legacy?.uid===uid?{scene:ctx.legacy}:null);if(!record)return;
  if(b.dataset.recover)launch(record.scene,{recover:true});else{forgetId=uid;el('forget-description').textContent=record.scene.name;el('forget-dialog').showModal();}
 });
 el('forget-confirm').addEventListener('click',()=>{if(forgetId){if(ctx.store.remove(forgetId)){if(ctx.legacy?.uid===forgetId)ctx.legacy=null;}else ctx.notify('Browser storage is unavailable. The copy could not be removed.');}el('forget-dialog').close();renderRecents();});
 return {show,hide,isOpen:()=>root.open,refresh:renderRecents,getState:()=>({open:root.open,demo:key,corrected,motion:!!preview?.motion,frames:preview?.frames||0,rays:preview?.trace?.seeds||0,previewActive:!!preview?.active,error:previewFailure}),getDemo:()=>currentDemo&&JSON.parse(JSON.stringify(currentDemo))};
}
export function initCommands(ctx){
 const el=id=>document.getElementById(id),root=el('command-dialog');let items=[],shown=[],index=0;
 function highlight(scroll=false){const results=[...el('command-results').querySelectorAll('[data-command]')];results.forEach((b,i)=>b.setAttribute('aria-selected',String(i===index)));const active=results[index];if(active){el('command-search').setAttribute('aria-activedescendant',active.id);if(scroll)active.scrollIntoView({block:'nearest'});}else el('command-search').removeAttribute('aria-activedescendant');}
 function render(){shown=matchCommands(items,el('command-search').value);index=0;el('command-results').innerHTML=shown.map((item,i)=>`<button id="command-item-${i}" class="command-result" role="option" tabindex="-1" data-command="${i}" aria-selected="${i===index}">${ctx.icon(item.icon||'ray')}<span>${ctx.escapeHTML(item.title)}</span><small>${ctx.escapeHTML(item.group||'')}</small></button>`).join('')||'<p class="command-empty">No matching tools. Try “star”, “detector”, or “camera”.</p>';highlight();}
 function run(i){const item=shown[i];if(!item)return;root.close();item.run();}
 el('command-search').addEventListener('input',render);el('command-search').addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();index=clamp(index+(e.key==='ArrowDown'?1:-1),0,Math.max(0,shown.length-1));highlight(true);}else if(e.key==='Enter'){e.preventDefault();run(index);}});
 el('command-results').addEventListener('click',e=>{const b=e.target.closest('[data-command]');if(b)run(Number(b.dataset.command));});
 return {show(){items=ctx.getItems();el('command-search').value='';render();root.showModal();el('command-search').focus();}};
}
