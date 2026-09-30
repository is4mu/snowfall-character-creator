# Reference-plane visual audit

## Status

Prototype-only renderer/debug tooling.

Contract:

```text
scc-reference-plane-visual-audit-v0
```

This layer exists to review the anatomical placement of SCC's experimental chest and underbust reference planes before implementing underbust target-weight calibration.

It does not add Character Schema fields and does not promote `underbustCircumferenceCm` beyond `needs-calibration`.

## Inputs

The visual audit is evaluated only after the current coupled chest/shoulder solve succeeds.

It receives:

- solved body positions;
- body-only triangle surface;
- body-only vertex set;
- canonical `heightCm`;
- the already-selected chest reference;
- renderer-local anterior direction.

For the pinned MakeHuman prototype only:

```text
surfaceDirection = {x: 0, z: 1}
```

The generic underbust finder itself remains axis-semantic-neutral.

## Audit state

The pure helper reports:

```text
contract
status
chest.status
chest.heightFraction
chest.planeY
underbust.status
underbust.heightFraction
underbust.planeY
separationCm
```

Possible overall states include:

- `ready`
- `chest-reference-unavailable`
- `invalid-reference-order`

The underbust status preserves the underlying finder result, including:

- `selected`
- `no-stable-landmark`
- `no-valid-slice`

No display layer is allowed to fabricate a missing underbust plane.

## Canonical separation

When both planes are selected, vertical separation is converted to canonical centimeters from the solved mesh's body-only raw height:

```text
cmPerRawUnit = canonicalHeightCm / bodyRawHeight

separationCm =
  (chestPlaneY - underbustPlaneY) * cmPerRawUnit
```

This is diagnostics-only output.

## Three.js overlay

The browser creates each reference marker as a child of the body mesh root.

That matters because the mesh root already owns the canonical-height scale and body-centering transform.

Therefore the audit planes use raw solved-mesh coordinates and automatically follow:

- canonical height fitting;
- body centering;
- front/side/orbit camera movement.

The overlay uses:

- chest: blue translucent horizontal surface + outline;
- underbust: orange translucent horizontal surface + outline.

The underbust marker is created only when the finder returns `selected`.

## UI behavior

The real-mesh prototype includes:

- a `Show reference planes` checkbox;
- a chest/underbust color legend;
- machine-readable audit status;
- chest and underbust height fractions;
- chest-to-underbust separation in canonical centimeters.

The toggle only changes visualization. It never changes the solved geometry or Character Schema input.

## Failure behavior

If the coupled chest solve is unavailable:

```text
reference-plane audit = not-ready
overlays = cleared
```

If chest reference selection is unavailable:

```text
status = chest-reference-unavailable
overlays = hidden
```

If underbust is unsupported for the current geometry:

```text
chest overlay = visible
underbust overlay = absent
underbust.status = no-stable-landmark
```

This is intentional.

## Immutability

Reference-plane visual audit is measurement-only.

Automated tests verify the evaluation path leaves the input position array unchanged.

## Manual anatomical review gate

Before implementing a coupled underbust target-weight solver, inspect the 162 / 38 / 88 representative case in the browser for:

- feminine;
- neutral;
- masculine.

For each prior:

1. inspect front view;
2. inspect side view;
3. orbit around the thorax;
4. confirm the blue chest plane matches the intended chest circumference level;
5. confirm the orange underbust plane lies immediately below meaningful chest/breast projection;
6. confirm no plane appears when the finder reports `no-stable-landmark`.

A visual discrepancy is a measurement-contract issue to investigate. It must not be fixed by manually offsetting only the display plane.
