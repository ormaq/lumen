# Verification — Lumen 5

## Performance update — October 17, 2026

**161 / 161 Node tests passed**, including 15 added performance/correctness regression tests. The dedicated before/after benchmark passed with a **1.24× geometric mean tracing speedup** across eight workloads and exact equality of complete optical outputs.

**48 new browser checks passed** in headless Edge/Chromium 155.0.4283.62 on Windows using ANGLE SwiftShader. The real packaged HTML was served over HTTP under a repository-style subpath. Clarity, glow and bounce screenshots matched the reference pixel for pixel; per-frame WebGL upload bytes fell by **98.45–99.22%**. Real-origin recovery, worker output, camera invalidation, empty scenes and the mobile synchronous fallback passed. See [benchmark methods, raw results and limitations](benchmarks/README.md).

The results below record the original V5 validation environment; they are retained as historical evidence.

The existing editor/mobile regression suite was also rerun against the optimized bundle: **127 / 127 browser assertions passed**, with no desktop or mobile JavaScript errors (`tests/browser-regression-performance.log`). The original studio and inverse UI suites were not rerun for this performance update; their mathematical and model tests are included in the passing Node suite.

## Original V5 results

**146 / 146 Node tests passed** (`node --test tests/*.test.mjs`). These include the retained optics and V4 inverse-design tests plus 35 new tests for V5 metadata validation, compatibility, store failures, project identity, command filtering, isolated demo scenes, actual corrected/original geometry, and the rigidly rotated telescope examples. No tests were skipped.

**277 Chromium UI assertions passed** across three suites:

| Suite | Passing assertions | Result file |
|---|---:|---|
| New integrated studio and launch flow | 86 | `tests/browser-results-studio-v5.json` |
| Retained inverse-design interactions | 64 | `tests/browser-results-inverse-v5.json` |
| Retained editor, tracing and mobile regressions | 127 | `tests/browser-results-regression-v5.json` |

All three completed with no uncaught JavaScript errors. No external HTTP(S) assets or runtime requests were observed in these tests.

## What was exercised

The new UI suite covers the native first-launch dialog, preview pause/orbit/isolation and real original/corrected shapes, all six live demos, gallery search, help and Escape behavior, new blank projects, integrated ordinary/star detectors, per-source filtering without reducing traced data, 768-row filtered CSV, 1200 × 920 PNG, pinned/expanded plots, editing a star while monitoring the detector, project name/notes, camera bookmarks, command search, independent display settings, local recent-project flows, optional launch bypass, delete confirmation, fresh identity on repeated demo launches, malformed imports, blocked storage, and touch launch/analysis controls.

The retained regression suites exercise all 19 components, source locks and group copy/paste, undo/redo, 16,384-ray worker tracing, display-only thinning, source color and beam splitting, orthographic cameras, corrected orbit direction, million-unit placement, actual browser fullscreen, V1–V4 compatibility paths, detector CSV and viewport image exports, live/frozen analytic inverse surfaces, target picking, solver validation, sag CSV and surface OBJ output, and the synchronous fallback when workers are disabled.

Desktop/tablet layouts were checked at 1512 × 980, 1440 × 900, 1024 × 768, and 820 × 1180. Narrow desktop and touch-mode layouts were checked at 390 × 844. Toolbar count and page overflow were checked. The capture script creates actual app screenshots, not fabricated UI or ray illustrations.

## Test environment and limitations

Tests used **Chromium 144.0.7559.96**, Python Playwright, and a real WebGL context through ANGLE/SwiftShader, running headed under Xvfb on Linux. The mathematical tests ran in Node. Screenshots and browser assertions use the bundled HTML, not a separate test implementation of the optics.

This execution environment's administrator blocks normal `file://` and HTTP navigation. Consequently, the browser suites inject the complete standalone document using `page.set_content`. The optics, WebGL, DOM interactions, workers, pointer/touch events, fullscreen, and generated downloads execute in Chromium, but direct file opening and real-origin disk persistence were **not** end-to-end tested here.

The new recovery/launch-reload UI tests use a **Storage-compatible in-memory model**, transferring its serialized contents to a fresh page to check restore behavior. Separate tests exercise a genuinely denied opaque-origin storage path and pure-model read/quota/corruption failures. This verifies storage logic and failure handling, not browser-specific durable persistence for a downloaded local file. Recovery availability depends on the user's browser, profile, permissions, and file location. Save JSON backups.

These checks are not cross-browser certification, GPU benchmarking, hardware validation, or optical-system calibration. Safari/Firefox, arbitrary operating systems, and long-duration or adversarial performance workloads were not tested. Geometric spot accuracy is not a claim of diffraction-limited fabricated hardware.

## Reproduction

Build with `node build.mjs`, then run `node --test tests/*.test.mjs`. Run each Python suite under Xvfb as shown in the README. Browser suites require Playwright, Pillow, and Chromium. Override `CHROMIUM_PATH` where necessary. The source contains the test code, JSON reports, and completed logs from this run. Historical V3/V4 guides are clearly separated in `docs/`.
