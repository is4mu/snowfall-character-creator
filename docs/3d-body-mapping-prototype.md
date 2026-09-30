# 3D Body Mapping Prototype

## Status

This is an exploratory prototype, not a production rendering architecture.

The prototype exists to test whether `scc-body-v1` can drive a useful 3D body preview while keeping renderer-specific values out of Character Schema.

## Architecture

```text
Character Schema
  body: scc-body-v1
        |
        v
adapter.mjs
semantic SCC body -> disposable renderer parameters
        |
        v
renderer.mjs
procedural primitive / generated mesh
        |
        v
neutral gray browser preview
```

Only the left side of this boundary is portable character data.

The output of `adapter.mjs` uses the prototype-only identifier:

```text
scc-procedural-body-render-v0
```

It is deliberately not part of Character Schema.

## Why the adapter is dependency-free

`adapter.mjs` has no Three.js dependency.

It receives an `scc-body-v1` object and returns ordinary JavaScript data representing one possible renderer interpretation.

This means the mapping contract can be tested independently from:

- Three.js;
- WebGL;
- a future game engine;
- a future body-model library;
- a future desktop application.

The browser renderer is intentionally disposable.

## Preview renderer

The browser prototype uses a pinned Three.js module only to display the procedural gray body.

The body is assembled from:

- an elliptical multi-ring torso mesh;
- an ellipsoidal pelvis;
- cylindrical limb segments;
- simple joints;
- primitive hands and feet;
- an ellipsoidal head.

The mesh is not anatomically production-ready. Its job is to expose missing semantics in the SCC body model.

## Running locally

Serve the repository root with any static HTTP server.

