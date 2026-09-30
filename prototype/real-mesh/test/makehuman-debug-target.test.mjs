import assert from "node:assert/strict";
import test from "node:test";

import {
  RENDERER_TARGET_DEBUG_CONTRACT,
  applyRendererTargetDebug,
} from "../makehuman-debug-target.mjs";

test("debug target application is renderer-local and explicitly uncalibrated", () => {
  const base = new Float64Array([
    0, 0, 0,
    1, 0, 0,
  ]);
  const before = Array.from(base);

  const result = applyRendererTargetDebug({
    basePositions: base,
    decreaseDeltas: [{index: 1, dx: -1, dy: 0, dz: 0}],
    increaseDeltas: [{index: 1, dx: 2, dy: 0, dz: 0}],
    signedWeight: 0.5,
    field: "measurements.shoulderBreadthCm",
    modifier: "measure/measure-shoulder-dist-decr|incr",
  });

  assert.equal(result.contract, RENDERER_TARGET_DEBUG_CONTRACT);
  assert.equal(result.rendererLocal, true);
  assert.equal(result.calibrated, false);
  assert.equal(result.signedWeight, 0.5);
  assert.deepEqual(Array.from(base), before);
  assert.deepEqual(Array.from(result.positions), [
    0, 0, 0,
    2, 0, 0,
  ]);
});

test("debug application always starts from immutable base positions", () => {
  const base = new Float64Array([1, 0, 0]);
  const decrease = [{index: 0, dx: -1, dy: 0, dz: 0}];
  const increase = [{index: 0, dx: 2, dy: 0, dz: 0}];

  const first = applyRendererTargetDebug({
    basePositions: base,
    decreaseDeltas: decrease,
    increaseDeltas: increase,
    signedWeight: 1,
    field: "measurements.shoulderBreadthCm",
    modifier: "measure/measure-shoulder-dist-decr|incr",
  });
  const second = applyRendererTargetDebug({
    basePositions: base,
    decreaseDeltas: decrease,
    increaseDeltas: increase,
    signedWeight: -1,
    field: "measurements.shoulderBreadthCm",
    modifier: "measure/measure-shoulder-dist-decr|incr",
  });

  assert.deepEqual(Array.from(first.positions), [3, 0, 0]);
  assert.deepEqual(Array.from(second.positions), [0, 0, 0]);
  assert.deepEqual(Array.from(base), [1, 0, 0]);
});
