import {
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "./body-cross-section.mjs";
import {
  detectAppendageMergeBoundary,
  MAKEHUMAN_CHEST_SEARCH_POLICY,
} from "./chest-reference-plane.mjs";
import {
  detectUnderbustProfileCandidate,
  UNDERBUST_REFERENCE_POLICY,
} from "./underbust-reference-plane.mjs";
import {
  measurePositionArrayHeightUnits,
  measurePositionBoundsUnits,
} from "./makehuman-measurement.mjs";

export const THORAX_REFERENCE_LANDMARKS_CONTRACT =
  "scc-thorax-reference-landmarks-v0";

export const THORAX_REFERENCE_POLICY = Object.freeze({
  status: "experimental",
  lowerBodyHeightFraction:
    MAKEHUMAN_CHEST_SEARCH_POLICY.lowerBodyHeightFraction,
  upperBodyHeightFraction:
    MAKEHUMAN_CHEST_SEARCH_POLICY.upperBodyHeightFraction,
  sampleCount:
    MAKEHUMAN_CHEST_SEARCH_POLICY.sampleCount,
  appendageMergeJumpRatio:
    MAKEHUMAN_CHEST_SEARCH_POLICY.appendageMergeJumpRatio,
  minProminenceHeightFraction:
    UNDERBUST_REFERENCE_POLICY.minProminenceHeightFraction,
  minPeakSeparationHeightFraction:
    UNDERBUST_REFERENCE_POLICY.minPeakSeparationHeightFraction,
  maxPeakSeparationHeightFraction:
    UNDERBUST_REFERENCE_POLICY.maxPeakSeparationHeightFraction,
  tieToleranceUnits:
    UNDERBUST_REFERENCE_POLICY.tieToleranceUnits,
});

function normalizeHorizontalDirection(surfaceDirection) {
  const x = surfaceDirection?.x;
  const z = surfaceDirection?.z;
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new TypeError(
      "surfaceDirection must contain finite x and z values",
    );
  }
  const length = Math.hypot(x, z);
  if (length <= 0) {
    throw new TypeError(
      "surfaceDirection must have non-zero horizontal length",
    );
  }
  return {x: x / length, z: z / length};
}

function directionalSurfaceCoordinateUnits(loop, direction) {
  let maximum = -Infinity;
  for (const point of loop.points) {
    maximum = Math.max(
      maximum,
      point.x * direction.x + point.z * direction.z,
    );
  }
  return maximum;
}

function summarizeSample({
  index,
  heightFraction,
  planeY,
  crossSection,
  selectedLoop = null,
  directionalSurfaceUnits = null,
  status,
}) {
  return {
    index,
    heightFraction,
    planeY,
    status,
    perimeterUnits: selectedLoop?.perimeterUnits ?? null,
    directionalSurfaceUnits,
    loopCount: crossSection.loops.length,
    openChainCount: crossSection.openChains.length,
    branchNodeCount: crossSection.branchNodeCount,
    coplanarTriangleCount: crossSection.coplanarTriangleCount,
    selectedLoopCentroid: selectedLoop?.centroid ?? null,
  };
}

function selectGreatestAnteriorSample(
  samples,
  tieToleranceUnits,
) {
  const measured = samples.filter(
    (sample) =>
      sample.status === "measured" &&
      Number.isFinite(sample.directionalSurfaceUnits),
  );
  if (measured.length === 0) return null;

  const midpoint =
    (measured[0].heightFraction +
      measured[measured.length - 1].heightFraction) / 2;

  return [...measured].sort((a, b) => {
    const anteriorDelta =
      b.directionalSurfaceUnits -
      a.directionalSurfaceUnits;
    if (Math.abs(anteriorDelta) > tieToleranceUnits) {
      return anteriorDelta;
    }

    const aMid = Math.abs(a.heightFraction - midpoint);
    const bMid = Math.abs(b.heightFraction - midpoint);
    if (aMid !== bMid) return aMid - bMid;
    return a.heightFraction - b.heightFraction;
  })[0];
}

