# Lumen 4 — inverse mirror design

An offline, full-window 3D geometric-optics workbench. Lumen 4 adds **Shape to a detector**: construct a continuous reflecting surface from the incident wavefront and a desired detector point, then trace its real geometry to check the result.

Open `lumen-3d-v4.html` in a modern WebGL-enabled browser. No server, installation, network connection, CDN, external library, or account is required. Use **F** or the fullscreen control to enter actual browser fullscreen. A browser must permit WebGL; local browser policies can disable it.

## First experiment

The default scene, **Off-axis correction**, is an angled telescope-like layout: a distant-star wavefront, a standard parabolic mirror, and an offset, tilted detector.

1. Open **Shape** in the single top toolbar. The Design panel lists the mirror, design source, and detector. Their positions and the mirror mount orientation are not automatically moved.
2. Leave the detector target at `u = 0, v = 0` and click **Auto-shape mirror**.
3. Inspect the same-scale spot comparison and the capture counts. Switch **View original / View current** to compare the actual old and new optical surfaces in the viewport.

The default test scene reduces target RMS from approximately **0.974039 world units** to numerical round-off, while retaining **2,048 / 2,048 captured audit samples**. The UI deliberately displays very small distances as **< 10⁻⁷**, not “perfect zero.” Its normal full-scene trace uses 1,024 rays; the separate before/after audit uses 2,048 identical deterministic source samples in each column. These are geometric simulation results, not measured hardware performance.

The included example `inverse-solved.json` opens an already-shaped version. `finite.json` starts a finite point-source example; `finite-solved.json` is its ellipsoidal solution. Load scenes through **File → Open**.

## What is being changed

The solver replaces the mirror's optical figure with an analytic **inverse reflector**. It preserves its object ID, name, world anchor, mount yaw/tilt/roll, circular aperture diameter, coating reflectivity, and scene layout. The normal of the optical surface at the anchor is allowed to change; the mount coordinate system is not the optical vertex or axis of the new parent conic.

For parallel light, including the chief direction of a distant star, the surface is an **off-axis paraboloid**. For a finite point source, the surface is an **ellipsoid** whose two foci are the source point and the detector target. The implementation uses the actual surface normal and the ordinary reflection law for every incoming ray. It does not instruct outgoing rays to point at a target after they hit a mirror.

The original optical parameters are retained with the object. **Surface & export → Restore original surface** restores those parameters at the current mount position and orientation. Both solving and restoring are single undoable scene edits. Re-solving does not overwrite the saved original baseline. A directly added or imported inverse reflector without a stored original shows no before-baseline metric; its current spot remains measurable.

Rectangular flat mirrors and troughs can also be used as starting surfaces, but conversion replaces their rectangular aperture with an inscribed circle. This is explicitly reported. The output is a single-valued sag surface in the existing mount frame; grazing or folded aperture geometries are rejected. Rotate the mount closer to the incident/reflected direction bisector or reduce its diameter when that occurs.

## Target selection and moving objects

`u` and `v` are coordinates in the **detector's local plane**, in world units. The center button sets both to zero. The target picker lets you click inside the detector frame in the 3D viewport. Escape cancels picking. On a narrow touch screen, the picker closes the drawer so the detector can be reached.

A solved mirror is **frozen by default**: it is a rigid surface. Moving its source, mirror, or detector can make the saved figure out of date for the selected constraint. The app reports this and measures the current blur; it does not silently redirect the rays.

**Keep correcting when objects move** enables explicit *live re-shaping*. Source/target movements then produce a new saved surface. This is not a mechanical mirror aim lock and not a model of a real-time deformable mirror actuator. A failed live solve retains the last valid surface and reports that the constraint is unsatisfied. Locked mirrors do not reshape.

The source's existing **Lock onto** feature remains separate: it changes emitter direction. It can be useful for aiming a wavefront at the mirror pupil. Live mirror shaping changes the actual optical figure.

## Which sources work

- **Distant star:** the star's field angles define the chief incoming direction. Zero angular diameter represents a single plane wavefront. A nonzero stellar disk is still traced as many different directions and retains a finite image after solving.
- **Parallel beam, line source, area source:** set divergence to zero. Divergent distributed emitters are rejected because they do not define the single plane wavefront assumed by this solve.
- **Single ray:** provides a plane-wave design direction but does not empirically fill the aperture. The independent aperture audit still checks the full figure.
- **Point or spot source:** defines a finite source point and produces an ellipsoid. A spot source is usually more efficient than an omnidirectional source for illuminating a mirror.
- **Fan source:** also defines a finite point but samples only a plane. The UI warns that it does not empirically test a full 3D pupil.

The solve assumes that the chosen source reaches this mirror directly in air. It is **not** an inverse solver through upstream lenses, glass, splitters, other mirrors, or refractive-index gradients. The normal scene tracer still includes those components. Choose an appropriate input wavefront or simplify the layout before using this one-mirror solve.

