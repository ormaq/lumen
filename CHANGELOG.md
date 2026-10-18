# Lumen 5

## Integrated workspace
- Removed the separate Star lab launcher/dialog and telescope-mode UI branch.
- Added a single top-level Analyze action for all detectors and all source types.
- Added per-source filtering, an optional pinned live detector monitor, an expanded plot, and PNG plot export. CSV and image exports respect the filter without changing tracing.
- Added centroid and RMS-radius overlays; folded less-common physical-scale/reference/focal-plane controls.
- Replaced hidden star-mode stand/brightness behavior with explicit stand, background, and incoming-ray-opacity settings.

## Start screen
- Full-window first-launch menu with six featured real WebGL/ray-traced previews, 14 searchable experiments, a true blank project, and JSON opening.
- Original/corrected analytic mirror comparison; orbit, zoom, reset, pause/play, reduced-motion support, and offscreen preview suspension.
- Preview scenes and cameras are isolated; opening restores normal sampling and creates a fresh project identity.
- Horizontal telescope gallery layouts preserve the original geometry under rigid rotation.

## Projects and finishing tools
- Validated, failure-tolerant local recovery for up to eight distinct projects; recent projects, confirmed removal, optional launch-menu bypass, and legacy recovery migration.
- Project names/notes and camera pose saved in JSON.
- Up to eight named camera views, saved and recalled with projects.
- Keyboard-accessible Ctrl/Cmd+K command search over actions, objects, components, and camera views.
- Responsive launch menu and normal mobile Analysis flow.

## Retained and checked
- V1–V4 scene compatibility; V5 metadata is bounded and validated.
- V4 analytic inverse shaping and full-aperture audit, original/current comparison, live/frozen figures, CSV/OBJ export.
- Dense worker tracing, source lock-on, copy/paste and groups, undo/redo, full-window/true fullscreen controls, orthographic views, all 19 optical component types.
- No new claim of diffraction simulation or full-field image optimization.

See `VERIFICATION.md` for measured test coverage rather than inferring certification from feature lists.
