# Changelog

## Unreleased

- Formatted JavaScript, tests, HTML, CSS, and the browser harness; extracted styles, shared UI helpers, and pure ray-display geometry into focused modules.
- Added pinned formatting tools, an editor configuration, and `npm run check` for formatting, build, and regression checks.
- Replaced line-based import stripping with parsed local-module bundling that preserves private scopes, supports multiline imports, and tests the standalone app and worker output.
- Reduced repeated source calculations, coordinate-transform allocations, and work on rejected optical intersections. Added reproducible benchmarks and correctness/performance regressions.
- Reused WebGL stream storage, CPU staging arrays, normal matrices, and unchanged camera matrices, with tests for invalidation and mutable uploads.
- Reused optical traces for display and analysis controls, including edits made while a worker trace is pending. Optical edits still retrace.
- Made browser testing portable across installed Chrome/Edge/Chromium browsers, with UTF-8 files, headless execution, and configurable artifacts.

## 3.0.0

- Consolidated two top bars into one File/Edit/Add/transform/Star lab/View toolbar.
- Enlarged controls and typography, folded secondary inspector sections, collapsed the library by default and reduced floating overlays.
- Added multi-selection and copy, cut, paste, paste-in-place and group duplication, with safe target-reference remapping.
- Expanded XYZ placement to ±1,000,000 units; removed the fixed tracing world box; added adaptive camera clipping, wider pan/zoom, higher placement and no oversized decorative stands.
- Raised sampling to 16,384 rays/source and 65,536 rays/scene, with a 100,000-segment ceiling and local-worker dense tracing.
- Added persistent source target locks alongside one-shot aiming.
- Added density-aware clear ray lines, source emphasis/isolation, bounce-color and glow styles, interaction-only display and an independent full-path display budget.
- Added a distant-star source with field angles, finite angular diameter and target-locked pupil sampling.
- Added on-axis, off-axis and double-star telescope experiments, per-source focal-spot statistics, physical scaling, reference circles, focal-plane placement and full detector-hit CSV export.
- Added explicitly virtual detector interaction gating and warnings for limited traces.
- Preserved v1/v2 imports, all earlier optics, source colors, JSON/PNG exports, object locks, snapping, fullscreen and corrected orbit direction.
- Added numerical and real-control browser regressions; included recorded test results and updated example scenes.

## Earlier versions

Version 2 introduced the full-window workbench, analytical curved mirrors, seven colored source types, splitters, lenses, glass, blockers, apertures and detectors. Version 1 was the initial flat-mirror reflection playground.
