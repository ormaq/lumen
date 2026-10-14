import { V, clamp } from './optics.js';

const BOUNCE_COLORS = [
  [0.42, 0.76, 1],
  [1, 0.72, 0.36],
  [0.6, 0.87, 0.65],
  [0.79, 0.64, 1],
  [1, 0.48, 0.6],
];
const QUAD_TRIANGLES = [0, 1, 2, 1, 3, 2];

/** Camera-facing ray ribbons. Display sampling never alters detector data. */
export function buildRayGeometry(
  segments,
  settings,
  cameraView,
  selectedSources = new Set(),
  isolateSource = null,
) {
  const core = [],
    glow = [],
    extensions = [],
    pixel = (2 * Math.tan(cameraView.fov / 2)) / cameraView.height;
  const quad = (out, a, b, wa, wb, c, aa, ab) => {
    const side = V.unit(V.cross(V.sub(b, a), cameraView.forward)),
      s = V.len(side) > 0.01 ? side : cameraView.right;
    const p = [
      V.sub(a, V.mul(s, wa)),
      V.add(a, V.mul(s, wa)),
      V.sub(b, V.mul(s, wb)),
      V.add(b, V.mul(s, wb)),
    ];
    for (const i of QUAD_TRIANGLES) out.push(...p[i], ...c, i < 2 ? aa : ab);
  };
  const eligible = segments.filter(
      (s) =>
        (!isolateSource || s.sourceId === isolateSource) &&
        (settings.rayStage !== 'interacted' || s.depth > 0),
    ),
    budget = settings.displayBudget || 24000,
    stride = Math.max(1, Math.ceil(eligible.length / budget)),
    groups = new Map();
  for (const s of eligible) {
    if (s.rayIndex % stride) continue;
    const key = s.sourceId + ':' + s.rayIndex;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const chosen = [];
  for (const path of groups.values()) {
    if (chosen.length + path.length > budget) continue;
    chosen.push(...path);
  }
  chosen.sort(
    (a, b) => a.depth - b.depth || a.rayIndex - b.rayIndex || a.sourceId.localeCompare(b.sourceId),
  );
  for (const s of chosen) {
    const da = cameraView.camera.orthographic
        ? cameraView.camera.radius
        : Math.max(0.01, V.dot(V.sub(s.a, cameraView.eye), cameraView.forward)),
      db = cameraView.camera.orthographic
        ? cameraView.camera.radius
        : Math.max(0.01, V.dot(V.sub(s.b, cameraView.eye), cameraView.forward)),
      dense = clamp(64 / Math.max(64, s.sampleCount / stride), 0.003, 1),
      emphasis = selectedSources.size && !selectedSources.has(s.sourceId) ? 0.24 : 1;
    const alpha = clamp(
        Math.pow(s.visual, 0.65) *
          settings.rayOpacity *
          (s.rayIndex === 0 ? Math.max(0.65, dense) : dense) *
          emphasis *
          (settings.starMode ? (s.depth === 0 ? 0.14 : 0.5) : 1),
        0.001,
        0.95,
      ),
      w = (s.rayIndex === 0 ? 0.82 : 0.49) * settings.rayWidth;
    const c =
      settings.rayStyle === 'bounce' ? BOUNCE_COLORS[s.depth % BOUNCE_COLORS.length] : s.color;
    quad(core, s.a, s.b, da * pixel * w, db * pixel * w, c, alpha, alpha * (s.terminal ? 0.45 : 1));
    if (settings.rayStyle === 'glow')
      quad(
        glow,
        s.a,
        s.b,
        da * pixel * 3.1,
        db * pixel * 3.1,
        c,
        alpha * 0.05,
        alpha * (s.terminal ? 0.01 : 0.05),
      );
    if (
      settings.extensions &&
      s.depth > 0 &&
      s.kind !== 'transmitted' &&
      extensions.length < 300000
    ) {
      const d = V.unit(V.sub(s.a, s.b));
      for (let t = 0.12; t < 5; t += 0.25) {
        const a = V.add(s.a, V.mul(d, t)),
          b = V.add(s.a, V.mul(d, t + 0.11));
        quad(
          extensions,
          a,
          b,
          da * pixel * 0.36,
          da * pixel * 0.36,
          [0.54, 0.67, 0.76],
          0.16,
          0.16,
        );
      }
    }
  }
  return {
    eligibleCount: eligible.length,
    core: new Float32Array(core),
    glow: new Float32Array(glow),
    extensions: new Float32Array(extensions),
    chosen,
  };
}
