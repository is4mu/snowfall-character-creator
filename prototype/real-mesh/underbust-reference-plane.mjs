import {
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "./body-cross-section.mjs";
import {
  measurePositionBoundsUnits,
  measurePositionArrayHeightUnits,
} from "./makehuman-measurement.mjs";

export const UNDERBUST_REFERENCE_PLANE_CONTRACT =
  "scc-underbust-reference-plane-v0";

export const UNDERBUST_REFERENCE_POLICY = Object.freeze({
  status: "experimental",
  maxBelowChestFraction: 0.12,
  minBelowChestFraction: 0.01,
  sampleCount: 29,
  minProminenceHeightFraction: 0.002,
  minPeakSeparationHeightFraction: 0.01,
  maxPeakSeparationHeightFraction: 0.06,
  tieToleranceUnits: 1e-9,
});

function validatePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a finite positive number`);
  }
}

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

function validatePolicy({
  maxBelowChestFraction,
  minBelowChestFraction,
  sampleCount,
  minProminenceHeightFraction,
  minPeakSeparationHeightFraction,
  maxPeakSeparationHeightFraction,
  tieToleranceUnits,
}) {
  if (
    !Number.isFinite(maxBelowChestFraction) ||
    !Number.isFinite(minBelowChestFraction) ||
    minBelowChestFraction < 0 ||
    maxBelowChestFraction <= minBelowChestFraction
  ) {
    throw new RangeError(
      "underbust search offsets must satisfy 0 <= min < max",
    );
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 3) {
    throw new TypeError("sampleCount must be an integer >= 3");
  }
  if (
    !Number.isFinite(minProminenceHeightFraction) ||
    minProminenceHeightFraction < 0
  ) {
    throw new TypeError(
      "minProminenceHeightFraction must be finite and non-negative",
    );
  }
  if (
    !Number.isFinite(minPeakSeparationHeightFraction) ||
    !Number.isFinite(maxPeakSeparationHeightFraction) ||
    minPeakSeparationHeightFraction < 0 ||
    maxPeakSeparationHeightFraction <
      minPeakSeparationHeightFraction
  ) {
    throw new RangeError(
      "peak separation fractions must satisfy 0 <= min <= max",
    );
  }
  if (!Number.isFinite(tieToleranceUnits) || tieToleranceUnits < 0) {
    throw new TypeError(
      "tieToleranceUnits must be finite and non-negative",
    );
  }
}

function directionalSurfaceCoordinateUnits(loop, direction) {
  let maximum = -Infinity;
  for (const point of loop.points) {
    const projected = point.x * direction.x + point.z * direction.z;
    maximum = Math.max(maximum, projected);
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
    directionalSurfaceUnits,
    loopCount: crossSection.loops.length,
    openChainCount: crossSection.openChains.length,
    branchNodeCount: crossSection.branchNodeCount,
    coplanarTriangleCount: crossSection.coplanarTriangleCount,
    selectedLoopCentroid: selectedLoop?.centroid ?? null,
  };
}

export function detectUnderbustProfileCandidate(
  samples,
  rawHeightUnits,
  {
    minProminenceHeightFraction =
      UNDERBUST_REFERENCE_POLICY.minProminenceHeightFraction,
    minPeakSeparationHeightFraction =
      UNDERBUST_REFERENCE_POLICY.minPeakSeparationHeightFraction,
    maxPeakSeparationHeightFraction =
      UNDERBUST_REFERENCE_POLICY.maxPeakSeparationHeightFraction,
    tieToleranceUnits =
      UNDERBUST_REFERENCE_POLICY.tieToleranceUnits,
  } = {},
) {
  if (!Array.isArray(samples)) {
    throw new TypeError("samples must be an array");
  }
  validatePositive(rawHeightUnits, "rawHeightUnits");
  validatePolicy({
    maxBelowChestFraction: 1,
    minBelowChestFraction: 0,
    sampleCount: Math.max(3, samples.length),
    minProminenceHeightFraction,
    minPeakSeparationHeightFraction,
    maxPeakSeparationHeightFraction,
    tieToleranceUnits,
  });

  const ordered = [...samples].sort((a, b) => a.index - b.index);
  const candidates = [];

  for (let i = 1; i < ordered.length - 1; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    const next = ordered[i + 1];

    if (
      previous.status !== "measured" ||
      current.status !== "measured" ||
      next.status !== "measured" ||
      previous.index + 1 !== current.index ||
      current.index + 1 !== next.index
    ) {
      continue;
    }

    const currentValue = current.directionalSurfaceUnits;
    if (
      !Number.isFinite(previous.directionalSurfaceUnits) ||
      !Number.isFinite(currentValue) ||
      !Number.isFinite(next.directionalSurfaceUnits)
    ) {
      throw new TypeError(
        "measured samples must contain finite directionalSurfaceUnits",
      );
    }

    const isLocalMinimum =
      currentValue < previous.directionalSurfaceUnits - tieToleranceUnits &&
      currentValue < next.directionalSurfaceUnits - tieToleranceUnits;
    if (!isLocalMinimum) continue;

    let peak = null;
    for (let j = i + 1; j < ordered.length; j += 1) {
      const candidatePeak = ordered[j];
      if (
        candidatePeak.status !== "measured" ||
        candidatePeak.index !== ordered[j - 1].index + 1
      ) {
        break;
      }

      const separation =
        candidatePeak.heightFraction - current.heightFraction;
      if (separation > maxPeakSeparationHeightFraction) break;
      if (separation < minPeakSeparationHeightFraction) continue;

      if (
        !Number.isFinite(candidatePeak.directionalSurfaceUnits)
      ) {
        throw new TypeError(
          "measured samples must contain finite directionalSurfaceUnits",
        );
      }

      if (
        !peak ||
        candidatePeak.directionalSurfaceUnits >
          peak.directionalSurfaceUnits + tieToleranceUnits
      ) {
        peak = candidatePeak;
      }
    }

    if (!peak) {
      candidates.push({
        sample: current,
        peak: null,
        prominenceUnits: null,
        prominenceHeightFraction: null,
        peakSeparationHeightFraction: null,
        qualifies: false,
        reason: "no-eligible-following-peak",
      });
      continue;
    }

    const prominenceUnits =
      peak.directionalSurfaceUnits - currentValue;
    const prominenceHeightFraction =
      prominenceUnits / rawHeightUnits;
    const peakSeparationHeightFraction =
      peak.heightFraction - current.heightFraction;
    const qualifies =
      prominenceHeightFraction + Number.EPSILON >=
      minProminenceHeightFraction;

    candidates.push({
      sample: current,
      peak,
      prominenceUnits,
      prominenceHeightFraction,
      peakSeparationHeightFraction,
      qualifies,
      reason: qualifies
        ? "qualified"
        : "insufficient-prominence",
    });
  }

  const qualified = candidates.filter(
    (candidate) => candidate.qualifies,
  );
  const selected =
    qualified.length > 0
      ? qualified[qualified.length - 1]
      : null;

  return {candidates, selected};
}

export function findUnderbustReferencePlane({
  positions,
  triangles,
  bodyVertexIndices,
  chestReferenceHeightFraction,
  surfaceDirection,
  maxBelowChestFraction =
    UNDERBUST_REFERENCE_POLICY.maxBelowChestFraction,
  minBelowChestFraction =
    UNDERBUST_REFERENCE_POLICY.minBelowChestFraction,
  sampleCount = UNDERBUST_REFERENCE_POLICY.sampleCount,
  minProminenceHeightFraction =
    UNDERBUST_REFERENCE_POLICY.minProminenceHeightFraction,
  minPeakSeparationHeightFraction =
    UNDERBUST_REFERENCE_POLICY.minPeakSeparationHeightFraction,
  maxPeakSeparationHeightFraction =
    UNDERBUST_REFERENCE_POLICY.maxPeakSeparationHeightFraction,
  tieToleranceUnits =
    UNDERBUST_REFERENCE_POLICY.tieToleranceUnits,
  center = null,
  crossSectionOptions = {},
}) {
  if (
    !Number.isFinite(chestReferenceHeightFraction) ||
    chestReferenceHeightFraction <= 0 ||
    chestReferenceHeightFraction > 1
  ) {
    throw new RangeError(
      "chestReferenceHeightFraction must satisfy 0 < value <= 1",
    );
  }

  validatePolicy({
    maxBelowChestFraction,
    minBelowChestFraction,
    sampleCount,
    minProminenceHeightFraction,
    minPeakSeparationHeightFraction,
    maxPeakSeparationHeightFraction,
    tieToleranceUnits,
  });

  const direction = normalizeHorizontalDirection(surfaceDirection);
  const bounds = measurePositionBoundsUnits(
    positions,
    bodyVertexIndices,
  );
  const rawHeightUnits = measurePositionArrayHeightUnits(
    positions,
    bodyVertexIndices,
  );

  const lowerBodyHeightFraction = Math.max(
    0,
    chestReferenceHeightFraction - maxBelowChestFraction,
  );
  const upperBodyHeightFraction =
    chestReferenceHeightFraction - minBelowChestFraction;
  if (
    upperBodyHeightFraction <= lowerBodyHeightFraction ||
    upperBodyHeightFraction <= 0
  ) {
    throw new RangeError(
      "underbust search band is empty below the chest reference",
    );
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
    samples.push(summarizeSample({
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
    }));
  }

  const measuredCount = samples.filter(
    (sample) => sample.status === "measured",
  ).length;

  if (measuredCount === 0) {
    return {
      contract: UNDERBUST_REFERENCE_PLANE_CONTRACT,
      status: "no-valid-slice",
      experimental: true,
      surfaceDirection: direction,
      bodyBounds: bounds,
      bodyCenter,
      searchBand: {
        lowerBodyHeightFraction,
        upperBodyHeightFraction,
        sampleCount,
      },
      policy: {
        minProminenceHeightFraction,
        minPeakSeparationHeightFraction,
        maxPeakSeparationHeightFraction,
      },
      selected: null,
      candidates: [],
      samples,
    };
  }

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

  if (!detection.selected) {
    return {
      contract: UNDERBUST_REFERENCE_PLANE_CONTRACT,
      status: "no-stable-landmark",
      experimental: true,
      surfaceDirection: direction,
      bodyBounds: bounds,
      bodyCenter,
      searchBand: {
        lowerBodyHeightFraction,
        upperBodyHeightFraction,
        sampleCount,
      },
      policy: {
        minProminenceHeightFraction,
        minPeakSeparationHeightFraction,
        maxPeakSeparationHeightFraction,
      },
      selected: null,
      candidates: detection.candidates,
      samples,
    };
  }

  const selected = detection.selected;
  return {
    contract: UNDERBUST_REFERENCE_PLANE_CONTRACT,
    status: "selected",
    experimental: true,
    surfaceDirection: direction,
    bodyBounds: bounds,
    bodyCenter,
    searchBand: {
      lowerBodyHeightFraction,
      upperBodyHeightFraction,
      sampleCount,
    },
    policy: {
      minProminenceHeightFraction,
      minPeakSeparationHeightFraction,
      maxPeakSeparationHeightFraction,
    },
    selected: {
      index: selected.sample.index,
      heightFraction: selected.sample.heightFraction,
      planeY: selected.sample.planeY,
      directionalSurfaceUnits:
        selected.sample.directionalSurfaceUnits,
      peakIndex: selected.peak.index,
      peakHeightFraction: selected.peak.heightFraction,
      peakDirectionalSurfaceUnits:
        selected.peak.directionalSurfaceUnits,
      prominenceUnits: selected.prominenceUnits,
      prominenceHeightFraction:
        selected.prominenceHeightFraction,
      peakSeparationHeightFraction:
        selected.peakSeparationHeightFraction,
    },
    candidates: detection.candidates,
    samples,
  };
}
