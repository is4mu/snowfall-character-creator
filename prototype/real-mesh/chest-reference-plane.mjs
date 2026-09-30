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
});

function validateSearchPolicy({
  lowerBodyHeightFraction,
  upperBodyHeightFraction,
  sampleCount,
  tieToleranceUnits,
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
  center = null,
  crossSectionOptions = {},
}) {
  validateSearchPolicy({
    lowerBodyHeightFraction,
    upperBodyHeightFraction,
    sampleCount,
    tieToleranceUnits,
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
      selectedLoop,
    };
    candidates.push(candidate);
    samples.push(summarizeSample({
      ...candidate,
      crossSection,
      status: "candidate",
    }));
  }

  if (candidates.length === 0) {
    return {
      contract: CHEST_REFERENCE_PLANE_CONTRACT,
      status: "no-valid-slice",
      experimental: true,
      bodyCenter,
      bodyBounds: bounds,
      searchBand: {
        lowerBodyHeightFraction,
        upperBodyHeightFraction,
        sampleCount,
      },
      selected: null,
      samples,
    };
  }

  const midpoint =
    (lowerBodyHeightFraction + upperBodyHeightFraction) / 2;

  const ranked = [...candidates].sort((a, b) => {
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
    searchBand: {
      lowerBodyHeightFraction,
      upperBodyHeightFraction,
      sampleCount,
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
