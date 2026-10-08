import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  CHARACTER_SCHEMA_VERSION,
  createMinimalCharacter,
  deleteCharacterValue,
  setCharacterValue,
} from "../../src/core/character.mjs";
import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "../../src/core/errors.mjs";
import {
  characterSemanticJson,
  parseCharacterJson,
  serializeCharacterJson,
} from "../../src/core/serialization.mjs";
import { createCharacterValidator } from "../../src/core/validation.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.join(ROOT, relativePath), "utf8"),
  );
}

const schema = await readJson("schema/character.schema.json");
const validator = createCharacterValidator(schema);

test("Character Core schema version matches the portable contract", () => {
  assert.equal(
    schema.properties.schemaVersion.const,
    CHARACTER_SCHEMA_VERSION,
  );
});

test("all public example characters validate in the JS runtime", async () => {
  const directory = path.join(ROOT, "schema/examples");
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort();

  assert.ok(files.length > 0);
  for (const name of files) {
    const character = await readJson(`schema/examples/${name}`);
    const result = validator.validate(character);
    assert.equal(
      result.valid,
      true,
      `${name} failed: ${JSON.stringify(result.errors, null, 2)}`,
    );
  }
});

test("all public invalid fixtures are rejected in the JS runtime", async () => {
  const directory = path.join(ROOT, "schema/fixtures/invalid");
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .sort();

  assert.ok(files.length > 0);
  for (const name of files) {
    const character = await readJson(`schema/fixtures/invalid/${name}`);
    const result = validator.validate(character);
    assert.equal(
      result.valid,
      false,
      `${name} unexpectedly validated`,
    );
    assert.ok(result.errors.length > 0);
  }
});

test("minimal character creation produces a valid independent document", () => {
  const character = createMinimalCharacter({
    characterId: "example.core-minimal",
    displayName: "Core Minimal",
    identity: {
      species: "human",
    },
  });

  validator.assertValid(character);
  assert.deepEqual(character, {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    characterId: "example.core-minimal",
    identity: {
      species: "human",
      displayName: "Core Minimal",
    },
  });
});

test("editing is immutable and the edited document remains schema-valid", async () => {
  const original = await readJson("schema/examples/full.character.json");
  const before = characterSemanticJson(original);

  const edited = setCharacterValue(
    original,
    ["body", "measurements", "heightCm"],
    171,
  );

  assert.equal(characterSemanticJson(original), before);
  assert.notStrictEqual(edited, original);
  assert.equal(edited.body.measurements.heightCm, 171);
  validator.assertValid(edited);
});

test("deleting an optional field is immutable and schema-valid", async () => {
  const original = await readJson("schema/examples/full.character.json");
  const edited = deleteCharacterValue(
    original,
    ["identity", "gender"],
  );

  assert.notStrictEqual(edited, original);
  assert.ok("gender" in original.identity);
  assert.ok(!("gender" in edited.identity));
  validator.assertValid(edited);
});

test("invalid edit paths fail explicitly", async () => {
  const original = await readJson("schema/examples/minimal.character.json");

  assert.throws(
    () => deleteCharacterValue(original, ["body", "measurements"]),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.INVALID_EDIT_PATH,
  );
});

test("round-trip import/export preserves semantic character data", async () => {
  const original = await readJson("schema/examples/full.character.json");

  const serialized = serializeCharacterJson(original, { validator });
  const reparsed = parseCharacterJson(serialized, { validator });

  assert.equal(
    characterSemanticJson(reparsed),
    characterSemanticJson(original),
  );
});

test("stable serialization is independent of object insertion order", () => {
  const a = {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    characterId: "example.order",
    identity: {
      displayName: "Order",
      species: "human",
    },
  };
  const b = {
    identity: {
      species: "human",
      displayName: "Order",
    },
    characterId: "example.order",
    schemaVersion: CHARACTER_SCHEMA_VERSION,
  };

  assert.equal(
    serializeCharacterJson(a, { validator, pretty: false }),
    serializeCharacterJson(b, { validator, pretty: false }),
  );
});

test("unsupported schema versions fail with a version-specific error", () => {
  const character = {
    schemaVersion: "9.9.9",
    characterId: "example.future",
    identity: { displayName: "Future" },
  };

  assert.throws(
    () => validator.assertValid(character),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.UNSUPPORTED_SCHEMA_VERSION,
  );
});

test("malformed JSON fails with INVALID_JSON", () => {
  assert.throws(
    () => parseCharacterJson("{", { validator }),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.INVALID_JSON,
  );
});

test("schema-invalid JSON fails with INVALID_CHARACTER", () => {
  assert.throws(
    () =>
      parseCharacterJson(
        JSON.stringify({
          schemaVersion: CHARACTER_SCHEMA_VERSION,
          characterId: "example.invalid",
          identity: {},
        }),
        { validator },
      ),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.INVALID_CHARACTER &&
      Array.isArray(error.details?.errors) &&
      error.details.errors.length > 0,
  );
});
