import { setCharacterValue } from "./character.mjs";
import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "./errors.mjs";

export const RANDOMIZATION_VERSION = "scc-keyed-rng-v1";

const UTF8 = new TextEncoder();

function normalizeSeed(seed) {
  if (typeof seed !== "string" || seed.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
      "seed must be a non-empty string",
    );
  }
  return seed.normalize("NFC");
}

function encodePath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
      "randomization path must be a non-empty array",
    );
  }

  return path
    .map((segment) => {
      if (typeof segment === "string" && segment.length > 0) {
        return `s:${segment.replaceAll("\\", "\\\\").replaceAll("/", "\\/")}`;
      }
      if (Number.isInteger(segment) && segment >= 0) {
        return `n:${segment}`;
      }
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
        "randomization path segments must be non-empty strings or non-negative integers",
      );
    })
    .join("/");
}

function fnv1a32(text) {
  let hash = 0x811c9dc5;
  for (const byte of UTF8.encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  // Final avalanche keeps nearby textual keys from retaining weak FNV low-bit
  // structure while remaining fully specified in ordinary 32-bit JS arithmetic.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function keyMaterial(seed, key, counter = 0) {
  if (typeof key !== "string" || key.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
      "randomization key must be a non-empty string",
    );
  }
  if (!Number.isInteger(counter) || counter < 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
      "counter must be a non-negative integer",
    );
  }

  return [
    RANDOMIZATION_VERSION,
    normalizeSeed(seed),
    key.normalize("NFC"),
    String(counter),
  ].join("\u0000");
}

export function keyedUint32(seed, key, counter = 0) {
  return fnv1a32(keyMaterial(seed, key, counter));
}

export function keyedUniform01(seed, key, counter = 0) {
  return keyedUint32(seed, key, counter) / 0x100000000;
}

export function keyedChoice(seed, key, values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
      "choice distribution requires at least one value",
    );
  }
  const index = Math.floor(keyedUniform01(seed, key) * values.length);
  return structuredClone(values[index]);
}

export function keyedUniform(seed, key, { min, max, step } = {}) {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !(max >= min)
  ) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
      "uniform distribution requires finite min <= max",
    );
  }

  const unit = keyedUniform01(seed, key);

  if (step === undefined) {
    return min + (max - min) * unit;
  }

  if (!Number.isFinite(step) || step <= 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
      "uniform step must be a positive finite number",
    );
  }

  const span = max - min;
  const steps = Math.floor(span / step + 1e-12);
  const count = steps + 1;
  const index = Math.floor(unit * count);
  const value = min + index * step;

  // Avoid common binary floating-point tails in authored JSON while keeping
  // the contract deterministic. Precision is derived from the declared step.
  const stepText = String(step);
  const decimals = stepText.includes(".")
    ? stepText.length - stepText.indexOf(".") - 1
    : 0;
  return Number(value.toFixed(Math.min(decimals + 2, 12)));
}

function pathIsPrefix(a, b) {
  if (a.length >= b.length) return false;
  return a.every((segment, index) => Object.is(segment, b[index]));
}

function validatePlan(plan) {
  if (!Array.isArray(plan)) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
      "randomization plan must be an array",
    );
  }

  const entries = plan.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
        `plan entry ${index} must be an object`,
      );
    }
    const key = encodePath(entry.path);
    return {
      ...entry,
      key,
    };
  });

  for (let a = 0; a < entries.length; a += 1) {
    for (let b = a + 1; b < entries.length; b += 1) {
      const left = entries[a];
      const right = entries[b];
      if (
        left.key === right.key ||
        pathIsPrefix(left.path, right.path) ||
        pathIsPrefix(right.path, left.path)
      ) {
        throw new CharacterCoreError(
          CharacterCoreErrorCode.INVALID_RANDOMIZATION_PLAN,
          `randomization paths overlap: ${left.key} and ${right.key}`,
        );
      }
    }
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

function sampleDistribution(seed, key, distribution) {
  if (!distribution || typeof distribution !== "object") {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
      `missing distribution for ${key}`,
    );
  }

  switch (distribution.type) {
    case "choice":
      return keyedChoice(seed, key, distribution.values);
    case "uniform":
      return keyedUniform(seed, key, distribution);
    default:
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_RANDOMIZATION_DISTRIBUTION,
        `unsupported distribution type=${String(distribution.type)}`,
      );
  }
}

export function randomizeCharacterFields(
  character,
  plan,
  {
    seed,
    validator,
  } = {},
) {
  const normalizedSeed = normalizeSeed(seed);
  const entries = validatePlan(plan);

  // Sample everything before editing so plan failures cannot return a partially
  // randomized document.
  const sampled = entries.map((entry) => ({
    path: entry.path,
    value: sampleDistribution(normalizedSeed, entry.key, entry.distribution),
  }));

  let next = character;
  for (const entry of sampled) {
    next = setCharacterValue(next, entry.path, entry.value);
  }

  validator?.assertValid(next);
  return next;
}
