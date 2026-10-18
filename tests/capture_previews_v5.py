"""Capture actual Lumen 5 WebGL views, with a Storage model for local recovery.
No fabricated rays, simulated screenshots, or external assets.
Run: xvfb-run -a python tests/capture_previews_v5.py
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os,json
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 print('Chromium',b.version,flush=True)
 p=b.new_page(viewport={'width':1512,'height':980},device_scale_factor=1)
 p.evaluate('''()=>{const map=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}});}''')
 p.set_content((ROOT/'lumen-3d-v5.html').read_text(),wait_until='load')
 p.wait_for_function('window.Lumen&&!Lumen.getStats().pending');p.wait_for_timeout(1100)
 p.locator('#home-title').click();p.screenshot(path=str(ROOT/'preview-launch.png'))
 p.locator('[data-demo="binary"]').click();p.wait_for_timeout(400);p.locator('#home-launch').click();p.wait_for_function('!Lumen.getStats().pending');p.wait_for_timeout(600)
 # The same editor, source inspector and a pinned detector monitor.
 p.locator('#left-toggle').click();p.locator('[data-left-tab="scene"]').click();p.locator('[data-select="o4"]').click();p.locator('[data-right-tab="object"]').click();p.locator('#left-toggle').click()
 # Explicit presentation settings, without changing the optics.
 p.locator('[data-right-tab="simulation"]').click()
 p.locator('input[type="number"][data-setting="incidentOpacity"]').fill('.15');p.locator('input[type="number"][data-setting="incidentOpacity"]').press('Tab')
 p.locator('[data-right-tab="object"]').click();p.locator('#canvas').focus();p.keyboard.press('Home');p.wait_for_function('!Lumen.getStats().pending');p.wait_for_timeout(3800)
 p.screenshot(path=str(ROOT/'preview-workspace.png'))
 p.locator('#analysis-button').click();p.wait_for_timeout(450);p.screenshot(path=str(ROOT/'preview-analysis.png'))
 p.locator('#home-button').click();p.wait_for_timeout(300);p.screenshot(path=str(ROOT/'preview-returning.png'))
 p.set_viewport_size({'width':390,'height':844});p.wait_for_timeout(500);p.locator('#home-dialog').evaluate('(el)=>el.scrollTop=0');p.screenshot(path=str(ROOT/'preview-launch-mobile-v5.png'))
 b.close()
