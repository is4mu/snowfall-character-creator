# Surface Shape Boundary

## Status

This document defines the current boundary between portable Body Model data and renderer-local surface morphs for the Snowfall Character Creator 3D body prototype.

The decision is intentionally conservative:

> Persist physical or clearly semantic body facts. Recompute mesh-distribution choices inside the renderer adapter.

## Why this boundary is needed

A body can have the same gross measurements while differing in local surface contour.

Examples include:

- how chest depth is distributed between the anterior and posterior torso;
- how abdominal depth is distributed around the waist/abdomen;
- how hip/buttock depth is distributed toward the posterior body;
- how muscle definition changes local contour without changing a supplied circumference.

These differences matter visually, but that does not automatically make every useful renderer slider a good Character Schema field.

A canonical field should remain meaningful if the project replaces Three.js, changes topology, adopts a scanned base mesh, or integrates a game-engine body system.

## Three layers

### 1. Canonical physical measurements

These describe the character independently of a renderer.

Relevant Body Model v1 fields include:

- `chestDepthCm`;
- `waistDepthCm`;
- `abdominalDepthCm`;
- `buttockDepthCm`;
- the corresponding breadth and circumference measurements.

`abdominalDepthCm` was added during this prototype pass because abdominal depth is a recognizable anthropometric dimension and captures physical information that a waist-level depth does not necessarily capture.

These values constrain total front-to-back size.

### 2. Renderer-local distribution policy

The current procedural adapter emits:

```text
rendererLocalSurface
  contract
  chestAnteriorShare
  abdomenAnteriorShare
  glutePosteriorShare
```

These values are **not character data**.

They answer renderer questions such as:

> Given a total chest depth, how much of that depth should this simple procedural mesh place anterior to its local center plane?

or:

> Given a total buttock/hip depth, how should this renderer bias the local volume posteriorly while preserving the gross depth?

The exact policy can change with another mesh or renderer without migrating Character Schema documents.

### 3. Renderer-specific morph implementation

The final deformation may use:

- vertex offsets;
- blend shapes;
- sculpt targets;
- bones;
- procedural rings;
- learned body-model coefficients;
- engine-specific morph channels.

None of those belong in `scc-body-v1`.

## Why abdominalDepthCm is canonical

The existing `waistDepthCm` describes depth at a waist landmark.

The abdomen can protrude differently above or below that measurement plane.

A separate abdominal depth has established anthropometric precedent. Public ergonomics and anthropometry literature uses abdominal depth/extension depth as a measurable dimension, while standard anthropometric frameworks explicitly support extending basic measurement sets for specific design tasks.

The SCC field remains deliberately simple:

```json
"abdominalDepthCm": 21.5
```

It does not encode:

- a health judgment;
- visceral versus subcutaneous fat;
- abdominal muscle state;
- a renderer morph weight.

## Why chest/breast projection is not a canonical v1 slider yet

Chest/breast morphology is genuinely three-dimensional.

A single subjective value such as:

```text
breastProjection = 0.72
```

would leave unresolved questions:

- projection from which reference plane?
- measured at which vertical and lateral landmark?
- does the value include chest-wall depth?
- does it represent volume, prominence, ptosis, or tissue distribution?
- how should a masculine or neutral chest interpret the same slider?
- does `0.72` have the same geometry on different base meshes?

Clinical and 3D breast-morphology work commonly relies on multiple landmarks, projection, surface shape, curvature, volume, or fold/nipple relationships rather than one universal normalized slider.

Therefore the current prototype keeps local chest distribution renderer-local.

A future optional chest-surface module could become canonical only after its geometry and landmarks are defined independently of a particular mesh.

## Why glute local contour is not a canonical v1 slider yet

`buttockDepthCm` already constrains gross front-to-back depth at the buttock level.

The remaining ambiguity is primarily **distribution and contour**:

- where maximum posterior projection occurs vertically;
- how rapidly the surface transitions into the lower back and thigh;
- medial/lateral fullness distribution.

