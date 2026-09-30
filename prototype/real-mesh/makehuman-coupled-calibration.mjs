import {
  applyBidirectionalTarget,
} from "./makehuman-geometry.mjs";
import {
  solveShoulderBreadthTarget,
} from "./makehuman-calibration.mjs";
import {
  measureChestCircumferenceCm,
} from "./chest-reference-plane.mjs";

export const COUPLED_CHEST_CALIBRATION_CONTRACT =
  "scc-makehuman-coupled-chest-calibration-v0";

function validateWeight(weight) {
  if (!Number.isFinite(weight) || weight < -1 || weight > 1) {
    throw new RangeError("renderer weight must be between -1 and 1");
  }
}

function validatePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a finite positive number`);
  }
}

function sampleWeights(sampleCount) {
  if (!Number.isInteger(sampleCount) || sampleCount < 3) {
    throw new TypeError("sampleCount must be an integer >= 3");
  }

  return Array.from({length: sampleCount}, (_, index) =>
    -1 + (2 * index) / (sampleCount - 1)
  );
}

function evaluateResidual(evaluateWeight, weight, targetValue) {
  const result = evaluateWeight(weight);
  if (
    !result ||
    result.status !== "measured" ||
    !Number.isFinite(result.measuredValue)
  ) {
    return {
      weight,
      status: result?.status ?? "invalid-evaluation",
      measuredValue: null,
      residual: null,
      evaluation: result ?? null,
    };
  }

  return {
    weight,
    status: "measured",
    measuredValue: result.measuredValue,
    residual: result.measuredValue - targetValue,
    evaluation: result,
  };
}

export function scanRendererWeightBrackets({
  evaluateWeight,
  targetValue,
  sampleCount = 17,
  tolerance = 0.01,
}) {
  if (typeof evaluateWeight !== "function") {
    throw new TypeError("evaluateWeight must be a function");
  }
  validatePositive(targetValue, "targetValue");
  validatePositive(tolerance, "tolerance");

  const samples = sampleWeights(sampleCount).map((weight) =>
    evaluateResidual(evaluateWeight, weight, targetValue)
  );

  const exactHits = samples.filter(
    (sample) =>
      sample.status === "measured" &&
      Math.abs(sample.residual) <= tolerance,
  );

  const brackets = [];
  for (let index = 1; index < samples.length; index += 1) {
    const a = samples[index - 1];
    const b = samples[index];

    if (a.status !== "measured" || b.status !== "measured") {
      continue;
    }

    if (Math.abs(a.residual) <= tolerance ||
        Math.abs(b.residual) <= tolerance) {
      continue;
    }

    if (a.residual * b.residual < 0) {
      brackets.push({lower: a, upper: b});
    }
  }

  const validValues = samples
    .filter((sample) => sample.status === "measured")
    .map((sample) => sample.measuredValue);

  return {
    samples,
    exactHits,
    brackets,
    measuredRange:
      validValues.length > 0
        ? {
            min: Math.min(...validValues),
            max: Math.max(...validValues),
          }
        : null,
  };
}

export function refineRendererWeightBracket({
  evaluateWeight,
  targetValue,
  lower,
  upper,
  tolerance = 0.01,
  weightTolerance = 1e-6,
  maxIterations = 48,
}) {
  if (typeof evaluateWeight !== "function") {
    throw new TypeError("evaluateWeight must be a function");
  }
  validatePositive(targetValue, "targetValue");
  validatePositive(tolerance, "tolerance");
  validatePositive(weightTolerance, "weightTolerance");
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new TypeError("maxIterations must be a positive integer");
  }

  let left = lower;
  let right = upper;

  if (
    left?.status !== "measured" ||
    right?.status !== "measured" ||
    !Number.isFinite(left.residual) ||
    !Number.isFinite(right.residual) ||
    left.residual * right.residual >= 0
  ) {
    throw new TypeError(
      "lower and upper must be measured samples with opposite residual signs",
    );
  }

  let best =
    Math.abs(left.residual) <= Math.abs(right.residual)
      ? left
      : right;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const weight = (left.weight + right.weight) / 2;
    const current = evaluateResidual(
      evaluateWeight,
      weight,
      targetValue,
    );

    if (current.status !== "measured") {
      return {
        status: "invalid-evaluation",
        iterations: iteration,
        best,
        invalid: current,
        bracket: {lower: left, upper: right},
      };
    }

    if (Math.abs(current.residual) < Math.abs(best.residual)) {
      best = current;
    }

    if (Math.abs(current.residual) <= tolerance) {
      return {
        status: "solved",
        iterations: iteration,
        best: current,
        bracket: {lower: left, upper: right},
      };
    }

    if (Math.abs(right.weight - left.weight) <= weightTolerance) {
      break;
    }

    if (left.residual * current.residual < 0) {
      right = current;
    } else if (current.residual * right.residual < 0) {
      left = current;
    } else {
      return {
        status: "discontinuous-bracket",
        iterations: iteration,
        best,
        bracket: {lower: left, upper: right},
      };
    }
  }

  return {
    status:
      Math.abs(best.residual) <= tolerance
        ? "solved"
        : "discontinuous-bracket",
    iterations: maxIterations,
    best,
    bracket: {lower: left, upper: right},
  };
}

export function solveRendererTargetByBrackets({
  evaluateWeight,
  targetValue,
  sampleCount = 17,
  tolerance = 0.01,
  weightTolerance = 1e-6,
  maxIterations = 48,
}) {
  const scan = scanRendererWeightBrackets({
    evaluateWeight,
    targetValue,
    sampleCount,
    tolerance,
  });

  if (scan.exactHits.length > 1) {
    return {
      status: "ambiguous-multiple-brackets",
      source: "multiple-coarse-exact-hits",
      best: null,
      scan,
      refinement: null,
    };
  }

  if (scan.exactHits.length === 1) {
    return {
      status: "solved",
      source: "coarse-exact-hit",
      best: scan.exactHits[0],
      scan,
      refinement: null,
    };
  }

  if (scan.brackets.length > 1) {
    return {
      status: "ambiguous-multiple-brackets",
      best: null,
      scan,
      refinement: null,
    };
  }

  if (scan.brackets.length === 0) {
    if (!scan.measuredRange) {
      return {
        status: "no-valid-evaluations",
        best: null,
        scan,
        refinement: null,
      };
    }

    const outside =
      targetValue < scan.measuredRange.min ||
      targetValue > scan.measuredRange.max;

    return {
      status: outside ? "out-of-range" : "no-bracket",
      best: null,
      scan,
      refinement: null,
    };
  }

  const refinement = refineRendererWeightBracket({
    evaluateWeight,
    targetValue,
    lower: scan.brackets[0].lower,
    upper: scan.brackets[0].upper,
    tolerance,
    weightTolerance,
    maxIterations,
  });

  return {
    status: refinement.status,
    source: "refined-bracket",
    best: refinement.best,
    scan,
    refinement,
  };
}

export function evaluateCoupledChestCandidate({
  priorPositions,
  bustDecreaseDeltas,
  bustIncreaseDeltas,
  bustWeight,
  shoulderDecreaseDeltas,
  shoulderIncreaseDeltas,
  canonicalHeightCm,
  targetShoulderBreadthCm,
  bodyTriangles,
  bodyVertexIndices,
  shoulderToleranceCm = 0.01,
  chestFinderOptions = {},
}) {
  validateWeight(bustWeight);
  validatePositive(canonicalHeightCm, "canonicalHeightCm");
  validatePositive(
    targetShoulderBreadthCm,
    "targetShoulderBreadthCm",
  );

  const bustPositions = applyBidirectionalTarget(
    priorPositions,
    bustDecreaseDeltas,
    bustIncreaseDeltas,
    bustWeight,
  );

  const shoulder = solveShoulderBreadthTarget({
    basePositions: bustPositions,
    decreaseDeltas: shoulderDecreaseDeltas,
    increaseDeltas: shoulderIncreaseDeltas,
    canonicalHeightCm,
    targetShoulderBreadthCm,
    heightVertexIndices: bodyVertexIndices,
    toleranceCm: shoulderToleranceCm,
  });

  if (shoulder.status !== "solved") {
    return {
      status: "shoulder-unsolved",
      rendererLocal: true,
      bustWeight,
      shoulder,
      measuredValue: null,
      positions: shoulder.positions ?? bustPositions,
    };
  }

  const chest = measureChestCircumferenceCm({
    positions: shoulder.positions,
    triangles: bodyTriangles,
    bodyVertexIndices,
    canonicalHeightCm,
    ...chestFinderOptions,
  });

  if (chest.status !== "measured") {
    return {
      status: "chest-unmeasured",
      rendererLocal: true,
      bustWeight,
      shoulder,
      chest,
      measuredValue: null,
      positions: shoulder.positions,
    };
  }

  return {
    status: "measured",
    rendererLocal: true,
    bustWeight,
    shoulder,
    chest,
    measuredValue: chest.circumferenceCm,
    positions: shoulder.positions,
  };
}

export function solveCoupledChestCircumference({
  priorPositions,
  bustDecreaseDeltas,
  bustIncreaseDeltas,
  shoulderDecreaseDeltas,
  shoulderIncreaseDeltas,
  canonicalHeightCm,
  targetShoulderBreadthCm,
  targetChestCircumferenceCm,
  bodyTriangles,
  bodyVertexIndices,
  sampleCount = 17,
  chestToleranceCm = 0.01,
  shoulderToleranceCm = 0.01,
  weightTolerance = 1e-6,
  maxIterations = 48,
  chestFinderOptions = {},
}) {
  validatePositive(
    targetChestCircumferenceCm,
    "targetChestCircumferenceCm",
  );

  const evaluateWeight = (bustWeight) =>
    evaluateCoupledChestCandidate({
      priorPositions,
      bustDecreaseDeltas,
      bustIncreaseDeltas,
      bustWeight,
      shoulderDecreaseDeltas,
      shoulderIncreaseDeltas,
      canonicalHeightCm,
      targetShoulderBreadthCm,
      bodyTriangles,
      bodyVertexIndices,
      shoulderToleranceCm,
      chestFinderOptions,
    });

  const solved = solveRendererTargetByBrackets({
    evaluateWeight,
    targetValue: targetChestCircumferenceCm,
    sampleCount,
    tolerance: chestToleranceCm,
    weightTolerance,
    maxIterations,
  });

  return {
    contract: COUPLED_CHEST_CALIBRATION_CONTRACT,
    experimental: true,
    rendererLocal: true,
    targetChestCircumferenceCm,
    targetShoulderBreadthCm,
    ...solved,
    positions: solved.best?.evaluation?.positions ?? null,
    bustWeight: solved.best?.weight ?? null,
    chestMeasuredCm: solved.best?.measuredValue ?? null,
    chestResidualCm: solved.best?.residual ?? null,
    shoulderWeight:
      solved.best?.evaluation?.shoulder?.weight ?? null,
    shoulderMeasuredCm:
      solved.best?.evaluation?.shoulder?.measuredCm ?? null,
    shoulderResidualCm:
      solved.best?.evaluation?.shoulder?.residualCm ?? null,
  };
}
