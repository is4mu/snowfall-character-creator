# Paired thorax reference landmarks

## Status

Experimental measurement contract with **chest semantics promoted into the active coupled chest solver**.

Contract:

```text
scc-thorax-reference-landmarks-v0
```

The protocol-aligned chest landmark is now the active reference used by coupled chest calibration and the browser's blue measurement contour.

The paired underbust result remains experimental and is **not** promoted into an underbust target-weight calibration contract.

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


## First pinned comparison and refinement

The first side-by-side pinned run of this prototype was:

```text
run: 36722902102
head: 58f107b4b94201ada6b8332faa3ebebf36e3fd8b
conclusion: success
```

The initial implementation coupled the chest selection mode to whether a qualifying underbust/chest minimum-to-peak pair existed.

That worked extremely well for feminine morphology:

```text
feminine / shoulder 39 / 81 weights
legacy chest jumps: 2
paired chest jumps: 0
paired chest fraction: 0.73 at every sample
underbust status: selected at every sample
```

The shoulder-38 feminine control was also fully stable.

However, the same binary pair/fallback mode introduced new discontinuities for lower-prominence thorax profiles:

```text
neutral / shoulder 38:
  pair -> fallback near weight 0.5
  chest 0.73 -> 0.75
  underbust selected -> no-stable-landmark

masculine / shoulder 38:
  fallback -> pair near weight -0.625
  chest 0.75 -> 0.725

  pair -> fallback near weight +0.125
  chest 0.73 -> 0.75
```

This showed that **chest existence and underbust existence must not be coupled**.

A body can have a meaningful chest reference even when there is no stable underbust landmark.

### Refined rule

The prototype now separates the two decisions.

Chest is always selected from:

```text
greatest anterior surface coordinate
within the valid thorax band below appendage merge
```

Underbust is then evaluated independently as a local minimum that must pair with that selected chest peak.

Therefore:

```text
chest:
  always selected from anterior thorax geometry

underbust:
  selected only when the corresponding lower-boundary cue is stable
  otherwise no-stable-landmark
```

Diagnostic modes are now:

```text
anterior-maximum-paired-underbust

anterior-maximum-structural-fallback
```

The second mode means that SCC still has a chest reference, but the geometry does not justify a distinct underbust landmark.

Importantly, switching between these diagnostic modes no longer changes the **rule used to select chest**.

This refined version must be rerun against the same pinned sweep before it can replace the legacy finder.


## Second pinned acceptance failure and structural-peak refinement

The second pinned run targeted:

```text
head: a49f457c331250cbf784e5704c5efebd2a3c91af
run: 36727047474
```

The workflow failed intentionally on the new continuity gate:

```text
feminine shoulder-39:
paired thorax chest reference switched by more than one normal sample step
```

This showed that simply selecting the **global anterior maximum sample** is still insufficient. A smooth deformation can change which separated anterior maximum wins, producing a discrete chest-level switch even though underbust stability is no longer involved.

### Refined chest rule

The current prototype now distinguishes:

1. **structural thorax peak selection**;
2. **underbust confidence**.

The anterior profile is first analyzed for local minimum -> following peak structures.

For chest selection:

- a structural minimum/peak candidate may be used even when its prominence is below the underbust confidence threshold;
- the candidate with the greatest anterior peak is selected;
- the prominence threshold does **not** decide whether chest exists.

For underbust selection:

- the same structural pair must also satisfy the explicit prominence threshold;
- otherwise underbust remains `no-stable-landmark`.

Only when no structural minimum/peak candidate exists at all does chest fall back to the greatest anterior surface sample.

Conceptually:

```text
anterior thorax profile
        |
        +--> structural minimum -> peak exists
        |       |
        |       +--> chest = structural peak
        |       |
        |       +--> prominence sufficient
        |               |
        |               +--> underbust = paired minimum
        |               |
        |               +--> otherwise no-stable-landmark
        |
        +--> no structural pair
                |
                +--> chest = anterior-maximum fallback
                +--> underbust = no-stable-landmark
```

