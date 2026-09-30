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
- shoulder breadth;
- chest circumference;
- waist circumference;
- hip circumference;
- body-fat fraction;
- muscularity.

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
- torso width/depth aspect ratios;
- upper/lower leg length split;
- upper-arm/forearm length split;
- head proportions;
- soft-tissue effect on torso depth;
- muscle effect on limb thickness.

These assumptions are renderer data, not character facts.

The adapter reports which fields were filled by fallback in `fallbackFields`.

## Structural findings

The mapping exercise exposes several dimensions that cannot be uniquely reconstructed from Body Model v1.

### 1. Circumference does not determine body cross-section

Chest, waist, and hip circumference do not determine front-to-back depth versus left-to-right breadth.

Two bodies can have the same circumference but very different profiles.

The prototype therefore has to invent a width/depth aspect ratio.

This is the strongest candidate for Body Model refinement.

Potential stable measurements include:

- chest breadth;
- chest depth;
- waist breadth;
- waist depth;
- hip breadth;
- buttock depth.

Breadth/depth anthropometry is well established independently of any 3D renderer, which makes these stronger candidates than arbitrary shape sliders.

### 2. Shoulder breadth does not determine shoulder slope

`shoulderBreadthCm` determines horizontal span but not the vertical slope from neck to shoulder.

A renderer has to invent this.

A future semantic parameter could be a physical shoulder-slope angle or a landmark height difference, if the 3D prototype proves it materially affects recognizable body shape.

### 3. Circumference does not determine chest/breast projection

Chest and underbust circumferences constrain volume but do not uniquely determine anterior projection or tissue distribution.

The current prototype deliberately does not synthesize a breast-specific mesh.

If this becomes a required creator control, the project should prefer explicit renderer-independent geometry such as depth/projection measurements over regional cup-size labels.

### 4. Hip circumference does not determine glute projection

A body can have the same hip circumference with different lateral breadth and posterior projection.

Buttock depth or a comparable physical depth measurement is therefore a strong candidate.

### 5. Total limb length does not determine segment ratios

`armLengthCm` and `inseamCm` do not uniquely determine:

- upper-arm versus forearm length;
- thigh versus lower-leg length.

The prototype currently uses fixed ratios.

If visual testing shows this difference is important, landmark-based segment lengths should be added rather than renderer percentages.

### 6. Head circumference does not define head shape

Head circumference alone cannot determine:

- head breadth;
- head length/depth;
- face height;
- cranial proportions.

Detailed face/head creation should probably become its own model rather than continuously expanding Body Model.

### 7. Posture is not body shape

The same body can stand with different spinal curvature, pelvic tilt, shoulder position, and head posture.

Posture should not silently alter canonical body measurements.

A future creator may treat posture as:

- preview state;
- a separate stable posture tendency;
- or a pose/animation concern.

The current prototype leaves it unresolved.

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

### High-confidence candidates

These are physically meaningful and directly solve ambiguity introduced by the prototype:

- `chestBreadthCm`;
- `chestDepthCm`;
- `waistBreadthCm`;
- `waistDepthCm`;
- `hipBreadthCm`;
- `buttockDepthCm`.

### Medium-confidence candidates

These should be tested visually before being frozen:

- upper-arm length;
- forearm length;
- thigh segment length;
- lower-leg segment length;
- shoulder slope measurement.

### Defer to another model

These are likely better handled elsewhere:

- detailed head/face geometry;
- posture;
- pose;
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

It is a focused Body Model refinement issue for breadth/depth measurements, followed by a second prototype pass that removes those adapter assumptions.

Only after the semantic model survives that second pass should the project choose the long-term 3D/UI stack.
