import assert from "node:assert/strict";
import test from "node:test";

import { solveShoulderBreadthTarget } from "../makehuman-calibration.mjs";
import {
  SHAPE_PRIOR_CONTRACT,
  applyShapePrior,
  averageTargetDeltas,
  composeShapePriorEndpoints,
  interpolateTargetDeltas,
  shapePriorValue,
} from "../makehuman-shape-prior.mjs";

test("target averaging treats missing deltas as zero and is deterministic", () => {
  const result = averageTargetDeltas([
    [
      {index: 2, dx: 3, dy: 0, dz: 0},
      {index: 0, dx: 1, dy: 2, dz: 3},
    ],
    [
      {index: 0, dx: 3, dy: 4, dz: 5},
    ],
  ]);

  assert.deepEqual(result, [
    {index: 0, dx: 2, dy: 3, dz: 4},
    {index: 2, dx: 1.5, dy: 0, dz: 0},
  ]);
});

test("target interpolation preserves endpoints and exact midpoint", () => {
  const a = [{index: 0, dx: -2, dy: 4, dz: 0}];
  const b = [{index: 0, dx: 6, dy: 0, dz: 2}];

  assert.deepEqual(interpolateTargetDeltas(a, b, 0), a);
  assert.deepEqual(interpolateTargetDeltas(a, b, 1), b);
  assert.deepEqual(interpolateTargetDeltas(a, b, 0.5), [
    {index: 0, dx: 2, dy: 2, dz: 1},
  ]);
});

test("shapePrior has a stable renderer-only normalized axis", () => {
  assert.equal(shapePriorValue("feminine"), 0);
  assert.equal(shapePriorValue("neutral"), 0.5);
  assert.equal(shapePriorValue("masculine"), 1);
  assert.throws(() => shapePriorValue("other"), /Unsupported shapePrior/);
});

test("shape prior application never mutates canonical/base geometry", () => {
  const base = new Float64Array([
    0, 0, 0,
    1, 1, 1,
  ]);
  const before = Array.from(base);
  const endpoints = composeShapePriorEndpoints({
    feminineTargets: [[{index: 1, dx: -1, dy: 0, dz: 0}]],
    masculineTargets: [[{index: 1, dx: 1, dy: 2, dz: 0}]],
  });

  const result = applyShapePrior({
    basePositions: base,
    endpoints,
    shapePrior: "neutral",
  });

  assert.equal(result.contract, SHAPE_PRIOR_CONTRACT);
  assert.equal(result.rendererLocal, true);
  assert.equal(result.source, "body.shapePrior");
  assert.equal(result.normalizedValue, 0.5);
  assert.deepEqual(Array.from(result.positions), [
    0, 0, 0,
    1, 2, 1,
  ]);
  assert.deepEqual(Array.from(base), before);
});

test("renderer result does not expose upstream source-group identity", () => {
  const endpoints = composeShapePriorEndpoints({
    feminineTargets: [[{index: 0, dx: -1, dy: 0, dz: 0}]],
    masculineTargets: [[{index: 0, dx: 1, dy: 0, dz: 0}]],
  });

  const result = applyShapePrior({
    basePositions: new Float64Array([0, 0, 0]),
    endpoints,
    shapePrior: "feminine",
  });

  const serialized = JSON.stringify({
    contract: result.contract,
    rendererLocal: result.rendererLocal,
    source: result.source,
    shapePrior: result.shapePrior,
    normalizedValue: result.normalizedValue,
    endpointPolicy: result.endpointPolicy,
  });

  assert.doesNotMatch(serialized, /african|asian|caucasian|race|ethnic/i);
});

test("shape prior endpoints are computed once from equal source counts", () => {
  const endpoints = composeShapePriorEndpoints({
    feminineTargets: [
      [{index: 0, dx: -3, dy: 0, dz: 0}],
      [{index: 0, dx: 0, dy: 0, dz: 0}],
      [{index: 0, dx: 3, dy: 0, dz: 0}],
    ],
    masculineTargets: [
      [{index: 0, dx: 3, dy: 0, dz: 0}],
      [{index: 0, dx: 6, dy: 0, dz: 0}],
      [{index: 0, dx: 9, dy: 0, dz: 0}],
    ],
  });

  assert.deepEqual(endpoints.feminine, [
    {index: 0, dx: 0, dy: 0, dz: 0},
  ]);
  assert.deepEqual(endpoints.masculine, [
    {index: 0, dx: 6, dy: 0, dz: 0},
  ]);
});

test("explicit shoulder measurement reconverges after every shape prior", () => {
  const vertexCount = 8050;
  const base = new Float64Array(vertexCount * 3);

  base[1] = -8;
  base[4] = 8;

  base[1357 * 3] = -1.8;
  base[1357 * 3 + 1] = 5;
  base[8049 * 3] = 1.8;
  base[8049 * 3 + 1] = 5;

  const endpoints = composeShapePriorEndpoints({
    feminineTargets: [[
      {index: 0, dx: 0, dy: 0.2, dz: 0},
      {index: 1, dx: 0, dy: -0.2, dz: 0},
      {index: 1357, dx: 0.1, dy: 0, dz: 0},
      {index: 8049, dx: -0.1, dy: 0, dz: 0},
    ]],
    masculineTargets: [[
      {index: 0, dx: 0, dy: -0.2, dz: 0},
      {index: 1, dx: 0, dy: 0.2, dz: 0},
      {index: 1357, dx: -0.1, dy: 0, dz: 0},
      {index: 8049, dx: 0.1, dy: 0, dz: 0},
    ]],
  });

  const decrease = [
    {index: 1357, dx: 0.3, dy: 0, dz: 0},
    {index: 8049, dx: -0.3, dy: 0, dz: 0},
  ];
  const increase = [
    {index: 1357, dx: -0.3, dy: 0, dz: 0},
    {index: 8049, dx: 0.3, dy: 0, dz: 0},
  ];

  for (const shapePrior of ["feminine", "neutral", "masculine"]) {
    const prior = applyShapePrior({
      basePositions: base,
      endpoints,
      shapePrior,
    });

    const solved = solveShoulderBreadthTarget({
      basePositions: prior.positions,
      decreaseDeltas: decrease,
      increaseDeltas: increase,
      canonicalHeightCm: 162,
      targetShoulderBreadthCm: 38,
      toleranceCm: 0.01,
    });

    assert.equal(solved.status, "solved");
    assert.ok(Math.abs(solved.measuredCm - 38) <= 0.01);
  }
});
