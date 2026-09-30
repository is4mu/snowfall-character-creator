# Contributing to Snowfall Character Creator

Thank you for your interest in contributing.

Snowfall Character Creator is currently in an early design phase. The most important work is establishing a coherent, testable, versioned character model before expanding into a large application surface.

## Before contributing

Please keep these project goals in mind:

- the Character Schema is the core contract;
- Snowfall Life Engine integration must not make the core Snowfall-only;
- data should be understandable by both humans and software;
- schema changes should be deliberate and versioned;
- tests should define behavior, not merely mirror implementation;
- new dependencies should have a clear reason to exist.

## Contribution workflow

1. Search existing issues and pull requests before starting.
2. For significant schema, architecture, dependency, or compatibility changes, open an issue first.
3. Create a focused branch.
4. Keep commits understandable and scoped.
5. Add or update tests when behavior changes.
6. Update documentation when public contracts or architecture change.
7. Open a pull request describing the problem, approach, and compatibility impact.

## Pull request expectations

A pull request should explain:

- what problem it solves;
- what behavior or contract changes;
- why the chosen design is appropriate;
- how the change was tested;
- whether serialized character data or schema compatibility is affected.

Avoid bundling unrelated refactors with behavioral changes.

## Schema changes

Changes to the Character Schema require special care.

A schema proposal should identify:

- the semantic meaning of each new or changed field;
- allowed values and units;
- required vs optional behavior;
- defaults, if any;
- validation rules;
- migration or compatibility implications;
- at least one valid example;
- tests for both accepted and rejected data.

Do not introduce fields only because a particular UI needs a temporary representation. UI state and persistent character data should remain separate where appropriate.

## Testing philosophy

The test suite should emphasize observable contracts.

Expected test layers include:

- schema conformance tests;
- validation edge cases;
- serialization round trips;
- deterministic randomization tests;
- compatibility and migration tests;
- core domain behavior tests;
- adapter contract tests.

Implementation details should not be asserted unless they are themselves part of the public contract.

## Code style and tooling

The implementation language and toolchain have not yet been finalized. Once chosen, repository-specific formatting, linting, testing, and commit checks will be documented here and automated in CI.

Until then:

- keep documentation clear and concise;
- use UTF-8;
- keep examples deterministic;
- avoid undocumented generated artifacts;
- avoid committing secrets, credentials, or personal data.

## Issues

Good issues are narrow enough to be actionable and explicit about expected behavior.

Feature requests should include a concrete use case. Architecture proposals should explain the tradeoff they are trying to improve.

## License

By contributing, you agree that your contributions will be licensed under the repository's Apache License 2.0.
