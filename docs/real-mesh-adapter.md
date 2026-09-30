# First Real Human Mesh Adapter

## Status

Stage 1 prototype for the first non-procedural human body renderer.

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
