/** Lumen 3 · deterministic, dependency-free geometric optics.
 * Right-handed, Y-up; lengths and powers use arbitrary consistent units.
 * Curved intersections are analytical, independent of the display meshes.
 */
export const EPS = 1e-6;
export const POSITION_LIMIT = 1_000_000;
export const MAX_SOURCE_RAYS = 16_384;
export const MAX_TOTAL_RAYS = 65_536;
export const SEGMENT_BUDGET = 100_000;
const newSceneId = () =>
  globalThis.crypto?.randomUUID?.() ||
  'scene-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const V = {
  add: (a, b) => a.map((v, i) => v + b[i]),
  sub: (a, b) => a.map((v, i) => v - b[i]),
  mul: (a, s) => a.map((v) => v * s),
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  len: (a) => Math.hypot(...a),
  unit(a) {
    const l = Math.hypot(...a);
    return l > 1e-12 ? a.map((v) => v / l) : [0, 0, 0];
  },
  mix: (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
};
export const CATALOG = {
  star: {
    label: 'Distant star',
    group: 'Light sources',
    icon: 'star',
    description: 'A sampled wavefront from infinity, with field angle and angular size.',
  },
  laser: {
    label: 'Single ray',
    group: 'Light sources',
    icon: 'ray',
    description: 'One precisely aimed ray.',
  },
  beam: {
    label: 'Parallel beam',
    group: 'Light sources',
    icon: 'beam',
    description: 'A circular bundle of parallel or divergent rays.',
  },
  point: {
    label: 'Point source',
    group: 'Light sources',
    icon: 'sun',
    description: 'Light emitted in all directions in 3D.',
  },
  spot: {
    label: 'Spot source',
    group: 'Light sources',
    icon: 'spot',
    description: 'A solid-angle cone from a single point.',
  },
  fan: {
    label: 'Fan source',
    group: 'Light sources',
    icon: 'fan',
    description: 'A planar fan; rotate its emission plane in 3D.',
  },
  line: {
    label: 'Line source',
    group: 'Light sources',
    icon: 'line',
    description: 'A line of parallel or spreading emitters.',
  },
  area: {
    label: 'Area source',
    group: 'Light sources',
    icon: 'area',
    description: 'A rectangular grid of directional emitters.',
  },
  mirror: {
    label: 'Flat mirror',
    group: 'Mirrors',
    icon: 'mirror',
    description: 'A finite, two-sided reflective plane.',
  },
  parabola: {
    label: 'Parabolic dish',
    group: 'Mirrors',
    icon: 'dish',
    description: 'A true paraboloid with an adjustable point focus.',
  },
  trough: {
    label: 'Parabolic trough',
    group: 'Mirrors',
    icon: 'trough',
    description: 'A parabolic cylinder with a line focus.',
  },
  spherical: {
    label: 'Spherical mirror',
    group: 'Mirrors',
    icon: 'curved',
    description: 'A concave or convex spherical cap.',
  },
  splitter: {
    label: 'Beam splitter',
    group: 'Optics',
    icon: 'split',
    description: 'Split power into reflected and transmitted branches.',
  },
  lens: {
    label: 'Ideal thin lens',
    group: 'Optics',
    icon: 'lens',
    description: 'A paraxial converging or diverging lens.',
  },
  glass: {
    label: 'Glass sphere',
    group: 'Optics',
    icon: 'glass',
    description: 'Snell refraction, total internal reflection, optional Fresnel branches.',
  },
  blocker: {
    label: 'Blocker',
    group: 'Screens & tools',
    icon: 'block',
    description: 'Absorb rays at a finite opaque screen.',
  },
  aperture: {
    label: 'Aperture',
    group: 'Screens & tools',
    icon: 'aperture',
    description: 'An opaque plate with a circular opening.',
  },
  detector: {
    label: 'Detector',
    group: 'Screens & tools',
    icon: 'detector',
    description: 'Measure sampled ray hits and incident power.',
  },
};
export const isSource = (o) => !!o && CATALOG[o.type]?.group === 'Light sources';
export const isMirror = (o) => !!o && CATALOG[o.type]?.group === 'Mirrors';
export function basis(o) {
  const y = rad(o.yaw || 0),
    t = rad(o.tilt || 0),
    r = rad(o.roll || 0);
  const n = [Math.sin(y) * Math.cos(t), Math.sin(t), Math.cos(y) * Math.cos(t)],
    u = [Math.cos(y), 0, -Math.sin(y)],
    v = V.cross(n, u);
  return {
    n,
    u: V.add(V.mul(u, Math.cos(r)), V.mul(v, Math.sin(r))),
    v: V.sub(V.mul(v, Math.cos(r)), V.mul(u, Math.sin(r))),
  };
}
export function localVec(p, b) {
  return [V.dot(p, b.u), V.dot(p, b.v), V.dot(p, b.n)];
}
export function worldVec(p, b) {
  // Expand the matrix product to avoid five temporary vectors per transform.
  return [
    b.u[0] * p[0] + b.v[0] * p[1] + b.n[0] * p[2],
    b.u[1] * p[0] + b.v[1] * p[1] + b.n[1] * p[2],
    b.u[2] * p[0] + b.v[2] * p[1] + b.n[2] * p[2],
  ];
}
export function aim(o, target) {
  if (V.len(V.sub(target, o.p)) < EPS) return o;
  const n = V.unit(V.sub(target, o.p));
  o.yaw = deg(Math.atan2(n[0], n[2]));
  o.tilt = deg(Math.asin(clamp(n[1], -1, 1)));
  return o;
}
export function reflect(d, n) {
  return V.unit(V.sub(d, V.mul(n, 2 * V.dot(d, n))));
}
/** n faces the incident medium. Returns null for total internal reflection. */
export function refract(d, n, eta) {
  const cosI = clamp(-V.dot(d, n), 0, 1),
    k = 1 - eta * eta * (1 - cosI * cosI);
  return k < 0
    ? null
    : V.unit(V.add(V.mul(d, eta), V.mul(n, eta * cosI - Math.sqrt(Math.max(0, k)))));
}
export function fresnel(cosI, n1, n2) {
  const sinT2 = (n1 / n2) ** 2 * (1 - cosI * cosI);
  if (sinT2 >= 1) return 1;
  const cosT = Math.sqrt(1 - sinT2);
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT),
    rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT);
  return (rs * rs + rp * rp) / 2;
}
export function quadratic(a, b, c) {
  if (Math.abs(a) < 1e-12) return Math.abs(b) < 1e-12 ? [] : [-c / b];
  const disc = b * b - 4 * a * c;
  if (disc < -1e-10) return [];
  const sd = Math.sqrt(Math.max(0, disc)),
    q = -0.5 * (b + (b >= 0 ? sd : -sd));
  if (Math.abs(q) < 1e-14) return [-b / (2 * a)];
  return [q / a, c / q].sort((x, y) => x - y);
}
export function createObject(type, id = 'o1', p = [0, 3, 0]) {
  if (!CATALOG[type]) throw new Error('Unknown component type.');
  const common = {
    id,
    name: CATALOG[type].label,
    type,
    enabled: true,
    locked: false,
    p: [...p],
    yaw: isSource({ type }) ? 90 : -90,
    tilt: 0,
    roll: 0,
  };
  if (isSource(common))
    return {
      ...common,
      aimTarget: null,
      fieldX: 0,
      fieldY: 0,
      angularDiameter: 0,
      color: '#ffbf69',
      colorMode: 'rgb',
      wavelength: 590,
      power: 1,
      count: type === 'laser' ? 1 : type === 'star' ? 768 : type === 'point' ? 192 : 61,
      aperture: 1.2,
      spread: type === 'spot' ? 30 : type === 'fan' ? 50 : 0,
      width: 3,
      height: 2,
    };
  return {
    ...common,
    width: 3,
    height: 3,
    diameter: 4.8,
    focalLength: 3,
    radius: type === 'glass' ? 1.6 : 6,
    curvature: 'concave',
    reflectivity: 1,
    ratio: 0.5,
    transmission: 1,
    ior: 1.5,
    dispersion: 0,
    fresnel: false,
    hole: 1.2,
    absorb: true,
    minDepth: 0,
  };
}
export function surfaceZ(o, x, y) {
  if (o.type === 'parabola') return (x * x + y * y) / (4 * o.focalLength);
  if (o.type === 'trough') return (x * x) / (4 * o.focalLength);
  if (o.type === 'spherical') {
    const s = o.curvature === 'convex' ? -1 : 1,
      R = o.radius;
    return s * (R - Math.sqrt(Math.max(0, R * R - x * x - y * y)));
  }
  return 0;
}
export function surfaceNormal(o, x, y) {
  if (o.type === 'parabola') return V.unit([-x / (2 * o.focalLength), -y / (2 * o.focalLength), 1]);
  if (o.type === 'trough') return V.unit([-x / (2 * o.focalLength), 0, 1]);
  if (o.type === 'spherical') {
    const s = o.curvature === 'convex' ? -1 : 1;
    return V.unit([-s * x, -s * y, Math.sqrt(Math.max(0, o.radius * o.radius - x * x - y * y))]);
  }
  return [0, 0, 1];
}
/** Finite optical surface intersection; t is distance for a unit ray. */
export function intersect(origin, direction, o, frame = null) {
  if (!o.enabled || isSource(o)) return null;
  return intersectSurface(origin, direction, o, frame || basis(o), Infinity);
}

