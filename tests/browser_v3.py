"""Lumen 3 UI regressions, driven through user controls.

Install: python -m pip install playwright
         python -m playwright install chromium
Run: python -u tests/browser_v3.py

Uses Playwright Chromium or an installed Chromium/Chrome/Edge browser.
CHROMIUM_PATH overrides browser discovery. Set BROWSER_HEADLESS=0 for a visible
browser (headed Linux requires a display or xvfb-run). BROWSER_OUTPUT_DIR sends
all reports, downloads, and screenshots to a separate artifacts directory.
"""

import csv
import io
import json
import math
import os
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "lumen-3d-v3.html").read_text(encoding="utf-8")
OUTPUT = Path(os.environ.get("BROWSER_OUTPUT_DIR", ROOT / "tests"))
SCREENSHOTS = OUTPUT if "BROWSER_OUTPUT_DIR" in os.environ else ROOT
OUTPUT.mkdir(parents=True, exist_ok=True)
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
HEADLESS = os.environ.get("BROWSER_HEADLESS", "1").lower() not in {"0", "false", "no"}


def browser_path(playwright):
    """Find a local browser without relying on one operating system's path."""
    if override := os.environ.get("CHROMIUM_PATH"):
        if not Path(override).is_file():
            raise FileNotFoundError(f"CHROMIUM_PATH does not exist: {override}")
        return override

    candidates = [Path(playwright.chromium.executable_path)]
    for directory in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        if root := os.environ.get(directory):
            candidates.extend(
                [
                    Path(root) / "Google/Chrome/Application/chrome.exe",
                    Path(root) / "Microsoft/Edge/Application/msedge.exe",
                ]
            )
    candidates.extend(
        [
            Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ]
    )
    for command in ("chromium", "chromium-browser", "google-chrome", "msedge"):
        if found := shutil.which(command):
            candidates.append(Path(found))
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError(
        'No Chromium browser found. Run "python -m playwright install chromium" '
        "or set CHROMIUM_PATH to a browser executable."
    )


passed = []


def check(name, condition):
    assert condition, name
    passed.append(name)
    print("PASS", name, flush=True)


def wait(p):
    p.wait_for_function("window.Lumen && !Lumen.getStats().pending", timeout=30000)
    p.wait_for_timeout(100)


def scene(p):
    return p.evaluate("Lumen.getScene()")


def stats(p):
    return p.evaluate("Lumen.getStats()")


def menu(p, label):
    s = p.locator("header details.menu > summary").filter(has_text=label)
    if not s.locator("..").evaluate("(e)=>e.open"):
        s.click()


def command(p, id, label):
    menu(p, label)
    p.locator("#" + id).click()
    wait(p)


def load(p, key):
    command(p, "examples-button", "File")
    p.locator(f'#examples-grid [data-preset="{key}"]').click()
    wait(p)


def import_scene(p, s):
    p.locator("#scene-file").set_input_files(
        {
            "name": "scene.json",
            "mimeType": "application/json",
            "buffer": json.dumps(s).encode(),
        }
    )
    wait(p)


def left(p):
    if p.evaluate("innerWidth<=980"):
        if not p.locator("#left-dock").evaluate(
            '(e)=>e.classList.contains("mobile-open")'
        ):
            p.locator("#left-toggle").click()
    elif p.evaluate('document.body.classList.contains("left-hidden")'):
        p.locator("#left-toggle").click()
    p.locator('[data-left-tab="scene"]').click()
    wait(p)


def select(p, i, shift=False):
    left(p)
    p.locator(f'#object-list [data-select="o{i}"]').click(
        modifiers=["Shift"] if shift else []
    )
    wait(p)


def show_control(p, selector):
    loc = p.locator(selector)
    # Reveal folded inspector sections without bypassing the form controls.
    ds = loc.locator("xpath=ancestor::details")
    for i in range(ds.count()):
        d = ds.nth(i)
        if not d.evaluate("(e)=>e.open"):
            d.locator("summary").first.click()
    return loc


def change(p, key, value):
    p.locator('[data-right-tab="object"]').click()
    loc = show_control(p, f'#inspector input[type=number][data-prop="{key}"]')
    loc.fill(str(value))
    loc.press("Enter")
    wait(p)


