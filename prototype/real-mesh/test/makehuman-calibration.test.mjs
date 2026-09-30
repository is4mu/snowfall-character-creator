import assert from "node:assert/strict";
import test from "node:test";

import {
  MAKEHUMAN_RENDERER_LANDMARKS,
  assertPinnedShoulderLandmarks,
  measurePositionArrayHeightUnits,
  measurePositionBoundsUnits,
  measureShoulderBreadthCm,
} from "../makehuman-measurement.mjs";
import {
  SHOULDER_CALIBRATION_CONTRACT,
  solveShoulderBreadthTarget,
} from "../makehuman-calibration.mjs";

function syntheticPinnedBase() {
  const landmark = MAKEHUMAN_RENDERER_LANDMARKS.shoulderBreadth;
  const vertexCount = Math.max(landmark.leftIndex, landmark.rightIndex) + 1;
  const positions = new Float64Array(vertexCount * 3);

  positions[1] = -8.1676;
  positions[4] = 8.4913;
  positions[2 * 3 + 1] = -99;

  const leftOffset = landmark.leftIndex * 3;
  const rightOffset = landmark.rightIndex * 3;
  positions.set(landmark.expectedBaseLeft, leftOffset);
  positions.set(landmark.expectedBaseRight, rightOffset);

  return positions;
}

const decrease = [
  {index: 1357, dx: 0.135, dy: 0, dz: 0},
  {index: 8049, dx: -0.135, dy: 0, dz: 0},
];

const increase = [
  {index: 1357, dx: -0.249, dy: 0, dz: 0},
  {index: 8049, dx: 0.249, dy: 0, dz: 0},
];

const bodyHeightIndices = new Uint32Array([0, 1, 1357, 8049]);

test("pinned shoulder landmarks match the analyzed CC0 base coordinates", () => {
  const base = syntheticPinnedBase();
  const result = assertPinnedShoulderLandmarks(base);

  assert.equal(result.landmarkStatus, "provisional-cc0-derived");
  assert.deepEqual(result.left, [-1.899, 5.2051, 0.6451]);
  assert.deepEqual(result.right, [1.899, 5.2051, 0.6451]);
});

test("pinned landmark assertion detects incompatible base geometry", () => {
  const base = syntheticPinnedBase();
  base[1357 * 3] += 0.01;

  assert.throws(
    () => assertPinnedShoulderLandmarks(base),
    /does not match pinned base mesh/,
  );
});

test("body-only height ignores helper vertices outside the anthropometric surface", () => {
  const base = syntheticPinnedBase();

  assert.ok(measurePositionArrayHeightUnits(base) > 100);
  assert.ok(
    Math.abs(
      measurePositionArrayHeightUnits(base, bodyHeightIndices) - 16.6589
    ) < 1e-9,
  );

  const bounds = measurePositionBoundsUnits(base, bodyHeightIndices);
  assert.equal(bounds.vertexCount, 4);
  assert.ok(Math.abs(bounds.minY - (-8.1676)) < 1e-9);
  assert.ok(Math.abs(bounds.maxY - 8.4913) < 1e-9);
});

test("shoulder breadth is normalized by body-only raw mesh height", () => {
  const base = syntheticPinnedBase();

  assert.ok(
    Math.abs(
      measureShoulderBreadthCm(
        base,
        162,
        undefined,
        bodyHeightIndices,
      ) - 36.93377113735
    ) < 1e-9,
  );
});

test("shoulder solver reaches the representative 38 cm target", () => {
  const base = syntheticPinnedBase();
  const before = Array.from(base);

  const result = solveShoulderBreadthTarget({
    basePositions: base,
    decreaseDeltas: decrease,
    increaseDeltas: increase,
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 38,
    heightVertexIndices: bodyHeightIndices,
    toleranceCm: 0.001,
  });

  assert.equal(result.contract, SHOULDER_CALIBRATION_CONTRACT);
  assert.equal(result.status, "solved");
  assert.equal(result.experimental, true);
  assert.ok(Math.abs(result.measuredCm - 38) <= 0.001);
  assert.ok(result.weight > 0 && result.weight < 1);
  assert.deepEqual(Array.from(base), before);
});

test("solver reports target range instead of pretending unreachable values fit", () => {
  const base = syntheticPinnedBase();

  const tooWide = solveShoulderBreadthTarget({
    basePositions: base,
    decreaseDeltas: decrease,
    increaseDeltas: increase,
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 50,
    heightVertexIndices: bodyHeightIndices,
  });

  assert.equal(tooWide.status, "out-of-range");
  assert.equal(tooWide.weight, 1);
  assert.ok(tooWide.maxReachableCm < 50);
  assert.ok(tooWide.residualCm < 0);
});

test("solver endpoint range matches pinned shoulder-target analysis", () => {
  const base = syntheticPinnedBase();

  const result = solveShoulderBreadthTarget({
    basePositions: base,
    decreaseDeltas: decrease,
    increaseDeltas: increase,
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 38,
    heightVertexIndices: bodyHeightIndices,
  });

  assert.ok(Math.abs(result.minReachableCm - 34.30814759678) < 1e-9);
  assert.ok(Math.abs(result.maxReachableCm - 41.77658788996) < 1e-9);
});
