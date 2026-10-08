export class CharacterCoreError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CharacterCoreError";
    this.code = code;
    this.details = details;
  }
}

export const CharacterCoreErrorCode = Object.freeze({
  INVALID_JSON: "INVALID_JSON",
  INVALID_CHARACTER: "INVALID_CHARACTER",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  INVALID_EDIT_PATH: "INVALID_EDIT_PATH",
});
