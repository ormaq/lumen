/* Minimal WebGL renderer: matrices, reusable meshes, orbit-camera projection.
 * No network assets, frameworks, or third-party dependencies.
 */
import {V,clamp,surfaceZ,surfaceNormal} from './optics.js';
export const M={
  identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
  multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;},
  perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);},
  lookAt(eye,target,up=[0,1,0]){const z=V.unit(V.sub(eye,target)),x=V.unit(V.cross(up,z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1]);},
  model(p=[0,0,0],u=[1,0,0],v=[0,1,0],n=[0,0,1],s=[1,1,1]){return new Float32Array([u[0]*s[0],u[1]*s[0],u[2]*s[0],0,v[0]*s[1],v[1]*s[1],v[2]*s[1],0,n[0]*s[2],n[1]*s[2],n[2]*s[2],0,...p,1]);},
  normal(m){const a=[m[0],m[1],m[2]],b=[m[4],m[5],m[6]],c=[m[8],m[9],m[10]];const bc=V.cross(b,c),det=V.dot(a,bc)||1;return new Float32Array([...V.mul(bc,1/det),...V.mul(V.cross(c,a),1/det),...V.mul(V.cross(a,b),1/det)]);},
  transform(m,p){const x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return [(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w,w];}
};
const VERT=`attribute vec3 aPosition; attribute vec3 aNormal; uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNormal; varying vec3 vNormal; varying vec3 vWorld; void main(){vec4 p=uModel*vec4(aPosition,1.);vWorld=p.xyz;vNormal=uNormal*aNormal;gl_Position=uVP*p;}`;
const FRAG=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
 uniform vec4 uColor; uniform float uUnlit; uniform float uMirror; uniform vec3 uEye; uniform float uDistance; varying vec3 vNormal; varying vec3 vWorld; void main(){vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;vec3 c=uColor.rgb; if(uUnlit<0.5){float l=0.55+0.31*max(dot(N,normalize(vec3(-0.5,1.,0.7))),0.)+0.17*max(dot(N,normalize(vec3(0.7,0.4,-0.6))),0.);c*=l;} if(uMirror>0.5){float fres=pow(1.-abs(dot(N,normalize(uEye-vWorld))),2.);float shade=0.55+0.20*sin(vWorld.y*0.7+vWorld.x*0.20+vWorld.z*0.3);c=mix(c*shade,vec3(0.36,0.47,0.54),fres*0.45);float band=pow(max(0.,sin((vWorld.x+vWorld.z)*0.18+vWorld.y*0.43)),8.);c+=vec3(0.08,0.14,0.20)*band;} float fog=smoothstep(uDistance*1.5,uDistance*4.,length(uEye-vWorld));c=mix(c,vec3(0.039,0.055,0.078),fog*0.38);gl_FragColor=vec4(c,uColor.a);}`;
function compile(gl,type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error('Shader compilation failed: '+msg);}return shader;}
function meshData(){return {positions:[],normals:[],indices:[]};}
function face(data,points,n){const i=data.positions.length/3;for(const p of points){data.positions.push(...p);data.normals.push(...n);}data.indices.push(i,i+1,i+2,i,i+2,i+3);}
function boxData(){const d=meshData();face(d,[[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],[0,0,1]);face(d,[[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],[0,0,-1]);face(d,[[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],[1,0,0]);face(d,[[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],[-1,0,0]);face(d,[[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],[0,1,0]);face(d,[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],[0,-1,0]);return d;}
function planeData(){const d=meshData();face(d,[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],[0,0,1]);return d;}
function cylinderData(n=16,cone=false){const d=meshData();for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2;const r=cone?0:1;const base=d.positions.length/3;const pts=[[Math.cos(a),-.5,Math.sin(a)],[Math.cos(b),-.5,Math.sin(b)],[r*Math.cos(b),.5,r*Math.sin(b)],[r*Math.cos(a),.5,r*Math.sin(a)]];for(let j=0;j<4;j++){d.positions.push(...pts[j]);const ang=j===0||j===3?a:b;d.normals.push(...V.unit([Math.cos(ang),cone?1:0,Math.sin(ang)]));}d.indices.push(base,base+2,base+1,base,base+3,base+2);for(const top of [false,true]){const y=top?.5:-.5,rr=top?r:1,k=d.positions.length/3;for(const p of [[0,y,0],[rr*Math.cos(a),y,rr*Math.sin(a)],[rr*Math.cos(b),y,rr*Math.sin(b)]]){d.positions.push(...p);d.normals.push(0,top?1:-1,0);}if(top)d.indices.push(k,k+2,k+1);else d.indices.push(k,k+1,k+2);}}return d;}
function sphereData(rows=20,cols=32){const d=meshData();for(let y=0;y<=rows;y++){const p=y/rows*Math.PI;for(let x=0;x<=cols;x++){const a=x/cols*Math.PI*2;const n=[Math.sin(p)*Math.cos(a),Math.cos(p),Math.sin(p)*Math.sin(a)];d.positions.push(...n);d.normals.push(...n);}}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*(cols+1)+x;d.indices.push(i,i+1,i+cols+1,i+1,i+cols+2,i+cols+1);}return d;}
export class Renderer {
  constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL is not available. Enable hardware acceleration in your browser and reopen this file.');this.gl=gl;const program=gl.createProgram();gl.attachShader(program,compile(gl,gl.VERTEX_SHADER,VERT));gl.attachShader(program,compile(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Unable to initialize the 3D renderer.');gl.useProgram(program);this.program=program;this.loc={};for(const name of ['uModel','uVP','uNormal','uColor','uUnlit','uMirror','uEye','uDistance'])this.loc[name]=gl.getUniformLocation(program,name);this.pos=gl.getAttribLocation(program,'aPosition');this.nor=gl.getAttribLocation(program,'aNormal');gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.meshes={box:this.upload(boxData()),plane:this.upload(planeData()),cylinder:this.upload(cylinderData()),tube:this.upload(cylinderData(8)),cone:this.upload(cylinderData(12,true)),sphere:this.upload(sphereData())};this.dynamic=gl.createBuffer();this.camera={yaw:2.3,pitch:.42,radius:21,target:[-.3,2.7,0],orthographic:false};this.resize();}
  upload(d){const gl=this.gl,out={};for(const [key,arr]of [['position',d.positions],['normal',d.normals]]){out[key]=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,out[key]);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);}out.index=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,out.index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(d.indices),gl.STATIC_DRAW);out.count=d.indices.length;return out;}
  disposeMesh(name){const m=this.meshes[name];if(!m)return;for(const k of ['position','normal','index'])this.gl.deleteBuffer(m[k]);delete this.meshes[name];}
  curve(name,o){this.disposeMesh(name);this.meshes[name]=this.upload(curveData(o));}
  // Named slots retain immutable geometry across animation frames. Replacing the
  // array refreshes that slot; empty geometry releases it. Dynamic dots stay streamed.
  batch(vertices,points=false,size=4,cacheKey=null){
    const gl=this.gl;
    if(!vertices.length){if(cacheKey&&this.batchCache?.has(cacheKey)){gl.deleteBuffer(this.batchCache.get(cacheKey).buffer);this.batchCache.delete(cacheKey);}return;}
    if(!this.batchProgram){
      const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec4 aColor;uniform mat4 uVP;uniform float uSize;varying vec4 vColor;void main(){gl_Position=uVP*vec4(aPosition,1.);gl_PointSize=uSize;vColor=aColor;}`));
      gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,`precision mediump float;varying vec4 vColor;uniform float uPoint;void main(){float a=1.;if(uPoint>.5){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;a=1.-smoothstep(.12,.5,d);}gl_FragColor=vec4(vColor.rgb,vColor.a*a);}`));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Ray shader failed.');
      this.batchProgram=p;this.batchLoc={pos:gl.getAttribLocation(p,'aPosition'),color:gl.getAttribLocation(p,'aColor'),vp:gl.getUniformLocation(p,'uVP'),size:gl.getUniformLocation(p,'uSize'),point:gl.getUniformLocation(p,'uPoint')};this.batchBuffer=gl.createBuffer();
    }
    const b=this.batchLoc;gl.useProgram(this.batchProgram);
    if(cacheKey){
      this.batchCache??=new Map();
      let cached=this.batchCache.get(cacheKey);
      if(!cached){cached={buffer:gl.createBuffer(),vertices:null};this.batchCache.set(cacheKey,cached);}
      gl.bindBuffer(gl.ARRAY_BUFFER,cached.buffer);
      if(cached.vertices!==vertices){gl.bufferData(gl.ARRAY_BUFFER,vertices instanceof Float32Array?vertices:new Float32Array(vertices),gl.STATIC_DRAW);cached.vertices=vertices;}
    }else{gl.bindBuffer(gl.ARRAY_BUFFER,this.batchBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices instanceof Float32Array?vertices:new Float32Array(vertices),gl.DYNAMIC_DRAW);}
    gl.enableVertexAttribArray(b.pos);gl.vertexAttribPointer(b.pos,3,gl.FLOAT,false,28,0);gl.enableVertexAttribArray(b.color);gl.vertexAttribPointer(b.color,4,gl.FLOAT,false,28,12);gl.uniformMatrix4fv(b.vp,false,this.vp);gl.uniform1f(b.size,size*Math.min(window.devicePixelRatio||1,2));gl.uniform1f(b.point,points?1:0);gl.drawArrays(points?gl.POINTS:gl.TRIANGLES,0,vertices.length/7);gl.disableVertexAttribArray(b.color);gl.useProgram(this.program);
  }
  resize(){const rect=this.canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);this.width=rect.width;this.height=rect.height;const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.gl.viewport(0,0,w,h);this.updateCamera();}
  updateCamera(){const c=this.camera;this.eye=V.add(c.target,[Math.cos(c.yaw)*Math.cos(c.pitch)*c.radius,Math.sin(c.pitch)*c.radius,Math.sin(c.yaw)*Math.cos(c.pitch)*c.radius]);this.forward=V.unit(V.sub(c.target,this.eye));this.right=V.unit(V.cross(this.forward,[0,1,0]));this.up=V.cross(this.right,this.forward);const aspect=this.width/this.height;this.fov=2*Math.atan(Math.tan(.69/2)*Math.max(1,1.1/aspect));this.halfHeight=c.radius*Math.tan(this.fov/2);const near=Math.max(.01,c.radius/30000),far=Math.max(1000,c.radius*50);this.near=near;this.far=far;const projection=c.orthographic?M.orthographic(-this.halfHeight*aspect,this.halfHeight*aspect,-this.halfHeight,this.halfHeight,near,far):M.perspective(this.fov,aspect,near,far);this.vp=M.multiply(projection,M.lookAt(this.eye,c.target));}
  begin(){const gl=this.gl;this.updateCamera();gl.useProgram(this.program);gl.clearColor(...(this.background||[.039,.055,.078]),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(this.loc.uVP,false,this.vp);gl.uniform3fv(this.loc.uEye,this.eye);gl.uniform1f(this.loc.uDistance,this.camera.radius);gl.depthMask(true);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}
  draw(name,model,color,unlit=false,mirror=false){const gl=this.gl,m=this.meshes[name];gl.bindBuffer(gl.ARRAY_BUFFER,m.position);gl.enableVertexAttribArray(this.pos);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.normal);gl.enableVertexAttribArray(this.nor);gl.vertexAttribPointer(this.nor,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.index);gl.uniformMatrix4fv(this.loc.uModel,false,model);gl.uniformMatrix3fv(this.loc.uNormal,false,M.normal(model));gl.uniform4fv(this.loc.uColor,color);gl.uniform1f(this.loc.uUnlit,unlit?1:0);gl.uniform1f(this.loc.uMirror,mirror?1:0);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
  lines(points,color){if(!points.length)return;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points.flat()),gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(this.pos);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,0,0);gl.disableVertexAttribArray(this.nor);gl.vertexAttrib3f(this.nor,0,1,0);const id=M.identity();gl.uniformMatrix4fv(this.loc.uModel,false,id);gl.uniformMatrix3fv(this.loc.uNormal,false,M.normal(id));gl.uniform4fv(this.loc.uColor,color);gl.uniform1f(this.loc.uUnlit,1);gl.uniform1f(this.loc.uMirror,0);gl.drawArrays(gl.LINES,0,points.length);}
  segment(a,b,radius,color,shape='tube',unlit=true){const delta=V.sub(b,a),len=V.len(delta);if(len<1e-6)return;const v=V.mul(delta,1/len),helper=Math.abs(v[1])>.95?[1,0,0]:[0,1,0],u=V.unit(V.cross(v,helper)),n=V.cross(u,v);this.draw(shape,M.model(V.mix(a,b,.5),u,v,n,[radius,len,radius]),color,unlit);}
  sphere(p,r,color,unlit=true){this.draw('sphere',M.model(p,undefined,undefined,undefined,[r,r,r]),color,unlit);}
  project(p){const q=M.transform(this.vp,p);return {x:(q[0]+1)/2*this.width,y:(1-q[1])/2*this.height,visible:q[3]>0&&q[2]>-1&&q[2]<1&&Math.abs(q[0])<1.1&&Math.abs(q[1])<1.1};}
  pointerRay(x,y){const f=Math.tan(this.fov/2),aspect=this.width/this.height;if(this.camera.orthographic){const origin=V.add(this.eye,V.add(V.mul(this.right,(x/this.width*2-1)*this.halfHeight*aspect),V.mul(this.up,(1-y/this.height*2)*this.halfHeight)));return {origin,direction:[...this.forward]};}return {origin:this.eye,direction:V.unit(V.add(this.forward,V.add(V.mul(this.right,(x/this.width*2-1)*f*aspect),V.mul(this.up,(1-y/this.height*2)*f))))};}
  pan(dx,dy){const scale=2*this.camera.radius*Math.tan(this.fov/2)/Math.max(this.height,1);const move=V.add(V.mul(this.right,-dx*scale),V.mul(this.up,dy*scale));this.camera.target=V.add(this.camera.target,move).map(v=>clamp(v,-2_000_000,2_000_000));}
}

M.orthographic=(l,r,b,t,n,f)=>new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]);
function curveData(o){
 const d=meshData();
 if(o.type==='trough'){
   const cols=64;for(let i=0;i<=cols;i++){const x=(i/cols-.5)*o.width;for(const y of [-o.height/2,o.height/2]){d.positions.push(x,y,surfaceZ(o,x,y));d.normals.push(...surfaceNormal(o,x,y));}}
   for(let i=0;i<cols;i++){const k=i*2;d.indices.push(k,k+2,k+1,k+1,k+2,k+3);}return d;
 }
 const rows=24,cols=80,R=o.diameter/2;
 for(let i=0;i<=rows;i++){const r=i/rows*R;for(let j=0;j<=cols;j++){const a=j/cols*Math.PI*2,x=r*Math.cos(a),y=r*Math.sin(a);d.positions.push(x,y,surfaceZ(o,x,y));d.normals.push(...surfaceNormal(o,x,y));}}
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const k=i*(cols+1)+j;d.indices.push(k,k+cols+1,k+1,k+1,k+cols+1,k+cols+2);}return d;
}
