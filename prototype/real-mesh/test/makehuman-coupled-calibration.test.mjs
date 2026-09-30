import assert from "node:assert/strict";
import test from "node:test";

import {
  refineRendererWeightBracket,
  scanRendererWeightBrackets,
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

test("exact coarse hit prefers the smallest absolute renderer weight", () => {
  const result = solveRendererTargetByBrackets({
    evaluateWeight: measured((weight) =>
      Math.abs(weight) === 0.5 ? 88 : 90
    ),
    targetValue: 88,
    sampleCount: 5,
    tolerance: 0.001,
  });

  assert.equal(result.status, "solved");
  assert.equal(result.source, "coarse-exact-hit");
  assert.equal(result.best.weight, -0.5);
});
