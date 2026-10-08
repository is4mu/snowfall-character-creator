import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "./errors.mjs";

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortJsonValue(value[key]);
    }
    return sorted;
  }
  return value;
}

export function parseCharacterJson(text, { validator } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_JSON,
      "character JSON could not be parsed",
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }

  validator?.assertValid(parsed);
  return parsed;
}

export function serializeCharacterJson(
  character,
  {
    validator,
    pretty = true,
  } = {},
) {
  validator?.assertValid(character);

  const canonicalOrder = sortJsonValue(character);
  return pretty
    ? `${JSON.stringify(canonicalOrder, null, 2)}\n`
    : JSON.stringify(canonicalOrder);
}

export function characterSemanticJson(character) {
  return JSON.stringify(sortJsonValue(character));
}
