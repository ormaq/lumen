import {ProjectStore} from './session.js';
import {initLauncher,initCommands} from './launcher.js';
import {buildDemoScene} from './preview.js';
import {V,rad,deg,clamp,CATALOG,PRESETS,isSource,isMirror,basis,localVec,worldVec,aim,intersect,sourceColor,surfaceZ,surfaceNormal,focalPoints,createObject,createPreset,traceScene,validateScene,syncAimLocks,cloneObjects,spotStatistics,telescopeReference,requestedSamples,POSITION_LIMIT,SEGMENT_BUDGET,designMirror,syncInverseDesigns,validateInverseAperture,auditMirror,auditFigure,inverseSag,inverseSurfaceMesh} from './optics.js';
import {initDesigner} from './designer.js';
import {M,Renderer} from './renderer.js';
const $=id=>document.getElementById(id);
const ICONS={
 star:'<path d="m12 2 2.8 6.2 6.7.8-5 4.6 1.4 6.6-5.9-3.4-5.9 3.4 1.4-6.6-5-4.6 6.7-.8L12 2Z"/>',sliders:'<path d="M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11M10 3v6m5 0v6M6 15v6"/>',cut:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h6"/>',

 ray:'<circle cx="4" cy="12" r="2"/><path d="M7 12h14m-4-4 4 4-4 4"/>',beam:'<path d="M3 5h18M3 12h18M3 19h18m-3-17 3 3-3 3m0 1 3 3-3 3m0 1 3 3-3 3"/>',sun:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',spot:'<circle cx="4" cy="12" r="1.5"/><path d="m6 11 15-7M6 12h15M6 13l15 7M20 5v14"/>',fan:'<path d="m3 12 18-9M3 12h18M3 12l18 9M3 12l18-4M3 12l18 4"/>',line:'<path d="M4 3v18M4 5h17M4 12h17M4 19h17"/>',area:'<path d="m3 5 8-2v16l-8 2V5Zm8 0h10M11 12h10M11 19h10"/>',mirror:'<path d="m7 3 10 3v15L7 18V3Zm3 2v14M5 22h14"/>',dish:'<path d="M18 3C5 3 5 21 18 21M18 3c-6 4-6 14 0 18M5 12h15M15 7l5 5-5 5"/>',trough:'<path d="m4 3 11 2c-7 3-7 11 0 14L4 21c-6-5-6-13 0-18ZM4 3c-1 6-1 12 0 18M7 7l8 1m-8 8 8-1"/>',curved:'<path d="M15 3a11 11 0 0 0 0 18M18 3a11 11 0 0 0 0 18M3 7h9M3 17h9"/>',split:'<path d="m7 21 10-18M2 12h20m-4-3 4 3-4 3M12 12V2m-3 3 3-3 3 3"/>',lens:'<path d="M12 2c-7 5-7 15 0 20 7-5 7-15 0-20ZM2 12h20"/>',glass:'<circle cx="12" cy="12" r="8"/><path d="M7 8a6 6 0 0 1 5-3M2 9l5 2 10 2 5 3"/>',block:'<path d="M9 3h6v18H9zM2 6h7M2 12h7M2 18h7m6-13 4-3m-4 9 4-3m-4 9 4-3m-4 9 4-3"/>',aperture:'<path d="M5 3h14v18H5z"/><ellipse cx="12" cy="12" rx="4" ry="6"/>',detector:'<path d="M4 3h16v18H4zM8 3v18M4 8h16M4 16h16M15 3v18"/><circle cx="12" cy="12" r="2"/>',plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m7 10 5 5 5-5"/>',layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5"/>',undo:'<path d="M8 5 3 10l5 5M3 10h12a5 5 0 0 1 0 10"/>',redo:'<path d="m16 5 5 5-5 5M21 10H9a5 5 0 0 0 0 10"/>',folder:'<path d="M3 6h7l2 3h9v11H3V6ZM3 6V4h7l2 2h8v3"/>',save:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2.5M12 17h.01"/>',fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>','panel-left':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>','panel-right':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',cursor:'<path d="m5 3 14 10-7 1-4 7L5 3Z"/>',move:'<path d="M12 2v20M2 12h20M9 5l3-3 3 3M5 9l-3 3 3 3m14-6 3 3-3 3m-10 4 3 3 3-3"/>',rotate:'<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/><circle cx="12" cy="12" r="2"/>',magnet:'<path d="M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0V3ZM4 7h5m6 0h5"/>',frame:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="3"/>',focus:'<path d="M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',normal:'<path d="m3 19 18-5M12 17V3m-4 4 4-4 4 4"/>',crosshair:'<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 4 12 8-12 8V4Z"/>',camera:'<path d="m8 6 1-2h6l1 2h4v14H4V6h4Z"/><circle cx="12" cy="13" r="4"/>',eye:'<path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>','eye-off':'<path d="m3 3 18 18M8 5c5-2 10 0 14 7-1 2-2 3-3 4M6 6c-2 1-3 3-4 6 4 7 10 9 16 6"/>',lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0"/>',trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',spark:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 5v5"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.spark}</svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hydrate(root=document){root.querySelectorAll('[data-icon]').forEach(e=>e.outerHTML=icon(e.dataset.icon));}
hydrate();
function boot(){
 const canvas=$('canvas'),renderer=new Renderer(canvas),gl=renderer.gl;
 let storage=null;try{storage=localStorage;}catch{}
 const projectStore=new ProjectStore(storage);
 let state=createPreset('inverse'),preferences={invertOrbit:false,startScreen:true},loaded=false,workspaceReady=false,launcher=null,commands=null;
 const recovered=projectStore.latest();if(recovered){state=recovered;loaded=true;}
 try{const p=JSON.parse(storage?.getItem('lumen-preferences')||'{}');preferences.invertOrbit=!!p.invertOrbit;preferences.startScreen=p.startScreen!==false;}catch{}
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)state.settings.animate=false;
 let selected=state.objects.find(o=>!isSource(o))?.id||state.objects[0]?.id||null,mode='select',axis=null,view='3d',leftTab='scene',rightTab='object';
 let trace={segments:[],hits:[],detectors:{},seeds:0,limited:false,emittedPower:0},dirty=true,needsTrace=true,labels=[],flowTime=0,lastTime=0,lastRender=0,rayCache=null,traceMs=0;
 let past=[],future=[],editBefore=null,saveTimer,toastTimer,pendingHistory=false,curveKeys=new Map(),drag=null,touches=new Map(),pinch=null,exportAfterFrame=false;
 let selection=new Set(selected?[selected]:[]),clipboard=null,pasteSerial=0,isolateSource=null,sceneRevision=0,traceBusy=false,traceWorker=null,workerFailed=false,renderedSegments=0;
 let designer=null;
 const foldState=new Map();
 try{clipboard=JSON.parse(localStorage.getItem('lumen-object-clipboard')||'null');}catch{}
 try{if(typeof LUMEN_WORKER_SOURCE!=='undefined'&&typeof Worker!=='undefined'){const u=URL.createObjectURL(new Blob([LUMEN_WORKER_SOURCE],{type:'text/javascript'}));traceWorker=new Worker(u);URL.revokeObjectURL(u);traceWorker.onmessage=e=>{traceBusy=false;if(e.data.error){workerFailed=true;traceWorker.terminate();traceWorker=null;needsTrace=true;return;}if(e.data.revision===sceneRevision){applyTrace(e.data.trace,e.data.ms);dirty=true;}else needsTrace=true;};traceWorker.onerror=()=>{workerFailed=true;traceBusy=false;traceWorker?.terminate();traceWorker=null;needsTrace=true;};}}catch{workerFailed=true;traceWorker=null;}
 const object=id=>state.objects.find(o=>o.id===id),current=()=>object(selected),snapshot=()=>JSON.stringify(state);
 const swatchColors=['#ff6575','#ffbf69','#f3ea91','#70e5a7','#80c7ff','#bc9fff','#f3f7ff'];
 function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3300);}
 function persist(){clearTimeout(saveTimer);if(!workspaceReady)return;$('save-status').textContent='Saving recovery copy…';saveTimer=setTimeout(flushProject,600);}
 function syncHistory(){$('undo-button').disabled=!past.length;$('redo-button').disabled=!future.length;for(const id of ['duplicate-button','duplicate-scene','copy-button','cut-button','delete-selection'])$(id).disabled=!current();}
 function selectedObjects(){return state.objects.filter(o=>selection.has(o.id));}
 function normalizeSelection(){selection=new Set([...selection].filter(id=>object(id)));if(!selection.has(selected)){selection=new Set(selected&&object(selected)?[selected]:[]);}if(!current())selected=[...selection].at(-1)||null;}
 function closeMenus(){document.querySelectorAll('.menu[open]').forEach(m=>m.open=false);}
 function copySelection(cut=false){
  const items=selectedObjects();if(!items.length){toast('Select an object to copy.');return;}
  if(cut&&items.some(o=>o.locked)){toast('Unlock all selected objects before cutting.');return;}
  clipboard={format:'lumen-objects',version:1,copiedAt:Date.now(),sceneUid:state.uid,objects:JSON.parse(JSON.stringify(items))};pasteSerial=0;
  const text=JSON.stringify(clipboard);try{localStorage.setItem('lumen-object-clipboard',text);}catch{}
  try{navigator.clipboard?.writeText(text).catch(()=>{});}catch{}
  if(cut)mutate(()=>{state.objects=state.objects.filter(o=>!selection.has(o.id));selected=null;selection.clear();});
  toast(`${items.length} object${items.length===1?'':'s'} ${cut?'cut':'copied'} in Lumen.`);
 }
 async function pasteSelection(inPlace=false){
  // An in-app copy must paste immediately, without a system permission prompt.
  let payload=clipboard;
  try{const saved=JSON.parse(localStorage.getItem('lumen-object-clipboard')||'null');if(saved?.format==='lumen-objects'&&(!payload||(saved.copiedAt||0)>(payload.copiedAt||0)))payload=saved;}catch{}
  if(!payload){try{const text=await navigator.clipboard?.readText();if(text){const parsed=JSON.parse(text);if(parsed.format==='lumen-objects')payload=parsed;}}catch{}}
  pastePayload(payload,inPlace);
 }
 function pastePayload(payload,inPlace=false){
  try{const shift=inPlace?0:.7*(++pasteSerial);const copies=cloneObjects(state,payload,[shift,0,shift]);mutate(()=>{state.objects.push(...copies);selection=new Set(copies.map(o=>o.id));selected=copies.at(-1).id;});setRightTab('object');showRight();toast(`${copies.length} object${copies.length===1?'':'s'} pasted${inPlace?' in place':''}.`);}catch(e){toast(e.message);}
 }
 function selectAll(){endEdit();selection=new Set(state.objects.map(o=>o.id));selected=state.objects.at(-1)?.id||null;renderList();renderInspector();syncHistory();dirty=true;rayCache=null;}

 function remember(before){if(before!==snapshot()){past.push(before);if(past.length>100)past.shift();future=[];syncHistory();}}
 function beginEdit(){if(editBefore===null)editBefore=snapshot();}
 function endEdit(){if(editBefore!==null){remember(editBefore);editBefore=null;}persist();}
 function mutate(fn,refresh=true){endEdit();const before=snapshot();fn();remember(before);if(refresh)refreshAll();else markChanged();}
 function undo(redo=false){endEdit();const from=redo?future:past,to=redo?past:future;if(!from.length)return;to.push(snapshot());state=JSON.parse(from.pop());if(!current())selected=state.objects[0]?.id||null;refreshAll();toast(redo?'Change redone.':'Change undone.');}
 function markChanged(){syncAimLocks(state);const designErrors=syncInverseDesigns(state);designer?.changed(designErrors);sceneRevision++;needsTrace=true;dirty=true;rayCache=null;syncInspectorFields();persist();updateResearch();}
 function setRangeFill(el){el.style.setProperty('--pct',`${(Number(el.value)-Number(el.min))/(Number(el.max)-Number(el.min))*100}%`);}
 function cleanCurveMeshes(){const ids=new Set(state.objects.map(o=>o.id));for(const id of curveKeys.keys())if(!ids.has(id)){renderer.disposeMesh('curve-'+id);curveKeys.delete(id);}}
 function refreshAll(){syncAimLocks(state);syncInverseDesigns(state);normalizeSelection();cleanCurveMeshes();renderList();renderInspector();renderSimulation();syncButtons();syncHistory();renderExamples();renderSavedViews();if(rightTab==='research')renderResearch();if(rightTab==='design')designer?.render();$('project-name').textContent=state.name;$('scene-title').textContent=state.name;$('scene-subtitle').textContent=PRESETS[state.preset]?.subtitle||'Your optical experiment in three dimensions.';$('empty-stage').hidden=state.objects.length>0;markChanged();}
 function selectedHit(){const shown=designer?.displayTrace(trace)||trace;const pool=shown.hits.filter(h=>h.objectId===selected);return pool.find(h=>h.rayIndex===1)||pool[0]||shown.hits.find(h=>h.reflection!==undefined);}
 function applyTrace(next,ms){trace=next;traceMs=ms;rayCache=null;rebuildLabels();updateReadouts();updateResearch();}
 function retrace(){
  if(traceBusy)return;needsTrace=false;const estimated=state.objects.filter(isSource).reduce((n,s)=>n+requestedSamples(s,state.settings.density),0);
  if(traceWorker&&estimated>1024){traceBusy=true;traceWorker.postMessage({scene:state,revision:sceneRevision});$('status-trace').textContent='Tracing dense scene…';return;}
  const start=performance.now();applyTrace(traceScene(state),performance.now()-start);
 }
 function updateReadouts(){
  $('stage-stats').textContent=`${trace.seeds} rays · ${trace.segments.length} segments`;
  $('status-trace').innerHTML=`<span class="state-dot"></span>${trace.seeds} rays <span class="hide-small">· ${traceMs.toFixed(1)} ms</span>${trace.limited?' <span class="warning">· trace capped</span>':''}${trace.seedLimited?' <span class="warning">· sample budget</span>':''}<span id="display-thinned" class="warning"></span>`;
  const o=current(),h=selectedHit();$('status-pick').textContent=o?`${o.name}${o.locked?' · locked':''} · ${CATALOG[o.type].label}`:'Click an object to inspect it';
  const measure=$('measure');measure.hidden=!state.objects.length||!state.settings.showMeasurements;
  if(o&&['parabola','trough','spherical','lens'].includes(o.type)){
   const f=o.type==='spherical'?o.radius/2*(o.curvature==='convex'?-1:1):o.focalLength,desc=o.type==='trough'?'Line focus · parabolic cylinder':o.type==='spherical'?'Paraxial focus · spherical aberration is traced':o.type==='lens'?'Paraxial thin-lens approximation':'Point focus · analytic paraboloid';
   measure.innerHTML=`<div class="measure-title">${o.type==='spherical'?'PARAXIAL FOCAL LENGTH':'FOCAL LENGTH'}${icon('crosshair')}</div><div class="measure-values"><span><small>f ${o.type==='spherical'?'≈':'='}</small>${f.toFixed(2)}</span><small>world units</small></div><p>${desc}</p>`;
  }else if(o?.type==='detector'){
   const d=trace.detectors[o.id]||{power:0,count:0};measure.innerHTML=`<div class="measure-title">INCIDENT POWER${icon('detector')}</div><div class="measure-values">${d.power.toFixed(3)}<small>arb. units</small></div><p>${d.count} sampled ray crossings · ${o.absorb?'absorbing screen':'pass-through detector'}</p>`;
  }else if(h?.reflection!==undefined){measure.innerHTML=`<div class="measure-title">LAW OF REFLECTION${icon('normal')}</div><div class="measure-values"><span><small>θᵢ</small>${h.incidence.toFixed(1)}°</span><span class="equals">=</span><span><small>θᵣ</small>${h.reflection.toFixed(1)}°</span></div><p>Sampled ray ${h.rayIndex+1} · angles from the surface normal</p>`;}
  else{measure.innerHTML=`<div class="measure-title">LIVE GEOMETRIC OPTICS${icon('spark')}</div><div class="measure-values">${trace.seeds}<small>emitted rays</small></div><p>${trace.hits.length} surface interactions · ${state.settings.maxBounces} interaction cap</p>`;}
  if($('detector-power')){const d=trace.detectors[selected]||{power:0,count:0,hits:[]};$('detector-power').textContent=d.power.toFixed(3);$('detector-count').textContent=d.count;paintDetector(o,d);}
  if($('live-angle'))$('live-angle').textContent=h?.reflection!==undefined?`θᵢ ${h.incidence.toFixed(2)}° = θᵣ ${h.reflection.toFixed(2)}°`:'No reflected ray on this object.';
 }
 function renderList(){
  $('object-count').textContent=String(state.objects.length).padStart(2,'0');const n=state.objects.filter(isSource).length;$('scene-foot').textContent=`${state.objects.length} objects · ${n} light source${n===1?'':'s'}`;
  $('object-list').innerHTML=state.objects.map(o=>`<div class="object-row ${selection.has(o.id)?'selected':''} ${o.enabled?'':'disabled'}" data-select="${o.id}" role="button" tabindex="0" aria-label="Select ${esc(o.name)}" aria-pressed="${selection.has(o.id)}"><span class="obj-icon" ${isSource(o)?`style="color:rgb(${sourceColor(o).map(v=>Math.round(v*255)).join(',')})"`:''}>${icon(CATALOG[o.type].icon)}</span><span class="name">${esc(o.name)}</span>${o.locked?`<span class="row-lock">${icon('lock')}</span>`:''}<button class="visibility" data-visible="${o.id}" title="${o.enabled?'Disable':'Enable'} ${esc(o.name)}" aria-label="${o.enabled?'Disable':'Enable'} ${esc(o.name)}">${icon(o.enabled?'eye':'eye-off')}</button></div>`).join('')||'<div class="scene-empty">The workbench is empty.<br>Add a source to begin.</div>';
 }
 function setLeftTab(tab){leftTab=tab;$('scene-panel').hidden=tab!=='scene';$('library-panel').hidden=tab!=='library';document.querySelectorAll('[data-left-tab]').forEach(b=>b.classList.toggle('active',b.dataset.leftTab===tab));if(tab==='library')renderLibrary();}
 function setRightTab(tab){rightTab=tab;$('inspector').hidden=tab!=='object';$('simulation-panel').hidden=tab!=='simulation';$('research-panel').hidden=tab!=='research';$('design-panel').hidden=tab!=='design';document.body.classList.toggle('design-mode',tab==='design');if(tab==='design'){designer?.render();designer?.refresh();}dirty=true;document.querySelectorAll('[data-right-tab]').forEach(b=>b.classList.toggle('active',b.dataset.rightTab===tab));if(tab==='simulation')renderSimulation();if(tab==='research')renderResearch();}
 function showLeft(){document.body.classList.remove('left-hidden');if(innerWidth<=980){$('left-dock').classList.add('mobile-open');$('right-dock').classList.remove('mobile-open');}resizeSoon();}
 function showRight(){document.body.classList.remove('right-hidden');if(innerWidth<=720){$('right-dock').classList.add('mobile-open');$('left-dock').classList.remove('mobile-open');}resizeSoon();}
 function openLibrary(){setLeftTab('library');showLeft();}
 function select(id,show=false,additive=false){if(id&&!object(id))return;endEdit();if(additive&&id){if(selection.has(id))selection.delete(id);else selection.add(id);selected=[...selection].at(-1)||null;}else{selected=id;selection=new Set(id?[id]:[]);}renderList();renderInspector();syncHistory();rebuildLabels();updateReadouts();dirty=true;rayCache=null;if(show){setRightTab('object');showRight();}}
 function renderLibrary(){const term=$('component-search').value.trim().toLowerCase();let html='',group='';for(const [type,c]of Object.entries(CATALOG)){if(term&&!`${c.label} ${c.description}`.toLowerCase().includes(term))continue;if(group!==c.group){group=c.group;html+=`<h3>${group}</h3>`;}html+=`<button class="component ${isSource({type})?'light':''}" data-add="${type}" draggable="true" title="${c.description}">${icon(c.icon)}<span>${c.label}</span><span class="plus">+</span></button>`;}$('library').innerHTML=html||'<p class="no-matches">No matching components.</p>';}
 function field(key,label,min,max,step,value,unit='',options={}){
  const prefix=options.settings?'setting':'prop',digits=step<.01?3:step<.1?2:step<1?1:0;
  let sliderMin=min,sliderMax=max;if(max>100){sliderMax=Math.min(max,Math.max(options.sliderMax||100,Math.ceil(Math.abs(value)*1.5/10)*10));if(min<0)sliderMin=-sliderMax;}if(key==='count'){sliderMax=16384;sliderMin=1;}
  return `<div class="field"><div class="field-head"><label for="${prefix}-${key}">${label}</label><span class="value-wrap"><input type="number" id="${prefix}-${key}" data-${prefix}="${key}" min="${min}" max="${max}" step="${step}" value="${Number(value).toFixed(digits)}" aria-label="${label}"><span class="unit">${unit}</span></span></div><input type="range" class="${options.spectrum?'spectrum':''}" data-${prefix}="${key}" min="${sliderMin}" max="${sliderMax}" step="${step}" value="${value}" aria-label="${label} slider"></div>`;
 }
 const checkbox=(key,title,value,settings=false,ico='')=>`<label class="toggle"><span>${ico?icon(ico):''}${title}</span><input type="checkbox" data-${settings?'setting':'prop'}="${key}" ${value?'checked':''}></label>`;
 function renderInspector(){
  const o=current(),root=$('inspector');root.querySelectorAll('details[data-fold]').forEach(d=>foldState.set(d.dataset.fold,d.open));if(!o){root.innerHTML=`<div class="inspector-empty">${icon('cursor')}<h2>Your optical workbench.</h2><p>Select a light, mirror or optical component to edit its position and properties.</p><button class="bordered" id="inspector-add">${icon('plus')}Add a component</button></div>`;return;}
  const light=isSource(o),c=CATALOG[o.type];
  let html=`<div class="inspector-header"><div class="object-type"><span>${icon(c.icon)}${c.label}</span><div class="object-actions"><button id="lock-object" title="${o.locked?'Unlock':'Lock'} transform" aria-label="${o.locked?'Unlock':'Lock'} selected object">${icon(o.locked?'lock':'unlock')}</button><button id="copy-object" title="Copy (Ctrl/⌘ C)" aria-label="Copy selected objects">${icon('copy')}</button><button id="delete-object" title="Delete" aria-label="Delete selected object">${icon('trash')}</button></div></div><input class="inspector-name" data-prop="name" value="${esc(o.name)}" maxlength="60" aria-label="Object name"></div>`;
  if(o.type==='detector')html+=`<div class="detector-entry"><button id="detector-analyze">${icon('detector')}Analyze this detector <span>→</span></button></div>`;
  if(isMirror(o))html+=`<div class="inverse-entry"><button id="design-open-selected">${icon('spark')}${o.type==='shaped'?'Edit inverse design':'Auto-shape to detector'}<span>→</span></button><p>Change the surface, not just its aim.</p></div>`;
  html+=`<section class="section"><h3>Transform <span>${o.locked?'LOCKED':'WORLD SPACE'}</span></h3><div class="triple-label"><span>Position</span><span class="unit">units</span></div><div class="position-fields">${['x','y','z'].map((a,i)=>`<label class="number-field ${a}"><span>${a.toUpperCase()}</span><input type="number" data-prop="p${i}" value="${o.p[i].toFixed(2)}" min="-1000000" max="1000000" step=".1" aria-label="${a.toUpperCase()} position" ${o.locked?'disabled':''}></label>`).join('')}</div>`;
  html+='<details class="orientation" data-fold="orientation"><summary>Orientation & direction</summary>'+field('yaw','Yaw',-180,180,.1,o.yaw,'°')+field('tilt',light?'Elevation':'Tilt',-90,90,.1,o.tilt,'°')+field('roll','Roll',-180,180,.1,o.roll,'°');html+='</details></section>';
  if(light){
   html+=`<section class="section"><h3>Emission</h3><label class="compact-select">Source type<select data-prop="type" aria-label="Source type">${Object.entries(CATALOG).filter(([t])=>isSource({type:t})).map(([t,c])=>`<option value="${t}" ${o.type===t?'selected':''}>${c.label}</option>`).join('')}</select></label>`;
   if(o.type!=='laser')html+=field('count','Ray samples',1,16384,1,o.count);
   if(['beam','star','spot','fan','line','area'].includes(o.type)){if(['beam','star'].includes(o.type))html+=field('aperture',o.type==='star'?'Wavefront diameter':'Beam diameter',0,10000,.05,o.aperture,'u');if(['area','line'].includes(o.type))html+=field('width','Emitter width',.1,10000,.1,o.width,'u');if(o.type==='area')html+=field('height','Emitter height',.1,10000,.1,o.height,'u');if(o.type!=='star')html+=field('spread',o.type==='fan'?'Fan half-angle':o.type==='spot'?'Cone half-angle':'Divergence half-angle',0,85,.1,o.spread,'°');}
   if(o.type==='star')html+=field('fieldX','Field X',-30,30,.01,o.fieldX,'°')+field('fieldY','Field Y',-30,30,.01,o.fieldY,'°')+field('angularDiameter','Angular diameter',0,3600,.1,o.angularDiameter,'″')+'<p class="note">Collimated for a point star. Lock to the primary to keep pupil sampling fixed while changing field angle. Angular diameter samples a uniform apparent disk, not seeing or diffraction.</p>';
   html+=field('power','Source power',0,5,.05,o.power,'a.u.');
   html+=`<div class="target-lock"><label for="aim-target">Aim toward an object</label><select id="aim-target" aria-label="Aim source at object"><option value="">Choose a target…</option>${state.objects.filter(t=>t.id!==o.id).map(t=>`<option value="${t.id}" ${o.aimTarget===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select><div class="target-actions"><button id="aim-once" class="bordered" ${o.locked?'disabled':''}>Aim once</button><button id="lock-target" class="${o.aimTarget?'active':'bordered'}" ${o.locked&&!o.aimTarget?'disabled':''}>${icon(o.aimTarget?'lock':'crosshair')}${o.aimTarget?'Release lock':'Lock onto'}</button></div><p class="lock-status">${o.aimTarget?'Tracking '+esc(object(o.aimTarget)?.name||'target')+' · updates when either object moves.':'Aim once sets direction. Lock onto keeps following the target.'}</p></div><div class="source-tools"><button id="isolate-source" class="${isolateSource===o.id?'active':'bordered'}">${icon('eye')}${isolateSource===o.id?'Show all rays':'Only this source'}</button></div><p class="note">Power is divided across the emitted samples. Display emphasis never changes the traced power.</p></section>`;
   html+=`<section class="section"><h3>Light color</h3><label class="compact-select">Color mode<select data-prop="colorMode" aria-label="Color mode"><option value="rgb" ${o.colorMode==='rgb'?'selected':''}>Custom RGB</option><option value="wavelength" ${o.colorMode==='wavelength'?'selected':''}>Wavelength</option></select></label>`;
   if(o.colorMode==='rgb')html+=`<div class="color-line"><input type="color" data-prop="color" value="${o.color}" aria-label="Light color"><input type="text" data-prop="color" value="${o.color.toUpperCase()}" maxlength="7" aria-label="Hex color"><span class="color-caption">RGB</span></div><div class="swatches">${swatchColors.map(color=>`<button class="swatch ${o.color.toLowerCase()===color?'active':''}" data-color="${color}" style="--swatch:${color}" title="${color}" aria-label="Set light color ${color}"></button>`).join('')}</div>`;
   else html+=field('wavelength','Wavelength',380,780,1,o.wavelength,'nm',{spectrum:true})+'<p class="note">Spectral display colors are approximate. Wavelength affects dispersive glass.</p>';
   html+='</section>';
  }else{
   html+=`<section class="section"><h3>${o.type==='detector'?'Screen geometry':'Optical properties'}</h3>`;
   if(['parabola','shaped','spherical','lens'].includes(o.type))html+=field('diameter','Aperture diameter',.1,o.type==='spherical'?Math.min(10000,o.radius*1.98):10000,.1,o.diameter,'u');
   if(!['parabola','shaped','spherical','lens','glass'].includes(o.type))html+=`<div class="dimensions"><div><label for="prop-width">Width</label><input id="prop-width" type="number" data-prop="width" min=".01" max="10000" step=".1" value="${o.width}" aria-label="Width"></div><div><label for="prop-height">Height</label><input id="prop-height" type="number" data-prop="height" min=".01" max="10000" step=".1" value="${o.height}" aria-label="Height"></div></div>`;
   if(['parabola','trough','lens'].includes(o.type))html+=field('focalLength','Focal length',o.type==='lens'?-10000:.3,10000,.1,o.focalLength,'u');
   if(o.type==='spherical'){html+=`<label class="compact-select">Curvature<select data-prop="curvature" aria-label="Mirror curvature"><option value="concave" ${o.curvature==='concave'?'selected':''}>Concave</option><option value="convex" ${o.curvature==='convex'?'selected':''}>Convex</option></select></label>`+field('radius','Radius of curvature',.3,20000,.1,o.radius,'u');}
   
  if(isMirror(o))html+=field('reflectivity','Reflectivity',0,1,.01,o.reflectivity);
   if(o.type==='splitter')html+=field('ratio','Reflected fraction',0,1,.01,o.ratio)+`<p class="note" id="split-ratio">${Math.round(o.ratio*100)}% reflected · ${Math.round((1-o.ratio)*100)}% transmitted. Both paths are traced.</p>`;
   if(o.type==='glass')html+=field('radius','Sphere radius',.15,20000,.05,o.radius,'u')+field('ior','Refractive index',1.001,2.5,.001,o.ior)+field('dispersion','Dispersion B',0,.02,.001,o.dispersion,'µm²')+checkbox('fresnel','Trace Fresnel reflections',o.fresnel);
   if(o.type==='glass'||o.type==='lens')html+=field('transmission','Transmission factor',0,1,.01,o.transmission);
   if(o.type==='aperture')html+=field('hole','Opening diameter',.1,Math.min(o.width,o.height),.1,o.hole,'u');
   if(o.type==='detector')html+=checkbox('absorb','Absorb rays at the screen',o.absorb)+field('minDepth','Record after interactions',0,32,1,o.minDepth||0)+'<p class="note">0 = a normal detector. Use 1 for a virtual focal plane that ignores direct starlight and intercepts rays only after an optical interaction.</p>';
   const note=o.type==='shaped'?'A fixed analytic conic. Its focus and wavefront constraint are stored in the mirror’s local mount coordinates. Open inverse design to re-solve or bind it to a detector.':o.type==='parabola'?'A true paraboloid: parallel, on-axis rays meet at one point. Positive local Z points into the bowl.':o.type==='trough'?'Curved in one axis only. Parallel rays form a line focus along the trough.':o.type==='spherical'?'The marked focus is paraxial (R/2). Off-axis and wide-aperture aberration is simulated.':o.type==='lens'?'Ideal paraxial lens. Positive f converges; negative f diverges. Zero focal length is not allowed.':o.type==='glass'?'A sphere surrounded by air. Do not overlap or nest glass volumes. Fresnel off omits ordinary reflection losses, but keeps total internal reflection.':c.description;
   html+=`<p class="note">${note}</p>`;if(o.type==='parabola')html+='<div class="formula">z = (x² + y²) / 4f</div>';if(o.type==='trough')html+='<div class="formula">z = x² / 4f</div>';html+='</section>';
   if(o.type==='detector')html+='<section class="section"><h3>Live detector <span>SAMPLED RAYS</span></h3><div class="detector-stats"><div class="statbox"><b id="detector-power">0.000</b><small>Incident power · a.u.</small></div><div class="statbox"><b id="detector-count">0</b><small>Ray crossings</small></div></div><canvas class="detector-map" id="detector-map" width="480" height="270" aria-label="Detector ray-hit positions"></canvas><p class="note">Local screen coordinates. Colored marks show sampled hits, not a reconstructed intensity image.</p></section>';
   
  if(isMirror(o))html+='<section class="section"><h3>Measured reflection</h3><div class="formula" id="live-angle">Tracing…</div><p class="note">One sampled incident ray, measured from the local surface normal.</p></section>';
  }
  html+=`<section class="section">${checkbox('enabled','Enabled in simulation',o.enabled)}<p class="note">${light?'Source color is preserved through ideal reflections.':'Decorative mounts do not interact with rays.'}</p></section>`;
  root.innerHTML=html;
  if(selection.size>1){const hint=document.createElement('div');hint.className='multi-selection';hint.textContent=`${selection.size} selected · copy, delete and move act on the group. Fields edit ${o.name}.`;root.querySelector('.inspector-header').append(hint);}
  root.querySelectorAll('.section').forEach(section=>{const h=section.querySelector(':scope > h3');if(!h)return;const key=h.childNodes[0]?.textContent.trim()||h.textContent,details=document.createElement('details'),summary=document.createElement('summary');details.className='section';details.dataset.fold=key;details.open=foldState.has(key)?foldState.get(key):!['Light color','Measured reflection'].includes(key);summary.append(h);details.append(summary);while(section.firstChild)details.append(section.firstChild);section.replaceWith(details);});
  root.querySelectorAll('details[data-fold]').forEach(d=>{if(foldState.has(d.dataset.fold))d.open=foldState.get(d.dataset.fold);});root.querySelectorAll('input[type=range]').forEach(setRangeFill);
  if(o.aimTarget)root.querySelectorAll('[data-prop="yaw"],[data-prop="tilt"]').forEach(e=>e.disabled=true);
  if(o.locked)root.querySelectorAll('[data-prop="yaw"],[data-prop="tilt"],[data-prop="roll"]').forEach(e=>e.disabled=true);updateReadouts();
 }
 function renderSimulation(){
  const s=state.settings;$('simulation-panel').innerHTML=`<section class="section"><h3>Ray appearance</h3><label class="display-select">Drawing style<select data-setting="rayStyle" aria-label="Ray drawing style"><option value="clarity" ${s.rayStyle==='clarity'?'selected':''}>Clear lines · no additive whiteout</option><option value="glow" ${s.rayStyle==='glow'?'selected':''}>Soft glow · luminous illustration</option><option value="bounce" ${s.rayStyle==='bounce'?'selected':''}>By bounce · distinguish interactions</option></select></label>${field('rayOpacity','Line opacity',.05,1,.05,s.rayOpacity,'',{settings:true})}${field('rayWidth','Line width',.4,3,.1,s.rayWidth,'×',{settings:true})}<label class="display-select">Visible paths<select data-setting="rayStage" aria-label="Visible ray paths"><option value="all" ${s.rayStage!=='interacted'?'selected':''}>All rays</option><option value="interacted" ${s.rayStage==='interacted'?'selected':''}>After first optical interaction</option></select></label><p class="note">High sample counts are automatically dimmed to keep overlaps legible. Select a light to emphasize its rays, or use “Only this source” in its inspector. These are display changes, not optical losses.</p></section>
  <section class="section"><h3>Simulation</h3>${field('density','Global ray density',.25,8,.25,s.density,'×',{settings:true})}${field('maxBounces','Interaction limit',1,32,1,s.maxBounces,'',{settings:true})}${field('maxDistance','Maximum path length',1,4000000,1,s.maxDistance,'u',{settings:true})}${field('displayBudget','Visible segment budget',1000,100000,1000,s.displayBudget,'',{settings:true,sliderMax:100000})}<p class="note">Up to 16,384 emitted rays per source, 65,536 per scene, and 100,000 traced segments. The display can sample whole paths at a lower budget without reducing detector analysis. Budgets are reported in the status bar.</p></section>
  <section class="section"><h3>Workspace</h3><label class="display-select">Canvas background<select data-setting="background" aria-label="Canvas background"><option value="studio" ${s.background==='studio'?'selected':''}>Studio · deep blue</option><option value="midnight" ${s.background==='midnight'?'selected':''}>Midnight · high contrast</option><option value="slate" ${s.background==='slate'?'selected':''}>Slate · lighter surfaces</option></select></label>${field('incidentOpacity','Incoming path opacity',.05,1,.05,s.incidentOpacity,'',{settings:true})}<p class="note">Dim incident paths without dimming their reflections. This is a display choice, not an optical loss.</p><h3 style="margin-top:24px">Overlays</h3>${checkbox('animate','Animate light flow',s.animate,true,'play')}${checkbox('grid','World grid',s.grid,true,'grid')}${checkbox('labels','All object labels',s.labels,true,'layers')}${checkbox('foci','Focal markers',s.foci,true,'crosshair')}${checkbox('normals','Surface normals',s.normals,true,'normal')}${checkbox('showMeasurements','Floating measurement card',s.showMeasurements,true,'detector')}${checkbox('extensions','Backward ray extensions',s.extensions,true,'ray')}${checkbox('hideStands','Hide decorative stands',s.hideStands,true,'mirror')}<p class="note">A selected object is labeled even with all labels off. Backward extensions are construction lines, not additional rays.</p></section>
  <section class="section"><h3>Navigation</h3><label class="compact-select">Projection<select id="projection" aria-label="Camera projection"><option value="perspective" ${!renderer.camera.orthographic?'selected':''}>Perspective</option><option value="orthographic" ${renderer.camera.orthographic?'selected':''}>Orthographic</option></select></label><label class="toggle"><span>Invert horizontal orbit</span><input id="invert-orbit" type="checkbox" ${preferences.invertOrbit?'checked':''}></label>${checkbox('snap','Snap transforms',s.snap,true,'magnet')}<p class="note">Left drag orbits. Right / middle drag pans. Move with Shift to raise or lower; X/Y/Z constrain an axis. Position fields accept ±1,000,000 units. Home frames the entire scene.</p></section><section class="section"><button id="simulation-focus" class="bordered" style="width:100%;margin-bottom:9px">${icon('focus')}Hide interface <kbd>Tab</kbd></button><button id="simulation-fullscreen" class="bordered" style="width:100%">${icon('fullscreen')}Browser fullscreen <kbd>F</kbd></button></section>`;
  $('simulation-panel').querySelectorAll('input[type=range]').forEach(setRangeFill);
 }
 function syncInspectorFields(){const o=current();if(!o)return;$('inspector').querySelectorAll('[data-prop]').forEach(el=>{const k=el.dataset.prop;if(el===document.activeElement)return;let v=/^p\d$/.test(k)?o.p[+k[1]]:o[k];if(el.type==='checkbox')el.checked=!!v;else if(el.type==='number')el.value=Number(v).toFixed(+el.step<.01?3:+el.step<.1?2:+el.step<1?1:0);else el.value=v;if(el.type==='range')setRangeFill(el);});}
 function paintDetector(o,d){const c=$('detector-map');if(!c||!o)return;const ctx=c.getContext('2d'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.strokeStyle='#1a3040';ctx.lineWidth=1;for(let i=1;i<8;i++){ctx.beginPath();ctx.moveTo(i*w/8,0);ctx.lineTo(i*w/8,h);ctx.stroke();}for(let j=1;j<5;j++){ctx.beginPath();ctx.moveTo(0,j*h/5);ctx.lineTo(w,j*h/5);ctx.stroke();}ctx.strokeStyle='#304756';ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();ctx.globalCompositeOperation='source-over';for(const hit of d.hits){const x=(hit.local[0]/o.width+.5)*w,y=(.5-hit.local[1]/o.height)*h;ctx.fillStyle=`rgba(${hit.color.map(v=>Math.round(v*255)).join(',')},0.55)`;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();}ctx.globalCompositeOperation='source-over';ctx.fillStyle='#567a92';ctx.font='15px monospace';ctx.fillText('−u',10,h-10);ctx.fillText('+u',w-31,h-10);}
 function researchObjects(){
  const primaries=state.objects.filter(o=>['parabola','shaped','spherical','lens'].includes(o.type)&&o.enabled),detectors=state.objects.filter(o=>o.type==='detector'&&o.enabled);
  return {primaries,detectors,primary:primaries.find(o=>o.id===state.settings.primaryId)||primaries[0],detector:detectors.find(o=>o.id===state.settings.detectorId)||detectors[0]};
 }
 function researchData(){
  const {primary,detector}=researchObjects(),allHits=trace.detectors[detector?.id]?.hits||[],filterSource=state.objects.find(o=>isSource(o)&&o.id===state.settings.analysisSourceId),hits=filterSource?allHits.filter(h=>h.sourceId===filterSource.id):allHits;
  const groups=state.objects.filter(isSource).map(s=>({source:s,hits:hits.filter(h=>h.sourceId===s.id)})).filter(g=>g.hits.length);
  return {primary,detector,hits,allHits,filterSource,groups,stats:spotStatistics(hits)};
 }
 function formatLength(world){const mm=world*state.settings.mmPerUnit;if(!Number.isFinite(mm))return '—';if(Math.abs(mm)<1e-8)return '≈ 0 µm';if(Math.abs(mm)<.1)return (mm*1000).toPrecision(3)+' µm';return mm.toPrecision(4)+' mm';}
 function renderResearch(){
  const root=$('research-panel'),{primaries,detectors,primary,detector}=researchObjects();
  root.querySelectorAll('[data-analysis-fold]').forEach(d=>foldState.set('analysis-'+d.dataset.analysisFold,d.open));
  const fold=(key,initial=false)=>foldState.get('analysis-'+key)??initial;
  if(!detector){root.innerHTML=`<div class="research-intro"><p class="analysis-kicker">ANY SOURCE · ANY SCENE</p><h2>See where the light lands.</h2><p>All detectors share the same live analysis tools. There is no separate Star lab mode.</p></div><div class="empty-analysis">${icon('detector')}<p>Add or enable a detector to measure incident power, compare sources, and inspect geometric spots.</p><div class="analysis-empty-links"><button class="primary" data-add="detector">${icon('plus')}Add detector</button><button class="bordered" data-add="star">${icon('star')}Add distant star</button></div><button id="analysis-examples" class="bordered" style="margin-top:16px">Browse live experiments →</button><p class="note">A spot diagram shows geometric ray hits. It is not a wave-optical point-spread function.</p></div>`;updateResearch();return;}
  const options=(items,value)=>items.map(o=>`<option value="${o.id}" ${o.id===value?.id?'selected':''}>${esc(o.name)}</option>`).join('');
  const f=primary&&primary.type!=='shaped'?(primary.type==='spherical'?primary.radius/2*(primary.curvature==='convex'?-1:1):primary.focalLength):0,offset=primary&&primary.type!=='shaped'?V.dot(V.sub(detector.p,primary.p),basis(primary).n)-f:0;
  const sources=state.objects.filter(isSource),filter=sources.find(o=>o.id===state.settings.analysisSourceId);
  root.innerHTML=`<div class="research-intro"><p class="analysis-kicker">INTEGRATED DETECTOR ANALYSIS</p><h2>See where the light lands.</h2><p>Full traced samples, independent of visible ray density.</p><p id="research-warning" class="analysis-warning" hidden></p></div><section class="section"><label class="compact-select">Detector<select data-research="detectorId" aria-label="Analysis detector">${options(detectors,detector)}</select></label><label class="compact-select">Sources<select data-research="analysisSourceId" aria-label="Analysis source filter"><option value="" ${!filter?'selected':''}>All sources</option>${options(sources,filter)}</select></label><canvas class="research-map" id="research-map" width="600" height="480" aria-label="Geometric detector spot diagram. Click to expand."></canvas><div class="spot-legend" id="spot-legend"></div><div class="analysis-actions"><button id="analysis-pin" class="bordered ${state.workspace.monitor?'active':''}" aria-pressed="${state.workspace.monitor}">${icon('detector')}${state.workspace.monitor?'Unpin monitor':'Pin live monitor'}</button><button id="analysis-expand" class="bordered">${icon('fullscreen')}Expand</button></div><div class="research-metrics"><div class="research-metric"><strong id="research-hit-count">—</strong><span>Recorded samples</span></div><div class="research-metric"><strong id="research-power">—</strong><span>Incident power · a.u.</span></div></div><div id="source-results"></div><div class="analysis-actions"><button id="research-export" class="bordered">${icon('save')}Hits CSV</button><button id="research-export-png" class="bordered">${icon('camera')}Plot PNG</button></div><p class="note">Statistics and exports respect the source filter. RMS radii are power-weighted around each source’s own centroid; viewport color is not calibrated irradiance.</p></section>
  <details class="section" data-analysis-fold="plot" ${fold('plot')?'open':''}><summary><h3>Plot & display</h3></summary><div class="analysis-options">${['spotAutoFit','spotCentroids','spotRms','airyReference'].map((k,i)=>`<label class="toggle"><span>${['Auto-fit focal spots','Show source centroids','RMS-radius circles','Airy reference circles'][i]}</span><input type="checkbox" data-research="${k}" ${state.settings[k]?'checked':''}></label>`).join('')}</div><button id="research-ray-stage" class="research-action bordered">${icon('ray')}${state.settings.rayStage==='interacted'?'Show full light paths':'Only interacted light paths'}</button><p class="note">These controls change the display, never the traced rays. Airy circles use a circular-aperture reference, not a diffraction calculation.</p></details>
  <details class="section" data-analysis-fold="telescope" ${fold('telescope')?'open':''}><summary><h3>Telescope & physical scale</h3></summary><label class="compact-select">Primary<select data-research="primaryId" aria-label="Analysis primary">${options(primaries,primary)||'<option value="">None — geometric hits only</option>'}</select></label><div id="telescope-reference"></div><label class="compact-select">mm per world unit<input data-research="mmPerUnit" id="research-world-scale" type="number" min=".001" max="1000000" step=".1" value="${state.settings.mmPerUnit}" aria-label="Millimeters per world unit" style="width:110px"></label><p class="note">An Airy reference assumes an unobstructed circular aperture. Diffraction, atmospheric seeing, interference and detector pixel responses are not simulated.</p></details>
  <details class="section" data-analysis-fold="focus" ${fold('focus')?'open':''}><summary><h3>Focal-plane placement</h3></summary><label class="compact-select">Focus offset · units<input data-research="focusOffset" type="number" min="-10000" max="10000" step=".01" value="${offset.toFixed(3)}" aria-label="Focus offset" style="width:110px" ${!primary||primary.type==='shaped'||detector.locked?'disabled':''}></label><button id="research-focus" class="research-action bordered" ${!primary||primary.type==='shaped'||detector.locked?'disabled':''}>Place at nominal focus</button><p class="note">This aligns the screen to the primary’s forward axis. Use ordinary transforms for folded paths. For inverse reflectors, move the detector and re-solve in Shape. “Record after interactions” in the detector inspector can exclude incident rays.</p></details>`;
  updateResearch();
 }
 function updateResearch(){
  const data=researchData(),{primary,detector,hits,groups,stats}=data,pending=needsTrace||traceBusy;
  if($('research-warning')){$('research-warning').hidden=!pending&&!trace.limited&&!trace.seedLimited;$('research-warning').textContent=pending?'Tracing updated geometry… displayed results are from the last completed trace.':trace.limited?'Trace capped: statistics may be incomplete. Reduce density or interaction count.':'Sample budget reached. Statistics use the resampled rays, not the requested count.';}
  if($('research-hit-count')){
   $('research-hit-count').textContent=hits.length.toLocaleString();$('research-power').textContent=stats.power.toFixed(3);
   $('spot-legend').innerHTML=groups.map(g=>`<span><i style="background:rgb(${sourceColor(g.source).map(v=>Math.round(v*255)).join(',')})"></i>${esc(g.source.name)}</span>`).join('')||'<span>No recorded hits</span>';
   $('source-results').innerHTML=groups.map(g=>{const st=spotStatistics(g.hits);return `<div class="source-result"><b>${esc(g.source.name)}</b><br>RMS radius <strong>${formatLength(st.rms)}</strong> · 80% radius ${formatLength(st.radius80)}<br>Centroid ${formatLength(st.centroid[0])}, ${formatLength(st.centroid[1])}</div>`;}).join('');
   const ref=telescopeReference(primary,state.settings.mmPerUnit,550);
   $('telescope-reference').innerHTML=ref?`<div class="ref-line"><span>Aperture</span><strong>${ref.diameterMm.toPrecision(4)} mm</strong></div><div class="ref-line"><span>Focal length</span><strong>${ref.focalMm.toPrecision(4)} mm · f/${ref.fNumber.toFixed(2)}</strong></div><div class="ref-line"><span>Plate scale</span><strong>${ref.plateScale.toFixed(2)} ″/mm</strong></div><div class="ref-line"><span>Rayleigh ref. · 550 nm</span><strong>${ref.rayleighArcsec.toFixed(3)} ″</strong></div>`:`<p class="note">${primary?.type==='shaped'?'On-axis Airy and plate-scale shortcuts do not describe a general inverse reflector.':'Add a parabolic primary, spherical mirror or thin lens for telescope reference values. Detector measurements remain available without one.'}</p>`;
   paintResearch(data);
  }
  for(const id of ['research-export','research-export-png','analysis-png','analysis-csv'])if($(id))$(id).disabled=pending||!detector||(['research-export','analysis-csv'].includes(id)&&!hits.length);
  $('detector-monitor').hidden=!state.workspace?.monitor;
  if(state.workspace?.monitor){$('monitor-title').textContent=detector?.name||'No active detector';paintResearch(data,$('monitor-map'));$('monitor-summary').textContent=pending?'Tracing updated geometry…':`${hits.length.toLocaleString()} samples · ${stats.power.toFixed(3)} a.u.${data.filterSource?' · filtered':''}`;}
  if($('analysis-dialog').open){$('expanded-title').textContent=detector?.name||'Detector analysis';$('expanded-subtitle').textContent=(data.filterSource?.name||'All sources')+' · '+state.settings.mmPerUnit+' mm per world unit';$('expanded-summary').textContent=pending?'Tracing updated geometry…':`${hits.length.toLocaleString()} geometric hits · ${stats.power.toFixed(3)} a.u. · not a diffraction PSF`;paintResearch(data,$('expanded-map'));}
 }

 function paintResearch(data,targetCanvas=null){
  const canvas=targetCanvas||$('research-map');if(!canvas)return;if(!data.detector){const c=canvas.getContext('2d');c.fillStyle='#0b131e';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#9bb5c5';c.font='24px system-ui';c.textAlign='center';c.fillText('No enabled detector',canvas.width/2,canvas.height/2);return;}const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,{detector,primary,hits,groups}=data,pad=55,plotW=W-2*pad,plotH=H-2*pad;
  ctx.textAlign='left';ctx.fillStyle='#0b131e';ctx.fillRect(0,0,W,H);const drawnGroups=groups.map(g=>({...g,stats:spotStatistics(g.hits),reference:telescopeReference(primary,state.settings.mmPerUnit,g.source.colorMode==='wavelength'?g.source.wavelength:550)}));
  let center=[0,0],halfW=detector.width/2,halfH=detector.height/2;
  if(state.settings.spotAutoFit&&hits.length){
   const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const h of hits)for(let i=0;i<2;i++){lo[i]=Math.min(lo[i],h.local[i]);hi[i]=Math.max(hi[i],h.local[i]);}
   for(const g of drawnGroups){const r=Math.max(state.settings.airyReference?(g.reference?.airyRadiusWorld||0):0,state.settings.spotRms?g.stats.rms:0);for(let i=0;i<2;i++){lo[i]=Math.min(lo[i],g.stats.centroid[i]-r);hi[i]=Math.max(hi[i],g.stats.centroid[i]+r);}}
   center=V.mix(lo,hi,.5);halfW=Math.max(1e-7,(hi[0]-lo[0])*.68);halfH=Math.max(1e-7,(hi[1]-lo[1])*.68);
  }
  const scale=Math.min(plotW/(2*halfW),plotH/(2*halfH)),origin=[W/2,H/2],project=p=>[origin[0]+(p[0]-center[0])*scale,origin[1]-(p[1]-center[1])*scale];
  ctx.strokeStyle='#243648';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=4;i++){const x=pad+plotW*i/4,y=pad+plotH*i/4;ctx.moveTo(x,pad);ctx.lineTo(x,H-pad);ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);}ctx.stroke();
  ctx.save();ctx.beginPath();ctx.rect(pad,pad,plotW,plotH);ctx.clip();
  for(const g of drawnGroups){ctx.fillStyle=`rgba(${sourceColor(g.source).map(v=>Math.round(v*255)).join(',')},.54)`;for(const h of g.hits){const [x,y]=project(h.local);ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fill();}}
  for(const g of drawnGroups){const [x,y]=project(g.stats.centroid);ctx.strokeStyle=`rgb(${sourceColor(g.source).map(v=>Math.round(v*255)).join(',')})`;ctx.lineWidth=1.5;if(state.settings.spotCentroids){ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();}if(state.settings.spotRms){ctx.setLineDash([2,4]);ctx.beginPath();ctx.arc(x,y,g.stats.rms*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}if(state.settings.airyReference&&g.reference){ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(x,y,g.reference.airyRadiusWorld*scale,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}}
  ctx.restore();ctx.fillStyle='#a4b9c9';ctx.font='26px system-ui';ctx.fillText(state.settings.spotAutoFit?'Geometric spots · auto-fit':'Geometric spots · full detector',pad,30);
  ctx.fillStyle='#8ba4b6';ctx.font='26px monospace';ctx.textAlign='center';const spanX=plotW/scale;
  ctx.fillText('u span '+formatLength(spanX),W/2,H-17);ctx.save();ctx.translate(21,H/2);ctx.rotate(-Math.PI/2);ctx.fillText('v span '+formatLength(plotH/scale),0,0);ctx.restore();ctx.textAlign='left';
  if(!hits.length){ctx.fillStyle='#a0b6c6';ctx.font='22px system-ui';ctx.textAlign='center';ctx.fillText('No rays on this detector',W/2,H/2);ctx.font='17px system-ui';ctx.fillText('Check focus position and path length',W/2,H/2+32);ctx.textAlign='left';}
 }
 function placeFocalPlane(offset=0){const {primary,detector}=researchObjects();if(!primary||!detector||detector.locked)return;if(primary.type==='shaped'){toast('Use the inverse-design target and ordinary detector transforms for a shaped primary.');return;}mutate(()=>{const f=primary.type==='spherical'?primary.radius/2*(primary.curvature==='convex'?-1:1):primary.focalLength;detector.p=V.add(primary.p,V.mul(basis(primary).n,f+offset)).map(v=>clamp(v,-POSITION_LIMIT,POSITION_LIMIT));detector.yaw=primary.yaw;detector.tilt=primary.tilt;detector.roll=primary.roll;});toast('Analysis plane positioned along the primary’s forward focus.');}
 function exportSpotCSV(){if(needsTrace||traceBusy){toast('Wait for the current trace to finish before exporting.');return;}const {detector,hits}=researchData();if(!detector||!hits.length){toast('There are no focal-plane hits to export.');return;}const quote=v=>'"'+String(v).replace(/"/g,'""')+'"',lines=['source,ray_index,u_world,v_world,u_mm,v_mm,x_world,y_world,z_world,power_arb,wavelength_nm,interactions'];for(const h of hits)lines.push([quote(object(h.sourceId)?.name||h.sourceId),h.rayIndex,h.local[0],h.local[1],h.local[0]*state.settings.mmPerUnit,h.local[1]*state.settings.mmPerUnit,...h.point,h.energy,h.wavelength||550,h.depth].join(','));download(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}),'lumen-focal-hits.csv');toast(`${hits.length.toLocaleString()} geometric hit samples exported.`);}
 $('research-panel').addEventListener('change',e=>{const key=e.target.dataset.research;if(!key)return;if(key==='focusOffset'){const v=Number(e.target.value);if(Number.isFinite(v))placeFocalPlane(clamp(v,-10000,10000));return;}if(key==='mmPerUnit'){const v=Number(e.target.value);if(!Number.isFinite(v)||v<=0){toast('World scale must be positive.');renderResearch();return;}mutate(()=>state.settings.mmPerUnit=clamp(v,.001,1000000));}else mutate(()=>state.settings[key]=e.target.type==='checkbox'?e.target.checked:e.target.value);});

 function renderExamples(){
  $('quick-examples').innerHTML=['inverse','finite','focus','splitter','rgb'].map(k=>`<button class="example-mini ${state.preset===k?'active':''}" data-preset="${k}">${icon(PRESETS[k].icon)}<span><b>${PRESETS[k].title}</b><small>${({inverse:'Reverse-design a mirror',finite:'Point to point in 3D',focus:'A true 3D point focus',collimator:'From a point to a beam',splitter:'Two power-weighted paths',rgb:'Independent light colors',lens:'Converging thin lens'})[k]}</small></span></button>`).join('');
  $('examples-grid').innerHTML=Object.entries(PRESETS).map(([k,p])=>`<button class="example-card ${state.preset===k?'active':''}" data-preset="${k}">${icon(p.icon)}<div><h3>${p.title}</h3><p>${p.subtitle}</p></div></button>`).join('');
 }
 function syncButtons(){
  for(const [id,key]of [['grid-button','grid'],['normals-button','normals'],['foci-button','foci'],['snap-button','snap'],['play-button','animate']]){$(id).classList.toggle('active',state.settings[key]);$(id).setAttribute('aria-pressed',String(state.settings[key]));}
  $('play-button').innerHTML=icon(state.settings.animate?'pause':'play');$('live-label').textContent=state.settings.animate?'LIVE TRACE':'FLOW PAUSED';
 }
 function loadPreset(name){activateProject(buildDemoScene(name),{demo:name,blank:name==='empty'});}
 function nextId(){return 'o'+(1+Math.max(0,...state.objects.map(o=>parseInt(o.id.slice(1))||0)));}
 function addComponent(type,p=null){if(state.objects.length>=80){toast('This workbench supports up to 80 objects.');return;}
  mutate(()=>{let at=p?[...p]:V.add(renderer.camera.target,isSource({type})?[-5,0,0]:[0,0,0]);if(!p)for(let i=0;i<12&&state.objects.some(o=>V.len(V.sub(o.p,at))<.7);i++)at=V.add(at,[.6,0,.5]);const o=createObject(type,nextId(),at);const same=state.objects.filter(q=>q.type===type).length;if(same)o.name+=' '+(same+1);state.objects.push(o);selected=o.id;selection=new Set([o.id]);});setMode('move');setRightTab('object');if(innerWidth<=980)$('left-dock').classList.remove('mobile-open');showRight();toast(CATALOG[type].label+' added. Drag it to position it.');
 }
 function duplicate(){const items=selectedObjects();if(!items.length)return;try{const copies=cloneObjects(state,{format:'lumen-objects',sceneUid:state.uid,objects:items});mutate(()=>{state.objects.push(...copies);selection=new Set(copies.map(o=>o.id));selected=copies.at(-1).id;});toast(`${copies.length} object${copies.length===1?'':'s'} duplicated.`);}catch(e){toast(e.message);}}
 function removeSelected(){const items=selectedObjects();if(!items.length)return;if(items.some(o=>o.locked)){toast('Unlock all selected objects before deleting them.');return;}mutate(()=>{state.objects=state.objects.filter(o=>!selection.has(o.id));selection.clear();selected=state.objects[0]?.id||null;});toast('Selection removed.');}
 function resizeSoon(){requestAnimationFrame(()=>{renderer.resize();dirty=true;rayCache=null;});}
 function setMode(next){mode=next;axis=null;document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===next);b.setAttribute('aria-pressed',String(b.dataset.mode===next));});document.querySelectorAll('[data-axis]').forEach(b=>b.classList.remove('active'));$('mode-hint').textContent=next==='select'?'Drag to orbit · Right-drag to pan · Scroll to zoom':next==='move'?'Drag object or axis · Shift for height · X / Y / Z constrain':'Drag object to rotate · X / Y / Z constrain';canvas.style.cursor=next==='select'?'grab':next==='move'?'move':'crosshair';dirty=true;}
 function setAxis(next){axis=axis===next?null:next;document.querySelectorAll('[data-axis]').forEach(b=>b.classList.toggle('active',b.dataset.axis===axis));dirty=true;}
 function cameraChanged(){renderer.updateCamera();dirty=true;rayCache=null;if(state.workspace)state.workspace.camera=JSON.parse(JSON.stringify(renderer.camera));persist();}
 function frameScene(single=false){
  const targets=single&&current()?selectedObjects():state.objects,pts=[];
  if(!targets.length){renderer.camera.target=[0,2,0];renderer.camera.radius=22;cameraChanged();return;}
  for(const o of targets){if(o.type==='shaped'){const b=basis(o);pts.push(o.p);for(let i=0;i<80;i++){const a=i*Math.PI*2/80,x=o.diameter/2*Math.cos(a),y=o.diameter/2*Math.sin(a);pts.push(V.add(o.p,worldVec([x,y,surfaceZ(o,x,y)],b)));}continue;}let r=isSource(o)?(o.type==='beam'?Math.max(.5,o.aperture/2):.65):o.type==='glass'?o.radius:['parabola','shaped','spherical','lens'].includes(o.type)?o.diameter/2:Math.max(o.width,o.height)/2;r=Math.max(.5,r);for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])pts.push(V.add(o.p,[a*r,b*r,c*r]));}
  const min=[0,1,2].map(i=>Math.min(...pts.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...pts.map(p=>p[i])));renderer.camera.target=V.mix(min,max,.5);renderer.updateCamera();let extent=0;const aspect=renderer.width/renderer.height;
  for(const p of pts){const q=V.sub(p,renderer.camera.target),depth=-V.dot(q,renderer.forward);extent=Math.max(extent,Math.abs(V.dot(q,renderer.up))/Math.tan(renderer.fov/2)+depth,Math.abs(V.dot(q,renderer.right))/(Math.tan(renderer.fov/2)*aspect)+depth);}
  renderer.camera.radius=clamp(extent*1.15,1,5000000);cameraChanged();
 }
 function setView(next){view=next;const c=renderer.camera;
  if(next==='3d'){c.yaw=2.26;c.pitch=.43;c.orthographic=false;if(state.preset==='relay'){c.yaw=1.0;c.pitch=.49;}frameScene();}
  else{c.orthographic=true;if(next==='top'){c.yaw=Math.PI/2;c.pitch=Math.PI/2-.00001;}else if(next==='front'){c.yaw=Math.PI/2;c.pitch=0;}else{c.yaw=Math.PI;c.pitch=0;}frameScene();}
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));$('view-caption').textContent=next==='3d'?'3D OPTICS WORKSPACE':next.toUpperCase()+' · ORTHOGRAPHIC';$('view-chip').textContent=next==='3d'?'Perspective':next[0].toUpperCase()+next.slice(1);cameraChanged();if(rightTab==='simulation')renderSimulation();
 }
 function customView(){view='custom';document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));$('view-caption').textContent=renderer.camera.orthographic?'3D · ORTHOGRAPHIC':'3D OPTICS WORKSPACE';}
 function focusMode(){document.body.classList.toggle('focus');resizeSoon();}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Fullscreen is unavailable in this browser. Use Tab for the canvas-only workspace.');}catch{toast('Browser fullscreen was blocked. The app still fills its browser window; Tab hides the interface.');}}
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 function saveFile(){endEdit();flushProject();download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),`lumen-${state.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40)}.json`);toast('Scene saved as JSON.');}
 function screenshot(){exportAfterFrame=true;dirty=true;}
 function makeScreenshot(){exportAfterFrame=false;const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const ctx=out.getContext('2d');ctx.drawImage(canvas,0,0);const scale=out.width/renderer.width;ctx.save();ctx.scale(scale,scale);ctx.fillStyle='#d1e1e5';ctx.font='500 15px sans-serif';ctx.fillText('lumen / '+state.name,22,30);ctx.fillStyle='#7293a7';ctx.font='10px monospace';ctx.fillText('3D GEOMETRIC OPTICS',22,47);if(state.settings.labels)for(const l of labels){if(!l.id)continue;const q=renderer.project(labelPosition(object(l.id)));if(q.visible){ctx.font='10px monospace';const name=object(l.id)?.name||'',w=ctx.measureText(name).width+14;ctx.fillStyle='#102333dd';ctx.fillRect(q.x-w/2,q.y-19,w,19);ctx.fillStyle='#b6d4d8';ctx.fillText(name,q.x-w/2+7,q.y-6);}}ctx.restore();out.toBlob(blob=>{if(blob){download(blob,'lumen-view.png');toast('Viewport exported as PNG.');}else toast('Image export failed.');},'image/png');}
 function editControl(el){
  const k=el.dataset.prop,setting=el.dataset.setting;if(!k&&!setting)return;const o=setting?state.settings:current();if(!o)return;
  if(!setting&&((o.locked&&(/^p\d$/.test(k)||['yaw','tilt','roll'].includes(k)))||(o.aimTarget&&['yaw','tilt'].includes(k)))){syncInspectorFields();return;}
  beginEdit();const key=setting||k;let value;
  if(el.type==='checkbox')value=el.checked;
  else if(['name','type','curvature','colorMode','color','rayStyle','rayStage','background'].includes(key))value=el.value;
  else{if(!el.value.trim()||!Number.isFinite(Number(el.value))){syncInspectorFields();return;}value=clamp(Number(el.value),Number(el.min),Number(el.max));}
  if(key==='color'){if(!/^#[\da-f]{6}$/i.test(value)){toast('Use a six-digit hex color, such as #80C7FF.');syncInspectorFields();return;}value=value.toLowerCase();}
  if(key==='name')value=value.trim().slice(0,60)||CATALOG[o.type].label;
  if(['count','maxBounces','minDepth','displayBudget'].includes(key))value=Math.round(value);
  if(key==='focalLength'&&Math.abs(value)<.3)value=value<0?-.3:.3;
  if(!setting&&o.type==='shaped'&&key==='diameter'){try{validateInverseAperture({...o,diameter:value});}catch(e){toast(e.message);syncInspectorFields();return;}}
  if(/^p\d$/.test(key))o.p[Number(key[1])]=value;else o[key]=value;if(el.type!=='checkbox')el.value=String(value);
  if(!setting&&o.type==='spherical')o.diameter=Math.min(o.diameter,o.radius*1.98);
  if(!setting&&o.type==='aperture')o.hole=Math.min(o.hole,o.width,o.height);
  const parent=setting?$('simulation-panel'):$('inspector');parent.querySelectorAll(`[data-${setting?'setting':'prop'}="${key}"]`).forEach(e=>{if(e!==el){if(e.type==='checkbox')e.checked=value;else {if(e.type==='range'&&Number(value)>Number(e.max))e.max=String(Math.min(Number(el.max),Math.ceil(Number(value)*1.5)));if(e.type==='range'&&Number(value)<Number(e.min))e.min=String(Math.max(Number(el.min),Math.floor(Number(value)*1.5)));e.value=value;}}if(e.type==='range')setRangeFill(e);});
  if(['curvature','colorMode','type'].includes(key)){if(key==='type'&&value!=='laser'&&o.count<=1)o.count=value==='star'?768:value==='point'?192:61;renderInspector();}
  if(key==='enabled'||key==='name'||key==='color'||key==='colorMode'||key==='type'||key==='wavelength')renderList();
  if(key==='ratio'&&$('split-ratio'))$('split-ratio').textContent=`${Math.round(o.ratio*100)}% reflected · ${Math.round((1-o.ratio)*100)}% transmitted. Both paths are traced.`;
  if(['radius','width','height'].includes(key)){const dependent=o.type==='spherical'?'diameter':o.type==='aperture'?'hole':null;if(dependent){parent.querySelectorAll(`[data-prop="${dependent}"]`).forEach(e=>{e.max=dependent==='diameter'?Math.min(10000,o.radius*1.98):Math.min(o.width,o.height);e.value=o[dependent];});}}
  syncButtons();markChanged();
 }
 for(const root of [$('inspector'),$('simulation-panel')]){
  root.addEventListener('focusin',e=>{if(e.target.matches('[data-prop],[data-setting]'))beginEdit();});
  root.addEventListener('input',e=>{if(e.target.matches('input[type=range],input[type=color]'))editControl(e.target);});
  root.addEventListener('change',e=>{if(e.target.matches('[data-prop],[data-setting]')){editControl(e.target);endEdit();}});
  root.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('input'))e.target.blur();});
 }
 document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;closeMenus();
  if(button.dataset.add){addComponent(button.dataset.add);return;}
  if(button.dataset.preset){loadPreset(button.dataset.preset);return;}
  if(button.dataset.mode){setMode(button.dataset.mode);return;}
  if(button.dataset.axis){setAxis(button.dataset.axis);return;}
  if(button.dataset.view){setView(button.dataset.view);return;}
  if(button.dataset.leftTab){setLeftTab(button.dataset.leftTab);return;}
  if(button.dataset.rightTab){setRightTab(button.dataset.rightTab);return;}
  if(button.dataset.close){$(button.dataset.close).close();return;}
  if(button.dataset.color){mutate(()=>{const o=current();if(o){o.color=button.dataset.color;o.colorMode='rgb';}});return;}
  const id=button.id;
  if(['add-button','add-object','empty-add','inspector-add'].includes(id))openLibrary();
  else if(['examples-button','all-examples'].includes(id))launcher?.show();
  else if(['guide-button','status-help'].includes(id))$('guide-dialog').showModal();
  else if(id==='undo-button')undo();else if(id==='redo-button')undo(true);
  else if(['duplicate-button','duplicate-scene'].includes(id))duplicate();else if(['copy-object','copy-button'].includes(id))copySelection();else if(id==='cut-button')copySelection(true);else if(id==='paste-button'||id==='paste-in-place')pasteSelection(id==='paste-in-place');else if(id==='select-all')selectAll();else if(['delete-object','delete-selection'].includes(id))removeSelected();
  else if(['analysis-button','detector-analyze'].includes(id))openAnalysis();
  else if(['home-button','home-menu-button','analysis-examples'].includes(id))launcher?.show();
  else if(id==='command-button')commands?.show();
  else if(id==='project-name'||id==='project-settings')openProjectDetails();
  else if(id==='save-camera')saveCameraDialog();
  else if(button.dataset.cameraView!==undefined){const v=state.workspace.views[Number(button.dataset.cameraView)];if(v){restoreCamera(v.camera);toast(v.name+' restored.');}}
  else if(button.dataset.cameraDelete!==undefined){mutate(()=>state.workspace.views.splice(Number(button.dataset.cameraDelete),1),false);renderSavedViews();}
  else if(['analysis-pin','monitor-close'].includes(id))pinMonitor();
  else if(['analysis-expand','monitor-expand'].includes(id))expandedAnalysis();
  else if(['research-export-png','analysis-png'].includes(id))exportAnalysisPNG();
  else if(id==='analysis-csv')exportSpotCSV();
  else if(id==='view-settings'){setRightTab('simulation');showRight();}
  else if(id==='aim-once'||id==='lock-target'){
   const o=current(),target=object($('aim-target')?.value);if(!o||!isSource(o))return;
   if(id==='lock-target'&&o.aimTarget){mutate(()=>o.aimTarget=null);toast('Target released. Direction is now free.');return;}
   if(o.locked){toast('Unlock the source transform first.');return;}if(!target){toast('Choose a target object first.');return;}
   if(V.len(V.sub(target.p,o.p))<1e-6){toast('Move the source away from the target center before aiming.');return;}
   mutate(()=>{o.aimTarget=id==='lock-target'?target.id:null;aim(o,target.p);});toast(id==='lock-target'?'Target locked. The source follows both objects’ movement.':'Direction set once.');
  }else if(id==='isolate-source'){isolateSource=isolateSource===selected?null:selected;rayCache=null;dirty=true;renderInspector();toast(isolateSource?'Only this source is drawn. All sources remain in the analysis.':'All sources are visible.');}
  else if(id==='frame-selection')frameScene(true);
  else if(id==='research-ray-stage'){mutate(()=>state.settings.rayStage=state.settings.rayStage==='interacted'?'all':'interacted');}else if(id==='research-export')exportSpotCSV();else if(id==='research-focus')placeFocalPlane();
  else if(id==='flow-menu-button'){$('play-button').click();}

  else if(id==='lock-object')mutate(()=>{if(current())current().locked=!current().locked;});
  else if(id==='save-button')saveFile();else if(id==='load-button')$('scene-file').click();
  else if(id==='new-button')$('confirm-dialog').showModal();else if(id==='confirm-new'){$('confirm-dialog').close();loadPreset('empty');}
  else if(id==='frame-button'||id==='viewport-frame')frameScene();else if(['focus-button','focus-exit','simulation-focus'].includes(id))focusMode();
  else if(['fullscreen-button','simulation-fullscreen'].includes(id))fullscreen();
  else if(id==='screenshot-button')screenshot();
  else if(['grid-button','normals-button','foci-button','play-button','snap-button'].includes(id)){const k={'grid-button':'grid','normals-button':'normals','foci-button':'foci','play-button':'animate','snap-button':'snap'}[id];mutate(()=>state.settings[k]=!state.settings[k],false);syncButtons();if(rightTab==='simulation')renderSimulation();}
  else if(id==='left-toggle'){if(innerWidth<=980){$('left-dock').classList.toggle('mobile-open');$('right-dock').classList.remove('mobile-open');}else document.body.classList.toggle('left-hidden');resizeSoon();}
  else if(id==='right-toggle'){if(innerWidth<=720){$('right-dock').classList.toggle('mobile-open');$('left-dock').classList.remove('mobile-open');}else document.body.classList.toggle('right-hidden');resizeSoon();}
  else if(id==='left-close')$('left-dock').classList.remove('mobile-open');else if(id==='right-close')$('right-dock').classList.remove('mobile-open');
 });
 $('object-list').addEventListener('click',e=>{const vis=e.target.closest('[data-visible]');if(vis){mutate(()=>{const o=object(vis.dataset.visible);if(o)o.enabled=!o.enabled;});return;}const row=e.target.closest('[data-select]');if(row)select(row.dataset.select,true,e.shiftKey);});
 $('object-list').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const row=e.target.closest('[data-select]');if(row){e.preventDefault();select(row.dataset.select,true);}}});
 $('inspector').addEventListener('change',e=>{if(e.target.id==='aim-target'&&current()?.aimTarget){const target=object(e.target.value);if(target)mutate(()=>{current().aimTarget=target.id;aim(current(),target.p);});}});
 document.addEventListener('click',e=>{document.querySelectorAll('.menu[open]').forEach(m=>{if(!m.contains(e.target))m.open=false;});});
 document.querySelectorAll('.menu').forEach(m=>m.addEventListener('toggle',()=>{if(m.open)document.querySelectorAll('.menu').forEach(n=>{if(n!==m)n.open=false;});}));
 document.addEventListener('paste',e=>{if(e.target.matches('input,select,textarea')||e.target.isContentEditable)return;try{const payload=JSON.parse(e.clipboardData.getData('text/plain'));if(payload.format==='lumen-objects'){e.preventDefault();pastePayload(payload);}}catch{}});

 $('simulation-panel').addEventListener('change',e=>{if(e.target.id==='invert-orbit'){preferences.invertOrbit=e.target.checked;try{localStorage.setItem('lumen-preferences',JSON.stringify(preferences));}catch{}toast(preferences.invertOrbit?'Horizontal orbit inverted.':'Grab-style orbit restored.');}if(e.target.id==='projection'){renderer.camera.orthographic=e.target.value==='orthographic';customView();cameraChanged();}});
 $('component-search').addEventListener('input',renderLibrary);
 $('scene-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('Scene file is too large (2 MB limit).');const next=validateScene(JSON.parse(await file.text()));launcher?.hide();activateProject(next,{recover:true});toast('Project opened from JSON.');}catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON.':error.message);}finally{e.target.value='';}});
 for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();}});
 document.addEventListener('fullscreenchange',()=>{$('fullscreen-button').classList.toggle('active',!!document.fullscreenElement);resizeSoon();});
 function labelPosition(o){
  if(!o)return [0,0,0];if(isSource(o))return V.add(o.p,[0,(o.type==='beam'?Math.max(.55,o.aperture/2):o.type==='area'?o.height/2:.6)+.35,0]);
  const b=basis(o);if(o.type==='glass')return V.add(o.p,[0,o.radius+.45,0]);const y=['parabola','shaped','spherical','lens'].includes(o.type)?o.diameter/2:o.height/2;return V.add(o.p,worldVec([0,y+.3,surfaceZ(o,0,y)],b));
 }
 function rebuildLabels(){
  $('labels').replaceChildren();labels=[];
  for(const o of state.objects){if(!o.enabled||(!state.settings.labels&&!selection.has(o.id)))continue;const el=document.createElement('button');el.className='object-label'+(o.id===selected?' selected':'');el.innerHTML=`<span class="label-dot"></span>${esc(o.name)}`;el.setAttribute('aria-label','Inspect '+o.name);if(isSource(o))el.style.color=`rgb(${sourceColor(o).map(v=>Math.round(v*255)).join(',')})`;el.addEventListener('click',()=>select(o.id,true));el.addEventListener('dblclick',()=>{select(o.id);frameScene(true);});$('labels').append(el);labels.push({el,id:o.id});}
  if(state.settings.foci)for(const o of state.objects){if(!o.enabled)continue;const points=focalPoints(o);points.forEach((p,i)=>{const el=document.createElement('span');el.className='focus-label';el.textContent=(o.type==='spherical'?'F ≈ ':o.type==='trough'?'F · line':points.length>1?`F${i+1}`:'F')+(o.type==='spherical'?(o.radius/2*(o.curvature==='convex'?-1:1)).toFixed(2)+(o.curvature==='convex'?' · virtual':''):'');$('labels').append(el);labels.push({el,p,focusId:o.id,focusIndex:i});});}
 }
 function updateLabels(){
  for(const l of labels){const actual=object(l.id||l.focusId);if((l.id||l.focusId)&&!actual){l.el.style.display='none';continue;}const shown=actual?(designer?.displayObject(actual)||actual):null,p=l.id?labelPosition(shown):l.focusId?(focalPoints(shown)[l.focusIndex]||l.p):l.p,q=renderer.project(p);l.el.style.display=q.visible?'':'none';if(q.visible)l.el.style.transform=`translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) translate(-50%,-110%)`;}
  const colors=['#db9489','#8dcbb1','#88aee6'],ends=[[1,0,0],[0,1,0],[0,0,1]].map((a,i)=>({i,x:40+V.dot(a,renderer.right)*25,y:40-V.dot(a,renderer.up)*25,z:V.dot(a,renderer.forward)})).sort((a,b)=>b.z-a.z);
  $('axis-svg').innerHTML='<circle cx="40" cy="40" r="2" fill="#678298" stroke="none"/>'+ends.map(a=>`<g data-axis-view="${['side','top','front'][a.i]}"><line x1="40" y1="40" x2="${a.x}" y2="${a.y}" stroke="${colors[a.i]}" opacity=".65"/><circle cx="${a.x}" cy="${a.y}" r="8" stroke="${colors[a.i]}" stroke-width=".7" fill="#172637"/><text x="${a.x}" y="${a.y+3}" fill="${colors[a.i]}" text-anchor="middle">${['X','Y','Z'][a.i]}</text></g>`).join('');
 }
 $('axis-svg').addEventListener('click',e=>{const b=e.target.closest('[data-axis-view]');if(b)setView(b.dataset.axisView);});
 const grid=[];for(let i=-24;i<=24;i++)if(i!==0)grid.push([i,0,-24],[i,0,24],[-24,0,i],[24,0,i]);
 const xAxis=[[-24,.003,0],[24,.003,0]],zAxis=[[0,.003,-24],[0,.003,24]];
 const rgba=(c,a=1)=>[...c,a];
 function ring(p,u,v,r,color,steps=64){const pts=[];for(let i=0;i<steps;i++){const a=i/steps*Math.PI*2,b=(i+1)/steps*Math.PI*2;pts.push(V.add(p,V.add(V.mul(u,r*Math.cos(a)),V.mul(v,r*Math.sin(a)))),V.add(p,V.add(V.mul(u,r*Math.cos(b)),V.mul(v,r*Math.sin(b)))));}renderer.lines(pts,color);}
 function dash(a,b,color,step=.22){const d=V.sub(b,a),l=V.len(d),pts=[];step=Math.max(step,l/500);if(l<1e-6)return;for(let t=0;t<l;t+=step)pts.push(V.add(a,V.mul(d,t/l)),V.add(a,V.mul(d,Math.min(l,t+step*.5)/l)));renderer.lines(pts,color);}
 function support(o,r=.3){if(state.settings.hideStands||o.p[1]<=.1||o.p[1]>30)return;const p=o.p;renderer.draw('cylinder',M.model([p[0],.045,p[2]],undefined,undefined,undefined,[r,.085,r]),[.15,.22,.27,1]);renderer.draw('cylinder',M.model([p[0],.09,p[2]],undefined,undefined,undefined,[r*.7,.015,r*.7]),[.27,.36,.4,1]);renderer.segment([p[0],.1,p[2]],p,.024,[.26,.37,.43,1],'cylinder',false);}
 function localPoint(o,p){return V.add(o.p,worldVec(p,basis(o)));}
 function curvedMesh(o){const key=[o.type,o.diameter,o.focalLength,o.radius,o.curvature,o.width,o.height,o.hole,JSON.stringify(o.figure)].join('|');if(curveKeys.get(o.id)!==key){if(o.type==='aperture'){
   renderer.disposeMesh('curve-'+o.id);const d={positions:[],normals:[],indices:[]};for(let i=0;i<80;i++){const angles=[i/80*Math.PI*2,(i+1)/80*Math.PI*2],radii=angles.map(a=>Math.min(o.width/2/Math.max(1e-10,Math.abs(Math.cos(a))),o.height/2/Math.max(1e-10,Math.abs(Math.sin(a)))));const ps=[[angles[0],o.hole/2],[angles[0],radii[0]],[angles[1],radii[1]],[angles[1],o.hole/2]],k=d.positions.length/3;for(const [a,r]of ps){d.positions.push(Math.cos(a)*r,Math.sin(a)*r,0);d.normals.push(0,0,1);}d.indices.push(k,k+1,k+2,k,k+2,k+3);}renderer.meshes['curve-'+o.id]=renderer.upload(d);
  }else renderer.curve('curve-'+o.id,o);curveKeys.set(o.id,key);}return 'curve-'+o.id;}
 function drawSource(o){
  const b=basis(o),c=sourceColor(o),sel=selection.has(o.id),body=V.add(o.p,V.mul(b.n,-.35));support({...o,p:body},.31);
  if(o.type==='star'){const center=V.add(o.p,worldVec([-Math.tan(rad(o.fieldX||0))*(o.aimDistance||0),-Math.tan(rad(o.fieldY||0))*(o.aimDistance||0),0],b));ring(center,b.u,b.v,o.aperture/2,rgba(c,.6));for(const sign of [-1,1]){renderer.lines([V.add(center,V.mul(b.u,sign*o.aperture*.46)),V.add(center,V.mul(b.u,sign*o.aperture*.55)),V.add(center,V.mul(b.v,sign*o.aperture*.46)),V.add(center,V.mul(b.v,sign*o.aperture*.55))],rgba(c,.8));}renderer.sphere(center,.055,rgba(c,.85));
  }else if(o.type==='point'){
   renderer.sphere(o.p,.16,rgba(c,.95));for(const a of [[1,0,0],[0,1,0],[0,0,1]])for(const s of [-1,1])renderer.segment(V.add(o.p,V.mul(a,s*.22)),V.add(o.p,V.mul(a,s*.42)),.01,rgba(c,.55));
  }else{
   renderer.segment(V.add(o.p,V.mul(b.n,-.70)),V.add(o.p,V.mul(b.n,-.06)),.14,[.24,.30,.34,1],'cylinder',false);
   for(const z of [-.68,-.58,-.10])renderer.segment(V.add(o.p,V.mul(b.n,z-.025)),V.add(o.p,V.mul(b.n,z+.025)),.16,[.39,.46,.47,1],'cylinder',false);
   renderer.segment(V.add(o.p,V.mul(b.n,-.05)),o.p,.12,rgba(c,1),'cylinder');renderer.sphere(o.p,.04,[1,.93,.8,1]);
   if(o.type==='beam'&&o.aperture>.4){ring(o.p,b.u,b.v,o.aperture/2,rgba(c,.55));ring(V.add(o.p,V.mul(b.n,-.035)),b.u,b.v,o.aperture/2+.025,[.38,.48,.51,.6]);}
   if(o.type==='line')renderer.segment(V.add(o.p,V.mul(b.u,-o.width/2)),V.add(o.p,V.mul(b.u,o.width/2)),.018,rgba(c,.75));
   if(o.type==='area'){const pts=[[-o.width/2,-o.height/2,0],[o.width/2,-o.height/2,0],[o.width/2,o.height/2,0],[-o.width/2,o.height/2,0]].map(p=>localPoint(o,p));for(let i=0;i<4;i++)renderer.segment(pts[i],pts[(i+1)%4],.012,rgba(c,.65));}
   if(o.type==='spot'&&o.spread>0){const r=Math.tan(rad(Math.min(o.spread,70)))*.6;ring(V.add(o.p,V.mul(b.n,.6)),b.u,b.v,r,rgba(c,.22));}
  }
  if(sel&&!state.settings.hideStands&&Math.abs(o.p[1])<30)ring([o.p[0],.009,o.p[2]],[1,0,0],[0,0,1],.48,[.5,.84,.72,.55]);
 }
 function drawOptic(o){
  const b=basis(o),sel=selection.has(o.id),edge=sel?[.52,.87,.75,1]:[.37,.52,.60,1];support(o,.36);
  if(['parabola','shaped','trough','spherical'].includes(o.type)){
   const name=curvedMesh(o);gl.depthMask(false);renderer.draw(name,M.model(o.p,b.u,b.v,b.n),[.36,.58,.7,.62],false,true);gl.depthMask(true);
   const pts=[];if(o.type==='trough'){
    for(const y of [-o.height/2,o.height/2])for(let i=0;i<64;i++){const x=(i/64-.5)*o.width,xx=((i+1)/64-.5)*o.width;pts.push(localPoint(o,[x,y,surfaceZ(o,x,y)]),localPoint(o,[xx,y,surfaceZ(o,xx,y)]));}
    for(const x of [-o.width/2,o.width/2])pts.push(localPoint(o,[x,-o.height/2,surfaceZ(o,x,0)]),localPoint(o,[x,o.height/2,surfaceZ(o,x,0)]));
    const grid=[];for(let i=1;i<8;i++){const x=(i/8-.5)*o.width;grid.push(localPoint(o,[x,-o.height/2,surfaceZ(o,x,0)]),localPoint(o,[x,o.height/2,surfaceZ(o,x,0)]));}renderer.lines(grid,[.4,.66,.76,.18]);
   }else{
    const R=o.diameter/2;for(let i=0;i<80;i++){for(const a of [i/80*Math.PI*2,(i+1)/80*Math.PI*2]){const x=R*Math.cos(a),y=R*Math.sin(a);pts.push(localPoint(o,[x,y,surfaceZ(o,x,y)]));}}
    const mesh=[];for(const fraction of [.25,.5,.75]){const r=R*fraction;for(let i=0;i<64;i++){for(const a of [i/64*Math.PI*2,(i+1)/64*Math.PI*2]){const x=r*Math.cos(a),y=r*Math.sin(a);mesh.push(localPoint(o,[x,y,surfaceZ(o,x,y)]));}}}
    for(let k=0;k<12;k++){const a=k/12*Math.PI*2;for(let j=0;j<16;j++)for(const r of [j/16*R,(j+1)/16*R]){const x=r*Math.cos(a),y=r*Math.sin(a);mesh.push(localPoint(o,[x,y,surfaceZ(o,x,y)]));}}
    renderer.lines(mesh,[.42,.66,.75,.17]);
   }
   renderer.lines(pts,edge);
  }else if(o.type==='glass'){
   gl.depthMask(false);renderer.draw('sphere',M.model(o.p,undefined,undefined,undefined,[o.radius,o.radius,o.radius]),[.27,.5,.7,.18],false,true);
   for(const [u,v]of [[b.u,b.v],[b.n,b.v],[b.u,b.n]])ring(o.p,u,v,o.radius,sel?[.53,.88,.77,.6]:[.46,.67,.78,.37]);gl.depthMask(true);
  }else if(o.type==='lens'){
   gl.depthMask(false);renderer.draw('sphere',M.model(o.p,b.u,b.v,b.n,[o.diameter/2,o.diameter/2,.08]),[.28,.54,.73,.30],false,true);gl.depthMask(true);ring(o.p,b.u,b.v,o.diameter/2,edge);ring(V.add(o.p,V.mul(b.n,-.035)),b.u,b.v,o.diameter/2+.025,[.26,.42,.49,.6]);
  }else{
   const corners=[[-o.width/2,-o.height/2,0],[o.width/2,-o.height/2,0],[o.width/2,o.height/2,0],[-o.width/2,o.height/2,0]].map(p=>localPoint(o,p));
   for(let i=0;i<4;i++)renderer.segment(corners[i],corners[(i+1)%4],.027,edge,'tube',false);
   if(o.type==='aperture'){renderer.draw(curvedMesh(o),M.model(o.p,b.u,b.v,b.n),[.11,.16,.21,1],false);ring(o.p,b.u,b.v,o.hole/2,[.5,.66,.73,.8]);}
   else{
    const color=o.type==='detector'?[.065,.10,.14,.95]:o.type==='blocker'?[.12,.16,.20,1]:o.type==='splitter'?[.46,.47,.72,.32]:[.34,.56,.68,.64];
    gl.depthMask(false);renderer.draw('plane',M.model(o.p,b.u,b.v,b.n,[o.width,o.height,1]),color,false,o.type==='mirror'||o.type==='splitter');gl.depthMask(true);
    if(o.type==='detector'){
     const pts=[];for(let i=1;i<8;i++){const x=(i/8-.5)*o.width,y=(i/8-.5)*o.height;pts.push(localPoint(o,[x,-o.height/2,.006]),localPoint(o,[x,o.height/2,.006]),localPoint(o,[-o.width/2,y,.006]),localPoint(o,[o.width/2,y,.006]));}renderer.lines(pts,[.4,.55,.65,.22]);
     const vertices=[];for(const h of (designer?.displayTrace(trace)||trace).detectors[o.id]?.hits||[])vertices.push(...V.add(h.point,V.mul(h.normal,.02)),...h.color,.88);gl.depthMask(false);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);renderer.batch(vertices,true,4);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(true);
    }
    if(o.type==='splitter'){const pts=[];for(let i=0;i<12;i++)pts.push(localPoint(o,[-o.width/2+(i/12)*o.width,-o.height/2,0.01]),localPoint(o,[-o.width/2+Math.min(1,(i+.45)/12)*o.width,o.height/2,.01]));renderer.lines(pts,[.60,.61,.83,.12]);}
   }
   if(sel)for(const p of corners)renderer.sphere(p,.035,[.74,.97,.85,1]);
  }
  if(sel&&!state.settings.hideStands&&Math.abs(o.p[1])<30)ring([o.p[0],.011,o.p[2]],[1,0,0],[0,0,1],.55,[.45,.77,.68,.32]);
 }
 function drawFoci(){if(!state.settings.foci)return;for(const actual of state.objects){const o=designer?.displayObject(actual)||actual;if(!o.enabled)continue;for(const p of focalPoints(o)){
   const c=[.99,.77,.39,.7];renderer.sphere(p,.037,[1,.88,.59,1]);for(const a of [[1,0,0],[0,1,0],[0,0,1]])renderer.lines([V.add(p,V.mul(a,-.12)),V.add(p,V.mul(a,.12))],c);
   if(o.id===selected)dash(o.p,p,[.75,.67,.44,.3]);if(o.type==='trough'){const b=basis(o);dash(V.add(p,V.mul(b.v,-o.height/2)),V.add(p,V.mul(b.v,o.height/2)),[.99,.77,.39,.7],.16);}
  }}}
 function drawNormals(){if(!state.settings.normals)return;const h=selectedHit();if(!h)return;
  dash(V.add(h.point,V.mul(h.normal,-.5)),V.add(h.point,V.mul(h.normal,1.35)),[.5,.85,.75,.85],.18);
  renderer.segment(V.add(h.point,V.mul(h.normal,1.2)),V.add(h.point,V.mul(h.normal,1.4)),.06,[.5,.85,.75,1],'cone');
  if(h.outgoing){for(const [dir,r,c]of [[V.mul(h.incoming,-1),.55,[1,.76,.42,.8]],[h.outgoing,.72,[.55,.85,.72,.8]]]){
   const angle=Math.acos(clamp(V.dot(h.normal,dir),-1,1));if(angle<.001||angle>Math.PI/2+.01)continue;const tangent=V.unit(V.sub(dir,V.mul(h.normal,Math.cos(angle)))),pts=[];for(let i=0;i<28;i++)for(const a of [i/28*angle,(i+1)/28*angle])pts.push(V.add(h.point,V.mul(V.add(V.mul(h.normal,Math.cos(a)),V.mul(tangent,Math.sin(a))),r)));renderer.lines(pts,c);
  }}
 }
 function gizmoLength(){return renderer.camera.radius*Math.tan(renderer.fov/2)*.16;}
 function drawGizmo(){const o=current();if(!o||o.locked||mode==='select'||(mode==='rotate'&&o.aimTarget))return;const colors=[[.88,.44,.41,1],[.4,.81,.61,1],[.42,.61,.93,1]],axes=[[1,0,0],[0,1,0],[0,0,1]],len=gizmoLength();gl.disable(gl.DEPTH_TEST);
  if(mode==='move')axes.forEach((a,i)=>{const c=axis===['x','y','z'][i]?[1,.94,.6,1]:colors[i];renderer.segment(o.p,V.add(o.p,V.mul(a,len*.86)),len*.012,c);renderer.segment(V.add(o.p,V.mul(a,len*.82)),V.add(o.p,V.mul(a,len)),len*.048,c,'cone');});
  else axes.forEach((a,i)=>{ring(o.p,axes[(i+1)%3],axes[(i+2)%3],len*.78,axis&&axis!==['x','y','z'][i]?rgba(colors[i].slice(0,3),.18):colors[i]);});gl.enable(gl.DEPTH_TEST);
 }
 function buildRayCache(){
  const core=[],glow=[],extensions=[],pixel=2*Math.tan(renderer.fov/2)/renderer.height;
  const quad=(out,a,b,wa,wb,c,aa,ab)=>{const side=V.unit(V.cross(V.sub(b,a),renderer.forward)),s=V.len(side)>.01?side:renderer.right;const p=[V.sub(a,V.mul(s,wa)),V.add(a,V.mul(s,wa)),V.sub(b,V.mul(s,wb)),V.add(b,V.mul(s,wb))];for(const i of [0,1,2,1,3,2])out.push(...p[i],...c,i<2?aa:ab);};
  if(isolateSource&&!object(isolateSource))isolateSource=null;
  const eligible=(designer?.displayTrace(trace)||trace).segments.filter(s=>(!isolateSource||s.sourceId===isolateSource)&&(state.settings.rayStage!=='interacted'||s.depth>0)),budget=state.settings.displayBudget||24000,stride=Math.max(1,Math.ceil(eligible.length/budget)),groups=new Map();
  for(const s of eligible){if(s.rayIndex%stride)continue;const key=s.sourceId+':'+s.rayIndex;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
  const chosen=[];for(const path of groups.values()){if(chosen.length+path.length>budget)continue;chosen.push(...path);}chosen.sort((a,b)=>a.depth-b.depth||a.rayIndex-b.rayIndex||a.sourceId.localeCompare(b.sourceId));
  const selectedSources=new Set(selectedObjects().filter(isSource).map(o=>o.id));
  for(const s of chosen){const da=renderer.camera.orthographic?renderer.camera.radius:Math.max(.01,V.dot(V.sub(s.a,renderer.eye),renderer.forward)),db=renderer.camera.orthographic?renderer.camera.radius:Math.max(.01,V.dot(V.sub(s.b,renderer.eye),renderer.forward)),dense=clamp(64/Math.max(64,s.sampleCount/stride),.003,1),emphasis=selectedSources.size&&!selectedSources.has(s.sourceId)?.24:1;
   const alpha=clamp(Math.pow(s.visual,.65)*state.settings.rayOpacity*(s.rayIndex===0?Math.max(.65,dense):dense)*emphasis*(s.depth===0?state.settings.incidentOpacity:1),.001,.95),w=(s.rayIndex===0?.82:.49)*state.settings.rayWidth;
   const palette=[[.42,.76,1],[1,.72,.36],[.60,.87,.65],[.79,.64,1],[1,.48,.60]],c=state.settings.rayStyle==='bounce'?palette[s.depth%palette.length]:s.color;
   quad(core,s.a,s.b,da*pixel*w,db*pixel*w,c,alpha,alpha*(s.terminal?.45:1));
   if(state.settings.rayStyle==='glow')quad(glow,s.a,s.b,da*pixel*3.1,db*pixel*3.1,c,alpha*.05,alpha*(s.terminal?.01:.05));
   if(state.settings.extensions&&s.depth>0&&s.kind!=='transmitted'&&extensions.length<300000){const d=V.unit(V.sub(s.a,s.b));for(let t=.12;t<5;t+=.25){const a=V.add(s.a,V.mul(d,t)),b=V.add(s.a,V.mul(d,t+.11));quad(extensions,a,b,da*pixel*.36,da*pixel*.36,[.54,.67,.76],.16,.16);}}
  }
  renderedSegments=chosen.length;rayCache={core:new Float32Array(core),glow:new Float32Array(glow),extensions:new Float32Array(extensions),chosen};
  if($('display-thinned'))$('display-thinned').textContent=chosen.length<eligible.length?` · display ${chosen.length.toLocaleString()}/${eligible.length.toLocaleString()} seg`:(isolateSource?' · isolated view':'');
 }
 function drawRays(){
  if(!rayCache)buildRayCache();gl.depthMask(false);
  // Alpha compositing preserves source hue without additive clipping to white.
  gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);renderer.batch(rayCache.core,false,4,'ray-core');
  if(state.settings.rayStyle==='glow'){gl.blendFunc(gl.SRC_ALPHA,gl.ONE);renderer.batch(rayCache.glow,false,4,'ray-glow');gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
  else renderer.batch(rayCache.glow,false,4,'ray-glow');
  renderer.batch(rayCache.extensions,false,4,'ray-extensions');
  if(state.settings.animate){const points=[],gap=Math.max(3.8,renderer.camera.radius*.13),skip=Math.max(1,Math.ceil(trace.seeds/220));for(const s of rayCache.chosen){if(s.rayIndex%skip)continue;const first=((flowTime*gap*.7-s.startLength)%gap+gap)%gap;for(let t=first;t<s.length;t+=gap){points.push(...V.mix(s.a,s.b,t/s.length),...s.color,clamp(s.visual*.7,.05,.85));if(points.length>12000)break;}if(points.length>12000)break;}renderer.batch(points,true,3.1);}
  gl.depthMask(true);
 }

 function draw(){renderer.background=({studio:[.039,.055,.078],midnight:[.012,.017,.025],slate:[.095,.12,.15]})[state.settings.background]||[.039,.055,.078];renderer.begin();gl.depthMask(false);if(state.settings.grid){renderer.lines(grid,[.23,.35,.46,.22]);renderer.lines(xAxis,[.46,.28,.28,.25]);renderer.lines(zAxis,[.26,.37,.56,.25]);}gl.depthMask(true);
  for(const actual of state.objects){const o=designer?.displayObject(actual)||actual;if(!o.enabled)continue;if(isSource(o))drawSource(o);else drawOptic(o);}drawRays();drawFoci();drawNormals();drawGizmo();designer?.draw();updateLabels();
 }
 function savePreferences(){try{localStorage.setItem('lumen-preferences',JSON.stringify(preferences));}catch{toast('Preferences cannot be remembered by this browser.');}}
 function flushProject(){
  clearTimeout(saveTimer);if(!workspaceReady)return false;
  state.workspace??={camera:null,views:[],notes:'',monitor:false};state.workspace.camera=JSON.parse(JSON.stringify(renderer.camera));
  const ok=projectStore.save(state);$('save-status').textContent=ok?'Saved locally · save JSON for a backup':'Local storage unavailable · save a JSON copy';return ok;
 }
 function openProjectDetails(){endEdit();$('project-title-input').value=state.name;$('project-notes-input').value=state.workspace.notes||'';$('project-dialog').showModal();$('project-title-input').focus();$('project-title-input').select();}
 function saveCameraDialog(){if(state.workspace.views.length>=8){toast('Eight views are saved. Remove a view in the View menu first.');return;}$('view-name-input').value='View '+(state.workspace.views.length+1);$('view-name-dialog').showModal();$('view-name-input').select();}
 function renderSavedViews(){const views=state.workspace?.views||[];$('saved-camera-list').innerHTML=views.map((v,i)=>`<div class="saved-camera-row"><button data-camera-view="${i}">${icon('camera')}${esc(v.name)}</button><button data-camera-delete="${i}" title="Remove ${esc(v.name)}" aria-label="Remove camera view ${esc(v.name)}">${icon('close')}</button></div>`).join('');}
 function restoreCamera(camera){if(!camera)return;renderer.camera=JSON.parse(JSON.stringify(camera));customView();cameraChanged();if(rightTab==='simulation')renderSimulation();}
 function openAnalysis(detectorId=null){
  if(detectorId&&object(detectorId)?.type==='detector')state.settings.detectorId=detectorId;
  else if(current()?.type==='detector')state.settings.detectorId=selected;
  setRightTab('research');showRight();persist();
 }
 function pinMonitor(){mutate(()=>state.workspace.monitor=!state.workspace.monitor,false);updateResearch();if(rightTab==='research')renderResearch();toast(state.workspace.monitor?'Detector monitor pinned. Edit any object while it stays live.':'Detector monitor unpinned.');}
 function expandedAnalysis(){if(!researchObjects().detector){toast('Add an enabled detector to analyze its hits.');openAnalysis();return;}$('analysis-dialog').showModal();updateResearch();}
 function exportAnalysisPNG(){
  if(needsTrace||traceBusy){toast('Wait for the current trace to finish before exporting.');return;}const data=researchData();if(!data.detector){toast('Choose an enabled detector first.');return;}
  const out=document.createElement('canvas');out.width=1200;out.height=920;const plot=document.createElement('canvas');plot.width=1200;plot.height=760;paintResearch(data,plot);const ctx=out.getContext('2d');ctx.fillStyle='#0b131e';ctx.fillRect(0,0,out.width,out.height);ctx.fillStyle='#d6e8ed';ctx.font='26px system-ui';ctx.fillText('lumen / '+state.name.slice(0,65),38,47);ctx.fillStyle='#98b7c6';ctx.font='19px system-ui';ctx.fillText(data.detector.name+' · '+(data.filterSource?.name||'All sources')+' · '+data.hits.length.toLocaleString()+' recorded samples',38,81);ctx.drawImage(plot,0,105);ctx.font='17px system-ui';ctx.fillStyle='#a0b5c3';ctx.fillText(`Geometric ray hits · ${state.settings.mmPerUnit} mm per world unit · not a diffraction PSF`,38,898);
  out.toBlob(blob=>{if(blob){download(blob,'lumen-detector-plot.png');toast('Detector plot exported as PNG.');}else toast('The browser could not create the plot image.');},'image/png');
 }
 function activateProject(next,options={}){
  const clean=validateScene(next),wasReady=workspaceReady,savedCamera=clean.workspace.camera;
  endEdit();if(wasReady)flushProject();workspaceReady=true;
  mutate(()=>{state=clean;isolateSource=null;selection.clear();selected=state.objects.find(o=>!isSource(o))?.id||state.objects[0]?.id||null;if(matchMedia('(prefers-reduced-motion: reduce)').matches)state.settings.animate=false;});
  setView('3d');if(savedCamera)restoreCamera(savedCamera);setMode('select');
  if(!wasReady){past=[];future=[];syncHistory();}
  document.body.classList.remove('focus','right-hidden');$('examples-dialog').close();
  if(options.blank){setRightTab('object');openLibrary();if(innerWidth>720)document.body.classList.add('right-hidden');}
  else if(['inverse','finite'].includes(state.preset)){designer?.open();}
  else if(state.objects.some(o=>o.type==='detector')){setRightTab('research');}
  else setRightTab('object');
  if(innerWidth<=980)$('left-dock').classList.remove('mobile-open');if(innerWidth<=720)$('right-dock').classList.remove('mobile-open');
  resizeSoon();persist();updateResearch();toast(options.recover?'Project recovered from this device.':options.blank?'A clean slate. Add a component to begin.':state.name+' opened.');
 }
 function commandItems(){
  const action=(title,group,iconName,run,keywords='')=>({title,group,icon:iconName,run,keywords});
  return [
   action('Start screen & recent projects','Navigate','layers',()=>launcher.show(),'home demos welcome'),
   action('Analyze detector','Analysis','detector',()=>openAnalysis(),'star lab telescope focal spots'),
   action(state.workspace.monitor?'Unpin live detector monitor':'Pin live detector monitor','Analysis','detector',pinMonitor),
   action('Expand detector plot','Analysis','fullscreen',expandedAnalysis),
   action('Export detector hits as CSV','Analysis','save',exportSpotCSV),
   action('Export detector plot as PNG','Analysis','camera',exportAnalysisPNG),
   action('Auto-shape mirror to detector','Design','spark',()=>designer.open()),
   action('Project name & notes','Project','sliders',openProjectDetails,'rename'),
   action('Save project JSON','Project','save',saveFile),
   action('Open project JSON','Project','folder',()=>$('scene-file').click()),
   action('New blank project','Project','plus',()=>$('confirm-dialog').showModal()),
   action('Save this camera view','View','camera',saveCameraDialog,'bookmark'),
   action('Frame scene','View','frame',()=>frameScene(),'home fit'),
   action('Frame selection','View','crosshair',()=>frameScene(true)),
   ...['3d','top','front','side'].map(v=>action(v==='3d'?'Perspective camera':v[0].toUpperCase()+v.slice(1)+' camera','View','eye',()=>setView(v))),
   action('Ray appearance & simulation','View','sliders',()=>{setRightTab('simulation');showRight();},'density opacity grid background stands'),
   action('Toggle fullscreen','View','fullscreen',fullscreen),action('Hide interface','View','focus',focusMode),
   action('Copy selected objects','Edit','copy',()=>copySelection()),action('Paste objects','Edit','clipboard',()=>pasteSelection()),action('Undo','Edit','undo',()=>undo()),
   ...state.workspace.views.map((v,i)=>action('Go to '+v.name,'Saved view','camera',()=>restoreCamera(state.workspace.views[i].camera))),
   ...Object.entries(CATALOG).map(([type,c])=>action('Add '+c.label,c.group,c.icon,()=>addComponent(type),c.description)),
   ...state.objects.map(o=>action('Select '+o.name,'Scene object',CATALOG[o.type].icon,()=>select(o.id,true),CATALOG[o.type].label)),
   action('Help & shortcuts','Help','help',()=>$('guide-dialog').showModal())
  ];
 }
 $('project-form').addEventListener('submit',e=>{e.preventDefault();const name=$('project-title-input').value.trim();if(!name){$('project-title-input').setCustomValidity('Enter a project name.');$('project-title-input').reportValidity();return;}mutate(()=>{state.name=name.slice(0,80);state.workspace.notes=$('project-notes-input').value.slice(0,2000);});$('project-dialog').close();toast('Project details saved.');});
 $('project-title-input').addEventListener('input',()=>{ $('project-title-input').setCustomValidity(''); });
 $('view-name-form').addEventListener('submit',e=>{e.preventDefault();const name=$('view-name-input').value.trim();if(!name){$('view-name-input').setCustomValidity('Enter a view name.');$('view-name-input').reportValidity();return;}if(state.workspace.views.length>=8)return;mutate(()=>state.workspace.views.push({id:'v'+Date.now(),name:name.slice(0,40),camera:JSON.parse(JSON.stringify(renderer.camera))}),false);renderSavedViews();$('view-name-dialog').close();toast('Camera view saved with the project.');});
 $('view-name-input').addEventListener('input',()=>{ $('view-name-input').setCustomValidity(''); });
 $('monitor-map').addEventListener('click',expandedAnalysis);$('monitor-map').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();expandedAnalysis();}});
 $('research-panel').addEventListener('click',e=>{if(e.target.id==='research-map')expandedAnalysis();});

 function pointerXY(e){const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];}
 function spherePick(ray,p,r){const off=V.sub(ray.origin,p),b=V.dot(off,ray.direction),disc=b*b-V.dot(off,off)+r*r;if(disc<0)return null;const t=-b-Math.sqrt(disc);return t>0?t:null;}
 function pick(x,y){const ray=renderer.pointerRay(x,y);let best=null,dist=Infinity;for(const o of state.objects){if(!o.enabled)continue;let t=null;
  if(!isSource(o))t=intersect(ray.origin,ray.direction,o)?.t??null;
  else{const b=basis(o);t=spherePick(ray,V.add(o.p,V.mul(b.n,-.22)),.43);if(['beam','star','area','line'].includes(o.type)){const dn=V.dot(ray.direction,b.n);if(Math.abs(dn)>.001){const d=V.dot(V.sub(o.p,ray.origin),b.n)/dn;if(d>0){const q=localVec(V.sub(V.add(ray.origin,V.mul(ray.direction,d)),o.p),b),inside=['beam','star'].includes(o.type)?q[0]*q[0]+q[1]*q[1]<=Math.max(.4,o.aperture/2)**2:Math.abs(q[0])<=o.width/2&&Math.abs(q[1])<=(o.type==='line'?.18:o.height/2);if(inside)t=t===null?d:Math.min(t,d);}}}}
  if(t!==null&&t<dist){dist=t;best=o.id;}
 }return best;}
 function planePoint(x,y,p,n){const r=renderer.pointerRay(x,y),dn=V.dot(r.direction,n);if(Math.abs(dn)<.015)return null;const t=V.dot(V.sub(p,r.origin),n)/dn;return t>0?V.add(r.origin,V.mul(r.direction,t)):null;}
 function groundPoint(x,y,height=3){return planePoint(x,y,[0,height,0],[0,1,0]);}
 const worldAxes={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
 function axisCoordinate(x,y,p,a){const r=renderer.pointerRay(x,y),w=V.sub(r.origin,p),c=V.dot(a,r.direction),den=1-c*c;if(den<.005)return null;return (V.dot(a,w)-c*V.dot(r.direction,w))/den;}
 function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p[0]-a.x)*dx+(p[1]-a.y)*dy)/l,0,1):0;return Math.hypot(p[0]-a.x-dx*t,p[1]-a.y-dy*t);}
 function pickGizmo(x,y){const o=current();if(!o||o.locked||mode==='select'||(mode==='rotate'&&o.aimTarget))return null;const len=gizmoLength();let best=null,min=9;
  for(const [k,a]of Object.entries(worldAxes)){
   if(mode==='move'){const p=renderer.project(V.add(o.p,V.mul(a,len*.23))),q=renderer.project(V.add(o.p,V.mul(a,len))),d=distanceToSegment([x,y],p,q);if(q.visible&&d<min){best=k;min=d;}}
   else{const axes=Object.values(worldAxes),i=['x','y','z'].indexOf(k),u=axes[(i+1)%3],v=axes[(i+2)%3];for(let j=0;j<64;j++){const points=[j/64*Math.PI*2,(j+1)/64*Math.PI*2].map(t=>renderer.project(V.add(o.p,V.add(V.mul(u,Math.cos(t)*len*.78),V.mul(v,Math.sin(t)*len*.78)))));const d=distanceToSegment([x,y],...points);if(points.every(p=>p.visible)&&d<min){best=k;min=d;}}}
  }return best;
 }
 function rotateVec(v,a,t){return V.add(V.add(V.mul(v,Math.cos(t)),V.mul(V.cross(a,v),Math.sin(t))),V.mul(a,V.dot(a,v)*(1-Math.cos(t))));}
 function rotateOnAxis(o,initial,a,t){const b=basis(initial),n=rotateVec(b.n,a,t),u=rotateVec(b.u,a,t);o.yaw=deg(Math.atan2(n[0],n[2]));o.tilt=deg(Math.asin(clamp(n[1],-1,1)));const canonical=basis({...o,roll:0});o.roll=deg(Math.atan2(V.dot(u,canonical.v),V.dot(u,canonical.u)));}
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('pointerdown',e=>{
  if(e.button===0&&designer?.isPicking()){e.preventDefault();designer.pick(renderer.pointerRay(...pointerXY(e)));return;}
  if(e.button>2)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const xy=pointerXY(e);touches.set(e.pointerId,xy);
  if(touches.size===2){endEdit();const p=[...touches.values()];pinch={distance:Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),mid:V.mix(p[0],p[1],.5)};drag=null;return;}
  const handle=e.button===0?pickGizmo(...xy):null,picked=handle?selected:pick(...xy),o=object(picked);
  const action=e.button===1||e.button===2||(e.shiftKey&&mode==='select')?'pan':handle?mode:picked&&mode!=='select'&&!o.locked&&!(mode==='rotate'&&o.aimTarget)?mode:'orbit';
  if(action==='move'||action==='rotate'){if(!selection.has(picked))select(picked);else {selected=picked;renderInspector();}beginEdit();}
  const constraint=handle||axis,initial=o?JSON.parse(JSON.stringify(o)):null,rotationAnchor=constraint&&o?planePoint(...xy,o.p,worldAxes[constraint]):null;
  drag={group:JSON.parse(JSON.stringify(selectedObjects())),additive:e.shiftKey,pointer:e.pointerId,start:xy,last:xy,picked,action,constraint,initial,anchor:o?groundPoint(...xy,o.p[1]):null,screenAnchor:o?planePoint(...xy,o.p,renderer.forward):null,axisAnchor:constraint&&o?axisCoordinate(...xy,o.p,worldAxes[constraint]):null,rotationAnchor,moved:false,button:e.button,shift:e.shiftKey};
  if(handle){axis=handle;document.querySelectorAll('[data-axis]').forEach(b=>b.classList.toggle('active',b.dataset.axis===axis));}
 });
 canvas.addEventListener('pointermove',e=>{
  const xy=pointerXY(e);if(touches.has(e.pointerId))touches.set(e.pointerId,xy);
  if(touches.size===2&&pinch){const p=[...touches.values()],distance=Math.hypot(p[0][0]-p[1][0],p[0][1]-p[1][1]),mid=V.mix(p[0],p[1],.5);renderer.camera.radius=clamp(renderer.camera.radius*pinch.distance/Math.max(1,distance),.1,5000000);renderer.pan(mid[0]-pinch.mid[0],mid[1]-pinch.mid[1]);pinch={distance,mid};cameraChanged();return;}
  if(!drag||drag.pointer!==e.pointerId){if(e.pointerType==='mouse'){const h=pickGizmo(...xy),p=h||pick(...xy);canvas.style.cursor=p?mode==='move'?'move':mode==='rotate'?'crosshair':'pointer':'grab';}return;}
  const dx=xy[0]-drag.last[0],dy=xy[1]-drag.last[1],tx=xy[0]-drag.start[0],ty=xy[1]-drag.start[1];if(Math.hypot(tx,ty)>3)drag.moved=true;
  if(drag.action==='pan'){renderer.pan(dx,dy);cameraChanged();}
  else if(drag.action==='orbit'){
   // Our azimuth is atan2(z,x), unlike OrbitControls' atan2(x,z).
   // Positive dx therefore increases yaw: the visible scene follows the drag.
   renderer.camera.yaw+=dx*.006*(preferences.invertOrbit?-1:1);renderer.camera.pitch=clamp(renderer.camera.pitch+dy*.006,-Math.PI/2+.001,Math.PI/2-.001);customView();cameraChanged();
  }else{
   const o=object(drag.picked);if(o&&!o.locked){const initial=drag.initial,scale=2*renderer.camera.radius*Math.tan(renderer.fov/2)/renderer.height,snap=state.settings.snap||e.ctrlKey||e.metaKey;
    if(drag.action==='move'){
     let pos=[...initial.p];const a=drag.constraint;
     if(a){const n=worldAxes[a],v=axisCoordinate(...xy,initial.p,n),delta=v!==null&&drag.axisAnchor!==null?v-drag.axisAnchor:(a==='y'?-ty:tx)*scale;pos=V.add(pos,V.mul(n,delta));}
     else if(e.shiftKey||drag.shift)pos[1]=initial.p[1]-ty*scale;
     else{const p=groundPoint(...xy,initial.p[1]);if(p&&drag.anchor)pos=V.add(initial.p,V.sub(p,drag.anchor));else{const point=planePoint(...xy,initial.p,renderer.forward);if(point&&drag.screenAnchor)pos=V.add(initial.p,V.sub(point,drag.screenAnchor));}}
     o.p=pos.map((v,i)=>clamp(snap?Math.round(v*4)/4:v,-POSITION_LIMIT,POSITION_LIMIT));const delta=V.sub(o.p,initial.p);for(const original of drag.group||[]){const q=object(original.id);if(q&&q.id!==o.id&&!q.locked)q.p=original.p.map((v,i)=>clamp(v+delta[i],-POSITION_LIMIT,POSITION_LIMIT));}
    }else{
     if(drag.constraint){const a=worldAxes[drag.constraint],p=planePoint(...xy,initial.p,a);let angle=(tx-ty)*.009;if(p&&drag.rotationAnchor){const start=V.unit(V.sub(drag.rotationAnchor,initial.p)),end=V.unit(V.sub(p,initial.p));angle=Math.atan2(V.dot(a,V.cross(start,end)),V.dot(start,end));}if(snap)angle=Math.round(angle/rad(15))*rad(15);rotateOnAxis(o,initial,a,angle);}
     else{const yaw=initial.yaw+tx*.45,tilt=initial.tilt-ty*.40;o.yaw=((snap?Math.round(yaw/15)*15:yaw)+540)%360-180;o.tilt=clamp(snap?Math.round(tilt/15)*15:tilt,-89.9,89.9);}
    }
    syncInspectorFields();markChanged();
   }
  }
  drag.last=xy;
 });
 function finishPointer(e){
  if(drag?.pointer===e.pointerId){if(!drag.moved&&drag.button===0&&(drag.action==='orbit'||drag.action==='pan'))select(drag.picked,!!drag.picked&&innerWidth<=720,drag.additive);if(drag.action==='move'||drag.action==='rotate')endEdit();drag=null;}
  touches.delete(e.pointerId);if(touches.size<2)pinch=null;
 }
 canvas.addEventListener('pointerup',finishPointer);canvas.addEventListener('pointercancel',finishPointer);canvas.addEventListener('lostpointercapture',finishPointer);
 canvas.addEventListener('wheel',e=>{e.preventDefault();const delta=e.deltaMode===1?e.deltaY*16:e.deltaY;renderer.camera.radius=clamp(renderer.camera.radius*Math.exp(clamp(delta,-240,240)*.001),.1,5000000);cameraChanged();},{passive:false});
 canvas.addEventListener('dblclick',e=>{const id=pick(...pointerXY(e));if(id)select(id);frameScene(!!id);});
 $('library').addEventListener('dragstart',e=>{const b=e.target.closest('[data-add]');if(!b)return;e.dataTransfer.setData('application/x-lumen-component',b.dataset.add);e.dataTransfer.effectAllowed='copy';});
 $('stage').addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('application/x-lumen-component')){e.preventDefault();e.dataTransfer.dropEffect='copy';$('stage').classList.add('dropping');}});
 $('stage').addEventListener('dragleave',e=>{if(!$('stage').contains(e.relatedTarget))$('stage').classList.remove('dropping');});
 $('stage').addEventListener('drop',e=>{e.preventDefault();$('stage').classList.remove('dropping');const type=e.dataTransfer.getData('application/x-lumen-component');if(CATALOG[type]){const p=groundPoint(...pointerXY(e),renderer.camera.target[1])||[...renderer.camera.target];addComponent(type,p.map((v,i)=>clamp(v,-POSITION_LIMIT,POSITION_LIMIT)));}});
 window.addEventListener('keydown',e=>{
  if([...document.querySelectorAll('dialog')].some(d=>d.open)||e.target.matches('input,select,textarea')||e.target.isContentEditable)return;
  const k=e.key.toLowerCase(),cmd=e.ctrlKey||e.metaKey;
  if(cmd){if(k==='k'){e.preventDefault();commands?.show();}else if(k==='c'){e.preventDefault();copySelection();}else if(k==='x'){e.preventDefault();copySelection(true);}else if(k==='v'){e.preventDefault();pasteSelection(e.shiftKey);}else if(k==='a'){e.preventDefault();selectAll();}else if(k==='z'){e.preventDefault();undo(e.shiftKey);}else if(k==='y'){e.preventDefault();undo(true);}else if(k==='d'){e.preventDefault();duplicate();}else if(k==='s'){e.preventDefault();saveFile();}return;}
  if(e.altKey)return;
  if(k==='tab'){if(e.target===canvas||e.target===document.body||document.body.classList.contains('focus')){e.preventDefault();focusMode();}return;}
  if(k==='q'||k==='v'){e.preventDefault();setMode('select');}else if(k==='g'){e.preventDefault();setMode('move');}else if(k==='r'){e.preventDefault();setMode('rotate');}
  else if(['x','y','z'].includes(k)){e.preventDefault();setAxis(k);}else if(k==='a'){e.preventDefault();openLibrary();}
  else if(k==='home'){e.preventDefault();frameScene();}else if(k==='f'){e.preventDefault();fullscreen();}
  else if(k===' '){e.preventDefault();mutate(()=>state.settings.animate=!state.settings.animate,false);syncButtons();if(rightTab==='simulation')renderSimulation();}
  else if(k==='delete'||k==='backspace'){e.preventDefault();removeSelected();}
  else if(['1','2','3','4'].includes(k)){e.preventDefault();setView(['3d','top','front','side'][+k-1]);}
  else if(k==='?')$('guide-dialog').showModal();
  else if(k==='escape'){closeMenus();if(document.body.classList.contains('focus'))focusMode();$('left-dock').classList.remove('mobile-open');$('right-dock').classList.remove('mobile-open');if(drag&&editBefore){state=JSON.parse(editBefore);editBefore=null;drag=null;refreshAll();}setMode('select');}
 });
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('loading').hidden=false;$('loading').textContent='The graphics context was interrupted. Reload this file to resume. Your last saved scene remains on this device.';});
 window.addEventListener('beforeunload',flushProject);window.addEventListener('pagehide',flushProject);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){dirty=true;lastTime=0;}else flushProject();});
 new ResizeObserver(()=>{renderer.resize();dirty=true;rayCache=null;}).observe(canvas);
 function frame(time){requestAnimationFrame(frame);if(document.hidden)return;const dt=lastTime?Math.min((time-lastTime)/1000,.08):0;lastTime=time;if(state.settings.animate)flowTime+=dt;
  if(needsTrace){retrace();dirty=true;}
  if(launcher?.isOpen())return;
  if(dirty||(state.settings.animate&&time-lastRender>31)){draw();dirty=false;lastRender=time;if(exportAfterFrame)makeScreenshot();}
 }
 designer=initDesigner({getScene:()=>state,current,showTab:setRightTab,showRight,transact:mutate,notify:toast,renderer,redraw:()=>{dirty=true;rayCache=null;},loadPreset});
 const initialCamera=state.workspace?.camera;
 setView('3d');if(initialCamera)restoreCamera(initialCamera);refreshAll();syncHistory();setRightTab('object');$('loading').hidden=true;
 launcher=initLauncher({icon,escapeHTML:esc,store:projectStore,legacy:loaded?JSON.parse(snapshot()):null,notify:toast,hasWorkspace:()=>workspaceReady,getPreferences:()=>preferences,setPreference:(k,v)=>{preferences[k]=v;savePreferences();},beforeShow:()=>{endEdit();if(workspaceReady)flushProject();closeMenus();},onClose:()=>{resizeSoon();},openScene:activateProject,importFile:()=>$('scene-file').click()});
 commands=initCommands({icon,escapeHTML:esc,getItems:commandItems});
 if(loaded&&preferences.startScreen===false){workspaceReady=true;if(state.objects.some(o=>o.type==='detector'))setRightTab('research');updateResearch();}else launcher.show();
 requestAnimationFrame(frame);
 // Read-only snapshots, plus the pure optics kernel, support reproducible tests.
 window.Lumen=Object.freeze({version:'5.0.0',getWelcome:()=>launcher?.getState(),getDemo:()=>launcher?.getDemo(),getScene:()=>JSON.parse(snapshot()),getTrace:()=>JSON.parse(JSON.stringify(trace)),getCamera:()=>JSON.parse(JSON.stringify(renderer.camera)),getDesign:()=>designer?.getState(),getSelection:()=>selected,getSelections:()=>[...selection],getStats:()=>({pending:needsTrace||traceBusy,worker:!!traceWorker,renderedSegments,rays:trace.seeds,segments:trace.segments.length,hits:trace.hits.length,limited:trace.limited,traceMs}),project:p=>renderer.project(p),getMode:()=>({mode,axis}),getHistory:()=>({undo:past.length,redo:future.length}),kernel:Object.freeze({createPreset,createObject,validateScene,traceScene,intersect,basis,focalPoints,syncAimLocks,cloneObjects,spotStatistics,telescopeReference,designMirror,auditMirror,auditFigure,inverseSag,inverseSurfaceMesh,syncInverseDesigns})});
}
try{boot();}catch(error){console.error(error);$('loading').hidden=false;$('loading').replaceChildren();const text=document.createElement('div'),strong=document.createElement('strong');strong.textContent='The 3D workspace could not start.';text.append(strong,document.createTextNode(error.message||'Use a WebGL-enabled browser.'));$('loading').append(text);}
