# Underbust real-mesh semantics audit

## Status

Exploratory only.

This audit does **not** define a canonical underbust reference plane and does **not** promote `underbustCircumferenceCm` beyond `needs-calibration`.

## Why this exists

SCC defines `underbustCircumferenceCm` as the horizontal torso perimeter immediately below breast/chest tissue **where that landmark is meaningful**.

That wording matters. A renderer adapter must not assume that the existence of a MakeHuman modifier with a similar name proves equivalent SCC semantics.

The pinned MakeHuman target pair is therefore treated only as an input for a coupling investigation.

## Pinned assets

Upstream commit:

```text
a8bc2d54ff0ac92e78ff71431b1023eda42bf482
```

Targets:

```text
measure-underbust-circ-decr.target
blob a56df665893fee096d6ecc3f1909dbe787b02cfc

measure-underbust-circ-incr.target
blob 10e2e822fbee0eeeabf35cb5f4e3305923e4e7ec
```

Downloaded bytes are subject to the same Git blob SHA verification used by the pinned real-mesh audit.

## Canonical baseline

The exploratory audit begins only after the existing coupled solver has satisfied:

```text
heightCm = 162
shoulderBreadthCm = 38
chestCircumferenceCm = 88
```

for:

- feminine
- neutral
- masculine

## What is measured

For renderer-local underbust weights:

```text
-1.0
-0.5
 0.0
+0.5
+1.0
```

the audit records:

- resulting shoulder breadth;
- shoulder delta from the authored 38 cm target;
- chest measurement status;
- resulting chest circumference;
- chest delta from the authored 88 cm target;
- selected chest reference height fraction;
- a dense torso cross-section curve below the selected chest plane.

The diagnostic curve uses 29 horizontal samples from 0.18 body-height fractions below the selected chest plane up to 0.01 below it.

That band is intentionally **not** an underbust landmark definition.

## What the audit must not infer

The audit does not infer:

- where the canonical underbust plane is;
- whether every morphology has a stable underbust landmark;
- whether the MakeHuman target is semantically equivalent to SCC underbust;
- whether underbust can be solved independently;
- whether a generalized multi-constraint solver is already required.

Those conclusions require real pinned-mesh evidence.

## Failure semantics

Invalid cross-sections remain explicit as:

- `open-cross-section`
- `non-manifold-cross-section`
- `no-loop`

They are never converted into guessed measurements.

A future underbust finder must also be able to return an explicit unsupported/no-stable-landmark result when SCC's semantic landmark cannot be established.

## Running the audit

Use the existing **Pinned real mesh audit** workflow.

Its JSON artifact now includes an `underbustExploration` section with the exploratory results.

Normal pull-request CI remains hermetic and does not download MakeHuman assets.
