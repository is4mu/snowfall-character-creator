# Body Model v1

## Status

This document defines the first draft of the Snowfall Character Creator body model, serialized as:

```text
scc-body-v1
```

The model is intended for fictional character authoring and future 3D body generation. It is not a medical model and does not claim clinical measurement accuracy.

## Design goals

Body Model v1 should:

- describe a body independently of a particular renderer or mesh;
- preserve physically meaningful measurements when they are known;
- provide enough information to initialize a believable 3D body;
- remain understandable and editable by humans;
- keep identity, anatomy, presentation, and renderer implementation separate;
- avoid duplicate derived values that can become inconsistent;
- allow partially specified characters;
- leave genuinely renderer-dependent shape details to an adapter.

## Model structure

```text
body
├── model
├── shapePrior
├── measurements
├── composition
└── notes
```

The four concepts have different semantics.

### model

`model` identifies the body contract. Draft v1 uses:

```json
"model": "scc-body-v1"
```

### shapePrior

`shapePrior` is an optional starting prior for parts of a body that have not yet been explicitly specified.

Allowed draft values are:

- `masculine`
- `feminine`
- `neutral`

This value is a **visual/morphological authoring prior only**.

It is not:

- gender identity;
- biological sex;
- reproductive anatomy;
- a substitute for measurements.

A creator must never infer `shapePrior` from `identity.gender`.

For the initial 3D creator, the prior may select a neutral gray starting body. Explicit measurements and later semantic body controls should then override the prior wherever they provide stronger information.

Omitting `shapePrior` means that a downstream renderer must not assume one.

## Anthropometric measurements

The measurement layer contains renderer-independent physical dimensions.

Body Model v1 currently supports 32 linear measurements in centimeters, one shoulder-angle measurement in degrees, plus body mass in kilograms.

### Overall proportions

| Field | Meaning |
| --- | --- |
| `heightCm` | standing stature |
| `massKg` | body mass |
| `armSpanCm` | fingertip-to-fingertip span with arms extended |
| `sittingHeightCm` | seated vertical height, useful for torso/leg proportion |
| `inseamCm` | inside-leg length |
| `armLengthCm` | shoulder-to-hand arm length |

Together these fields capture major vertical and limb proportions that a single height value cannot.

### Torso

| Field | Meaning |
| --- | --- |
| `shoulderBreadthCm` | shoulder breadth |
| `shoulderSlopeDeg` | symmetric downward shoulder-line angle from horizontal |
| `chestCircumferenceCm` | chest/bust-level torso circumference |
| `chestBreadthCm` | horizontal chest breadth |
| `chestDepthCm` | front-to-back chest depth |
| `underbustCircumferenceCm` | circumference directly below breast/chest tissue where applicable |
| `waistCircumferenceCm` | waist circumference |
| `waistBreadthCm` | horizontal waist breadth |
| `waistDepthCm` | front-to-back waist depth |
| `hipCircumferenceCm` | maximum hip/buttock circumference |
| `hipBreadthCm` | maximum standing hip breadth |
| `buttockDepthCm` | front-to-back depth at the buttocks |
| `neckCircumferenceCm` | neck circumference |

`chestCircumferenceCm` is deliberately a physical circumference rather than a localized clothing or bra-size concept. Breadth/depth fields were added after the first 3D mapping prototype showed that circumference alone cannot determine a unique torso cross-section.

A later measurement-protocol document should pin exact landmarks for creator-assisted measurement. Draft v1 does not claim that every field is an exact ISO 7250 field name.

### Arms and legs

| Field | Meaning |
| --- | --- |
| `upperArmCircumferenceCm` | upper-arm circumference |
| `upperArmLengthCm` | shoulder-to-elbow segment length |
| `forearmLengthCm` | elbow-to-wrist segment length |
| `forearmCircumferenceCm` | forearm circumference |
| `wristCircumferenceCm` | wrist circumference |
| `thighCircumferenceCm` | thigh circumference |
| `thighLengthCm` | hip-to-knee segment length |
| `lowerLegLengthCm` | knee-to-ankle segment length |
| `calfCircumferenceCm` | calf circumference |
| `ankleCircumferenceCm` | ankle circumference |

These values let a 3D adapter distinguish bodies that share the same height and mass but distribute volume differently. Explicit limb segment lengths also prevent the renderer from assuming fixed upper/lower limb ratios.

### Hands, feet, and head

| Field | Meaning |
| --- | --- |
| `handLengthCm` | hand length |
| `handBreadthCm` | hand breadth |
| `footLengthCm` | foot length |
| `footBreadthCm` | foot breadth |
| `headCircumferenceCm` | maximum head circumference |

Foot length remains canonical; regional shoe size is derived presentation.

## Composition

Measurements alone do not fully distinguish tissue composition.

### bodyFatFraction

`bodyFatFraction` is an optional `0..1` estimate of the fraction of total body mass represented by body fat.

For example:

```json
"bodyFatFraction": 0.24
```

means an authored estimate of 24%.

It is optional because many fictional characters will not have a known or meaningful precise estimate.

It is character-authoring data, not a clinical measurement or health judgment.

### muscularity

`muscularity` is a normalized `0..1` visual authoring dimension.

```text
0.0  minimal visible muscular development
0.5  moderate muscular development
1.0  exceptionally pronounced muscular development
```

