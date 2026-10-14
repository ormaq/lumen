import {
  V,
  rad,
  deg,
  clamp,
  CATALOG,
  PRESETS,
  isSource,
  isMirror,
  basis,
  localVec,
  worldVec,
  aim,
  intersect,
  sourceColor,
  surfaceZ,
  focalPoints,
  createObject,
  createPreset,
  traceScene,
  validateScene,
  syncAimLocks,
  cloneObjects,
  spotStatistics,
  telescopeReference,
  requestedSamples,
  POSITION_LIMIT,
} from './optics.js';
import { M, Renderer } from './renderer.js';
import { buildRayGeometry } from './ray-display.js';
import { $, icon, esc, hydrate } from './ui.js';

// Only these settings change the underlying optical paths. Display controls
// reuse the last trace, including a dense trace already running in the worker.
const TRACE_SETTINGS = new Set(['density', 'maxBounces', 'maxDistance', 'segmentBudget']);

hydrate();
function boot() {
  const canvas = $('canvas'),
    renderer = new Renderer(canvas),
    gl = renderer.gl;
  let state = createPreset('focus'),
    preferences = { invertOrbit: false };
  try {
    const saved = localStorage.getItem('lumen-scene-v3') || localStorage.getItem('lumen-scene-v2');
    if (saved) {
      state = validateScene(JSON.parse(saved));
    }
    const p = JSON.parse(localStorage.getItem('lumen-preferences') || '{}');
    preferences.invertOrbit = !!p.invertOrbit;
  } catch {}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) state.settings.animate = false;
  let selected = state.objects.find((o) => !isSource(o))?.id || state.objects[0]?.id || null,
    mode = 'select',
    axis = null,
    view = '3d',
    leftTab = 'scene',
    rightTab = 'object';
  let trace = { segments: [], hits: [], detectors: {}, seeds: 0, limited: false, emittedPower: 0 },
    dirty = true,
    needsTrace = true,
    labels = [],
    flowTime = 0,
    lastTime = 0,
    lastRender = 0,
    rayCache = null,
    traceMs = 0,
    traceRuns = 0;
  let past = [],
    future = [],
    editBefore = null,
    saveTimer,
    toastTimer,
    curveKeys = new Map(),
    drag = null,
    touches = new Map(),
    pinch = null,
    exportAfterFrame = false;
  let selection = new Set(selected ? [selected] : []),
    clipboard = null,
    pasteSerial = 0,
    isolateSource = null,
    sceneRevision = 0,
    traceBusy = false,
    traceWorker = null,
    renderedSegments = 0;
  const foldState = new Map();
  try {
    clipboard = JSON.parse(localStorage.getItem('lumen-object-clipboard') || 'null');
  } catch {}
  try {
    if (typeof LUMEN_WORKER_SOURCE !== 'undefined' && typeof Worker !== 'undefined') {
      const u = URL.createObjectURL(new Blob([LUMEN_WORKER_SOURCE], { type: 'text/javascript' }));
      traceWorker = new Worker(u);
      URL.revokeObjectURL(u);
      traceWorker.onmessage = (e) => {
        traceBusy = false;
        if (e.data.error) {
          traceWorker.terminate();
          traceWorker = null;
          needsTrace = true;
          return;
        }
        if (e.data.revision === sceneRevision) {
          applyTrace(e.data.trace, e.data.ms);
          dirty = true;
        } else needsTrace = true;
      };
      traceWorker.onerror = () => {
        traceBusy = false;
        traceWorker?.terminate();
        traceWorker = null;
        needsTrace = true;
      };
    }
  } catch {
    traceWorker = null;
  }
  const object = (id) => state.objects.find((o) => o.id === id),
    current = () => object(selected),
    snapshot = () => JSON.stringify(state);
  const swatchColors = [
    '#ff6575',
    '#ffbf69',
    '#f3ea91',
    '#70e5a7',
    '#80c7ff',
    '#bc9fff',
    '#f3f7ff',
  ];
  function toast(text) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3300);
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem('lumen-scene-v3', snapshot());
        $('save-status').textContent = 'Changes saved on this device';
      } catch {
        $('save-status').textContent = 'Use Save to keep a JSON copy';
      }
    }, 400);
  }
  function syncHistory() {
    $('undo-button').disabled = !past.length;
    $('redo-button').disabled = !future.length;
    for (const id of [
      'duplicate-button',
      'duplicate-scene',
      'copy-button',
      'cut-button',
      'delete-selection',
    ])
      $(id).disabled = !current();
  }
  function selectedObjects() {
    return state.objects.filter((o) => selection.has(o.id));
  }
  function normalizeSelection() {
    selection = new Set([...selection].filter((id) => object(id)));
    if (!selection.has(selected)) {
      selection = new Set(selected && object(selected) ? [selected] : []);
    }
    if (!current()) selected = [...selection].at(-1) || null;
  }
  function closeMenus() {
    document.querySelectorAll('.menu[open]').forEach((m) => (m.open = false));
  }
  function copySelection(cut = false) {
    const items = selectedObjects();
    if (!items.length) {
      toast('Select an object to copy.');
      return;
    }
    if (cut && items.some((o) => o.locked)) {
      toast('Unlock all selected objects before cutting.');
      return;
    }
    clipboard = {
      format: 'lumen-objects',
      version: 1,
      copiedAt: Date.now(),
      sceneUid: state.uid,
      objects: JSON.parse(JSON.stringify(items)),
    };
    pasteSerial = 0;
    const text = JSON.stringify(clipboard);
    try {
      localStorage.setItem('lumen-object-clipboard', text);
    } catch {}
    try {
      navigator.clipboard?.writeText(text).catch(() => {});
    } catch {}
    if (cut)
      mutate(() => {
        state.objects = state.objects.filter((o) => !selection.has(o.id));
        selected = null;
        selection.clear();
      });
    toast(
      `${items.length} object${items.length === 1 ? '' : 's'} ${cut ? 'cut' : 'copied'} in Lumen.`,
    );
  }
  async function pasteSelection(inPlace = false) {
    // An in-app copy must paste immediately, without a system permission prompt.
    let payload = clipboard;
    try {
      const saved = JSON.parse(localStorage.getItem('lumen-object-clipboard') || 'null');
      if (
        saved?.format === 'lumen-objects' &&
        (!payload || (saved.copiedAt || 0) > (payload.copiedAt || 0))
      )
        payload = saved;
    } catch {}
    if (!payload) {
      try {
        const text = await navigator.clipboard?.readText();
        if (text) {
          const parsed = JSON.parse(text);
          if (parsed.format === 'lumen-objects') payload = parsed;
        }
      } catch {}
    }
    pastePayload(payload, inPlace);
  }
  function pastePayload(payload, inPlace = false) {
    try {
      const shift = inPlace ? 0 : 0.7 * ++pasteSerial;
      const copies = cloneObjects(state, payload, [shift, 0, shift]);
      mutate(() => {
        state.objects.push(...copies);
        selection = new Set(copies.map((o) => o.id));
        selected = copies.at(-1).id;
      });
      setRightTab('object');
      showRight();
      toast(
        `${copies.length} object${copies.length === 1 ? '' : 's'} pasted${inPlace ? ' in place' : ''}.`,
      );
    } catch (e) {
      toast(e.message);
    }
  }
  function selectAll() {
    endEdit();
    selection = new Set(state.objects.map((o) => o.id));
    selected = state.objects.at(-1)?.id || null;
    renderList();
    renderInspector();
    syncHistory();
    dirty = true;
    rayCache = null;
  }

  function remember(before) {
    if (before !== snapshot()) {
      past.push(before);
      if (past.length > 100) past.shift();
      future = [];
      syncHistory();
    }
  }
  function beginEdit() {
    if (editBefore === null) editBefore = snapshot();
  }
  function endEdit() {
    if (editBefore !== null) {
      remember(editBefore);
      editBefore = null;
    }
    persist();
  }
  function mutate(fn, { refresh = true, traceRequired = true } = {}) {
    endEdit();
    const before = snapshot();
    fn();
    remember(before);
    if (refresh) refreshAll({ traceRequired });
    else markChanged({ traceRequired });
  }
  function undo(redo = false) {
    endEdit();
    const from = redo ? future : past,
      to = redo ? past : future;
    if (!from.length) return;
    to.push(snapshot());
    state = JSON.parse(from.pop());
    if (!current()) selected = state.objects[0]?.id || null;
    refreshAll();
    toast(redo ? 'Change redone.' : 'Change undone.');
  }
  function markChanged({ traceRequired = true } = {}) {
    if (traceRequired) {
      syncAimLocks(state);
      sceneRevision++;
      needsTrace = true;
    } else {
      rebuildLabels();
      updateReadouts();
      updateResearch();
    }
    dirty = true;
    rayCache = null;
    syncInspectorFields();
    persist();
  }
  function setRangeFill(el) {
    el.style.setProperty(
      '--pct',
      `${((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100}%`,
    );
  }
  function cleanCurveMeshes() {
    const ids = new Set(state.objects.map((o) => o.id));
    for (const id of curveKeys.keys())
      if (!ids.has(id)) {
        renderer.disposeMesh('curve-' + id);
        curveKeys.delete(id);
      }
  }
  function refreshAll({ traceRequired = true } = {}) {
    syncAimLocks(state);
    normalizeSelection();
    cleanCurveMeshes();
    renderList();
    renderInspector();
    renderSimulation();
    syncButtons();
    syncHistory();
    renderExamples();
    if (rightTab === 'research') renderResearch();
    $('stage').dataset.starMode = String(state.settings.starMode);
    $('project-name').textContent = state.name;
    $('scene-title').textContent = state.name;
    $('scene-subtitle').textContent =
      PRESETS[state.preset]?.subtitle || 'Your optical experiment in three dimensions.';
    $('empty-stage').hidden = state.objects.length > 0;
    markChanged({ traceRequired });
  }
  function selectedHit() {
    const pool = trace.hits.filter((h) => h.objectId === selected);
    return (
      pool.find((h) => h.rayIndex === 1) ||
      pool[0] ||
      trace.hits.find((h) => h.reflection !== undefined)
    );
  }
  function applyTrace(next, ms) {
    trace = next;
    traceMs = ms;
    rayCache = null;
    rebuildLabels();
    updateReadouts();
    updateResearch();
  }
  function retrace() {
    if (traceBusy) return;
    traceRuns++;
    needsTrace = false;
    const estimated = state.objects
      .filter(isSource)
      .reduce((n, s) => n + requestedSamples(s, state.settings.density), 0);
    if (traceWorker && estimated > 1024) {
      traceBusy = true;
      traceWorker.postMessage({ scene: state, revision: sceneRevision });
      $('status-trace').textContent = 'Tracing dense scene…';
      return;
    }
    const start = performance.now();
    applyTrace(traceScene(state), performance.now() - start);
  }
  function updateReadouts() {
    $('stage-stats').textContent = `${trace.seeds} rays · ${trace.segments.length} segments`;
    $('status-trace').innerHTML =
      `<span class="state-dot"></span>${trace.seeds} rays <span class="hide-small">· ${traceMs.toFixed(1)} ms</span>${trace.limited ? ' <span class="warning">· trace capped</span>' : ''}${trace.seedLimited ? ' <span class="warning">· sample budget</span>' : ''}<span id="display-thinned" class="warning"></span>`;
    const o = current(),
      h = selectedHit();
    $('status-pick').textContent = o
      ? `${o.name}${o.locked ? ' · locked' : ''} · ${CATALOG[o.type].label}`
      : 'Click an object to inspect it';
    const measure = $('measure');
    measure.hidden = !state.objects.length || !state.settings.showMeasurements;
    if (o && ['parabola', 'trough', 'spherical', 'lens'].includes(o.type)) {
      const f =
          o.type === 'spherical'
            ? (o.radius / 2) * (o.curvature === 'convex' ? -1 : 1)
            : o.focalLength,
        desc =
          o.type === 'trough'
            ? 'Line focus · parabolic cylinder'
            : o.type === 'spherical'
              ? 'Paraxial focus · spherical aberration is traced'
              : o.type === 'lens'
                ? 'Paraxial thin-lens approximation'
                : 'Point focus · analytic paraboloid';
      measure.innerHTML = `<div class="measure-title">${o.type === 'spherical' ? 'PARAXIAL FOCAL LENGTH' : 'FOCAL LENGTH'}${icon('crosshair')}</div><div class="measure-values"><span><small>f ${o.type === 'spherical' ? '≈' : '='}</small>${f.toFixed(2)}</span><small>world units</small></div><p>${desc}</p>`;
    } else if (o?.type === 'detector') {
      const d = trace.detectors[o.id] || { power: 0, count: 0 };
      measure.innerHTML = `<div class="measure-title">INCIDENT POWER${icon('detector')}</div><div class="measure-values">${d.power.toFixed(3)}<small>arb. units</small></div><p>${d.count} sampled ray crossings · ${o.absorb ? 'absorbing screen' : 'pass-through detector'}</p>`;
    } else if (h?.reflection !== undefined) {
      measure.innerHTML = `<div class="measure-title">LAW OF REFLECTION${icon('normal')}</div><div class="measure-values"><span><small>θᵢ</small>${h.incidence.toFixed(1)}°</span><span class="equals">=</span><span><small>θᵣ</small>${h.reflection.toFixed(1)}°</span></div><p>Sampled ray ${h.rayIndex + 1} · angles from the surface normal</p>`;
    } else {
      measure.innerHTML = `<div class="measure-title">LIVE GEOMETRIC OPTICS${icon('spark')}</div><div class="measure-values">${trace.seeds}<small>emitted rays</small></div><p>${trace.hits.length} surface interactions · ${state.settings.maxBounces} interaction cap</p>`;
    }
    if ($('detector-power')) {
      const d = trace.detectors[selected] || { power: 0, count: 0, hits: [] };
      $('detector-power').textContent = d.power.toFixed(3);
      $('detector-count').textContent = d.count;
      paintDetector(o, d);
    }
    if ($('live-angle'))
      $('live-angle').textContent =
        h?.reflection !== undefined
          ? `θᵢ ${h.incidence.toFixed(2)}° = θᵣ ${h.reflection.toFixed(2)}°`
          : 'No reflected ray on this object.';
  }
  function renderList() {
    $('object-count').textContent = String(state.objects.length).padStart(2, '0');
    const n = state.objects.filter(isSource).length;
    $('scene-foot').textContent =
      `${state.objects.length} objects · ${n} light source${n === 1 ? '' : 's'}`;
    $('object-list').innerHTML =
      state.objects
        .map(
          (o) =>
            `<div class="object-row ${selection.has(o.id) ? 'selected' : ''} ${o.enabled ? '' : 'disabled'}" data-select="${o.id}" role="button" tabindex="0" aria-label="Select ${esc(o.name)}" aria-pressed="${selection.has(o.id)}"><span class="obj-icon" ${
              isSource(o)
                ? `style="color:rgb(${sourceColor(o)
                    .map((v) => Math.round(v * 255))
                    .join(',')})"`
                : ''
            }>${icon(CATALOG[o.type].icon)}</span><span class="name">${esc(o.name)}</span>${o.locked ? `<span class="row-lock">${icon('lock')}</span>` : ''}<button class="visibility" data-visible="${o.id}" title="${o.enabled ? 'Disable' : 'Enable'} ${esc(o.name)}" aria-label="${o.enabled ? 'Disable' : 'Enable'} ${esc(o.name)}">${icon(o.enabled ? 'eye' : 'eye-off')}</button></div>`,
        )
        .join('') ||
      '<div class="scene-empty">The workbench is empty.<br>Add a source to begin.</div>';
  }
  function setLeftTab(tab) {
    leftTab = tab;
    $('scene-panel').hidden = tab !== 'scene';
    $('library-panel').hidden = tab !== 'library';
    document
      .querySelectorAll('[data-left-tab]')
      .forEach((b) => b.classList.toggle('active', b.dataset.leftTab === tab));
    if (tab === 'library') renderLibrary();
  }
  function setRightTab(tab) {
    rightTab = tab;
    $('inspector').hidden = tab !== 'object';
    $('simulation-panel').hidden = tab !== 'simulation';
    $('research-panel').hidden = tab !== 'research';
    document
      .querySelectorAll('[data-right-tab]')
      .forEach((b) => b.classList.toggle('active', b.dataset.rightTab === tab));
    if (tab === 'simulation') renderSimulation();
    if (tab === 'research') renderResearch();
  }
  function showLeft() {
    document.body.classList.remove('left-hidden');
    if (innerWidth <= 980) {
      $('left-dock').classList.add('mobile-open');
      $('right-dock').classList.remove('mobile-open');
    }
    resizeSoon();
  }
  function showRight() {
    document.body.classList.remove('right-hidden');
    if (innerWidth <= 720) {
      $('right-dock').classList.add('mobile-open');
      $('left-dock').classList.remove('mobile-open');
    }
    resizeSoon();
  }
  function openLibrary() {
    setLeftTab('library');
    showLeft();
  }
  function select(id, show = false, additive = false) {
    if (id && !object(id)) return;
    endEdit();
    if (additive && id) {
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
      selected = [...selection].at(-1) || null;
    } else {
      selected = id;
      selection = new Set(id ? [id] : []);
    }
    renderList();
    renderInspector();
    syncHistory();
    rebuildLabels();
    updateReadouts();
    dirty = true;
    rayCache = null;
    if (show) {
      setRightTab('object');
      showRight();
    }
  }
  function renderLibrary() {
    const term = $('component-search').value.trim().toLowerCase();
    let html = '',
      group = '';
    for (const [type, c] of Object.entries(CATALOG)) {
      if (term && !`${c.label} ${c.description}`.toLowerCase().includes(term)) continue;
      if (group !== c.group) {
        group = c.group;
        html += `<h3>${group}</h3>`;
      }
      html += `<button class="component ${isSource({ type }) ? 'light' : ''}" data-add="${type}" draggable="true" title="${c.description}">${icon(c.icon)}<span>${c.label}</span><span class="plus">+</span></button>`;
    }
    $('library').innerHTML = html || '<p class="no-matches">No matching components.</p>';
  }
  function field(key, label, min, max, step, value, unit = '', options = {}) {
    const prefix = options.settings ? 'setting' : 'prop',
      digits = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
    let sliderMin = min,
      sliderMax = max;
    if (max > 100) {
      sliderMax = Math.min(
        max,
        Math.max(options.sliderMax || 100, Math.ceil((Math.abs(value) * 1.5) / 10) * 10),
      );
      if (min < 0) sliderMin = -sliderMax;
    }
    if (key === 'count') {
      sliderMax = 16384;
      sliderMin = 1;
    }
    return `<div class="field"><div class="field-head"><label for="${prefix}-${key}">${label}</label><span class="value-wrap"><input type="number" id="${prefix}-${key}" data-${prefix}="${key}" min="${min}" max="${max}" step="${step}" value="${Number(value).toFixed(digits)}" aria-label="${label}"><span class="unit">${unit}</span></span></div><input type="range" class="${options.spectrum ? 'spectrum' : ''}" data-${prefix}="${key}" min="${sliderMin}" max="${sliderMax}" step="${step}" value="${value}" aria-label="${label} slider"></div>`;
  }
  const checkbox = (key, title, value, settings = false, ico = '') =>
    `<label class="toggle"><span>${ico ? icon(ico) : ''}${title}</span><input type="checkbox" data-${settings ? 'setting' : 'prop'}="${key}" ${value ? 'checked' : ''}></label>`;
  function renderInspector() {
    const o = current(),
      root = $('inspector');
    root
      .querySelectorAll('details[data-fold]')
      .forEach((d) => foldState.set(d.dataset.fold, d.open));
    if (!o) {
      root.innerHTML = `<div class="inspector-empty">${icon('cursor')}<h2>Every object has a story.</h2><p>Select a light, mirror or optical component to edit its position and properties.</p><button class="bordered" id="inspector-add">${icon('plus')}Add a component</button></div>`;
      return;
    }
    const light = isSource(o),
      c = CATALOG[o.type];
    let html = `<div class="inspector-header"><div class="object-type"><span>${icon(c.icon)}${c.label}</span><div class="object-actions"><button id="lock-object" title="${o.locked ? 'Unlock' : 'Lock'} transform" aria-label="${o.locked ? 'Unlock' : 'Lock'} selected object">${icon(o.locked ? 'lock' : 'unlock')}</button><button id="copy-object" title="Copy (Ctrl/⌘ C)" aria-label="Copy selected objects">${icon('copy')}</button><button id="delete-object" title="Delete" aria-label="Delete selected object">${icon('trash')}</button></div></div><input class="inspector-name" data-prop="name" value="${esc(o.name)}" maxlength="60" aria-label="Object name"></div>`;
    html += `<section class="section"><h3>Transform <span>${o.locked ? 'LOCKED' : 'WORLD SPACE'}</span></h3><div class="triple-label"><span>Position</span><span class="unit">units</span></div><div class="position-fields">${['x', 'y', 'z'].map((a, i) => `<label class="number-field ${a}"><span>${a.toUpperCase()}</span><input type="number" data-prop="p${i}" value="${o.p[i].toFixed(2)}" min="-1000000" max="1000000" step=".1" aria-label="${a.toUpperCase()} position" ${o.locked ? 'disabled' : ''}></label>`).join('')}</div>`;
    html +=
      '<details class="orientation" data-fold="orientation"><summary>Orientation & direction</summary>' +
      field('yaw', 'Yaw', -180, 180, 0.1, o.yaw, '°') +
      field('tilt', light ? 'Elevation' : 'Tilt', -90, 90, 0.1, o.tilt, '°') +
      field('roll', 'Roll', -180, 180, 0.1, o.roll, '°');
    html += '</details></section>';
    if (light) {
      html += `<section class="section"><h3>Emission</h3><label class="compact-select">Source type<select data-prop="type" aria-label="Source type">${Object.entries(
        CATALOG,
      )
        .filter(([t]) => isSource({ type: t }))
        .map(
          ([t, c]) => `<option value="${t}" ${o.type === t ? 'selected' : ''}>${c.label}</option>`,
        )
        .join('')}</select></label>`;
      if (o.type !== 'laser') html += field('count', 'Ray samples', 1, 16384, 1, o.count);
      if (['beam', 'star', 'spot', 'fan', 'line', 'area'].includes(o.type)) {
        if (['beam', 'star'].includes(o.type))
          html += field(
            'aperture',
            o.type === 'star' ? 'Wavefront diameter' : 'Beam diameter',
            0,
            10000,
            0.05,
            o.aperture,
            'u',
          );
        if (['area', 'line'].includes(o.type))
          html += field('width', 'Emitter width', 0.1, 10000, 0.1, o.width, 'u');
        if (o.type === 'area')
          html += field('height', 'Emitter height', 0.1, 10000, 0.1, o.height, 'u');
        if (o.type !== 'star')
          html += field(
            'spread',
            o.type === 'fan'
              ? 'Fan half-angle'
              : o.type === 'spot'
                ? 'Cone half-angle'
                : 'Divergence half-angle',
            0,
            85,
            0.1,
            o.spread,
            '°',
          );
      }
      if (o.type === 'star')
        html +=
          field('fieldX', 'Field X', -30, 30, 0.01, o.fieldX, '°') +
          field('fieldY', 'Field Y', -30, 30, 0.01, o.fieldY, '°') +
          field('angularDiameter', 'Angular diameter', 0, 3600, 0.1, o.angularDiameter, '″') +
          '<p class="note">Collimated for a point star. Lock to the primary to keep pupil sampling fixed while changing field angle. Angular diameter samples a uniform apparent disk, not seeing or diffraction.</p>';
      html += field('power', 'Source power', 0, 5, 0.05, o.power, 'a.u.');
      html += `<div class="target-lock"><label for="aim-target">Aim toward an object</label><select id="aim-target" aria-label="Aim source at object"><option value="">Choose a target…</option>${state.objects
        .filter((t) => t.id !== o.id)
        .map(
          (t) =>
            `<option value="${t.id}" ${o.aimTarget === t.id ? 'selected' : ''}>${esc(t.name)}</option>`,
        )
        .join(
          '',
        )}</select><div class="target-actions"><button id="aim-once" class="bordered" ${o.locked ? 'disabled' : ''}>Aim once</button><button id="lock-target" class="${o.aimTarget ? 'active' : 'bordered'}" ${o.locked && !o.aimTarget ? 'disabled' : ''}>${icon(o.aimTarget ? 'lock' : 'crosshair')}${o.aimTarget ? 'Release lock' : 'Lock onto'}</button></div><p class="lock-status">${o.aimTarget ? 'Tracking ' + esc(object(o.aimTarget)?.name || 'target') + ' · updates when either object moves.' : 'Aim once sets direction. Lock onto keeps following the target.'}</p></div><div class="source-tools"><button id="isolate-source" class="${isolateSource === o.id ? 'active' : 'bordered'}">${icon('eye')}${isolateSource === o.id ? 'Show all rays' : 'Only this source'}</button></div><p class="note">Power is divided across the emitted samples. Display emphasis never changes the traced power.</p></section>`;
      html += `<section class="section"><h3>Light color</h3><label class="compact-select">Color mode<select data-prop="colorMode" aria-label="Color mode"><option value="rgb" ${o.colorMode === 'rgb' ? 'selected' : ''}>Custom RGB</option><option value="wavelength" ${o.colorMode === 'wavelength' ? 'selected' : ''}>Wavelength</option></select></label>`;
      if (o.colorMode === 'rgb')
        html += `<div class="color-line"><input type="color" data-prop="color" value="${o.color}" aria-label="Light color"><input type="text" data-prop="color" value="${o.color.toUpperCase()}" maxlength="7" aria-label="Hex color"><span class="color-caption">RGB</span></div><div class="swatches">${swatchColors.map((color) => `<button class="swatch ${o.color.toLowerCase() === color ? 'active' : ''}" data-color="${color}" style="--swatch:${color}" title="${color}" aria-label="Set light color ${color}"></button>`).join('')}</div>`;
      else
        html +=
          field('wavelength', 'Wavelength', 380, 780, 1, o.wavelength, 'nm', { spectrum: true }) +
          '<p class="note">Spectral display colors are approximate. Wavelength affects dispersive glass.</p>';
      html += '</section>';
    } else {
      html += `<section class="section"><h3>${o.type === 'detector' ? 'Screen geometry' : 'Optical properties'}</h3>`;
      if (['parabola', 'spherical', 'lens'].includes(o.type))
        html += field(
          'diameter',
          'Aperture diameter',
          0.1,
          o.type === 'spherical' ? Math.min(10000, o.radius * 1.98) : 10000,
          0.1,
          o.diameter,
          'u',
        );
      if (!['parabola', 'spherical', 'lens', 'glass'].includes(o.type))
        html += `<div class="dimensions"><div><label for="prop-width">Width</label><input id="prop-width" type="number" data-prop="width" min=".01" max="10000" step=".1" value="${o.width}" aria-label="Width"></div><div><label for="prop-height">Height</label><input id="prop-height" type="number" data-prop="height" min=".01" max="10000" step=".1" value="${o.height}" aria-label="Height"></div></div>`;
      if (['parabola', 'trough', 'lens'].includes(o.type))
        html += field(
          'focalLength',
          'Focal length',
          o.type === 'lens' ? -10000 : 0.3,
          10000,
          0.1,
          o.focalLength,
          'u',
        );
      if (o.type === 'spherical') {
        html +=
          `<label class="compact-select">Curvature<select data-prop="curvature" aria-label="Mirror curvature"><option value="concave" ${o.curvature === 'concave' ? 'selected' : ''}>Concave</option><option value="convex" ${o.curvature === 'convex' ? 'selected' : ''}>Convex</option></select></label>` +
          field('radius', 'Radius of curvature', 0.3, 20000, 0.1, o.radius, 'u');
      }
      if (isMirror(o)) html += field('reflectivity', 'Reflectivity', 0, 1, 0.01, o.reflectivity);
      if (o.type === 'splitter')
        html +=
          field('ratio', 'Reflected fraction', 0, 1, 0.01, o.ratio) +
          `<p class="note" id="split-ratio">${Math.round(o.ratio * 100)}% reflected · ${Math.round((1 - o.ratio) * 100)}% transmitted. Both paths are traced.</p>`;
      if (o.type === 'glass')
        html +=
          field('radius', 'Sphere radius', 0.15, 20000, 0.05, o.radius, 'u') +
          field('ior', 'Refractive index', 1.001, 2.5, 0.001, o.ior) +
          field('dispersion', 'Dispersion B', 0, 0.02, 0.001, o.dispersion, 'µm²') +
          checkbox('fresnel', 'Trace Fresnel reflections', o.fresnel);
      if (o.type === 'glass' || o.type === 'lens')
        html += field('transmission', 'Transmission factor', 0, 1, 0.01, o.transmission);
      if (o.type === 'aperture')
        html += field(
          'hole',
          'Opening diameter',
          0.1,
          Math.min(o.width, o.height),
          0.1,
          o.hole,
          'u',
        );
      if (o.type === 'detector')
        html +=
          checkbox('absorb', 'Absorb rays at the screen', o.absorb) +
          field('minDepth', 'Record after interactions', 0, 32, 1, o.minDepth || 0) +
          '<p class="note">0 = a normal detector. Use 1 for a virtual focal plane that ignores direct starlight and intercepts rays only after an optical interaction.</p>';
      const note =
        o.type === 'parabola'
          ? 'A true paraboloid: parallel, on-axis rays meet at one point. Positive local Z points into the bowl.'
          : o.type === 'trough'
            ? 'Curved in one axis only. Parallel rays form a line focus along the trough.'
            : o.type === 'spherical'
              ? 'The marked focus is paraxial (R/2). Off-axis and wide-aperture aberration is simulated.'
              : o.type === 'lens'
                ? 'Ideal paraxial lens. Positive f converges; negative f diverges. Zero focal length is not allowed.'
                : o.type === 'glass'
                  ? 'A sphere surrounded by air. Do not overlap or nest glass volumes. Fresnel off omits ordinary reflection losses, but keeps total internal reflection.'
                  : c.description;
      html += `<p class="note">${note}</p>`;
      if (o.type === 'parabola') html += '<div class="formula">z = (x² + y²) / 4f</div>';
      if (o.type === 'trough') html += '<div class="formula">z = x² / 4f</div>';
      html += '</section>';
      if (o.type === 'detector')
        html +=
          '<section class="section"><h3>Live detector <span>SAMPLED RAYS</span></h3><div class="detector-stats"><div class="statbox"><b id="detector-power">0.000</b><small>Incident power · a.u.</small></div><div class="statbox"><b id="detector-count">0</b><small>Ray crossings</small></div></div><canvas class="detector-map" id="detector-map" width="480" height="270" aria-label="Detector ray-hit positions"></canvas><p class="note">Local screen coordinates. Colored marks show sampled hits, not a reconstructed intensity image.</p></section>';
      if (isMirror(o))
        html +=
          '<section class="section"><h3>Measured reflection</h3><div class="formula" id="live-angle">Tracing…</div><p class="note">One sampled incident ray, measured from the local surface normal.</p></section>';
    }
    html += `<section class="section">${checkbox('enabled', 'Enabled in simulation', o.enabled)}<p class="note">${light ? 'Source color is preserved through ideal reflections.' : 'Decorative mounts do not interact with rays.'}</p></section>`;
    root.innerHTML = html;
    if (selection.size > 1) {
      const hint = document.createElement('div');
      hint.className = 'multi-selection';
      hint.textContent = `${selection.size} selected · copy, delete and move act on the group. Fields edit ${o.name}.`;
      root.querySelector('.inspector-header').append(hint);
    }
    root.querySelectorAll('.section').forEach((section) => {
      const h = section.querySelector(':scope > h3');
      if (!h) return;
      const key = h.childNodes[0]?.textContent.trim() || h.textContent,
        details = document.createElement('details'),
        summary = document.createElement('summary');
      details.className = 'section';
      details.dataset.fold = key;
      details.open = foldState.has(key)
        ? foldState.get(key)
        : !['Light color', 'Measured reflection'].includes(key);
      summary.append(h);
      details.append(summary);
      while (section.firstChild) details.append(section.firstChild);
      section.replaceWith(details);
    });
    root.querySelectorAll('details[data-fold]').forEach((d) => {
      if (foldState.has(d.dataset.fold)) d.open = foldState.get(d.dataset.fold);
    });
    root.querySelectorAll('input[type=range]').forEach(setRangeFill);
    if (o.aimTarget)
      root
        .querySelectorAll('[data-prop="yaw"],[data-prop="tilt"]')
        .forEach((e) => (e.disabled = true));
    if (o.locked)
      root
        .querySelectorAll('[data-prop="yaw"],[data-prop="tilt"],[data-prop="roll"]')
        .forEach((e) => (e.disabled = true));
    updateReadouts();
  }
  function renderSimulation() {
    const s = state.settings;
    $('simulation-panel').innerHTML =
      `<section class="section"><h3>Ray appearance</h3><label class="display-select">Drawing style<select data-setting="rayStyle" aria-label="Ray drawing style"><option value="clarity" ${s.rayStyle === 'clarity' ? 'selected' : ''}>Clear lines · no additive whiteout</option><option value="glow" ${s.rayStyle === 'glow' ? 'selected' : ''}>Soft glow · luminous illustration</option><option value="bounce" ${s.rayStyle === 'bounce' ? 'selected' : ''}>By bounce · distinguish interactions</option></select></label>${field('rayOpacity', 'Line opacity', 0.05, 1, 0.05, s.rayOpacity, '', { settings: true })}${field('rayWidth', 'Line width', 0.4, 3, 0.1, s.rayWidth, '×', { settings: true })}<label class="display-select">Visible paths<select data-setting="rayStage" aria-label="Visible ray paths"><option value="all" ${s.rayStage !== 'interacted' ? 'selected' : ''}>All rays</option><option value="interacted" ${s.rayStage === 'interacted' ? 'selected' : ''}>After first optical interaction</option></select></label><p class="note">High sample counts are automatically dimmed to keep overlaps legible. Select a light to emphasize its rays, or use “Only this source” in its inspector. These are display changes, not optical losses.</p></section>
  <section class="section"><h3>Simulation</h3>${field('density', 'Global ray density', 0.25, 8, 0.25, s.density, '×', { settings: true })}${field('maxBounces', 'Interaction limit', 1, 32, 1, s.maxBounces, '', { settings: true })}${field('maxDistance', 'Maximum path length', 1, 4000000, 1, s.maxDistance, 'u', { settings: true })}${field('displayBudget', 'Visible segment budget', 1000, 100000, 1000, s.displayBudget, '', { settings: true, sliderMax: 100000 })}<p class="note">Up to 16,384 emitted rays per source, 65,536 per scene, and 100,000 traced segments. The display can sample whole paths at a lower budget without reducing detector analysis. Budgets are reported in the status bar.</p></section>
  <section class="section"><h3>Overlays</h3>${checkbox('animate', 'Animate light flow', s.animate, true, 'play')}${checkbox('grid', 'World grid', s.grid, true, 'grid')}${checkbox('labels', 'All object labels', s.labels, true, 'layers')}${checkbox('foci', 'Focal markers', s.foci, true, 'crosshair')}${checkbox('normals', 'Surface normals', s.normals, true, 'normal')}${checkbox('showMeasurements', 'Floating measurement card', s.showMeasurements, true, 'detector')}${checkbox('extensions', 'Backward ray extensions', s.extensions, true, 'ray')}${checkbox('starMode', 'Telescope workspace · hide stands', s.starMode, true, 'star')}<p class="note">A selected object is labeled even with all labels off. Backward extensions are construction lines, not additional rays.</p></section>
  <section class="section"><h3>Navigation</h3><label class="compact-select">Projection<select id="projection" aria-label="Camera projection"><option value="perspective" ${!renderer.camera.orthographic ? 'selected' : ''}>Perspective</option><option value="orthographic" ${renderer.camera.orthographic ? 'selected' : ''}>Orthographic</option></select></label><label class="toggle"><span>Invert horizontal orbit</span><input id="invert-orbit" type="checkbox" ${preferences.invertOrbit ? 'checked' : ''}></label>${checkbox('snap', 'Snap transforms', s.snap, true, 'magnet')}<p class="note">Left drag orbits. Right / middle drag pans. Move with Shift to raise or lower; X/Y/Z constrain an axis. Position fields accept ±1,000,000 units. Home frames the entire scene.</p></section><section class="section"><button id="simulation-focus" class="bordered" style="width:100%;margin-bottom:9px">${icon('focus')}Hide interface <kbd>Tab</kbd></button><button id="simulation-fullscreen" class="bordered" style="width:100%">${icon('fullscreen')}Browser fullscreen <kbd>F</kbd></button></section>`;
    $('simulation-panel').querySelectorAll('input[type=range]').forEach(setRangeFill);
  }
  function syncInspectorFields() {
    const o = current();
    if (!o) return;
    $('inspector')
      .querySelectorAll('[data-prop]')
      .forEach((el) => {
        const k = el.dataset.prop;
        if (el === document.activeElement) return;
        let v = /^p\d$/.test(k) ? o.p[+k[1]] : o[k];
        if (el.type === 'checkbox') el.checked = !!v;
        else if (el.type === 'number')
          el.value = Number(v).toFixed(
            +el.step < 0.01 ? 3 : +el.step < 0.1 ? 2 : +el.step < 1 ? 1 : 0,
          );
        else el.value = v;
        if (el.type === 'range') setRangeFill(el);
      });
  }
  function paintDetector(o, d) {
    const c = $('detector-map');
    if (!c || !o) return;
    const ctx = c.getContext('2d'),
      w = c.width,
      h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#1a3040';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 8, 0);
      ctx.lineTo((i * w) / 8, h);
      ctx.stroke();
    }
    for (let j = 1; j < 5; j++) {
      ctx.beginPath();
      ctx.moveTo(0, (j * h) / 5);
      ctx.lineTo(w, (j * h) / 5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#304756';
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    for (const hit of d.hits) {
      const x = (hit.local[0] / o.width + 0.5) * w,
        y = (0.5 - hit.local[1] / o.height) * h;
      ctx.fillStyle = `rgba(${hit.color.map((v) => Math.round(v * 255)).join(',')},0.55)`;
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#567a92';
    ctx.font = '15px monospace';
    ctx.fillText('−u', 10, h - 10);
    ctx.fillText('+u', w - 31, h - 10);
  }
  function researchObjects() {
    const primaries = state.objects.filter(
        (o) => ['parabola', 'spherical', 'lens'].includes(o.type) && o.enabled,
      ),
      detectors = state.objects.filter((o) => o.type === 'detector' && o.enabled);
    return {
      primaries,
      detectors,
      primary: primaries.find((o) => o.id === state.settings.primaryId) || primaries[0],
      detector: detectors.find((o) => o.id === state.settings.detectorId) || detectors[0],
    };
  }
  function researchData() {
    const { primary, detector } = researchObjects(),
      hits = trace.detectors[detector?.id]?.hits || [],
      groups = state.objects
        .filter(isSource)
        .map((s) => ({ source: s, hits: hits.filter((h) => h.sourceId === s.id) }))
        .filter((g) => g.hits.length);
    return { primary, detector, hits, groups, stats: spotStatistics(hits) };
  }
  function formatLength(world) {
    const mm = world * state.settings.mmPerUnit;
    if (!Number.isFinite(mm)) return '—';
    if (Math.abs(mm) < 1e-8) return '≈ 0 µm';
    if (Math.abs(mm) < 0.1) return (mm * 1000).toPrecision(3) + ' µm';
    return mm.toPrecision(4) + ' mm';
  }
  function renderResearch() {
    const root = $('research-panel'),
      { primaries, detectors, primary, detector } = researchObjects();
    if (!detector) {
      root.innerHTML = `<div class="research-intro"><h2>Focal-plane analysis</h2><p>Inspect geometric spots, per-source power, and telescope scale.</p></div><div class="empty-analysis">${icon('detector')}<p>Add a detector to your scene, or open a complete telescope experiment.</p><button class="primary" data-add="detector">Add detector</button><button id="research-open-star" class="bordered" style="margin-top:12px">Open Star lab</button><p class="note">A spot diagram is a collection of geometric ray hits. It is not a wave-optical point-spread function.</p></div>`;
      return;
    }
    const options = (items, value) =>
      items
        .map(
          (o) =>
            `<option value="${o.id}" ${o.id === value?.id ? 'selected' : ''}>${esc(o.name)}</option>`,
        )
        .join('');
    const f = primary
        ? primary.type === 'spherical'
          ? (primary.radius / 2) * (primary.curvature === 'convex' ? -1 : 1)
          : primary.focalLength
        : 0,
      offset = primary ? V.dot(V.sub(detector.p, primary.p), basis(primary).n) - f : 0;
    root.innerHTML = `<div class="research-intro"><h2>Focal-plane analysis</h2><p>Full traced samples. Independent of viewport ray thinning.</p><p id="research-warning" class="analysis-warning" hidden></p></div><section class="section"><label class="compact-select">Detector<select data-research="detectorId" aria-label="Analysis detector">${options(detectors, detector)}</select></label><label class="compact-select">Primary<select data-research="primaryId" aria-label="Analysis primary">${options(primaries, primary) || '<option value="">None — geometric hits only</option>'}</select></label><button id="research-ray-stage" class="research-action bordered" style="margin:0 0 14px">${icon('ray')}${state.settings.rayStage === 'interacted' ? 'Show full light paths' : 'Show only interacted paths'}</button><canvas class="research-map" id="research-map" width="600" height="480" aria-label="Power-weighted geometric focal spot diagram"></canvas><div class="spot-legend" id="spot-legend"></div><div class="research-metrics"><div class="research-metric"><strong id="research-hit-count">—</strong><span>Recorded samples</span></div><div class="research-metric"><strong id="research-power">—</strong><span>Incident power · a.u.</span></div></div><div id="source-results"></div><button id="research-export" class="research-action bordered">${icon('save')}Export focal hits · CSV</button><p class="note">RMS radii are power-weighted, around each source’s own centroid. Viewport color is illustrative, not calibrated irradiance.</p></section>
  <details class="section" open><summary><h3>Telescope & reference</h3></summary><div id="telescope-reference"></div><label class="compact-select">mm per world unit<input data-research="mmPerUnit" id="research-world-scale" type="number" min=".001" max="1000000" step=".1" value="${state.settings.mmPerUnit}" aria-label="Millimeters per world unit" style="width:110px"></label><label class="toggle"><span>Auto-fit focal spots</span><input type="checkbox" data-research="spotAutoFit" ${state.settings.spotAutoFit ? 'checked' : ''}></label><label class="toggle"><span>Airy reference circles</span><input type="checkbox" data-research="airyReference" ${state.settings.airyReference ? 'checked' : ''}></label><p class="note">Airy circles assume an unobstructed circular aperture. They are references only; diffraction, interference, atmospheric seeing and detector pixels are not simulated.</p></details>
  <details class="section"><summary><h3>Focal-plane placement</h3></summary><label class="compact-select">Focus offset · units<input data-research="focusOffset" type="number" min="-10000" max="10000" step=".01" value="${offset.toFixed(3)}" aria-label="Focus offset" style="width:110px" ${!primary || detector.locked ? 'disabled' : ''}></label><button id="research-focus" class="research-action bordered" ${!primary || detector.locked ? 'disabled' : ''}>Place at nominal focus</button><p class="note">Offset is relative to the primary’s forward focus. Setting it aligns the virtual screen to that axis; use ordinary transforms for a folded optical train. “Record after interactions” in the detector inspector controls whether it ignores incoming light.</p></details>`;
    updateResearch();
  }
  function updateResearch() {
    if (!$('research-map')) return;
    const data = researchData(),
      { primary, detector, hits, groups } = data;
    if ($('research-warning')) {
      $('research-warning').hidden = !trace.limited && !trace.seedLimited;
      $('research-warning').textContent = trace.limited
        ? 'Trace capped: power and spot statistics may be incomplete. Reduce density or interaction count.'
        : 'Source-sample budget reached. Statistics use the resampled rays, not the requested count.';
    }
    $('research-hit-count').textContent = hits.length.toLocaleString();
    $('research-power').textContent = data.stats.power.toFixed(3);
    $('spot-legend').innerHTML =
      groups
        .map(
          (g) =>
            `<span><i style="background:rgb(${sourceColor(g.source)
              .map((v) => Math.round(v * 255))
              .join(',')})"></i>${esc(g.source.name)}</span>`,
        )
        .join('') || '<span>No recorded hits</span>';
    $('source-results').innerHTML = groups
      .map((g) => {
        const st = spotStatistics(g.hits);
        return `<div class="source-result"><b>${esc(g.source.name)}</b><br>RMS radius <strong>${formatLength(st.rms)}</strong> · 80% radius ${formatLength(st.radius80)}<br>Centroid ${formatLength(st.centroid[0])}, ${formatLength(st.centroid[1])}</div>`;
      })
      .join('');
    const ref = telescopeReference(primary, state.settings.mmPerUnit, 550);
    $('telescope-reference').innerHTML = ref
      ? `<div class="ref-line"><span>Aperture</span><strong>${ref.diameterMm.toPrecision(4)} mm</strong></div><div class="ref-line"><span>Focal length</span><strong>${ref.focalMm.toPrecision(4)} mm · f/${ref.fNumber.toFixed(2)}</strong></div><div class="ref-line"><span>Plate scale</span><strong>${ref.plateScale.toFixed(2)} ″/mm</strong></div><div class="ref-line"><span>Rayleigh reference · 550 nm</span><strong>${ref.rayleighArcsec.toFixed(3)} ″</strong></div>`
      : '<p class="note">Select a curved primary or lens for focal length and diffraction-reference calculations.</p>';
    paintResearch(data);
  }
  function paintResearch(data) {
    const canvas = $('research-map');
    if (!canvas || !data.detector) return;
    const ctx = canvas.getContext('2d'),
      W = canvas.width,
      H = canvas.height,
      { detector, primary, hits, groups } = data,
      pad = 55,
      plotW = W - 2 * pad,
      plotH = H - 2 * pad;
    ctx.fillStyle = '#0b131e';
    ctx.fillRect(0, 0, W, H);
    const drawnGroups = groups.map((g) => ({
      ...g,
      stats: spotStatistics(g.hits),
      reference: telescopeReference(
        primary,
        state.settings.mmPerUnit,
        g.source.colorMode === 'wavelength' ? g.source.wavelength : 550,
      ),
    }));
    let center = [0, 0],
      halfW = detector.width / 2,
      halfH = detector.height / 2;
    if (state.settings.spotAutoFit && hits.length) {
      const lo = [Infinity, Infinity],
        hi = [-Infinity, -Infinity];
      for (const h of hits)
        for (let i = 0; i < 2; i++) {
          lo[i] = Math.min(lo[i], h.local[i]);
          hi[i] = Math.max(hi[i], h.local[i]);
        }
      for (const g of drawnGroups) {
        const r = state.settings.airyReference ? g.reference?.airyRadiusWorld || 0 : 0;
        for (let i = 0; i < 2; i++) {
          lo[i] = Math.min(lo[i], g.stats.centroid[i] - r);
          hi[i] = Math.max(hi[i], g.stats.centroid[i] + r);
        }
      }
      center = V.mix(lo, hi, 0.5);
      halfW = Math.max(1e-7, (hi[0] - lo[0]) * 0.68);
      halfH = Math.max(1e-7, (hi[1] - lo[1]) * 0.68);
    }
    const scale = Math.min(plotW / (2 * halfW), plotH / (2 * halfH)),
      origin = [W / 2, H / 2],
      project = (p) => [
        origin[0] + (p[0] - center[0]) * scale,
        origin[1] - (p[1] - center[1]) * scale,
      ];
    ctx.strokeStyle = '#243648';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const x = pad + (plotW * i) / 4,
        y = pad + (plotH * i) / 4;
      ctx.moveTo(x, pad);
      ctx.lineTo(x, H - pad);
      ctx.moveTo(pad, y);
      ctx.lineTo(W - pad, y);
    }
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, plotW, plotH);
    ctx.clip();
    for (const g of drawnGroups) {
      ctx.fillStyle = `rgba(${sourceColor(g.source)
        .map((v) => Math.round(v * 255))
        .join(',')},.54)`;
      for (const h of g.hits) {
        const [x, y] = project(h.local);
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const g of drawnGroups) {
      const [x, y] = project(g.stats.centroid);
      ctx.strokeStyle = `rgb(${sourceColor(g.source)
        .map((v) => Math.round(v * 255))
        .join(',')})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
      if (state.settings.airyReference && g.reference) {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(x, y, g.reference.airyRadiusWorld * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#a4b9c9';
    ctx.font = '26px system-ui';
    ctx.fillText(
      state.settings.spotAutoFit ? 'Geometric spots · auto-fit' : 'Geometric spots · full screen',
      pad,
      30,
    );
    ctx.fillStyle = '#8ba4b6';
    ctx.font = '26px monospace';
    ctx.textAlign = 'center';
    const spanX = plotW / scale;
    ctx.fillText('u span ' + formatLength(spanX), W / 2, H - 17);
    ctx.save();
    ctx.translate(21, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('v span ' + formatLength(plotH / scale), 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
    if (!hits.length) {
      ctx.fillStyle = '#a0b6c6';
      ctx.font = '22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No rays on this detector', W / 2, H / 2);
      ctx.font = '17px system-ui';
      ctx.fillText('Check focus position and path length', W / 2, H / 2 + 32);
      ctx.textAlign = 'left';
    }
  }
  function placeFocalPlane(offset = 0) {
    const { primary, detector } = researchObjects();
    if (!primary || !detector || detector.locked) return;
    mutate(() => {
      const f =
        primary.type === 'spherical'
          ? (primary.radius / 2) * (primary.curvature === 'convex' ? -1 : 1)
          : primary.focalLength;
      detector.p = V.add(primary.p, V.mul(basis(primary).n, f + offset)).map((v) =>
        clamp(v, -POSITION_LIMIT, POSITION_LIMIT),
      );
      detector.yaw = primary.yaw;
      detector.tilt = primary.tilt;
      detector.roll = primary.roll;
    });
    toast('Analysis plane positioned along the primary’s forward focus.');
  }
  function exportSpotCSV() {
    const { detector, hits } = researchData();
    if (!detector || !hits.length) {
      toast('There are no focal-plane hits to export.');
      return;
    }
    const quote = (v) => '"' + String(v).replace(/"/g, '""') + '"',
      lines = [
        'source,ray_index,u_world,v_world,u_mm,v_mm,x_world,y_world,z_world,power_arb,wavelength_nm,interactions',
      ];
    for (const h of hits)
      lines.push(
        [
          quote(object(h.sourceId)?.name || h.sourceId),
          h.rayIndex,
          h.local[0],
          h.local[1],
          h.local[0] * state.settings.mmPerUnit,
          h.local[1] * state.settings.mmPerUnit,
          ...h.point,
          h.energy,
          h.wavelength || 550,
          h.depth,
        ].join(','),
      );
    download(
      new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }),
      'lumen-focal-hits.csv',
    );
    toast(`${hits.length.toLocaleString()} geometric hit samples exported.`);
  }
  $('research-panel').addEventListener('change', (e) => {
    const key = e.target.dataset.research;
    if (!key) return;
    if (key === 'focusOffset') {
      const v = Number(e.target.value);
      if (Number.isFinite(v)) placeFocalPlane(clamp(v, -10000, 10000));
      return;
    }
    if (key === 'mmPerUnit') {
      const v = Number(e.target.value);
      if (!Number.isFinite(v) || v <= 0) {
        toast('World scale must be positive.');
        renderResearch();
        return;
      }
      mutate(() => (state.settings.mmPerUnit = clamp(v, 0.001, 1000000)), { traceRequired: false });
    } else
      mutate(
        () =>
          (state.settings[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value),
        { traceRequired: false },
      );
  });

  function renderExamples() {
    $('quick-examples').innerHTML = ['focus', 'collimator', 'splitter', 'rgb', 'lens']
      .map(
        (k) =>
          `<button class="example-mini ${state.preset === k ? 'active' : ''}" data-preset="${k}">${icon(PRESETS[k].icon)}<span><b>${PRESETS[k].title}</b><small>${{ focus: 'A true 3D point focus', collimator: 'From a point to a beam', splitter: 'Two power-weighted paths', rgb: 'Independent light colors', lens: 'Converging thin lens' }[k]}</small></span></button>`,
      )
      .join('');
    $('examples-grid').innerHTML = Object.entries(PRESETS)
      .map(
        ([k, p]) =>
          `<button class="example-card ${state.preset === k ? 'active' : ''}" data-preset="${k}">${icon(p.icon)}<div><h3>${p.title}</h3><p>${p.subtitle}</p></div></button>`,
      )
      .join('');
  }
  function syncButtons() {
    for (const [id, key] of [
      ['grid-button', 'grid'],
      ['normals-button', 'normals'],
      ['foci-button', 'foci'],
      ['snap-button', 'snap'],
      ['play-button', 'animate'],
    ]) {
      $(id).classList.toggle('active', state.settings[key]);
      $(id).setAttribute('aria-pressed', String(state.settings[key]));
    }
    $('play-button').innerHTML = icon(state.settings.animate ? 'pause' : 'play');
    $('live-label').textContent = state.settings.animate ? 'LIVE TRACE' : 'FLOW PAUSED';
  }
  function loadPreset(name) {
    mutate(() => {
      state = createPreset(name);
      isolateSource = null;
      selection.clear();
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) state.settings.animate = false;
      selected = state.objects.find((o) => !isSource(o))?.id || state.objects[0]?.id || null;
    });
    setView('3d');
    setMode('select');
    $('examples-dialog').close();
    if (innerWidth <= 980) $('left-dock').classList.remove('mobile-open');
    toast(PRESETS[name].title + ' loaded.');
  }
  function nextId() {
    return 'o' + (1 + Math.max(0, ...state.objects.map((o) => parseInt(o.id.slice(1)) || 0)));
  }
  function addComponent(type, p = null) {
    if (state.objects.length >= 80) {
      toast('This workbench supports up to 80 objects.');
      return;
    }
    mutate(() => {
      let at = p
        ? [...p]
        : V.add(renderer.camera.target, isSource({ type }) ? [-5, 0, 0] : [0, 0, 0]);
      if (!p)
        for (let i = 0; i < 12 && state.objects.some((o) => V.len(V.sub(o.p, at)) < 0.7); i++)
          at = V.add(at, [0.6, 0, 0.5]);
      const o = createObject(type, nextId(), at);
      const same = state.objects.filter((q) => q.type === type).length;
      if (same) o.name += ' ' + (same + 1);
      state.objects.push(o);
      selected = o.id;
      selection = new Set([o.id]);
    });
    setMode('move');
    setRightTab('object');
    if (innerWidth <= 980) $('left-dock').classList.remove('mobile-open');
    showRight();
    toast(CATALOG[type].label + ' added. Drag it to position it.');
  }
  function duplicate() {
    const items = selectedObjects();
    if (!items.length) return;
    try {
      const copies = cloneObjects(state, {
        format: 'lumen-objects',
        sceneUid: state.uid,
        objects: items,
      });
      mutate(() => {
        state.objects.push(...copies);
        selection = new Set(copies.map((o) => o.id));
        selected = copies.at(-1).id;
      });
      toast(`${copies.length} object${copies.length === 1 ? '' : 's'} duplicated.`);
    } catch (e) {
      toast(e.message);
    }
  }
  function removeSelected() {
    const items = selectedObjects();
    if (!items.length) return;
    if (items.some((o) => o.locked)) {
      toast('Unlock all selected objects before deleting them.');
      return;
    }
    mutate(() => {
      state.objects = state.objects.filter((o) => !selection.has(o.id));
      selection.clear();
      selected = state.objects[0]?.id || null;
    });
    toast('Selection removed.');
  }
  function resizeSoon() {
    requestAnimationFrame(() => {
      renderer.resize();
      dirty = true;
      rayCache = null;
    });
  }
  function setMode(next) {
    mode = next;
    axis = null;
    document.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === next);
      b.setAttribute('aria-pressed', String(b.dataset.mode === next));
    });
    document.querySelectorAll('[data-axis]').forEach((b) => b.classList.remove('active'));
    $('mode-hint').textContent =
      next === 'select'
        ? 'Drag to orbit · Right-drag to pan · Scroll to zoom'
        : next === 'move'
          ? 'Drag object or axis · Shift for height · X / Y / Z constrain'
          : 'Drag object to rotate · X / Y / Z constrain';
    canvas.style.cursor = next === 'select' ? 'grab' : next === 'move' ? 'move' : 'crosshair';
    dirty = true;
  }
  function setAxis(next) {
    axis = axis === next ? null : next;
    document
      .querySelectorAll('[data-axis]')
      .forEach((b) => b.classList.toggle('active', b.dataset.axis === axis));
    dirty = true;
  }
  function cameraChanged() {
    renderer.updateCamera();
    dirty = true;
    rayCache = null;
  }
  function frameScene(single = false) {
    const targets = single && current() ? selectedObjects() : state.objects,
      pts = [];
    if (!targets.length) {
      renderer.camera.target = [0, 2, 0];
      renderer.camera.radius = 22;
      cameraChanged();
      return;
    }
    for (const o of targets) {
      let r = isSource(o)
        ? o.type === 'beam'
          ? Math.max(0.5, o.aperture / 2)
          : 0.65
        : o.type === 'glass'
          ? o.radius
          : ['parabola', 'spherical', 'lens'].includes(o.type)
            ? o.diameter / 2
            : Math.max(o.width, o.height) / 2;
      r = Math.max(0.5, r);
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          for (const c of [-1, 1]) pts.push(V.add(o.p, [a * r, b * r, c * r]));
    }
    const min = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))),
      max = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
    renderer.camera.target = V.mix(min, max, 0.5);
    renderer.updateCamera();
    let extent = 0;
    const aspect = renderer.width / renderer.height;
    for (const p of pts) {
      const q = V.sub(p, renderer.camera.target),
        depth = -V.dot(q, renderer.forward);
      extent = Math.max(
        extent,
        Math.abs(V.dot(q, renderer.up)) / Math.tan(renderer.fov / 2) + depth,
        Math.abs(V.dot(q, renderer.right)) / (Math.tan(renderer.fov / 2) * aspect) + depth,
      );
    }
    renderer.camera.radius = clamp(extent * 1.15, 1, 5000000);
    cameraChanged();
  }
  function setView(next) {
    view = next;
    const c = renderer.camera;
    if (next === '3d') {
      c.yaw = 2.26;
      c.pitch = 0.43;
      c.orthographic = false;
      if (state.preset === 'relay') {
        c.yaw = 1.0;
        c.pitch = 0.49;
      }
      frameScene();
    } else {
      c.orthographic = true;
      if (next === 'top') {
        c.yaw = Math.PI / 2;
        c.pitch = Math.PI / 2 - 0.00001;
      } else if (next === 'front') {
        c.yaw = Math.PI / 2;
        c.pitch = 0;
      } else {
        c.yaw = Math.PI;
        c.pitch = 0;
      }
      frameScene();
    }
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.classList.toggle('active', b.dataset.view === next));
    $('view-caption').textContent = state.settings.starMode
      ? 'TELESCOPE WORKSPACE'
      : next === '3d'
        ? '3D OPTICS WORKSPACE'
        : next.toUpperCase() + ' · ORTHOGRAPHIC';
    $('view-chip').textContent =
      next === '3d' ? 'Perspective' : next[0].toUpperCase() + next.slice(1);
    cameraChanged();
    if (rightTab === 'simulation') renderSimulation();
  }
  function customView() {
    view = 'custom';
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
    $('view-caption').textContent = renderer.camera.orthographic
      ? '3D · ORTHOGRAPHIC'
      : '3D OPTICS WORKSPACE';
  }
  function focusMode() {
    document.body.classList.toggle('focus');
    resizeSoon();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      else
        toast('Fullscreen is unavailable in this browser. Use Tab for the canvas-only workspace.');
    } catch {
      toast(
        'Browser fullscreen was blocked. The app still fills its browser window; Tab hides the interface.',
      );
    }
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function saveFile() {
    endEdit();
    download(
      new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }),
      `lumen-${state.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 40)}.json`,
    );
    toast('Scene saved as JSON.');
  }
  function screenshot() {
    exportAfterFrame = true;
    dirty = true;
  }
  function makeScreenshot() {
    exportAfterFrame = false;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const scale = out.width / renderer.width;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = '#d1e1e5';
    ctx.font = '500 15px sans-serif';
    ctx.fillText('lumen / ' + state.name, 22, 30);
    ctx.fillStyle = '#7293a7';
    ctx.font = '10px monospace';
    ctx.fillText('3D GEOMETRIC OPTICS', 22, 47);
    if (state.settings.labels)
      for (const l of labels) {
        if (!l.id) continue;
        const q = renderer.project(labelPosition(object(l.id)));
        if (q.visible) {
          ctx.font = '10px monospace';
          const name = object(l.id)?.name || '',
            w = ctx.measureText(name).width + 14;
          ctx.fillStyle = '#102333dd';
          ctx.fillRect(q.x - w / 2, q.y - 19, w, 19);
          ctx.fillStyle = '#b6d4d8';
          ctx.fillText(name, q.x - w / 2 + 7, q.y - 6);
        }
      }
    ctx.restore();
    out.toBlob((blob) => {
      if (blob) {
        download(blob, 'lumen-view.png');
        toast('Viewport exported as PNG.');
      } else toast('Image export failed.');
    }, 'image/png');
  }
  function editControl(el) {
    const k = el.dataset.prop,
      setting = el.dataset.setting;
    if (!k && !setting) return;
    const o = setting ? state.settings : current();
    if (!o) return;
    if (
      !setting &&
      ((o.locked && (/^p\d$/.test(k) || ['yaw', 'tilt', 'roll'].includes(k))) ||
        (o.aimTarget && ['yaw', 'tilt'].includes(k)))
    ) {
      syncInspectorFields();
      return;
    }
    beginEdit();
    const key = setting || k;
    let value;
    if (el.type === 'checkbox') value = el.checked;
    else if (
      ['name', 'type', 'curvature', 'colorMode', 'color', 'rayStyle', 'rayStage'].includes(key)
    )
      value = el.value;
    else {
      if (!el.value.trim() || !Number.isFinite(Number(el.value))) {
        syncInspectorFields();
        return;
      }
      value = clamp(Number(el.value), Number(el.min), Number(el.max));
    }
    if (key === 'color') {
      if (!/^#[\da-f]{6}$/i.test(value)) {
        toast('Use a six-digit hex color, such as #80C7FF.');
        syncInspectorFields();
        return;
      }
      value = value.toLowerCase();
    }
    if (key === 'name') value = value.trim().slice(0, 60) || CATALOG[o.type].label;
    if (['count', 'maxBounces', 'minDepth', 'displayBudget'].includes(key))
      value = Math.round(value);
    if (key === 'focalLength' && Math.abs(value) < 0.3) value = value < 0 ? -0.3 : 0.3;
    if (/^p\d$/.test(key)) o.p[Number(key[1])] = value;
    else o[key] = value;
    if (el.type !== 'checkbox') el.value = String(value);
    if (!setting && o.type === 'spherical') o.diameter = Math.min(o.diameter, o.radius * 1.98);
    if (!setting && o.type === 'aperture') o.hole = Math.min(o.hole, o.width, o.height);
    const parent = setting ? $('simulation-panel') : $('inspector');
    parent.querySelectorAll(`[data-${setting ? 'setting' : 'prop'}="${key}"]`).forEach((e) => {
      if (e !== el) {
        if (e.type === 'checkbox') e.checked = value;
        else {
          if (e.type === 'range' && Number(value) > Number(e.max))
            e.max = String(Math.min(Number(el.max), Math.ceil(Number(value) * 1.5)));
          if (e.type === 'range' && Number(value) < Number(e.min))
            e.min = String(Math.max(Number(el.min), Math.floor(Number(value) * 1.5)));
          e.value = value;
        }
      }
      if (e.type === 'range') setRangeFill(e);
    });
    if (['curvature', 'colorMode', 'type'].includes(key)) {
      if (key === 'type' && value !== 'laser' && o.count <= 1)
        o.count = value === 'star' ? 768 : value === 'point' ? 192 : 61;
      renderInspector();
    }
    if (
      key === 'enabled' ||
      key === 'name' ||
      key === 'color' ||
      key === 'colorMode' ||
      key === 'type' ||
      key === 'wavelength'
    )
      renderList();
    if (key === 'ratio' && $('split-ratio'))
      $('split-ratio').textContent =
        `${Math.round(o.ratio * 100)}% reflected · ${Math.round((1 - o.ratio) * 100)}% transmitted. Both paths are traced.`;
    if (['radius', 'width', 'height'].includes(key)) {
      const dependent = o.type === 'spherical' ? 'diameter' : o.type === 'aperture' ? 'hole' : null;
      if (dependent) {
        parent.querySelectorAll(`[data-prop="${dependent}"]`).forEach((e) => {
          e.max =
            dependent === 'diameter'
              ? Math.min(10000, o.radius * 1.98)
              : Math.min(o.width, o.height);
          e.value = o[dependent];
        });
      }
    }
    syncButtons();
    $('stage').dataset.starMode = String(state.settings.starMode);
    markChanged({ traceRequired: setting ? TRACE_SETTINGS.has(key) : key !== 'name' });
  }
  for (const root of [$('inspector'), $('simulation-panel')]) {
    root.addEventListener('focusin', (e) => {
      if (e.target.matches('[data-prop],[data-setting]')) beginEdit();
    });
    root.addEventListener('input', (e) => {
      if (e.target.matches('input[type=range],input[type=color]')) editControl(e.target);
    });
    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-prop],[data-setting]')) {
        editControl(e.target);
        endEdit();
      }
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
    });
  }
  document.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    closeMenus();
    if (button.dataset.add) {
      addComponent(button.dataset.add);
      return;
    }
    if (button.dataset.preset) {
      loadPreset(button.dataset.preset);
      $('star-dialog').close();
      if (state.settings.starMode) {
        setRightTab('research');
        showRight();
      }
      return;
    }
    if (button.dataset.mode) {
      setMode(button.dataset.mode);
      return;
    }
    if (button.dataset.axis) {
      setAxis(button.dataset.axis);
      return;
    }
    if (button.dataset.view) {
      setView(button.dataset.view);
      return;
    }
    if (button.dataset.leftTab) {
      setLeftTab(button.dataset.leftTab);
      return;
    }
    if (button.dataset.rightTab) {
      setRightTab(button.dataset.rightTab);
      return;
    }
    if (button.dataset.close) {
      $(button.dataset.close).close();
      return;
    }
    if (button.dataset.color) {
      mutate(() => {
        const o = current();
        if (o) {
          o.color = button.dataset.color;
          o.colorMode = 'rgb';
        }
      });
      return;
    }
    const id = button.id;
    if (['add-button', 'add-object', 'empty-add', 'inspector-add'].includes(id)) openLibrary();
    else if (['examples-button', 'all-examples'].includes(id)) $('examples-dialog').showModal();
    else if (['guide-button', 'status-help'].includes(id)) $('guide-dialog').showModal();
    else if (id === 'undo-button') undo();
    else if (id === 'redo-button') undo(true);
    else if (['duplicate-button', 'duplicate-scene'].includes(id)) duplicate();
    else if (['copy-object', 'copy-button'].includes(id)) copySelection();
    else if (id === 'cut-button') copySelection(true);
    else if (id === 'paste-button' || id === 'paste-in-place')
      pasteSelection(id === 'paste-in-place');
    else if (id === 'select-all') selectAll();
    else if (['delete-object', 'delete-selection'].includes(id)) removeSelected();
    else if (id === 'star-lab-button' || id === 'research-open-star') $('star-dialog').showModal();
    else if (id === 'add-star-current') {
      $('star-dialog').close();
      addComponent('star');
      mutate(() => (state.settings.starMode = true), { traceRequired: false });
    } else if (id === 'analyze-current') {
      $('star-dialog').close();
      setRightTab('research');
      showRight();
    } else if (id === 'view-settings') {
      setRightTab('simulation');
      showRight();
    } else if (id === 'aim-once' || id === 'lock-target') {
      const o = current(),
        target = object($('aim-target')?.value);
      if (!o || !isSource(o)) return;
      if (id === 'lock-target' && o.aimTarget) {
        mutate(() => (o.aimTarget = null));
        toast('Target released. Direction is now free.');
        return;
      }
      if (o.locked) {
        toast('Unlock the source transform first.');
        return;
      }
      if (!target) {
        toast('Choose a target object first.');
        return;
      }
      if (V.len(V.sub(target.p, o.p)) < 1e-6) {
        toast('Move the source away from the target center before aiming.');
        return;
      }
      mutate(() => {
        o.aimTarget = id === 'lock-target' ? target.id : null;
        aim(o, target.p);
      });
      toast(
        id === 'lock-target'
          ? 'Target locked. The source follows both objects’ movement.'
          : 'Direction set once.',
      );
    } else if (id === 'isolate-source') {
      isolateSource = isolateSource === selected ? null : selected;
      rayCache = null;
      dirty = true;
      renderInspector();
      toast(
        isolateSource
          ? 'Only this source is drawn. All sources remain in the analysis.'
          : 'All sources are visible.',
      );
    } else if (id === 'frame-selection') frameScene(true);
    else if (id === 'research-ray-stage') {
      mutate(
        () =>
          (state.settings.rayStage =
            state.settings.rayStage === 'interacted' ? 'all' : 'interacted'),
        { traceRequired: false },
      );
    } else if (id === 'research-export') exportSpotCSV();
    else if (id === 'research-focus') placeFocalPlane();
    else if (id === 'flow-menu-button') {
      $('play-button').click();
    } else if (id === 'lock-object')
      mutate(
        () => {
          if (current()) current().locked = !current().locked;
        },
        { traceRequired: false },
      );
    else if (id === 'save-button') saveFile();
    else if (id === 'load-button') $('scene-file').click();
    else if (id === 'new-button') $('confirm-dialog').showModal();
    else if (id === 'confirm-new') {
      $('confirm-dialog').close();
      loadPreset('empty');
    } else if (id === 'frame-button' || id === 'viewport-frame') frameScene();
    else if (['focus-button', 'focus-exit', 'simulation-focus'].includes(id)) focusMode();
    else if (['fullscreen-button', 'simulation-fullscreen'].includes(id)) fullscreen();
    else if (id === 'screenshot-button') screenshot();
    else if (
      ['grid-button', 'normals-button', 'foci-button', 'play-button', 'snap-button'].includes(id)
    ) {
      const k = {
        'grid-button': 'grid',
        'normals-button': 'normals',
        'foci-button': 'foci',
        'play-button': 'animate',
        'snap-button': 'snap',
      }[id];
      mutate(() => (state.settings[k] = !state.settings[k]), {
        refresh: false,
        traceRequired: false,
      });
      syncButtons();
      if (rightTab === 'simulation') renderSimulation();
    } else if (id === 'left-toggle') {
      if (innerWidth <= 980) {
        $('left-dock').classList.toggle('mobile-open');
        $('right-dock').classList.remove('mobile-open');
      } else document.body.classList.toggle('left-hidden');
      resizeSoon();
    } else if (id === 'right-toggle') {
      if (innerWidth <= 720) {
        $('right-dock').classList.toggle('mobile-open');
        $('left-dock').classList.remove('mobile-open');
      } else document.body.classList.toggle('right-hidden');
      resizeSoon();
    } else if (id === 'left-close') $('left-dock').classList.remove('mobile-open');
    else if (id === 'right-close') $('right-dock').classList.remove('mobile-open');
  });
  $('object-list').addEventListener('click', (e) => {
    const vis = e.target.closest('[data-visible]');
    if (vis) {
      mutate(() => {
        const o = object(vis.dataset.visible);
        if (o) o.enabled = !o.enabled;
      });
      return;
    }
    const row = e.target.closest('[data-select]');
    if (row) select(row.dataset.select, true, e.shiftKey);
  });
  $('object-list').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const row = e.target.closest('[data-select]');
      if (row) {
        e.preventDefault();
        select(row.dataset.select, true);
      }
    }
  });
  $('inspector').addEventListener('change', (e) => {
    if (e.target.id === 'aim-target' && current()?.aimTarget) {
      const target = object(e.target.value);
      if (target)
        mutate(() => {
          current().aimTarget = target.id;
          aim(current(), target.p);
        });
    }
  });
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.menu[open]').forEach((m) => {
      if (!m.contains(e.target)) m.open = false;
    });
  });
  document.querySelectorAll('.menu').forEach((m) =>
    m.addEventListener('toggle', () => {
      if (m.open)
        document.querySelectorAll('.menu').forEach((n) => {
          if (n !== m) n.open = false;
        });
    }),
  );
  document.addEventListener('paste', (e) => {
    if (e.target.matches('input,select,textarea') || e.target.isContentEditable) return;
    try {
      const payload = JSON.parse(e.clipboardData.getData('text/plain'));
      if (payload.format === 'lumen-objects') {
        e.preventDefault();
        pastePayload(payload);
      }
    } catch {}
  });

  $('simulation-panel').addEventListener('change', (e) => {
    if (e.target.id === 'invert-orbit') {
      preferences.invertOrbit = e.target.checked;
      try {
        localStorage.setItem('lumen-preferences', JSON.stringify(preferences));
      } catch {}
      toast(preferences.invertOrbit ? 'Horizontal orbit inverted.' : 'Grab-style orbit restored.');
    }
    if (e.target.id === 'projection') {
      renderer.camera.orthographic = e.target.value === 'orthographic';
      customView();
      cameraChanged();
    }
  });
  $('component-search').addEventListener('input', renderLibrary);
  $('scene-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('Scene file is too large (2 MB limit).');
      const next = validateScene(JSON.parse(await file.text()));
      mutate(() => {
        state = next;
        isolateSource = null;
        selection.clear();
        selected = state.objects.find((o) => !isSource(o))?.id || state.objects[0]?.id || null;
      });
      setView('3d');
      toast('Scene opened.');
    } catch (error) {
      toast(error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message);
    } finally {
      e.target.value = '';
    }
  });
  for (const d of document.querySelectorAll('dialog'))
    d.addEventListener('click', (e) => {
      if (e.target === d) {
        const b = d.getBoundingClientRect();
        if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom)
          d.close();
      }
    });
  document.addEventListener('fullscreenchange', () => {
    $('fullscreen-button').classList.toggle('active', !!document.fullscreenElement);
    resizeSoon();
  });
  function labelPosition(o) {
    if (!o) return [0, 0, 0];
    if (isSource(o))
      return V.add(o.p, [
        0,
        (o.type === 'beam'
          ? Math.max(0.55, o.aperture / 2)
          : o.type === 'area'
            ? o.height / 2
            : 0.6) + 0.35,
        0,
      ]);
    const b = basis(o);
    if (o.type === 'glass') return V.add(o.p, [0, o.radius + 0.45, 0]);
    const y = ['parabola', 'spherical', 'lens'].includes(o.type) ? o.diameter / 2 : o.height / 2;
    return V.add(o.p, worldVec([0, y + 0.3, surfaceZ(o, 0, y)], b));
  }
  function rebuildLabels() {
    $('labels').replaceChildren();
    labels = [];
    for (const o of state.objects) {
      if (!o.enabled || (!state.settings.labels && !selection.has(o.id))) continue;
      const el = document.createElement('button');
      el.className = 'object-label' + (o.id === selected ? ' selected' : '');
      el.innerHTML = `<span class="label-dot"></span>${esc(o.name)}`;
      el.setAttribute('aria-label', 'Inspect ' + o.name);
      if (isSource(o))
        el.style.color = `rgb(${sourceColor(o)
          .map((v) => Math.round(v * 255))
          .join(',')})`;
      el.addEventListener('click', () => select(o.id, true));
      el.addEventListener('dblclick', () => {
        select(o.id);
        frameScene(true);
      });
      $('labels').append(el);
      labels.push({ el, id: o.id });
    }
    if (state.settings.foci)
      for (const o of state.objects) {
        if (!o.enabled) continue;
        const points = focalPoints(o);
        points.forEach((p, i) => {
          const el = document.createElement('span');
          el.className = 'focus-label';
          el.textContent =
            (o.type === 'spherical'
              ? 'F ≈ '
              : o.type === 'trough'
                ? 'F · line'
                : points.length > 1
                  ? `F${i + 1}`
                  : 'F') +
            (o.type === 'spherical'
              ? ((o.radius / 2) * (o.curvature === 'convex' ? -1 : 1)).toFixed(2) +
                (o.curvature === 'convex' ? ' · virtual' : '')
              : '');
          $('labels').append(el);
          labels.push({ el, p });
        });
      }
  }
  function updateLabels() {
    for (const l of labels) {
      const p = l.id ? labelPosition(object(l.id)) : l.p,
        q = renderer.project(p);
      l.el.style.display = q.visible ? '' : 'none';
      if (q.visible)
        l.el.style.transform = `translate(${q.x.toFixed(1)}px,${q.y.toFixed(1)}px) translate(-50%,-110%)`;
    }
    const colors = ['#db9489', '#8dcbb1', '#88aee6'],
      ends = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ]
        .map((a, i) => ({
          i,
          x: 40 + V.dot(a, renderer.right) * 25,
          y: 40 - V.dot(a, renderer.up) * 25,
          z: V.dot(a, renderer.forward),
        }))
        .sort((a, b) => b.z - a.z);
    $('axis-svg').innerHTML =
      '<circle cx="40" cy="40" r="2" fill="#678298" stroke="none"/>' +
      ends
        .map(
          (a) =>
            `<g data-axis-view="${['side', 'top', 'front'][a.i]}"><line x1="40" y1="40" x2="${a.x}" y2="${a.y}" stroke="${colors[a.i]}" opacity=".65"/><circle cx="${a.x}" cy="${a.y}" r="8" stroke="${colors[a.i]}" stroke-width=".7" fill="#172637"/><text x="${a.x}" y="${a.y + 3}" fill="${colors[a.i]}" text-anchor="middle">${['X', 'Y', 'Z'][a.i]}</text></g>`,
        )
        .join('');
  }
  $('axis-svg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-axis-view]');
    if (b) setView(b.dataset.axisView);
  });
  const grid = [];
  for (let i = -24; i <= 24; i++)
    if (i !== 0) grid.push([i, 0, -24], [i, 0, 24], [-24, 0, i], [24, 0, i]);
  const xAxis = [
      [-24, 0.003, 0],
      [24, 0.003, 0],
    ],
    zAxis = [
      [0, 0.003, -24],
      [0, 0.003, 24],
    ];
  const rgba = (c, a = 1) => [...c, a];
  function ring(p, u, v, r, color, steps = 64) {
    const pts = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2,
        b = ((i + 1) / steps) * Math.PI * 2;
      pts.push(
        V.add(p, V.add(V.mul(u, r * Math.cos(a)), V.mul(v, r * Math.sin(a)))),
        V.add(p, V.add(V.mul(u, r * Math.cos(b)), V.mul(v, r * Math.sin(b)))),
      );
    }
    renderer.lines(pts, color);
  }
  function dash(a, b, color, step = 0.22) {
    const d = V.sub(b, a),
      l = V.len(d),
      pts = [];
    step = Math.max(step, l / 500);
    if (l < 1e-6) return;
    for (let t = 0; t < l; t += step)
      pts.push(V.add(a, V.mul(d, t / l)), V.add(a, V.mul(d, Math.min(l, t + step * 0.5) / l)));
    renderer.lines(pts, color);
  }
  function support(o, r = 0.3) {
    if (state.settings.starMode || o.p[1] <= 0.1 || o.p[1] > 30) return;
    const p = o.p;
    renderer.draw(
      'cylinder',
      M.model([p[0], 0.045, p[2]], undefined, undefined, undefined, [r, 0.085, r]),
      [0.15, 0.22, 0.27, 1],
    );
    renderer.draw(
      'cylinder',
      M.model([p[0], 0.09, p[2]], undefined, undefined, undefined, [r * 0.7, 0.015, r * 0.7]),
      [0.27, 0.36, 0.4, 1],
    );
    renderer.segment([p[0], 0.1, p[2]], p, 0.024, [0.26, 0.37, 0.43, 1], 'cylinder', false);
  }
  function localPoint(o, p) {
    return V.add(o.p, worldVec(p, basis(o)));
  }
  function curvedMesh(o) {
    const key = [
      o.type,
      o.diameter,
      o.focalLength,
      o.radius,
      o.curvature,
      o.width,
      o.height,
      o.hole,
    ].join('|');
    if (curveKeys.get(o.id) !== key) {
      if (o.type === 'aperture') {
        renderer.disposeMesh('curve-' + o.id);
        const d = { positions: [], normals: [], indices: [] };
        for (let i = 0; i < 80; i++) {
          const angles = [(i / 80) * Math.PI * 2, ((i + 1) / 80) * Math.PI * 2],
            radii = angles.map((a) =>
              Math.min(
                o.width / 2 / Math.max(1e-10, Math.abs(Math.cos(a))),
                o.height / 2 / Math.max(1e-10, Math.abs(Math.sin(a))),
              ),
            );
          const ps = [
              [angles[0], o.hole / 2],
              [angles[0], radii[0]],
              [angles[1], radii[1]],
              [angles[1], o.hole / 2],
            ],
            k = d.positions.length / 3;
          for (const [a, r] of ps) {
            d.positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
            d.normals.push(0, 0, 1);
          }
          d.indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
        }
        renderer.meshes['curve-' + o.id] = renderer.upload(d);
      } else renderer.curve('curve-' + o.id, o);
      curveKeys.set(o.id, key);
    }
    return 'curve-' + o.id;
  }
  function drawSource(o) {
    const b = basis(o),
      c = sourceColor(o),
      sel = selection.has(o.id),
      body = V.add(o.p, V.mul(b.n, -0.35));
    support({ ...o, p: body }, 0.31);
    if (o.type === 'star') {
      const center = V.add(
        o.p,
        worldVec(
          [
            -Math.tan(rad(o.fieldX || 0)) * (o.aimDistance || 0),
            -Math.tan(rad(o.fieldY || 0)) * (o.aimDistance || 0),
            0,
          ],
          b,
        ),
      );
      ring(center, b.u, b.v, o.aperture / 2, rgba(c, 0.6));
      for (const sign of [-1, 1]) {
        renderer.lines(
          [
            V.add(center, V.mul(b.u, sign * o.aperture * 0.46)),
            V.add(center, V.mul(b.u, sign * o.aperture * 0.55)),
            V.add(center, V.mul(b.v, sign * o.aperture * 0.46)),
            V.add(center, V.mul(b.v, sign * o.aperture * 0.55)),
          ],
          rgba(c, 0.8),
        );
      }
      renderer.sphere(center, 0.055, rgba(c, 0.85));
    } else if (o.type === 'point') {
      renderer.sphere(o.p, 0.16, rgba(c, 0.95));
      for (const a of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
        for (const s of [-1, 1])
          renderer.segment(
            V.add(o.p, V.mul(a, s * 0.22)),
            V.add(o.p, V.mul(a, s * 0.42)),
            0.01,
            rgba(c, 0.55),
          );
    } else {
      renderer.segment(
        V.add(o.p, V.mul(b.n, -0.7)),
        V.add(o.p, V.mul(b.n, -0.06)),
        0.14,
        [0.24, 0.3, 0.34, 1],
        'cylinder',
        false,
      );
      for (const z of [-0.68, -0.58, -0.1])
        renderer.segment(
          V.add(o.p, V.mul(b.n, z - 0.025)),
          V.add(o.p, V.mul(b.n, z + 0.025)),
          0.16,
          [0.39, 0.46, 0.47, 1],
          'cylinder',
          false,
        );
      renderer.segment(V.add(o.p, V.mul(b.n, -0.05)), o.p, 0.12, rgba(c, 1), 'cylinder');
      renderer.sphere(o.p, 0.04, [1, 0.93, 0.8, 1]);
      if (o.type === 'beam' && o.aperture > 0.4) {
        ring(o.p, b.u, b.v, o.aperture / 2, rgba(c, 0.55));
        ring(
          V.add(o.p, V.mul(b.n, -0.035)),
          b.u,
          b.v,
          o.aperture / 2 + 0.025,
          [0.38, 0.48, 0.51, 0.6],
        );
      }
      if (o.type === 'line')
        renderer.segment(
          V.add(o.p, V.mul(b.u, -o.width / 2)),
          V.add(o.p, V.mul(b.u, o.width / 2)),
          0.018,
          rgba(c, 0.75),
        );
      if (o.type === 'area') {
        const pts = [
          [-o.width / 2, -o.height / 2, 0],
          [o.width / 2, -o.height / 2, 0],
          [o.width / 2, o.height / 2, 0],
          [-o.width / 2, o.height / 2, 0],
        ].map((p) => localPoint(o, p));
        for (let i = 0; i < 4; i++)
          renderer.segment(pts[i], pts[(i + 1) % 4], 0.012, rgba(c, 0.65));
      }
      if (o.type === 'spot' && o.spread > 0) {
        const r = Math.tan(rad(Math.min(o.spread, 70))) * 0.6;
        ring(V.add(o.p, V.mul(b.n, 0.6)), b.u, b.v, r, rgba(c, 0.22));
      }
    }
    if (sel && !state.settings.starMode && Math.abs(o.p[1]) < 30)
      ring([o.p[0], 0.009, o.p[2]], [1, 0, 0], [0, 0, 1], 0.48, [0.5, 0.84, 0.72, 0.55]);
  }
  function drawOptic(o) {
    const b = basis(o),
      sel = selection.has(o.id),
      edge = sel ? [0.52, 0.87, 0.75, 1] : [0.37, 0.52, 0.6, 1];
    support(o, 0.36);
    if (['parabola', 'trough', 'spherical'].includes(o.type)) {
      const name = curvedMesh(o);
      gl.depthMask(false);
      renderer.draw(name, M.model(o.p, b.u, b.v, b.n), [0.36, 0.58, 0.7, 0.62], false, true);
      gl.depthMask(true);
      const pts = [];
      if (o.type === 'trough') {
        for (const y of [-o.height / 2, o.height / 2])
          for (let i = 0; i < 64; i++) {
            const x = (i / 64 - 0.5) * o.width,
              xx = ((i + 1) / 64 - 0.5) * o.width;
            pts.push(
              localPoint(o, [x, y, surfaceZ(o, x, y)]),
              localPoint(o, [xx, y, surfaceZ(o, xx, y)]),
            );
          }
        for (const x of [-o.width / 2, o.width / 2])
          pts.push(
            localPoint(o, [x, -o.height / 2, surfaceZ(o, x, 0)]),
            localPoint(o, [x, o.height / 2, surfaceZ(o, x, 0)]),
          );
        const grid = [];
        for (let i = 1; i < 8; i++) {
          const x = (i / 8 - 0.5) * o.width;
          grid.push(
            localPoint(o, [x, -o.height / 2, surfaceZ(o, x, 0)]),
            localPoint(o, [x, o.height / 2, surfaceZ(o, x, 0)]),
          );
        }
        renderer.lines(grid, [0.4, 0.66, 0.76, 0.18]);
      } else {
        const R = o.diameter / 2;
        for (let i = 0; i < 80; i++) {
          for (const a of [(i / 80) * Math.PI * 2, ((i + 1) / 80) * Math.PI * 2]) {
            const x = R * Math.cos(a),
              y = R * Math.sin(a);
            pts.push(localPoint(o, [x, y, surfaceZ(o, x, y)]));
          }
        }
        const mesh = [];
        for (const fraction of [0.25, 0.5, 0.75]) {
          const r = R * fraction;
          for (let i = 0; i < 64; i++) {
            for (const a of [(i / 64) * Math.PI * 2, ((i + 1) / 64) * Math.PI * 2]) {
              const x = r * Math.cos(a),
                y = r * Math.sin(a);
              mesh.push(localPoint(o, [x, y, surfaceZ(o, x, y)]));
            }
          }
        }
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          for (let j = 0; j < 16; j++)
            for (const r of [(j / 16) * R, ((j + 1) / 16) * R]) {
              const x = r * Math.cos(a),
                y = r * Math.sin(a);
              mesh.push(localPoint(o, [x, y, surfaceZ(o, x, y)]));
            }
        }
        renderer.lines(mesh, [0.42, 0.66, 0.75, 0.17]);
      }
      renderer.lines(pts, edge);
    } else if (o.type === 'glass') {
      gl.depthMask(false);
      renderer.draw(
        'sphere',
        M.model(o.p, undefined, undefined, undefined, [o.radius, o.radius, o.radius]),
        [0.27, 0.5, 0.7, 0.18],
        false,
        true,
      );
      for (const [u, v] of [
        [b.u, b.v],
        [b.n, b.v],
        [b.u, b.n],
      ])
        ring(o.p, u, v, o.radius, sel ? [0.53, 0.88, 0.77, 0.6] : [0.46, 0.67, 0.78, 0.37]);
      gl.depthMask(true);
    } else if (o.type === 'lens') {
      gl.depthMask(false);
      renderer.draw(
        'sphere',
        M.model(o.p, b.u, b.v, b.n, [o.diameter / 2, o.diameter / 2, 0.08]),
        [0.28, 0.54, 0.73, 0.3],
        false,
        true,
      );
      gl.depthMask(true);
      ring(o.p, b.u, b.v, o.diameter / 2, edge);
      ring(
        V.add(o.p, V.mul(b.n, -0.035)),
        b.u,
        b.v,
        o.diameter / 2 + 0.025,
        [0.26, 0.42, 0.49, 0.6],
      );
    } else {
      const corners = [
        [-o.width / 2, -o.height / 2, 0],
        [o.width / 2, -o.height / 2, 0],
        [o.width / 2, o.height / 2, 0],
        [-o.width / 2, o.height / 2, 0],
      ].map((p) => localPoint(o, p));
      for (let i = 0; i < 4; i++)
        renderer.segment(corners[i], corners[(i + 1) % 4], 0.027, edge, 'tube', false);
      if (o.type === 'aperture') {
        renderer.draw(curvedMesh(o), M.model(o.p, b.u, b.v, b.n), [0.11, 0.16, 0.21, 1], false);
        ring(o.p, b.u, b.v, o.hole / 2, [0.5, 0.66, 0.73, 0.8]);
      } else {
        const color =
          o.type === 'detector'
            ? [0.065, 0.1, 0.14, 0.95]
            : o.type === 'blocker'
              ? [0.12, 0.16, 0.2, 1]
              : o.type === 'splitter'
                ? [0.46, 0.47, 0.72, 0.32]
                : [0.34, 0.56, 0.68, 0.64];
        gl.depthMask(false);
        renderer.draw(
          'plane',
          M.model(o.p, b.u, b.v, b.n, [o.width, o.height, 1]),
          color,
          false,
          o.type === 'mirror' || o.type === 'splitter',
        );
        gl.depthMask(true);
        if (o.type === 'detector') {
          const pts = [];
          for (let i = 1; i < 8; i++) {
            const x = (i / 8 - 0.5) * o.width,
              y = (i / 8 - 0.5) * o.height;
            pts.push(
              localPoint(o, [x, -o.height / 2, 0.006]),
              localPoint(o, [x, o.height / 2, 0.006]),
              localPoint(o, [-o.width / 2, y, 0.006]),
              localPoint(o, [o.width / 2, y, 0.006]),
            );
          }
          renderer.lines(pts, [0.4, 0.55, 0.65, 0.22]);
          const vertices = [];
          for (const h of trace.detectors[o.id]?.hits || [])
            vertices.push(...V.add(h.point, V.mul(h.normal, 0.02)), ...h.color, 0.88);
          gl.depthMask(false);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          renderer.batch(vertices, true, 4);
          gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          gl.depthMask(true);
        }
        if (o.type === 'splitter') {
          const pts = [];
          for (let i = 0; i < 12; i++)
            pts.push(
              localPoint(o, [-o.width / 2 + (i / 12) * o.width, -o.height / 2, 0.01]),
              localPoint(o, [
                -o.width / 2 + Math.min(1, (i + 0.45) / 12) * o.width,
                o.height / 2,
                0.01,
              ]),
            );
          renderer.lines(pts, [0.6, 0.61, 0.83, 0.12]);
        }
      }
      if (sel) for (const p of corners) renderer.sphere(p, 0.035, [0.74, 0.97, 0.85, 1]);
    }
    if (sel && !state.settings.starMode && Math.abs(o.p[1]) < 30)
      ring([o.p[0], 0.011, o.p[2]], [1, 0, 0], [0, 0, 1], 0.55, [0.45, 0.77, 0.68, 0.32]);
  }
  function drawFoci() {
    if (!state.settings.foci) return;
    for (const o of state.objects) {
      if (!o.enabled) continue;
      for (const p of focalPoints(o)) {
        const c = [0.99, 0.77, 0.39, 0.7];
        renderer.sphere(p, 0.037, [1, 0.88, 0.59, 1]);
        for (const a of [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ])
          renderer.lines([V.add(p, V.mul(a, -0.12)), V.add(p, V.mul(a, 0.12))], c);
        if (o.id === selected) dash(o.p, p, [0.75, 0.67, 0.44, 0.3]);
        if (o.type === 'trough') {
          const b = basis(o);
          dash(
            V.add(p, V.mul(b.v, -o.height / 2)),
            V.add(p, V.mul(b.v, o.height / 2)),
            [0.99, 0.77, 0.39, 0.7],
            0.16,
          );
        }
      }
    }
  }
  function drawNormals() {
    if (!state.settings.normals) return;
    const h = selectedHit();
    if (!h) return;
    dash(
      V.add(h.point, V.mul(h.normal, -0.5)),
      V.add(h.point, V.mul(h.normal, 1.35)),
      [0.5, 0.85, 0.75, 0.85],
      0.18,
    );
    renderer.segment(
      V.add(h.point, V.mul(h.normal, 1.2)),
      V.add(h.point, V.mul(h.normal, 1.4)),
      0.06,
      [0.5, 0.85, 0.75, 1],
      'cone',
    );
    if (h.outgoing) {
      for (const [dir, r, c] of [
        [V.mul(h.incoming, -1), 0.55, [1, 0.76, 0.42, 0.8]],
        [h.outgoing, 0.72, [0.55, 0.85, 0.72, 0.8]],
      ]) {
        const angle = Math.acos(clamp(V.dot(h.normal, dir), -1, 1));
        if (angle < 0.001 || angle > Math.PI / 2 + 0.01) continue;
        const tangent = V.unit(V.sub(dir, V.mul(h.normal, Math.cos(angle)))),
          pts = [];
        for (let i = 0; i < 28; i++)
          for (const a of [(i / 28) * angle, ((i + 1) / 28) * angle])
            pts.push(
              V.add(
                h.point,
                V.mul(V.add(V.mul(h.normal, Math.cos(a)), V.mul(tangent, Math.sin(a))), r),
              ),
            );
        renderer.lines(pts, c);
      }
    }
  }
  function gizmoLength() {
    return renderer.camera.radius * Math.tan(renderer.fov / 2) * 0.16;
  }
  function drawGizmo() {
    const o = current();
    if (!o || o.locked || mode === 'select' || (mode === 'rotate' && o.aimTarget)) return;
    const colors = [
        [0.88, 0.44, 0.41, 1],
        [0.4, 0.81, 0.61, 1],
        [0.42, 0.61, 0.93, 1],
      ],
      axes = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ],
      len = gizmoLength();
    gl.disable(gl.DEPTH_TEST);
    if (mode === 'move')
      axes.forEach((a, i) => {
        const c = axis === ['x', 'y', 'z'][i] ? [1, 0.94, 0.6, 1] : colors[i];
        renderer.segment(o.p, V.add(o.p, V.mul(a, len * 0.86)), len * 0.012, c);
        renderer.segment(
          V.add(o.p, V.mul(a, len * 0.82)),
          V.add(o.p, V.mul(a, len)),
          len * 0.048,
          c,
          'cone',
        );
      });
    else
      axes.forEach((a, i) => {
        ring(
          o.p,
          axes[(i + 1) % 3],
          axes[(i + 2) % 3],
          len * 0.78,
          axis && axis !== ['x', 'y', 'z'][i] ? rgba(colors[i].slice(0, 3), 0.18) : colors[i],
        );
      });
    gl.enable(gl.DEPTH_TEST);
  }
  function buildRayCache() {
    if (isolateSource && !object(isolateSource)) isolateSource = null;
    const selectedSources = new Set(
      selectedObjects()
        .filter(isSource)
        .map((source) => source.id),
    );
    rayCache = buildRayGeometry(
      trace.segments,
      state.settings,
      renderer,
      selectedSources,
      isolateSource,
    );
    renderedSegments = rayCache.chosen.length;
    if ($('display-thinned')) {
      $('display-thinned').textContent =
        renderedSegments < rayCache.eligibleCount
          ? ` \u00b7 display ${renderedSegments.toLocaleString()}/${rayCache.eligibleCount.toLocaleString()} seg`
          : isolateSource
            ? ' \u00b7 isolated view'
            : '';
    }
  }
  function drawRays() {
    if (!rayCache) buildRayCache();
    gl.depthMask(false);
    // Alpha compositing preserves source hue without additive clipping to white.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    renderer.batch(rayCache.core);
    if (state.settings.rayStyle === 'glow') {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      renderer.batch(rayCache.glow);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    renderer.batch(rayCache.extensions);
    if (state.settings.animate) {
      const points = [],
        gap = Math.max(3.8, renderer.camera.radius * 0.13),
        skip = Math.max(1, Math.ceil(trace.seeds / 220));
      for (const s of rayCache.chosen) {
        if (s.rayIndex % skip) continue;
        const first = (((flowTime * gap * 0.7 - s.startLength) % gap) + gap) % gap;
        for (let t = first; t < s.length; t += gap) {
          points.push(
            ...V.mix(s.a, s.b, t / s.length),
            ...s.color,
            clamp(s.visual * 0.7, 0.05, 0.85),
          );
          if (points.length > 12000) break;
        }
        if (points.length > 12000) break;
      }
      renderer.batch(points, true, 3.1);
    }
    gl.depthMask(true);
  }

  function draw() {
    renderer.begin();
    gl.depthMask(false);
    if (state.settings.grid) {
      renderer.lines(grid, [0.23, 0.35, 0.46, 0.22]);
      renderer.lines(xAxis, [0.46, 0.28, 0.28, 0.25]);
      renderer.lines(zAxis, [0.26, 0.37, 0.56, 0.25]);
    }
    gl.depthMask(true);
    for (const o of state.objects) {
      if (!o.enabled) continue;
      if (isSource(o)) drawSource(o);
      else drawOptic(o);
    }
    drawRays();
    drawFoci();
    drawNormals();
    drawGizmo();
    updateLabels();
  }
  function pointerXY(e) {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  }
  function spherePick(ray, p, r) {
    const off = V.sub(ray.origin, p),
      b = V.dot(off, ray.direction),
      disc = b * b - V.dot(off, off) + r * r;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    return t > 0 ? t : null;
  }
  function pick(x, y) {
    const ray = renderer.pointerRay(x, y);
    let best = null,
      dist = Infinity;
    for (const o of state.objects) {
      if (!o.enabled) continue;
      let t = null;
      if (!isSource(o)) t = intersect(ray.origin, ray.direction, o)?.t ?? null;
      else {
        const b = basis(o);
        t = spherePick(ray, V.add(o.p, V.mul(b.n, -0.22)), 0.43);
        if (['beam', 'star', 'area', 'line'].includes(o.type)) {
          const dn = V.dot(ray.direction, b.n);
          if (Math.abs(dn) > 0.001) {
            const d = V.dot(V.sub(o.p, ray.origin), b.n) / dn;
            if (d > 0) {
              const q = localVec(V.sub(V.add(ray.origin, V.mul(ray.direction, d)), o.p), b),
                inside = ['beam', 'star'].includes(o.type)
                  ? q[0] * q[0] + q[1] * q[1] <= Math.max(0.4, o.aperture / 2) ** 2
                  : Math.abs(q[0]) <= o.width / 2 &&
                    Math.abs(q[1]) <= (o.type === 'line' ? 0.18 : o.height / 2);
              if (inside) t = t === null ? d : Math.min(t, d);
            }
          }
        }
      }
      if (t !== null && t < dist) {
        dist = t;
        best = o.id;
      }
    }
    return best;
  }
  function planePoint(x, y, p, n) {
    const r = renderer.pointerRay(x, y),
      dn = V.dot(r.direction, n);
    if (Math.abs(dn) < 0.015) return null;
    const t = V.dot(V.sub(p, r.origin), n) / dn;
    return t > 0 ? V.add(r.origin, V.mul(r.direction, t)) : null;
  }
  function groundPoint(x, y, height = 3) {
    return planePoint(x, y, [0, height, 0], [0, 1, 0]);
  }
  const worldAxes = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  function axisCoordinate(x, y, p, a) {
    const r = renderer.pointerRay(x, y),
      w = V.sub(r.origin, p),
      c = V.dot(a, r.direction),
      den = 1 - c * c;
    if (den < 0.005) return null;
    return (V.dot(a, w) - c * V.dot(r.direction, w)) / den;
  }
  function distanceToSegment(p, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l = dx * dx + dy * dy,
      t = l ? clamp(((p[0] - a.x) * dx + (p[1] - a.y) * dy) / l, 0, 1) : 0;
    return Math.hypot(p[0] - a.x - dx * t, p[1] - a.y - dy * t);
  }
  function pickGizmo(x, y) {
    const o = current();
    if (!o || o.locked || mode === 'select' || (mode === 'rotate' && o.aimTarget)) return null;
    const len = gizmoLength();
    let best = null,
      min = 9;
    for (const [k, a] of Object.entries(worldAxes)) {
      if (mode === 'move') {
        const p = renderer.project(V.add(o.p, V.mul(a, len * 0.23))),
          q = renderer.project(V.add(o.p, V.mul(a, len))),
          d = distanceToSegment([x, y], p, q);
        if (q.visible && d < min) {
          best = k;
          min = d;
        }
      } else {
        const axes = Object.values(worldAxes),
          i = ['x', 'y', 'z'].indexOf(k),
          u = axes[(i + 1) % 3],
          v = axes[(i + 2) % 3];
        for (let j = 0; j < 64; j++) {
          const points = [(j / 64) * Math.PI * 2, ((j + 1) / 64) * Math.PI * 2].map((t) =>
            renderer.project(
              V.add(
                o.p,
                V.add(V.mul(u, Math.cos(t) * len * 0.78), V.mul(v, Math.sin(t) * len * 0.78)),
              ),
            ),
          );
          const d = distanceToSegment([x, y], ...points);
          if (points.every((p) => p.visible) && d < min) {
            best = k;
            min = d;
          }
        }
      }
    }
    return best;
  }
  function rotateVec(v, a, t) {
    return V.add(
      V.add(V.mul(v, Math.cos(t)), V.mul(V.cross(a, v), Math.sin(t))),
      V.mul(a, V.dot(a, v) * (1 - Math.cos(t))),
    );
  }
  function rotateOnAxis(o, initial, a, t) {
    const b = basis(initial),
      n = rotateVec(b.n, a, t),
      u = rotateVec(b.u, a, t);
    o.yaw = deg(Math.atan2(n[0], n[2]));
    o.tilt = deg(Math.asin(clamp(n[1], -1, 1)));
    const canonical = basis({ ...o, roll: 0 });
    o.roll = deg(Math.atan2(V.dot(u, canonical.v), V.dot(u, canonical.u)));
  }
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 2) return;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const xy = pointerXY(e);
    touches.set(e.pointerId, xy);
    if (touches.size === 2) {
      endEdit();
      const p = [...touches.values()];
      pinch = {
        distance: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]),
        mid: V.mix(p[0], p[1], 0.5),
      };
      drag = null;
      return;
    }
    const handle = e.button === 0 ? pickGizmo(...xy) : null,
      picked = handle ? selected : pick(...xy),
      o = object(picked);
    const action =
      e.button === 1 || e.button === 2 || (e.shiftKey && mode === 'select')
        ? 'pan'
        : handle
          ? mode
          : picked && mode !== 'select' && !o.locked && !(mode === 'rotate' && o.aimTarget)
            ? mode
            : 'orbit';
    if (action === 'move' || action === 'rotate') {
      if (!selection.has(picked)) select(picked);
      else {
        selected = picked;
        renderInspector();
      }
      beginEdit();
    }
    const constraint = handle || axis,
      initial = o ? JSON.parse(JSON.stringify(o)) : null,
      rotationAnchor = constraint && o ? planePoint(...xy, o.p, worldAxes[constraint]) : null;
    drag = {
      group: JSON.parse(JSON.stringify(selectedObjects())),
      additive: e.shiftKey,
      pointer: e.pointerId,
      start: xy,
      last: xy,
      picked,
      action,
      constraint,
      initial,
      anchor: o ? groundPoint(...xy, o.p[1]) : null,
      screenAnchor: o ? planePoint(...xy, o.p, renderer.forward) : null,
      axisAnchor: constraint && o ? axisCoordinate(...xy, o.p, worldAxes[constraint]) : null,
      rotationAnchor,
      moved: false,
      button: e.button,
      shift: e.shiftKey,
    };
    if (handle) {
      axis = handle;
      document
        .querySelectorAll('[data-axis]')
        .forEach((b) => b.classList.toggle('active', b.dataset.axis === axis));
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const xy = pointerXY(e);
    if (touches.has(e.pointerId)) touches.set(e.pointerId, xy);
    if (touches.size === 2 && pinch) {
      const p = [...touches.values()],
        distance = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]),
        mid = V.mix(p[0], p[1], 0.5);
      renderer.camera.radius = clamp(
        (renderer.camera.radius * pinch.distance) / Math.max(1, distance),
        0.1,
        5000000,
      );
      renderer.pan(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      pinch = { distance, mid };
      cameraChanged();
      return;
    }
    if (!drag || drag.pointer !== e.pointerId) {
      if (e.pointerType === 'mouse') {
        const h = pickGizmo(...xy),
          p = h || pick(...xy);
        canvas.style.cursor = p
          ? mode === 'move'
            ? 'move'
            : mode === 'rotate'
              ? 'crosshair'
              : 'pointer'
          : 'grab';
      }
      return;
    }
    const dx = xy[0] - drag.last[0],
      dy = xy[1] - drag.last[1],
      tx = xy[0] - drag.start[0],
      ty = xy[1] - drag.start[1];
    if (Math.hypot(tx, ty) > 3) drag.moved = true;
    if (drag.action === 'pan') {
      renderer.pan(dx, dy);
      cameraChanged();
    } else if (drag.action === 'orbit') {
      // Our azimuth is atan2(z,x), unlike OrbitControls' atan2(x,z).
      // Positive dx therefore increases yaw: the visible scene follows the drag.
      renderer.camera.yaw += dx * 0.006 * (preferences.invertOrbit ? -1 : 1);
      renderer.camera.pitch = clamp(
        renderer.camera.pitch + dy * 0.006,
        -Math.PI / 2 + 0.001,
        Math.PI / 2 - 0.001,
      );
      customView();
      cameraChanged();
    } else {
      const o = object(drag.picked);
      if (o && !o.locked) {
        const initial = drag.initial,
          scale = (2 * renderer.camera.radius * Math.tan(renderer.fov / 2)) / renderer.height,
          snap = state.settings.snap || e.ctrlKey || e.metaKey;
        if (drag.action === 'move') {
          let pos = [...initial.p];
          const a = drag.constraint;
          if (a) {
            const n = worldAxes[a],
              v = axisCoordinate(...xy, initial.p, n),
              delta =
                v !== null && drag.axisAnchor !== null
                  ? v - drag.axisAnchor
                  : (a === 'y' ? -ty : tx) * scale;
            pos = V.add(pos, V.mul(n, delta));
          } else if (e.shiftKey || drag.shift) pos[1] = initial.p[1] - ty * scale;
          else {
            const p = groundPoint(...xy, initial.p[1]);
            if (p && drag.anchor) pos = V.add(initial.p, V.sub(p, drag.anchor));
            else {
              const point = planePoint(...xy, initial.p, renderer.forward);
              if (point && drag.screenAnchor)
                pos = V.add(initial.p, V.sub(point, drag.screenAnchor));
            }
          }
          o.p = pos.map((v, i) =>
            clamp(snap ? Math.round(v * 4) / 4 : v, -POSITION_LIMIT, POSITION_LIMIT),
          );
          const delta = V.sub(o.p, initial.p);
          for (const original of drag.group || []) {
            const q = object(original.id);
            if (q && q.id !== o.id && !q.locked)
              q.p = original.p.map((v, i) => clamp(v + delta[i], -POSITION_LIMIT, POSITION_LIMIT));
          }
        } else {
          if (drag.constraint) {
            const a = worldAxes[drag.constraint],
              p = planePoint(...xy, initial.p, a);
            let angle = (tx - ty) * 0.009;
            if (p && drag.rotationAnchor) {
              const start = V.unit(V.sub(drag.rotationAnchor, initial.p)),
                end = V.unit(V.sub(p, initial.p));
              angle = Math.atan2(V.dot(a, V.cross(start, end)), V.dot(start, end));
            }
            if (snap) angle = Math.round(angle / rad(15)) * rad(15);
            rotateOnAxis(o, initial, a, angle);
          } else {
            const yaw = initial.yaw + tx * 0.45,
              tilt = initial.tilt - ty * 0.4;
            o.yaw = (((snap ? Math.round(yaw / 15) * 15 : yaw) + 540) % 360) - 180;
            o.tilt = clamp(snap ? Math.round(tilt / 15) * 15 : tilt, -89.9, 89.9);
          }
        }
        syncInspectorFields();
        markChanged();
      }
    }
    drag.last = xy;
  });
  function finishPointer(e) {
    if (drag?.pointer === e.pointerId) {
      if (!drag.moved && drag.button === 0 && (drag.action === 'orbit' || drag.action === 'pan'))
        select(drag.picked, !!drag.picked && innerWidth <= 720, drag.additive);
      if (drag.action === 'move' || drag.action === 'rotate') endEdit();
      drag = null;
    }
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
  }
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('lostpointercapture', finishPointer);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      renderer.camera.radius = clamp(
        renderer.camera.radius * Math.exp(clamp(delta, -240, 240) * 0.001),
        0.1,
        5000000,
      );
      cameraChanged();
    },
    { passive: false },
  );
  canvas.addEventListener('dblclick', (e) => {
    const id = pick(...pointerXY(e));
    if (id) select(id);
    frameScene(!!id);
  });
  $('library').addEventListener('dragstart', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.dataTransfer.setData('application/x-lumen-component', b.dataset.add);
    e.dataTransfer.effectAllowed = 'copy';
  });
  $('stage').addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('application/x-lumen-component')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      $('stage').classList.add('dropping');
    }
  });
  $('stage').addEventListener('dragleave', (e) => {
    if (!$('stage').contains(e.relatedTarget)) $('stage').classList.remove('dropping');
  });
  $('stage').addEventListener('drop', (e) => {
    e.preventDefault();
    $('stage').classList.remove('dropping');
    const type = e.dataTransfer.getData('application/x-lumen-component');
    if (CATALOG[type]) {
      const p = groundPoint(...pointerXY(e), renderer.camera.target[1]) || [
        ...renderer.camera.target,
      ];
      addComponent(
        type,
        p.map((v, i) => clamp(v, -POSITION_LIMIT, POSITION_LIMIT)),
      );
    }
  });
  window.addEventListener('keydown', (e) => {
    if (
      [...document.querySelectorAll('dialog')].some((d) => d.open) ||
      e.target.matches('input,select,textarea') ||
      e.target.isContentEditable
    )
      return;
    const k = e.key.toLowerCase(),
      cmd = e.ctrlKey || e.metaKey;
    if (cmd) {
      if (k === 'c') {
        e.preventDefault();
        copySelection();
      } else if (k === 'x') {
        e.preventDefault();
        copySelection(true);
      } else if (k === 'v') {
        e.preventDefault();
        pasteSelection(e.shiftKey);
      } else if (k === 'a') {
        e.preventDefault();
        selectAll();
      } else if (k === 'z') {
        e.preventDefault();
        undo(e.shiftKey);
      } else if (k === 'y') {
        e.preventDefault();
        undo(true);
      } else if (k === 'd') {
        e.preventDefault();
        duplicate();
      } else if (k === 's') {
        e.preventDefault();
        saveFile();
      }
      return;
    }
    if (e.altKey) return;
    if (k === 'tab') {
      if (
        e.target === canvas ||
        e.target === document.body ||
        document.body.classList.contains('focus')
      ) {
        e.preventDefault();
        focusMode();
      }
      return;
    }
    if (k === 'q' || k === 'v') {
      e.preventDefault();
      setMode('select');
    } else if (k === 'g') {
      e.preventDefault();
      setMode('move');
    } else if (k === 'r') {
      e.preventDefault();
      setMode('rotate');
    } else if (['x', 'y', 'z'].includes(k)) {
      e.preventDefault();
      setAxis(k);
    } else if (k === 'a') {
      e.preventDefault();
      openLibrary();
    } else if (k === 'home') {
      e.preventDefault();
      frameScene();
    } else if (k === 'f') {
      e.preventDefault();
      fullscreen();
    } else if (k === ' ') {
      e.preventDefault();
      mutate(() => (state.settings.animate = !state.settings.animate), {
        refresh: false,
        traceRequired: false,
      });
      syncButtons();
      if (rightTab === 'simulation') renderSimulation();
    } else if (k === 'delete' || k === 'backspace') {
      e.preventDefault();
      removeSelected();
    } else if (['1', '2', '3', '4'].includes(k)) {
      e.preventDefault();
      setView(['3d', 'top', 'front', 'side'][+k - 1]);
    } else if (k === '?') $('guide-dialog').showModal();
    else if (k === 'escape') {
      closeMenus();
      if (document.body.classList.contains('focus')) focusMode();
      $('left-dock').classList.remove('mobile-open');
      $('right-dock').classList.remove('mobile-open');
      if (drag && editBefore) {
        state = JSON.parse(editBefore);
        editBefore = null;
        drag = null;
        refreshAll();
      }
      setMode('select');
    }
  });
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    $('loading').hidden = false;
    $('loading').textContent =
      'The graphics context was interrupted. Reload this file to resume. Your last saved scene remains on this device.';
  });
  window.addEventListener('beforeunload', () => {
    try {
      localStorage.setItem('lumen-scene-v3', snapshot());
    } catch {}
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      dirty = true;
      lastTime = 0;
    }
  });
  new ResizeObserver(() => {
    renderer.resize();
    dirty = true;
    rayCache = null;
  }).observe(canvas);
  function frame(time) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.08) : 0;
    lastTime = time;
    if (state.settings.animate) flowTime += dt;
    if (needsTrace) {
      retrace();
      dirty = true;
    }
    if (dirty || (state.settings.animate && time - lastRender > 31)) {
      draw();
      dirty = false;
      lastRender = time;
      if (exportAfterFrame) makeScreenshot();
    }
  }
  setView('3d');
  refreshAll();
  syncHistory();
  $('loading').hidden = true;
  requestAnimationFrame(frame);
  // Read-only snapshots, plus the pure optics kernel, support reproducible tests.
  window.Lumen = Object.freeze({
    version: '3.0.0',
    getScene: () => JSON.parse(snapshot()),
    getTrace: () => JSON.parse(JSON.stringify(trace)),
    getCamera: () => JSON.parse(JSON.stringify(renderer.camera)),
    getSelection: () => selected,
    getSelections: () => [...selection],
    getStats: () => ({
      pending: needsTrace || traceBusy,
      worker: !!traceWorker,
      renderedSegments,
      rays: trace.seeds,
      segments: trace.segments.length,
      hits: trace.hits.length,
      limited: trace.limited,
      traceMs,
      traceRuns,
    }),
    project: (p) => renderer.project(p),
    getMode: () => ({ mode, axis }),
    getHistory: () => ({ undo: past.length, redo: future.length }),
    kernel: Object.freeze({
      createPreset,
      createObject,
      validateScene,
      traceScene,
      intersect,
      basis,
      focalPoints,
      syncAimLocks,
      cloneObjects,
      spotStatistics,
      telescopeReference,
    }),
  });
}
try {
  boot();
} catch (error) {
  console.error(error);
  $('loading').hidden = false;
  $('loading').replaceChildren();
  const text = document.createElement('div'),
    strong = document.createElement('strong');
  strong.textContent = 'The 3D workspace could not start.';
  text.append(strong, document.createTextNode(error.message || 'Use a WebGL-enabled browser.'));
  $('loading').append(text);
}
