# First Real Human Mesh Adapter

## Status

Stage 1 established the pinned real human base mesh and explicit mapping coverage.

**Stage 2 now adds an SCC-owned, index-preserving geometry/target engine** so MakeHuman CC0 target deltas can be applied without copying MakeHuman application code.

The selected upstream asset source is the **MakeHuman core asset set**, pinned to:

```text
repository: makehumancommunity/makehuman
commit: a8bc2d54ff0ac92e78ff71431b1023eda42bf482
base mesh: makehuman/data/3dobjs/base.obj
base mesh blob SHA: d26635e9326e3cca30778fd7b9c00062b03cce09
```

## Why MakeHuman core assets

The first real-mesh adapter needs an asset source that is:

- human-shaped rather than a procedural mannequin;
- reusable by an open-source character creator;
- compatible with commercial and non-commercial downstream use;
- rich enough to support later morph/measurement calibration;
- separable from application implementation code.

MakeHuman explicitly separates application code from graphical assets.

Its bundled graphical assets include the base mesh, targets, modifiers, textures, clothes, poses, and expressions and are released under **CC0 1.0**.

The upstream MakeHuman application source code is released under **AGPL**.

SCC therefore adopts this hard boundary:

> Reuse pinned CC0 graphical assets. Do not copy MakeHuman application program logic into the Apache-2.0 SCC codebase.

Upstream references:

- https://static.makehumancommunity.org/about/license.html
- https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.md
- https://static.makehumancommunity.org/mpfb/faq/build_other_chargen.html

The pinned base OBJ itself contains an explicit CC0 header.

## Why not SMPL as the default asset

SMPL is technically attractive as a parametric body model, but its standard model license is for non-commercial scientific research/education/artistic projects, with commercial licensing handled separately.

That makes it unsuitable as the default freely redistributable body asset for SCC.

SMPL can still be supported later through an optional adapter when a user has appropriate rights.

Reference:

- https://smpl.is.tue.mpg.de/modellicense.html

## Stage 1 architecture

```text
scc-body-v1
     |
     v
makehuman-adapter.mjs
     |
     +-- canonical height -> real mesh scale
     |
     +-- explicit field coverage
     |     stage1-direct
     |     needs-calibration
     |     unverified-upstream-candidate
     |     unmapped
     |
     +-- renderer-local shapePrior seed
     |
     v
pinned MakeHuman CC0 base.obj
     |
     v
neutral gray Three.js preview
```

Stage 1 deliberately does not claim full body fitting.

## Asset loading

The browser prototype loads the base OBJ from a raw GitHub URL pinned to the upstream commit.

This avoids committing a large third-party asset before the integration strategy is proven.

A production-ready package should later decide whether to:

1. vendor a minimal reviewed subset of CC0 assets with provenance metadata;
2. provide a reproducible asset-fetch step;
3. publish a separately versioned SCC-compatible asset package.

Unpinned "latest" asset URLs are not acceptable for reproducible character generation.

## Height mapping

Stage 1 applies only one canonical geometry operation:

```text
measurements.heightCm -> uniform real-mesh height
```

The loaded base OBJ is measured by bounding box and uniformly scaled so its rendered standing height matches the SCC target height.

This is intentionally simple and testable.

No other body dimension is silently approximated in Stage 1.

## Shape prior

MakeHuman has a renderer-local `macrodetails/Gender` morph axis.

SCC may use `body.shapePrior` only as an initial renderer morphology seed:

```text
feminine -> 0.0
neutral   -> 0.5
masculine -> 1.0
```

This is not identity gender.

The adapter does not receive `identity.gender` and therefore cannot infer morphology from it.

Once explicit SCC measurements are calibrated, those measurements must take precedence over prior assumptions.

## Measurement modifier coverage

The pinned MakeHuman revision exposes measurement modifier families that are promising calibration targets for several SCC fields.

Current Stage 2 candidates include:

