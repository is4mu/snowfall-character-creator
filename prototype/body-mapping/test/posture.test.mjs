import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PREVIEW_POSTURE,
  PREVIEW_POSTURE_CONTRACT,
  derivePreviewPostureTransforms,
  normalizePreviewPosture,
} from "../posture.mjs";

const dimensions = {
  shoulderBreadthM: 0.40,
};

test("preview posture is a separate renderer/editor contract", () => {
  const result = normalizePreviewPosture();

  assert.equal(result.contract, PREVIEW_POSTURE_CONTRACT);
  assert.equal(result.pelvicTiltDeg, DEFAULT_PREVIEW_POSTURE.pelvicTiltDeg);
  assert.equal(result.trunkFlexionDeg, DEFAULT_PREVIEW_POSTURE.trunkFlexionDeg);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "body"),
    false,
  );
});

test("preview posture values are clamped without inventing body data", () => {
  const result = normalizePreviewPosture({
    pelvicTiltDeg: 90,
    trunkFlexionDeg: -50,
    shoulderProtractionDeg: 100,
    headForwardCm: 99,
    headPitchDeg: -99,
  });

  assert.equal(result.pelvicTiltDeg, 20);
  assert.equal(result.trunkFlexionDeg, -15);
  assert.equal(result.shoulderProtractionDeg, 30);
  assert.equal(result.headForwardCm, 12);
  assert.equal(result.headPitchDeg, -25);
});

test("derived preview transforms are deterministic and renderer-local", () => {
  const input = {
    pelvicTiltDeg: 8,
    trunkFlexionDeg: 12,
    shoulderProtractionDeg: 15,
    headForwardCm: 4,
    headPitchDeg: 6,
  };

  const first = derivePreviewPostureTransforms(input, dimensions);
  const second = derivePreviewPostureTransforms(input, dimensions);

  assert.deepEqual(first, second);
  assert.equal(first.contract, PREVIEW_POSTURE_CONTRACT);
  assert.equal(first.headForwardM, 0.04);
  assert.ok(first.shoulderForwardM > 0);
  assert.ok(first.trunkPitchRad > 0);
});

test("deriving posture does not mutate its input", () => {
  const input = {
    pelvicTiltDeg: 5,
    trunkFlexionDeg: 10,
  };
  const before = JSON.stringify(input);

  derivePreviewPostureTransforms(input, dimensions);

  assert.equal(JSON.stringify(input), before);
});

test("posture transforms require renderer body dimensions", () => {
  assert.throws(
    () => derivePreviewPostureTransforms({}, null),
    /shoulderBreadthM/,
  );
});
