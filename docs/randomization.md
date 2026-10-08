# Deterministic Randomization

## Status

Character Core v0.1 foundation.

This document defines the reproducibility mechanics for random character authoring.

It intentionally does **not** define a universal realistic population distribution for body, personality, identity, or appearance.

## Contract

Character Core randomization is:

- seeded;
- deterministic;
- keyed by semantic field path;
- independent of plan ordering;
- stable when unrelated randomized fields are added;
- independent of `Math.random()`;
- versioned explicitly.

The initial RNG contract is:

```text
scc-keyed-rng-v1
```

## Why keyed rather than sequential

A single sequential PRNG stream makes generated characters fragile.

For example, if a new field is inserted before `personality.social.sociability`, every later draw would shift and a previously reproducible seed would generate a different character.

SCC instead derives each field draw from:

```text
rng-version
+ seed
+ semantic field key
+ counter
```

This means:

- reordering generation rules does not change output;
- adding an unrelated field does not change existing fields;
- a field can receive additional deterministic draws later through an explicit counter;
- generator compatibility can be reasoned about field by field.

## Seed normalization

Seed strings are normalized to Unicode NFC before hashing.

Canonically equivalent strings therefore generate the same draws.

## Initial distributions

The v0.1 core supports only small, explicit primitives:

- `choice`;
- `uniform`;
- stepped `uniform`.

A generation plan is caller-owned and explicit.

Example:

```js
[
  {
    path: ["body", "shapePrior"],
    distribution: {
      type: "choice",
      values: ["feminine", "neutral", "masculine"],
    },
  },
  {
    path: ["body", "composition", "muscularity"],
    distribution: {
      type: "uniform",
      min: 0,
      max: 1,
      step: 0.01,
    },
  },
]
```

## No default personality population yet

Personality Model v1 has explicit open questions about believable covariance.

Therefore v0.1 must not pretend that 30 independent uniform sliders form a realistic default character population.

The randomization engine is frozen before the population model.

A future default generator profile must document:

- distributions;
- covariance/dependencies;
- demographic or authoring assumptions;
- generator version;
- compatibility behavior;
- tests against implausible combinations.

## Plan independence

Randomization paths in one plan may not overlap.

For example, a plan may not randomize both:

```text
body.composition
body.composition.muscularity
```

because the result would depend on which edit wins.

Rejecting overlapping paths preserves plan-order independence.

## Validation

`randomizeCharacterFields` may be given the Character Schema validator.

When present, the completed randomized character must validate before it is returned.

Randomization never weakens schema validation or silently repairs an invalid result.

## Compatibility

The RNG version is part of the reproducibility contract.

If a future algorithm intentionally changes generated values, it must use a new RNG/generator version rather than silently changing `scc-keyed-rng-v1`.

Pinned compatibility vectors in the core test suite protect the initial algorithm from accidental drift.