| SCC field | MakeHuman modifier family |
| --- | --- |
| `shoulderBreadthCm` | `measure/measure-shoulder-dist-decr|incr` |
| `chestCircumferenceCm` | `measure/measure-bust-circ-decr|incr` |
| `underbustCircumferenceCm` | `measure/measure-underbust-circ-decr|incr` |
| `waistCircumferenceCm` | `measure/measure-waist-circ-decr|incr` |
| `hipCircumferenceCm` | `measure/measure-hips-circ-decr|incr` |
| `neckCircumferenceCm` | `measure/measure-neck-circ-decr|incr` |
| `upperArmCircumferenceCm` | `measure/measure-upperarm-circ-decr|incr` |
| `wristCircumferenceCm` | `measure/measure-wrist-circ-decr|incr` |
| `thighCircumferenceCm` | `measure/measure-thigh-circ-decr|incr` |
| `calfCircumferenceCm` | `measure/measure-calf-circ-decr|incr` |
| `ankleCircumferenceCm` | `measure/measure-ankle-circ-decr|incr` |
| `upperArmLengthCm` | `measure/measure-upperarm-length-decr|incr` |
| `forearmLengthCm` | `measure/measure-lowerarm-length-decr|incr` |
| `thighLengthCm` | `measure/measure-upperleg-height-decr|incr` |
| `lowerLegLengthCm` | `measure/measure-lowerleg-height-decr|incr` |

These are **candidate renderer controls**, not semantic equivalences.

Each requires calibration against SCC's own measurement protocol.

## Explicit uncertainty

The adapter marks `measure/measure-frontchest-dist-decr|incr` as an **unverified candidate** for `chestDepthCm`.

The name alone is not sufficient evidence that its landmark semantics match SCC chest depth.

It must be measured on the deformed mesh before promotion to calibrated support.

## Composition

MakeHuman exposes a `macrodetails-universal/Muscle` renderer parameter, so SCC `muscularity` may initialize it as a renderer-local seed.

This does not yet mean the values are quantitatively equivalent.

MakeHuman `Weight` is **not** treated as SCC `bodyFatFraction`.

Those concepts are not semantically interchangeable.

## Stage 2 requirement: calibration by measurement

The correct next step is not to invent linear coefficient conversions by hand.

Stage 2 should:

1. load the pinned CC0 base mesh;
2. load the required CC0 target delta assets;
3. implement target application independently in SCC;
4. measure the resulting mesh using SCC landmark/measurement rules;
5. solve modifier weights to minimize error against canonical SCC measurements;
6. report residual error and unsupported dimensions;
7. never write renderer weights back into Character Schema.

The desired loop is:

```text
SCC target measurement
        |
        v
candidate modifier weight
        |
        v
deformed real mesh
        |
        v
measure mesh
        |
        +-- error too large -> adjust weight
        |
        +-- within tolerance -> renderer solution
```

## Freeze interaction

Body Model v1 is a freeze candidate.

The real-mesh adapter is expected to adapt to the frozen semantics.

If MakeHuman cannot express a field directly, the default response is **adapter limitation**, not schema expansion.

The body schema should be reopened only when the real-mesh experiment proves a renderer-independent concept is missing.

## Stage 1 acceptance

Stage 1 is successful when:

- the pinned CC0 human base mesh loads in-browser;
- canonical height controls the displayed mesh height;
- all 35 frozen Body Model measurement fields have an explicit coverage state;
- known upstream measurement modifier families are recorded as calibration candidates;
- unsupported fields remain visibly unsupported;
- shape prior remains renderer-local;
- no MakeHuman AGPL program code is copied into SCC.


## Stage 2: index-preserving target engine

MakeHuman target files reference the original base-mesh vertex indices.

A typical target line is:

```text
4774 -.005 0 .012
```

meaning:

```text
vertex index 4774
delta x = -0.005
delta y = 0
delta z = 0.012
```

The pinned base OBJ contains polygon faces whose references point back to the original OBJ vertex list.

Using a generic OBJ renderer loader is not sufficient as an SCC contract because the loader may expand, duplicate, or reorder render vertices.

SCC therefore owns a deliberately small parser for the pinned asset format.

### OBJ parser

`makehuman-geometry.mjs`:

- reads original `v` records in source order;
- ignores texture/material data not needed for the neutral gray prototype;
- reads face vertex references while preserving source vertex indices;
- supports OBJ positive and negative indices;
- triangulates polygon faces using a deterministic fan;
- emits one position entry per original source vertex.

The resulting BufferGeometry position index therefore remains compatible with MakeHuman target files.

### Target parser

The same module parses sparse CC0 target delta files.

It:

- ignores comments and blank lines;
- validates vertex indices and numeric deltas;
- rejects duplicate delta entries;
- keeps target weights renderer-local.

### Target application

Two operations are provided:

```text
applyTarget(base, deltas, weight 0..1)

applyBidirectionalTarget(
  base,
  decreaseTarget,
  increaseTarget,
  signedWeight -1..1
)
```

Both return new position arrays and leave the source base mesh unchanged.

