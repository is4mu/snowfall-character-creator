"""Contract tests for the portable Character Schema.

These tests intentionally validate public schema behavior rather than
implementation details of a future Character Creator application.
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schema" / "character.schema.json"
EXAMPLES_DIR = ROOT / "schema" / "examples"
INVALID_DIR = ROOT / "schema" / "fixtures" / "invalid"


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def format_errors(errors: list) -> str:
    lines: list[str] = []
    for error in errors:
        instance_path = "/" + "/".join(str(part) for part in error.absolute_path)
        if instance_path == "/":
            instance_path = "<root>"
        lines.append(
            f"{instance_path}: [{error.validator}] {error.message}"
        )
    return "\n".join(lines)


class CharacterSchemaContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = load_json(SCHEMA_PATH)
        Draft202012Validator.check_schema(cls.schema)
        cls.validator = Draft202012Validator(
            cls.schema,
            format_checker=FormatChecker(),
        )

    def validation_errors(self, path: Path) -> list:
        instance = load_json(path)
        return sorted(
            self.validator.iter_errors(instance),
            key=lambda error: (
                tuple(str(part) for part in error.absolute_path),
                str(error.validator),
                error.message,
            ),
        )

    def test_schema_declares_draft_2020_12(self) -> None:
        self.assertEqual(
            self.schema["$schema"],
            "https://json-schema.org/draft/2020-12/schema",
        )

    def test_schema_has_explicit_draft_version(self) -> None:
        self.assertEqual(
            self.schema["properties"]["schemaVersion"]["const"],
            "1.0.0-draft.1",
        )

    def test_personality_v1_has_exactly_30_canonical_traits(self) -> None:
        domain_defs = [
            "personalityOpenness",
            "personalitySelfRegulation",
            "personalitySocial",
            "personalityInterpersonal",
            "personalityIntegrity",
            "personalityEmotional",
            "personalityBehavioral",
            "personalityAttachment",
        ]
        trait_count = sum(
            len(self.schema["$defs"][domain_name]["required"])
            for domain_name in domain_defs
        )
        self.assertEqual(trait_count, 30)

    def test_body_v1_contract_is_explicit(self) -> None:
        body_def = self.schema["$defs"]["body"]
        self.assertEqual(
            body_def["properties"]["model"]["const"],
            "scc-body-v1",
        )
        self.assertEqual(
            set(body_def["properties"]["shapePrior"]["enum"]),
            {"masculine", "feminine", "neutral"},
        )

        expected_measurements = {
            "heightCm",
            "massKg",
            "armSpanCm",
            "sittingHeightCm",
            "shoulderBreadthCm",
            "shoulderSlopeDeg",
            "upperArmLengthCm",
            "forearmLengthCm",
            "thighLengthCm",
            "lowerLegLengthCm",
            "chestCircumferenceCm",
            "chestBreadthCm",
            "chestDepthCm",
            "underbustCircumferenceCm",
            "waistCircumferenceCm",
            "waistBreadthCm",
            "waistDepthCm",
            "abdominalDepthCm",
            "hipCircumferenceCm",
            "hipBreadthCm",
            "buttockDepthCm",
            "neckCircumferenceCm",
            "upperArmCircumferenceCm",
            "forearmCircumferenceCm",
            "wristCircumferenceCm",
            "thighCircumferenceCm",
            "calfCircumferenceCm",
            "ankleCircumferenceCm",
            "armLengthCm",
            "inseamCm",
            "handLengthCm",
            "handBreadthCm",
            "footLengthCm",
            "footBreadthCm",
            "headCircumferenceCm",
        }
        self.assertEqual(
            set(body_def["properties"]["measurements"]["properties"]),
            expected_measurements,
        )

        self.assertEqual(
            set(body_def["properties"]["composition"]["properties"]),
            {"bodyFatFraction", "muscularity"},
        )

    def test_all_examples_are_valid(self) -> None:
        examples = sorted(EXAMPLES_DIR.glob("*.json"))
        self.assertGreater(len(examples), 0, "No valid example fixtures found.")

        for path in examples:
            with self.subTest(path=path.name):
                errors = self.validation_errors(path)
                self.assertEqual(
                    errors,
                    [],
                    f"{path.name} must validate:\n{format_errors(errors)}",
                )

    def test_invalid_fixture_inventory_is_explicit(self) -> None:
        expected = set(self.invalid_contracts())
        actual = {path.name for path in INVALID_DIR.glob("*.json")}
        self.assertEqual(
            actual,
            expected,
            "Every invalid fixture must declare its intended failure contract.",
        )

    def test_invalid_fixtures_fail_for_intended_reason_only(self) -> None:
        for filename, contract in self.invalid_contracts().items():
            path = INVALID_DIR / filename
            with self.subTest(path=filename):
                errors = self.validation_errors(path)
                self.assertEqual(
                    len(errors),
                    1,
                    (
                        f"{filename} should contain one focused contract "
                        f"violation, found {len(errors)}:\n{format_errors(errors)}"
                    ),
                )

                error = errors[0]
                self.assertEqual(error.validator, contract["validator"])
                self.assertEqual(
                    list(error.absolute_path),
                    contract["instance_path"],
                )

    @staticmethod
    def invalid_contracts() -> dict[str, dict[str, object]]:
        return {
            "body-fat-out-of-range.character.json": {
                "validator": "maximum",
                "instance_path": [
                    "body",
                    "composition",
                    "bodyFatFraction",
                ],
            },
            "body-missing-model.character.json": {
                "validator": "required",
                "instance_path": ["body"],
            },
            "body-shape-prior-invalid.character.json": {
                "validator": "enum",
                "instance_path": ["body", "shapePrior"],
            },
            "body-renderer-local-field.character.json": {
                "validator": "additionalProperties",
                "instance_path": ["body"],
            },
            "body-posture-field.character.json": {
                "validator": "additionalProperties",
                "instance_path": ["body"],
            },
            "body-shoulder-slope-out-of-range.character.json": {
                "validator": "maximum",
                "instance_path": [
                    "body",
                    "measurements",
                    "shoulderSlopeDeg",
                ],
            },
            "body-negative-depth.character.json": {
                "validator": "exclusiveMinimum",
                "instance_path": [
                    "body",
                    "measurements",
                    "chestDepthCm",
                ],
            },
            "body-negative-abdominal-depth.character.json": {
                "validator": "exclusiveMinimum",
                "instance_path": [
                    "body",
                    "measurements",
                    "abdominalDepthCm",
                ],
            },
            "missing-identity.character.json": {
                "validator": "required",
                "instance_path": [],
            },
            "negative-measurement.character.json": {
                "validator": "exclusiveMinimum",
                "instance_path": [
                    "body",
                    "measurements",
                    "footLengthCm",
                ],
            },
            "personality-missing-trait.character.json": {
                "validator": "required",
                "instance_path": [
                    "personality",
                    "traits",
                    "attachment",
                ],
            },
            "personality-out-of-range.character.json": {
                "validator": "maximum",
                "instance_path": [
                    "personality",
                    "traits",
                    "social",
                    "sociability",
                ],
            },
            "unknown-core-field.character.json": {
                "validator": "additionalProperties",
                "instance_path": ["identity"],
            },
        }


if __name__ == "__main__":
    unittest.main()
