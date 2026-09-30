# Schema assets

This directory contains the portable Character Schema contract and fixtures used to exercise it.

## Files

- `character.schema.json` — JSON Schema Draft 2020-12 definition.
- `examples/minimal.character.json` — smallest representative valid character.
- `examples/full.character.json` — fuller example covering all current top-level domains.
- `fixtures/invalid/` — syntactically valid JSON documents that must fail schema validation.

## Expected fixture behavior

| File | Expected result | Reason |
| --- | --- | --- |
| `examples/minimal.character.json` | valid | contains the required envelope |
| `examples/full.character.json` | valid | exercises all draft domains |
| `fixtures/invalid/body-fat-out-of-range.character.json` | invalid | `bodyFatFraction` exceeds `1.0` |
| `fixtures/invalid/body-missing-model.character.json` | invalid | body object omits required model identifier |
| `fixtures/invalid/body-shape-prior-invalid.character.json` | invalid | unsupported body shape prior |
| `fixtures/invalid/missing-identity.character.json` | invalid | required `identity` is absent |
| `fixtures/invalid/personality-out-of-range.character.json` | invalid | personality trait exceeds `1.0` |
| `fixtures/invalid/personality-missing-trait.character.json` | invalid | canonical personality vector is incomplete |
| `fixtures/invalid/negative-measurement.character.json` | invalid | physical measurement is negative |
| `fixtures/invalid/unknown-core-field.character.json` | invalid | strict core object rejects unknown `identity.age` |

## Test strategy

The first automated schema test harness should:

1. load `character.schema.json` using a Draft 2020-12-compatible validator;
2. enable `date` and `date-time` format assertions;
3. assert that every file under `examples/` validates;
4. assert that every file under `fixtures/invalid/` fails validation;
5. report the exact instance path and schema path for failures;
6. verify each invalid fixture fails for exactly its documented validator keyword and instance path;
7. run in CI on changes to `schema/**`, tests, dependency declarations, or the schema workflow.

The current validation harness uses Python only as lightweight repository tooling. It does **not** select Python as the Character Creator implementation language.

Run the contract tests locally with:

```bash
python -m pip install -r requirements-dev.txt
python -m unittest discover -s tests -p "test_*.py" -v
```

The fixture contract remains independent of the validator implementation. A future tooling change must preserve the same public acceptance/rejection behavior.

## Adding a field

Do not add a schema property without also updating:

- `docs/character-schema.md`;
- at least one valid example when the field is meaningful there;
- invalid fixtures for important constraints;
- compatibility notes if the change affects versioning.

## Draft version

The current contract is `1.0.0-draft.1`.

Breaking changes are allowed during the draft period, but must be explicit and must update fixtures in the same pull request.
