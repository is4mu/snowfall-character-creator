import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "./errors.mjs";

export const CHARACTER_SCHEMA_VERSION = "1.0.0-draft.1";

export function cloneCharacter(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function createMinimalCharacter({
  characterId,
  displayName,
  identity = {},
} = {}) {
  if (typeof characterId !== "string" || characterId.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_CHARACTER,
      "characterId must be a non-empty string",
    );
  }
  if (typeof displayName !== "string" || displayName.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_CHARACTER,
      "displayName must be a non-empty string",
    );
  }

  return {
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    characterId,
    identity: {
      ...cloneCharacter(identity),
      displayName,
    },
  };
}

function assertPath(path) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_EDIT_PATH,
      "edit path must be a non-empty array",
    );
  }

  for (const segment of path) {
    if (
      !(
        (typeof segment === "string" && segment.length > 0) ||
        (Number.isInteger(segment) && segment >= 0)
      )
    ) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_EDIT_PATH,
        "edit path segments must be non-empty strings or non-negative integers",
      );
    }
  }
}

function descend(container, segment, nextSegment, fullPath) {
  const current = container[segment];
  if (current !== undefined && current !== null) {
    if (typeof current !== "object") {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_EDIT_PATH,
        `cannot descend through non-object value at ${fullPath}`,
      );
    }
    return current;
  }

  const created = Number.isInteger(nextSegment) ? [] : {};
  container[segment] = created;
  return created;
}

export function setCharacterValue(character, path, value) {
  assertPath(path);
  const next = cloneCharacter(character);
  let cursor = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const nextSegment = path[index + 1];

    if (Array.isArray(cursor) && !Number.isInteger(segment)) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_EDIT_PATH,
        "array edits require numeric path segments",
      );
    }

    cursor = descend(
      cursor,
      segment,
      nextSegment,
      path.slice(0, index + 1).join("."),
    );
  }

  const finalSegment = path.at(-1);
  if (Array.isArray(cursor) && !Number.isInteger(finalSegment)) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_EDIT_PATH,
      "array edits require numeric path segments",
    );
  }

  cursor[finalSegment] = cloneCharacter(value);
  return next;
}

export function deleteCharacterValue(character, path) {
  assertPath(path);
  const next = cloneCharacter(character);
  let cursor = next;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (
      cursor === null ||
      typeof cursor !== "object" ||
      !(segment in cursor)
    ) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_EDIT_PATH,
        `path does not exist: ${path.join(".")}`,
      );
    }
    cursor = cursor[segment];
  }

  const finalSegment = path.at(-1);
  if (
    cursor === null ||
    typeof cursor !== "object" ||
    !(finalSegment in cursor)
  ) {
    throw new CharacterCoreError(
      CharacterCoreErrorCode.INVALID_EDIT_PATH,
      `path does not exist: ${path.join(".")}`,
    );
  }

  if (Array.isArray(cursor)) {
    if (!Number.isInteger(finalSegment)) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_EDIT_PATH,
        "array edits require numeric path segments",
      );
    }
    cursor.splice(finalSegment, 1);
  } else {
    delete cursor[finalSegment];
  }

  return next;
}
