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


## Anterior-profile follow-up

The circumference-only audit did not establish a stable underbust landmark, so the next audit layer records additional axis-neutral geometry for each selected torso loop:

- X/Z bounds;
- breadth and depth;
- positive-Z extent from body center;
- negative-Z extent from body center;
- centimeter-normalized forms.

The generic sampler deliberately does not assign anatomical meaning to either Z direction.

For the pinned MakeHuman adapter audit only, upstream documentation at the pinned commit states that the default model faces along positive Z:

```text
path:
makehuman/data/povray/makehuman_facegroup_documentation.pov

blob:
cb7da1d84de32cef9d6d3d7a3c87bb6787f09835
```

Therefore the pinned audit may interpret positive-Z extent as **adapter-local anterior extent** when reviewing the generated JSON.

This coordinate convention is diagnostic renderer knowledge. It is not Character Schema data and must not become part of SCC's portable body semantics.

### Acceptance question

The next pinned audit should determine whether the below-chest anterior profile contains a reproducible geometric cue for the lower boundary of meaningful chest/breast projection.

No reference plane is selected automatically in this stage.

If the cue is not stable across representative priors, the future underbust contract must return `no-stable-landmark` rather than using circumference minima, target influence, or a fixed height fraction as a guess.


## Verified anterior-profile audit

Manual pinned-asset workflow:

```text
run: 36690714724
branch: audit/underbust-anterior-profile
audited head: e3b159a3400a746c751f29639e5c53b70f9bda43
conclusion: success
```

The audit recorded axis-neutral loop geometry for every previously valid sample. No new topology failures were introduced.

### Baseline cue

For the 162 / 38 / 88 solved baseline, all three current shape priors show a final local minimum in the positive-Z surface profile before the upper-chest prominence rises to a nearby maximum:

| shape prior | last local minimum fraction | following peak fraction | positive-Z rise |
| --- | ---: | ---: | ---: |
| feminine | 0.70964 | 0.72786 | 1.52 cm |
| neutral | 0.70357 | 0.72786 | 0.92 cm |
| masculine | 0.69143 | 0.72179 | 0.41 cm |

For this pinned MakeHuman adapter only, positive Z is interpreted as anterior according to the pinned upstream coordinate documentation.

This is materially stronger evidence than the circumference minimum from the previous audit. The candidate sits immediately below the upper chest prominence rather than near the waist region.

### Behavior across underbust target weights

The same upper-band local-minimum cue remains detectable for most sampled renderer weights:

| shape prior | -1 | -0.5 | 0 | +0.5 | +1 |
| --- | ---: | ---: | ---: | ---: | ---: |
| feminine | 0.70964 | 0.70964 | 0.70964 | 0.70964 | 0.70964 |
| neutral | 0.70357 | 0.70357 | 0.70357 | 0.70964 | 0.70964 |
| masculine | 0.69750 | 0.69750 | 0.69143 | 0.68536 | none |

The positive-Z rise from the candidate to the following prominence also weakens toward the masculine prior and under strong positive underbust deformation.

At masculine weight +1, the sampled upper band has no qualifying local minimum at all.

### Design conclusion

There is enough evidence to prototype an SCC-owned **underbust reference-plane finder**, but not enough evidence to guarantee a landmark for every geometry.

The first contract should therefore:

1. search only below an already selected chest reference plane;
2. analyze renderer-independent surface-profile geometry;
3. select the **last sufficiently prominent local anterior-profile minimum before the chest prominence**;
4. use explicit prominence / spacing thresholds rather than accepting every numerical wiggle;
5. return `no-stable-landmark` when the cue is absent or too weak;
6. keep renderer-axis interpretation in the adapter boundary;
7. remain experimental until another real-mesh audit validates the detector.

The masculine +1 case is a required negative real-mesh example: a future finder must not fabricate success there.

No target-weight solver should be added until this reference-plane contract exists and passes synthetic plus pinned real-mesh tests.
