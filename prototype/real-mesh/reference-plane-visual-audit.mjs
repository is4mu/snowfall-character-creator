import {
  findUnderbustReferencePlane,
} from "./underbust-reference-plane.mjs";
import {
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "./body-cross-section.mjs";

export const REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT =
  "scc-reference-plane-visual-audit-v0";

function validateCanonicalHeight(canonicalHeightCm) {
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError(
      "canonicalHeightCm must be a finite positive number",
    );
  }
}

function selectedChestSummary(chestReference) {
  const selected = chestReference?.selected;
  if (
    chestReference?.status !== "selected" ||
    !Number.isFinite(selected?.heightFraction) ||
    !Number.isFinite(selected?.planeY)
  ) {
    return null;
  }

  return {
    status: "selected",
    heightFraction: selected.heightFraction,
    planeY: selected.planeY,
  };
}

function finiteCenter(center) {
  return (
    Number.isFinite(center?.x) &&
    Number.isFinite(center?.z)
  );
}

export function extractReferenceContour({
  positions,
  triangles,
  planeY,
  center = {x: 0, z: 0},
  crossSectionOptions = {},
}) {
  if (!Number.isFinite(planeY)) {
    throw new TypeError("planeY must be finite");
  }
  if (!finiteCenter(center)) {
    throw new TypeError(
      "center must contain finite x and z values",
    );
  }

  const crossSection = measureHorizontalSurfaceLoopsUnits(
    positions,
    triangles,
    planeY,
    crossSectionOptions,
  );

  if (crossSection.openChains.length > 0) {
    return {
      status: "open-cross-section",
      planeY,
      points: null,
      perimeterUnits: null,
      loopCount: crossSection.loops.length,
      openChainCount: crossSection.openChains.length,
      branchNodeCount: crossSection.branchNodeCount,
    };
  }

  if (crossSection.branchNodeCount > 0) {
    return {
      status: "non-manifold-cross-section",
      planeY,
      points: null,
      perimeterUnits: null,
      loopCount: crossSection.loops.length,
      openChainCount: 0,
      branchNodeCount: crossSection.branchNodeCount,
    };
  }

  if (crossSection.loops.length === 0) {
    return {
      status: "no-loop",
      planeY,
      points: null,
      perimeterUnits: null,
      loopCount: 0,
      openChainCount: 0,
      branchNodeCount: 0,
    };
  }

  const loop = selectCentralSurfaceLoop(
    crossSection.loops,
    center,
  );

  return {
    status: "selected",
    planeY,
    points: loop.points.map((point) => ({
      x: point.x,
      y: planeY,
      z: point.z,
    })),
    perimeterUnits: loop.perimeterUnits,
    centroid: loop.centroid,
    loopCount: crossSection.loops.length,
    openChainCount: 0,
    branchNodeCount: 0,
  };
}

export function buildChestSolverPresentation({
  coupledChestCalibration,
  requestedChestCm,
  displayedBodySource,
}) {
  if (!Number.isFinite(requestedChestCm)) {
    return {
      status: "not-authored",
      requestedChestCm: null,
      measuredChestCm: null,
      residualCm: null,
      reachableRangeCm: null,
      bustWeight: null,
      displayedBodySource,
    };
  }

  const range = coupledChestCalibration?.scan?.measuredRange;
  return {
    status:
      coupledChestCalibration?.status ?? "not-ready",
    requestedChestCm,
    measuredChestCm:
      coupledChestCalibration?.chestMeasuredCm ?? null,
    residualCm:
      coupledChestCalibration?.chestResidualCm ?? null,
    reachableRangeCm:
      Number.isFinite(range?.min) &&
      Number.isFinite(range?.max)
        ? {min: range.min, max: range.max}
        : null,
    bustWeight:
      coupledChestCalibration?.bustWeight ?? null,
    displayedBodySource:
      displayedBodySource ??
      (
        coupledChestCalibration?.status === "solved"
          ? "coupled-solved"
          : "shoulder-only-fallback"
      ),
  };
}

export function buildReferencePlaneVisualAuditState({
  chestReference,
  underbustReference,
  canonicalHeightCm,
}) {
  validateCanonicalHeight(canonicalHeightCm);

  const chest = selectedChestSummary(chestReference);
  if (!chest) {
    return {
      contract: REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
      status: "chest-reference-unavailable",
      experimental: true,
      chest: {
        status: chestReference?.status ?? "unavailable",
        heightFraction: null,
        planeY: null,
      },
      underbust: {
        status: "not-evaluated",
        heightFraction: null,
        planeY: null,
      },
      separationCm: null,
    };
  }

  const underbustStatus =
    underbustReference?.status ?? "not-evaluated";

  if (
    underbustStatus !== "selected" ||
    !Number.isFinite(
      underbustReference?.selected?.heightFraction,
    ) ||
    !Number.isFinite(underbustReference?.selected?.planeY)
  ) {
    return {
      contract: REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
      status: "ready",
      experimental: true,
      chest,
      underbust: {
        status: underbustStatus,
        heightFraction: null,
        planeY: null,
      },
      separationCm: null,
    };
  }

  const bodyHeightUnits =
    underbustReference?.bodyBounds?.height;
  if (!Number.isFinite(bodyHeightUnits) || bodyHeightUnits <= 0) {
    throw new TypeError(
      "selected underbust reference must include positive bodyBounds.height",
    );
  }

  const underbust = {
    status: "selected",
    heightFraction:
      underbustReference.selected.heightFraction,
    planeY: underbustReference.selected.planeY,
  };
  const separationUnits =
    chest.planeY - underbust.planeY;

  if (separationUnits < 0) {
    return {
      contract: REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
      status: "invalid-reference-order",
      experimental: true,
      chest,
      underbust,
      separationCm: null,
    };
  }

  return {
    contract: REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
    status: "ready",
    experimental: true,
    chest,
    underbust,
    separationCm:
      separationUnits * canonicalHeightCm / bodyHeightUnits,
  };
}

export function evaluateReferencePlaneVisualAudit({
  positions,
  triangles,
  bodyVertexIndices,
  canonicalHeightCm,
  chestReference,
  surfaceDirection,
  underbustOptions = {},
}) {
  validateCanonicalHeight(canonicalHeightCm);

  const chest = selectedChestSummary(chestReference);
  if (!chest) {
    return buildReferencePlaneVisualAuditState({
      chestReference,
      underbustReference: null,
      canonicalHeightCm,
    });
  }

  const underbustReference = findUnderbustReferencePlane({
    positions,
    triangles,
    bodyVertexIndices,
    chestReferenceHeightFraction:
      chest.heightFraction,
    surfaceDirection,
    ...underbustOptions,
  });

  const state = buildReferencePlaneVisualAuditState({
    chestReference,
    underbustReference,
    canonicalHeightCm,
  });

  const chestContour = extractReferenceContour({
    positions,
    triangles,
    planeY: chest.planeY,
    center: chestReference?.bodyCenter ?? {x: 0, z: 0},
  });

  const underbustContour =
    state.underbust.status === "selected"
      ? extractReferenceContour({
          positions,
          triangles,
          planeY: state.underbust.planeY,
          center:
            underbustReference?.bodyCenter ??
            chestReference?.bodyCenter ??
            {x: 0, z: 0},
        })
      : null;

  return {
    ...state,
    underbustReference,
    chestContour,
    underbustContour,
  };
}
