import {
  MAKEHUMAN_CHEST_SEARCH_POLICY,
} from "./chest-reference-plane.mjs";

export const CHEST_REFERENCE_SWEEP_CONTRACT =
  "scc-chest-reference-sweep-audit-v0";

export function evenlySpacedWeights(sampleCount) {
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new TypeError("sampleCount must be an integer >= 2");
  }

  return Array.from({length: sampleCount}, (_, index) =>
    -1 + (2 * index) / (sampleCount - 1)
  );
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

export function summarizeChestReferenceLandscape(reference) {
  if (!reference || reference.status !== "selected") {
    return {
      status: reference?.status ?? "unavailable",
      selectedHeightFraction: null,
      selectedPerimeterUnits: null,
      appendageMergeBoundaryFraction: null,
      topEligibleCandidates: [],
    };
  }

  const boundaryIndex =
    reference.appendageMergeBoundary?.boundarySampleIndex ?? null;
  const candidates = reference.samples
    .filter((sample) => sample.status === "candidate")
    .filter((sample) =>
      boundaryIndex === null ? true : sample.index < boundaryIndex
    )
    .filter((sample) => Number.isFinite(sample.perimeterUnits))
    .sort((a, b) => {
      const perimeterDelta = b.perimeterUnits - a.perimeterUnits;
      if (perimeterDelta !== 0) return perimeterDelta;
      return a.heightFraction - b.heightFraction;
    })
    .slice(0, 5)
    .map((sample) => ({
      index: sample.index,
      heightFraction: sample.heightFraction,
      perimeterUnits: sample.perimeterUnits,
      loopCount: sample.loopCount,
    }));

  return {
    status: "selected",
    selectedHeightFraction:
      reference.selected.heightFraction,
    selectedPerimeterUnits:
      reference.selected.perimeterUnits,
    appendageMergeBoundaryFraction:
      reference.appendageMergeBoundary
        ?.boundaryHeightFraction ?? null,
    appendageMergeBoundaryIndex: boundaryIndex,
    topEligibleCandidates: candidates,
  };
}

export function summarizeChestSweepSample({
  weight,
  evaluation,
}) {
  const reference = evaluation?.chest?.reference ?? null;
  const landscape = summarizeChestReferenceLandscape(reference);

  return {
    weight,
    status: evaluation?.status ?? "invalid-evaluation",
    measuredChestCm:
      finiteOrNull(evaluation?.measuredValue),
    shoulderResidualCm:
      finiteOrNull(evaluation?.shoulder?.residualCm),
    chestReferenceStatus: landscape.status,
    selectedChestHeightFraction:
      landscape.selectedHeightFraction,
    selectedChestPerimeterUnits:
      landscape.selectedPerimeterUnits,
    appendageMergeBoundaryFraction:
      landscape.appendageMergeBoundaryFraction,
    appendageMergeBoundaryIndex:
      landscape.appendageMergeBoundaryIndex ?? null,
    topEligibleCandidates:
      landscape.topEligibleCandidates,
  };
}

