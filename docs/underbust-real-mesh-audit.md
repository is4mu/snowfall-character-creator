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


## First verified real-mesh run

Manual pinned-asset workflow:

```text
run: 36689517129
branch: audit/underbust-semantics
conclusion: success
```

Both underbust target files matched their pinned Git blob SHA before use.

### Baseline cross-section curve

After solving the authored 162 / 38 / 88 baseline, every one of the 29 diagnostic below-chest slices was measurable for all three current shape priors. No open-chain, non-manifold, or no-loop sample occurred.

The only local circumference minimum inside the sampled band was:

| shape prior | local minimum body-height fraction | circumference |
| --- | ---: | ---: |
| feminine | 0.64893 | 66.57 cm |
| neutral | 0.63679 | 67.94 cm |
| masculine | 0.62464 | 69.99 cm |

This minimum shifts materially with the shape prior and is well below the selected chest plane at 0.75.

The audit therefore does **not** identify a distinct, stable underbust landmark from the circumference curve alone. In particular, SCC must not relabel this generic torso minimum as underbust without independent semantic evidence.

### Coupling with existing authored chest

Applying the pinned underbust target after the baseline coupled shoulder/chest solve produced the following chest deltas:

| shape prior | weight -1 | weight -0.5 | weight +0.5 | weight +1 |
| --- | ---: | ---: | ---: | ---: |
| feminine | -2.00 cm | -1.01 cm | +5.24 cm | +11.09 cm |
| neutral | -1.74 cm | -0.88 cm | +2.79 cm | +7.66 cm |
| masculine | -1.53 cm | -0.77 cm | +2.52 cm | +5.21 cm |

The underbust target did not materially move the shoulder measurement in this audit; the shoulder residual remained the baseline coupled-solve residual for every sampled underbust weight.

However, chest is strongly affected. Positive underbust weights also moved the selected chest reference fraction from 0.75 to 0.73 for:

- feminine at +0.5 and +1.0;
- neutral at +1.0.

The masculine case retained 0.75 across the sampled weights.

### Coupling decision

A future underbust calibration cannot be an independent serial step after chest calibration.

Even though the pinned underbust target did not materially move the current shoulder landmark directly, it changes canonical chest circumference substantially. Re-solving chest can in turn change shoulder breadth through the existing bust target.

The minimum safe future evaluation order is therefore conceptually:

```text
immutable shape-prior geometry
        |
        v
underbust renderer candidate
        |
        v
re-solve canonical chest
        |
        v
nested re-solve canonical shoulder
        |
        v
re-evaluate underbust reference/measurement
```

This is a coupling requirement, not yet an implementation commitment.

## Next design step

Do **not** implement an underbust target-weight solver yet.

First define an SCC-owned underbust reference-plane contract that can explicitly return:

- `selected`;
- `no-stable-landmark`;
- `no-valid-slice`;
- topology/measurement diagnostics.

The reference plane must be derived from renderer-independent surface geometry and SCC semantics, not from MakeHuman target influence or AGPL measurement-index tables.

Only after that reference contract survives a pinned real-mesh audit should the project implement a coupled underbust/chest/shoulder solver.

A generalized multi-constraint solver remains a likely future direction, but this audit alone is not sufficient reason to introduce it before waist/hip interaction evidence exists.
