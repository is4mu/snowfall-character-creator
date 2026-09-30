import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCoupledChestCandidate,
  refineRendererWeightBracket,
  scanRendererWeightBrackets,
  solveCoupledChestCircumference,
  solveRendererTargetByBrackets,
} from "../makehuman-coupled-calibration.mjs";

function measured(fn) {
  return (weight) => ({
    status: "measured",
    measuredValue: fn(weight),
    positions: new Float64Array([weight, 0, 0]),
  });
}

test("coarse scan finds one local bracket without assuming global monotonicity", () => {
  const result = scanRendererWeightBrackets({
    evaluateWeight: measured((weight) =>
      weight < -0.5
        ? 90 + (weight + 1) * 2
        : 84 + (weight + 0.5) * 8
    ),
    targetValue: 88,
    sampleCount: 9,
    tolerance: 0.001,
  });

  assert.equal(result.brackets.length, 1);
  assert.ok(result.measuredRange.min < 88);
  assert.ok(result.measuredRange.max > 88);
});

test("single sign-change bracket refines to the requested target", () => {
  const evaluateWeight = measured((weight) => 90 + 10 * weight);
  const scan = scanRendererWeightBrackets({
    evaluateWeight,
    targetValue: 88,
    sampleCount: 5,
    tolerance: 0.001,
  });

  assert.equal(scan.brackets.length, 1);

  const result = refineRendererWeightBracket({
    evaluateWeight,
    targetValue: 88,
    lower: scan.brackets[0].lower,
    upper: scan.brackets[0].upper,
    tolerance: 0.001,
  });

  assert.equal(result.status, "solved");
  assert.ok(Math.abs(result.best.measuredValue - 88) <= 0.001);
  assert.ok(Math.abs(result.best.weight - (-0.2)) < 0.001);
});

test("multiple target crossings are reported as ambiguous", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) => 88 + (weight * weight - 0.25) * 10),
    targetValue: 88,
    sampleCount: 17,
    tolerance: 0.0001,
  });

  assert.equal(result.status, "ambiguous-multiple-brackets");
  assert.ok(result.scan.brackets.length >= 2);
});

test("unreachable target reports measured range", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) => 80 + weight),
    targetValue: 88,
    sampleCount: 9,
  });

  assert.equal(result.status, "out-of-range");
  assert.deepEqual(result.scan.measuredRange, {min: 79, max: 81});
});

test("invalid evaluations break continuity instead of creating a fake bracket", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: (weight) => {
      if (Math.abs(weight) < 0.2) {
        return {status: "chest-unmeasured", measuredValue: null};
      }
      return {
        status: "measured",
        measuredValue: weight < 0 ? 87 : 89,
      };
    },
    targetValue: 88,
    sampleCount: 9,
  });

  assert.equal(result.status, "no-bracket");
});

test("discontinuous sign-change bracket cannot report false success", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) => weight < 0 ? 87 : 89),
    targetValue: 88,
    sampleCount: 8,
    tolerance: 0.01,
    weightTolerance: 1e-7,
    maxIterations: 40,
  });

  assert.equal(result.status, "discontinuous-bracket");
  assert.ok(Math.abs(result.best.residual) >= 0.99);
});

test("one exact coarse hit solves immediately", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) =>
      weight === 0 ? 88 : 90
    ),
    targetValue: 88,
    sampleCount: 5,
    tolerance: 0.001,
  });

  assert.equal(result.status, "solved");
  assert.equal(result.source, "coarse-exact-hit");
  assert.equal(result.best.weight, 0);
});

test("multiple exact coarse hits are ambiguous", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) =>
      Math.abs(weight) === 0.5 ? 88 : 90
    ),
    targetValue: 88,
    sampleCount: 5,
    tolerance: 0.001,
  });

  assert.equal(result.status, "ambiguous-multiple-brackets");
  assert.equal(result.source, "multiple-coarse-exact-hits");
});