It is intentionally not called muscle mass. A renderer may use it to distribute shape around major muscle groups, but the value itself must not map directly to a renderer-specific morph target.

## Why measurements and composition are separate

Two characters can have similar height, mass, waist, and hip values while differing visibly because of body composition.

Conversely, body-fat or muscularity values cannot replace actual proportions.

The intended relationship is:

```text
shape prior
+ measurements
+ composition
        |
        v
renderer adapter
        |
        v
3D mesh-specific morphs
```

The adapter may infer missing geometry, but those inferences must not be written back as if they were measured facts unless explicitly authored.

## Canonical versus derived values

Body Model v1 follows the Character Schema rule of storing stable source values rather than locale- or renderer-specific derivatives.

| Canonical | Derived / adapter-owned |
| --- | --- |
| `heightCm` | visual scale transform |
| `footLengthCm` | JP / US / EU shoe size |
| chest + underbust circumferences | localized bra size |
| waist + hip circumferences | waist-to-hip ratio |
| mass + height | BMI |
| measurements + composition | mesh morph weights |
| measurements | clothing-size recommendation |

Derived values may be useful in the UI but should not become duplicate canonical fields.

## Partial body definitions

A body object requires only its model identifier.

All measurements and composition values are individually optional.

This supports characters whose body information is incomplete without inventing unknown values.

A creator application may define a stronger "ready for 3D preview" profile that requires a practical subset such as:

- height;
- mass;
- shoulder breadth;
- chest/waist/hip circumferences;
- inseam;
- foot length.

That readiness profile belongs to the creator workflow, not the portable Character Schema.

## Measurement protocol and standards

The model is informed by established anthropometric practice rather than inventing arbitrary renderer coordinates.

Relevant references include:

- ISO 7250-1:2017, *Basic human body measurements for technological design — Part 1: Body measurement definitions and landmarks*: https://www.iso.org/standard/65246.html
- ISO 20685-1:2018, *3-D scanning methodologies for internationally compatible anthropometric databases — Part 1*: https://www.iso.org/standard/63260.html
- ISO 15535:2023, *General requirements for establishing anthropometric databases*: https://www.iso.org/standard/82541.html

ISO 7250-1 provides a standardized basis for body measurement definitions and landmarks. ISO 20685-1 addresses dimensions extracted from 3D body scans using those anthropometric concepts.

SCC uses these standards as design references. The open-source schema does not reproduce the standards' protected text and does not claim conformance until a dedicated measurement protocol is implemented and reviewed.

## Renderer independence

The following values must **not** appear in the core Body Model:

- vertex indices;
- bone indices;
- blend-shape names;
- morph-target weights;
- SMPL beta values;
- MakeHuman modifier IDs;
- Unity or Unreal asset identifiers;
- scanner-specific coordinates.

A renderer adapter may map SCC body data into any of these representations.

The reverse direction may also exist: a scanner or body model may estimate SCC measurements from a mesh.

## Why detailed surface shape is deferred

A realistic 3D creator will probably need additional controls beyond measurements and composition.

Candidates include:

- chest/breast projection and distribution;
- abdomen projection;
- glute projection and fullness;
- torso surface contour beyond the explicit breadth/depth measurements;
- regional muscle distribution;
- posture;
- left/right asymmetry.

These are intentionally **not frozen in Body Model v1 yet**.

There are two risks in adding them prematurely:

1. defining subjective sliders that only make sense for one mesh;
2. duplicating geometry that can already be reconstructed from measurements.

The first 3D prototype confirmed that torso breadth/depth measurements materially reduce renderer guesswork. A second mapping pass then confirmed that shoulder slope and explicit limb segment lengths remove additional fixed renderer assumptions. Remaining surface-shape candidates still require further visual validation before being frozen.

## Intimate anatomy

Detailed genital or reproductive anatomy is outside Body Model v1.

The initial neutral-gray body editor does not require those fields to solve the main body-proportion problem.

If a future use case requires them, they should be designed as an explicit optional module rather than inferred from gender, shape prior, or other identity data.

## Clothing and presentation

Clothing, hair, makeup, pose, camera, and visual styling do not belong to the body model.

Body Model v1 describes the durable body beneath those presentation layers.

## Research-to-implementation boundary

Anthropometric standards describe measurements and measurement practice. They do not define SCC's 3D generator.

A future adapter is responsible for learning or implementing the mapping:

```text
SCC body parameters -> renderer/body-model parameters
```

That mapping can change without changing the Character Schema, provided the meaning of SCC fields remains stable.

## Validation questions before stable 1.0

Before Body Model v1 is considered stable, the project should test:

1. whether the current measurements can reproduce visibly different realistic proportions;
2. whether `shapePrior` is useful after enough measurements are supplied;
3. whether `bodyFatFraction` and `muscularity` are sufficient composition controls;
4. which surface-shape controls are impossible to infer reliably;
5. whether a masculine, feminine, and neutral starting mesh can map to the same canonical measurements;
6. whether round-tripping through a 3D adapter preserves the intended body;
7. whether the model handles incomplete characters without silently fabricating facts.

## v1 rule

> Persist semantic body facts and a minimal set of explicit authoring priors. Keep renderer parameters in adapters.
