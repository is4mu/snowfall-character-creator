# Chest Reference Plane

## Status

Experimental SCC field-specific measurement logic for `chestCircumferenceCm`.

This layer sits above the generic [Body Surface Cross-Section Measurement](body-cross-section.md) engine.

It does not apply renderer targets and does not persist renderer-local state.

## Semantic target

The Body Measurement Protocol defines the chest reference level as the horizontal level associated with the fullest upper torso/chest region below the axilla and above the natural waist.

A renderer needs an operational procedure for selecting that level on geometry.

The current prototype implements:

```text
body-only bounds
      |
      v
experimental thoracic search band
      |
      v
sample horizontal body cross-sections
      |
      v
discard invalid topology
      |
      v
select central torso loop per sample
      |
      v
choose maximum perimeter
      |
      v
deterministic tie-break near band midpoint
```

## Experimental MakeHuman adapter search band

Current policy:

```text
lower body-height fraction: 0.62
upper body-height fraction: 0.78
sample count:               33
appendage merge jump ratio: 1.25
```

The fractions are measured from body-only `minY` to body-only `maxY`.

They are renderer policy, not Character Schema.

The band is intentionally labeled experimental until real-mesh visual/anatomical audit confirms that it remains below the axilla and above the natural waist across relevant body priors and explicit dimensions.

## Candidate generation

For each evenly spaced sample:

1. compute raw plane Y from body-only bounds;
2. slice explicit body triangles;
3. retain full topology diagnostics;
4. reject open contour topology;
5. reject branching/non-manifold topology;
6. require at least one closed loop;
7. select the central torso loop;
8. record its raw perimeter.

Detached loops such as arms are allowed to exist.

They do not replace the central torso loop when the torso contains the supplied body center.


## Axilla / appendage-merge boundary

The first real pinned-mesh audit exposed an important failure mode.

For the representative feminine 162 cm body with explicit 38 cm shoulders, the unmodified torso scan produced approximately:

```text
body-height fraction 0.73 -> 88.30 cm, 3 loops
body-height fraction 0.74 -> 88.53 cm, 3 loops
body-height fraction 0.75 -> 88.90 cm, 3 loops
body-height fraction 0.76 -> 128.69 cm, 1 loop
body-height fraction 0.77 -> 120.46 cm, 1 loop
body-height fraction 0.78 -> 115.33 cm, 1 loop
```

The abrupt jump at ~0.76 occurs when previously detached arm/torso contours merge into one connected contour above the intended below-axilla chest level.

A pure "maximum perimeter" rule therefore selected an anatomically invalid chest contour.

### Experimental geometric rule

SCC now detects the first **appendage-merge discontinuity** between adjacent valid samples when both conditions hold:

1. the closed-loop count decreases; and
2. the selected central-loop perimeter increases by at least `appendageMergeJumpRatio`.

The current experimental threshold is:

```text
appendageMergeJumpRatio = 1.25
```

A loop-count change by itself is insufficient.

A perimeter jump by itself is also insufficient.

This deliberately requires both topology and geometry evidence.

### Candidate exclusion

When a boundary is detected:

```text
last valid below-boundary sample
          |
          v
appendage merge boundary  <-- excluded
          |
          v
all higher samples        <-- excluded
```

The excluded samples remain in diagnostics with:

```text
status: excluded-above-appendage-merge
```

The finder then selects the maximum valid torso perimeter only from samples below the boundary.

### Why this remains experimental

This is an SCC-owned operational approximation of "below the axilla."

It is not asserted to be a universal anthropometric definition.

Stable promotion requires confirming the boundary behavior across:

- feminine / neutral / masculine shape priors;
- representative height and shoulder values;
- chest target deformations;
- future renderer adapters.

If a renderer can provide a stronger renderer-independent axilla landmark contract later, that can replace this heuristic without changing Character Schema.

## Selected plane

Valid candidates are ranked by:

1. exclude the detected appendage-merge boundary and every higher slice;
2. among remaining candidates, greater torso perimeter;
3. if equal within tolerance, closer normalized height to the search-band midpoint;
4. if still tied, lower normalized height.

This rule is deterministic.

The finder returns:

- raw plane Y;
- normalized body-height fraction;
- raw torso perimeter;
- selected-loop centroid;
- body-only bounds;
- per-sample topology diagnostics.

## Measurement in centimeters

Once a reference plane is selected:

```text
cmPerRawUnit =
  canonicalHeightCm / bodyRawHeight

chestCircumferenceCm =
  selectedRawPerimeter * cmPerRawUnit
```

The current module can return this measured centimeter value.

It does not solve any renderer target weight.

## Failure behavior

If no sampled plane produces a valid central closed contour:

```text
status: no-valid-slice
```

The caller receives sample diagnostics.

No synthetic chest measurement is fabricated.

## Renderer independence

The plane finder does not use:

- MakeHuman measurement vertex indices;
- MakeHuman measurement paths;
- MakeHuman application code;
- MakeHuman target weights.

Its geometry inputs are only:

- positions;
- explicit body triangles;
- body-only height vertex indices.

## Tests

Synthetic tests cover:

- a torso whose known widest section is at the center;
- detached side geometry that must not replace the torso loop;
- centimeter normalization;
- deterministic plateau tie-breaking;
- invalid search-band rejection;
- no-valid-slice diagnostics.

## Next validation gate

Before stable use:

1. run the finder on the pinned real MakeHuman body;
2. inspect selected Y/fraction for feminine, neutral, and masculine shape priors;
3. verify the selected level visually corresponds to SCC chest semantics;
4. apply the pinned CC0 bust-circ decrease/increase targets;
5. verify that measured chest circumference is monotonic enough for a solver;
6. solve canonical `chestCircumferenceCm` while re-evaluating the reference plane after deformation.

The finder remains experimental until those checks are complete.
