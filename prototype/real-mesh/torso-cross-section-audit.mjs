import {
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "./body-cross-section.mjs";
import {
  measurePositionBoundsUnits,
  measurePositionArrayHeightUnits,
} from "./makehuman-measurement.mjs";

export const TORSO_CROSS_SECTION_AUDIT_CONTRACT =
  "scc-torso-cross-section-audit-v0";


function summarizeLoopGeometry(selectedLoop, center, cmPerUnit) {
  if (!Array.isArray(selectedLoop?.points) || selectedLoop.points.length === 0) {
    throw new TypeError("selected loop points are required");
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const point of selectedLoop.points) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.z)) {
      throw new TypeError("selected loop points must contain finite x and z");
    }
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  const breadthUnits = maxX - minX;
  const depthUnits = maxZ - minZ;
  const positiveZExtentUnits = maxZ - center.z;
  const negativeZExtentUnits = center.z - minZ;

  return {
    boundsUnits: {minX, maxX, minZ, maxZ},
    breadthUnits,
    depthUnits,
    positiveZExtentUnits,
    negativeZExtentUnits,
    breadthCm: breadthUnits * cmPerUnit,
    depthCm: depthUnits * cmPerUnit,
    positiveZExtentCm: positiveZExtentUnits * cmPerUnit,
    negativeZExtentCm: negativeZExtentUnits * cmPerUnit,
  };
}

function validateFractions(lowerBodyHeightFraction, upperBodyHeightFraction) {
  if (
    !Number.isFinite(lowerBodyHeightFraction) ||
    !Number.isFinite(upperBodyHeightFraction) ||
    lowerBodyHeightFraction < 0 ||
    upperBodyHeightFraction > 1 ||
    lowerBodyHeightFraction >= upperBodyHeightFraction
  ) {
    throw new RangeError(
      "audit fractions must satisfy 0 <= lower < upper <= 1",
    );
  }
}

export function sampleTorsoCrossSectionCurve({
  positions,
  triangles,
  bodyVertexIndices,
  canonicalHeightCm,
  lowerBodyHeightFraction,
  upperBodyHeightFraction,
  sampleCount = 29,
  center = null,
  crossSectionOptions = {},
}) {
  validateFractions(
    lowerBodyHeightFraction,
    upperBodyHeightFraction,
  );
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new TypeError("sampleCount must be an integer >= 2");
  }
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError(
      "canonicalHeightCm must be a finite positive number",
    );
  }

  const bounds = measurePositionBoundsUnits(
    positions,
    bodyVertexIndices,
  );
  const rawHeight = measurePositionArrayHeightUnits(
    positions,
    bodyVertexIndices,
  );
  const cmPerUnit = canonicalHeightCm / rawHeight;
  const bodyCenter = center ?? {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };

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
      samples.push({
        index,
        heightFraction,
        planeY,
        status: "open-cross-section",
        circumferenceCm: null,
        loopCount: crossSection.loops.length,
        openChainCount: crossSection.openChains.length,
        branchNodeCount: crossSection.branchNodeCount,
      });
      continue;
    }

    if (crossSection.branchNodeCount > 0) {
      samples.push({
        index,
        heightFraction,
        planeY,
        status: "non-manifold-cross-section",
        circumferenceCm: null,
        loopCount: crossSection.loops.length,
        openChainCount: crossSection.openChains.length,
        branchNodeCount: crossSection.branchNodeCount,
      });
      continue;
    }

    if (crossSection.loops.length === 0) {
      samples.push({
        index,
        heightFraction,
        planeY,
        status: "no-loop",
        circumferenceCm: null,
        loopCount: 0,
        openChainCount: 0,
        branchNodeCount: 0,
      });
      continue;
    }

    const selectedLoop = selectCentralSurfaceLoop(
      crossSection.loops,
      bodyCenter,
    );
    const selectedLoopGeometry = summarizeLoopGeometry(
      selectedLoop,
      bodyCenter,
      cmPerUnit,
    );
    samples.push({
      index,
      heightFraction,
      planeY,
      status: "measured",
      circumferenceCm: selectedLoop.perimeterUnits * cmPerUnit,
      perimeterUnits: selectedLoop.perimeterUnits,
      loopCount: crossSection.loops.length,
      openChainCount: 0,
      branchNodeCount: 0,
      selectedLoopCentroid: selectedLoop.centroid,
      selectedLoopGeometry,
    });
  }

  return {
    contract: TORSO_CROSS_SECTION_AUDIT_CONTRACT,
    semanticStatus: "exploratory-only",
    lowerBodyHeightFraction,
    upperBodyHeightFraction,
    sampleCount,
    cmPerUnit,
    bodyCenter,
    samples,
  };
}
