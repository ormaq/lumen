# Lumen 3 — 3D Optics Studio

An offline 3D geometric-optics workbench with a single application toolbar, editable optical components, colored sources, and a telescope-oriented Star lab. This is an independent implementation inspired by PhyDemo's 2D Ray Optics Simulation, not a complete 3D port.

## Open the application

Open **`lumen-3d-v3.html`** in a WebGL-enabled browser. The file contains the entire application, renderer, optics kernel, styles and tracing worker. No installation, development server, external fonts, packages, account, or internet connection is required to run it. If a file viewer shows source text, save the HTML and open that saved copy in a browser.

The workspace fills the browser viewport. **F** or the top-right icon requests actual browser fullscreen where supported; **Tab** with the canvas focused hides the interface without needing the Fullscreen API. This is a web application, not an operating-system-native executable.

The scene autosaves locally when the browser permits localStorage. Private browsing and file-origin policies may limit persistence. **File → Save scene** produces a portable JSON copy. V1 and V2 scene files remain importable. Nothing is uploaded to a service.

## What's new

**A quieter, larger interface.** One 62-pixel toolbar contains File, Edit, Add, transform tools, Star lab, View and panel toggles. The library starts collapsed. Main controls use 14-pixel text; inspector headings and scene titles are larger. Orientation, color and secondary sections fold away. Floating measurements, all-object labels and animated dots are off by default. Mobile uses drawers and viewport-width menus instead of squeezing the canvas.

**Object clipboard.** Copy, cut, paste, paste in place, duplicate and multi-select work on objects or groups. Internal source-to-target links are remapped to the copied targets. A source copied alone keeps its external target when pasted within the same scene; cross-scene dangling targets are released. In-app copies paste immediately without a system-clipboard permission prompt; copying to the system clipboard is best-effort. With no local object clipboard, Paste tries the system clipboard when the browser permits it. Cross-tab/system clipboard availability is browser-dependent. Normal text-field shortcuts are not intercepted. Transform-locked objects cannot be cut or deleted.

**More room.** All three position axes accept **−1,000,000 to +1,000,000 world units**, including Y height. The tracer no longer clips paths to a small fixed world box. Camera framing, zoom, pan and clipping scale with the scene. Large positions do not automatically lengthen light paths: increase **View → Maximum path length** for long optical trains. Very small details at extreme absolute coordinates can lose GPU precision.

**Higher sampling.** A non-single source can emit **16,384 rays**, a scene can emit **65,536 rays**, and tracing stops at **100,000 segments**. Global density ranges from 0.25× to 8×, respecting those ceilings. Source power is normalized across its emitted samples. Over-subscribed sources share the scene sample budget proportionally. Heavy traces run in a local Blob worker where supported, with a synchronous fallback. Worker results from obsolete edits are discarded.

**Persistent targeting.** In a source's Emission section, choose an object and press **Lock onto**. Direction follows the target center when either source or target moves. **Aim once** remains a separate action. **Release lock** restores manual yaw/elevation control. This is an aiming link, distinct from transform locking. Removing the target releases the link while preserving the last direction.

**Clearer overlapping light.** Clear-lines mode uses non-additive alpha compositing, density-aware opacity and interleaved source drawing, rather than bright additive bloom by default. Selecting a source emphasizes its rays. **Only this source** isolates its visible paths without disabling other emitters. Soft-glow and by-bounce color modes, line opacity, width and an after-first-interaction filter are available. A lower visible-segment budget samples complete paths without changing the full traced detector data. The status bar reports display thinning, sample resampling and trace truncation separately. Display brightness is not calibrated irradiance.

## Star lab: geometric telescope experiments

Choose **Star lab** in the toolbar. Three starting scenes are provided:

| Experiment | Purpose |
| --- | --- |
| Star at infinity | Parallel, on-axis starlight and an analytical parabolic primary |
| Off-axis star | Change field angle and inspect geometric coma |
| Double-star field | Two independent colored wavefronts and their focal spots |

These start at height 120 units, without the decorative floor grid or stands. Opening an experiment replaces the current scene but remains undoable. **Add a star to this scene** and **Analyze current scene** preserve your existing setup.