This prevents a prominence-confidence threshold from changing the chest semantic level.

### Diagnostic modes

The refined modes are:

```text
anterior-structural-pair
anterior-structural-peak
anterior-maximum-fallback
```

They mean:

- `anterior-structural-pair`: chest structural peak selected and underbust cue is sufficiently prominent;
- `anterior-structural-peak`: chest structural peak selected but underbust cue is too weak to claim a stable underbust landmark;
- `anterior-maximum-fallback`: no structural minimum/peak pair exists, so chest uses the greatest anterior surface sample and underbust is unsupported.

## Audit failure artifact policy

Pinned acceptance failures now write the complete JSON report before returning a non-zero exit code.

The workflow uploads the report with `if: always()`.

Therefore a future continuity failure preserves:

- the exact failing sweep;
- the jump weights;
- measured chest values;
- reference fractions;
- paired modes;
- underbust states.

This avoids losing the evidence needed to refine the algorithm.


## Final pinned acceptance result

Final manual workflow:

```text
run: 36730512488
head: 99cb850d4977a818ec48188a0bf948c45185e83c
conclusion: success
```

The machine-readable acceptance gate reported:

```text
pairedThoraxChestContinuity.status = passed
failures = []
```

### Feminine / 162 / shoulder 39 / 81 weights

Legacy chest jumps:

```text
2
```

Refined thorax chest jumps:

```text
0
```

The refined chest reference remained exactly:

```text
0.73 body-height fraction
```

for all 81 sampled bust weights from -1 through +1.

Representative refined measurements:

```text
weight -1 : 73.74 cm, chest 0.73, underbust 0.71
weight  0 : 88.54 cm, chest 0.73, underbust 0.71
weight +1 : 106.67 cm, chest 0.73, underbust 0.705
```

Underbust remained `selected` for all 81 samples with no detected transition.

This resolves the manually observed feminine chest-reference switching that originally motivated the redesign.

### Feminine / 162 / shoulder 38 control

Legacy chest jumps:

```text
1
```

Refined thorax chest jumps:

```text
0
```

Chest remained at `0.73` for all 17 control samples.

Underbust remained selected for all 17 samples.

### Neutral / 162 / shoulder 38 control

Refined thorax chest jumps:

```text
0
```

Chest remained within adjacent normal samples:

```text
0.725 .. 0.73
```

No >1-step discontinuity was detected.

Underbust is less semantically stable:

```text
selected:             12 / 17
no-stable-landmark:    5 / 17
```

A status transition occurs between renderer weights `0.375` and `0.5`, while chest remains at `0.73`.

This is acceptable for the **chest** prototype because underbust existence no longer changes chest selection.

### Masculine / 162 / shoulder 38 control

Refined thorax chest jumps:

```text
0
```

Chest stays within:

```text
0.72 .. 0.73
```

with only normal one-sample drift.

Underbust remains intentionally conservative and is not ready for production adoption:

```text
selected:              6 / 17
no-stable-landmark:   11 / 17
```

The audit also observed an underbust fraction transition:

```text
0.69 -> 0.67
```

between renderer weights `-0.375` and `-0.25`.

That is a 0.02 body-height-fraction change and must not be promoted into a production underbust calibration contract without further investigation.

## Promotion decision

The pinned evidence supported promoting the **new chest semantic rule** into active coupled calibration:

```text
Chest = protocol-aligned anterior structural peak / anterior fallback
```

The evidence does **not** support promoting the paired underbust result at the same time.

The active integration now:

1. measures coupled chest candidates from the refined thorax chest reference;
2. passes that exact reference to the blue browser measurement contour;
3. keeps underbust experimental and independently guarded.

The remaining gates are:

1. rerun the 162 / 38 / 88 pinned solve against the promoted implementation;
2. repeat manual front/side/orbit review before any underbust target-weight solver is introduced.

This separation preserves the successful chest fix without overstating underbust confidence.