This is important because renderer solutions must remain disposable and reproducible.

### Browser preview change

The real-mesh preview no longer uses Three.js `OBJLoader`.

It fetches the pinned CC0 OBJ as text, parses it through the SCC geometry layer, and constructs Three.js BufferGeometry from the preserved source positions and triangulated faces.

Three.js remains only the display layer.

### What Stage 2 does not do yet

The engine can apply target files, but SCC has not yet solved target weights from centimeter measurements.

The next step is calibration:

```text
canonical SCC cm target
       |
       v
renderer target weight
       |
       v
deformed mesh
       |
       v
SCC measurement function
       |
       v
error / solver
```

Until that loop exists, target weights are renderer implementation detail and must not be serialized.


## Stage 3: first live measurement target

The prototype now applies one real pinned MakeHuman measurement target pair to the human mesh:

```text
SCC field intent:
  measurements.shoulderBreadthCm

MakeHuman renderer-local modifier:
  measure/measure-shoulder-dist-decr|incr

Pinned target assets:
  measure-shoulder-dist-decr.target
  blob eb25c3214db91206340ba5e28fcd7f29fadae4a9

  measure-shoulder-dist-incr.target
  blob 0d6ba8d828c7d9ee42ef18a814d413712214ac21
```

Both target URLs are pinned to the same upstream commit as the base mesh.

### Debug weight is not a measurement

The browser exposes a signed renderer debug value:

```text
-1.0 ........ 0 ........ +1.0
decrease      base       increase
```

This is deliberately labeled **uncalibrated**.

A value such as `0.5` does not mean 0.5 cm, 50%, or any stable SCC body property.

Its only current meaning is:

> Apply 50% of the selected MakeHuman target delta to the pinned base mesh.

### Immutable-base rule

Every debug update is recomputed from the original parsed base positions.

Target updates are never accumulated on top of the previously deformed mesh.

This guarantees deterministic behavior and prevents slider history from changing the result.

### Height remains canonical

A MakeHuman target may include Y-axis deltas.

After target application, the prototype remeasures the deformed mesh's raw height and then refits it to SCC `heightCm`.

This keeps the renderer-local shoulder experiment independent from canonical stature.

### Schema boundary

The debug target weight is not written into `body`.

A dedicated invalid fixture verifies that a field such as `body.makeHumanTargetWeights` is rejected by Character Schema.

### Next calibration gate

The next step is to replace the debug weight with a solver-backed renderer value:

```text
SCC shoulderBreadthCm
        |
        v
candidate signed target weight
        |
        v
real deformed mesh
        |
        v
SCC-owned shoulder measurement
        |
        v
residual error
        |
        +-- iterate until tolerance
```

The target pair should only move from `needs-calibration` to calibrated support after that loop has a clearly defined SCC-owned mesh measurement and test tolerance.


## Stage 4: experimental shoulder-breadth calibration

The first centimeter-driven real-mesh mapping is now implemented for:

```text
scc-body-v1.measurements.shoulderBreadthCm
```

The mapping remains **prototype-calibrated**, not stable support.

### SCC-owned renderer landmarks

The pinned CC0 base mesh was analyzed directly, without using MakeHuman's AGPL measurement implementation.

The current adapter landmark pair is:

```text
left vertex  = 1357
right vertex = 8049

left base coordinate  = (-1.8990, 5.2051, 0.6451)
right base coordinate = ( 1.8990, 5.2051, 0.6451)
```

The points are exact mirrors in the pinned base mesh and both are moved symmetrically by the pinned shoulder-distance target.

They are stored as **renderer adapter metadata**, never Character Schema data.

The adapter validates their pinned coordinates before calibration. If the asset changes incompatibly, calibration fails instead of silently using the wrong vertices.

### Measurement

SCC measures the renderer landmark X separation and converts raw mesh units into centimeters using the current mesh height:

```text
cm per raw unit = canonical heightCm / raw mesh height

shoulder breadth cm =
  abs(right.x - left.x) * cm per raw unit
```

This keeps shoulder measurement coupled to the canonical character stature rather than to undocumented MakeHuman units.

### Pinned target range

For the representative 162 cm character, direct analysis of the pinned CC0 target pair gives approximately:

```text
signed weight -1.0 -> 34.31 cm
signed weight  0.0 -> 36.93 cm
signed weight +1.0 -> 41.78 cm
```

The representative `shoulderBreadthCm = 38` is therefore reachable.

### Solver

