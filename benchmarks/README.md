# Performance verification

Measured on October 17, 2026, on Windows x64, AMD Ryzen 9 9950X3D, Node 24.19.0. The baseline is the working V5 code saved immediately before optimization, not an older Git revision. Raw samples, environment and source hashes are in [before.json](before.json), [after.json](after.json) and [browser-results.json](browser-results.json).

## Changes

- Queued rays now use one consistent object layout instead of copying objects with spread syntax on each bounce. World-coordinate transforms produce one vector instead of several temporary vectors. The arithmetic and ray limits are unchanged.
- The editor retains core, glow and extension geometry in separate GPU buffers while animated dots continue to stream. Camera, scene and display changes replace the cached geometry. Empty geometry releases its buffer, and repeated camera changes reuse each slot.

## Tracing results

Nine alternating before/after rounds, after warmup, using three traces per sample (100 for the small default scene). Garbage collection runs before each measured batch when Node is invoked with `--expose-gc`; allocations and collections during tracing remain included. Values below are median milliseconds per complete trace.

| Scene | Before | After | Speedup |
|---|---:|---:|---:|
| Default focus, 37 rays | 0.176 | 0.132 | 1.33× |
| Focus, 16,384 rays | 91.97 | 69.37 | 1.33× |
| Binary stars, 32,768 rays | 207.54 | 166.45 | 1.25× |
| Splitter, 8,192 rays | 65.98 | 50.97 | 1.29× |
| Glass with Fresnel reflections, 4,096 rays | 63.63 | 51.88 | 1.23× |
| Corrected inverse mirror, 8,192 rays | 69.91 | 62.04 | 1.13× |
| Finite-source inverse mirror, 4,096 rays | 46.72 | 37.38 | 1.25× |
| Lens and 48 extra surfaces, 2,048 rays | 131.83 | 116.30 | 1.13× |

Geometric mean speedup: **1.24×**. Every complete trace matches the baseline exactly, including segment endpoints, normals, colors, detector hits, power, pruning and limit flags. The initial unchanged-code control run measured 0.96×, illustrating timing noise; it is not used to calculate the improvement.

## Browser results

48 checks passed in Edge/Chromium 155.0.4283.62 with ANGLE SwiftShader software WebGL, using the actual standalone HTML over local HTTP at a repository-style subpath. An 8,192-ray focus scene was sampled for at least 45 rendered animation frames per style, after loading and warmup.

| Style | Upload bytes/frame before | After | Reduction | Median frame JS time before → after |
|---|---:|---:|---:|---:|
| Clarity | 2,795,750 | 43,238 | 98.45% | 1.7 → 1.4 ms |
| Glow | 5,547,725 | 43,104 | 99.22% | 2.2 → 1.6 ms |
| Bounce with extensions | 3,998,093 | 42,970 | 98.93% | 1.9 → 1.8 ms |

Paused canvas screenshots match the baseline **pixel for pixel** in all three styles. Browser checks also cover worker/synchronous equality, camera invalidation, empty-scene cleanup, restored scenes, real-origin storage recovery, paused rendering, no external runtime assets, and the mobile worker-disabled fallback. A deterministic renderer test confirms one static upload for 120 frames instead of 120 uploads, with all 120 draws retained.

Upload byte counts measure actual WebGL API submissions. Frame timings measure JavaScript execution, not GPU completion or presentation latency. These are CPU and transfer improvements; they do not establish an FPS or battery-life improvement on every device. No visual quality or sample-count reduction is used. Browser timings are informational; the browser gate uses deterministic upload and correctness checks.

## Reproduce

```sh
npm run build
npm test
npm run test:performance
```

`npm test` includes exact baseline comparisons, all default presets, scene edits and caps, buffer invalidation/lifetime checks, and packaged HTML checks, alongside the existing optics and UI-model tests. Timing gates are kept in `test:performance`: at least 1.15× geometric mean speedup, and no workload more than 25% slower than the reference. Use a quiet machine. `BENCH_ROUNDS` can increase the default nine paired rounds; it must be at least five. `npm run bench` reports timings without enforcing thresholds.

The browser suite needs Python Playwright, Pillow, and a Chromium-family browser:

```sh
python -m pip install playwright pillow
npm run test:browser-performance
```

Set `CHROMIUM_PATH` to the browser executable, or install Playwright Chromium with `python -m playwright install chromium`. On Windows the new suite defaults to the standard Edge location. For the existing three browser suites, set `CHROMIUM_PATH` and `HEADLESS=1` to run without a visible browser or Xvfb.

This run installed test-only Python dependencies in the ignored `.test-deps` directory; in PowerShell, use `$env:PYTHONPATH=(Join-Path $PWD '.test-deps')` to reuse them. PowerShell environments that block `npm.ps1` can use `npm.cmd` for these commands. No runtime dependency was added to the app. Temporary reference HTML and screenshots go in the ignored `.performance` directory.
