# Paired thorax reference landmarks

## Status

Experimental measurement prototype.

Contract:

```text
scc-thorax-reference-landmarks-v0
```

This contract is a protocol-aligned replacement candidate for the current independent chest and underbust reference finders.

It is **not yet used by the coupled chest solver**.

## Why this exists

Pinned real-mesh sweep evidence showed that the legacy chest finder can jump between adjacent torso levels when several horizontal perimeters are nearly tied.

The legacy rule is:

```text
chest = largest eligible horizontal torso perimeter
```

That is also weaker than SCC's canonical measurement protocol.

The Body Measurement Protocol defines the chest reference level as the horizontal plane through the **greatest anterior chest/bust prominence** while excluding the arms.

For bodies without a distinct breast prominence, SCC uses the visually/structurally fullest thoracic level as a fallback.

## Core idea

Chest and underbust are treated as related landmarks on the same anterior thorax profile.

The generic finder receives an explicit horizontal surface direction:

```text
surfaceDirection = {x, z}
```

No renderer axis is hard-coded.

For the pinned MakeHuman audit only:

```text
{x: 0, z: 1}
```

is supplied by the adapter boundary.

## Sampling

The prototype currently reuses the legacy chest band:

```text
lowerBodyHeightFraction = 0.62
upperBodyHeightFraction = 0.78
sampleCount = 33
```

At each horizontal slice:

1. compute the body-only cross-section;
2. reject open/non-manifold topology;
3. select the central torso loop;
4. record perimeter;
5. project loop points onto the supplied anterior direction and keep the maximum projected coordinate.

The existing appendage-merge detector is then used to exclude the arm/axilla merge region.

## Distinct anterior-prominence mode

The remaining profile is searched for a local minimum followed by a nearby anterior peak.

Initial experimental thresholds reuse the previously audited underbust policy:

```text
minProminenceHeightFraction:       0.002
minPeakSeparationHeightFraction:   0.01
maxPeakSeparationHeightFraction:   0.06
```

If multiple minimum/peak pairs qualify, the pair whose following peak has the **greatest anterior projection** is selected.

The result is:

```text
mode = anterior-prominence-pair

chest
  = following anterior peak

underbust
  = paired local minimum
```

This directly reflects SCC's semantic relationship:

```text
underbust lower boundary
        |
        v
anterior chest/bust prominence
        |
        v
chest reference level
```

## Fallback mode

If no qualifying anterior prominence pair exists:

```text
mode = fullest-thorax-fallback
```

Chest is selected from the fullest eligible thoracic perimeter.

Underbust becomes:

```text
no-stable-landmark
```

The fallback is explicit and must not be represented as if a distinct breast-prominence landmark had been found.

This fallback remains experimental and may need a more stable plateau rule after broader real-mesh evidence.

## Why the legacy solver is not switched yet

The paired finder changes the semantic level at which chest circumference is measured.

That can alter the renderer-weight response seen by the existing coupled chest solver.

The project therefore validates the new finder **side-by-side** first.

The same pinned sweep that exposed legacy switching records:

- legacy chest reference fraction;
- legacy measured chest circumference;
- paired thorax mode;
- paired chest fraction;
- paired chest circumference;
- paired underbust status/fraction;
- jumps in each reference sequence.

Only after the paired finder survives that audit should coupled calibration adopt it.

## Acceptance focus

Primary case:

```text
heightCm = 162
shoulderBreadthCm = 39
shapePrior = feminine
81 bust renderer weights
```

The legacy finder is already known to jump:

```text
0.750 -> 0.740
0.740 -> 0.730
```

The paired finder should not reproduce those jumps merely because perimeter candidates exchange rank.

Controls also cover:

```text
heightCm = 162
shoulderBreadthCm = 38
shapePrior = feminine / neutral / masculine
```

## Boundaries

This prototype does not:

- change Character Schema;
- replace the current coupled chest solver;
- implement underbust target calibration;
- infer identity from morphology;
- use MakeHuman measurement-index tables;
- add display-only offsets.

Source geometry remains immutable.
