import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';import {dirname,join,resolve} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const strip=s=>s.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(const|function|class)\b)/g,'');
export function buildHtml(overrides={}){
const source=file=>overrides[file]??readFileSync(join(root,'src',file),'utf8');
const kernel=strip(source('optics.js'));
const worker=kernel+`\nself.onmessage=e=>{const t=performance.now();try{self.postMessage({revision:e.data.revision,trace:traceScene(e.data.scene),ms:performance.now()-t});}catch(error){self.postMessage({revision:e.data.revision,error:error.message});}};`;
const code='(()=>{\n"use strict";\nconst LUMEN_WORKER_SOURCE='+JSON.stringify(worker)+';\n'+['optics.js','renderer.js','session.js','preview.js','launcher.js','designer.js','app.js'].map(file=>strip(source(file))).join('\n\n')+'\n})();';
return source('index.template.html').replace('/*__STUDIO_CSS__*/',()=>source('studio.css')).replace('/*__APP__*/',()=>code.replace(/<\/script/gi,'<\\/script'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const html=buildHtml();
for(const file of ['index.html','lumen-3d-v5.html']) writeFileSync(join(root,file),html);
console.log(`Built index.html and lumen-3d-v5.html (${Math.round(Buffer.byteLength(html)/1024)} KB each).`);
}