For example:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/prototype/body-mapping/
```

The browser must have network access because the prototype imports the pinned Three.js module from jsDelivr.

## Running mapping tests

The adapter tests require only Node.js and no npm install:

```bash
node --test prototype/body-mapping/test/*.test.mjs
```

## Prototype controls

The current UI exposes:

- shape prior;
- height;
- shoulder breadth and shoulder slope;
- upper-arm, forearm, thigh, and lower-leg segment lengths;
- chest circumference, breadth, and depth;
- waist circumference, breadth, and depth;
- abdominal depth;
- hip circumference, breadth, and buttock depth;
- body-fat fraction;
- muscularity;
- separate preview-only posture controls for pelvic tilt, trunk flexion, shoulder protraction, head-forward translation, and head pitch.

The preview also consumes the other Body Model measurements from the representative example.

The UI intentionally exposes only the dimensions that are most useful for visually identifying missing body semantics.

## Shape-prior rule

The prototype enforces a critical contract:

> An explicit semantic measurement wins over a shape prior.

For example, if `shoulderBreadthCm` is explicitly set to 40 cm, switching from `feminine` to `masculine` must not change the renderer's shoulder breadth.

The prior may change only values that the source character did not specify.

The UI contains a **Prior-only demo** mode to make this distinction visible.

## Mapping assumptions

A renderer must produce geometry even when SCC does not specify every geometric dimension.

The adapter currently makes explicit fallback assumptions for:

- body measurements omitted from the character;
- torso width/depth aspect ratios only when explicit breadth/depth are absent;
- head proportions;
- soft-tissue effect on torso depth;
- muscle effect on limb thickness.

These assumptions are renderer data, not character facts.

The adapter reports which fields were filled by fallback in `fallbackFields`.

## Structural findings

The mapping exercise exposes several dimensions that cannot be uniquely reconstructed from Body Model v1.

### 1. Circumference does not determine body cross-section — addressed

The first prototype showed that chest, waist, and hip circumference alone cannot determine front-to-back depth versus left-to-right breadth.

Body Model v1 now includes:

- `chestBreadthCm`;
- `chestDepthCm`;
- `waistBreadthCm`;
- `waistDepthCm`;
- `hipBreadthCm`;
- `buttockDepthCm`.

The adapter uses these explicit measurements whenever present. Width/depth aspect ratios are now fallback assumptions only for incomplete characters.

### 2. Shoulder breadth does not determine shoulder slope — addressed

`shoulderBreadthCm` determines horizontal span but not the vertical drop from the neck-side shoulder root to the lateral shoulder.

Body Model v1 now includes `shoulderSlopeDeg`, defined as a symmetric downward shoulder-line angle from horizontal. The procedural renderer uses it to lower the lateral shoulder and slope the top torso ring.

### 3. Gross depth does not determine local chest/breast distribution — renderer-local for now

Chest depth is canonical, but the same gross depth can be distributed differently between anterior chest tissue and the posterior torso.

The prototype now makes that front/back allocation explicit as a renderer-local policy rather than inventing a canonical normalized breast-projection slider.

This preserves total measured chest depth while allowing the procedural renderer to produce a visible local contour assumption.

### 4. Gross buttock depth does not determine local glute contour — renderer-local for now

`buttockDepthCm` already constrains total front-to-back size at the buttock level.

The remaining ambiguity is where that depth is distributed and how the contour transitions vertically and laterally. The prototype keeps that allocation renderer-local instead of adding a subjective `gluteProjection` field.

### 5. Total limb length does not determine segment ratios — addressed

`armLengthCm` and `inseamCm` do not uniquely determine upper/lower limb proportions.

Body Model v1 now includes `upperArmLengthCm`, `forearmLengthCm`, `thighLengthCm`, and `lowerLegLengthCm`. When present, the adapter uses these directly. Fixed ratios are now fallback behavior only for incomplete characters.

### 6. Head circumference does not define head shape

Head circumference alone cannot determine:

- head breadth;
- head length/depth;
- face height;
- cranial proportions.

Detailed face/head creation should probably become its own model rather than continuously expanding Body Model.

### 7. Posture is not body shape — boundary resolved

The same morphology can be displayed with different pelvic orientation, trunk flexion, shoulder position, and head posture.

The prototype now supplies posture independently through `scc-preview-posture-v0`. Body mapping remains unchanged, while the renderer applies preview posture transforms afterward.

Current preview posture fields are not Character Schema and are intentionally disposable. A future habitual-posture tendency, if needed, must be designed separately from both Body Model and current pose state.

See [Posture Boundary](posture-boundary.md).

### 8. Left/right asymmetry is absent

Body Model v1 currently assumes symmetric rendering.

This is acceptable for the first creator but should remain an explicit limitation rather than an accidental claim that humans are symmetric.

## Research support for breadth/depth refinement

SCC's original Body Model already uses anthropometric references such as ISO 7250.

The prototype's strongest missing measurements are also conventional anthropometric concepts rather than renderer inventions.

Public anthropometric material uses measurements such as:

- chest breadth;
- chest depth;
- hip breadth;
- buttock depth;
- waist breadth;
- waist depth.

This supports treating breadth/depth as physical dimensions if they are added to SCC, rather than introducing abstract mesh-specific torso sliders.

## What should not be added yet

The prototype does **not** justify adding all of the following as canonical fields yet:

- every body-part morph;
- dozens of local muscle sliders;
- vertex-level asymmetry;
- facial geometry;
- mesh topology;
- renderer bone lengths;
- breast cup size;
- clothing sizes;
- proprietary body-model parameters.

The goal is the minimum stable semantic model, not maximum shape control in the schema.

## Candidate Body Model v1 refinements

### Implemented from the first prototype

- `chestBreadthCm`;
- `chestDepthCm`;
- `waistBreadthCm`;
- `waistDepthCm`;
- `hipBreadthCm`;
- `buttockDepthCm`.

### Implemented from the second prototype

- `shoulderSlopeDeg`;
- `upperArmLengthCm`;
- `forearmLengthCm`;
- `thighLengthCm`;
- `lowerLegLengthCm`.

### Implemented from the surface-boundary prototype

- `abdominalDepthCm` as a canonical physical measurement;
- renderer-local chest anterior-share policy;
- renderer-local abdomen anterior-share policy;
- renderer-local glute posterior-share policy.

These distribution values are adapter output only and never Character Schema fields.

### Remaining candidates

These still need further validation before any promotion into the schema:

- stable landmark-based chest-surface geometry beyond gross depth;
- stable landmark-based glute-surface geometry beyond gross depth;
- regional muscle distribution.

### Defer to another model

These are likely better handled elsewhere:

- detailed head/face geometry;
- habitual posture / mannerism;
- current pose;
- asymmetry;
- clothing;
- hair;
- animation.

## Acceptance criteria for a Body Model addition

A new body field should be added only when all are true:

1. two visibly meaningful bodies can share current SCC values but differ on this dimension;
2. the dimension can be defined independently of a particular mesh;
3. humans can understand or author the value;
4. a renderer can consume it consistently;
5. the value is not simply derived from existing canonical fields;
6. adding it materially reduces renderer guesswork.

## Next step

The recommended follow-up is not a production UI.

The breadth/depth, shoulder-slope, limb-segment, surface-boundary, and posture-boundary passes have now been applied. Body Model v1 is now a freeze candidate for the first real human-mesh adapter. Left/right asymmetry and regional muscle distribution remain explicit non-blocking deferrals.

The project should still avoid choosing the long-term 3D/UI stack until those semantic boundaries are clearer.


See [Surface Shape Boundary](surface-shape-boundary.md) for the canonical-versus-renderer-local decision.
