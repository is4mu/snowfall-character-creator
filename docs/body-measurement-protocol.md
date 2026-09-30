# Body Measurement Protocol v1

## Status

This document defines the **SCC reference measurement protocol** for `scc-body-v1`.

It is an original project protocol informed by established anthropometric practice. It does not reproduce protected standards text and does not claim ISO conformance.

The purpose is interoperability:

> The same canonical body value should mean the same thing to different creators and renderer adapters.

## Reference measurement pose

Unless a field says otherwise, measurements use the SCC reference standing pose:

- body upright and symmetric;
- body weight distributed evenly across both feet;
- knees extended but not deliberately locked;
- feet parallel and comfortably separated;
- head in a neutral forward-looking orientation;
- shoulders relaxed rather than shrugged or deliberately retracted;
- arms relaxed and held slightly away from the torso so they do not compress the body surface;
- hands relaxed;
- no deliberate trunk flexion, pelvic posing, or stylized stance;
- soft-tissue measurements taken without deliberate compression;
- chest/torso measurements taken during relaxed neutral breathing rather than maximal inhalation or exhalation.

This reference pose is a **measurement convention**, not a canonical posture trait.

Changing preview posture must not change the stored body measurements.

## General rules

### Units

- linear dimensions use centimeters;
- body mass uses kilograms;
- shoulder slope uses degrees.

### Symmetry

Body Model v1 stores a single symmetric value for paired dimensions.

When a real person or scan has mild left/right differences, an adapter should use the protocol-defined aggregate or author-selected representative value rather than inventing separate canonical sides.

Explicit left/right asymmetry is deferred from v1.

### Missing values

Unknown values should be omitted.

A creator or adapter may estimate missing data for preview purposes, but an estimate must not be serialized as a measured fact unless the user or importing system deliberately accepts it as authored data.

### Derived values

Do not persist values that are purely derived from canonical measurements, such as:

- BMI;
- waist-to-hip ratio;
- regional shoe size;
- localized clothing size;
- bra cup label;
- renderer morph weights.

## Reference landmarks

SCC uses plain-language landmark names so the protocol remains understandable without requiring a proprietary or paywalled standard.

### crown

Highest point of the head in the reference pose, ignoring hair.

### lateral shoulder point

The outer bony shoulder region approximating the acromion landmark.

### neck-side shoulder root

The point where the upper shoulder line visually meets the base of the neck on the same side.

### elbow joint center

Representative center of the elbow joint used consistently for segment-length measurement.

### wrist landmark

Representative wrist crease / joint-center location used consistently for forearm and hand lengths.

### hip joint region

Representative greater-trochanter / hip-joint region used consistently for thigh-segment length.

### knee joint center

Representative center of the knee joint.

### ankle joint center

Representative center between the ankle landmarks.

## Overall dimensions

### `heightCm`

Vertical distance from the supporting floor to the crown.

Hair, footwear, and pose-dependent tiptoe elevation are excluded.

### `massKg`

Total body mass in kilograms.

For fictional authoring this may be an authored estimate. It should not be derived automatically from visual volume unless the creator explicitly accepts that estimate.

### `armSpanCm`

Horizontal distance from the tip of one middle finger to the tip of the other with both arms extended laterally at shoulder level.

### `sittingHeightCm`

Vertical distance from a flat sitting surface to the crown while seated upright with the head neutral.

This is the one major Body Model measurement that uses a seated reference condition.

### `armLengthCm`

Surface-independent segment chain from the lateral shoulder point to the tip of the middle finger through the elbow and wrist landmarks.

For a complete explicit limb description, it is expected to be broadly compatible with:

```text
upperArmLengthCm + forearmLengthCm + handLengthCm
```

No strict equality constraint is imposed in draft v1 because landmark conventions and authoring approximations can differ slightly.

### `inseamCm`

Straight-line vertical inside-leg distance from the crotch reference point to the supporting floor in the reference standing pose.

It is a useful overall leg-length measure, but it is not defined as the arithmetic sum of thigh and lower-leg segment lengths.

## Shoulder

### `shoulderBreadthCm`

Straight horizontal distance between the left and right lateral shoulder points.

### `shoulderSlopeDeg`

Downward angle from horizontal of the line joining the neck-side shoulder root to the lateral shoulder point.

Body Model v1 stores one symmetric representative angle.

This describes shoulder morphology in the reference pose, not a runtime shoulder rotation.

## Chest and thorax

### Chest reference level

The chest reference level is the horizontal plane passing through the greatest anterior chest/bust prominence of the upper torso while excluding the arms.

For bodies without a distinct breast prominence, use the visually/structurally fullest thoracic level below the axilla and above the natural waist.

The same vertical level should be used for chest circumference, breadth, and depth.

### `chestCircumferenceCm`

Horizontal perimeter of the torso at the chest reference level.

### `chestBreadthCm`

Maximum left-to-right external breadth of the torso at the chest reference level.

Arms are excluded.

### `chestDepthCm`

Maximum front-to-back external depth of the torso at the chest reference level.

### `underbustCircumferenceCm`

Horizontal torso perimeter immediately below breast/chest soft tissue where that landmark is meaningful.

