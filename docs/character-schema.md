# Character Schema v1

## Status

This document describes **Character Schema 1.0.0-draft.1**.

The draft suffix is intentional. Until the first stable `1.0.0` schema is published, breaking changes may still occur as the model is tested against real creator workflows.

## Purpose

The Character Schema is the canonical portable representation of a fictional character created by Snowfall Character Creator.

It is designed to be:

- understandable without the creator UI;
- usable by multiple applications;
- explicit about units and semantics;
- strict enough to catch accidental fields;
- extensible without forcing consumer-specific data into the core model.

The schema is not a save file for the editor itself and is not a runtime state container for Snowfall Life Engine.

## Top-level model

```text
Character
├── schemaVersion
├── characterId
├── identity
├── body
├── appearance
├── personality
├── background
├── preferences
├── metadata
└── extensions
```

Only `schemaVersion`, `characterId`, and `identity` are required in the draft. Optional domains can be added as a character becomes more fully specified.

## Required envelope

### schemaVersion

The schema version identifies the contract used by a serialized character.

Draft 1 requires:

```json
"schemaVersion": "1.0.0-draft.1"
```

Consumers must not silently reinterpret a document authored for another incompatible schema version.

### characterId

`characterId` is a stable identifier for the fictional character.

It is deliberately not required to be a UUID. Human-readable identifiers such as `example.mina-kisaragi` are valid.

The identifier should not encode mutable character traits such as age, occupation, or display name.

### identity

`identity.displayName` is the minimum identity requirement.

The draft also supports given, middle, and family names, nickname, birth date, gender label, species label, and preferred locale.

## Stable facts versus derived values

The schema prefers durable facts over time-dependent or locale-dependent derived values.

Examples:

| Persist | Derive or present elsewhere |
| --- | --- |
| `birthDate` | current age |
| `footLengthCm` | JP/US/EU shoe size |
| chest and underbust measurements | localized bra size |
| semantic body measurements | renderer morph weights |
| normalized personality traits | questionnaire category labels |

This rule prevents the same character document from containing multiple values that can become inconsistent.

## Identity

Identity contains facts and labels that remain meaningful outside a specific renderer or simulation.

### Gender

`identity.gender` is intentionally a free-form string rather than a closed enum.

The core schema does not need a universal taxonomy of gender to identify or render a fictional character. Individual creator interfaces may provide presets while still serializing the resulting author-defined label.

### Species

`identity.species` is free-form in draft 1. The initial creator is expected to focus on human or humanoid characters, but the envelope does not hard-code `human` as the only valid value.

## Body

The body model stores physical dimensions using explicit metric units.

Current fields include:

- standing height in centimeters;
- body mass in kilograms;
- shoulder breadth;
- chest circumference;
- underbust circumference;
- waist circumference;
- hip circumference;
- inseam;
- foot length.

### Why centimeters instead of clothing sizes

Clothing and shoe sizes are regional presentation systems. A canonical character should store measurements from which those sizes can be derived.

### Why renderer morphs are excluded

A value such as `mesh_morph_17 = 0.63` is only meaningful to one asset pipeline. It does not describe the character independently of that renderer.

A future 3D layer should map semantic character measurements to renderer-specific morph targets.

### Anatomical base profiles

Draft 1 does not yet standardize a male/female/androgynous anatomical base profile.

The creator UI may need such a choice to initialize a neutral 3D body, but the persistent meaning must be defined before it becomes a core field. In particular, the renderer must not infer physical anatomy from `identity.gender`.

A later draft should add an explicit body-domain concept only after the 3D mapping prototype establishes what information is actually required and how it can remain renderer-independent.

### Notes

`body.notes` is a temporary escape hatch for durable physical characteristics that have not yet earned a stable structured field. It should not become a substitute for adding well-defined fields when a concept is widely useful.

## Appearance

Draft 1 intentionally keeps appearance small.

It supports:

- hair color, length, and style;
- iris color;
- skin tone;
- distinguishing features.

Colors may be represented as sRGB hexadecimal values, human-readable labels, or both.

The schema does not yet define facial geometry, hairstyle taxonomies, makeup, clothing, or renderer-specific materials.

## Personality

Personality stores a complete vector of normalized baseline tendencies rather than questionnaire answers, broad type labels, or current emotional state.

