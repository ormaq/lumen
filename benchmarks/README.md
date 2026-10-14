# Optics benchmarks

Run `node benchmarks/optics.mjs` from the repository root. The benchmark traces
4,096 rays per source through a star telescope, a binary-star telescope, a lens,
a glass sphere with Fresnel branches, and a lens bench containing 80 objects.
It reports warmed median and 90th-percentile milliseconds per trace, plus ray,
segment, and hit counts. Rendering, file loading, and build time are excluded.

For a before/after comparison in PowerShell, save the original module before
editing it:

```powershell
Copy-Item src/optics.js "$env:TEMP/lumen-optics-baseline.mjs"
node benchmarks/optics.mjs --module "$env:TEMP/lumen-optics-baseline.mjs" --samples 15 --iterations 5
```

After editing, repeat with the current module. `--compare` checks that the entire
trace result exactly matches the saved implementation before measuring it:

```powershell
node benchmarks/optics.mjs --compare "$env:TEMP/lumen-optics-baseline.mjs" --samples 15 --iterations 5
```

## Recorded kernel optimization

Measured October 13, 2026, with Node v24.19.0 on Windows x64 and an AMD Ryzen 9
9950X3D. Each workload had three warmup traces followed by 15 samples of five
traces. These are local observations, not portable performance guarantees.

| Workload | Before median | After median | Time reduction |
| --- | ---: | ---: | ---: |
| Star | 13.754 ms | 10.224 ms | 26% |
| Binary star | 27.141 ms | 21.830 ms | 20% |
| Lens | 14.033 ms | 7.364 ms | 48% |
| Glass with Fresnel branches | 37.719 ms | 37.718 ms | Unchanged |
| Lens with 80 objects | 81.400 ms | 26.403 ms | 68% |

The changes remove temporary vectors from coordinate transforms and rejected
intersection candidates, avoid constructing hits beyond the nearest known
surface, reuse lens orientation frames, and calculate source-wide emission
constants once. All workloads retained identical ray, segment, and hit counts.
An additional comparison of 104 preset/geometry variants found exactly equal
complete trace outputs against the saved original module.

Run timings with other CPU-heavy work stopped, and repeat both versions before
drawing conclusions. Allocation-heavy glass traces showed more variation and
no consistent improvement. Tests check that source color conversion and lens
frame preparation stay constant as ray counts increase, along with nearest-hit
selection, coincident surfaces, path limits, and geometry edits. They do not use
flaky wall-clock pass/fail thresholds.
