import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {buildHtml} from '../build.mjs';
const overrides={};
for(const name of ['optics.js','renderer.js'])overrides[name]=readFileSync(new URL('../tests/fixtures/performance/'+name,import.meta.url),'utf8');
mkdirSync(new URL('../.performance/',import.meta.url),{recursive:true});
writeFileSync(new URL('../.performance/baseline.html',import.meta.url),buildHtml(overrides));