If no stable underbust landmark is meaningful for the character, omit the value rather than forcing one.

## Waist and abdomen

### Waist reference level

Use the narrowest stable torso level between the lower rib region and the top of the pelvis.

If the body has no visually distinct minimum, use the midpoint of that interval as the authored reference level and keep the same level for circumference, breadth, and depth.

### `waistCircumferenceCm`

Horizontal perimeter at the waist reference level.

### `waistBreadthCm`

Left-to-right external breadth at the waist reference level.

### `waistDepthCm`

Front-to-back external depth at the waist reference level.

### Abdominal reference level

Use the horizontal level of greatest anterior abdominal prominence between the waist reference level and the upper pelvic/hip region.

This level may differ from the waist level.

### `abdominalDepthCm`

Front-to-back external depth at the abdominal reference level.

This is a gross physical depth. It does not encode how the renderer distributes that depth between front and back surfaces.

## Hip and buttock region

### Hip reference level

Use the horizontal level producing the maximum external hip/buttock perimeter in the reference standing pose.

The same level should be used for hip circumference, hip breadth, and buttock depth where practical.

### `hipCircumferenceCm`

Maximum horizontal perimeter through the hips/buttocks at the hip reference level.

### `hipBreadthCm`

Maximum left-to-right external breadth at the hip reference level.

### `buttockDepthCm`

Maximum front-to-back external depth at the hip/buttock reference level.

This constrains gross depth, not local glute-surface distribution.

## Neck

### `neckCircumferenceCm`

Horizontal circumference around the lower neck at a stable neck-base level above the shoulder line.

The measure should not include shoulder tissue.

## Arm circumferences

All arm circumferences use the arm relaxed in the reference pose.

### `upperArmCircumferenceCm`

Maximum circumference of the upper arm between the shoulder and elbow landmarks.

### `forearmCircumferenceCm`

Maximum circumference of the forearm between the elbow and wrist landmarks.

### `wristCircumferenceCm`

Minimum stable circumference at the wrist around the wrist landmark.

## Arm segment lengths

### `upperArmLengthCm`

Straight segment length from the lateral shoulder point to the elbow joint center.

### `forearmLengthCm`

Straight segment length from the elbow joint center to the wrist landmark.

## Leg circumferences

### `thighCircumferenceCm`

Maximum circumference of the upper thigh below the gluteal fold and above the knee.

### `calfCircumferenceCm`

Maximum circumference of the calf.

### `ankleCircumferenceCm`

Minimum stable circumference around the ankle above the foot.

## Leg segment lengths

### `thighLengthCm`

Straight segment length from the hip joint region to the knee joint center.

### `lowerLegLengthCm`

Straight segment length from the knee joint center to the ankle joint center.

These segment lengths intentionally do not include foot height or foot length.

## Hands

### `handLengthCm`

Straight distance from the wrist landmark to the tip of the middle finger with the hand extended naturally.

### `handBreadthCm`

Maximum palm breadth across the metacarpal region, excluding the thumb.

## Feet

Measurements are taken without footwear.

### `footLengthCm`

Maximum distance from the back of the heel to the tip of the longest toe.

### `footBreadthCm`

Maximum left-to-right breadth across the forefoot.

## Head

Hair is excluded.

### `headCircumferenceCm`

Maximum stable head circumference around the brow/occipital region.

Detailed cranial and facial geometry is intentionally outside Body Model v1.

## Composition fields

Composition is documented here for completeness but is not part of the linear measurement protocol.

### `bodyFatFraction`

Normalized fraction `0..1` representing an authored or measured estimate of total body mass attributable to body fat.

It is optional and is not a diagnosis or health score.

### `muscularity`

Normalized `0..1` semantic authoring value for visible overall muscular development.

It is intentionally broader than muscle mass and is not a renderer morph weight.

Regional muscle distribution is deferred from Body Model v1.

## Shape prior

`shapePrior` is not a measurement.

It is an optional under-specification prior used when explicit body data is missing.

It must never override an explicit measurement and must never be inferred from `identity.gender`.

## Non-canonical measurement state

The following do not belong in Body Model v1:

- current posture;
- current pose;
- renderer-local surface distribution;
- mesh morph values;
- rig joint rotations;
- clothing-induced compression;
- temporary breathing phase;
- scan-specific coordinates.

## Interoperability rule

An adapter that cannot implement a measurement faithfully should:

1. preserve the canonical value;
2. report that its rendering is approximate;
3. keep the approximation renderer-local;
4. never silently redefine the field.

## References

The SCC protocol is informed by established anthropometric practice and the project's prior 3D mapping prototypes.

Relevant public references include:

- ISO 7250-1:2017, *Basic human body measurements for technological design — Part 1: Body measurement definitions and landmarks*: https://www.iso.org/standard/65246.html
- ISO 20685-1:2018, *3-D scanning methodologies for internationally compatible anthropometric databases — Part 1*: https://www.iso.org/standard/63260.html
- ISO 15535:2023, *General requirements for establishing anthropometric databases*: https://www.iso.org/standard/82541.html

SCC uses these as design references only. The exact operational wording in this document is owned by this project and is intended to be usable in an open-source implementation.