A **Distant star** source represents a circular sampled wavefront arriving from infinity, not a nearby point emitter. Its position places a finite launch plane; it is not the astronomical distance. **Field X/Y** specify angular offsets in degrees from its base direction. **Angular diameter** specifies a uniform apparent stellar disk in arcseconds; zero gives a point star with parallel rays. This disk is neither diffraction nor atmospheric seeing.

Lock a star onto the primary mirror to keep the sampled pupil centered on its vertex plane as field angle or launch distance changes. This compensates the launch-plane position for angular field, avoiding artificial vignetting caused just by moving that plane. Real finite mirror edges, apertures, blockers and path limits still affect the result. The wavefront diameter should cover the pupil you intend to sample.

The **Analysis** tab provides:

- A geometric spot diagram with separate source colors, centroids, power-weighted RMS radius and an 80%-encircled-power radius.
- Recorded-sample and incident-power totals, detector/primary selection, full-screen or auto-fit plot extent, and full-hit CSV export.
- Physical scale in millimeters per world unit; nominal aperture, focal length, focal ratio and plate scale.
- An optional Airy-circle overlay and a 550 nm Rayleigh reference; source-specific circles use the selected wavelength, or 550 nm for RGB sources.
- A focal-plane offset and **Place at nominal focus** command. These align the detector to the primary axis; use ordinary transforms for folded optical trains.

The included focal detector is an explicit **virtual analysis plane**: its **Record after interactions** value is 1, so incoming starlight passes it without being recorded or blocked. Reflected rays are then recorded and absorbed. Setting the value to 0 makes it a normal physical screen that also intercepts incoming light within its finite area. This gate is an analysis convenience, not a real telescope component or a model of secondary-mirror obscuration.

CSV columns are `source`, `ray_index`, `u_world`, `v_world`, `u_mm`, `v_mm`, `x_world`, `y_world`, `z_world`, `power_arb`, `wavelength_nm`, and `interactions`. Radii are calculated around each source's own power-weighted centroid. Pass-through detectors may count repeated encounters, so their power is not automatically an efficiency percentage. A truncation warning means statistics may be incomplete; lower sampling/interaction limits and test convergence before interpreting them.

### Scientific boundaries

The star workbench is useful for reproducible **geometric** experiments, not a validated production telescope-design solver. It does not propagate waves or calculate a diffraction PSF, interference, atmospheric seeing, detector pixels, polarization, stellar spectra/magnitudes or a material-calibrated throughput. A finite ray spot must not be mistaken for a wave-optical PSF. The Airy/Rayleigh circles are reference calculations for an unobstructed circular aperture, not simulated resolution or evidence that two stars can be resolved by a real instrument.

For a primary of diameter D and nominal focal length f, in consistent length units:

```
f-number              = |f| / D
plate scale [arcsec/mm] = 206264.806247 / |f_mm|
Rayleigh angle [rad]    = 1.22 * wavelength / D
Airy radius [length]    = 1.22 * wavelength * |f| / D
```

These reference formulas do not account for an obstruction, aberrations or optical trains downstream of the selected primary. The supplied 50 mm/world-unit scale makes the default primary 200 mm in diameter with a 600 mm nominal focal length, f/3.

## Controls

| Action | Control |
| --- | --- |
| Orbit | Left drag in Select mode; foreground follows horizontal drag |
| Pan | Right/middle drag; Shift + left drag in Select mode |
| Zoom | Wheel; two-finger pinch on touch devices |
| Frame scene / selected | Home / double-click; View menu |
| Perspective / top / front / side | 1 / 2 / 3 / 4 |
| Select / move / rotate | Q / G / R |
| Axis constraint | X / Y / Z |
| Raise/lower object | Y handle, Y position field, or Shift-drag in Move mode |
| Multi-select | Shift-click objects in the scene list or viewport |
| Select all | Ctrl/Command + A, outside text fields |
| Copy / cut / paste | Ctrl/Command + C / X / V |
| Paste in place | Ctrl/Command + Shift + V |
| Duplicate / delete | Ctrl/Command + D / Delete |
| Undo / redo | Ctrl/Command + Z / Shift + Z |
| Add / save | A / Ctrl/Command + S |
| Light-flow dots | Space |
| Canvas-only / browser fullscreen | Tab with canvas focused / F |
| Help | ? |