def setting(p, key, value):
    p.locator('[data-right-tab="simulation"]').click()
    loc = p.locator(f'#simulation-panel [data-setting="{key}"]')
    if loc.count() > 1:
        loc = p.locator(f'#simulation-panel input[type=number][data-setting="{key}"]')
    tag = loc.evaluate("(e)=>e.tagName")
    if tag == "SELECT":
        loc.select_option(str(value))
    elif loc.get_attribute("type") == "checkbox":
        loc.set_checked(value)
    else:
        loc.fill(str(value))
        loc.press("Enter")
    wait(p)


def key(p, k):
    p.locator("#canvas").focus()
    p.keyboard.press(k)
    wait(p)


def drag(p, x, y, dx, dy, button="left"):
    p.mouse.move(x, y)
    p.mouse.down(button=button)
    p.mouse.move(x + dx, y + dy, steps=6)
    p.mouse.up(button=button)
    wait(p)


def research_stat(p, expr):
    return p.evaluate(
        "(()=>{const t=Lumen.getTrace();const d=t.detectors.o3;return " + expr + "})()"
    )


def remember_trace(p):
    """Keep detailed hit data in the browser instead of copying it over the wire."""
    return p.evaluate("""() => {
            const trace = Lumen.getTrace();
            window.__lumenTestHits = JSON.stringify([trace.hits, trace.detectors]);
            return Lumen.getStats().traceRuns;
        }""")


def check_reuses_trace(p, name, trace_runs):
    check(
        name,
        p.evaluate(
            """before => {
                const trace = Lumen.getTrace();
                return Lumen.getStats().traceRuns === before &&
                    JSON.stringify([trace.hits, trace.detectors]) === window.__lumenTestHits;
            }""",
            trace_runs,
        ),
    )


