# Chest reference sweep audit

## Status

Exploratory pinned-real-mesh audit.

Contract:

```text
scc-chest-reference-sweep-audit-v0
```

This audit exists to characterize whether the current experimental chest reference finder switches between distinct horizontal torso maxima as bust deformation changes.

It does not change the chest finder.

## Why this audit was added

Manual side-view review of the real-mesh prototype found that the blue chest measurement contour can appear high near the upper chest/axilla region at a lower solved chest circumference and then move downward to a more plausible breast/chest level at a larger circumference.

The observed representative case was:

```text
heightCm = 162
shapePrior = feminine
shoulderBreadthCm = 39
```

with a visible difference between approximately 89.9 cm and 103.7 cm measured chest circumference.

The current chest finder selects the largest eligible horizontal torso perimeter below the appendage-merge boundary. A deformation can therefore change which local maximum wins.

## Primary sweep

The pinned audit evaluates:

```text
shapePrior = feminine
heightCm = 162
shoulderBreadthCm = 39
81 evenly spaced bust renderer weights over [-1, +1]
```

Each weight:

1. starts from immutable shape-prior positions;
2. applies the pinned MakeHuman bust target;
3. re-solves explicit shoulder breadth;
4. runs the current chest reference finder;
5. records measured chest circumference and the selected chest reference;
6. retains the strongest eligible chest candidates for comparison.

This uses renderer weight as the independent variable because it exposes the underlying measurement response directly without repeatedly running the outer chest-target root solver.

## Control sweeps

Lower-density controls use 17 weights for:

```text
heightCm = 162
shoulderBreadthCm = 38

shapePrior:
- feminine
- neutral
- masculine
```

The control sweeps determine whether any switching is specific to the manually observed feminine/39 cm case or is broader.

## Jump definition

The default chest search policy samples:

```text
0.62 .. 0.78 body height
33 samples
```

so one normal sample step is:

```text
0.005 body-height fraction
```

A chest-reference jump is reported only when two adjacent valid renderer-weight samples differ by **more than one normal reference sample step**, plus floating-point tolerance.

One-step movement is treated as normal discrete drift of the existing sampled finder.

For every detected jump the report keeps:

- left/right renderer weight;
- left/right measured chest circumference;
- left/right chest reference fraction;
- reference-fraction delta;
- appendage-merge boundary on both sides;
- strongest eligible perimeter candidates on both sides.

These candidate lists help distinguish:

- appendage/axilla boundary effects;
- a true competition between multiple torso perimeter maxima.

## Underbust follow-up near jumps

Underbust evaluation is intentionally not repeated for every dense sweep point.

Instead, each detected chest-reference jump evaluates a small neighborhood:

```text
one sample before
left side of jump
right side of jump
one sample after
```

For those samples the audit records:

- underbust status;
- selected underbust fraction;
- prominence;
- following peak fraction;
- canonical chest-to-underbust vertical distance.

This keeps the pinned audit practical while still answering whether the orange underbust landmark changes when the blue chest landmark switches.

## Expected use of the result

If no discontinuity is found, the manual visual discrepancy needs another explanation.

If a discontinuity is confirmed, do not patch the display.

The next design step should reconsider chest and underbust as related thorax landmarks. In particular, a future design can evaluate the same anterior thorax profile for:

```text
lower chest boundary / underbust
chest prominence region
chest circumference reference
```

rather than independently choosing:

```text
chest = largest horizontal perimeter
underbust = last prominent anterior-profile minimum below chest
```

The exact replacement rule must be justified by pinned real-mesh evidence.

## Boundaries

This audit does not:

- modify Character Schema;
- change chest calibration semantics;
- implement an underbust solver;
- use MakeHuman AGPL measurement-index tables;
- encode the manual screenshot as a fixed height offset.

All renderer candidates start from immutable shape-prior geometry.
