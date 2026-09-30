# Schema Compatibility

## Status

This policy applies to the Snowfall Character Schema.

The current schema is `1.0.0-draft.1`. Draft versions are not yet covered by the stable compatibility guarantee.

## Version format

Stable schema versions use semantic versioning:

```text
MAJOR.MINOR.PATCH
```

Pre-release design iterations may use suffixes such as:

```text
1.0.0-draft.1
1.0.0-draft.2
```

## Stable compatibility rules

After `1.0.0` is published:

### MAJOR

Increase the major version when an existing valid document may become invalid or when an existing field changes meaning.

Examples:

- removing a field;
- renaming a field;
- changing centimeters to another unit without a new field;
- narrowing an allowed range so previously valid values fail;
- changing the semantic meaning of a personality trait;
- making an optional field required.

### MINOR

Increase the minor version for backward-compatible additions where documents valid under the previous version remain valid with the new validator.

Examples:

- adding a new optional field;
- adding a new optional object;
- expanding an allowed enum if an enum exists;
- adding a new extension convention that does not alter existing data.

Consumers may not automatically understand new fields, but they should not misinterpret old ones.

### PATCH

Increase the patch version only when validation and normative semantics do not change.

Examples:

- correcting documentation wording;
- improving examples;
- fixing broken links;
- clarifying non-normative guidance.

A change that alters which documents validate is not a patch.

## Draft policy

Before stable `1.0.0`:

- fields may be renamed or removed;
- ranges may change;
- domain boundaries may change;
- draft fixtures may be replaced;
- migrations are not guaranteed.

Draft changes must still be explicit in pull requests and reflected in examples.

## Consumer behavior

Consumers should:

1. read `schemaVersion` before interpreting the document;
2. reject unsupported major versions explicitly;
3. avoid silently coercing invalid core data;
4. ignore unknown extension namespaces;
5. preserve extension namespaces when round-tripping a document unless explicitly configured not to;
6. avoid writing a newer schema version unless they actually emit data conforming to that version.

## Migration rules

When a stable breaking change is eventually required:

- provide an explicit migration path where practical;
- retain fixtures for the older version;
- test migration deterministically;
- never change the meaning of a versioned document without changing its version.

Migrations should transform data, not guess missing facts.

If a migration cannot determine a required value safely, it should surface the ambiguity instead of fabricating character information.

## Canonical versus derived data

Compatibility guarantees apply to canonical persisted fields.

Derived presentation values such as current age, localized clothing sizes, questionnaire labels, or renderer morph weights are outside the schema compatibility guarantee unless they later become explicitly versioned contracts of their own.

## Extensions

Extension owners are responsible for versioning their own extension payloads.

The core schema guarantees only that namespaced extension values can be carried as JSON data. It does not define compatibility rules for the contents of third-party namespaces.
