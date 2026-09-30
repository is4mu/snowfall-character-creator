# Experimental underbust reference plane

## Status

Experimental renderer-measurement contract.

Contract identifier:

```text
scc-underbust-reference-plane-v0
```

This contract finds a candidate surface level for `underbustCircumferenceCm`. It does not make the field calibrated and does not solve any renderer target weight.

## Semantic requirement

SCC defines underbust as the torso perimeter immediately below breast/chest tissue **where that landmark is meaningful**.

The finder therefore must be allowed to fail explicitly.

Required states:

- `selected`
- `no-stable-landmark`
- `no-valid-slice`

A renderer must not convert `no-stable-landmark` into a guessed fixed-height measurement.

## Renderer-axis boundary

The SCC finder does not hard-code a mesh axis as anterior.

The renderer adapter supplies a horizontal direction:

```text
surfaceDirection = {x, z}
```

The direction is normalized before use.

For the pinned MakeHuman prototype, the adapter uses:

```text
{x: 0, z: 1}
```

because pinned upstream graphical documentation states that the default model faces positive Z.

That coordinate convention remains adapter-local.

## Detector

The finder requires an already selected chest reference fraction.

It searches only below that chest level.

Default experimental policy:

```text
maxBelowChestFraction:             0.08
minBelowChestFraction:             0.001
sampleCount:                       29
minProminenceHeightFraction:       0.002
minPeakSeparationHeightFraction:   0.01
maxPeakSeparationHeightFraction:   0.06
```

For each sample:

1. slice the body-only triangle surface horizontally;
2. reject open or non-manifold topology as a measurement candidate;
3. select the central torso loop;
4. project every loop point onto the supplied surface direction;
5. keep the maximum projected surface coordinate.

The detector then:

1. finds local minima in the contiguous measured profile;
2. searches forward for the strongest eligible peak;
3. computes prominence as a fraction of body height;
4. keeps only minima meeting the explicit prominence and separation policy;
5. selects the last qualifying minimum below the chest.

This is intended to represent the lower boundary before the surface rises into the upper chest prominence.

## Why the policy is explicit

The first pinned real-mesh anterior-profile audit found:

```text
feminine   minimum ~0.70964, rise ~1.52 cm
neutral    minimum ~0.70357, rise ~0.92 cm
masculine  minimum ~0.69143, rise ~0.41 cm
```

The cue weakens toward the masculine prior.

Under strong positive underbust deformation, the masculine audit case loses the qualifying local minimum entirely.

That case is intentionally treated as `no-stable-landmark`.

The thresholds are therefore not Character Schema semantics. They are experimental measurement policy subject to further real-mesh validation.

## Coupling boundary

Even after this finder is validated, underbust target calibration cannot be added as an independent serial step.

The pinned underbust target changes canonical chest circumference substantially.

A future underbust solver must evaluate an underbust candidate while re-solving the already-authored chest and shoulder constraints before re-measuring underbust.

That future solver is outside this contract.

## Immutability

The finder is measurement-only.

It must not mutate:

- Character Schema input;
- shape-prior geometry;
- renderer target arrays;
- body triangles.

## Promotion criteria

Before the finder is used by an underbust calibration solver:

1. normal synthetic tests must remain deterministic;
2. pinned real-mesh baseline must select a reference for feminine / neutral / masculine;
3. the known masculine positive-extreme case must remain an explicit negative example unless new evidence justifies a different policy;
4. visual audit must confirm the selected level is anatomically consistent with SCC underbust semantics;
5. `underbustCircumferenceCm` remains `needs-calibration` until the full coupled solver is validated.


## Search-band refinement from acceptance audit

The first implementation audit exposed an important false-positive mode.

With a chest reference at approximately `0.73`, stopping the search at `0.72` excluded the real upper-chest prominence around `0.728`. The detector could then qualify a much lower torso minimum near `0.618`, which is not an acceptable underbust interpretation.

The experimental policy was therefore tightened to:

```text
maxBelowChestFraction: 0.08
minBelowChestFraction: 0.001
```

This serves two purposes:

- include the immediately sub-chest prominence needed to establish local-minimum prominence;
- exclude unrelated lower-torso minima that are too far below the authored chest reference to represent "immediately below chest tissue."

The pinned real-mesh acceptance audit locks this behavior across all sampled underbust weights. Every sampled case except the known masculine `+1` negative example must select a landmark within 0.08 body-height fractions below the current chest reference.