function selectUnderbustForChestPeak(
  pairCandidates,
  chestSampleIndex,
) {
  const matching = pairCandidates
    .filter(
      (candidate) =>
        candidate.qualifies &&
        candidate.peak?.index === chestSampleIndex,
    )
    .sort((a, b) => {
      const prominenceDelta =
        b.prominenceHeightFraction -
        a.prominenceHeightFraction;
      if (Math.abs(prominenceDelta) > Number.EPSILON) {
        return prominenceDelta;
      }
      return b.sample.heightFraction -
        a.sample.heightFraction;
    });

  return matching[0] ?? null;
}

export function selectThoraxProminencePair(
  samples,
  rawHeightUnits,
  {
    minProminenceHeightFraction =
      THORAX_REFERENCE_POLICY.minProminenceHeightFraction,
    minPeakSeparationHeightFraction =
      THORAX_REFERENCE_POLICY.minPeakSeparationHeightFraction,
    maxPeakSeparationHeightFraction =
      THORAX_REFERENCE_POLICY.maxPeakSeparationHeightFraction,
    tieToleranceUnits =
      THORAX_REFERENCE_POLICY.tieToleranceUnits,
  } = {},
) {
  const detection = detectUnderbustProfileCandidate(
    samples,
    rawHeightUnits,
    {
      minProminenceHeightFraction,
      minPeakSeparationHeightFraction,
      maxPeakSeparationHeightFraction,
      tieToleranceUnits,
    },
  );

  const qualified = detection.candidates.filter(
    (candidate) =>
      candidate.qualifies &&
      candidate.peak &&
      Number.isFinite(
        candidate.peak.directionalSurfaceUnits,
      ),
  );

  const ranked = [...qualified].sort((a, b) => {
    const peakDelta =
      b.peak.directionalSurfaceUnits -
      a.peak.directionalSurfaceUnits;
    if (Math.abs(peakDelta) > tieToleranceUnits) {
      return peakDelta;
    }

    const prominenceDelta =
      b.prominenceHeightFraction -
      a.prominenceHeightFraction;
    if (Math.abs(prominenceDelta) > Number.EPSILON) {
      return prominenceDelta;
    }

    return b.sample.heightFraction -
      a.sample.heightFraction;
  });

  return {
    candidates: detection.candidates,
    selected: ranked[0] ?? null,
  };
}