Move selected groups together; rotation edits the active object. Snapping uses 0.25-unit translations and 15-degree rotations. The editor supports 80 components and 100 undo transactions. Load, paste, cut, new-scene and completed drags are undoable. An invert-horizontal-orbit preference remains under View.

## Retained optics

There are **18 component types**: eight sources (single ray, beam, point, spot, fan, line, area, distant star); four mirrors (flat, parabolic dish, parabolic trough, spherical concave/convex); splitters, ideal thin lenses and glass spheres; blockers, apertures and detectors. Sources have independent RGB or wavelength colors and power. All ten earlier presets remain, for a total of thirteen including the empty workbench.

Surfaces use analytical intersections and normals rather than the display mesh. In a reflector's local frame, a dish is `z=(x²+y²)/(4f)` and a trough is `z=x²/(4f)`. Coordinates are right-handed with Y up; local +Z points into the bowl and along a source's base direction. Mirror reflectivity and splitter power ratios are adjustable. A spherical mirror's R/2 marker is paraxial, not an exact common focus.

Glass spheres implement Snell refraction, total internal reflection, optional unpolarized Fresnel branches and a simple optional dispersion model in surrounding air. RGB sources use 550 nm for dispersion. Overlapping/nested glass volumes are unsupported. Thin lenses are ideal paraxial elements, not real curved glass. Mirrors are ideal and two-sided. Decorative supports, emitter bodies and the grid do not interact optically. Animated dots show direction, not the speed of light. Wavelength colors and RGB mixing are illustrative.

## Source and tests

```
lumen-3d-v3.html        Ready-to-open offline distribution
index.html              HTML/CSS shell; use the built file to run
src/optics.js            Deterministic geometric kernel, sampling and validation
src/renderer.js          Dependency-free WebGL renderer and camera
src/app.js               Editor, clipboard, workers, ray display and analysis
build.mjs                Standard-library-only single-file bundler
examples/*.json          Thirteen editable scene files
tests/optics.test.mjs    Original optics regressions, updated for v3 limits
tests/v3.test.mjs        High coordinates, sampling, locks, clipboard and stars
tests/browser_v3.py     Optional real-control Chromium UI regressions
```

With Node.js 18 or later, no npm packages need to be installed:

```sh
npm run build
npm test
```

The mathematical suite contains **65 passing tests**, and the recorded Chromium run completed **126 passing interaction/layout checks** with no uncaught application errors. The browser test uses Python Playwright and a local Chromium executable (`CHROMIUM_PATH`, default `/usr/bin/chromium`). On headless Linux, software WebGL was tested with a visible Chromium under Xvfb:

```sh
python -m pip install playwright
xvfb-run -a python -u tests/browser_v3.py
```

See `tests/browser-results-v3.json` and `.log` for the actual completed checks. The harness injects the fully bundled document with `page.set_content`; it drives the DOM, keyboard, mouse, touch drawers, real Fullscreen API, worker tracing, imports, CSV/JSON/PNG downloads and responsive layouts. Blob-worker loads are local, not external asset requests. Tests cover Chromium desktop and a Chromium mobile/touch viewport; they do not certify Safari/Firefox, real mobile GPU behavior, cross-app clipboard permissions or normal file-origin persistence.

`window.Lumen` exposes read-only snapshots via `getScene()`, `getTrace()`, `getCamera()`, `getStats()`, `getSelection()`, `getSelections()` and `getHistory()`, plus pure helpers in `kernel`. `getStats().pending` includes worker work; `renderedSegments` can be lower than traced `segments`. Imported JSON validates finite values, types, IDs and references; files are limited to 2 MB. A saved scene uses `{version:3, uid, name, preset, objects, settings}`.

## References

The workbench/component baseline is [PhyDemo Ray Optics Simulation](https://phydemo.app/ray-optics/). Reflection and transmission conventions follow [Physically Based Rendering, 4th edition](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission). Geometric spot interpretation and its distinction from a diffraction PSF are explained in [Ansys: What is a Point Spread Function?](https://optics.ansys.com/hc/en-us/articles/42661723066515-What-is-a-Point-Spread-Function). The circular-aperture Rayleigh criterion is also described in [ESA's diffraction-limit research brief](https://www.esa.int/gsp/ACT/doc/ARI/ARI%20Call%20doc/Study%20descriptions/ARI-study_17-1501.pdf).

Lumen is not affiliated with these projects and makes no runtime requests to them.
