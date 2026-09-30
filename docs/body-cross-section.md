# Body Surface Cross-Section Measurement

## Status

Prototype geometric measurement engine for circumference-style SCC body measurements.

This module is renderer-independent at the geometry level.

It does not depend on MakeHuman measurement code, renderer morph weights, or hard-coded circumference vertex loops.

## Purpose

Several canonical Body Model fields are circumferences:

- `chestCircumferenceCm`
- `underbustCircumferenceCm`
- `waistCircumferenceCm`
- `hipCircumferenceCm`
- `neckCircumferenceCm`
- limb circumferences

A renderer adapter needs a way to measure these values on a deformed mesh so a solver can compare rendered geometry with canonical centimeters.

The generic operation is:

```text
indexed body surface
        |
        v
horizontal measurement plane
        |
        v
triangle/plane intersections
        |
        v
closed contour loops
        |
        v
selected anatomical loop
        |
        v
perimeter in raw mesh units
        |
        v
canonical centimeter normalization
```

## Inputs

The engine consumes:

- a floating-point `positions` array;
- an indexed triangle array;
- a horizontal plane `Y`;
- body-only height vertex indices for centimeter normalization.

The triangle array is explicit.

This is important because a source OBJ may contain helper, rig, clothing-proxy, or other non-body groups that must not participate in anthropometry.

## Triangle-plane intersection

Each triangle is intersected with the horizontal plane.

For normal non-coplanar intersections, the result is a line segment in XZ space.

The implementation:

- supports intersections through triangle vertices;
- deduplicates numerically equivalent points;
- uses the farthest valid pair when a degenerate intersection produces more than two unique points;
- reports triangles that are fully coplanar with the plane instead of treating them as an ordinary contour.

Measurement planes should generally avoid intentionally coplanar surface patches.

## Segment deduplication

Adjacent triangles frequently produce contour segments that meet at the same geometric point.

Renderer floating-point arithmetic can produce very small coordinate differences.

SCC therefore quantizes XZ endpoint identity using a configurable tolerance before graph assembly.

Duplicate undirected segments are removed.

This makes the result independent of face iteration order and prevents triangulation seams from double-counting perimeter.

## Loop assembly

Deduplicated contour segments form an undirected graph.

A clean closed body cross-section normally produces graph nodes of degree two.

The engine traverses unused edges deterministically and classifies results as:

- closed loops;
- open chains;
- branching/non-manifold topology.

Open or branching topology is not silently converted into a circumference.

## Multiple loops

A single horizontal slice can cross several disconnected body components.

For example, depending on pose and slice height:

```text
left arm    torso    right arm
   O          O          O
```

The engine therefore returns all closed loops.

It does not assume the largest loop is always the torso.

## Central torso loop selection

For torso-style measurement, the preferred loop is the loop containing the supplied body center point in XZ space.

If no loop contains that center, the deterministic fallback is the loop whose centroid is nearest to the center, with perimeter as a tie-breaker.

This allows detached arm loops to coexist without contaminating torso circumference.

Future field-specific measurement logic may replace this generic selector with stricter anatomical criteria.

## Centimeter normalization

Raw perimeter is converted using the same body-only scale used for canonical height:

```text
cmPerRawUnit =
  canonicalHeightCm / bodyRawHeightUnits

circumferenceCm =
  rawLoopPerimeter * cmPerRawUnit
```

`bodyRawHeightUnits` must come from the explicit anthropometry surface vertex set.

Helper vertices cannot participate.

## Failure states

The high-level circumference function returns a measurement only when the cross-section topology is suitable.

Current explicit failure states include:

```text
open-cross-section
non-manifold-cross-section
```

No renderer target solver should treat these states as a valid numeric measurement.

## Determinism

Given the same:

- positions;
- triangles;
- plane Y;
- tolerances;
- body center;

the loop set, loop ordering, selected loop, and perimeter are deterministic.

No random sampling is used.

## Tests

Synthetic contract tests cover:

- exact rectangular perimeter;
- triangulation seams;
- multiple disconnected loops;
- torso-loop selection;
- body-only height normalization despite an extreme helper vertex;
- open contour reporting;
- branching/non-manifold reporting.

These synthetic shapes intentionally avoid MakeHuman-specific topology.

## Boundary with semantic measurement rules

This engine answers:

> What closed contour does this horizontal plane cut through the body surface?

It does **not** answer:

> Which horizontal plane is the canonical chest/waist/hip measurement plane?

That semantic selection belongs to field-specific SCC measurement logic.

For example, chest measurement still needs an SCC-owned implementation of the protocol rule:

> use the horizontal chest level associated with the greatest anterior/full thoracic prominence while excluding arms.

The next implementation stage should define and test that plane-selection rule, then use this cross-section engine to measure the resulting contour.

## Licensing boundary

This module is original SCC code.

It does not copy:

- MakeHuman measurement index tables;
- MakeHuman measurement algorithms;
- MakeHuman AGPL application logic.

It operates only on generic triangle geometry supplied by the renderer adapter.