with sync_playwright() as pw:
    b = pw.chromium.launch(
        executable_path=browser_path(pw),
        headless=HEADLESS,
        args=[
            "--no-sandbox",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
        ],
    )
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    p = ctx.new_page()
    errors = []
    requests = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("request", lambda r: requests.append(r.url))
    p.set_content(HTML, wait_until="load")
    wait(p)
    check(
        "Offline standalone WebGL app boots as version 3",
        p.evaluate("Lumen.version") == "3.0.0" and not errors,
    )
    check(
        "No external assets or runtime network requests",
        not any(u.startswith(("http:", "https:")) for u in requests),
    )
    check(
        "Every DOM ID is unique",
        p.evaluate(
            '(()=>{const a=[...document.querySelectorAll("[id]")].map(e=>e.id);return new Set(a).size===a.length})()'
        ),
    )
    check(
        "Single 62px main toolbar, no second toolbar",
        p.locator("header.topbar").count() == 1
        and p.locator("nav.toolbar").count() == 0
        and p.locator("#canvas").bounding_box()["y"] == 62,
    )
    check(
        "Full viewport layout without page scrolling",
        p.evaluate(
            "document.documentElement.scrollWidth===innerWidth && document.documentElement.scrollHeight===innerHeight"
        ),
    )
    check(
        "Scene library is collapsed by default",
        p.evaluate('document.body.classList.contains("left-hidden")'),
    )
    check(
        "Body and editable position fields are at least 14px",
        p.evaluate(
            'parseFloat(getComputedStyle(document.body).fontSize)>=14 && parseFloat(getComputedStyle(document.querySelector("[data-prop=p1]")).fontSize)>=14'
        ),
    )
    check(
        "Key field labels are at least 13px",
        p.locator(".field-head label").first.evaluate(
            "(e)=>parseFloat(getComputedStyle(e).fontSize)>=13"
        ),
    )
    check(
        "Orientation is folded and floating measurement hidden by default",
        not p.locator("details.orientation").evaluate("(e)=>e.open")
        and p.locator("#measure").is_hidden(),
    )
    check(
        "Default parabolic focus retains 37 true reflected rays", stats(p)["hits"] == 37
    )
    camera = p.evaluate("Lumen.getCamera()")
    box = p.locator("#canvas").bounding_box()
    point = [
        camera["target"][0] + 3 * math.cos(camera["yaw"]) * math.cos(camera["pitch"]),
        camera["target"][1] + 3 * math.sin(camera["pitch"]),
        camera["target"][2] + 3 * math.sin(camera["yaw"]) * math.cos(camera["pitch"]),
    ]
    before = p.evaluate("(p)=>Lumen.project(p)", point)
    drag(p, box["width"] * 0.6, box["y"] + box["height"] * 0.8, 55, 0)
    check(
        "Corrected left orbit moves foreground with horizontal drag",
        p.evaluate("Lumen.getCamera().yaw") > camera["yaw"]
        and p.evaluate("(p)=>Lumen.project(p)", point)["x"] > before["x"],
    )
    before = p.evaluate("Lumen.getCamera().target")
    drag(p, box["width"] * 0.6, box["y"] + box["height"] * 0.8, 30, 10, "right")
    check("Right drag pans", p.evaluate("Lumen.getCamera().target") != before)
    before = p.evaluate("Lumen.getCamera().radius")
    p.mouse.wheel(0, -100)
    wait(p)
    check("Wheel zoom works", p.evaluate("Lumen.getCamera().radius") < before)
    for n, v in [(2, "Top"), (3, "Front"), (4, "Side")]:
        key(p, str(n))
        check(v + " view is orthographic", p.evaluate("Lumen.getCamera().orthographic"))
    key(p, "1")
    check("3D restores perspective", not p.evaluate("Lumen.getCamera().orthographic"))
    key(p, "Tab")
    check(
        "Canvas focus mode fills the entire viewport",
        p.locator("#canvas").bounding_box()
        == {"x": 0, "y": 0, "width": 1440, "height": 900},
    )
    key(p, "Tab")
    p.locator("#fullscreen-button").click()
    p.wait_for_timeout(200)
    check("Real browser fullscreen enters", p.evaluate("!!document.fullscreenElement"))
    p.locator("#fullscreen-button").click()
    p.wait_for_timeout(200)
    check(
        "Real browser fullscreen exits", not p.evaluate("!!document.fullscreenElement")
    )
    load(p, "focus")
    select(p, 2)
    before = scene(p)["objects"][1]
    key(p, "Control+c")
    key(p, "Control+v")
    q = scene(p)
    check(
        "Ctrl+C / Ctrl+V copies and pastes a selected object",
        len(q["objects"]) == 3 and q["objects"][-1]["type"] == "parabola",
    )
    check(
        "Paste offsets X/Z but preserves height",
        q["objects"][-1]["p"]
        == [before["p"][0] + 0.7, before["p"][1], before["p"][2] + 0.7],
    )
    key(p, "Control+z")
    check("Paste is one undo transaction", len(scene(p)["objects"]) == 2)
    key(p, "Control+Shift+z")
    check("Paste can be redone", len(scene(p)["objects"]) == 3)
    select(p, 3)
    key(p, "Control+x")
    check("Cut removes selected object", len(scene(p)["objects"]) == 2)
    key(p, "Control+Shift+v")
    check(
        "Paste in place preserves cut coordinates",
        scene(p)["objects"][-1]["p"] == q["objects"][-1]["p"],
    )
    name = p.locator('#inspector [data-prop="name"]')
    name.click()
    name.press("Control+a")
    check(
        "Native text selection does not select all scene objects",
        len(p.evaluate("Lumen.getSelections()")) == 1,
    )
    name.fill("Copied mirror")
    name.press("Enter")
    key(p, "Control+d")
    check("Duplicate shortcut creates another object", len(scene(p)["objects"]) == 4)
    load(p, "focus")
    select(p, 1)
    p.locator("#aim-target").select_option("o2")
    p.locator("#lock-target").click()
    wait(p)
    check(
        "Lock onto acquires a persistent target",
        scene(p)["objects"][0]["aimTarget"] == "o2"
        and "Tracking" in p.locator(".lock-status").inner_text(),
    )
    check(
        "Target lock disables manual source yaw", p.locator("#prop-yaw").is_disabled()
    )
    select(p, 2)
    change(p, "p1", 1000)
    check(
        "Height can exceed old bounds: 1,000 units survives UI editing",
        scene(p)["objects"][1]["p"][1] == 1000,
    )
    check(
        "Moved target automatically re-aims its source",
        p.evaluate(
            "(()=>{const s=Lumen.getScene(),a=s.objects[0],t=s.objects[1],n=Lumen.kernel.basis(a).n,d=t.p.map((v,i)=>v-a.p[i]),l=Math.hypot(...d);return Math.hypot(...n.map((v,i)=>v-d[i]/l))<1e-10})()"
        ),
    )
    change(p, "p1", 1000000)
    key(p, "Home")
    check(
        "Million-unit height accepted and frame camera scales with scene",
        scene(p)["objects"][1]["p"][1] == 1000000
        and p.evaluate("Lumen.getCamera().radius") > 100000,
    )
    change(p, "p1", 3)
    select(p, 1)
    trace_runs = stats(p)["traceRuns"]
    change(p, "p1", 9)
    check(
        "Moving a source recomputes its optical trace",
        stats(p)["traceRuns"] > trace_runs,
    )
    check(
        "Moving a locked-on source keeps pointing at target",
        p.evaluate(
            "(()=>{const s=Lumen.getScene(),a=s.objects[0],t=s.objects[1],n=Lumen.kernel.basis(a).n,d=t.p.map((v,i)=>v-a.p[i]),l=Math.hypot(...d);return Math.hypot(...n.map((v,i)=>v-d[i]/l))<1e-10})()"
        ),
    )
    select(p, 2, True)
    check(
        "Shift-click supports multi-object selection",
        len(p.evaluate("Lumen.getSelections()")) == 2,
    )
    key(p, "Control+c")
    key(p, "Control+v")
    q = scene(p)
    check(
        "Group paste creates all selected components",
        len(q["objects"]) == 4 and len(p.evaluate("Lumen.getSelections()")) == 2,
    )
    check(
        "Group paste redirects source lock to copied mirror",
        q["objects"][2]["aimTarget"] == q["objects"][3]["id"],
    )
    select(p, 3)
    p.locator("#lock-target").click()
    wait(p)
    check(
        "Release lock returns manual orientation control",
        scene(p)["objects"][2]["aimTarget"] is None
        and not p.locator("#prop-yaw").is_disabled(),
    )
    p.locator("#aim-target").select_option("o4")
    p.locator("#aim-once").click()
    wait(p)
    check(
        "Aim once remains available without persistent tracking",
        scene(p)["objects"][2]["aimTarget"] is None,
    )
    key(p, "Control+a")
    check(
        "Select all shortcut includes every object",
        len(p.evaluate("Lumen.getSelections()")) == 4,
    )
    load(p, "focus")
    select(p, 2)
    p.locator("#lock-object").click()
    key(p, "Control+x")
    check(
        "Transform-locked objects cannot be accidentally cut",
        len(scene(p)["objects"]) == 2,
    )
    key(p, "Delete")
    check("Transform-locked objects cannot be deleted", len(scene(p)["objects"]) == 2)
    load(p, "focus")
    select(p, 1)
    trace_runs = stats(p)["traceRuns"]
    change(p, "count", 16384)
    check(
        "Changing source sample count recomputes the trace",
        stats(p)["traceRuns"] > trace_runs,
    )
    check(
        "16,384 source rays trace successfully in local worker",
        stats(p)["rays"] == 16384 and stats(p)["worker"] and not stats(p)["limited"],
    )
    check(
        "Dense source still focuses every ray analytically", stats(p)["hits"] == 16384
    )
    check(
        "Viewport thins full paths instead of reducing trace data",
        stats(p)["renderedSegments"] <= 24000 and stats(p)["segments"] == 32768,
    )
    trace_runs = stats(p)["traceRuns"]
    setting(p, "density", 8)
    check(
        "Changing global density recomputes the trace",
        stats(p)["traceRuns"] > trace_runs,
    )
    check(
        "Global density setting raises to 8x and respects per-source cap",
        scene(p)["settings"]["density"] == 8 and stats(p)["rays"] == 16384,
    )
    trace_runs = remember_trace(p)
    setting(p, "rayStyle", "bounce")
    check(
        "Bounce color mode is selectable", scene(p)["settings"]["rayStyle"] == "bounce"
    )
    check_reuses_trace(
        p, "Changing ray colors reuses the trace and recorded hits", trace_runs
    )
    setting(p, "rayStyle", "glow")
    check("Soft glow is selectable", scene(p)["settings"]["rayStyle"] == "glow")
    check_reuses_trace(
        p, "Changing glow style reuses the trace and recorded hits", trace_runs
    )
    setting(p, "rayStyle", "clarity")
    setting(p, "rayOpacity", 0.5)
    check_reuses_trace(
        p, "Changing ray opacity reuses the trace and recorded hits", trace_runs
    )
    setting(p, "displayBudget", 1000)
    check(
        "Independent display budget lowers visible paths only",
        stats(p)["renderedSegments"] <= 1000 and stats(p)["hits"] == 16384,
    )
    check_reuses_trace(
        p, "Changing the display budget reuses the trace and recorded hits", trace_runs
    )
    setting(p, "rayStage", "interacted")
    check(
        "Interaction-only view removes source legs without changing tracing",
        scene(p)["settings"]["rayStage"] == "interacted" and stats(p)["hits"] == 16384,
    )
    check_reuses_trace(
        p, "Filtering visible ray stages reuses the trace and recorded hits", trace_runs
    )
    for overlay in (
        "grid",
        "labels",
        "foci",
        "normals",
        "showMeasurements",
        "extensions",
        "starMode",
    ):
        setting(p, overlay, not scene(p)["settings"][overlay])
        check_reuses_trace(
            p, f"Toggling {overlay} reuses the trace and recorded hits", trace_runs
        )
    animated = scene(p)["settings"]["animate"]
    p.locator("#play-button").click()
    wait(p)
    check(
        "Playback button changes animation state",
        scene(p)["settings"]["animate"] != animated,
    )
    check_reuses_trace(
        p, "Playback control reuses the trace and recorded hits", trace_runs
    )
    load(p, "star")
    check(
        "Star at infinity loads the high-altitude telescope scene",
        scene(p)["settings"]["starMode"]
        and min(o["p"][1] for o in scene(p)["objects"]) >= 120,
    )
    check(
        "On-axis star records every ray on the analysis plane",
        research_stat(p, "d.count") == 768
        and research_stat(p, "Lumen.kernel.spotStatistics(d.hits).rms") < 1e-10,
    )
    check(
        "Analysis displays an actual spot diagram",
        p.locator("#research-map").is_visible()
        and p.locator("#research-hit-count").inner_text() == "768",
    )
    check(
        "Telescope reference includes 200mm aperture and f/3",
        "200.0" in p.locator("#telescope-reference").inner_text()
        and "3.00" in p.locator("#telescope-reference").inner_text(),
    )
    p.locator("#research-ray-stage").click()
    wait(p)
    check(
        "Analysis shortcut isolates reflected paths",
        scene(p)["settings"]["rayStage"] == "interacted",
    )
    load(p, "coma")
    check(
        "Off-axis star gives a finite non-zero geometric spot",
        research_stat(p, "d.count") == 768
        and research_stat(p, "Lumen.kernel.spotStatistics(d.hits).rms") > 1e-4,
    )
    load(p, "binary")
    check(
        "Double-star experiment traces two independent wavefronts",
        stats(p)["rays"] == 1536 and research_stat(p, "d.count") == 1536,
    )
    check(
        "Binary analysis has separate per-source results",
        p.locator(".source-result").count() == 2,
    )
    power = research_stat(p, "d.power")
    ref_before = p.locator("#telescope-reference").inner_text()
    trace_runs = remember_trace(p)
    p.locator("#research-world-scale").fill("100")
    p.locator("#research-world-scale").press("Tab")
    wait(p)
    check(
        "Physical world scale updates references without changing power",
        scene(p)["settings"]["mmPerUnit"] == 100
        and p.locator("#telescope-reference").inner_text() != ref_before
        and abs(research_stat(p, "d.power") - power) < 1e-10,
    )
    check_reuses_trace(
        p, "Physical world scale reuses the trace and recorded hits", trace_runs
    )
    p.locator('[data-research="airyReference"]').uncheck()
    wait(p)
    check(
        "Airy overlay toggles without changing geometric samples",
        not scene(p)["settings"]["airyReference"]
        and research_stat(p, "d.count") == 1536,
    )
    check_reuses_trace(p, "Airy overlay reuses the trace and recorded hits", trace_runs)
    show_control(p, '[data-research="focusOffset"]').fill(".1")
    p.locator('[data-research="focusOffset"]').press("Tab")
    wait(p)
    check(
        "Focal-plane offset moves the analysis detector",
        abs(scene(p)["objects"][2]["p"][1] - 132.1) < 1e-8,
    )
    show_control(p, "#research-focus").click()
    wait(p)
    check(
        "Place at nominal focus resets the detector",
        abs(scene(p)["objects"][2]["p"][1] - 132) < 1e-8,
    )
    with p.expect_download() as d:
        p.locator("#research-export").click()
    csvpath = OUTPUT / "exported-focal-hits.csv"
    d.value.save_as(str(csvpath))
    rows = list(csv.DictReader(io.StringIO(csvpath.read_text(encoding="utf-8"))))
    check(
        "CSV export includes every detector sample and world/mm coordinates",
        len(rows) == 1536
        and {"u_world", "u_mm", "interactions", "wavelength_nm"}.issubset(rows[0]),
    )
    select(p, 1)
    before = stats(p)
    p.locator("#isolate-source").click()
    wait(p)
    check(
        "Source isolation does not remove the other source from tracing",
        stats(p)["rays"] == before["rays"]
        and stats(p)["renderedSegments"] < before["renderedSegments"],
    )
    p.locator("#isolate-source").click()
    wait(p)
    color = show_control(p, '#inspector input[type=text][data-prop="color"]')
    color.fill("#ff4060")
    color.press("Tab")
    wait(p)
    check(
        "Per-source custom color is retained in traced rays",
        scene(p)["objects"][0]["color"] == "#ff4060"
        and p.evaluate(
            'Lumen.getTrace().segments.filter(s=>s.sourceId==="o1").every(s=>s.color[0]===1)'
        ),
    )
    change(p, "angularDiameter", 60)
    check(
        "Finite angular disk produces non-zero stellar image extent",
        research_stat(
            p, 'Lumen.kernel.spotStatistics(d.hits.filter(h=>h.sourceId==="o1")).rms'
        )
        > 0.0001,
    )
    for preset, minimum in [
        ("collimator", 61),
        ("trough", 49),
        ("splitter", 39),
        ("rgb", 39),
        ("lens", 98),
        ("glass", 147),
        ("spherical", 37),
        ("relay", 21),
    ]:
        load(p, preset)
        check(
            "Retained " + preset + " preset loads and traces",
            stats(p)["hits"] >= minimum,
        )
    load(p, "splitter")
    select(p, 2)
    change(p, "ratio", 0.25)
    check(
        "Beam splitting still conserves detector powers",
        abs(p.evaluate("Lumen.getTrace().detectors.o3.power") - 0.75) < 1e-9
        and abs(p.evaluate("Lumen.getTrace().detectors.o4.power") - 0.25) < 1e-9,
    )
    load(p, "empty")
    p.locator("#add-button").click()
    wait(p)
    check(
        "Component library includes all 18 types",
        p.locator("#library [data-add]").count() == 18,
    )
    p.locator("#component-search").fill("parabolic")
    wait(p)
    check(
        "Search still filters components", p.locator("#library [data-add]").count() == 2
    )
    p.locator("#component-search").fill("")
    for kind in [
        "laser",
        "beam",
        "point",
        "spot",
        "fan",
        "line",
        "area",
        "star",
        "mirror",
        "parabola",
        "trough",
        "spherical",
        "splitter",
        "lens",
        "glass",
        "blocker",
        "aperture",
        "detector",
    ]:
        p.locator("#add-button").click()
        p.locator(f'#library [data-add="{kind}"]').click()
        wait(p)
        check(
            "Add " + kind + " creates a finite editable component",
            scene(p)["objects"][-1]["type"] == kind
            and p.evaluate(
                "Lumen.getTrace().segments.every(s=>s.a.concat(s.b).every(Number.isFinite))"
            ),
        )
    load(p, "binary")
    menu(p, "File")
    with p.expect_download() as d:
        p.locator("#save-button").click()
    out = OUTPUT / "exported-scene-v3.json"
    d.value.save_as(str(out))
    saved = json.loads(out.read_text(encoding="utf-8"))
    check(
        "Scene export preserves v3 star settings and target locks",
        saved["version"] == 3 and saved["objects"][0]["aimTarget"] == "o2",
    )
    import_scene(p, saved)
    check(
        "Saved scene imports with equivalent geometry and detector results",
        research_stat(p, "d.count") == 1536
        and scene(p)["objects"][0]["aimTarget"] == "o2",
    )
    bad = scene(p)
    p.locator("#scene-file").set_input_files(
        {"name": "bad.json", "mimeType": "application/json", "buffer": b"{bad"}
    )
    wait(p)
    check("Malformed imports preserve existing scene", scene(p) == bad)
    old = p.evaluate('Lumen.kernel.createPreset("focus")')
    old["version"] = 2
    old.pop("uid", None)
    import_scene(p, old)
    check(
        "Version 2 scenes remain importable",
        scene(p)["version"] == 3 and stats(p)["hits"] == 37,
    )
    menu(p, "File")
    with p.expect_download() as d:
        p.locator("#screenshot-button").click()
    out = OUTPUT / "exported-viewport-v3.png"
    d.value.save_as(str(out))
    check(
        "Viewport PNG export remains valid",
        out.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"),
    )
    command(p, "new-button", "File")
    p.locator("#confirm-new").click()
    wait(p)
    check("New scene empties workbench", len(scene(p)["objects"]) == 0)
    key(p, "Control+z")
    check("Clearing a scene can be undone", len(scene(p)["objects"]) == 2)
    for w, h in [(1440, 900), (1024, 768), (820, 1180), (390, 844)]:
        p.set_viewport_size({"width": w, "height": h})
        p.wait_for_timeout(200)
        check(
            f"{w}px viewport has no horizontal overflow",
            p.evaluate("document.documentElement.scrollWidth===innerWidth"),
        )
        check(
            f"{w}px viewport keeps a single-row toolbar",
            p.locator("#canvas").bounding_box()["y"] in (58, 62),
        )
        menu(p, "View")
        pop = p.locator("header .view-menu .menu-pop").bounding_box()
        check(
            f"{w}px View menu stays within viewport",
            pop["x"] >= 0
            and pop["x"] + pop["width"] <= w + 0.5
            and pop["y"] + pop["height"] <= h,
        )
        p.keyboard.press("Escape")
    check("No uncaught errors through all desktop workflows", not errors)
    # True touch-mode viewport checks, not just a desktop resize.
    mctx = b.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    m = mctx.new_page()
    merrors = []
    m.on("pageerror", lambda e: merrors.append(str(e)))
    m.set_content(HTML, wait_until="load")
    wait(m)
    check(
        "Touch/mobile boots without overflow",
        m.evaluate("document.documentElement.scrollWidth===innerWidth"),
    )
    m.locator("#right-toggle").tap()
    wait(m)
    check(
        "Mobile inspector opens as a drawer",
        m.locator("#inspector").is_visible()
        and m.locator("#right-dock").evaluate(
            '(e)=>e.classList.contains("mobile-open")'
        ),
    )
    m.locator("#right-close").tap()
    wait(m)
    check(
        "Mobile inspector closes",
        not m.locator("#right-dock").evaluate(
            '(e)=>e.classList.contains("mobile-open")'
        ),
    )
    m.locator("#add-button").tap()
    wait(m)
    check("Mobile component library opens", m.locator("#library").is_visible())
    m.locator('#library [data-add="star"]').tap()
    wait(m)
    check(
        "A star source can be added on mobile",
        scene(m)["objects"][-1]["type"] == "star"
        and m.locator("#right-dock").evaluate(
            '(e)=>e.classList.contains("mobile-open")'
        ),
    )
    m.locator("#right-close").tap()
    m.locator("#star-lab-button").tap()
    check("Mobile Star lab opens", m.locator("#star-dialog").is_visible())
    m.locator('#star-dialog [data-preset="star"]').tap()
    wait(m)
    check(
        "Mobile telescope preset opens its analysis drawer",
        m.locator("#research-map").is_visible() and research_stat(m, "d.count") == 768,
    )
    check("No uncaught mobile errors", not merrors)
    # Hold a real worker's reply so this race is deterministic on fast machines.
    delayed = ctx.new_page()
    delayed_errors = []
    delayed.on("pageerror", lambda e: delayed_errors.append(str(e)))
    delayed.evaluate("""() => {
            const NativeWorker = window.Worker;
            window.__holdWorkerReply = true;
            window.Worker = class extends NativeWorker {
                set onmessage(handler) {
                    this.addEventListener('message', event => {
                        if (window.__holdWorkerReply) {
                            window.__releaseWorkerReply = () => {
                                window.__holdWorkerReply = false;
                                handler(event);
                            };
                        } else {
                            handler(event);
                        }
                    });
                }
            };
        }""")
    delayed.set_content(HTML, wait_until="load")
    wait(delayed)
    data = delayed.evaluate('Lumen.kernel.createPreset("focus")')
    data["objects"][0]["count"] = 16384
    delayed.locator("#scene-file").set_input_files(
        {
            "name": "dense-scene.json",
            "mimeType": "application/json",
            "buffer": json.dumps(data).encode(),
        }
    )
    delayed.wait_for_function("typeof window.__releaseWorkerReply === 'function'")
    pending_stats = stats(delayed)
    check(
        "Dense worker trace remains pending until its reply arrives",
        pending_stats["pending"],
    )
    delayed.locator('[data-right-tab="simulation"]').click()
    delayed.locator('#simulation-panel [data-setting="rayStyle"]').select_option("glow")
    delayed.evaluate("window.__releaseWorkerReply()")
    wait(delayed)
    check(
        "Display edits during tracing accept the pending worker result without retracing",
        stats(delayed)["traceRuns"] == pending_stats["traceRuns"]
        and stats(delayed)["rays"] == 16384
        and stats(delayed)["hits"] == 16384
        and scene(delayed)["settings"]["rayStyle"] == "glow"
        and not delayed_errors,
    )
    delayed.close()
    # Documented synchronous fallback when workers are unavailable.
    fallback = ctx.new_page()
    fallback.evaluate("window.Worker=undefined")
    fallback.set_content(HTML, wait_until="load")
    wait(fallback)
    data = fallback.evaluate('Lumen.kernel.createPreset("binary")')
    import_scene(fallback, data)
    check(
        "Synchronous fallback works when Worker is unavailable",
        not stats(fallback)["worker"]
        and stats(fallback)["rays"] == 1536
        and research_stat(fallback, "d.count") == 1536,
    )
    fallback.close()
    clip = ctx.new_page()
    clip.evaluate(
        "Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{},readText:()=>new Promise(()=>{})}})"
    )
    clip.set_content(HTML, wait_until="load")
    wait(clip)
    key(clip, "Control+c")
    key(clip, "Control+v")
    check(
        "In-app paste does not wait for system clipboard permissions",
        len(scene(clip)["objects"]) == 3,
    )
    clip.close()
    p.set_viewport_size({"width": 1440, "height": 900})
    load(p, "focus")
    if not p.evaluate('document.body.classList.contains("left-hidden")'):
        p.locator("#left-toggle").click()
    p.locator('[data-right-tab="object"]').click()
    wait(p)
    key(p, "Home")
    p.wait_for_timeout(3400)
    p.screenshot(path=str(SCREENSHOTS / "preview-desktop.png"))
    load(p, "binary")
    p.wait_for_timeout(3400)
    p.screenshot(path=str(SCREENSHOTS / "preview-star.png"))
    m.locator("#right-close").tap()
    m.locator("#viewport-frame").tap()
    m.wait_for_timeout(3400)
    m.screenshot(path=str(SCREENSHOTS / "preview-mobile.png"))
    check(
        "No network dependencies appeared during testing",
        not any(u.startswith(("http:", "https:")) for u in requests),
    )
    print(
        json.dumps(
            {"passed": len(passed), "errors": errors, "mobileErrors": merrors}, indent=2
        ),
        flush=True,
    )
    (OUTPUT / "browser-results-v3.json").write_text(
        json.dumps(
            {
                "passed": len(passed),
                "checks": passed,
                "errors": errors,
                "mobileErrors": merrors,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    b.close()
