import {
  findUnderbustReferencePlane,
} from "./underbust-reference-plane.mjs";

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

  return {
    ...buildReferencePlaneVisualAuditState({
      chestReference,
      underbustReference,
      canonicalHeightCm,
    }),
    underbustReference,
  };
}
