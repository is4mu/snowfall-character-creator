# Architecture

## 1. Purpose

Snowfall Character Creator creates, edits, validates, serializes, and exports structured fictional character definitions.

The architecture is intentionally centered on a versioned **Character Schema**, not on a particular UI, renderer, or model provider.

## 2. Responsibility boundary

The project owns:

- the persistent character data contract;
- domain models used to construct that data;
- validation;
- deterministic generation and randomization;
- import/export;
- editing workflows;
- preview-facing derived values where appropriate;
- adapters that translate the core character contract into external representations.

The project does not own:

- life simulation;
- autonomous behavior scheduling;
- long-running world state;
- relationship simulation over time;
- image-model internals;
- game-engine runtime behavior.

Those responsibilities belong to downstream systems such as Snowfall Life Engine or other consumers.

## 3. Conceptual layers

```text
+------------------------------+
| Creator interfaces           |
| UI / CLI / future API        |
+---------------+--------------+
                |
                v
+------------------------------+
| Character Core               |
| edit / generate / validate   |
+---------------+--------------+
                |
                v
+------------------------------+
| Character Schema             |
| versioned persistent contract|
+---------------+--------------+
                |
        +-------+--------+
        |                |
        v                v
+---------------+  +------------------+
| Serialization |  | Adapters         |
| JSON / future |  | Life Engine etc. |
+---------------+  +------------------+
```

### Character Schema

The schema defines the portable representation of a character.

Initial domains are expected to include:

- identity;
- body;
- appearance;
- personality;
- background;
- preferences;
- metadata.

This list is provisional. Inclusion in the schema requires a stable semantic meaning, not merely UI convenience.

### Character Core

The core provides operations over character definitions, including:

- creation;
- editing;
- validation;
- deterministic randomization;
- normalization where explicitly defined;
- serialization helpers;
- future migrations between schema versions.

The core must not depend on a specific graphical interface.

### Creator interfaces

Interfaces collect user intent and translate it into core operations.

Potential interfaces include:

- web UI;
- desktop UI;
- CLI;
- embedded creator components.

UI-only state such as panel visibility, camera position, or unfinished form input should not leak into the persistent character schema unless it has durable character meaning.

### Adapters

Adapters translate the stable core model into application-specific forms.

The first important adapter is expected to target Snowfall Life Engine, but the adapter layer should support other applications without modifying the core schema for each consumer.

## 4. Data ownership rules

A field belongs in the persistent character model when it describes the character and remains meaningful independently of the editor.

A field generally does not belong there when it describes:

- editor state;
- rendering caches;
- transient UI selection;
- external-provider request state;
- consumer-specific runtime state.

Derived values should have one authoritative source where possible. If a value can be deterministically derived from other persisted fields, persisting both requires a documented reason and synchronization rule.

## 5. Schema evolution

Every serialized character must identify its schema version.

Schema evolution should aim for:

- explicit versioning;
- predictable validation;
- documented compatibility;
- migrations when structural changes require them;
- fixtures representing historical versions;
- no silent reinterpretation of an existing field.

Breaking semantic changes should produce a new schema version rather than quietly changing the meaning of existing data.

## 6. Determinism

Random character generation should support a seed.

Given the same supported schema version, generator version, seed, and generation options, the system should aim to reproduce the same result.

If an algorithm change intentionally alters generated output, that compatibility boundary must be documented and tested.

## 7. Personality model direction

Personality should be represented as underlying traits rather than only typological labels.

Questionnaire results, labels, archetypes, or summaries may be derived views over those traits.

The model should distinguish:

- stored traits;
- questionnaire inputs;
- scoring logic;
- human-readable interpretation.

This allows the personality model to evolve without making a presentation label the source of truth.

## 8. Body model direction

The body model should separate semantic physical parameters from renderer-specific mesh controls.

For example, a durable character concept such as height should not be stored only as an arbitrary morph-target weight.

A rendering layer may map semantic body parameters to 3D morphs, but those mappings are adapter or presentation concerns.

Units and ranges must be explicit.

## 9. Validation

Validation is part of the public contract.

Validation should cover:

- structural schema validity;
- ranges and units;
- required combinations;
- mutually incompatible values where such constraints genuinely exist;
- stable identifiers and version information;
- deterministic normalization rules, if introduced.

Invalid data should fail explicitly rather than be silently repaired unless a repair rule is itself documented.

## 10. Testing architecture

Tests should be designed around contracts.

Planned categories:

1. schema acceptance fixtures;
2. schema rejection fixtures;
3. serialization round-trip tests;
4. deterministic generation tests;
5. migration and backward-compatibility tests;
6. domain invariant tests;
7. adapter contract tests;
8. UI tests only for behavior owned by the interface layer.

Tests should avoid coupling to incidental implementation details.

## 11. Technology decisions intentionally deferred

The following remain open until the schema and core requirements are clearer:

- primary implementation language;
- web framework;
- desktop packaging;
- 3D rendering stack;
- state-management library;
- build system;
- monorepo vs package layout.

Technology should follow the domain contract, not define it prematurely.
