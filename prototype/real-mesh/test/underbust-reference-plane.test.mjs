import assert from "node:assert/strict";
import test from "node:test";

import {
  UNDERBUST_REFERENCE_PLANE_CONTRACT,
  detectUnderbustProfileCandidate,
  findUnderbustReferencePlane,
} from "../underbust-reference-plane.mjs";

function measured(index, heightFraction, value) {
  return {
    index,
    heightFraction,
    status: "measured",
    directionalSurfaceUnits: value,
  };
}

test("detector selects the last sufficiently prominent local minimum", () => {
  const result = detectUnderbustProfileCandidate(
    [
      measured(0, 0.64, 1.0),
      measured(1, 0.66, 0.8),
      measured(2, 0.68, 1.1),
      measured(3, 0.70, 0.9),
      measured(4, 0.72, 1.5),
      measured(5, 0.74, 1.2),
    ],
    10,
    {
      minProminenceHeightFraction: 0.02,
      minPeakSeparationHeightFraction: 0.01,
      maxPeakSeparationHeightFraction: 0.05,
    },
  );

  assert.equal(result.candidates.length, 2);
  assert.equal(result.selected.sample.index, 3);
  assert.equal(result.selected.peak.index, 4);
  assert.ok(
    Math.abs(result.selected.prominenceHeightFraction - 0.06) <
      1e-12,
  );
});

test("detector rejects a weak numerical wiggle", () => {
  const result = detectUnderbustProfileCandidate(
    [
      measured(0, 0.68, 1.0),
      measured(1, 0.70, 0.99),
      measured(2, 0.72, 1.01),
      measured(3, 0.74, 1.0),
    ],
    10,
    {
      minProminenceHeightFraction: 0.01,
      minPeakSeparationHeightFraction: 0.01,
      maxPeakSeparationHeightFraction: 0.05,
    },
  );

  assert.equal(result.selected, null);
  assert.equal(result.candidates.length, 1);
  assert.equal(
    result.candidates[0].reason,
    "insufficient-prominence",
  );
});

test("invalid sample breaks profile continuity", () => {
  const result = detectUnderbustProfileCandidate(
    [
      measured(0, 0.68, 1.1),
      measured(1, 0.70, 0.8),
      {
        index: 2,
        heightFraction: 0.72,
        status: "open-cross-section",
        directionalSurfaceUnits: null,
      },
      measured(3, 0.74, 1.5),
    ],
    10,
  );

  assert.equal(result.selected, null);
  assert.equal(result.candidates.length, 0);
});

function ring(y, halfWidth, backZ, frontZ) {
  return [
    [-halfWidth, y, backZ],
    [halfWidth, y, backZ],
    [halfWidth, y, frontZ],
    [-halfWidth, y, frontZ],
  ];
}

function profiledTorsoMesh() {
  const rings = [
    ring(0, 1, -1, 1.2),
    ring(1, 1, -1, 1.0),
    ring(2, 1, -1, 0.8),
    ring(3, 1, -1, 1.4),
    ring(4, 1, -1, 1.9),
    ring(5, 1, -1, 1.6),
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
    20, 21, 22, 20, 22, 23,
  );

  return {
    positions,
    triangles: new Uint32Array(triangles),
    bodyVertexIndices: new Uint32Array(
      Array.from({length: 24}, (_, index) => index),
    ),
  };
}

test("finder normalizes direction and can select a surface-profile landmark", () => {
  const result = findUnderbustReferencePlane({
    ...profiledTorsoMesh(),
    chestReferenceHeightFraction: 1,
    surfaceDirection: {x: 0, z: 5},
    maxBelowChestFraction: 0.8,
    minBelowChestFraction: 0.1,
    sampleCount: 8,
    minProminenceHeightFraction: 0.05,
    minPeakSeparationHeightFraction: 0.05,
    maxPeakSeparationHeightFraction: 0.5,
  });

  assert.equal(result.contract, UNDERBUST_REFERENCE_PLANE_CONTRACT);
  assert.equal(result.status, "selected");
  assert.deepEqual(result.surfaceDirection, {x: 0, z: 1});
  assert.ok(result.selected.prominenceHeightFraction >= 0.05);
});

test("finder returns no-stable-landmark for monotonic profile", () => {
  const mesh = profiledTorsoMesh();
  const monotonic = new Float64Array(mesh.positions);
  for (let index = 0; index < monotonic.length / 3; index += 1) {
    const y = monotonic[index * 3 + 1];
    if (monotonic[index * 3 + 2] > 0) {
      monotonic[index * 3 + 2] = 0.5 + 0.2 * y;
    }
  }

  const result = findUnderbustReferencePlane({
    positions: monotonic,
    triangles: mesh.triangles,
    bodyVertexIndices: mesh.bodyVertexIndices,
    chestReferenceHeightFraction: 1,
    surfaceDirection: {x: 0, z: 1},
    maxBelowChestFraction: 0.8,
    minBelowChestFraction: 0.1,
    sampleCount: 8,
  });

  assert.equal(result.status, "no-stable-landmark");
  assert.equal(result.selected, null);
});

test("finder reports no-valid-slice instead of fabricating a landmark", () => {
  const mesh = profiledTorsoMesh();
  const result = findUnderbustReferencePlane({
    positions: mesh.positions,
    triangles: new Uint32Array([]),
    bodyVertexIndices: mesh.bodyVertexIndices,
    chestReferenceHeightFraction: 1,
    surfaceDirection: {x: 0, z: 1},
    maxBelowChestFraction: 0.8,
    minBelowChestFraction: 0.1,
    sampleCount: 8,
  });

  assert.equal(result.status, "no-valid-slice");
  assert.equal(result.selected, null);
});

test("zero surface direction is rejected explicitly", () => {
  assert.throws(
    () => findUnderbustReferencePlane({
      ...profiledTorsoMesh(),
      chestReferenceHeightFraction: 1,
      surfaceDirection: {x: 0, z: 0},
    }),
    /non-zero/,
  );
});
