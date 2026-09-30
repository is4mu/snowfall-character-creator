# Coupled Chest Circumference Calibration

## Status

Experimental MakeHuman renderer calibration for the canonical SCC fields:

- `measurements.chestCircumferenceCm`
- `measurements.shoulderBreadthCm`

Contract:

```text
scc-makehuman-coupled-chest-calibration-v0
```

This calibration is renderer-local and disposable. Renderer weights are never canonical character data.

## Why chest cannot be solved independently

The pinned MakeHuman `measure-bust-circ` target does not affect only the torso circumference.

Real pinned-mesh audit showed that its decrease side also changes the already-calibrated shoulder breadth.

For the representative feminine body, applying the bust target after solving 38 cm shoulders moved shoulder breadth by as much as roughly 0.71 cm.

Therefore this order is invalid:

```text
solve shoulders once
      |
      v
apply chest target
      |
      v
done
```

It can violate an explicit canonical shoulder measurement.

## Correct candidate evaluation

Each chest candidate starts from immutable shape-prior geometry:

```text
shape-prior positions
      |
      v
apply bust candidate weight
      |
      v
re-solve shoulderBreadthCm
      |
      v
re-find chest reference plane
      |
      v
measure chest circumference
```

This makes explicit SCC measurements authoritative over renderer priors and renderer target interactions.

## Pinned chest assets

The MakeHuman adapter pins the CC0 target pair:

```text
measure-bust-circ-decr.target
blob: 35d7905904790aee386dc6a1180de717f1d6cedf

measure-bust-circ-incr.target
blob: 096e02648d0c4ff70989f2a78d7c590c60dc4ebb
```

Both are pinned under the same upstream MakeHuman commit used by the real-mesh prototype.

## Why global bisection is rejected

The corrected chest measurement response is usable near the representative target, but it is not guaranteed globally monotonic.

The experimental chest reference plane can move from one sampled torso level to another as geometry changes.

That means a single bisection over renderer weight `[-1, 1]` would make an invalid global monotonicity assumption.

SCC instead uses:

```text
coarse renderer-weight scan
      |
      v
all valid measured samples
      |
      v
adjacent residual sign-change brackets
      |
      +-- zero brackets --> explicit failure/range
      |
      +-- one bracket ----> local refinement
      |
      +-- many brackets --> explicit ambiguity
```

## Coarse scan

The scan samples renderer weights uniformly over `[-1, 1]`.

Every sample performs the full coupled candidate evaluation.

The scan retains:

- weight;
- chest measurement;
- residual from target chest centimeters;
- nested shoulder calibration;
- chest reference-plane diagnostics;
- invalid-evaluation status when a candidate cannot be measured.

Invalid samples break continuity.

SCC never creates a synthetic bracket across an invalid sample.

## Exact hits

One coarse sample already within tolerance is a valid solution.

Multiple distinct coarse exact hits are reported as ambiguity rather than silently choosing one renderer state.

## Local bracket refinement

If exactly one adjacent valid sign-change bracket exists, SCC refines only that interval.

The refinement does not assume increasing or decreasing response.

It tracks residual signs at the interval endpoints.

Every midpoint:

1. re-applies the chest candidate from immutable prior geometry;
2. re-solves shoulder breadth;
3. re-selects the chest reference plane;
4. re-measures chest;
5. updates the sign-change interval.

## Discontinuity protection

A sign change does not prove that a continuous root exists.

If the renderer response jumps across the requested value and refinement cannot produce a sample within tolerance, SCC returns:

```text
discontinuous-bracket
```

It does not report a false success.

## Explicit result states

The solver can return:

```text
solved
out-of-range
no-bracket
no-valid-evaluations
ambiguous-multiple-brackets
invalid-evaluation
discontinuous-bracket
```

Callers must handle these states explicitly.

## Real pinned-mesh audit

Audit constraints:

```text
heightCm = 162
shoulderBreadthCm = 38
target chestCircumferenceCm = 88
```

For each bust weight, shoulder breadth was re-solved before chest measurement.

### Feminine shape prior

Approximate reachable chest range:

```text
75.04 .. 106.34 cm
```

Coarse 88 cm crossing:

```text
bust weight -0.25 .. 0.00
```

### Neutral shape prior

Approximate reachable chest range:

```text
77.25 .. 106.79 cm
```

Coarse 88 cm crossing:

```text
bust weight -0.50 .. -0.25
```

### Masculine shape prior

Approximate reachable chest range:

```text
81.65 .. 108.87 cm
```

Coarse 88 cm crossing:

```text
bust weight -0.75 .. -0.50
```

The representative 88 cm chest target is therefore reachable under all three current shape priors while preserving 38 cm shoulders.

These ranges are prototype audit observations, not Character Schema validation limits.

## Browser render order

When height, shoulder breadth, and chest circumference are authored:

```text
pinned base mesh
      |
      v
body.shapePrior
      |
      v
coupled chest scan/refinement
  bust candidate
      |
      v
  shoulder re-solve
      |
      v
  chest re-measure
      |
      v
solved renderer positions
      |
      v
canonical height fit
```

If chest calibration cannot solve, the prototype does not pretend the chest value was satisfied. It falls back to the shoulder-only renderer state and exposes the chest failure in diagnostics.

## Immutability

Every candidate starts from the same prior positions.

No candidate accumulates deformation from a previous candidate.

The canonical body JSON is not mutated except when the user explicitly edits a canonical UI control.

## Current limitations

This is still prototype calibration because:

- shoulder landmarks remain provisional;
- the chest reference-plane finder is experimental;
- the appendage-merge axilla heuristic is experimental;
- only one renderer adapter is currently audited;
- broader body dimensions can introduce additional target interactions.

Future multi-measurement calibration may require a generalized constraint solver rather than nested one-dimensional solves.

## Tests

Contract tests cover:

- non-monotonic coarse scans;
- one local sign-change bracket;
- multiple-bracket ambiguity;
- multiple exact-hit ambiguity;
- unreachable target ranges;
- invalid evaluations breaking continuity;
- discontinuous sign-change protection;
- synthetic coupled body geometry;
- shoulder preservation during chest solve;
- immutable prior geometry.
