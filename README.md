# Lumen 5 — Optics Studio

A self-contained, full-window 3D geometric-optics workbench. This release gives Lumen a live start screen, integrates the former Star lab tools into the ordinary editor, and adds a few practical project and analysis tools. The V4 analytic inverse-mirror designer is retained.

## Open the app

Open **`lumen-3d-v5.html`** in a modern WebGL-enabled browser. The bundled HTML contains its own code, styles, optics kernel, renderer, and worker source. It has no runtime libraries, network downloads, accounts, analytics, or cloud dependency. Browser security policies can disable WebGL, local storage, workers, downloads, or fullscreen; failures are reported where applicable.

`index.html` is the same fully packaged application, ready for GitHub Pages or local use. The editable build template lives in `src/index.template.html`; rebuilding updates both HTML outputs.

For GitHub Pages, commit the generated `index.html` and select the publishing branch and `/ (root)` folder under **Settings → Pages → Deploy from a branch**. No server or build step is required on GitHub Pages. Run `npm run build` and commit both generated HTML files whenever the source changes.

## Your first session

The start screen offers six featured experiments: **Off-axis correction**, **Double-star field**, **Split & steer**, **RGB light lab**, **Through the glass**, and **Up & over**. Select a card to change the live, orbitable 3D preview. Drag to orbit; scroll to zoom. Pause motion or reset the camera using the preview controls. The inverse example has a real **Original / Corrected** geometry comparison.

**Open experiment** loads the chosen experiment into the normal editor, with the full scene sampling—not the reduced preview sampling. Each launch creates a fresh project identity. The preview has its own scene, camera, trace, and renderer, so browsing examples does not modify an open project.

**All experiments** exposes a searchable gallery of all 14 nonempty presets. **New blank project** starts with no optical objects and opens the component library. **Open project…** imports a saved scene. The Lumen logo returns to the start screen without replacing the current project; **Back to project** returns to editing.

The start screen appears by default. Uncheck **Show this screen on launch** to open the most recent valid recovery project on subsequent launches. With no recoverable project, the start screen still appears. Reduced-motion system preferences stop the preview's default motion.

### The preview is a preview, not a second simulation mode

Preview rays are traced against the actual analytic surfaces with at most **97 emitted samples per source**, using one reusable secondary WebGL context. The flow markers and slow orbit are presentation, not light-speed timing or a moving optical system. The editor loads the normal higher-resolution source settings. Hidden previews stop drawing. There is no pre-rendered video or fabricated spot illustration.

## One workspace for every kind of light

There is no separate Star lab screen or telescope editing mode. **Add → Distant star** works in any scene, alongside lasers, parallel beams, point/spot sources, fans, line sources, and area emitters. Field angle, angular diameter, color, wavelength, density, power, and target locks live in the ordinary Object inspector.

The launch gallery's on-axis, off-axis, and binary telescope examples are rotated into a horizontal lab layout. This is a rigid rotation of the previous geometry; the optics have not been changed. Earlier saved high-altitude telescope scenes retain their original layout when imported.

**Analyze** in the single top toolbar opens the same detector Analysis panel for every scene. Any detector inspector also has an **Analyze detector** button. A normal splitter experiment and a star experiment therefore share exactly the same measurement tools.

### Detector analysis

Choose the detector and either all sources or an individual source. The panel shows the recorded geometric hit diagram, incident power in arbitrary units, and per-source power-weighted RMS radius, 80% radius, and centroid. The source filter affects analysis and exports, not the scene's emission or tracing.

Use **Pin live monitor** to keep a compact plot in the viewport while editing a source or mirror in Object. Click the plot or **Expand** for a larger live view. Close the monitor when it is not useful; it is optional and its state is saved per project.

Export a **Hits CSV** containing every recorded sample in the chosen source filter, or a **1200 × 920 Plot PNG** with the detector name, sample count, scale, and geometric-optics caveat. Exports wait for the current trace. The plot can show per-source centroids and RMS circles. Display-only source isolation and ray thinning do not throw away detector measurements.

Fold-out sections hold **Plot & display**, **Telescope & physical scale**, and **Focal-plane placement**. Physical scaling, nominal primary focus, aperture/focal-ratio/plate-scale references, and Airy reference circles are available wherever the selected optical element supports them. Arbitrary inverse reflectors do not receive misleading nominal on-axis telescope references. The focus-placement shortcut aligns the detector to the primary axis; it does not solve a folded multi-element system.

A spot diagram contains geometric ray hits, not a diffraction point-spread function. Vignetting and numerical sampling limits can bias a spot measurement, so read the capture counts and explicit trace-limit notices as well as its RMS.

## Project and navigation conveniences

**Project name & notes.** Click the project title or use File → Project name & notes. Names and notes are included in the JSON and local recovery data.

**Local recents.** The app keeps recovery copies of up to eight distinct projects where browser storage is available, including camera, named views, analysis filters, notes, and monitor state. Recent cards can reopen or remove a copy; removing requires confirmation. Opening a preview alone never creates or replaces a recovery project. Storage is local to the browser/location/profile, is not encrypted by the app, and can be cleared or denied. **Save scene** produces the portable JSON backup. Do not treat local recovery as durable archival storage.

**Named camera views.** View → Save this camera view records the target, orbit, zoom, and projection. Recall or remove views in the View menu. Up to eight views are saved with a project.

