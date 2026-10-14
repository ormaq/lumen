/** Shared DOM and icon helpers for the editor. */
export const $ = (id) => document.getElementById(id);
const ICONS = {
  star: '<path d="m12 2 2.8 6.2 6.7.8-5 4.6 1.4 6.6-5.9-3.4-5.9 3.4 1.4-6.6-5-4.6 6.7-.8L12 2Z"/>',
  sliders: '<path d="M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11M10 3v6m5 0v6M6 15v6"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  clipboard:
    '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9zM9 11h6M9 15h6"/>',

  ray: '<circle cx="4" cy="12" r="2"/><path d="M7 12h14m-4-4 4 4-4 4"/>',
  beam: '<path d="M3 5h18M3 12h18M3 19h18m-3-17 3 3-3 3m0 1 3 3-3 3m0 1 3 3-3 3"/>',
  sun: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
  spot: '<circle cx="4" cy="12" r="1.5"/><path d="m6 11 15-7M6 12h15M6 13l15 7M20 5v14"/>',
  fan: '<path d="m3 12 18-9M3 12h18M3 12l18 9M3 12l18-4M3 12l18 4"/>',
  line: '<path d="M4 3v18M4 5h17M4 12h17M4 19h17"/>',
  area: '<path d="m3 5 8-2v16l-8 2V5Zm8 0h10M11 12h10M11 19h10"/>',
  mirror: '<path d="m7 3 10 3v15L7 18V3Zm3 2v14M5 22h14"/>',
  dish: '<path d="M18 3C5 3 5 21 18 21M18 3c-6 4-6 14 0 18M5 12h15M15 7l5 5-5 5"/>',
  trough:
    '<path d="m4 3 11 2c-7 3-7 11 0 14L4 21c-6-5-6-13 0-18ZM4 3c-1 6-1 12 0 18M7 7l8 1m-8 8 8-1"/>',
  curved: '<path d="M15 3a11 11 0 0 0 0 18M18 3a11 11 0 0 0 0 18M3 7h9M3 17h9"/>',
  split: '<path d="m7 21 10-18M2 12h20m-4-3 4 3-4 3M12 12V2m-3 3 3-3 3 3"/>',
  lens: '<path d="M12 2c-7 5-7 15 0 20 7-5 7-15 0-20ZM2 12h20"/>',
  glass: '<circle cx="12" cy="12" r="8"/><path d="M7 8a6 6 0 0 1 5-3M2 9l5 2 10 2 5 3"/>',
  block: '<path d="M9 3h6v18H9zM2 6h7M2 12h7M2 18h7m6-13 4-3m-4 9 4-3m-4 9 4-3m-4 9 4-3"/>',
  aperture: '<path d="M5 3h14v18H5z"/><ellipse cx="12" cy="12" rx="4" ry="6"/>',
  detector:
    '<path d="M4 3h16v18H4zM8 3v18M4 8h16M4 16h16M15 3v18"/><circle cx="12" cy="12" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 17l9 5 9-5"/>',
  undo: '<path d="M8 5 3 10l5 5M3 10h12a5 5 0 0 1 0 10"/>',
  redo: '<path d="m16 5 5 5-5 5M21 10H9a5 5 0 0 0 0 10"/>',
  folder: '<path d="M3 6h7l2 3h9v11H3V6ZM3 6V4h7l2 2h8v3"/>',
  save: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v6h16v-6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 4 2c-1 .6-1.5 1-1.5 2.5M12 17h.01"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
  'panel-left': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  'panel-right': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  cursor: '<path d="m5 3 14 10-7 1-4 7L5 3Z"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M5 9l-3 3 3 3m14-6 3 3-3 3m-10 4 3 3 3-3"/>',
  rotate: '<path d="M5 8a8 8 0 1 1-1 7M5 3v5h5"/><circle cx="12" cy="12" r="2"/>',
  magnet: '<path d="M4 3h5v9a3 3 0 0 0 6 0V3h5v9a8 8 0 0 1-16 0V3ZM4 7h5m6 0h5"/>',
  frame: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="3"/>',
  focus: '<path d="M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  normal: '<path d="m3 19 18-5M12 17V3m-4 4 4-4 4 4"/>',
  crosshair: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  camera: '<path d="m8 6 1-2h6l1 2h4v14H4V6h4Z"/><circle cx="12" cy="13" r="4"/>',
  eye: '<path d="M2 12c5-9 15-9 20 0-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18M8 5c5-2 10 0 14 7-1 2-2 3-3 4M6 6c-2 1-3 3-4 6 4 7 10 9 16 6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 5v5"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.spark}</svg>`;
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function hydrate(root = document) {
  root.querySelectorAll('[data-icon]').forEach((e) => (e.outerHTML = icon(e.dataset.icon)));
}
