# Pre-optimization reference

`optics.js` and `renderer.js` are verbatim snapshots of the working V5 source taken before this performance change, after the GitHub Pages packaging change. They are test fixtures, never shipped in either application bundle. Do not update them to make a performance or correctness check pass.

SHA-256:

- `optics.js`: `053d2e2a08a1bcca36ae6f998b36fa9890f900e53cf2de12ed35845fdd48e5d2`
- `renderer.js`: `f39fa0717c768175d268de10b9140395526b0a18cce680d3d92ae43bc8a3e7d1`

The Node benchmark compares complete traces from this kernel against the production kernel. The browser benchmark builds a reference application using these two modules with the current, otherwise identical application shell. The old renderer ignores the new optional cache-slot argument, preserving its previous upload-every-frame behavior. Both applications use the same controls, scene settings, ray samples, camera, shaders and image dimensions.