export function detectChestReferenceJumps(
  samples,
  {
    normalStepFraction =
      (
        MAKEHUMAN_CHEST_SEARCH_POLICY.upperBodyHeightFraction -
        MAKEHUMAN_CHEST_SEARCH_POLICY.lowerBodyHeightFraction
      ) /
      (MAKEHUMAN_CHEST_SEARCH_POLICY.sampleCount - 1),
    tolerance = 1e-9,
  } = {},
) {
  if (!Array.isArray(samples)) {
    throw new TypeError("samples must be an array");
  }
  if (!Number.isFinite(normalStepFraction) || normalStepFraction <= 0) {
    throw new TypeError(
      "normalStepFraction must be a finite positive number",
    );
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new TypeError(
      "tolerance must be a finite non-negative number",
    );
  }

  const jumps = [];

  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1];
    const right = samples[index];

    if (
      left?.status !== "measured" ||
      right?.status !== "measured" ||
      !Number.isFinite(left.selectedChestHeightFraction) ||
      !Number.isFinite(right.selectedChestHeightFraction)
    ) {
      continue;
    }

    const delta =
      right.selectedChestHeightFraction -
      left.selectedChestHeightFraction;

    if (
      Math.abs(delta) >
      normalStepFraction + tolerance
    ) {
      jumps.push({
        leftIndex: index - 1,
        rightIndex: index,
        leftWeight: left.weight,
        rightWeight: right.weight,
        leftMeasuredChestCm: left.measuredChestCm,
        rightMeasuredChestCm: right.measuredChestCm,
        leftHeightFraction:
          left.selectedChestHeightFraction,
        rightHeightFraction:
          right.selectedChestHeightFraction,
        deltaHeightFraction: delta,
        normalStepFraction,
        leftAppendageMergeBoundaryFraction:
          left.appendageMergeBoundaryFraction,
        rightAppendageMergeBoundaryFraction:
          right.appendageMergeBoundaryFraction,
        leftTopEligibleCandidates:
          left.topEligibleCandidates ?? [],
        rightTopEligibleCandidates:
          right.topEligibleCandidates ?? [],
      });
    }
  }

  return jumps;
}

export function jumpNeighborhoodIndices(
  sampleCount,
  jumps,
  radius = 1,
) {
  if (!Number.isInteger(sampleCount) || sampleCount < 0) {
    throw new TypeError(
      "sampleCount must be a non-negative integer",
    );
  }
  if (!Array.isArray(jumps)) {
    throw new TypeError("jumps must be an array");
  }
  if (!Number.isInteger(radius) || radius < 0) {
    throw new TypeError(
      "radius must be a non-negative integer",
    );
  }

  const indices = new Set();
  for (const jump of jumps) {
    for (
      let index = jump.leftIndex - radius;
      index <= jump.rightIndex + radius;
      index += 1
    ) {
      if (index >= 0 && index < sampleCount) {
        indices.add(index);
      }
    }
  }

  return [...indices].sort((a, b) => a - b);
}

export function detectUnderbustTransitions(
  samples,
  {
    fractionJumpThreshold = 0.01,
  } = {},
) {
  if (!Array.isArray(samples)) {
    throw new TypeError("samples must be an array");
  }
  if (
    !Number.isFinite(fractionJumpThreshold) ||
    fractionJumpThreshold <= 0
  ) {
    throw new TypeError(
      "fractionJumpThreshold must be a finite positive number",
    );
  }

  const transitions = [];

  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1];
    const right = samples[index];

    const leftStatus =
      left?.underbustReference?.status ?? "not-evaluated";
    const rightStatus =
      right?.underbustReference?.status ?? "not-evaluated";

    if (leftStatus !== rightStatus) {
      transitions.push({
        leftIndex: index - 1,
        rightIndex: index,
        kind: "status-change",
        leftStatus,
        rightStatus,
        leftWeight: left?.weight ?? null,
        rightWeight: right?.weight ?? null,
      });
      continue;
    }

    const leftFraction =
      left?.underbustReference?.selectedHeightFraction;
    const rightFraction =
      right?.underbustReference?.selectedHeightFraction;

    if (
      leftStatus === "selected" &&
      Number.isFinite(leftFraction) &&
      Number.isFinite(rightFraction)
    ) {
      const delta = rightFraction - leftFraction;
      if (Math.abs(delta) > fractionJumpThreshold) {
        transitions.push({
          leftIndex: index - 1,
          rightIndex: index,
          kind: "fraction-jump",
          leftStatus,
          rightStatus,
          leftWeight: left.weight,
          rightWeight: right.weight,
          leftHeightFraction: leftFraction,
          rightHeightFraction: rightFraction,
          deltaHeightFraction: delta,
        });
      }
    }
  }

  return transitions;
}
