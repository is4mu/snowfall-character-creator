import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "../../src/core/errors.mjs";
import {
  RANDOMIZATION_VERSION,
  keyedChoice,
  keyedUint32,
  keyedUniform,
  keyedUniform01,
  randomizeCharacterFields,
} from "../../src/core/randomization.mjs";
import { characterSemanticJson } from "../../src/core/serialization.mjs";
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

const PLAN = [
  {
    path: ["body", "shapePrior"],
    distribution: {
      type: "choice",
      values: ["feminine", "neutral", "masculine"],
    },
  },
  {
    path: ["body", "composition", "muscularity"],
    distribution: {
      type: "uniform",
      min: 0,
      max: 1,
      step: 0.01,
    },
  },
];

test("keyed RNG version is explicit", () => {
  assert.equal(RANDOMIZATION_VERSION, "scc-keyed-rng-v1");
});

test("keyed RNG compatibility vectors are pinned", () => {
  assert.equal(
    keyedUint32("alpha", "s:body/s:shapePrior"),
    562139742,
  );
  assert.equal(
    keyedUint32(
      "alpha",
      "s:body/s:composition/s:muscularity",
    ),
    3691545239,
  );
  assert.equal(
    keyedUint32("雪", "s:body/s:shapePrior"),
    1250805931,
  );
  assert.equal(
    keyedUniform01("alpha", "test"),
    2667699549 / 0x100000000,
  );
});

test("choice and stepped uniform stay within declared domains", () => {
  const prior = keyedChoice(
    "range-seed",
    "shape",
    ["feminine", "neutral", "masculine"],
  );
  assert.ok(["feminine", "neutral", "masculine"].includes(prior));

  const value = keyedUniform("range-seed", "muscularity", {
    min: 0,
    max: 1,
    step: 0.01,
  });
  assert.ok(value >= 0 && value <= 1);
  assert.equal(Math.round(value * 100), value * 100);
});

test("same seed and semantic plan reproduce the same character", async () => {
  const source = await readJson("schema/examples/full.character.json");

  const a = randomizeCharacterFields(source, PLAN, {
    seed: "repeatable",
    validator,
  });
  const b = randomizeCharacterFields(source, PLAN, {
    seed: "repeatable",
    validator,
  });

  assert.equal(characterSemanticJson(a), characterSemanticJson(b));
  assert.equal(
    characterSemanticJson(source),
    characterSemanticJson(
      await readJson("schema/examples/full.character.json"),
    ),
  );
});

test("plan ordering does not affect keyed randomization", async () => {
  const source = await readJson("schema/examples/full.character.json");

  const forward = randomizeCharacterFields(source, PLAN, {
    seed: "order-independent",
    validator,
  });
  const reversed = randomizeCharacterFields(
    source,
    [...PLAN].reverse(),
    {
      seed: "order-independent",
      validator,
    },
  );

  assert.equal(
    characterSemanticJson(forward),
    characterSemanticJson(reversed),
  );
});

test("adding an unrelated field does not perturb existing generated fields", async () => {
  const source = await readJson("schema/examples/full.character.json");

  const base = randomizeCharacterFields(source, PLAN, {
    seed: "growth-safe",
    validator,
  });
  const extended = randomizeCharacterFields(
    source,
    [
      ...PLAN,
      {
        path: ["personality", "traits", "social", "sociability"],
        distribution: {
          type: "uniform",
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
    ],
    {
      seed: "growth-safe",
      validator,
    },
  );

  assert.equal(
    base.body.shapePrior,
    extended.body.shapePrior,
  );
  assert.equal(
    base.body.composition.muscularity,
    extended.body.composition.muscularity,
  );
});

test("different seeds produce different keyed draws", () => {
  assert.notEqual(
    keyedUint32("seed-a", "stable-key"),
    keyedUint32("seed-b", "stable-key"),
  );
});

test("NFC-equivalent seeds produce identical draws", () => {
  assert.equal(
    keyedUint32("café", "stable-key"),
    keyedUint32("cafe\u0301", "stable-key"),
  );
});

test("randomization never depends on Math.random", async () => {
  const source = await readJson("schema/examples/full.character.json");
  const original = Math.random;

  Math.random = () => {
    throw new Error("Math.random must not be used");
  };

  try {
    const result = randomizeCharacterFields(source, PLAN, {
      seed: "no-global-random",
      validator,
    });
    validator.assertValid(result);
  } finally {
    Math.random = original;
  }
});

test("duplicate and overlapping paths are rejected", async () => {
  const source = await readJson("schema/examples/full.character.json");

  assert.throws(
    () =>
      randomizeCharacterFields(
        source,
        [
          PLAN[0],
          PLAN[0],
        ],
        { seed: "bad-plan" },
      ),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
  );

  assert.throws(
    () =>
      randomizeCharacterFields(
        source,
        [
          {
            path: ["body", "composition"],
            distribution: {
              type: "choice",
              values: [{}],
            },
          },
          PLAN[1],
        ],
        { seed: "bad-plan" },
      ),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code === CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
  );
});

test("invalid distributions fail explicitly", async () => {
  const source = await readJson("schema/examples/full.character.json");

  assert.throws(
    () =>
      randomizeCharacterFields(
        source,
        [
          {
            path: ["body", "shapePrior"],
            distribution: {
              type: "choice",
              values: [],
            },
          },
        ],
        { seed: "bad-distribution" },
      ),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code ===
        CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
  );

  assert.throws(
    () =>
      keyedUniform("seed", "key", {
        min: 1,
        max: 0,
      }),
    (error) =>
      error instanceof CharacterCoreError &&
      error.code ===
        CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
  );
});

test("randomized output can be schema-validated", async () => {
  const source = await readJson("schema/examples/full.character.json");
  const result = randomizeCharacterFields(source, PLAN, {
    seed: "schema-valid",
    validator,
  });

  validator.assertValid(result);
});
