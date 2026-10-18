"""Before/after browser checks. Run npm run test:browser-performance.
Requires Python Playwright, Pillow and Chromium/Edge (CHROMIUM_PATH override).
Serves real bundled HTML at a repository-style HTTP subpath, with real storage.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops
import hashlib, io, json, os, statistics

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.performance'
OUT.mkdir(exist_ok=True)
checks = []

def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS', name, flush=True)

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        if self.path.startswith('/project/'):
            self.path = self.path[len('/project'):]
        super().do_GET()
    def log_message(self, *args):
        pass

INSTRUMENT = """(() => {
  window.__perf = {frames:0,bytes:0,uploads:0,largeUploads:0,cpuMs:[]};
  const proto=WebGLRenderingContext.prototype,upload=proto.bufferData,clear=proto.clear;
  proto.bufferData=function(target,data,usage){
    if(this.canvas.id==='canvas'){
      const n=typeof data==='number'?data:data.byteLength;
      __perf.bytes+=n;__perf.uploads++;if(n>=100000)__perf.largeUploads++;
    }
    return upload.apply(this,arguments);
  };
  proto.clear=function(){if(this.canvas.id==='canvas')__perf.frames++;return clear.apply(this,arguments);};
  const raf=window.requestAnimationFrame;
  window.requestAnimationFrame=fn=>raf.call(window,time=>{
    const before=__perf.frames,start=performance.now();fn(time);
    if(__perf.frames>before)__perf.cpuMs.push(performance.now()-start);
  });
})();"""

def wait(page):
    page.wait_for_function('window.Lumen && !Lumen.getStats().pending', timeout=60000)
    page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')

def load(page, scene):
    page.locator('#scene-file').set_input_files({
        'name':'performance.json','mimeType':'application/json',
        'buffer':json.dumps(scene).encode('utf-8')})
    page.wait_for_function('(id)=>Lumen.getScene().uid===id && !Lumen.getStats().pending', arg=scene['uid'], timeout=60000)
    wait(page)

def measure(page, count=45):
    page.evaluate('window.__perf={frames:0,bytes:0,uploads:0,largeUploads:0,cpuMs:[]}')
    page.wait_for_function('(n)=>__perf.frames>=n', arg=count, timeout=60000)
    data=page.evaluate('__perf')
    times=sorted(data.pop('cpuMs'))
    data.update(medianCpuMs=statistics.median(times),p95CpuMs=times[int((len(times)-1)*.95)],bytesPerFrame=data['bytes']/data['frames'])
    return data

def trace_digest(page):
    return page.evaluate('''async()=>{
      const bytes=new TextEncoder().encode(JSON.stringify(Lumen.getTrace()));
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    }''')

server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/project/'
results={}
images={}
browser_path=os.environ.get('CHROMIUM_PATH')
if not browser_path and os.name=='nt':
    browser_path=r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=browser_path,headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        version=browser.version
        for variant in ['baseline','optimized']:
            context=browser.new_context(viewport={'width':1100,'height':720},device_scale_factor=1,reduced_motion='no-preference')
            context.add_init_script(INSTRUMENT)
            page=context.new_page();errors=[];requests=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.on('request',lambda request:requests.append(request.url))
            path='.performance/baseline.html' if variant=='baseline' else 'index.html'
            page.goto(base+path);wait(page)
            check(variant+' launch preview boots',page.evaluate('Lumen.getWelcome().rays>0'))
            page.locator('#home-blank').click();wait(page)
            scene=page.evaluate('Lumen.kernel.createPreset("focus")')
            scene['uid']='benchmark-focus';scene['objects'][0]['count']=8192
            scene['settings'].update(animate=False,grid=False,foci=False,hideStands=True)
            modes={}
            for style in ['clarity','glow','bounce']:
                scene['settings'].update(rayStyle=style,extensions=style=='bounce',animate=False)
                scene['uid']=f'benchmark-{style}'
                load(page,scene)
                check(variant+' '+style+' worker completed',page.evaluate('Lumen.getStats().worker && Lumen.getStats().rays===8192'))
                check(variant+' '+style+' worker matches synchronous kernel',page.evaluate('JSON.stringify(Lumen.getTrace())===JSON.stringify(Lumen.kernel.traceScene(Lumen.getScene()))'))
                # Motion is paused so the two screenshots contain identical geometry.
                images[(variant,style)]=page.locator('#canvas').screenshot()
                page.evaluate('window.__perf={frames:0,bytes:0,uploads:0,largeUploads:0,cpuMs:[]}')
                page.wait_for_timeout(200)
                check(variant+' '+style+' paused workspace stops rendering',page.evaluate('__perf.frames===0'))
                scene['settings']['animate']=True;scene['uid']+='-animated'
                load(page,scene)
                modes[style]=measure(page)
            digest=trace_digest(page)
            # A camera move must invalidate the cached screen-facing ray geometry.
            page.locator('#canvas').focus();before=page.evaluate('Lumen.getCamera()')
            box=page.locator('#canvas').bounding_box()
            page.mouse.move(box['x']+box['width']*.6,box['y']+box['height']*.6)
            uploads=page.evaluate('__perf.largeUploads')
            page.mouse.down();page.mouse.move(box['x']+box['width']*.6+70,box['y']+box['height']*.6+20,steps=5);page.mouse.up();wait(page)
            check(variant+' camera changes refresh ray geometry',page.evaluate('Lumen.getCamera()')!=before and page.evaluate('__perf.largeUploads')>uploads)
            check(variant+' camera changes preserve optical output',trace_digest(page)==digest)
            # Empty scenes clear the cached geometry; switching back draws again.
            blank=page.evaluate('Lumen.kernel.createPreset("empty")');blank['uid']='benchmark-empty'
            load(page,blank)
            check(variant+' empty scene has no stale rays',page.evaluate('Lumen.getStats().renderedSegments===0'))
            load(page,scene)
            check(variant+' scene restores after clearing GPU cache',trace_digest(page)==digest)
            # Real-origin recovery survives a reload, rather than a storage mock.
            page.wait_for_timeout(900);page.reload();wait(page)
            check(variant+' real HTTP storage recovery',page.evaluate('Lumen.getScene().uid')==scene['uid'])
            check(variant+' no uncaught JS errors',not errors)
            check(variant+' no external runtime assets',all(url.startswith(base) or url.startswith('blob:') for url in requests))
            results[variant]={'modes':modes,'traceSha256':digest,'errors':errors}
            context.close()
        for style in ['clarity','glow','bounce']:
            old=Image.open(io.BytesIO(images[('baseline',style)])).convert('RGB')
            new=Image.open(io.BytesIO(images[('optimized',style)])).convert('RGB')
            check(style+' pixels exactly match baseline',ImageChops.difference(old,new).getbbox() is None)
            a=results['baseline']['modes'][style];b=results['optimized']['modes'][style]
            check(style+' avoids repeated large geometry uploads',a['largeUploads']>=a['frames'] and b['largeUploads']==0)
            check(style+' reduces upload bytes by at least 90%',b['bytesPerFrame']<a['bytesPerFrame']*.1)
        check('Complete browser traces match baseline',results['baseline']['traceSha256']==results['optimized']['traceSha256'])
        context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
        context.add_init_script('window.Worker=undefined')
        page=context.new_page();fallback_errors=[]
        page.on('pageerror',lambda error:fallback_errors.append(str(error)))
        page.goto(base+'index.html');wait(page);page.locator('#home-blank').tap();wait(page)
        scene=page.evaluate('Lumen.kernel.createPreset("binary")');scene['uid']='fallback-binary'
        load(page,scene)
        check('Mobile synchronous fallback traces without workers',page.evaluate('!Lumen.getStats().worker && Lumen.getStats().rays===1536'))
        check('Fallback detector output matches kernel',page.evaluate('JSON.stringify(Lumen.getTrace())===JSON.stringify(Lumen.kernel.traceScene(Lumen.getScene()))'))
        check('Mobile viewport has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
        check('No fallback errors',not fallback_errors)
        page.screenshot(path=str(OUT/'mobile.png'))
        context.close();browser.close()
finally:
    server.shutdown();server.server_close()

report={'browser':version,'renderer':'ANGLE SwiftShader (software WebGL)','checks':checks,'passed':len(checks),'results':results,
        'bundles':{name:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for name,path in [('baseline','.performance/baseline.html'),('optimized','index.html')]}}
(ROOT/'benchmarks/browser-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(f'PASS {len(checks)} browser checks',flush=True)
