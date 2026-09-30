# Posture Boundary

## Decision

**Posture is not part of Body Model v1.**

Body Model v1 describes morphology: dimensions and shape facts that remain meaningful when the same character changes stance or pose.

Posture describes an arrangement of that body in a particular state or context.

The project therefore separates:

1. canonical body morphology;
2. preview/runtime posture;
3. possible future habitual-posture semantics.

## Why posture is not body morphology

A character can keep the same:

- height;
- shoulder breadth;
- torso depth;
- limb lengths;
- body composition;

while standing upright, leaning forward, retracting or protracting the shoulders, changing pelvic orientation, or moving the head.

Those changes do not create a different body.

Treating them as body measurements would make a serialized character depend on which pose happened to be active when the file was saved.

## Current preview posture contract

The procedural prototype now has a separate editor/renderer state:

```text
scc-preview-posture-v0
├── pelvicTiltDeg
├── trunkFlexionDeg
├── shoulderProtractionDeg
├── headForwardCm
└── headPitchDeg
```

This contract is intentionally outside Character Schema.

It exists only to test that the same `scc-body-v1` body can be displayed in multiple postures without changing canonical measurements.

## Data flow

```text
Character Schema
  body: scc-body-v1
        |
        v
Body adapter
        |
        v
renderer body geometry
        |
        + previewPosture (editor/runtime state)
        |
        v
displayed pose
```

The posture state is supplied independently to the renderer.

The body adapter does not derive posture, does not output posture, and does not mutate body measurements when posture changes.

## Preview posture fields

### pelvicTiltDeg

Prototype-only sagittal pelvic orientation.

This changes pelvis orientation in the gray-body preview.

It does not change pelvis or torso dimensions.

### trunkFlexionDeg

Prototype-only forward/backward trunk orientation.

This rotates the rendered upper body while preserving torso geometry.

### shoulderProtractionDeg

Prototype-only forward placement of the shoulder region.

The simple procedural body has no scapular skeleton, so the current renderer converts this angle into a small renderer-local forward offset.

That conversion is renderer-specific and must not become Character Schema semantics.

### headForwardCm

Prototype-only forward head translation.

The use of centimeters makes the preview control understandable, but the field still represents current pose state rather than body morphology.

### headPitchDeg

Prototype-only head pitch.

## Habitual posture is a different question

Some fictional characters may have a recognizable habitual stance:

- usually upright;
- often slouched;
- habitually forward-headed;
- shoulders often drawn inward;
- military-like bearing.

That may be a durable character characteristic, but it should not be represented by saving a current joint pose inside `body`.

Possible future homes include:

- a presentation/mannerism profile;
- a behavior/style profile;
- Life Engine state or tendencies;
- a dedicated posture profile with context-dependent defaults.

No such canonical model is defined in v1.

The project should first determine whether downstream systems need a persistent **tendency** or only current pose state.

## Medical and structural conditions

This prototype does not model:

- scoliosis;
- fixed spinal deformity;
- contracture;
- joint-range limitation;
- injury;
- clinical kyphosis/lordosis measurements.

Those may affect morphology, movement capability, or health state and require a different semantic model.

They should not be approximated through preview posture sliders.

## Research and standards boundary

ISO 11226:2000, *Ergonomics — Evaluation of static working postures*, evaluates working posture using body angles together with time/task considerations:

https://www.iso.org/standard/25573.html

As of 2026, ISO lists that edition as current but under revision, with ISO/AWI 11226 under development to replace it:

https://www.iso.org/standard/90229.html

This reinforces an important engineering distinction for SCC: posture is naturally expressed through orientation/state variables and context, rather than being treated as a fixed anthropometric body dimension.

SCC does not claim conformance with ISO 11226 and does not reproduce the standard's protected text.

## Schema invariant

Character Schema must reject posture state placed directly inside `body`.

For example, this is invalid:

```json
{
  "body": {
    "model": "scc-body-v1",
    "posture": {
      "trunkFlexionDeg": 10
    }
  }
}
```

The strict `additionalProperties: false` body contract enforces this boundary.

## Renderer invariant

Changing preview posture must not change:

- canonical body JSON;
- body-adapter dimensions;
- body measurements;
- body composition;
- renderer-local surface policy derived from body data.

The posture layer only changes display transforms.

## Why the prototype values are not a future API promise

The current five posture controls are chosen because the procedural mesh can demonstrate the boundary with them.

A production rig might instead use:

- joint rotations;
- inverse kinematics;
- skeletal landmarks;
- animation clips;
- motion-capture pose data.

Therefore `scc-preview-posture-v0` is disposable prototype state.

## Promotion rule for habitual posture

A future persistent posture tendency should be added only when:

1. it describes the character across contexts rather than one frame;
2. its semantics are independent of a particular skeleton or rig;
3. Life Engine / creator workflows have a clear owner for it;
4. current pose can still vary independently from the tendency;
5. it does not duplicate medical/anatomical data.

## Result

Body Model v1 remains a morphology model.

Preview posture remains editor/renderer state.

Habitual posture remains intentionally deferred until behavior/presentation ownership is designed.