export function findThoraxReferenceLandmarks({
  positions,
  triangles,
  bodyVertexIndices,
  surfaceDirection,
  lowerBodyHeightFraction =
    THORAX_REFERENCE_POLICY.lowerBodyHeightFraction,
  upperBodyHeightFraction =
    THORAX_REFERENCE_POLICY.upperBodyHeightFraction,
  sampleCount =
    THORAX_REFERENCE_POLICY.sampleCount,
  appendageMergeJumpRatio =
    THORAX_REFERENCE_POLICY.appendageMergeJumpRatio,
  minProminenceHeightFraction =
    THORAX_REFERENCE_POLICY.minProminenceHeightFraction,
  minPeakSeparationHeightFraction =
    THORAX_REFERENCE_POLICY.minPeakSeparationHeightFraction,
  maxPeakSeparationHeightFraction =
    THORAX_REFERENCE_POLICY.maxPeakSeparationHeightFraction,
  tieToleranceUnits =
    THORAX_REFERENCE_POLICY.tieToleranceUnits,
  center = null,
  crossSectionOptions = {},
}) {
  if (
    !Number.isFinite(lowerBodyHeightFraction) ||
    !Number.isFinite(upperBodyHeightFraction) ||
    lowerBodyHeightFraction < 0 ||
    upperBodyHeightFraction > 1 ||
    lowerBodyHeightFraction >= upperBodyHeightFraction
  ) {
    throw new RangeError(
      "thorax search fractions must satisfy 0 <= lower < upper <= 1",
    );
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 3) {
    throw new TypeError("sampleCount must be an integer >= 3");
  }

  const direction =
    normalizeHorizontalDirection(surfaceDirection);
  const bounds = measurePositionBoundsUnits(
    positions,
    bodyVertexIndices,
  );
  const rawHeightUnits = measurePositionArrayHeightUnits(
    positions,
    bodyVertexIndices,
  );
  if (rawHeightUnits <= 0) {
    throw new TypeError("body surface must have positive height");
  }

  const bodyCenter = center ?? {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };

  const samples = [];
  const candidates = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const ratio = index / (sampleCount - 1);
    const heightFraction =
      lowerBodyHeightFraction +
      (upperBodyHeightFraction -
        lowerBodyHeightFraction) * ratio;
    const planeY =
      bounds.minY + bounds.height * heightFraction;
    const crossSection =
      measureHorizontalSurfaceLoopsUnits(
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
    const sample = summarizeSample({
      index,
      heightFraction,
      planeY,
      crossSection,
      selectedLoop,
      directionalSurfaceUnits:
        directionalSurfaceCoordinateUnits(
          selectedLoop,
          direction,
        ),
      status: "measured",
    });
    samples.push(sample);
    candidates.push({
      index,
      heightFraction,
      planeY,
      perimeterUnits: selectedLoop.perimeterUnits,
      loopCount: crossSection.loops.length,
    });
  }

  const appendageMergeBoundary =
    detectAppendageMergeBoundary(candidates, {
      jumpRatio: appendageMergeJumpRatio,
    });

  if (appendageMergeBoundary) {
    for (const sample of samples) {
      if (
        sample.status === "measured" &&
        sample.index >=
          appendageMergeBoundary.boundarySampleIndex
      ) {
        sample.status =
          "excluded-above-appendage-merge";
      }
    }
  }

  const eligible = samples.filter(
    (sample) => sample.status === "measured",
  );

  if (eligible.length === 0) {
    return {
      contract: THORAX_REFERENCE_LANDMARKS_CONTRACT,
      status: "no-valid-slice",
      experimental: true,
      mode: null,
      surfaceDirection: direction,
      bodyCenter,
      bodyBounds: bounds,
      appendageMergeBoundary,
      chest: null,
      underbust: {
        status: "not-evaluated",
        selected: null,
      },
      pairCandidates: [],
      samples,
    };
  }

  const pairDetection = selectThoraxProminencePair(
    samples,
    rawHeightUnits,
    {
      minProminenceHeightFraction,
      minPeakSeparationHeightFraction,
      maxPeakSeparationHeightFraction,
      tieToleranceUnits,
    },
  );

  const chestSample = selectGreatestAnteriorSample(
    eligible,
    tieToleranceUnits,
  );

  if (!chestSample) {
    return {
      contract: THORAX_REFERENCE_LANDMARKS_CONTRACT,
      status: "no-valid-slice",
      experimental: true,
      mode: null,
      surfaceDirection: direction,
      bodyCenter,
      bodyBounds: bounds,
      appendageMergeBoundary,
      chest: null,
      underbust: {
        status: "not-evaluated",
        selected: null,
      },
      pairCandidates: pairDetection.candidates,
      samples,
    };
  }

  const pairedUnderbust =
    selectUnderbustForChestPeak(
      pairDetection.candidates,
      chestSample.index,
    );

  return {
    contract: THORAX_REFERENCE_LANDMARKS_CONTRACT,
    status: "selected",
    experimental: true,
    mode: pairedUnderbust
      ? "anterior-maximum-paired-underbust"
      : "anterior-maximum-structural-fallback",
    surfaceDirection: direction,
    bodyCenter,
    bodyBounds: bounds,
    appendageMergeBoundary,
    chest: {
      status: "selected",
      sampleIndex: chestSample.index,
      heightFraction: chestSample.heightFraction,
      planeY: chestSample.planeY,
      perimeterUnits: chestSample.perimeterUnits,
      directionalSurfaceUnits:
        chestSample.directionalSurfaceUnits,
    },
    underbust: pairedUnderbust
      ? {
          status: "selected",
          selected: {
            sampleIndex: pairedUnderbust.sample.index,
            heightFraction:
              pairedUnderbust.sample.heightFraction,
            planeY: pairedUnderbust.sample.planeY,
            perimeterUnits:
              pairedUnderbust.sample.perimeterUnits,
            directionalSurfaceUnits:
              pairedUnderbust.sample
                .directionalSurfaceUnits,
            prominenceUnits:
              pairedUnderbust.prominenceUnits,
            prominenceHeightFraction:
              pairedUnderbust
                .prominenceHeightFraction,
            peakSeparationHeightFraction:
              pairedUnderbust
                .peakSeparationHeightFraction,
          },
        }
      : {
          status: "no-stable-landmark",
          selected: null,
        },
    pairCandidates: pairDetection.candidates,
    samples,
  };
}
