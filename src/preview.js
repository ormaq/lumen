/** Real ray-traced launch previews, isolated from the editable project.
 * A single reusable WebGL context, capped samples and 30 Hz updates keep the
 * launch screen light. The opening scene retains its full tracing density.
 */
import {V,rad,deg,clamp,basis,worldVec,isSource,createPreset,syncAimLocks,sourceColor,surfaceZ,focalPoints,traceScene,designMirror} from './optics.js';
import {M,Renderer} from './renderer.js';
export const DEMO_INFO={
 inverse:{tag:'INVERSE DESIGN',title:'A mirror made for its target',short:'Turn an off-axis blur into a focus.',hint:'Select the mirror and open Shape. Compare the original surface with the corrected figure.',color:'#efbf78'},
 binary:{tag:'TELESCOPE',title:'Two stars. One telescope.',short:'Separate two distant points of light.',hint:'Select Star B and adjust Field X. Keep the detector monitor open to watch both focal spots.',color:'#97cfff'},
 splitter:{tag:'REFLECTION',title:'One beam, two possibilities',short:'Split light. Follow both paths.',hint:'Select the splitter and change its reflected fraction. Analysis measures each detector’s incident power.',color:'#8bdec4'},
 rgb:{tag:'LIGHT & COLOR',title:'A little color goes a long way',short:'Three sources. An open palette.',hint:'Select a light and choose its color. Filter the detector analysis to inspect one source at a time.',color:'#c1a5fa'},
 glass:{tag:'REFRACTION',title:'Through the looking glass',short:'Trace the shape of a caustic.',hint:'Select the glass sphere and adjust refractive index. Try optional Fresnel reflections in its inspector.',color:'#89dfb8'},
 relay:{tag:'3D OPTICS',title:'Take the scenic route',short:'Route a beam up, over and around.',hint:'Choose Move or Rotate, then drag a mirror’s handles. Press Home to frame the whole scene.',color:'#bcadf9'},
};
export function buildDemoScene(name,corrected=false){
 const scene=createPreset(name);scene.settings.animate=true;
 if(['star','coma','binary'].includes(name)){
  // A rigid 90-degree rotation of the old vertical telescope, not a change in optics.
  const turn=p=>[-p[1],p[0],p[2]];
  for(const o of scene.objects){const b=basis(o),n=turn(b.n),u=turn(b.u);o.p=[120-o.p[1],4+o.p[0],o.p[2]];o.yaw=deg(Math.atan2(n[0],n[2]));o.tilt=deg(Math.asin(clamp(n[1],-1,1)));o.roll=0;const b0=basis(o);o.roll=deg(Math.atan2(V.dot(u,b0.v),V.dot(u,b0.u)));}
  scene.settings.grid=true;scene.settings.hideStands=true;scene.workspace.monitor=true;
 }
 if(name==='inverse'&&corrected){const result=designMirror(scene,{mirrorId:'o2',sourceId:'o1',detectorId:'o3'});scene.objects[1]=result.mirror;}
 syncAimLocks(scene);return scene;
}
export class LivePreview {
 constructor(canvas,onStatus=()=>{}){
  this.canvas=canvas;this.r=new Renderer(canvas);this.onStatus=onStatus;this.active=false;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;this.dirty=true;this.time=0;this.last=0;this.lastPaint=0;this.drag=null;this.frames=0;
  this.resize=new ResizeObserver(()=>{this.r.resize();if(this.scene)this.fit();this.dirty=true;});this.resize.observe(canvas);
  canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);this.turntable=false;});
  canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.r.camera.yaw+=(e.clientX-this.drag[0])*.007;this.r.camera.pitch=clamp(this.r.camera.pitch+(e.clientY-this.drag[1])*.007,-1.4,1.4);this.drag=[e.clientX,e.clientY];this.dirty=true;});
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(ev,()=>this.drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.r.camera.radius=clamp(this.r.camera.radius*Math.exp(clamp(e.deltaY,-200,200)*.001),1,150);this.dirty=true;},{passive:false});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.active=false;this.onStatus('Preview interrupted. Open a scene to continue.');});
  const tick=t=>{requestAnimationFrame(tick);if(!this.active||document.hidden){this.last=0;return;}const dt=this.last?Math.min(.08,(t-this.last)/1000):0;this.last=t;if(this.motion){this.time+=dt;if(this.turntable)this.r.camera.yaw=this.baseYaw+Math.sin(this.time*.16)*.24;}if((this.dirty||this.motion)&&t-this.lastPaint>32){this.draw();this.dirty=false;this.lastPaint=t;this.frames++;}};
  requestAnimationFrame(tick);
 }
 setScene(scene){
  this.scene=JSON.parse(JSON.stringify(scene));const low=JSON.parse(JSON.stringify(scene));low.settings.density=1;
  for(const o of low.objects)if(isSource(o))o.count=Math.min(o.count,97);
  this.trace=traceScene(low);for(const key of Object.keys(this.r.meshes))if(key.startsWith('preview-'))this.r.disposeMesh(key);
  for(const o of scene.objects)if(['parabola','shaped','spherical','trough'].includes(o.type))this.r.curve('preview-'+o.id,o);
  this.baseYaw=scene.preset==='relay'?1.0:2.13;this.r.camera.yaw=this.baseYaw;this.r.camera.pitch=scene.preset==='relay'?.47:.33;this.turntable=true;this.time=0;this.r.resize();this.fit();this.dirty=true;
  this.onStatus(`${this.trace.seeds} preview rays · real geometric tracing`);
 }
 fit(){
  if(!this.scene||!this.r.width||!this.r.height)return;
  const pts=[];for(const o of this.scene.objects){const d=isSource(o)?Math.max(.5,(o.aperture||1)/2):Math.max(o.diameter/2||0,o.width/2||0,o.height/2||0,o.type==='glass'?o.radius:0);const radius=clamp(d,.5,8);for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])pts.push(V.add(o.p,[x*radius,y*radius,z*radius]));}
  if(!pts.length)return;const min=[0,1,2].map(i=>Math.min(...pts.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...pts.map(p=>p[i])));this.r.camera.target=V.mix(min,max,.5);this.r.updateCamera();let extent=0;
  for(const p of pts){const q=V.sub(p,this.r.camera.target),d=-V.dot(q,this.r.forward);extent=Math.max(extent,Math.abs(V.dot(q,this.r.up))/Math.tan(this.r.fov/2)+d,Math.abs(V.dot(q,this.r.right))/(Math.tan(this.r.fov/2)*this.r.width/this.r.height)+d);}
  this.r.camera.radius=Math.max(6,extent*.91);this.dirty=true;
 }
 show(active){this.active=active;this.last=0;if(active){this.r.resize();this.dirty=true;}}
 toggle(){this.motion=!this.motion;this.dirty=true;return this.motion;}
 ring(center,b,r,color,sag=null){const p=[];for(let i=0;i<96;i++)for(const a of [i/96*2*Math.PI,(i+1)/96*2*Math.PI]){const x=r*Math.cos(a),y=r*Math.sin(a);p.push(V.add(center,worldVec([x,y,sag?surfaceZ(sag,x,y):0],b)));}this.r.lines(p,color);}
 draw(){
  const r=this.r,gl=r.gl;r.begin();const center=r.camera.target;
  const grid=[];const floor=Math.min(...this.scene.objects.map(o=>o.p[1]))-3;for(let i=-12;i<=12;i++){grid.push([center[0]-24,floor,center[2]+i*2],[center[0]+24,floor,center[2]+i*2],[center[0]+i*2,floor,center[2]-24],[center[0]+i*2,floor,center[2]+24]);}gl.depthMask(false);r.lines(grid,[.25,.36,.46,.15]);gl.depthMask(true);
  for(const o of this.scene.objects){if(!o.enabled)continue;const b=basis(o),model=M.model(o.p,b.u,b.v,b.n);
   if(isSource(o)){const c=sourceColor(o);r.sphere(o.p,.10,[...c,1]);if(['beam','star'].includes(o.type))this.ring(o.p,b,o.aperture/2,[...c,.7]);else r.segment(V.add(o.p,V.mul(b.n,-.55)),o.p,.13,[.3,.4,.45,1],'cylinder',false);continue;}
   if(['parabola','shaped','spherical','trough'].includes(o.type)){
    gl.depthMask(false);r.draw('preview-'+o.id,model,[.37,.59,.73,.57],false,true);gl.depthMask(true);
    if(o.type!=='trough'){this.ring(o.p,b,o.diameter/2,[.59,.77,.85,.9],o);for(const f of [.33,.66])this.ring(o.p,b,o.diameter/2*f,[.39,.62,.74,.25],o);}
   }else if(o.type==='glass'||o.type==='lens'){
    const radius=o.type==='glass'?o.radius:o.diameter/2;gl.depthMask(false);r.draw('sphere',M.model(o.p,b.u,b.v,b.n,[radius,radius,o.type==='glass'?radius:.10]),[.32,.61,.8,.23],false,true);gl.depthMask(true);this.ring(o.p,b,radius,[.53,.77,.86,.75]);
   }else{
    const corners=[[-o.width/2,-o.height/2,0],[o.width/2,-o.height/2,0],[o.width/2,o.height/2,0],[-o.width/2,o.height/2,0]].map(p=>V.add(o.p,worldVec(p,b)));
    gl.depthMask(false);r.draw('plane',M.model(o.p,b.u,b.v,b.n,[o.width,o.height,1]),o.type==='detector'?[.08,.14,.20,.82]:[.46,.56,.76,.38],false,o.type!=='detector');gl.depthMask(true);
    for(let i=0;i<4;i++)r.segment(corners[i],corners[(i+1)%4],.027,[.49,.65,.72,.9]);
   }
  }
  const vertices=[],dots=[],pixel=2*Math.tan(r.fov/2)/Math.max(r.height,1);
  for(const s of this.trace.segments){const side=V.unit(V.cross(V.sub(s.b,s.a),r.forward)),w=Math.max(.01,V.dot(V.sub(s.a,r.eye),r.forward))*pixel*.55;const pts=[V.sub(s.a,V.mul(side,w)),V.add(s.a,V.mul(side,w)),V.sub(s.b,V.mul(side,w)),V.add(s.b,V.mul(side,w))];const a=clamp(s.visual*.43,.035,.62);for(const i of [0,1,2,1,3,2])vertices.push(...pts[i],...s.color,a);
   if(this.motion&&s.rayIndex%4===0){const gap=5,first=((this.time*2.5-s.startLength)%gap+gap)%gap;for(let k=first;k<s.length;k+=gap)dots.push(...V.mix(s.a,s.b,k/s.length),...s.color,.9);}
  }
  gl.depthMask(false);r.batch(vertices);if(dots.length)r.batch(dots,true,3.4);
  const hits=[];for(const d of Object.values(this.trace.detectors))for(const h of d.hits)hits.push(...h.point,...h.color,.94);r.batch(hits,true,3.6);gl.depthMask(true);
 }
}
