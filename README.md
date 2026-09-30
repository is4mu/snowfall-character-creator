# Snowfall Character Creator

Snowfall Character Creator is an open-source framework for creating structured digital characters.

It provides a shared character model and creation tooling for defining identity, body, appearance, personality, background, preferences, and related traits in a form that can be inspected, edited, validated, serialized, and consumed by software.

The project originates from Snowfall and is intended to integrate naturally with [Snowfall Life Engine](https://github.com/is4mu/snowfall-life-engine), while remaining independent and useful for games, AI agents, simulations, generative applications, and other character-driven systems.

## Why this project exists

Character creation is often reduced to a free-form profile or an LLM prompt. That is convenient for prototyping, but difficult to validate, evolve, reproduce, or integrate across systems.

Snowfall Character Creator instead treats a character as structured data with explicit semantics.

The long-term goal is to make character creation:

- intuitive for humans;
- meaningful to software;
- portable across applications;
- reproducible when randomness is involved;
- extensible without breaking existing characters.

## Core architecture

The central artifact is the **Snowfall Character Schema**.

```text
Creator UI
    |
    v
Snowfall Character Schema
    |
    +-- Character Core
    +-- Snowfall Life Engine adapter
    +-- LLM / agent adapters
    +-- game and simulation adapters
    +-- future integrations
```

The UI is one consumer and editor of the schema, not the definition of the character itself.

## Design principles

1. **Structured, not prompt-only** — character state should be explicit data rather than only prose.
2. **Human-editable** — users should be able to understand and adjust important values.
3. **Machine-readable** — downstream systems should consume character data without reparsing natural language.
4. **Continuous where useful** — personality and body characteristics should not be forced into coarse categories when continuous traits are more appropriate.
5. **Visual and semantic** — visual controls should map to stable character parameters.
6. **Application-agnostic** — Snowfall integration is first-class, but the core model must not require Snowfall.
7. **Extensible** — schema evolution should preserve compatibility wherever practical.
8. **Reproducible** — randomized generation should support deterministic seeds.
9. **Portable** — character data should have documented serialization formats.
10. **Privacy-aware** — the project is designed for fictional character creation, not as a system for profiling real people.

## Initial scope

The first public development target is **v0.1**, focused on foundations rather than a feature-complete 3D creator.

Planned v0.1 scope:

- Character Schema v1
- identity model
- body parameter model
- personality model
- basic character editing
- deterministic randomization
- JSON import/export
- schema validation
- minimal preview
- tests for schema and core behavior

## Non-goals for v0.1

The following are intentionally outside the first milestone:

- production-quality 3D character rendering
- photorealistic image generation
- a full game-engine integration layer
- simulation of a character's life or behavior
- replacing Snowfall Life Engine
- inferring personality or identity from real people
- locking the project to a single UI framework or runtime before the core model is stable

## Planned repository structure

```text
snowfall-character-creator/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
├── docs/
│   ├── architecture.md
│   └── roadmap.md
├── schema/
│   └── examples/
├── src/
└── tests/
```

The exact source layout may change after the Character Schema and implementation language are selected.

## Current status

The project is in its **foundation and schema-design phase**.

No stable schema or public API exists yet. Until a versioned schema is published, files and interfaces should be considered experimental.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md).

The immediate sequence is:

1. define scope and non-goals;
2. design Character Schema v1;
3. define identity, body, and personality models;
4. define serialization and validation;
5. establish the test strategy;
6. select the initial implementation architecture;
7. build the first creator core and minimal UI.

## Relationship to Snowfall Life Engine

Snowfall Character Creator is responsible for **creating and editing character definitions**.

Snowfall Life Engine is responsible for **simulating life, behavior, state transitions, and time-dependent outcomes**.

The intended boundary is a versioned character contract between the two projects. Neither project should need to own the other's internal logic.

## Contributing

The project is early and architectural decisions are still being made. Contributions that improve the data model, compatibility strategy, validation, tests, documentation, and creator UX are welcome.

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

Please do not report security vulnerabilities through public issues. See [SECURITY.md](SECURITY.md).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