function coupledBoxFixture() {
  const vertexCount = 8050;
  const positions = new Float64Array(vertexCount * 3);
  const vertices = [
    [-0.25, -2, -0.25],
    [ 0.25, -2, -0.25],
    [ 0.25, -2,  0.25],
    [-0.25, -2,  0.25],
    [-0.25,  2, -0.25],
    [ 0.25,  2, -0.25],
    [ 0.25,  2,  0.25],
    [-0.25,  2,  0.25],
  ];

  for (let index = 0; index < vertices.length; index += 1) {
    positions.set(vertices[index], index * 3);
  }

  positions.set([-0.5, 0, 0], 1357 * 3);
  positions.set([ 0.5, 0, 0], 8049 * 3);

  const triangles = new Uint32Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);

  const bodyVertexIndices = new Uint32Array([
    0, 1, 2, 3, 4, 5, 6, 7, 1357, 8049,
  ]);

  const increase = [];
  const decrease = [];
  for (let index = 0; index < 8; index += 1) {
    const offset = index * 3;
    const x = positions[offset];
    const z = positions[offset + 2];
    const dx = Math.sign(x) * 0.05;
    const dz = Math.sign(z) * 0.05;
    increase.push({index, dx, dy: 0, dz});
    decrease.push({index, dx: -dx, dy: 0, dz: -dz});
  }

  return {
    positions,
    triangles,
    bodyVertexIndices,
    bustDecreaseDeltas: decrease,
    bustIncreaseDeltas: increase,
    shoulderDecreaseDeltas: [],
    shoulderIncreaseDeltas: [],
  };
}

test("coupled candidate re-solves shoulder and measures chest from immutable prior geometry", () => {
  const fixture = coupledBoxFixture();
  const before = Array.from(fixture.positions);

  const baseline = evaluateCoupledChestCandidate({
    priorPositions: fixture.positions,
    bustDecreaseDeltas: fixture.bustDecreaseDeltas,
    bustIncreaseDeltas: fixture.bustIncreaseDeltas,
    bustWeight: 0,
    shoulderDecreaseDeltas: fixture.shoulderDecreaseDeltas,
    shoulderIncreaseDeltas: fixture.shoulderIncreaseDeltas,
    canonicalHeightCm: 160,
    targetShoulderBreadthCm: 40,
    bodyTriangles: fixture.triangles,
    bodyVertexIndices: fixture.bodyVertexIndices,
  });

  const expanded = evaluateCoupledChestCandidate({
    priorPositions: fixture.positions,
    bustDecreaseDeltas: fixture.bustDecreaseDeltas,
    bustIncreaseDeltas: fixture.bustIncreaseDeltas,
    bustWeight: 0.5,
    shoulderDecreaseDeltas: fixture.shoulderDecreaseDeltas,
    shoulderIncreaseDeltas: fixture.shoulderIncreaseDeltas,
    canonicalHeightCm: 160,
    targetShoulderBreadthCm: 40,
    bodyTriangles: fixture.triangles,
    bodyVertexIndices: fixture.bodyVertexIndices,
  });

  assert.equal(baseline.status, "measured");
  assert.ok(Math.abs(baseline.measuredValue - 80) < 1e-9);
  assert.equal(expanded.status, "measured");
  assert.ok(Math.abs(expanded.measuredValue - 88) < 1e-9);
  assert.ok(Math.abs(expanded.shoulder.measuredCm - 40) <= 0.01);
  assert.deepEqual(Array.from(fixture.positions), before);
});

test("coupled chest solver solves chest while preserving explicit shoulder target", () => {
  const fixture = coupledBoxFixture();

  const result = solveCoupledChestCircumference({
    priorPositions: fixture.positions,
    bustDecreaseDeltas: fixture.bustDecreaseDeltas,
    bustIncreaseDeltas: fixture.bustIncreaseDeltas,
    shoulderDecreaseDeltas: fixture.shoulderDecreaseDeltas,
    shoulderIncreaseDeltas: fixture.shoulderIncreaseDeltas,
    canonicalHeightCm: 160,
    targetShoulderBreadthCm: 40,
    targetChestCircumferenceCm: 88,
    bodyTriangles: fixture.triangles,
    bodyVertexIndices: fixture.bodyVertexIndices,
    sampleCount: 5,
    chestToleranceCm: 0.001,
  });

  assert.equal(result.status, "solved");
  assert.ok(Math.abs(result.chestMeasuredCm - 88) <= 0.001);
  assert.ok(Math.abs(result.shoulderMeasuredCm - 40) <= 0.01);
  assert.equal(result.bustWeight, 0.5);
  assert.equal(result.shoulderWeight, 0);
});