/** The tracer supplies a cached frame and the nearest distance already found.
 * Misses and occluded candidates need no vectors, normals, or hit records.
 */
function intersectSurface(origin, direction, o, b, maxDistance) {
  const offsetX = origin[0] - o.p[0],
    offsetY = origin[1] - o.p[1],
    offsetZ = origin[2] - o.p[2];
  const px = offsetX * b.u[0] + offsetY * b.u[1] + offsetZ * b.u[2];
  const py = offsetX * b.v[0] + offsetY * b.v[1] + offsetZ * b.v[2];
  const pz = offsetX * b.n[0] + offsetY * b.n[1] + offsetZ * b.n[2];
  const dx = V.dot(direction, b.u),
    dy = V.dot(direction, b.v),
    dz = V.dot(direction, b.n);
  let ts = [];
  if (o.type === 'glass')
    ts = quadratic(
      dx * dx + dy * dy + dz * dz,
      2 * (px * dx + py * dy + pz * dz),
      px * px + py * py + pz * pz - o.radius * o.radius,
    );
  else if (o.type === 'parabola' || o.type === 'trough') {
    const q = o.type === 'trough' ? 0 : 1,
      f = o.focalLength;
    ts = quadratic(
      dx * dx + q * dy * dy,
      2 * (px * dx + q * py * dy) - 4 * f * dz,
      px * px + q * py * py - 4 * f * pz,
    );
  } else if (o.type === 'spherical') {
    const R = o.radius * (o.curvature === 'convex' ? -1 : 1),
      z = pz - R;
    ts = quadratic(
      dx * dx + dy * dy + dz * dz,
      2 * (px * dx + py * dy + z * dz),
      px * px + py * py + z * z - R * R,
    );
  } else if (Math.abs(dz) > EPS) ts = [-pz / dz];
  const circular = o.type === 'parabola' || o.type === 'spherical' || o.type === 'lens';
  for (const t of ts) {
    if (t <= EPS || t >= maxDistance) continue;
    const x = px + dx * t,
      y = py + dy * t,
      z = pz + dz * t;
    if (circular && x * x + y * y > (o.diameter / 2) ** 2 + EPS) continue;
    if (o.type === 'spherical') {
      const R = o.radius * (o.curvature === 'convex' ? -1 : 1);
      if (R > 0 ? z > R + EPS : z < R - EPS) continue;
    }
    if (
      !circular &&
      o.type !== 'glass' &&
      (Math.abs(x) > o.width / 2 + EPS || Math.abs(y) > o.height / 2 + EPS)
    )
      continue;
    if (o.type === 'aperture' && x * x + y * y < (o.hole / 2) ** 2 - EPS) continue;
    const local = [x, y, z];
    const normal = worldVec(o.type === 'glass' ? V.unit(local) : surfaceNormal(o, x, y), b);
    return { t, point: V.add(origin, V.mul(direction, t)), normal, local, object: o };
  }
  return null;
}
export const BOUNDS = { min: [-22, -10, -22], max: [22, 26, 22] };
export function boundaryDistance(p, d, bounds = BOUNDS) {
  let near = -Infinity,
    far = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < EPS) {
      if (p[i] < bounds.min[i] || p[i] > bounds.max[i]) return 0;
      continue;
    }
    let a = (bounds.min[i] - p[i]) / d[i],
      b = (bounds.max[i] - p[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
  }
  return far < Math.max(near, 0) ? 0 : Math.max(0, far);
}
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** Display-only approximation, not a spectral colorimetry implementation. */
export function wavelengthRGB(w) {
  let c =
    w < 440
      ? [(440 - w) / 60, 0, 1]
      : w < 490
        ? [0, (w - 440) / 50, 1]
        : w < 510
          ? [0, 1, (510 - w) / 20]
          : w < 580
            ? [(w - 510) / 70, 1, 0]
            : w < 645
              ? [1, (645 - w) / 65, 0]
              : [1, 0, 0];
  const f = w < 420 ? 0.3 + (0.7 * (w - 380)) / 40 : w > 700 ? 0.3 + (0.7 * (780 - w)) / 80 : 1;
  return c.map((x) => Math.pow(clamp(x * f, 0, 1), 0.75));
}
export const sourceColor = (s) =>
  s.colorMode === 'wavelength' ? wavelengthRGB(s.wavelength) : rgb(s.color);
