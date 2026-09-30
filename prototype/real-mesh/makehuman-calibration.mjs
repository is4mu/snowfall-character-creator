import { applyBidirectionalTarget } from "./makehuman-geometry.mjs";
import { measureShoulderBreadthCm } from "./makehuman-measurement.mjs";

export const SHOULDER_CALIBRATION_CONTRACT =
  "scc-makehuman-shoulder-calibration-v0";

function evaluate({
  basePositions,
  decreaseDeltas,
  increaseDeltas,
  weight,
  canonicalHeightCm,
  heightVertexIndices,
}) {
  const positions = applyBidirectionalTarget(
    basePositions,
    decreaseDeltas,
    increaseDeltas,
    weight,
  );

  return {
    weight,
    positions,
    measuredCm: measureShoulderBreadthCm(
      positions,
      canonicalHeightCm,
      undefined,
      heightVertexIndices,
    ),
  };
}

export function solveShoulderBreadthTarget({
  basePositions,
  decreaseDeltas,
  increaseDeltas,
  canonicalHeightCm,
  targetShoulderBreadthCm,
  heightVertexIndices = null,
  toleranceCm = 0.01,
  maxIterations = 48,
}) {
  if (
    !Number.isFinite(targetShoulderBreadthCm) ||
    targetShoulderBreadthCm <= 0
  ) {
    throw new TypeError(
      "targetShoulderBreadthCm must be a finite positive number",
    );
  }
  if (!Number.isFinite(toleranceCm) || toleranceCm <= 0) {
    throw new TypeError("toleranceCm must be a finite positive number");
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new TypeError("maxIterations must be a positive integer");
  }

  let low = evaluate({
    basePositions,
    decreaseDeltas,
    increaseDeltas,
    weight: -1,
    canonicalHeightCm,
    heightVertexIndices,
  });
  let high = evaluate({
    basePositions,
    decreaseDeltas,
    increaseDeltas,
    weight: 1,
    canonicalHeightCm,
    heightVertexIndices,
  });

  const increasing = high.measuredCm >= low.measuredCm;
  const minEndpoint = increasing ? low : high;
  const maxEndpoint = increasing ? high : low;

  if (targetShoulderBreadthCm < minEndpoint.measuredCm) {
    return {
      contract: SHOULDER_CALIBRATION_CONTRACT,
      status: "out-of-range",
      rendererLocal: true,
      experimental: true,
      targetCm: targetShoulderBreadthCm,
      minReachableCm: minEndpoint.measuredCm,
      maxReachableCm: maxEndpoint.measuredCm,
      weight: minEndpoint.weight,
      measuredCm: minEndpoint.measuredCm,
      residualCm: minEndpoint.measuredCm - targetShoulderBreadthCm,
      iterations: 0,
      positions: minEndpoint.positions,
    };
  }

  if (targetShoulderBreadthCm > maxEndpoint.measuredCm) {
    return {
      contract: SHOULDER_CALIBRATION_CONTRACT,
      status: "out-of-range",
      rendererLocal: true,
      experimental: true,
      targetCm: targetShoulderBreadthCm,
      minReachableCm: minEndpoint.measuredCm,
      maxReachableCm: maxEndpoint.measuredCm,
      weight: maxEndpoint.weight,
      measuredCm: maxEndpoint.measuredCm,
      residualCm: maxEndpoint.measuredCm - targetShoulderBreadthCm,
      iterations: 0,
      positions: maxEndpoint.positions,
    };
  }

  let leftWeight = -1;
  let rightWeight = 1;
  let best = null;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const weight = (leftWeight + rightWeight) / 2;
    const current = evaluate({
      basePositions,
      decreaseDeltas,
      increaseDeltas,
      weight,
      canonicalHeightCm,
    });
    const residualCm = current.measuredCm - targetShoulderBreadthCm;

    if (
      best === null ||
      Math.abs(residualCm) < Math.abs(best.residualCm)
    ) {
      best = {
        ...current,
        residualCm,
        iterations: iteration,
      };
    }

    if (Math.abs(residualCm) <= toleranceCm) {
      break;
    }

    const currentBelowTarget =
      current.measuredCm < targetShoulderBreadthCm;

    if (increasing === currentBelowTarget) {
      leftWeight = weight;
    } else {
      rightWeight = weight;
    }
  }

  return {
    contract: SHOULDER_CALIBRATION_CONTRACT,
    status:
      Math.abs(best.residualCm) <= toleranceCm
        ? "solved"
        : "max-iterations",
    rendererLocal: true,
    experimental: true,
    targetCm: targetShoulderBreadthCm,
    minReachableCm: minEndpoint.measuredCm,
    maxReachableCm: maxEndpoint.measuredCm,
    weight: best.weight,
    measuredCm: best.measuredCm,
    residualCm: best.residualCm,
    iterations: best.iterations,
    positions: best.positions,
  };
}