## “Perfect focus” versus “perfect image”

This version corrects **one source point or one incoming direction to one detector point**. It does not claim a perfect image of an entire star field, an extended object, a resolved stellar disk, or a requested arbitrary picture.

A second source direction continues to encounter exactly the same saved mirror geometry. It is not collapsed to the design target. Such fields can still have coma, astigmatism, distortion, or defocus. A full-image inverse designer would need several source/field constraints, a specified image mapping and merit function, and possibly more than one optical surface. A target irradiance-pattern designer is a related but different problem from image formation.

Diffraction, interference, atmospheric seeing, wave-optical PSFs, polarization, coating phase, thermal/mechanical deformation, surface roughness and fabrication tolerances are not simulated. A numerically tiny geometric spot does not mean a real telescope has infinite resolution. The previous Star lab's Airy circles are reference overlays, not a wave-optical calculation. The on-axis focal-ratio/nominal-focus shortcuts are disabled for arbitrary inverse reflectors rather than reporting a misleading inherited focal length.

## What the checks mean

The **before/after audit** launches the same deterministic source samples for each figure. Its RMS is the power-weighted distance to the **requested target**, not merely the spot's centroid. It is evaluated on the infinite detector plane, including reflected samples that miss the finite frame. This prevents an apparently small spot obtained only by discarding off-target rays at the detector edge.

Capture is reported separately as captured / launched rays. It checks the finite detector frame, direct-path obstructions, mirror reflectivity, path-length limit, bounce limit, and the detector's minimum-interaction setting. This independent audit does not apply the full-scene segment budget or faint-ray pruning cutoff; the ordinary scene's detector records can differ when those numerical limits apply. The audit is a conservative **single-reflection** path check; it does not trace alternate routes through intervening optical elements. Use the ordinary full-scene Analysis view for actual multi-element ray histories and recorded detector power.

Rays that miss the mirror aperture are counted and reported, but cannot contribute a reflected-plane spot. Zero illuminated rays or zero captured samples is an error and does not commit a new surface. A missing metric is shown as “—”, never zero. Lower throughput can remain a real tradeoff; the tool does not optimize pupil coverage or remove obstructions.

The independent **full-aperture audit** samples the designed wavefront at the center and 16 rings × 96 angles, checking 1,537 points. It verifies the reflected line's distance to the saved focus and the peak-to-valley optical-path variation. It does not substitute for checking whether the actual source illuminates those points. The circular-aperture no-fold test uses a conservative discriminant bound over the complete rim, including a bound between sample angles. Displayed sag/slope extrema are explicitly sampled estimates, not guaranteed metrology extrema.

**View original** is a temporary geometry/trace comparison. It does not modify scene data, saved files, undo history, or the current Analysis tab's full-scene detector data. Preview display sampling is capped at 4,096 rays across enabled sources; audit sampling is unchanged. Exit the amber preview banner to return to the current surface.

## Analytic formulation

Use coordinates `q = (x,y,z)` in the mirror's mount frame, with the retained anchor at `q = 0`. Let `T` be the desired target in that frame. `d` is a unit incident travel direction, `S` a finite source location.

For a plane wave, constant optical path gives:

```
d · q + |T - q| = |T|
qᵀ (I - ddᵀ) q + 2 (|T| d - T) · q = 0
```

This is a paraboloid. The near-anchor branch is selected without accepting the extraneous branch introduced by squaring.

For a finite source:

```
|S - q| + |T - q| = |S| + |T|
```

This is an ellipsoid. Writing `m = (S + T)/2`, `a = (|S| + |T|)/2`, `c = |T-S|/2`, `e = (T-S)/(2c)` and `r = (a-c)(a+c)/a²` gives a numerically scaled implicit quadratic:

```
A = I + (r - 1) eeᵀ
l = -2 A m
qᵀ A q + l · q = 0
```

The spherical case `c = 0` is handled; the straight-through degenerate case is rejected. The optical normal is the normalized gradient `2Aq + l`. Ray/surface intersections solve the same quadratic along the incoming ray, then check the selected height-field branch and circular aperture. Surface tessellation is only for display/export, not for the optical intersection or reflection.

The implementation has finite coordinate bounds and floating-point tolerance. Very large, near-degenerate, grazing, or extremely small layouts need additional numerical scrutiny. Positions remain bounded to ±1,000,000 world units and path length can be configured independently.

## Surface exports

Expand **Surface & export** in Design.

**Sag CSV** exports 4,097 center/ring samples with:

```
u_world, v_world, sag_world, delta_original_world,
n_u, n_v, n_z, x_world, y_world, z_world, mm_per_unit
```

Here `u_world` and `v_world` mean mount-local aperture coordinates measured in world-unit lengths. `sag_world` is the local Z height, and `delta_original_world` is height difference from the retained original surface at the same aperture coordinates. Normals are in the mirror mount frame; the final `x/y/z_world` columns are global positions. `mm_per_unit` carries the scene's length scale. Multiply a length in world units by that scale to obtain millimeters.

