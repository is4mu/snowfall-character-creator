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


## Verified pinned real-mesh result

Manual workflow:

```text
run: 36721172203
head: 636165190a943df2200cfca960c21be1013c65b2
conclusion: success
```

### Primary observed case: feminine / 162 / shoulder 39

Measured chest range across 81 bust weights:

```text
76.39 .. 106.67 cm
```

Two discontinuous chest-reference jumps were detected.

#### Jump 1

```text
bust weight:      0.650 -> 0.675
measured chest: 100.390 -> 100.809 cm
chest fraction:   0.750 -> 0.740
axilla boundary:  0.755 -> 0.755
```

Immediately before the jump, the leading eligible perimeter candidates were nearly tied:

```text
0.750 : 9.8517519635 units
0.740 : 9.8504034977 units
0.730 : 9.8416867818 units
```

Immediately after the jump:

```text
0.740 : 9.8929141604 units
0.750 : 9.8912953344 units
0.730 : 9.8864217153 units
```

The winner changes because of a very small perimeter ordering change; the appendage-merge boundary does not move.

#### Jump 2

```text
bust weight:      0.750 -> 0.775
measured chest: 102.110 -> 102.562 cm
chest fraction:   0.740 -> 0.730
axilla boundary:  0.755 -> 0.755
```

Immediately before:

```text
0.740 : 10.0205996088 units
0.730 : 10.0202603503 units
0.735 : 10.0117180853 units
```

Immediately after:

```text
0.730 : 10.0648973524 units
0.740 : 10.0632173862 units
0.735 : 10.0558197570 units
```

Again the switch is caused by competing torso maxima rather than an arm/axilla topology event.

### Underbust behavior around the jumps

The experimental underbust finder remained `selected` throughout both jump neighborhoods.

Around jump 1:

```text
chest fraction     0.750 -> 0.740
underbust fraction 0.70668 -> 0.70796
```

Around jump 2:

```text
chest fraction     0.740 -> 0.730
underbust fraction ~0.70514 -> ~0.70643
```

No underbust status or fraction discontinuity was detected by the audit helper.

The apparent chest-to-underbust vertical distance changes sharply because the **chest reference jumps**, not because the underbust landmark jumps.

### Shoulder-38 feminine control

The lower-density control also detected a chest-reference switch:

```text
bust weight:      0.250 -> 0.375
measured chest:  92.907 -> 95.019 cm
chest fraction:   0.750 -> 0.730
axilla boundary:  0.755 -> 0.755
```

This coarse control is consistent with the earlier manual impression that switching can appear around the low/mid-90 cm region when shoulder breadth is 38 cm.

The exact threshold was not localized because this control used only 17 bust-weight samples.

### Neutral / masculine controls

At the current 17-sample control density:

```text
neutral:   no detected >1-step chest-reference jump
masculine: no detected >1-step chest-reference jump
```

This does not prove perfect continuity; it only shows no discontinuity at the audit's current control resolution.

## Root-cause conclusion

The current chest rule is unstable because it selects the **largest eligible horizontal perimeter**.

The pinned real mesh contains several adjacent thorax levels with almost equal perimeter. Bust deformation changes their ordering by tiny amounts, so the selected chest plane can jump by 1–2 cm-height samples even though the underlying body deformation is continuous.

The appendage/axilla exclusion is functioning as designed and is not the source of these jumps.

## Semantic mismatch with SCC protocol

SCC's Body Measurement Protocol defines the chest reference level as:

> the horizontal plane passing through the greatest anterior chest/bust prominence of the upper torso while excluding the arms.

For bodies without a distinct breast prominence, the protocol falls back to the visually/structurally fullest thoracic level below the axilla and above the natural waist.

Therefore `largest horizontal perimeter` should not remain the primary selection rule for bodies with a distinct anterior chest/bust prominence.

## Next design decision

Replace the current independent-reference approach with a protocol-aligned thorax landmark analysis:

1. derive an anterior surface profile from central torso cross-sections;
2. identify whether a distinct chest/bust prominence exists;
3. when it exists, select the chest level from the greatest stable anterior prominence;
4. derive underbust from the related lower-boundary/profile minimum;
5. only when no distinct anterior prominence exists, use a documented fullest-thorax fallback;
6. retain explicit unsupported/ambiguous states rather than silently switching between nearly tied perimeter maxima.

The replacement must be validated on the same pinned sweep that exposed this bug before it is used by the coupled chest solver.
