import {
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "./body-cross-section.mjs";
import {
  measurePositionBoundsUnits,
} from "./makehuman-measurement.mjs";

export const CHEST_REFERENCE_PLANE_CONTRACT =
  "scc-chest-reference-plane-v0";

export const MAKEHUMAN_CHEST_SEARCH_POLICY = Object.freeze({
  status: "experimental",
  lowerBodyHeightFraction: 0.62,
  upperBodyHeightFraction: 0.78,
  sampleCount: 33,
  tieToleranceUnits: 1e-9,
  appendageMergeJumpRatio: 1.25,
});

function validateSearchPolicy({
  lowerBodyHeightFraction,
  upperBodyHeightFraction,
  sampleCount,
  tieToleranceUnits,
  appendageMergeJumpRatio,
}) {
  if (
    !Number.isFinite(lowerBodyHeightFraction) ||
    !Number.isFinite(upperBodyHeightFraction) ||
    lowerBodyHeightFraction < 0 ||
    upperBodyHeightFraction > 1 ||
    lowerBodyHeightFraction >= upperBodyHeightFraction
  ) {
    throw new RangeError(
      "chest search fractions must satisfy 0 <= lower < upper <= 1",
    );
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new TypeError("sampleCount must be an integer >= 2");
  }
  if (!Number.isFinite(tieToleranceUnits) || tieToleranceUnits < 0) {
    throw new TypeError(
      "tieToleranceUnits must be a finite non-negative number",
    );
  }
  if (
    !Number.isFinite(appendageMergeJumpRatio) ||
    appendageMergeJumpRatio <= 1
  ) {
    throw new TypeError(
      "appendageMergeJumpRatio must be a finite number > 1",
    );
  }
}

export function detectAppendageMergeBoundary(
  candidates,
  {
    jumpRatio =
      MAKEHUMAN_CHEST_SEARCH_POLICY.appendageMergeJumpRatio,
  } = {},
) {
  if (!Array.isArray(candidates)) {
    throw new TypeError("candidates must be an array");
  }
  if (!Number.isFinite(jumpRatio) || jumpRatio <= 1) {
    throw new TypeError("jumpRatio must be a finite number > 1");
  }

  const ordered = [...candidates].sort(
    (a, b) => a.index - b.index,
  );

  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];

    if (current.index !== previous.index + 1) {
      continue;
    }

    if (
      !Number.isFinite(previous.perimeterUnits) ||
      !Number.isFinite(current.perimeterUnits) ||
      previous.perimeterUnits <= 0 ||
      !Number.isInteger(previous.loopCount) ||
      !Number.isInteger(current.loopCount)
    ) {
      throw new TypeError(
        "candidate perimeterUnits and loopCount must be valid",
      );
    }

    const loopLoss = previous.loopCount - current.loopCount;
    const perimeterRatio =
      current.perimeterUnits / previous.perimeterUnits;

    if (loopLoss > 0 && perimeterRatio >= jumpRatio) {
      return {
        lowerSampleIndex: previous.index,
        boundarySampleIndex: current.index,
        lowerHeightFraction: previous.heightFraction,
        boundaryHeightFraction: current.heightFraction,
        previousLoopCount: previous.loopCount,
        boundaryLoopCount: current.loopCount,
        loopLoss,
        previousPerimeterUnits: previous.perimeterUnits,
        boundaryPerimeterUnits: current.perimeterUnits,
        perimeterRatio,
        jumpRatio,
      };
    }
  }

  return null;
}

function summarizeSample({
  index,
  heightFraction,
  planeY,
  crossSection,
  selectedLoop = null,
  status,
}) {
  return {
    index,
    heightFraction,
    planeY,
    status,
    perimeterUnits: selectedLoop?.perimeterUnits ?? null,
    loopCount: crossSection.loops.length,
    openChainCount: crossSection.openChains.length,
    branchNodeCount: crossSection.branchNodeCount,
    coplanarTriangleCount: crossSection.coplanarTriangleCount,
    selectedLoopCentroid: selectedLoop?.centroid ?? null,
  };
}

