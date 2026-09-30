import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChestSolverPresentation,
  buildReferencePlaneVisualAuditState,
  evaluateReferencePlaneVisualAudit,
  extractReferenceContour,
  REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
} from "../reference-plane-visual-audit.mjs";

function chestReference({
  status = "selected",
  heightFraction = 0.75,
  planeY = 7.5,
} = {}) {
  return {
    status,
    selected:
      status === "selected"
        ? {heightFraction, planeY}
        : null,
  };
}

function underbustReference({
  status = "selected",
  heightFraction = 0.7,
  planeY = 7,
  bodyHeight = 10,
} = {}) {
  return {
    status,
    bodyBounds: {height: bodyHeight},
    selected:
      status === "selected"
        ? {heightFraction, planeY}
        : null,
  };
}

test("builds selected chest and underbust visual audit state", () => {
  const result = buildReferencePlaneVisualAuditState({
    chestReference: chestReference(),
    underbustReference: underbustReference(),
    canonicalHeightCm: 160,
  });

  assert.equal(
    result.contract,
    REFERENCE_PLANE_VISUAL_AUDIT_CONTRACT,
  );
  assert.equal(result.status, "ready");
  assert.equal(result.chest.heightFraction, 0.75);
  assert.equal(result.underbust.heightFraction, 0.7);
  assert.equal(result.separationCm, 8);
});

test("preserves explicit no-stable-landmark without inventing a plane", () => {
  const result = buildReferencePlaneVisualAuditState({
    chestReference: chestReference(),
    underbustReference: underbustReference({
      status: "no-stable-landmark",
    }),
    canonicalHeightCm: 160,
  });

  assert.equal(result.status, "ready");
  assert.equal(
    result.underbust.status,
    "no-stable-landmark",
  );
  assert.equal(result.underbust.heightFraction, null);
  assert.equal(result.underbust.planeY, null);
  assert.equal(result.separationCm, null);
});

test("reports missing chest reference and does not evaluate underbust", () => {
  const result = buildReferencePlaneVisualAuditState({
    chestReference: chestReference({
      status: "no-valid-slice",
    }),
    underbustReference: null,
    canonicalHeightCm: 160,
  });

  assert.equal(
    result.status,
    "chest-reference-unavailable",
  );
  assert.equal(result.chest.status, "no-valid-slice");
  assert.equal(result.underbust.status, "not-evaluated");
});

test("detects invalid reference ordering", () => {
  const result = buildReferencePlaneVisualAuditState({
    chestReference: chestReference({planeY: 7}),
    underbustReference: underbustReference({
      planeY: 7.2,
    }),
    canonicalHeightCm: 160,
  });

  assert.equal(result.status, "invalid-reference-order");
  assert.equal(result.separationCm, null);
});

function ring(y, frontZ) {
  return [
    [-1, y, -1],
    [1, y, -1],
    [1, y, frontZ],
    [-1, y, frontZ],
  ];
}

function profiledMesh() {
  const rings = [
    ring(0, 1.0),
    ring(1, 1.0),
    ring(2, 1.0),
    ring(3, 1.0),
    ring(4, 1.0),
    ring(5, 1.0),
    ring(6, 0.9),
    ring(7, 0.8),
    ring(8, 1.4),
    ring(9, 1.8),
    ring(10, 1.6),
  ];
  const positions = new Float64Array(rings.flat().flat());
  const triangles = [];

  for (let level = 0; level < rings.length - 1; level += 1) {
    const a = level * 4;
    const b = (level + 1) * 4;
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      triangles.push(
        a + side, b + side, b + next,
        a + side, b + next, a + next,
      );
    }
  }

  triangles.push(
    0, 2, 1, 0, 3, 2,
    40, 41, 42, 40, 42, 43,
  );

  return {
    positions,
    triangles: new Uint32Array(triangles),
    bodyVertexIndices: new Uint32Array(
      Array.from({length: 44}, (_, index) => index),
    ),
  };
}