`makehuman-calibration.mjs` uses a monotonic bisection solver over the renderer-local signed target weight `[-1, 1]`.

Each evaluation:

1. starts from immutable base positions;
2. applies the selected decrease/increase CC0 target;
3. measures shoulder breadth using SCC-owned landmarks;
4. compares the result with canonical `shoulderBreadthCm`.

The solver reports:

- status;
- target centimeters;
- measured centimeters;
- residual centimeters;
- reachable centimeter range;
- renderer-local target weight;
- iteration count.

### Out-of-range behavior

If the requested canonical shoulder breadth lies outside the target pair's reachable range, the adapter does **not** pretend to satisfy it.

It returns:

```text
status: out-of-range
```

and applies the closest renderer endpoint while preserving the canonical SCC value unchanged.

This is an adapter limitation, not a reason to rewrite Character Schema.

### Browser behavior

The real-mesh browser prototype now exposes canonical `shoulderBreadthCm` next to canonical height.

Changing either value reruns the solver and visibly updates the real mesh.

The solved MakeHuman target weight remains diagnostics-only renderer state.

### Why the status is still experimental

The numeric solver and target behavior are testable, but the renderer landmark interpretation still requires visual/anatomical review.

The current pair is therefore labeled:

```text
provisional-cc0-derived
```

and the field mapping is:

```text
prototype-calibrated
```

Stable support requires verifying that the selected surface points match SCC's intended lateral-shoulder/acromion-style landmark semantics across relevant body priors and deformations.

### No AGPL measurement logic

No MakeHuman Python measurement code or its measurement-index tables are copied.

The calibration is based only on:

- pinned CC0 base geometry;
- pinned CC0 target deltas;
- SCC-owned measurement semantics;
- SCC-owned solver code.


## Stage 5: real-mesh body shape prior

The browser prototype now applies `body.shapePrior` to the real MakeHuman mesh before explicit SCC measurement calibration.

The order is fixed:

```text
pinned CC0 base mesh
        |
        v
body.shapePrior
(renderer under-specification prior)
        |
        v
explicit shoulderBreadthCm calibration
        |
        v
canonical heightCm fit
        |
        v
displayed mesh
```

This ordering is deliberate:

> A shape prior may fill unspecified morphology, but it must never override an explicit canonical measurement.

### Why SCC does not copy MakeHuman's macro logic

The pinned MakeHuman assets do not expose one standalone morphology-gender target.

Their macro asset set is factored across several source target groups plus age/body-composition dimensions.

SCC does not copy the MakeHuman AGPL macro implementation.

Instead, this prototype defines its own renderer-local endpoint policy over pinned CC0 assets.

### Source-neutralized endpoints

For this prototype:

```text
feminine endpoint
  = equal blend of three pinned female young-adult macro targets

masculine endpoint
  = equal blend of three pinned male young-adult macro targets

neutral
  = exact midpoint between those two SCC renderer endpoints
```

The three upstream source groups are used only as an equal-weight asset basis.

Their individual identity/categories are not copied into Character Schema and are not emitted as runtime renderer state.

Only this survives into renderer diagnostics:

```text
source: body.shapePrior
shapePrior: feminine | neutral | masculine
normalizedValue: 0 | 0.5 | 1
endpointPolicy: equal-three-source-group-blend
```

### Identity separation

The renderer receives `body.shapePrior`.

It does not receive or inspect `identity.gender`.

Changing identity metadata therefore cannot silently change physical morphology.

### Determinism and immutability

Endpoint construction is deterministic:

1. parse each pinned CC0 target;
2. average sparse vertex deltas equally;
3. interpolate between the two SCC endpoints;
4. apply the resulting target to immutable original base positions.

Every body re-render starts from the original base mesh.

No prior, shoulder target, or height adjustment is accumulated from the previous UI state.

### Shoulder calibration remains authoritative

Before implementation, the pinned assets were analyzed directly.

At canonical height 162 cm, the experimental shoulder target can still reach 38 cm after every prior:

| shape prior | reachable shoulder breadth |
| --- | ---: |
| feminine | ~32.32–40.15 cm |
| neutral | ~33.05–40.55 cm |
| masculine | ~33.69–40.88 cm |

The automated synthetic contract additionally verifies that an explicit 38 cm shoulder target re-converges after each shape prior.

If a future prior makes an explicit measurement unreachable, the adapter must report that limitation rather than changing the canonical value.

### Current whole-mesh limitation

The upstream macro targets affect the full MakeHuman mesh, including head/face geometry.

