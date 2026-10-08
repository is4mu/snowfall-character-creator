import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { CHARACTER_SCHEMA_VERSION } from "./character.mjs";
import {
  CharacterCoreError,
  CharacterCoreErrorCode,
} from "./errors.mjs";

function normalizeErrors(errors = []) {
  return errors.map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message ?? "",
    params: error.params,
  }));
}

export function createCharacterValidator(schema) {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    // Character Schema intentionally uses required-only branches inside anyOf
    // (for example the color contract). This is valid JSON Schema, but AJV's
    // strictRequired lint would reject it unless explicitly disabled.
    strictRequired: false,
  });
  addFormats(ajv);

  const validateSchema = ajv.compile(schema);

  function validate(character) {
    const valid = Boolean(validateSchema(character));
    return {
      valid,
      errors: valid ? [] : normalizeErrors(validateSchema.errors),
    };
  }

  function assertValid(character) {
    if (
      character?.schemaVersion !== undefined &&
      character.schemaVersion !== CHARACTER_SCHEMA_VERSION
    ) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.UNSUPPORTED_SCHEMA_VERSION,
        `unsupported schemaVersion=${String(character.schemaVersion)}`,
      );
    }

    const result = validate(character);
    if (!result.valid) {
      throw new CharacterCoreError(
        CharacterCoreErrorCode.INVALID_CHARACTER,
        "character does not conform to Character Schema",
        { errors: result.errors },
      );
    }

    return character;
  }

  return Object.freeze({
    validate,
    assertValid,
  });
}
