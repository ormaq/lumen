"""Lumen 5 inverse-design integration checks, using the visible UI.
Run: xvfb-run -a python -u tests/browser_inverse_v5.py
Requires Python Playwright and Chromium. No npm or runtime network dependencies.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import csv, io, json, math, os
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'lumen-3d-v5.html').read_text(encoding='utf-8')
passed=[]
def check(name, ok):
    assert ok,name
    passed.append(name);print('PASS',name,flush=True)
def wait(p):
    p.bring_to_front()
    p.wait_for_function('window.Lumen && !Lumen.getStats().pending',timeout=45000)
    p.wait_for_timeout(240)
def scene(p):return p.evaluate('Lumen.getScene()')
def design(p):return p.evaluate('Lumen.getDesign()')
def stats(p):return p.evaluate('Lumen.getStats()')
def open_design(p):p.locator('#design-button').click();wait(p)
def solve(p):
    p.locator('#design-solve').click()
    p.wait_for_function('!document.querySelector("#design-solve").textContent.includes("Checking")',timeout=45000)
    wait(p);p.wait_for_timeout(450)
def import_scene(p,s):
    p.locator('#scene-file').set_input_files({'name':'scene.json','mimeType':'application/json','buffer':json.dumps(s).encode()})
    if s.get('uid'):p.wait_for_function('(uid)=>Lumen.getScene().uid===uid && !Lumen.getStats().pending',arg=s['uid'],timeout=45000)
    wait(p)
def load(p,name):
    s=p.evaluate('(n)=>Lumen.kernel.createPreset(n)',name);import_scene(p,s);open_design(p)
def key(p,k):p.locator('#canvas').focus();p.keyboard.press(k);wait(p)
def num(p,id,value):
    p.locator('#'+id).fill(str(value));p.locator('#'+id).press('Tab');wait(p)
def select(p,id):
    if p.evaluate('document.body.classList.contains("left-hidden")'):p.locator('#left-toggle').click()
    p.locator('[data-left-tab="scene"]').click();p.locator(f'#object-list [data-select="{id}"]').click();wait(p)
    p.locator('[data-right-tab="object"]').click()
def change(p,prop,value):
    l=p.locator(f'#inspector input[type="number"][data-prop="{prop}"]')
    ds=l.locator('xpath=ancestor::details')
    for i in range(ds.count()):
        if not ds.nth(i).evaluate('(d)=>d.open'):ds.nth(i).locator('summary').first.click()
    l.fill(str(value));l.press('Enter');wait(p)
def menu(p,label):
    l=p.locator('header details.menu > summary').filter(has_text=label)
    if not l.locator('..').evaluate('(d)=>d.open'):l.click()
def full_rms(p):
    return p.evaluate('(()=>{const t=Lumen.getTrace(),d=t.detectors.o3;return Lumen.kernel.spotStatistics(d.hits).rms})()')
with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=os.environ.get('HEADLESS')=='1',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':1512,'height':980},accept_downloads=True,reduced_motion='reduce')
    p=ctx.new_page();errors=[];requests=[]
    p.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',e,flush=True)));p.on('request',lambda r:requests.append(r.url))
    p.set_content(HTML,wait_until='load');wait(p);p.locator('#preview-original').click();p.locator('#home-launch').click();wait(p)
    check('Opening the V5 inverse example shows the inverse example and the Design panel',p.evaluate('Lumen.version')=='5.0.0' and p.locator('#design-panel').is_visible() and scene(p)['preset']=='inverse')
    check('The app retains one toolbar and full viewport canvas',p.locator('header.topbar').count()==1 and p.locator('#canvas').bounding_box()['y']==62 and p.evaluate('document.documentElement.scrollHeight===innerHeight'))
    check('No external network dependency at startup',not any(u.startswith(('http:','https:')) for u in requests))
    check('Unsolved mirror is a real parabola',scene(p)['objects'][1]['type']=='parabola' and not design(p)['solved'])
    check('Live surface correction is unavailable until a shape is solved',p.locator('#design-live').is_disabled())
    initial=scene(p);hist=p.evaluate('Lumen.getHistory().undo');solve(p);r=design(p)['result'];q=scene(p)
    check('Auto-shape creates a stored analytic off-axis paraboloid',q['objects'][1]['type']=='shaped' and q['objects'][1]['figure']['kind']=='paraboloid')
    check('No object position or mount orientation is changed by shaping',all(all(a[k]==c[k] for k in ['p','yaw','tilt','roll']) for a,c in zip(initial['objects'],q['objects'])))
    check('Mirror aperture and coating survive the solve',all(q['objects'][1][k]==initial['objects'][1][k] for k in ['diameter','reflectivity']))
    check('Same 2048 source samples before and after; no artificial capture loss',r['before']['launched']==r['after']['launched']==2048 and r['before']['captured']==r['after']['captured']==2048)
    check('Target RMS is reduced from visible blur to numerical focus',r['before']['rms']>.9 and r['after']['rms']<1e-10)
    check('Independent aperture audit verifies equal paths and reflection',r['surface']['samples']==1537 and r['surface']['maxMiss']<1e-10 and r['surface']['oplPV']<1e-10)
    check('The ordinary full-scene trace focuses all 1024 actual rays',p.evaluate('Lumen.getTrace().detectors.o3.count')==1024 and full_rms(p)<1e-10)
    check('Solving creates exactly one undo transaction',p.evaluate('Lumen.getHistory().undo')==hist+1)
    check('Spot comparison is visible and auto-scrolled into view',p.locator('#design-spot').is_visible() and p.locator('#design-results').bounding_box()['y']<150)
    p.wait_for_timeout(800);p.screenshot(path=str(ROOT/'preview-inverse-solved.png'))
    saved=json.dumps(scene(p),sort_keys=True);p.locator('#design-before').click();wait(p)
    check('Before preview shows the old surface without changing scene data',design(p)['previewing'] and json.dumps(scene(p),sort_keys=True)==saved and p.locator('#design-preview-banner').is_visible())
    p.screenshot(path=str(ROOT/'preview-inverse-before.png'))
    p.locator('#design-end-preview').click();wait(p)
    check('Exit comparison restores current view without a history entry',not design(p)['previewing'] and p.evaluate('Lumen.getHistory().undo')==hist+1)
    key(p,'Control+z');check('Undo restores the unmodified original parabola',scene(p)['objects'][1]['type']=='parabola')
    key(p,'Control+Shift+z');check('Redo restores the physical solved figure',scene(p)['objects'][1]['type']=='shaped' and full_rms(p)<1e-10)
    open_design(p);num(p,'design-u',.35);num(p,'design-v',-.2);solve(p)
    check('Off-center detector targets are recorded and solved',abs(scene(p)['objects'][1]['design']['u']-.35)<1e-10 and abs(scene(p)['objects'][1]['design']['v']+.2)<1e-10 and design(p)['result']['after']['rms']<1e-10)
    hits=p.evaluate('Lumen.getTrace().detectors.o3.hits')
    check('Actual detector hits land at requested u/v, not detector center',all(abs(h['local'][0]-.35)<1e-9 and abs(h['local'][1]+.2)<1e-9 for h in hits))
    snapshot=json.dumps(scene(p),sort_keys=True);num(p,'design-u',20);solve(p)
    check('Out-of-frame target is rejected without altering the figure',bool(design(p)['error']) and 'inside' in design(p)['error'] and json.dumps(scene(p),sort_keys=True)==snapshot)
    p.locator('#design-center').click();wait(p);solve(p)
    p.locator('#design-pick').click();wait(p)
    pt=p.evaluate('(()=>{const s=Lumen.getScene(),d=s.objects[2],b=Lumen.kernel.basis(d);return Lumen.project(d.p.map((v,i)=>v+b.u[i]*.4+b.v[i]*.3))})()');box=p.locator('#canvas').bounding_box()
    p.mouse.click(box['x']+pt['x'],box['y']+pt['y']);wait(p)
    check('Picking on the detector plane resolves correct local coordinates',not design(p)['picking'] and abs(design(p)['options']['u']-.4)<.03 and abs(design(p)['options']['v']-.3)<.03)
    p.locator('#design-pick').click();key(p,'Escape');check('Escape cancels detector-point picking',not design(p)['picking'])
    p.locator('#design-center').click();wait(p);solve(p)
    # Explicit live reshaping and rigid-mirror behavior.
    p.locator('#design-live').check();wait(p);before=scene(p)['objects'][1]['figure'];select(p,'o3');change(p,'p2',-7)
    check('Live re-solving writes a new surface when the detector moves',scene(p)['objects'][1]['figure']!=before and scene(p)['objects'][1]['design']['live'])
    check('Moved detector still receives a sharp full-scene focus',p.evaluate('Lumen.getTrace().detectors.o3.count')==1024 and full_rms(p)<1e-10)
    open_design(p);p.locator('#design-live').uncheck();wait(p);before=scene(p)['objects'][1]['figure'];select(p,'o3');change(p,'p2',-8);open_design(p)
    check('Frozen figure does not silently change when target moves',scene(p)['objects'][1]['figure']==before and not scene(p)['objects'][1]['design']['live'])
    check('Outdated surface is visibly marked and measured as blurred',design(p)['result']['stale'] and design(p)['result']['after']['rms']>.01 and 're-solve' in p.locator('.design-badge').inner_text().lower())
    solve(p);p.locator('#design-live').check();wait(p);before=scene(p)['objects'][1]['figure']
    s=scene(p);s['objects'][2]['p']=s['objects'][1]['p'][:];import_scene(p,s);open_design(p)
    check('Invalid live layout preserves the last valid figure',scene(p)['objects'][1]['figure']==before and design(p)['result']['stale'])
    check('Invalid live geometry produces an explicit diagnostic','focus' in design(p)['error'].lower() or 'detector' in design(p)['error'].lower() or bool(design(p)['result']['warnings']))
    # Fresh solve for exports / save / copy / restore.
    load(p,'inverse');solve(p)
    p.locator('details.design-surface > summary').click();wait(p)
    with p.expect_download() as d:p.locator('#design-export-csv').click()
    out=ROOT/'tests/exported-inverse-sag.csv';d.value.save_as(str(out));rows=list(csv.DictReader(io.StringIO(out.read_text())))
    check('Sag CSV exports 4097 finite samples, normals, world coordinates and scale',len(rows)==4097 and {'sag_world','delta_original_world','n_z','z_world','mm_per_unit'}.issubset(rows[0]) and all(math.isfinite(float(v)) for r in rows for v in r.values()))
    check('Sag CSV contains real geometric change from the original',max(abs(float(r['delta_original_world'])) for r in rows)>.05)
    with p.expect_download() as d:p.locator('#design-export-obj').click()
    out=ROOT/'tests/exported-inverse-surface.obj';d.value.save_as(str(out));text=out.read_text();lines=text.splitlines()
    check('OBJ exports an explicitly open surface with vertices and normals',sum(x.startswith('v ') for x in lines)==4097 and sum(x.startswith('vn ') for x in lines)==4097 and 'NOT a watertight' in text)
    check('OBJ contains 8064 indexed triangular faces',sum(x.startswith('f ') for x in lines)==8064 and all(len(x.split())==4 for x in lines if x.startswith('f ')))
    menu(p,'File')
    with p.expect_download() as d:p.locator('#save-button').click()
    out=ROOT/'tests/exported-inverse-scene.json';d.value.save_as(str(out));saved=json.loads(out.read_text());import_scene(p,saved);open_design(p)
    check('Scene JSON round-trip preserves figure, baseline and design bindings',scene(p)['version']==5 and scene(p)['objects'][1]['figure']==saved['objects'][1]['figure'] and scene(p)['objects'][1]['design']['original']['type']=='parabola' and full_rms(p)<1e-10)
    key(p,'Control+a');key(p,'Control+c');key(p,'Control+v');q=scene(p)
    check('Copied group retains actual shaped surface and remaps source/detector links',len(q['objects'])==6 and q['objects'][4]['design']['sourceId']==q['objects'][3]['id'] and q['objects'][4]['design']['detectorId']==q['objects'][5]['id'] and q['objects'][4]['figure']==q['objects'][1]['figure'])
    check('Copied inverse surfaces begin frozen',q['objects'][4]['design']['live'] is False)
    key(p,'Control+z');open_design(p);p.locator('details.design-surface > summary').click();p.locator('#design-restore').click();wait(p)
    check('Restore original changes the actual mirror back to a parabola',scene(p)['objects'][1]['type']=='parabola' and not design(p)['solved'])
    key(p,'Control+z');check('Restoring the original is undoable',scene(p)['objects'][1]['type']=='shaped' and full_rms(p)<1e-10)
    # Finite-conjugate, extended-source, invalid-input and dense-worker checks.
    load(p,'finite');solve(p);r=design(p)['result']
    check('Finite point-source mode solves an ellipsoid instead of misusing a parabola',scene(p)['objects'][1]['figure']['kind']=='ellipsoid' and r['after']['rms']<1e-10)
    check('Finite source capture honestly reports rays missing the pupil',0<r['after']['captured']<r['after']['launched'] and r['after']['missMirror']>0)
    load(p,'inverse');s=scene(p);s['objects'][0]['angularDiameter']=120;import_scene(p,s);open_design(p);solve(p);r=design(p)['result']
    check('An extended star retains its nonzero geometric image after chief-wavefront shaping',r['after']['rms']>1e-5 and r['surface']['maxMiss']<1e-10 and any('extended' in w.lower() for w in r['warnings']))
    load(p,'inverse');s=scene(p);s['objects'][0]['type']='beam';s['objects'][0]['spread']=3;import_scene(p,s);open_design(p);snap=json.dumps(scene(p),sort_keys=True);solve(p)
    check('Divergent distributed source is rejected without committing a false solution','divergence' in design(p)['error'] and json.dumps(scene(p),sort_keys=True)==snap)
    load(p,'inverse');s=scene(p);s['objects'][0]['p'][2]+=100;s['objects'][0]['aimTarget']=None;import_scene(p,s);open_design(p);solve(p)
    check('An unilluminated mirror does not count as a zero-error success','No audit rays' in design(p)['error'] and not design(p)['solved'])
    load(p,'empty');check('Incomplete scene disables the solver with actionable setup instructions',p.locator('#design-solve').is_disabled() and 'Add a mirror' in p.locator('#design-panel').inner_text())
    load(p,'inverse');s=scene(p);s['objects'][0]['count']=16384;import_scene(p,s);open_design(p);solve(p)
    check('Dense inverse surface traces 16384 rays in the local worker',stats(p)['worker'] and stats(p)['rays']==16384 and p.evaluate('Lumen.getTrace().detectors.o3.count')==16384)
    check('Worker and analytic detector spot agree at numerical focus',full_rms(p)<1e-10 and design(p)['result']['after']['rms']<1e-10)
    # Missing baselines and no-hit states must not masquerade as success.
    s=scene(p);s['objects'][1]['design']['original']=None;import_scene(p,s);open_design(p)
    check('Imported inverse reflector without original shows no fabricated comparison baseline',not design(p)['result']['baselineAvailable'] and 'no original surface' in p.locator('.design-plot-caption').first.inner_text() and p.locator('.design-comparison strong').first.inner_text()=='—')
    s=scene(p);s['objects'][0]['aimTarget']=None;s['objects'][0]['p'][2]+=100;import_scene(p,s);open_design(p)
    check('Zero-hit current figure has an unavailable metric and is never marked focused',design(p)['result']['after']['rms'] is None and p.locator('.design-comparison .corrected').count()==0 and 'No source samples' in p.locator('.design-result-note').inner_text())
    # Browser-size layout and true touch drawer.
    load(p,'inverse');solve(p)
    for w,h in [(1512,980),(1024,768),(820,1180),(390,844),(360,800)]:
        p.set_viewport_size({'width':w,'height':h});wait(p)
        check(f'{w}px inverse workspace has no horizontal overflow',p.evaluate('document.documentElement.scrollWidth===innerWidth'))
        check(f'{w}px Shape control remains within the toolbar',p.locator('#design-button').is_visible() and p.locator('#design-button').bounding_box()['x']>=0)
    mctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,reduced_motion='reduce')
    m=mctx.new_page();merrors=[];m.on('pageerror',lambda e:merrors.append(str(e)));m.set_content(HTML,wait_until='load');wait(m);m.locator('#preview-original').tap();m.locator('#home-launch').tap();wait(m)
    m.locator('#design-button').tap();wait(m)
    check('Mobile Shape button opens a usable inverse-design drawer',m.locator('#design-panel').is_visible() and m.locator('#right-dock').evaluate('(e)=>e.classList.contains("mobile-open")'))
    solve(m);check('Touch-sized app can solve and display the focal-spot comparison',design(m)['solved'] and design(m)['result']['after']['rms']<1e-10 and m.locator('#design-spot').is_visible())
    m.screenshot(path=str(ROOT/'preview-inverse-mobile.png'))
    m.locator('#design-pick').tap();wait(m);check('Mobile detector picking folds the drawer to expose the canvas',design(m)['picking'] and not m.locator('#right-dock').evaluate('(e)=>e.classList.contains("mobile-open")'))
    # No-worker fallback is also the same physical model.
    f=ctx.new_page();f.evaluate('window.Worker=undefined');f.set_content(HTML,wait_until='load');wait(f);f.locator('#preview-original').click();f.locator('#home-launch').click();wait(f);solve(f)
    check('Synchronous fallback produces the same focused inverse solution',not stats(f)['worker'] and full_rms(f)<1e-10 and design(f)['result']['after']['captured']==2048)
    f.close()
    check('No uncaught inverse-design errors on desktop or touch',not errors and not merrors)
    check('Entire inverse workflow stays offline',not any(u.startswith(('http:','https:')) for u in requests))
    report={'passed':len(passed),'checks':passed,'errors':errors,'mobileErrors':merrors}
    (ROOT/'tests/browser-results-inverse-v5.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
    b.close()