Those are real geometric differences, but the current prototype has not established a small portable parameter set for them.

The procedural renderer therefore uses a local posterior distribution policy while preserving the gross depth.

## Why regional muscle distribution remains renderer-local

`muscularity` is currently a broad character-authoring property.

A production body renderer may need separate deltoid, chest, arm, abdominal, glute, thigh, or calf definition controls.

Adding all of those to Character Schema now would effectively expose one renderer's sculpt controls as portable character identity.

For v1, regional distribution is renderer-local.

If later creator studies show that a small number of regional muscular-development traits are essential across different renderers, they can be proposed independently.

## Invariant: local policy must not rewrite measured facts

Renderer-local shape policy may redistribute a measured depth around a local center plane, but it must not silently replace the measurement.

For example, if:

```json
"chestDepthCm": 24
```

is canonical, then changing a local chest anterior-share policy must not turn the body into a 28 cm deep chest.

It may change the front/back split while preserving the total gross depth.

The same rule applies to abdominal and buttock depth.

## Invariant: renderer-local data is recomputable

`rendererLocalSurface` must:

- be produced deterministically from SCC input plus renderer version/policy;
- never be required in Character Schema;
- never be written back as a canonical body field;
- be disposable when a renderer changes;
- be visible in prototype diagnostics so hidden assumptions are inspectable.

## Current procedural policy

The prototype currently uses shape-prior-specific front/back distribution defaults.

These values are intentionally identified by:

```text
scc-procedural-surface-v0
```

They exist only to make assumptions visible and testable.

They are not proposed as a public SCC standard.

## Source-of-truth example

```text
Character Schema
  chestDepthCm
  abdominalDepthCm
  buttockDepthCm
        |
        v
body adapter
        |
        +--> gross geometry (portable meaning)
        |
        +--> rendererLocalSurface (disposable policy)
                  |
                  v
             mesh deformation
```

## Rejected v1 fields

The following are intentionally **not** added to Character Schema in this pass:

- `breastProjection`;
- `breastFullness`;
- `abdomenProjection`;
- `gluteProjection`;
- `gluteFullness`;
- `chestMorph`;
- `abdomenMorph`;
- `gluteMorph`;
- per-muscle morph weights.

The rejection is not a claim that these visual concepts are unimportant.

It means their current semantics are not yet portable enough.

## Evidence and design references

The boundary is informed by public anthropometric and 3D-morphology material:

- ISO 7250-1:2017 describes basic anthropometric measurements and explicitly anticipates supplemental measurements for specific applications: https://www.iso.org/standard/65246.html
- A historical NIST ergonomics reference set includes chest depth, waist depth, buttock depth, chest breadth, waist breadth, and hip breadth as physical dimensions: https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nbsir77-1403.pdf
- Published anthropometric work uses abdominal extension depth as a measurable body dimension: https://pmc.ncbi.nlm.nih.gov/articles/PMC6820124/
- 3D breast-morphology research illustrates why local breast surface shape is more complex than one gross torso depth or one subjective slider: https://pmc.ncbi.nlm.nih.gov/articles/PMC5077640/

SCC uses these materials as design evidence and does not reproduce protected standard text.

## What remains unresolved

The current model still does not canonically specify:

- local chest/breast surface distribution beyond gross depth;
- exact abdominal front/back distribution beyond abdominal depth;
- local glute contour beyond gross buttock depth;
- regional muscle distribution;
- posture;
- left/right asymmetry;
- detailed head/face shape.

Those should remain explicit unresolved dimensions rather than being hidden inside Character Schema.

## Promotion rule

A renderer-local surface parameter should be promoted into Character Schema only when all are true:

1. its meaning is independent of a specific mesh;
2. it can be defined with stable landmarks or semantic endpoints;
3. multiple renderers can consume it consistently;
4. it cannot be derived adequately from existing canonical measurements;
5. users benefit from intentionally authoring it;
6. round-trip behavior can be tested without referencing a specific renderer's internal morph name.
