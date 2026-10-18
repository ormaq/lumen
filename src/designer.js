/** Inverse-design UI. Physics stays in optics.js; this module never bends rays. */
import {V,basis,worldVec,localVec,isMirror,isSource,CATALOG,designMirror,designIsStale,mirrorOriginal,auditMirror,auditFigure,validateInverseAperture,inverseSurfaceMesh,surfaceZ,surfaceNormal,traceScene,EPS} from './optics.js';
export function initDesigner(api){
 const el=id=>document.getElementById(id),root=el('design-panel'),clone=o=>JSON.parse(JSON.stringify(o));
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let opts={mirrorId:null,sourceId:null,detectorId:null,u:0,v:0,samples:2048},result=null,error='',timer=null,preview=null,previewing=false,picking=false,busy=false;
 let stamp='',failedLive=[],lastUID=null;
 const fmt=x=>!Number.isFinite(x)?'—':Math.abs(x)<1e-7?' < 10⁻⁷':Math.abs(x)<.001?x.toExponential(2):Math.abs(x)>1000?x.toPrecision(4):x.toFixed(4).replace(/\.?0+$/,'');
 function objects(){const s=api.getScene();return {s,m:s.objects.find(o=>o.id===opts.mirrorId),source:s.objects.find(o=>o.id===opts.sourceId),det:s.objects.find(o=>o.id===opts.detectorId)};}
 function fingerprint(){const {s}=objects();return JSON.stringify([s.objects,s.settings.maxDistance,s.settings.maxBounces,opts]);}
 function resolve(preferSelected=false){
  const s=api.getScene();if(s.uid!==lastUID){lastUID=s.uid;opts={mirrorId:null,sourceId:null,detectorId:null,u:0,v:0,samples:2048};result=null;error='';previewing=false;stamp='';}
  const previous=opts.mirrorId,selected=api.current();
  if(preferSelected&&isMirror(selected))opts.mirrorId=selected.id;
  if(!s.objects.some(o=>o.id===opts.mirrorId&&isMirror(o)))opts.mirrorId=s.objects.find(o=>isMirror(o)&&o.enabled)?.id||null;
  const m=s.objects.find(o=>o.id===opts.mirrorId);
  if(m?.design&&(previous!==m.id||!opts.sourceId))Object.assign(opts,{sourceId:m.design.sourceId,detectorId:m.design.detectorId,u:m.design.u,v:m.design.v});
  if(!s.objects.some(o=>o.id===opts.sourceId&&isSource(o)))opts.sourceId=s.objects.find(o=>isSource(o)&&o.enabled)?.id||null;
  if(!s.objects.some(o=>o.id===opts.detectorId&&o.type==='detector'))opts.detectorId=s.objects.find(o=>o.type==='detector'&&o.enabled)?.id||null;
 }
 function open(){resolve(true);api.showTab('design');api.showRight();render();scheduleAudit();}
 function setPreview(on){
  previewing=!!on&&!!result?.original&&result.stamp===fingerprint();
  if(previewing){
   const s=clone(api.getScene());s.objects=s.objects.map(o=>o.id===opts.mirrorId?clone(result.original):o);for(const o of s.objects)if(o.design)o.design.live=false;
   // Preview sampling affects display only. Both audit columns always use the same seeds.
   const sources=s.objects.filter(o=>isSource(o)&&o.enabled),cap=Math.max(32,Math.floor(4096/Math.max(1,sources.length)));
   for(const o of sources)o.count=Math.min(o.count,cap);s.settings.density=1;
   preview=traceScene(s);
  }else preview=null;
  api.redraw();render();updateBanner();
 }
 function updateBanner(){el('design-preview-banner').hidden=!previewing;el('design-target-hint').hidden=!picking;}
 function render(){
  resolve();const {s,m,source,det}=objects(),solved=m?.type==='shaped',stale=solved&&designIsStale(s,m),valid=result&&result.stamp===fingerprint();
  const select=(id,label,items,value)=>`<label class="design-select" for="${id}"><span>${label}</span><select id="${id}">${items.length?items.map(o=>`<option value="${o.id}" ${o.id===value?'selected':''}>${esc(o.name)}${o.enabled?'':' · disabled'}</option>`).join(''):'<option value="">None in scene</option>'}</select></label>`;
  const can=!!m&&!!source&&!!det;
  root.innerHTML=`<div class="design-intro"><div class="design-kicker">INVERSE OPTICS</div><h2>Shape to a detector.</h2><p>Choose the light. Choose its destination.<br>Let the surface do the correction.</p><div class="design-badge ${stale?'warn':solved?'solved':''}"><i></i>${stale?'Geometry changed · re-solve':solved?(m.design?.live?'Live surface correction':'Surface solved · one design point'):'One mirror. One target point.'}</div></div>
   <div class="design-section design-setup">
   ${select('design-mirror','Mirror to reshape',s.objects.filter(isMirror),opts.mirrorId)}
   ${select('design-source','Design light source',s.objects.filter(isSource),opts.sourceId)}
   ${select('design-detector','Target detector',s.objects.filter(o=>o.type==='detector'),opts.detectorId)}
   <div class="design-target-title"><span>Target on the detector</span><button id="design-center" ${!det?'disabled':''}>Center</button></div>
   <div class="design-target-fields"><label>u<input id="design-u" aria-label="Target u coordinate" type="number" value="${opts.u}" min="${det?-det.width/2:-10000}" max="${det?det.width/2:10000}" step=".01"></label><label>v<input id="design-v" aria-label="Target v coordinate" type="number" value="${opts.v}" min="${det?-det.height/2:-10000}" max="${det?det.height/2:10000}" step=".01"></label><button id="design-pick" title="Click a point on the detector in the 3D viewport" aria-label="Pick a target point on detector" ${!det?'disabled':''}>⊙</button></div>
   <p class="design-help">Detector-local coordinates · world units. The mirror’s anchor and mount orientation stay fixed.</p>
   <div id="design-error" class="design-error" role="alert" ${error?'':'hidden'}>${esc(error)}</div>
   <button class="design-solve" id="design-solve" ${!can||busy?'disabled':''}><span>✧</span>${busy?'Checking the surface…':solved?'Re-solve surface':'Auto-shape mirror'}<span>→</span></button>
   ${!can?'<p class="design-help">Add a mirror, a light source, and a detector—or start the example below.</p>':''}
   <label class="design-live"><input type="checkbox" id="design-live" ${solved&&m.design?.live?'checked':''} ${!solved?'disabled':''}><span>Keep correcting when objects move<small>Live re-shaping, not a rigid-mirror aim lock.</small></span></label>
   </div>
   <div class="design-section design-results" id="design-results">${valid?resultsHTML(result):`<div class="design-empty-result"><span class="design-empty-icon">◎</span><b>${solved?'Checking the current layout…':'From a blur to a focal point.'}</b><p>${solved?'The saved surface is traced as geometry.':'The solver constructs a continuous conic and compares the same source samples before and after.'}</p></div>`}</div>
   <details class="design-section design-details" ${valid?'open':''}><summary>What this solve does</summary><p>Parallel light → an off-axis paraboloid.<br>A finite source point → an ellipsoid.</p><p>This corrects <strong>one source point or one incoming direction</strong>. A sharp image of an entire field is a different, multi-field optical-design problem. Other stars and finite source sizes remain in the trace.</p><p>The solve assumes direct propagation in air. Obstructions and screen clipping are measured, not optimized away. Diffraction and manufacturing tolerances are not included.</p></details>
   <div class="design-section design-examples"><button id="design-example">↗ Open off-axis example</button><button id="design-finite-example">↗ Try a finite point source</button></div>`;
  if(valid){paintSpot(result);paintProfile(result);}
  el('design-restore')?.toggleAttribute('disabled',!m?.design?.original);
  updateBanner();
 }
 function resultsHTML(r){
  const {before,after,geometry,surface,warnings}=r,hasBaseline=!!r.original,focused=Number.isFinite(after.rms)&&after.rms<1e-7&&after.captured>0,improved=hasBaseline&&before.rms>1e-7&&focused,stale=r.stale;
  const note=after.captured===0?'No source samples reach the detector.':focused?'At numerical focus for the sampled design source.':'The sampled source still has a finite spot. See the notes below.';
  return `<div class="design-results-title"><h3>Measured, not assumed.</h3><span>${r.samples.toLocaleString()} audit rays</span></div>
   <div class="design-comparison"><div><span><i class="original-dot"></i>Original</span><strong>${hasBaseline?fmt(before.rms):'—'}</strong><small>RMS to target · u</small></div><div class="${focused?'corrected':''}"><span><i class="solved-dot"></i>${stale?'Current surface':'Solved'}</span><strong>${fmt(after.rms)}</strong><small>RMS to target · u</small></div></div>
   <p class="design-result-note ${after.captured===0||stale?'warn':''}">${stale?'Saved figure is out of date for these source/target choices. Re-solve to update it.':improved?'Blur removed for this design point.':note}</p>
   <canvas id="design-spot" width="620" height="370" aria-label="Before and after focal spot on the same coordinate scale"></canvas><p class="design-plot-caption">${hasBaseline?'Same target, same scale · original amber / current mint':'Current spot only · no original surface is stored with this reflector.'}</p>
   <div class="design-readout"><span>Detector capture / launched</span><strong>${hasBaseline?before.captured.toLocaleString():'—'} → ${after.captured.toLocaleString()} / ${after.launched.toLocaleString()}</strong></div>
   <div class="design-readout"><span>Mirror illuminated</span><strong>${hasBaseline?before.illuminated.toLocaleString():'—'} → ${after.illuminated.toLocaleString()}</strong></div>
   <div class="design-readout"><span>Current maximum target error</span><strong>${fmt(after.peak)} u</strong></div>
   <p class="design-help">RMS includes reflected samples outside the detector frame. Capture also checks blockers and path limits. No-hit results are not zero-error results.</p>
   <div class="design-compare-actions"><button id="design-before" class="${previewing?'active':''}" ${!r.original?'disabled':''}>View original</button><button id="design-after" class="${!previewing?'active':''}">View current</button></div>
   ${warnings.length?`<div class="design-warnings">${warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`:''}
   <details class="design-surface"><summary>Surface & export <span>${r.kind==='paraboloid'?'Off-axis paraboloid':'Ellipsoid'}</span></summary>
   <canvas id="design-profile" width="620" height="290" aria-label="Actual mirror surface profiles compared with the original"></canvas>
   <p class="design-plot-caption">Central u-section · actual sag, not exaggerated displacement</p>
   <div class="design-readout"><span>Sampled sag range</span><strong>${fmt(geometry.minSag)} to ${fmt(geometry.maxSag)} u</strong></div>
   <div class="design-readout"><span>Maximum sampled slope</span><strong>${Math.atan(surface.maxSlope)*180/Math.PI<.01?'0':(Math.atan(surface.maxSlope)*180/Math.PI).toFixed(2)}°</strong></div>
   <div class="design-readout"><span>Optical path spread</span><strong>${fmt(surface.oplPV)} u</strong></div>
   <p class="design-help">${surface.samples.toLocaleString()} independent full-aperture checks of the design wavefront. Sag is measured along the fixed local mount Z axis. This is a surface model, not a machining plan.</p>
   <div class="design-export-actions"><button id="design-export-csv">Sag CSV ↓</button><button id="design-export-obj">Surface OBJ ↓</button></div><button id="design-restore" class="design-restore">Restore original mirror</button></details>`;
 }
 function warningsFor(a,base=[]){
  const w=[...base];if(a.missMirror)w.push(`${a.missMirror.toLocaleString()} / ${a.launched.toLocaleString()} audit rays miss the mirror’s clear aperture.`);
  if(a.blocked)w.push(`${a.blocked.toLocaleString()} rays encounter another surface. This is a one-reflection audit; use the full scene for multi-element paths.`);
  if(a.pathLimited)w.push(`${a.pathLimited.toLocaleString()} rays exceed the maximum path length. Increase it in View → Simulation.`);
  if(a.ignored)w.push('The detector’s interaction threshold ignores these singly reflected rays.');
  if(a.noForward)w.push(`${a.noForward} reflected rays do not intersect the detector plane in front of the mirror.`);
  if(a.launched<128)w.push('Too few emitted samples for an aperture-wide empirical spot test. The independent full-aperture check is shown under Surface & export.');return w;
 }
 function runAudit(){
  resolve();const {s,m,source,det}=objects();if(!m||m.type!=='shaped'||!source||!det){result=null;render();return;}
  try{
   const original=mirrorOriginal(m),hasOriginal=!!m.design?.original,before=auditMirror(s,original,source,det,opts.u,opts.v,opts.samples),after=auditMirror(s,m,source,det,opts.u,opts.v,opts.samples);
   let notes=[];try{notes=designMirror({...s,objects:s.objects.map(o=>o===m?{...o,locked:false}:o)},{...opts}).warnings;}catch(e){notes=[e.message];}
   const stale=designIsStale(s,m)||m.design?.sourceId!==opts.sourceId||m.design?.detectorId!==opts.detectorId||m.design?.u!==opts.u||m.design?.v!==opts.v;
   result={before,after,geometry:validateInverseAperture(m),surface:auditFigure(m),warnings:warningsFor(after,notes),original:hasOriginal?original:null,solved:clone(m),kind:m.figure.kind,samples:after.launched,stale,stamp:fingerprint()};stamp=result.stamp;
  }catch(e){error=e.message;result=null;}
  render();api.redraw();
 }
 function scheduleAudit(){clearTimeout(timer);if(!root.hidden)timer=setTimeout(runAudit,180);}
 async function solve(){
  if(busy)return;error='';previewing=false;preview=null;picking=false;busy=true;render();api.redraw();
  await new Promise(r=>setTimeout(r,25));
  try{
   const {s,m,source,det}=objects();if(!m||!source||!det)throw new Error('Choose a mirror, light source, and detector.');
   const solve=designMirror(s,{...opts,live:m.design?.live||false}),surface=auditFigure(solve.mirror),after=auditMirror(s,solve.mirror,source,det,opts.u,opts.v,opts.samples);
   if(!after.illuminated)throw new Error('No audit rays illuminate this mirror. Aim or move the source first; no shape was applied.');
   if(!after.captured)throw new Error('The designed surface has no captured audit rays. Check screen obstructions, path length, and detector interaction threshold; no shape was applied.');
   const original=mirrorOriginal(m),before=auditMirror(s,original,source,det,opts.u,opts.v,opts.samples);
   api.transact(()=>{const state=api.getScene(),i=state.objects.findIndex(o=>o.id===m.id);state.objects[i]=solve.mirror;state.settings.primaryId=m.id;state.settings.detectorId=det.id;});
   result={before,after,surface,geometry:solve.geometry,warnings:warningsFor(after,solve.warnings),original:solve.mirror.design.original?original:null,solved:clone(solve.mirror),kind:solve.mirror.figure.kind,samples:after.launched,stale:false,stamp:fingerprint()};stamp=result.stamp;
   api.notify(after.rms<1e-7?'Surface reshaped. The sampled design source is at numerical focus.':'Chief wavefront corrected. The actual source still has a finite image.');
  }catch(e){error=e.message;}
  busy=false;render();api.redraw();if(!error)requestAnimationFrame(()=>el('design-results')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 }
 function changed(errors=[]){
  failedLive=errors;resolve();const next=fingerprint();if(next===stamp)return;
  previewing=false;preview=null;updateBanner();
  if(errors.some(e=>e.id===opts.mirrorId))error='Live correction paused: '+errors.find(e=>e.id===opts.mirrorId).message;
  else if(error.startsWith('Live correction paused:'))error='';
  scheduleAudit();
 }
 function drawTarget(){
  if(root.hidden&&!picking)return;const {det}=objects();if(!det)return;
  const b=basis(det),p=V.add(det.p,worldVec([opts.u,opts.v,0],b)),r=Math.max(.025,Math.min(det.width,det.height)*.045),renderer=api.renderer,gl=renderer.gl;
  gl.disable(gl.DEPTH_TEST);const color=[.53,.94,.77,.95],pts=[];
  for(let i=0;i<48;i++)for(const a of [i*2*Math.PI/48,(i+1)*2*Math.PI/48])pts.push(V.add(p,worldVec([r*Math.cos(a),r*Math.sin(a),0],b)));
  for(const a of [b.u,b.v])pts.push(V.add(p,V.mul(a,-r*1.7)),V.add(p,V.mul(a,r*1.7)));
  renderer.lines(pts,color);gl.enable(gl.DEPTH_TEST);
 }
 function pick(ray){
  if(!picking)return false;const {det}=objects();if(!det){picking=false;updateBanner();return true;}
  const b=basis(det),den=V.dot(ray.direction,b.n),t=Math.abs(den)>1e-10?V.dot(V.sub(det.p,ray.origin),b.n)/den:-1;
  if(t<=0){api.notify('Click the detector face.');return true;}
  const q=localVec(V.sub(V.add(ray.origin,V.mul(ray.direction,t)),det.p),b);
  if(Math.abs(q[0])>det.width/2||Math.abs(q[1])>det.height/2){api.notify('That point is outside the detector. Click inside its frame.');return true;}
  opts.u=+q[0].toFixed(6);opts.v=+q[1].toFixed(6);picking=false;result=null;previewing=false;preview=null;render();api.showRight();api.redraw();api.notify('Target point selected. Auto-shape to apply the new constraint.');scheduleAudit();return true;
 }
 function paintSpot(r){
  const c=el('design-spot');if(!c)return;const ctx=c.getContext('2d'),W=c.width,H=c.height,P=42;
  const {det}=objects(),before=r.original?r.before:{points:[]},pts=[...before.points,...r.after.points],u=opts.u,v=opts.v;
  let maxX=det?.width/2||1,maxY=det?.height/2||1;
  for(const p of pts){maxX=Math.max(maxX,Math.abs(p.u-u));maxY=Math.max(maxY,Math.abs(p.v-v));}
  const scale=Math.min((W-2*P)/(2*maxX*1.12),(H-2*P)/(2*maxY*1.12)),project=(x,y)=>[W/2+(x-u)*scale,H/2-(y-v)*scale];
  ctx.fillStyle='#0b131c';ctx.fillRect(0,0,W,H);ctx.lineWidth=1;ctx.strokeStyle='#263442';
  for(let i=0;i<=4;i++){const x=P+(W-2*P)*i/4,y=P+(H-2*P)*i/4;ctx.beginPath();ctx.moveTo(x,P);ctx.lineTo(x,H-P);ctx.moveTo(P,y);ctx.lineTo(W-P,y);ctx.stroke();}
  if(det){ctx.setLineDash([7,6]);ctx.strokeStyle='#758f9f';const [x,y]=project(-det.width/2,det.height/2);ctx.strokeRect(x,y,det.width*scale,det.height*scale);ctx.setLineDash([]);}
  for(const [a,color]of [[before,'#e9ae66'],[r.after,'#89e9bd']]){ctx.fillStyle=color;ctx.globalAlpha=.50;for(const p of a.points){const [x,y]=project(p.u,p.v);ctx.beginPath();ctx.arc(x,y,a===r.after?2.6:2,0,Math.PI*2);ctx.fill();}}
  ctx.globalAlpha=1;ctx.strokeStyle='#e6f3eb';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(W/2-8,H/2);ctx.lineTo(W/2+8,H/2);ctx.moveTo(W/2,H/2-8);ctx.lineTo(W/2,H/2+8);ctx.stroke();
  ctx.font='20px system-ui';ctx.fillStyle='#a6bbcb';ctx.fillText('Detector frame / target +',P,25);ctx.textAlign='right';ctx.fillText('u span '+fmt((W-2*P)/scale),W-P,H-12);ctx.textAlign='left';
 }
 function paintProfile(r){
  const c=el('design-profile');if(!c)return;const ctx=c.getContext('2d'),W=c.width,H=c.height,P=42,R=r.solved.diameter/2;
  const profile=o=>Array.from({length:121},(_,i)=>{const x=(i/120*2-1)*R;return [x,surfaceZ(o,x,0)];});
  const lines=[r.original?profile(r.original):[],profile(r.solved)],zs=lines.flat().map(p=>p[1]).filter(Number.isFinite);let lo=Math.min(0,...zs),hi=Math.max(.01,...zs),pad=(hi-lo)*.16;lo-=pad;hi+=pad;
  const proj=p=>[P+(p[0]/R+1)/2*(W-2*P),H-P-(p[1]-lo)/(hi-lo)*(H-2*P)];
  ctx.fillStyle='#0b131c';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#344958';ctx.beginPath();const a=proj([-R,0]),b=proj([R,0]);ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
  for(const [i,line]of lines.entries()){ctx.strokeStyle=i?'#89e9bd':'#e9ae66';ctx.lineWidth=3;ctx.beginPath();line.forEach((p,j)=>{if(!p.every(Number.isFinite))return;const q=proj(p);if(j)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.stroke();}
  ctx.fillStyle='#a6bbcb';ctx.font='20px system-ui';ctx.fillText('Sag / local Z',P,26);ctx.fillText('−'+fmt(R),P,H-12);ctx.textAlign='right';ctx.fillText('+'+fmt(R)+' u',W-P,H-12);ctx.fillText(fmt(hi-pad)+' u',W-P,26);ctx.textAlign='left';
 }
 function exportSurface(kind){
  const {s,m}=objects();if(!m||m.type!=='shaped')return;
  const mesh=inverseSurfaceMesh(m),b=basis(m),original=m.design?.original?mirrorOriginal(m):null;let data,name,type;
  if(kind==='csv'){
   const rows=['u_world,v_world,sag_world,delta_original_world,n_u,n_v,n_z,x_world,y_world,z_world,mm_per_unit'];
   mesh.vertices.forEach((p,i)=>{const w=V.add(m.p,worldVec(p,b)),delta=original?p[2]-surfaceZ(original,p[0],p[1]):'';rows.push([...p,delta,...mesh.normals[i],...w,s.settings.mmPerUnit].join(','));});data=rows.join('\n');name='lumen-mirror-sag.csv';type='text/csv';
  }else{
   const rows=['# Lumen 4 inverse reflector — open surface, NOT a watertight fabrication solid.','# Coordinates are local mount axes, in world units.','# mm_per_unit '+s.settings.mmPerUnit,'# World anchor '+m.p.join(' '),'# yaw tilt roll (degrees) '+[m.yaw,m.tilt,m.roll].join(' '),'o inverse_reflector'];
   for(const p of mesh.vertices)rows.push('v '+p.map(v=>v.toPrecision(14)).join(' '));for(const n of mesh.normals)rows.push('vn '+n.map(v=>v.toPrecision(14)).join(' '));
   for(const f of mesh.faces){const normal=V.cross(V.sub(mesh.vertices[f[1]],mesh.vertices[f[0]]),V.sub(mesh.vertices[f[2]],mesh.vertices[f[0]]));const indices=V.dot(normal,mesh.normals[f[0]])<0?[f[0],f[2],f[1]]:f;rows.push('f '+indices.map(i=>`${i+1}//${i+1}`).join(' '));}data=rows.join('\n');name='lumen-mirror-surface.obj';type='text/plain';
  }
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);api.notify(kind==='csv'?'Sag and normal samples exported. Units and world scale are included.':'Open surface mesh exported in local mount coordinates.');
 }
 root.addEventListener('change',e=>{
  const id=e.target.id;if(['design-mirror','design-source','design-detector'].includes(id)){
   const k={'design-mirror':'mirrorId','design-source':'sourceId','design-detector':'detectorId'}[id];opts[k]=e.target.value;
   if(id==='design-mirror'){const m=objects().m;if(m?.design)Object.assign(opts,{sourceId:m.design.sourceId,detectorId:m.design.detectorId,u:m.design.u,v:m.design.v});}
   if(id==='design-detector'){opts.u=0;opts.v=0;}result=null;previewing=false;preview=null;error='';render();scheduleAudit();api.redraw();
  }else if(id==='design-u'||id==='design-v'){
   const n=Number(e.target.value);if(!e.target.value.trim()||!Number.isFinite(n)){error='Enter a finite target coordinate.';render();return;}opts[id==='design-u'?'u':'v']=n;result=null;previewing=false;preview=null;error='';render();scheduleAudit();api.redraw();
  }else if(id==='design-live'){const {m}=objects();if(m?.design){api.transact(()=>m.design.live=e.target.checked);render();api.notify(e.target.checked?'Live surface correction enabled. Moving the geometry will change this mirror’s shape.':'Surface frozen. It now behaves as a rigid, shaped mirror.');}}
 });
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;switch(b.id){
  case 'design-button':case 'design-open-selected':open();break;
  case 'design-solve':solve();break;
  case 'design-center':opts.u=opts.v=0;result=null;previewing=false;preview=null;render();scheduleAudit();api.redraw();break;
  case 'design-pick':picking=!picking;if(picking&&innerWidth<=720)el('right-dock').classList.remove('mobile-open');updateBanner();api.notify(picking?'Click a point inside the detector frame. Escape cancels.':'Target picking canceled.');break;
  case 'design-before':setPreview(true);break;
  case 'design-after':case 'design-end-preview':setPreview(false);break;
  case 'design-export-csv':exportSurface('csv');break;
  case 'design-export-obj':exportSurface('obj');break;
  case 'design-restore':{const {m}=objects();if(!m?.design?.original)return;api.transact(()=>{const s=api.getScene(),i=s.objects.indexOf(m);s.objects[i]=mirrorOriginal(m);});result=null;error='';previewing=false;preview=null;render();api.redraw();api.notify('Original optical surface restored. Undo brings the solved shape back.');break;}
  case 'design-example':api.loadPreset('inverse');open();break;
  case 'design-finite-example':api.loadPreset('finite');open();break;
 }});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&picking){picking=false;updateBanner();api.redraw();}});
 return {open,render,changed,draw:drawTarget,pick,isPicking:()=>picking,visible:()=>!root.hidden,refresh:scheduleAudit,
  displayObject:o=>previewing&&o.id===opts.mirrorId&&result?.original?result.original:o,
  displayTrace:t=>previewing&&preview?preview:t,
  getState:()=>({options:clone(opts),solved:objects().m?.type==='shaped',previewing,picking,error,result:result?{baselineAvailable:!!result.original,before:{...result.before,points:undefined},after:{...result.after,points:undefined},surface:result.surface,geometry:result.geometry,stale:result.stale,warnings:result.warnings}:null})};
}