This is acceptable only for the current prototype.

Body Model v1 intentionally does not claim ownership of detailed facial geometry, so stable promotion requires a visual/anatomical audit and one of:

1. confirm that the gross prior effect is acceptable as a temporary whole-body renderer prior;
2. define a renderer-local body/head blend boundary and suppress detailed facial deltas;
3. replace these prototype endpoints with a future SCC-compatible body-only asset.

This limitation does not change Character Schema.

### Status

The real-mesh shape prior is:

```text
renderer contract: scc-makehuman-shape-prior-v0
status: prototype
canonical input: body.shapePrior
renderer output: disposable mesh positions
```

It should remain prototype-only until the whole-mesh visual audit is complete.


## Stage 6: body-surface group boundary

A structural audit of the pinned MakeHuman OBJ found that it contains much more than the visible human surface.

Pinned structure:

```text
total source vertices:       19158
anthropometry group:         body
body source vertices:        13380
body source index range:     0..13379
body source faces:           13378
body triangulated triangles: 26756
```

Other OBJ groups include joint markers and helper geometry for eyes, hair, clothing proxies, teeth, tongue, genital helpers, and other authoring infrastructure.

Those groups are useful upstream implementation assets, but they are **not the human anthropometric surface**.

### Bug fixed by this boundary

The first real-mesh prototype preserved source vertex indices but flattened every OBJ group into a single render index.

As a consequence:

- helper/joint geometry could enter the neutral gray preview;
- helper vertices could affect the mesh bounding box;
- canonical height normalization could use non-body points;
- shoulder-breadth centimeters could therefore be normalized by the wrong raw height;
- future chest/waist/hip cross-sections would intersect non-body geometry.

The pinned base illustrates the error:

```text
body-only raw height: 16.6589 units
all-source raw height: 16.9455 units
```

### Parser contract

The SCC OBJ parser now preserves:

```text
source vertex order
source vertex indices
OBJ group name
triangles per group
aggregate triangles
```

Repeated group names accumulate into one deterministic group entry.

The adapter requires the pinned `body` group.

A missing body group is a hard error.

### Renderer contract

The browser retains the full source position array so CC0 target indices remain valid, but the Three.js index buffer references **body triangles only**.

Therefore:

```text
target system:
  full pinned source vertex address space

visible surface:
  body group only

anthropometric measurement:
  body group only
```

This keeps renderer compatibility without letting helper geometry become body data.

### Body-only bounds

SCC derives a unique body vertex set from body-group triangles.

Height, centering, floor placement, and future section measurements use only that vertex set.

The displayed canonical-height transform is computed directly from body-only raw bounds rather than Three.js's full position-attribute bounding box.

### Shoulder calibration correction

Shoulder landmark indices remain the same because they are body vertices.

What changes is centimeter normalization.

At 162 cm on the un-priorized pinned base:

```text
decrease endpoint ~= 34.31 cm
base               ~= 36.93 cm
increase endpoint ~= 41.78 cm
```

With shape priors applied first:

```text
feminine  ~= 32.32 .. 40.15 cm
neutral   ~= 33.05 .. 40.55 cm
masculine ~= 33.69 .. 40.88 cm
```

The representative 38 cm target remains reachable in all three cases.

### Future anthropometry rule

Any SCC mesh measurement that represents the human body must explicitly declare its surface set.

For the current MakeHuman adapter:

```text
anthropometrySurface = OBJ group "body"
```

No algorithm may silently fall back to all source vertices.

This rule is a prerequisite for the upcoming renderer-independent horizontal cross-section engine for chest, waist, and hip circumference.


## Stage 7: generic body cross-section engine

SCC now has a renderer-independent geometry layer for circumference measurements.

See [Body Surface Cross-Section Measurement](body-cross-section.md).

The engine slices explicit body triangles with a horizontal plane, assembles closed contour loops, selects the central torso loop when requested, and normalizes perimeter to centimeters using body-only height.

It intentionally does not yet choose the semantic chest/waist/hip plane.

That field-specific logic is the next calibration stage.


## Stage 8: chest reference-plane finder

SCC now has field-specific experimental logic for choosing a chest measurement level from body geometry.

See [Chest Reference Plane](chest-reference-plane.md).

The MakeHuman adapter currently searches normalized body-height fractions `0.62..0.78` using 33 samples and chooses the valid central torso cross-section with the greatest perimeter.

No MakeHuman measurement-index table is used.

This stage measures geometry only. Renderer target calibration remains the next step.