**Command search.** Press **Ctrl/Cmd+K** or the search button to find components, analysis tools, scene objects, project actions, and saved camera views. Arrow keys select a result; Enter executes; Escape closes. Native copy/paste and selection inside text fields remain native.

**Independent display options.** The View inspector offers Studio, Midnight, and Slate backgrounds, a separate incoming-ray opacity, and optional component stands. These are ordinary scene settings, no longer hidden telescope-mode behaviors. The existing clarity/glow/bounce colors, path-stage display, flow motion, grid, normals, focus markers, and ray display budget remain available.

## Navigation and editing

Left drag orbits with the corrected grab-style direction; right/middle drag pans; the wheel zooms. Move and Rotate expose object handles. Hold Shift while moving for height, or constrain with X/Y/Z. Coordinates support ±1,000,000 world units on all axes. Use Home to frame the scene after large moves; also raise maximum path length for long optical layouts.

Shift-click selects groups. Ctrl/Cmd+C, X, V copy, cut, and paste. Ctrl/Cmd+Shift+V pastes in place. Ctrl/Cmd+D duplicates. Undo/redo preserve the existing single-transaction edits and remap copied source/target locks appropriately. Transform locks prevent accidental movement/deletion. Source **Aim once** and persistent **Lock onto** remain separate controls.

Keys 1–4 select perspective, top, front, and side cameras; the three axial views are orthographic. **F** requests browser fullscreen. **Tab**, with the viewport focused, hides the interface. Mobile uses slide-out panels, touch orbit, and pinch navigation.

## Inverse mirror shaping

Open **Shape**, choose a mirror, a design source, and a detector, then select the detector-local target and choose **Auto-shape mirror**. A parallel design wavefront produces an off-axis paraboloid; a finite design source point produces an ellipsoid. Reflection is computed from the actual analytic surface normal. The solver does not artificially aim outgoing rays after intersection.

The original figure, fixed mount frame, before/after aperture audit, same-scale comparison, capture accounting, frozen/live geometry distinction, target picking, undo, and sag CSV / OBJ exports are retained. **Original / Corrected on the start screen** chooses the figure that opens; **View original / View current in Shape** remains a non-destructive comparison.

See **`docs/V4-inverse-design-guide.md`** for the full retained mathematical formulation, audit definitions, supported-source assumptions, and fabrication caveats. That guide describes the prior UI; its geometric solver discussion still applies. Open the V5 file, not the V4 filename mentioned in the historical guide.

This is a **one-design-point inverse solver**, not a full-field image optimizer. A second star or an extended source continues to encounter the same physical mirror surface and can remain aberrated. Surface exports are open optical surfaces, not complete mirror blanks or machining plans.

## Limits and compatibility

The retained kernel supports 19 component types, up to 80 scene objects, up to 16,384 samples per source, 65,536 emitted rays per scene, and 100,000 traced segments. The global density multiplier reaches 8×. Source/scene/segment caps are explicit. A separate viewport budget thins complete displayed paths rather than reducing detector sampling. Dense traces use a local Blob worker where permitted, with a synchronous fallback.

V1–V4 scenes are imported and normalized to the V5 schema. The legacy `starMode` field is retained for compatibility only; it no longer controls the editor interface or special beam brightness. Old star scenes migrate their stand visibility to `hideStands`. V5 workspace metadata is validated and optional. Existing source locks and inverse-design bindings remain ID-remapped during validation/copy-paste.

The workbench uses geometric optics: no diffraction, interference, atmospheric seeing, physical detector pixels, calibrated irradiance display, polarization, tolerances, roughness, or manufacturing simulation. Thin lenses are paraxial; wavelength colors are approximate; overlapping glass volumes are unsupported. Flow markers are illustrative. This is an experimental educational/design workbench, not a validated production telescope or fabrication solver.

## Build and test

Requires Node.js 18 or newer to rebuild; the built app itself does not require Node.

```sh
node build.mjs
node --test tests/*.test.mjs
```

Performance checks compare the current implementation with saved pre-optimization V5 source, including exact optical-output comparisons and browser pixel checks. Run `npm run test:performance` for the tracing benchmark and `npm run test:browser-performance` for browser upload, rendering, worker and mobile checks. See [performance results and reproduction instructions](benchmarks/README.md) for measured improvements, dependencies and limitations.

Browser checks use Python Playwright, Pillow, Chromium, and Xvfb on headless Linux. They require no runtime web assets:

```sh
xvfb-run -a python -u tests/browser_studio_v5.py
xvfb-run -a python -u tests/browser_inverse_v5.py
xvfb-run -a python -u tests/browser_regression_v5.py
```

Set `CHROMIUM_PATH` when Chromium is not at `/usr/bin/chromium`. See `VERIFICATION.md` for the actual tested environment, coverage, results, and limitations—including the distinction between a storage test model and real browser persistence.

### Source map

`src/optics.js` holds the pure geometry, tracing, validation, and inverse kernel. `renderer.js` is the dependency-free WebGL renderer. `designer.js` is the inverse-design interface. `app.js` owns the editor. `session.js` validates local project recovery, `preview.js` builds isolated real-ray demo previews, and `launcher.js` owns the start screen and command search. `studio.css` contains the new UI styling. `build.mjs` embeds them into `src/index.template.html` and writes identical offline bundles to `index.html` and `lumen-3d-v5.html`, creating the worker source from the same kernel.