export function findChestReferencePlane({
  positions,
  triangles,
  bodyVertexIndices,
  lowerBodyHeightFraction =
    MAKEHUMAN_CHEST_SEARCH_POLICY.lowerBodyHeightFraction,
  upperBodyHeightFraction =
    MAKEHUMAN_CHEST_SEARCH_POLICY.upperBodyHeightFraction,
  sampleCount = MAKEHUMAN_CHEST_SEARCH_POLICY.sampleCount,
  tieToleranceUnits =
    MAKEHUMAN_CHEST_SEARCH_POLICY.tieToleranceUnits,
  appendageMergeJumpRatio =
    MAKEHUMAN_CHEST_SEARCH_POLICY.appendageMergeJumpRatio,
  center = null,
  crossSectionOptions = {},
}) {
  validateSearchPolicy({
    lowerBodyHeightFraction,
    upperBodyHeightFraction,
    sampleCount,
    tieToleranceUnits,
    appendageMergeJumpRatio,
  });

  const bounds = measurePositionBoundsUnits(
    positions,
    bodyVertexIndices,
  );
  if (bounds.height <= 0) {
    throw new TypeError("body surface must have positive height");
  }

  const bodyCenter = center ?? {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  if (
    !Number.isFinite(bodyCenter.x) ||
    !Number.isFinite(bodyCenter.z)
  ) {
    throw new TypeError("center must contain finite x and z values");
  }

  const samples = [];
  const candidates = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = index / (sampleCount - 1);
    const heightFraction =
      lowerBodyHeightFraction +
      (upperBodyHeightFraction - lowerBodyHeightFraction) * ratio;
    const planeY = bounds.minY + bounds.height * heightFraction;

    const crossSection = measureHorizontalSurfaceLoopsUnits(
      positions,
      triangles,
      planeY,
      crossSectionOptions,
    );

    if (crossSection.openChains.length > 0) {
      samples.push(summarizeSample({
        index,
        heightFraction,
        planeY,
        crossSection,
        status: "open-cross-section",
      }));
      continue;
    }

    if (crossSection.branchNodeCount > 0) {
      samples.push(summarizeSample({
        index,
        heightFraction,
        planeY,
        crossSection,
        status: "non-manifold-cross-section",
      }));
      continue;
    }

    if (crossSection.loops.length === 0) {
      samples.push(summarizeSample({
        index,
        heightFraction,
        planeY,
        crossSection,
        status: "no-loop",
      }));
      continue;
    }

    const selectedLoop = selectCentralSurfaceLoop(
      crossSection.loops,
      bodyCenter,
    );
    const candidate = {
      index,
      heightFraction,
      planeY,
      perimeterUnits: selectedLoop.perimeterUnits,
      loopCount: crossSection.loops.length,
      selectedLoop,
    };
    candidates.push(candidate);
    samples.push(summarizeSample({
      ...candidate,
      crossSection,
      status: "candidate",
    }));
  }

  const appendageMergeBoundary =
    detectAppendageMergeBoundary(candidates, {
      jumpRatio: appendageMergeJumpRatio,
    });

  const eligibleCandidates = appendageMergeBoundary
    ? candidates.filter(
        (candidate) =>
          candidate.index <
          appendageMergeBoundary.boundarySampleIndex,
      )
    : candidates;

  if (appendageMergeBoundary) {
    for (const sample of samples) {
      if (
        sample.status === "candidate" &&
        sample.index >=
          appendageMergeBoundary.boundarySampleIndex
      ) {
        sample.status = "excluded-above-appendage-merge";
      }
    }
  }

  if (eligibleCandidates.length === 0) {
    return {
      contract: CHEST_REFERENCE_PLANE_CONTRACT,
      status: "no-valid-slice",
      experimental: true,
      bodyCenter,
      bodyBounds: bounds,
      appendageMergeBoundary,
      searchBand: {
        lowerBodyHeightFraction,
        upperBodyHeightFraction,
        sampleCount,
        appendageMergeJumpRatio,
      },
      selected: null,
      samples,
    };
  }

  const midpoint =
    (lowerBodyHeightFraction + upperBodyHeightFraction) / 2;

  const ranked = [...eligibleCandidates].sort((a, b) => {
    const perimeterDelta = b.perimeterUnits - a.perimeterUnits;
    if (Math.abs(perimeterDelta) > tieToleranceUnits) {
      return perimeterDelta;
    }

    const aMidDistance = Math.abs(a.heightFraction - midpoint);
    const bMidDistance = Math.abs(b.heightFraction - midpoint);
    if (aMidDistance !== bMidDistance) {
      return aMidDistance - bMidDistance;
    }

    return a.heightFraction - b.heightFraction;
  });

  const selected = ranked[0];

  return {
    contract: CHEST_REFERENCE_PLANE_CONTRACT,
    status: "selected",
    experimental: true,
    bodyCenter,
    bodyBounds: bounds,
    appendageMergeBoundary,
    searchBand: {
      lowerBodyHeightFraction,
      upperBodyHeightFraction,
      sampleCount,
      appendageMergeJumpRatio,
    },
    selected: {
      sampleIndex: selected.index,
      heightFraction: selected.heightFraction,
      planeY: selected.planeY,
      perimeterUnits: selected.perimeterUnits,
      centroid: selected.selectedLoop.centroid,
    },
    samples,
  };
}

export function measureChestCircumferenceCm({
  positions,
  triangles,
  bodyVertexIndices,
  canonicalHeightCm,
  ...finderOptions
}) {
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError(
      "canonicalHeightCm must be a finite positive number",
    );
  }

  const reference = findChestReferencePlane({
    positions,
    triangles,
    bodyVertexIndices,
    ...finderOptions,
  });

  if (reference.status !== "selected") {
    return {
      contract: CHEST_REFERENCE_PLANE_CONTRACT,
      status: reference.status,
      experimental: true,
      circumferenceCm: null,
      reference,
    };
  }

  const cmPerUnit = canonicalHeightCm / reference.bodyBounds.height;

  return {
    contract: CHEST_REFERENCE_PLANE_CONTRACT,
    status: "measured",
    experimental: true,
    circumferenceCm:
      reference.selected.perimeterUnits * cmPerUnit,
    cmPerUnit,
    reference,
  };
}