test("evaluation is measurement-only and leaves source positions unchanged", () => {
  const mesh = profiledMesh();
  const before = new Float64Array(mesh.positions);

  const result = evaluateReferencePlaneVisualAudit({
    ...mesh,
    canonicalHeightCm: 160,
    chestReference: chestReference({
      heightFraction: 1,
      planeY: 10,
    }),
    surfaceDirection: {x: 0, z: 1},
    underbustOptions: {
      maxBelowChestFraction: 0.5,
      minBelowChestFraction: 0.05,
      sampleCount: 19,
      minProminenceHeightFraction: 0.02,
      minPeakSeparationHeightFraction: 0.05,
      maxPeakSeparationHeightFraction: 0.4,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.underbust.status, "selected");
  assert.deepEqual(mesh.positions, before);
});


test("extracts the exact central body contour at a selected plane", () => {
  const mesh = profiledMesh();
  const contour = extractReferenceContour({
    positions: mesh.positions,
    triangles: mesh.triangles,
    planeY: 7.5,
    center: {x: 0, z: 0},
  });

  assert.equal(contour.status, "selected");
  assert.ok(contour.points.length >= 4);
  assert.ok(
    contour.points.every((point) => point.y === 7.5),
  );
  assert.ok(contour.perimeterUnits > 0);
});

test("does not fabricate a contour when no body loop exists", () => {
  const mesh = profiledMesh();
  const contour = extractReferenceContour({
    positions: mesh.positions,
    triangles: new Uint32Array([]),
    planeY: 7.5,
  });

  assert.equal(contour.status, "no-loop");
  assert.equal(contour.points, null);
});

test("evaluation exposes exact chest and underbust contours", () => {
  const mesh = profiledMesh();
  const result = evaluateReferencePlaneVisualAudit({
    ...mesh,
    canonicalHeightCm: 160,
    chestReference: {
      ...chestReference({
        heightFraction: 1,
        planeY: 10,
      }),
      bodyCenter: {x: 0, z: 0},
    },
    surfaceDirection: {x: 0, z: 1},
    underbustOptions: {
      maxBelowChestFraction: 0.5,
      minBelowChestFraction: 0.05,
      sampleCount: 19,
      minProminenceHeightFraction: 0.02,
      minPeakSeparationHeightFraction: 0.05,
      maxPeakSeparationHeightFraction: 0.4,
    },
  });

  assert.equal(result.chestContour.status, "selected");
  assert.equal(result.underbustContour.status, "selected");
  assert.ok(result.chestContour.points.length >= 4);
  assert.ok(result.underbustContour.points.length >= 4);
});

test("chest solver presentation exposes solved renderer response", () => {
  const result = buildChestSolverPresentation({
    requestedChestCm: 88,
    coupledChestCalibration: {
      status: "solved",
      chestMeasuredCm: 88.004,
      chestResidualCm: 0.004,
      bustWeight: -0.3,
      scan: {
        measuredRange: {min: 77.2, max: 106.8},
      },
    },
  });

  assert.equal(result.status, "solved");
  assert.equal(result.requestedChestCm, 88);
  assert.equal(result.measuredChestCm, 88.004);
  assert.deepEqual(
    result.reachableRangeCm,
    {min: 77.2, max: 106.8},
  );
  assert.equal(result.bustWeight, -0.3);
  assert.equal(result.displayedBodySource, "coupled-solved");
});

test("chest solver presentation makes fallback explicit", () => {
  const result = buildChestSolverPresentation({
    requestedChestCm: 120,
    coupledChestCalibration: {
      status: "out-of-range",
      chestMeasuredCm: null,
      chestResidualCm: null,
      bustWeight: null,
      scan: {
        measuredRange: {min: 81.6, max: 108.9},
      },
    },
    displayedBodySource: "shoulder-only-fallback",
  });

  assert.equal(result.status, "out-of-range");
  assert.deepEqual(
    result.reachableRangeCm,
    {min: 81.6, max: 108.9},
  );
  assert.equal(
    result.displayedBodySource,
    "shoulder-only-fallback",
  );
});