/** Deterministic samples; each carries an equal fraction of source power. */
/** Resolve aim constraints before tracing/editing. A missing target releases the lock.
 * Coincident centers retain the last valid direction. Transform lock is independent.
 */
export function syncAimLocks(scene) {
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  for (const s of scene.objects) {
    if (!isSource(s)) continue;
    s.aimDistance = 0;
    if (!s.aimTarget) continue;
    const target = byId.get(s.aimTarget);
    if (!target || target.id === s.id) {
      s.aimTarget = null;
      continue;
    }
    aim(s, target.p);
    s.aimDistance = V.len(V.sub(target.p, s.p));
  }
  return scene;
}
export function requestedSamples(s, density = 1) {
  return s.enabled && s.power > 0
    ? s.type === 'laser'
      ? 1
      : clamp(Math.round(s.count * density), 1, MAX_SOURCE_RAYS)
    : 0;
}
function radicalInverse(index, base) {
  let out = 0,
    f = 1 / base;
  while (index > 0) {
    out += (index % base) * f;
    index = Math.floor(index / base);
    f /= base;
  }
  return out;
}
export function emit(s, density = 1, sampleLimit = MAX_SOURCE_RAYS) {
  if (!s.enabled || s.power <= 0) return [];
  const b = basis(s),
    N = Math.min(requestedSamples(s, density), Math.max(1, sampleLimit)),
    out = [],
    ga = 2.399963229728653;
  // These depend on the source, not on the sample. Each ray still owns its color.
  const color = sourceColor(s),
    spread = rad(s.spread),
    tanSpread = Math.tan(spread),
    cosSpread = Math.cos(spread);
  const fieldX = Math.tan(rad(s.fieldX || 0)),
    fieldY = Math.tan(rad(s.fieldY || 0)),
    angularRadius = Math.tan(rad((s.angularDiameter || 0) / 7200));
  const cols = Math.ceil(Math.sqrt((N * s.width) / Math.max(0.1, s.height))),
    rows = Math.ceil(N / cols);
  for (let i = 0; i < N; i++) {
    let pos = [0, 0, 0],
      dir = [0, 0, 1];
    const r = i === 0 || N === 1 ? 0 : Math.sqrt(i / (N - 1)),
      a = i * ga,
      x = r * Math.cos(a),
      y = r * Math.sin(a),
      q = N === 1 ? 0 : (i / (N - 1)) * 2 - 1;
    if (s.type === 'star') {
      // A finite entrance sampling plane represents a star at infinity, not its distance.
      // Pupil and angular-disc samples use independent low-discrepancy sequences.
      pos = [(x * s.aperture) / 2, (y * s.aperture) / 2, 0];
      const ar = angularRadius * Math.sqrt(radicalInverse(i + 1, 2)),
        aa = 2 * Math.PI * radicalInverse(i + 1, 3);
      dir = V.unit([fieldX + ar * Math.cos(aa), fieldY + ar * Math.sin(aa), 1]);
      // When target-locked, sample the same pupil at the target vertex plane.
      // Moving the launch plane must not invent field-dependent vignetting.
      if (s.aimDistance > 0) {
        pos[0] -= (dir[0] / dir[2]) * s.aimDistance;
        pos[1] -= (dir[1] / dir[2]) * s.aimDistance;
      }
    } else if (s.type === 'point') {
      const z = 1 - (2 * (i + 0.5)) / N,
        t = Math.sqrt(1 - z * z);
      dir = [t * Math.cos(a), t * Math.sin(a), z];
    } else if (s.type === 'spot') {
      const cos = 1 - (i === 0 || N === 1 ? 0 : i / (N - 1)) * (1 - cosSpread),
        sn = Math.sqrt(Math.max(0, 1 - cos * cos));
      dir = [sn * Math.cos(a), sn * Math.sin(a), cos];
    } else if (s.type === 'fan') {
      const t = rad(q * s.spread);
      dir = [Math.sin(t), 0, Math.cos(t)];
    } else if (s.type === 'line') {
      pos = [(q * s.width) / 2, 0, 0];
      dir = V.unit([Math.tan(rad(q * s.spread)), 0, 1]);
    } else if (s.type === 'area') {
      const xx = cols === 1 ? 0 : (i % cols) / (cols - 1) - 0.5,
        yy = rows === 1 ? 0 : Math.floor(i / cols) / (rows - 1) - 0.5;
      pos = [xx * s.width, yy * s.height, 0];
      dir = V.unit([xx * 2 * tanSpread, yy * 2 * tanSpread, 1]);
    } else if (s.type === 'beam') {
      pos = [(x * s.aperture) / 2, (y * s.aperture) / 2, 0];
      dir = V.unit([x * tanSpread, y * tanSpread, 1]);
    }
    out.push({
      p: V.add(s.p, worldVec(pos, b)),
      d: worldVec(dir, b),
      energy: s.power / N,
      visual: s.power,
      color: color.slice(),
      wavelength: s.colorMode === 'wavelength' ? s.wavelength : 550,
      sourceId: s.id,
      rayIndex: i,
      sampleCount: N,
    });
  }
  return out;
}
export function focalPoints(o) {
  const b = basis(o);
  if (o.type === 'parabola' || o.type === 'trough') return [V.add(o.p, V.mul(b.n, o.focalLength))];
  if (o.type === 'spherical')
    return [V.add(o.p, V.mul(b.n, (o.radius / 2) * (o.curvature === 'convex' ? -1 : 1)))];
  if (o.type === 'lens') return [-1, 1].map((s) => V.add(o.p, V.mul(b.n, s * o.focalLength)));
  return [];
}
export function traceScene(scene) {
  syncAimLocks(scene);
  const settings = scene.settings,
    surfaces = scene.objects.filter((o) => !isSource(o) && o.enabled),
    frames = surfaces.map(basis),
    sources = scene.objects.filter(isSource);
  const requested = sources.map((s) => requestedSamples(s, settings.density)),
    requestedTotal = requested.reduce((a, b) => a + b, 0),
    scale = Math.min(1, MAX_TOTAL_RAYS / Math.max(1, requestedTotal));
  const seeds = sources.flatMap((s, i) =>
    requested[i] ? emit(s, settings.density, Math.max(1, Math.floor(requested[i] * scale))) : [],
  );
  const segments = [],
    hits = [],
    detectors = {};
  for (const o of surfaces)
    if (o.type === 'detector') detectors[o.id] = { hits: [], power: 0, count: 0 };
  const budget = clamp(settings.segmentBudget || SEGMENT_BUDGET, 1, SEGMENT_BUDGET),
    queue = seeds.map((r) => ({ ...r, depth: 0, startLength: 0, relative: 1, kind: 'emitted' }));
  let index = 0,
    limited = false,
    prunedPower = 0;
  while (index < queue.length && segments.length < budget) {
    const r = queue[index++];
    if (r.relative < 0.003 || r.energy < 1e-10) {
      prunedPower += r.energy;
      continue;
    }
    let distance = Math.max(0, settings.maxDistance - r.startLength),
      hit = null,
      hitFrame = null;
    for (let si = 0; si < surfaces.length; si++) {
      const o = surfaces[si];
      if (o.type === 'detector' && r.depth < (o.minDepth || 0)) continue;
      const h = intersectSurface(r.p, r.d, o, frames[si], distance);
      if (h && h.t < distance) {
        distance = h.t;
        hit = h;
        hitFrame = frames[si];
      }
    }
    if (distance < EPS) continue;
    const end = V.add(r.p, V.mul(r.d, distance));
    segments.push({
      a: r.p,
      b: end,
      energy: r.energy,
      visual: r.visual * r.relative,
      color: r.color,
      sourceId: r.sourceId,
      rayIndex: r.rayIndex,
      sampleCount: r.sampleCount,
      startLength: r.startLength,
      length: distance,
      depth: r.depth,
      kind: r.kind,
      terminal: !hit,
    });
    if (!hit) continue;
    const o = hit.object,
      entering = V.dot(r.d, hit.normal) < 0,
      n = entering ? hit.normal : V.mul(hit.normal, -1),
      cos = clamp(-V.dot(r.d, n), 0, 1);
    const record = {
      objectId: o.id,
      sourceId: r.sourceId,
      rayIndex: r.rayIndex,
      point: end,
      normal: n,
      local: hit.local,
      incoming: r.d,
      incidence: deg(Math.acos(cos)),
      energy: r.energy,
      wavelength: r.wavelength,
      color: r.color,
      type: o.type,
      depth: r.depth,
    };
    hits.push(record);
    if (o.type === 'detector') {
      const det = detectors[o.id];
      det.hits.push(record);
      det.count++;
      det.power += r.energy;
      if (o.absorb) continue;
    }
    if (o.type === 'blocker' || o.type === 'aperture') continue;
    if (r.depth >= settings.maxBounces) {
      limited = true;
      continue;
    }
    const push = (d, factor, kind) => {
      if (factor <= 0) return;
      queue.push({
        ...r,
        p: V.add(end, V.mul(d, EPS * 8)),
        d,
        energy: r.energy * factor,
        relative: r.relative * factor,
        depth: r.depth + 1,
        startLength: r.startLength + distance,
        kind,
      });
    };
    if (o.type === 'detector') {
      push(r.d, 1, 'transmitted');
      continue;
    }
    if (o.type === 'splitter') {
      const rd = reflect(r.d, n);
      record.outgoing = rd;
      record.reflection = deg(Math.acos(clamp(V.dot(rd, n), -1, 1)));
      push(rd, o.ratio, 'reflected');
      push(r.d, 1 - o.ratio, 'transmitted');
    } else if (o.type === 'lens') {
      const b = hitFrame,
        ld = localVec(r.d, b),
        z = Math.max(EPS, Math.abs(ld[2]));
      const outgoing = worldVec(
        V.unit([
          ld[0] / z - hit.local[0] / o.focalLength,
          ld[1] / z - hit.local[1] / o.focalLength,
          Math.sign(ld[2]),
        ]),
        b,
      );
      record.outgoing = outgoing;
      push(outgoing, o.transmission, 'refracted');
    } else if (o.type === 'glass') {
      // Each sphere is bounded by air. Overlapping/nested dielectric volumes are unsupported.
      const ior = clamp(
          o.ior + o.dispersion * (1 / (r.wavelength / 1000) ** 2 - 1 / 0.55 ** 2),
          1.001,
          2.8,
        ),
        n1 = entering ? 1 : ior,
        n2 = entering ? ior : 1,
        td = refract(r.d, n, n1 / n2);
      const R = td ? (o.fresnel ? fresnel(cos, n1, n2) : 0) : 1;
      record.tir = !td;
      record.outgoing = td || reflect(r.d, n);
      record.refraction = td ? deg(Math.acos(clamp(-V.dot(td, n), -1, 1))) : null;
      if (td) push(td, (1 - R) * o.transmission, 'refracted');
      if (R > 0) push(reflect(r.d, n), R, 'reflected');
    } else {
      const rd = reflect(r.d, n);
      record.outgoing = rd;
      record.reflection = deg(Math.acos(clamp(V.dot(rd, n), -1, 1)));
      push(rd, o.reflectivity, 'reflected');
    }
  }
  if (index < queue.length) limited = true;
  return {
    segments,
    hits,
    detectors,
    seeds: seeds.length,
    emittedPower: seeds.reduce((n, r) => n + r.energy, 0),
    limited,
    prunedPower,
    requestedSeeds: requestedTotal,
    seedLimited: scale < 1,
  };
}
export const PRESETS = {
  star: {
    title: 'Star at infinity',
    subtitle: 'A distant star, a parabolic primary, and a virtual focal plane.',
    icon: 'star',
  },
  coma: {
    title: 'Off-axis star',
    subtitle: 'See geometric coma as a star moves off the optical axis.',
    icon: 'star',
  },
  binary: {
    title: 'Double-star field',
    subtitle: 'Two colored stars, one telescope, and two focal spots.',
    icon: 'star',
  },
  focus: {
    title: 'Parabolic focus',
    subtitle: 'Parallel rays meet at a true 3D focus.',
    icon: 'dish',
  },
  collimator: {
    title: 'Point to parallel',
    subtitle: 'Put a source at the focus; the dish collimates it.',
    icon: 'spot',
  },
  trough: {
    title: 'A line of light',
    subtitle: 'A parabolic trough focuses in one dimension.',
    icon: 'trough',
  },
  splitter: {
    title: 'Split & steer',
    subtitle: 'A splitter divides one beam into two paths.',
    icon: 'split',
  },
  rgb: {
    title: 'RGB light lab',
    subtitle: 'Three independently colored sources meet on a detector.',
    icon: 'sun',
  },
  lens: {
    title: 'Lens bench',
    subtitle: 'A converging ideal thin lens brings a beam to focus.',
    icon: 'lens',
  },
  glass: {
    title: 'Through the glass',
    subtitle: 'Follow refraction at the two surfaces of a sphere.',
    icon: 'glass',
  },
  spherical: {
    title: 'Spherical aberration',
    subtitle: 'Spherical mirrors do not have one exact focus.',
    icon: 'curved',
  },
  relay: {
    title: 'Up & over',
    subtitle: 'Three mirrors turn a beam through three dimensions.',
    icon: 'mirror',
  },
  empty: {
    title: 'Empty workbench',
    subtitle: 'Add sources and optics to build your own experiment.',
    icon: 'plus',
  },
};
function mirrorPath(id, p, before, after) {
  const o = createObject('mirror', id, p),
    n = V.unit(V.sub(V.unit(V.sub(p, before)), V.unit(V.sub(after, p))));
  o.yaw = deg(Math.atan2(n[0], n[2]));
  o.tilt = deg(Math.asin(n[1]));
  return o;
}
export function createPreset(name = 'focus') {
  if (!PRESETS[name]) name = 'focus';
  let objects = [];
  const add = (t, p, props = {}) => {
    const o = { ...createObject(t, 'o' + (objects.length + 1), p), ...props };
    objects.push(o);
    return o;
  };
  if (['star', 'coma', 'binary'].includes(name)) {
    const base = {
      name: 'Distant star',
      p: [0, 144, 0],
      yaw: 0,
      tilt: -90,
      aperture: 3.8,
      count: 768,
      color: '#91caff',
      aimTarget: 'o2',
      fieldX: name === 'coma' ? 1.2 : 0,
    };
    add('star', base.p, base);
    add('parabola', [0, 120, 0], {
      name: 'Primary mirror',
      yaw: 0,
      tilt: 90,
      diameter: 4,
      focalLength: 12,
    });
    add('detector', [0, 132, 0], {
      name: 'Virtual focal plane',
      yaw: 0,
      tilt: 90,
      width: 1.5,
      height: 1.5,
      minDepth: 1,
      absorb: true,
    });
    if (name === 'binary') {
      objects[0].name = 'Star A';
      objects[0].fieldX = -0.08;
      add('star', base.p, { ...base, id: 'o4', name: 'Star B', color: '#ffc27a', fieldX: 0.08 });
    }
  } else if (name === 'focus' || name === 'spherical') {
    add('beam', [-6, 3, 0], { name: 'Amber beam', aperture: 4.0, count: 37 });
    add(name === 'focus' ? 'parabola' : 'spherical', [4, 3, 0], {
      name: name === 'focus' ? 'Parabolic reflector' : 'Spherical reflector',
      diameter: 5,
      focalLength: 3,
      radius: 6,
    });
  } else if (name === 'collimator') {
    add('spot', [1, 3, 0], { name: 'Source at focus', spread: 34, count: 61, color: '#79dcb5' });
    add('parabola', [4, 3, 0], { name: 'Collimating dish', diameter: 5 });
  } else if (name === 'trough') {
    add('area', [-6, 3, 0], {
      width: 4.3,
      height: 3.6,
      count: 49,
      name: 'Rectangular beam',
      color: '#80c7ff',
    });
    add('trough', [4, 3, 0], { name: 'Parabolic trough', width: 5, height: 4.4 });
  } else if (name === 'splitter') {
    add('beam', [-6, 3, 1.5], { aperture: 0.55, count: 13, name: 'Input beam', color: '#75dcb4' });
    add('splitter', [-1, 3, 1.5], { yaw: 45, width: 3, height: 3, name: 'Beam splitter' });
    add('detector', [6, 3, 1.5], { width: 3, height: 3, name: 'Transmission screen' });
    add('detector', [-1, 3, -5.5], { yaw: 0, width: 3, height: 3, name: 'Reflection screen' });
  } else if (name === 'rgb') {
    const target = [4, 3, 0];
    for (const [i, color] of ['#ff6575', '#70e5a7', '#6bafff'].entries())
      aim(
        add('beam', [-6, 3 + (i === 1 ? 1.8 : -0.6), (i - 1) * 3.2], {
          color,
          aperture: 0.45,
          count: 13,
          name: ['Red source', 'Green source', 'Blue source'][i],
        }),
        target,
      );
    add('detector', target, { name: 'Color screen', width: 6, height: 5 });
  } else if (name === 'lens') {
    add('beam', [-6, 3, 0], { aperture: 3.6, count: 49, color: '#80c7ff', name: 'Parallel input' });
    add('lens', [0, 3, 0], { diameter: 4.5, focalLength: 3, name: 'Converging lens' });
    add('detector', [5.6, 3, 0], { width: 4, height: 4, name: 'Image screen' });
  } else if (name === 'glass') {
    add('beam', [-6, 3, 0], {
      aperture: 2.7,
      count: 49,
      colorMode: 'wavelength',
      wavelength: 510,
      name: 'Green beam',
    });
    add('glass', [0, 3, 0], { radius: 1.9, ior: 1.5, name: 'Glass sphere' });
    add('detector', [6, 3, 0], { width: 5, height: 5, name: 'Caustic screen' });
  } else if (name === 'relay') {
    const s = add('beam', [-6, 1.6, 2.5], {
        aperture: 0.3,
        count: 7,
        name: 'Violet beam',
        color: '#bc9fff',
      }),
      a = [-1.8, 1.6, 2.5],
      b = [-1.8, 5, -2.5],
      c = [4, 5, -2.5];
    objects.push(
      mirrorPath('o2', a, s.p, b),
      mirrorPath('o3', b, a, c),
      mirrorPath('o4', c, b, [4, 1, 6]),
    );
    objects.slice(1).forEach((o, i) => (o.name = 'Relay mirror ' + (i + 1)));
  }
  const stellar = ['star', 'coma', 'binary'].includes(name);
  return {
    version: 3,
    uid: newSceneId(),
    name: PRESETS[name].title,
    preset: name,
    objects,
    settings: {
      maxBounces: 12,
      maxDistance: stellar ? 60 : ['focus', 'spherical', 'trough'].includes(name) ? 18 : 30,
      density: 1,
      normals: false,
      grid: !stellar,
      animate: false,
      labels: false,
      foci: true,
      glow: false,
      extensions: false,
      snap: false,
      starMode: stellar,
      mmPerUnit: 50,
      primaryId: stellar ? 'o2' : null,
      detectorId: stellar ? 'o3' : null,
      airyReference: true,
      spotAutoFit: true,
      rayStyle: 'clarity',
      rayStage: 'all',
      rayOpacity: 0.82,
      rayWidth: 1,
      displayBudget: 24000,
      showMeasurements: false,
    },
  };
}
const finite = (x, min, max, label) => {
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new Error('Invalid ' + label + '.');
  return clamp(x, min, max);
};
export function validateScene(raw) {
  if (raw?.version === 1 && raw.source && Array.isArray(raw.mirrors)) {
    const s = raw.source,
      scene = createPreset('empty');
    scene.name = 'Imported v1 scene';
    scene.objects = [
      {
        ...createObject(s.mode === 'single' ? 'laser' : 'beam', 'o1', s.p),
        yaw: 90 - s.yaw,
        tilt: s.pitch,
        aperture: s.aperture,
        spread: s.spread,
        count: s.count,
      },
      ...raw.mirrors.map((m, i) => ({
        ...createObject('mirror', 'o' + (i + 2), m.p),
        ...m,
        id: 'o' + (i + 2),
        name: 'Mirror ' + (i + 1),
      })),
    ];
    scene.settings = { ...scene.settings, ...raw.settings };
    return validateScene(scene);
  }
  if (
    !raw ||
    ![2, 3].includes(raw.version) ||
    !Array.isArray(raw.objects) ||
    raw.objects.length > 80
  )
    throw new Error('Choose a Lumen scene JSON file (up to 80 objects).');
  const ids = new Set(),
    idMap = new Map(),
    scene = createPreset('empty');
  raw.objects.forEach((o, i) => {
    const old = String(o?.id || 'o' + (i + 1));
    if (idMap.has(old)) throw new Error('Duplicate object identifiers.');
    idMap.set(old, 'o' + (i + 1));
  });
  scene.uid = typeof raw.uid === 'string' ? raw.uid.slice(0, 100) : scene.uid;
  scene.name = String(raw.name || 'Untitled scene').slice(0, 80);
  scene.preset = PRESETS[raw.preset] ? raw.preset : 'empty';
  scene.objects = raw.objects.map((r, i) => {
    if (!r || !CATALOG[r.type]) throw new Error('Unsupported optical component.');
    if (!Array.isArray(r.p) || r.p.length !== 3) throw new Error('Invalid object position.');
    const id = 'o' + (i + 1),
      o = createObject(
        r.type,
        id,
        r.p.map((v, j) => finite(v, -POSITION_LIMIT, POSITION_LIMIT, 'position')),
      );
    ids.add(id);
    o.name = String(r.name || CATALOG[r.type].label).slice(0, 60);
    o.enabled = r.enabled !== false;
    o.locked = r.locked === true;
    for (const key of ['yaw', 'tilt', 'roll'])
      o[key] = finite(r[key] ?? o[key], -180, 180, 'orientation');
    const fields = isSource(o)
      ? {
          count: [1, 16384],
          power: [0, 5],
          aperture: [0, 10000],
          spread: [0, 89],
          width: [0.1, 10000],
          height: [0.1, 10000],
          wavelength: [380, 780],
          fieldX: [-30, 30],
          fieldY: [-30, 30],
          angularDiameter: [0, 3600],
        }
      : {
          width: [0.01, 10000],
          height: [0.01, 10000],
          diameter: [0.1, 10000],
          focalLength: [-10000, 10000],
          radius: [0.15, 20000],
          reflectivity: [0, 1],
          ratio: [0, 1],
          transmission: [0, 1],
          ior: [1.001, 2.5],
          dispersion: [0, 0.02],
          hole: [0.01, 10000],
          minDepth: [0, 32],
        };
    for (const [k, [a, b]] of Object.entries(fields)) o[k] = finite(r[k] ?? o[k], a, b, k);
    if (isSource(o)) {
      o.count = Math.round(o.count);
      o.aimTarget = typeof r.aimTarget === 'string' ? idMap.get(r.aimTarget) || null : null;
      if (o.aimTarget === id) o.aimTarget = null;
      o.color = /^#[\da-f]{6}$/i.test(r.color) ? r.color : '#ffbf69';
      o.colorMode = r.colorMode === 'wavelength' ? 'wavelength' : 'rgb';
    } else {
      o.minDepth = Math.round(o.minDepth);
      o.curvature = r.curvature === 'convex' ? 'convex' : 'concave';
      o.absorb = r.absorb !== false;
      o.fresnel = r.fresnel === true;
      if (['parabola', 'trough'].includes(o.type))
        o.focalLength = clamp(Math.abs(o.focalLength), 0.3, 10000);
      if (o.type === 'lens' && Math.abs(o.focalLength) < 0.3)
        o.focalLength = o.focalLength < 0 ? -0.3 : 0.3;
      if (o.type === 'spherical') o.diameter = Math.min(o.diameter, o.radius * 1.98);
      if (o.type === 'aperture') o.hole = Math.min(o.hole, o.width, o.height);
    }
    return o;
  });
  const t = raw.settings || {};
  for (const k of [
    'normals',
    'grid',
    'animate',
    'labels',
    'foci',
    'glow',
    'extensions',
    'snap',
    'starMode',
    'airyReference',
    'spotAutoFit',
    'showMeasurements',
  ])
    if (typeof t[k] === 'boolean') scene.settings[k] = t[k];
  scene.settings.maxBounces = Math.round(finite(t.maxBounces ?? 12, 1, 32, 'interaction limit'));
  scene.settings.maxDistance = finite(t.maxDistance ?? 30, 1, 4_000_000, 'ray length');
  scene.settings.density = finite(t.density ?? 1, 0.25, 8, 'ray density');
  scene.settings.mmPerUnit = finite(t.mmPerUnit ?? 50, 0.001, 1_000_000, 'world scale');
  scene.settings.rayOpacity = finite(t.rayOpacity ?? 0.82, 0.05, 1, 'ray opacity');
  scene.settings.rayWidth = finite(t.rayWidth ?? 1, 0.4, 3, 'ray width');
  scene.settings.displayBudget = Math.round(
    finite(t.displayBudget ?? 24000, 1000, 100000, 'display budget'),
  );
  scene.settings.rayStyle = ['clarity', 'glow', 'bounce'].includes(t.rayStyle)
    ? t.rayStyle
    : 'clarity';
  scene.settings.rayStage = t.rayStage === 'interacted' ? 'interacted' : 'all';
  scene.settings.primaryId = idMap.get(t.primaryId) || null;
  scene.settings.detectorId = idMap.get(t.detectorId) || null;
  return syncAimLocks(scene);
}