The draft model is `scc-personality-v1` with **30 canonical traits grouped into eight domains**:

- openness;
- self-regulation;
- social;
- interpersonal;
- integrity;
- emotional;
- behavioral motivation;
- attachment.

Every canonical trait uses a `0..1` scale with explicitly documented endpoint meanings.

If the `personality` object is present, the full 30-trait vector is required. Incomplete questionnaire or editor state belongs to creator workflow storage rather than the portable canonical character document.

Broad summaries such as "extraversion" or "emotional stability" are derived views. They are not stored alongside the narrower traits because that would create multiple sources of truth.

Likewise, context-specific concepts such as risk propensity may be derived from several canonical traits plus the situation rather than stored as redundant personality fields.

The full trait definitions, design rationale, removed/derived candidates, runtime boundary, and questionnaire policy are documented in [Personality Model v1](personality-model.md).

### Questionnaire boundary

A questionnaire may estimate the 30 canonical values, but the answers and scoring session are creator workflow data rather than canonical character identity.

Direct manual editing remains a first-class creation path.

MBTI-style or archetype labels may be displayed as optional summaries or discovery aids, but they must not replace the underlying trait vector.

The SCC model is intended for fictional character authoring. It is not a diagnostic instrument and should not be presented as a validated psychological assessment of real people.

## Background

Background currently provides deliberately conservative biography fields:

- summary;
- upbringing;
- education;
- occupations;
- family notes.

Dynamic life events and evolving relationship state are excluded from the core schema because those belong to simulation/history systems such as Snowfall Life Engine.

A future schema revision may introduce structured pre-simulation biography events if their semantics can be made stable across consumers.

## Preferences

Preferences use signed affinities:

```text
-1.0  strong aversion
 0.0  neutral / no meaningful affinity
+1.0  strong affinity
```

Each affinity has a free-form subject and optional explanatory note.

A controlled vocabulary is intentionally deferred until real use cases show where interoperability is valuable.

## Metadata

Metadata describes the character document or its provenance rather than the fictional person's identity.

Supported draft fields include:

- creation and modification timestamps;
- tags;
- notes;
- generation provenance.

### Generation provenance

A randomly generated character may record:

- generator name;
- generator version;
- seed.

The seed is provenance. It is not the character's identity.

Reproducibility guarantees will depend on the generator version as well as the seed.

## Extensions

`extensions` is the only intentionally open-ended core object.

Consumers must ignore extension namespaces they do not understand.

Applications should use stable namespaced keys, for example:

```json
{
  "extensions": {
    "org.snowfall.life": {
      "example": true
    }
  }
}
```

Extensions should not be used to bypass the core schema for concepts that are broadly useful to character creation.

## Strictness

All defined core objects use `additionalProperties: false`.

This is deliberate. A typo such as `heigthCm` should fail validation rather than silently become unused data.

Extensibility is explicit through `extensions`, not accidental through arbitrary properties everywhere.

## Validation

The schema targets JSON Schema Draft 2020-12.

Validators should enable format validation for fields using `date` and `date-time`.

Validation answers whether a document conforms structurally. It does not guarantee that every physically possible combination is realistic. Cross-field anthropometric constraints should only be added when they are stable, explainable, and useful rather than based on narrow assumptions.

## Intentionally deferred from draft 1

The following are deliberately not standardized yet:

- current age;
- localized clothing and shoe sizes;
- bra cup labels;
- renderer or mesh identifiers;
- 3D morph weights;
- detailed facial geometry;
- clothing and wardrobe;
- medical or diagnostic data;
- questionnaire answer history;
- MBTI-style canonical type codes;
- relationship runtime state;
- life-simulation history;
- image-generation provider state;
- editor camera and panel state.

Deferral is preferable to prematurely freezing ambiguous semantics.

## Next validation questions

Before promoting this draft to stable `1.0.0`, the model should be tested against:

1. a minimal fictional character;
2. a detailed Snowfall-style human character;
3. randomized character generation;
4. import/export round trips;
5. incomplete creator drafts;
6. a Life Engine adapter prototype;
7. a 3D body parameter mapping prototype.

Any field that repeatedly requires consumer-specific interpretation should be reconsidered before stabilization.