**OBJ** exports an open triangulated optical surface: 4,097 vertices, 4,097 vertex normals, 8,064 triangles. Coordinates use the mirror's local mount frame in world units; comments record its world anchor, Euler angles, and millimeters per unit. Face winding follows the exported optical normal. This is **not a watertight blank, a tooling path, a sag-removal plan, an STL manufacturing solid, or a fabrication-ready specification**. There is no substrate thickness, back surface, bevel, support geometry, mechanical allowance, or tolerance budget. Exporting a mathematically valid surface does not establish manufacturability.

Save JSON as well as meshes: JSON retains the analytic figure, settings, original baseline, and source/target bindings. Copy/paste preserves the figure; copying a whole group remaps its internal bindings to the copied source/detector. Pasted inverse mirrors start frozen to avoid surprising shape changes. Cross-scene copies release references to external objects.

## Retained workbench

All earlier tools remain: 19 component types; per-source RGB/wavelength color; multi-bounce tracing; source isolation; line-opacity controls; diffraction-reference-only Star lab; detector spot diagrams and CSV; move/rotate handles; snapping; group selection; copy/cut/paste; undo/redo; JSON save/load; viewport PNG; orthographic views; true browser fullscreen; touch drawers and pinch navigation.

Use left drag to orbit, right/middle drag to pan, wheel to zoom. `1/2/3/4` select perspective/top/front/side; `Home` frames the scene. `Tab` with the canvas focused toggles a clean full-canvas view. `Ctrl/Cmd+C`, `V`, `X`, `D`, `Z` copy, paste, cut, duplicate, and undo. `Ctrl/Cmd+Shift+V` pastes in place; `Ctrl/Cmd+Shift+Z` redoes. Browser-native editing shortcuts are preserved while a text/number field has focus.

Sampling caps remain 16,384 per source, 65,536 emitted rays per scene, 100,000 traced segments. The viewport may draw fewer complete ray paths without reducing the ordinary detector's trace samples. A local worker is used for dense traces when supported, with a synchronous fallback. Save important work explicitly: local auto-save depends on the browser permitting storage for the opened document.

The previous detailed feature guide is retained in `docs/V3-workbench-guide.md` for reference. V4 accepts V1/V2/V3 scenes as well as V4 scenes; older versions cannot read the new inverse-reflector type.

## Source and tests

```
index.html             App markup and styles, with build injection marker
src/optics.js          Analytic geometry, deterministic emitters, tracing and inverse solve
src/renderer.js        Small dependency-free WebGL renderer
src/designer.js        Inverse design sidebar, audit visualization and export
src/designer.css       Source copy of the integrated inverse-design CSS
src/app.js             Scene editor, viewport interaction and worker orchestration
build.mjs             Bundles the source modules and worker into one offline HTML file
examples/             Original and solved scenes
 tests/                Optics tests and Chromium interaction harnesses
```

Build and mathematical checks, using Node 18+:

```
node build.mjs
node --test tests/*.test.mjs
```

The build takes styling from `index.html`; `src/designer.css` is its editable section reference, not dynamically imported at runtime. To change design styles, update the corresponding section in `index.html` too.

UI tests require Python Playwright, Chromium and, on headless Linux, Xvfb:

```
xvfb-run -a python -u tests/browser_regression_v4.py
xvfb-run -a python -u tests/browser_inverse_v4.py
```

`CHROMIUM_PATH` can override `/usr/bin/chromium`. Tests inject the complete bundled HTML into a Chromium page, operate the visible controls, check real WebGL tracing and inspect downloaded exports. They cover a true touch-enabled mobile context as well as desktop-size layouts. They are not a claim of testing every browser, operating system or GPU. Machine-readable results and test logs from this build are included in `tests/`.

The pure math tests include forward-tracer checks, finite-difference normals, reversibility, constant path, axial equivalence, finite/extended sources, nonzero field angles, off-center tilted detectors, aperture failures, capture accounting, rigid/live behavior, million-unit coordinates, 35 deterministic randomized layouts, malicious imports, copy bindings, exports and previous optics regressions.

## Optical references

- Edmund Optics, **Off-Axis Parabolic Mirror Selection Guide**: https://www.edmundoptics.com/knowledge-center/application-notes/optics/off-axis-parabolic-mirror-selection-guide/
- Ansys Optics, **How to model an off-axis parabolic mirror**: https://optics.ansys.com/hc/en-us/articles/42661691936019-How-to-model-an-off-axis-parabolic-mirror
- Edmund Optics, **Precision Ellipsoidal Reflectors**: https://www.edmundoptics.com/f/precision-ellipsoidal-reflectors/13717/
- Bösel and Gross, **Single freeform surface design for prescribed input wavefront and target irradiance**: https://arxiv.org/abs/1705.04540

The last reference concerns broader freeform irradiance design; that solver is not implemented here. This app implements the explicit one-point conic constraints above.