/** Power-weighted geometric spot statistics. Not a diffraction PSF. */
export function spotStatistics(hits) {
  const useful = hits.filter((h) => h.energy > 0 && h.local && h.local.every(Number.isFinite));
  const power = useful.reduce((a, h) => a + h.energy, 0);
  if (!power) return { count: 0, power: 0, centroid: null, rms: null, radius80: null };
  const centroid = [0, 1].map((i) => useful.reduce((a, h) => a + h.local[i] * h.energy, 0) / power);
  const radii = useful
    .map((h) => ({
      r: Math.hypot(h.local[0] - centroid[0], h.local[1] - centroid[1]),
      e: h.energy,
    }))
    .sort((a, b) => a.r - b.r);
  const rms = Math.sqrt(radii.reduce((a, h) => a + h.r * h.r * h.e, 0) / power);
  let sum = 0,
    radius80 = 0;
  for (const q of radii) {
    sum += q.e;
    radius80 = q.r;
    if (sum >= power * 0.8) break;
  }
  return { count: useful.length, power, centroid, rms, radius80 };
}
/** Unobstructed circular-aperture diffraction reference; this does not diffract rays. */
export function telescopeReference(primary, mmPerUnit = 50, wavelength = 550) {
  if (!primary) return null;
  const f = Math.abs(primary.type === 'spherical' ? primary.radius / 2 : primary.focalLength),
    D = primary.diameter;
  if (!(f > 0 && D > 0 && mmPerUnit > 0)) return null;
  const fmm = f * mmPerUnit,
    Dmm = D * mmPerUnit,
    lambdaMm = wavelength * 1e-6;
  return {
    focalMm: fmm,
    diameterMm: Dmm,
    fNumber: f / D,
    plateScale: 206264.806247 / fmm,
    rayleighArcsec: ((1.22 * lambdaMm) / Dmm) * 206264.806247,
    airyRadiusWorld: (1.22 * lambdaMm * f) / D / mmPerUnit,
  };
}
/** Clipboard clone: internal links remap as a group; foreign external links release. */
export function cloneObjects(scene, payload, offset = [0.7, 0, 0.7]) {
  if (
    !payload ||
    payload.format !== 'lumen-objects' ||
    !Array.isArray(payload.objects) ||
    !payload.objects.length
  )
    throw new Error('The clipboard does not contain Lumen objects.');
  if (scene.objects.length + payload.objects.length > 80)
    throw new Error('Pasting would exceed the 80-object scene limit.');
  const checked = validateScene({ version: 3, objects: payload.objects, settings: {} }).objects;
  let next = 1 + Math.max(0, ...scene.objects.map((o) => Number(o.id.slice(1)) || 0));
  const remap = new Map(payload.objects.map((o) => [o.id, 'o' + next++]));
  return checked.map((o, i) => {
    const raw = payload.objects[i],
      oldTarget = raw.aimTarget;
    return {
      ...o,
      id: remap.get(raw.id),
      name: (o.name + ' copy').slice(0, 60),
      p: o.p.map((v, k) => clamp(v + offset[k], -POSITION_LIMIT, POSITION_LIMIT)),
      aimTarget: isSource(o)
        ? remap.get(oldTarget) ||
          (payload.sceneUid === scene.uid && scene.objects.some((t) => t.id === oldTarget)
            ? oldTarget
            : null)
        : undefined,
    };
  });
}
