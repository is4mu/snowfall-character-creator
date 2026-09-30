# Real Human Mesh Prototype

Stage 1 loads the pinned real human base mesh. Stage 2 preserves source vertex indices and adds independent CC0 target parsing/application.

## Run

Serve the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/prototype/real-mesh/
```

The browser loads a MakeHuman CC0 base OBJ pinned to a specific upstream commit.

Network access is required for the Stage 1 preview.

## Test

```bash
node --test prototype/real-mesh/test/*.test.mjs
```

Tests do not download the mesh.

## Boundary

- SCC code: Apache-2.0
- pinned MakeHuman graphical asset: CC0-1.0
- MakeHuman application code: AGPL and not copied into this repository

See [../../docs/real-mesh-adapter.md](../../docs/real-mesh-adapter.md).


## Geometry engine

- `makehuman-geometry.mjs` — minimal index-preserving OBJ parser plus MakeHuman target parser/application engine.
- `test/makehuman-geometry.test.mjs` — synthetic parser and target-delta contract tests.

The browser preview builds BufferGeometry from the SCC parser rather than Three.js OBJLoader so upstream target indices remain stable.


## Shoulder target debug

The prototype fetches the pinned MakeHuman shoulder-distance decrease/increase targets and exposes a renderer-only signed debug weight from `-1..1`.

The value is **uncalibrated** and is not saved to SCC character data.

Every change is reapplied from immutable base positions, then the mesh is refit to canonical SCC height.


## Experimental shoulder calibration

The canonical `shoulderBreadthCm` control now drives the pinned shoulder target pair through an SCC-owned mesh measurement and bisection solver.

The renderer landmark pair is provisional and the mapping is not yet stable.

The solved target weight is renderer-local only. If the requested centimeters are outside the target's reachable range, diagnostics report `out-of-range` instead of altering the canonical value.


## Real-mesh shape prior

`body.shapePrior` now changes the pinned human mesh through an SCC-owned blend of pinned CC0 macro assets.

Render order:

```text
base -> shape prior -> explicit shoulder calibration -> canonical height
```

This ensures explicit SCC measurements remain authoritative.

The implementation does not inspect `identity.gender`.

Current status is prototype because the upstream macro assets also affect head/face geometry. The renderer prior must be visually audited before promotion.


## Body surface only

The upstream OBJ also contains helper and joint geometry.

SCC preserves the complete source vertex address space for target compatibility, but renders and measures only the pinned `body` OBJ group.

Pinned body contract:

```text
13380 source vertices
26756 triangulated body triangles
```

Canonical height and shoulder calibration are normalized against body-only bounds. Helper geometry cannot affect anthropometry.


## Cross-section measurement

`body-cross-section.mjs` provides generic horizontal contour measurement over explicit body triangles.

It is the shared geometry foundation for future chest, waist, hip, neck, and limb circumference calibration.

The module does not choose anatomical measurement levels; it only measures the contour at a supplied plane.


## Coupled chest calibration

When canonical shoulder breadth and chest circumference are both present, the prototype does not solve them independently.

For every bust target candidate it re-solves shoulder breadth, re-selects the chest reference plane, and then measures chest circumference.

A coarse renderer-weight scan finds local target brackets without assuming global monotonicity. Ambiguous or discontinuous solutions are reported instead of silently accepted.


## Pinned integration audit

Real upstream asset compatibility is verified separately from normal PR CI.

Run:

```bash
node prototype/real-mesh/audit/pinned-real-mesh-audit.mjs
```

The audit verifies every downloaded asset by Git blob SHA before parsing it, then exercises coupled chest/shoulder calibration on feminine, neutral, and masculine shape priors.

See [Pinned Real Mesh Integration Audit](../../docs/pinned-real-mesh-audit.md).
