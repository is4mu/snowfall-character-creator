# Roadmap

This roadmap describes development order rather than fixed release dates.

## Phase 0 — Foundation

Goal: establish the repository as a maintainable open-source project.

- [x] create public repository
- [x] define project purpose
- [x] document initial architecture
- [x] add contribution guidance
- [x] add security policy
- [x] choose Apache-2.0 licensing
- [ ] define issue and pull-request templates
- [ ] define repository labels and project conventions

Exit criterion: contributors can understand what the project is, what it is not, and how major design changes should be proposed.

## Phase 1 — Character Schema v1

Goal: define the first coherent portable character contract.

Planned work:

- [ ] define top-level schema envelope and versioning
- [ ] design identity model
- [ ] design body model
- [ ] design appearance model
- [ ] design personality model
- [ ] decide the boundary for background and preferences
- [ ] define metadata rules
- [ ] define units, ranges, nullability, and optionality
- [ ] create valid example characters
- [ ] create invalid fixtures
- [ ] document compatibility policy

Exit criterion: Character Schema v1 can represent initial target characters, has clear semantics, and can be validated independently of any UI.

## Phase 2 — Character Core

Goal: implement schema-aware character operations.

Planned work:

- [ ] choose implementation language and package architecture
- [ ] parse and validate character documents
- [ ] create and edit character data
- [ ] JSON import/export
- [ ] deterministic seeded randomization
- [ ] serialization round-trip guarantees
- [ ] migration framework
- [ ] core test suite
- [ ] CI

Exit criterion: characters can be created, changed, validated, serialized, reloaded, and deterministically generated without a graphical UI.

## Phase 3 — Minimal Creator UI

Goal: provide a usable editor over the stable core.

Planned work:

- [ ] basic identity editor
- [ ] body parameter controls
- [ ] personality controls
- [ ] questionnaire prototype
- [ ] validation feedback
- [ ] import/export workflow
- [ ] minimal character preview
- [ ] randomize with seed controls

Exit criterion: a user can create a valid Character Schema document without manually editing JSON.

## Phase 4 — 3D Body Creator

Goal: make body parameters visually editable.

Planned work:

- [ ] neutral base bodies
- [ ] semantic-parameter-to-morph mapping
- [ ] camera controls
- [ ] real-time synchronization between data and preview
- [ ] renderer-independent mapping boundaries
- [ ] visual regression strategy

Exit criterion: supported body parameters can be edited visually without making renderer-specific morph values the canonical character data.

## Phase 5 — Generative Appearance

Goal: support generated visual references while preserving structured character identity.

Possible work:

- portrait generation;
- full-body reference generation;
- prompt/adaptor generation from structured traits;
- reproducibility metadata;
- provider-neutral interfaces.

Generated media should remain an output or reference derived from the character contract, not a replacement for it.

## Phase 6 — Ecosystem Integration

Goal: connect the character contract to downstream systems.

Priority integrations:

- Snowfall Life Engine;
- LLM/agent systems;
- game engines;
- simulation environments;
- additional import/export formats.

Adapters should depend on the versioned Character Schema rather than introducing consumer-specific fields into the core model.

## v0.1 target

The initial v0.1 milestone should include:

- Character Schema v1;
- identity, body, and personality models;
- validation;
- basic editing operations;
- JSON import/export;
- deterministic randomization;
- a minimal preview;
- a clean, contract-oriented automated test suite.

A production-quality 3D creator is intentionally not required for v0.1.
