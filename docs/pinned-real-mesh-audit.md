# Pinned Real Mesh Integration Audit

## Purpose

The normal real-mesh test suite is intentionally hermetic.

It uses synthetic geometry and local contract tests so pull-request CI does not depend on GitHub raw-content availability or any other external network service.

The pinned real-mesh integration audit is a separate verification layer for the exact MakeHuman CC0 assets used by the prototype.

## What it verifies

The audit downloads only assets already pinned in `asset-manifest.mjs`.

Before parsing any downloaded asset, SCC recomputes the Git object blob SHA:

```text
sha1("blob " + byteLength + "\0" + bytes)
```

The bytes are rejected unless that SHA exactly matches the manifest.

There is no fallback to an unverified response.

## Current canonical audit case

The audit currently exercises:

```text
heightCm = 162
shoulderBreadthCm = 38
chestCircumferenceCm = 88
```

for all three SCC renderer shape priors:

```text
feminine
neutral
masculine
```

For each prior it verifies:

- the exact pinned body surface structure;
- coupled chest/shoulder calibration returns `solved`;
- chest residual is at most 0.01 cm;
- shoulder residual is at most 0.01 cm;
- renderer weights stay within `[-1, 1]`;
- the selected chest plane is below the detected appendage-merge boundary;
- immutable shape-prior geometry is not mutated by calibration.

## Output

The script writes a machine-readable JSON report containing:

- upstream repository and commit;
- canonical audit values;
- body-surface counts;
- every verified asset path and Git blob SHA;
- per-shape-prior calibration result;
- renderer weights;
- measurement residuals;
- selected chest height;
- detected appendage-merge boundary.

Default output:

```text
artifacts/pinned-real-mesh-audit.json
```

## Local/manual execution

Run:

```bash
node prototype/real-mesh/audit/pinned-real-mesh-audit.mjs
```

or choose an explicit report path:

```bash
node prototype/real-mesh/audit/pinned-real-mesh-audit.mjs \
  --output artifacts/pinned-real-mesh-audit.json
```

The audit requires network access to the exact commit-pinned raw GitHub assets.

## GitHub Actions

Workflow:

```text
.github/workflows/pinned-real-mesh-audit.yml
```

The permanent trigger is:

```text
workflow_dispatch
```

It is intentionally **not a required pull-request check**.

This preserves two separate guarantees:

```text
normal PR CI
  -> deterministic, hermetic contracts

pinned integration audit
  -> exact external CC0 asset compatibility
```

A temporary feature-branch push trigger may be used only to bootstrap/verify a workflow change before merge; it must be removed before the workflow lands on `main`.

## Failure interpretation

A failed audit can mean one of two broad classes of problem.

### Asset identity failure

Examples:

- raw response differs from the pinned Git blob;
- a manifest SHA is incorrect;
- the requested pinned URL is unavailable.

The audit stops before using those bytes.

### Calibration invariant failure

Examples:

- body group topology no longer matches the pinned contract;
- shoulder or chest target becomes unreachable;
- residual tolerance is exceeded;
- the chest plane is no longer below the appendage merge boundary;
- renderer code mutates its prior input.

These failures require investigation before changing expected values.

The audit must not be "fixed" by simply widening tolerances or updating expected numbers without a corresponding design review.

## Scope

This audit validates the current MakeHuman renderer adapter.

It does not make MakeHuman data canonical SCC character data.

Character Schema remains renderer-independent.
