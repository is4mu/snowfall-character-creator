import assert from "node:assert/strict";
import test from "node:test";

import {
  findThoraxReferenceLandmarks,
  measureThoraxChestCircumferenceCm,
  selectThoraxProminencePair,
  selectThoraxStructuralPair,
  THORAX_REFERENCE_LANDMARKS_CONTRACT,
} from "../thorax-reference-landmarks.mjs";

function measured(
  index,
  heightFraction,
  directionalSurfaceUnits,
  perimeterUnits = 10,
) {
  return {
    index,
    heightFraction,
    planeY: heightFraction * 10,
    status: "measured",
    directionalSurfaceUnits,
    perimeterUnits,
  };
}

test("selects the pair whose following peak has greatest anterior projection", () => {
  const samples = [
    measured(0, 0.64, 1.2),
    measured(1, 0.66, 1.0),
    measured(2, 0.68, 1.5),
    measured(3, 0.70, 1.1),
    measured(4, 0.72, 1.9),
    measured(5, 0.74, 1.7),
  ];

  const result = selectThoraxProminencePair(
    samples,
    10,
    {
      minProminenceHeightFraction: 0.02,
      minPeakSeparationHeightFraction: 0.01,
      maxPeakSeparationHeightFraction: 0.05,
    },
  );

  assert.equal(result.selected.sample.index, 3);
  assert.equal(result.selected.peak.index, 4);
});

test("structural pair keeps chest peak even when prominence is below underbust threshold", () => {
  const samples = [
    measured(0, 0.68, 1.2),
    measured(1, 0.70, 1.0),
    measured(2, 0.72, 1.03),
    measured(3, 0.74, 1.02),
  ];

  const result = selectThoraxStructuralPair(
    samples,
    10,
    {
      minProminenceHeightFraction: 0.01,
      minPeakSeparationHeightFraction: 0.01,
      maxPeakSeparationHeightFraction: 0.05,
    },
  );

  assert.equal(result.selected.sample.index, 1);
  assert.equal(result.selected.peak.index, 2);
  assert.equal(result.selected.qualifies, false);
});

function ring(y, halfWidth, backZ, frontZ) {
  return [
    [-halfWidth, y, backZ],
    [halfWidth, y, backZ],
    [halfWidth, y, frontZ],
    [-halfWidth, y, frontZ],
  ];
}

function profiledTorsoMesh({
  monotonic = false,
} = {}) {
  const front = monotonic
    ? [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]
    : [1.0, 0.95, 0.9, 1.5, 1.3, 1.2, 1.1];

  const rings = front.map((frontZ, index) =>
    ring(index, 1 + index * 0.01, -1, frontZ)
  );
  const positions =
    new Float64Array(rings.flat().flat());
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
    24, 25, 26, 24, 26, 27,
  );

  return {
    positions,
    triangles: new Uint32Array(triangles),
    bodyVertexIndices: new Uint32Array(
      Array.from({length: 28}, (_, index) => index),
    ),
  };
}

test("full finder selects paired anterior prominence and normalizes direction", () => {
  const result = findThoraxReferenceLandmarks({
    ...profiledTorsoMesh(),
    surfaceDirection: {x: 0, z: 5},
    lowerBodyHeightFraction: 0,
    upperBodyHeightFraction: 1,
    sampleCount: 7,
    appendageMergeJumpRatio: 10,
    minProminenceHeightFraction: 0.05,
    minPeakSeparationHeightFraction: 0.1,
    maxPeakSeparationHeightFraction: 0.6,
  });

  assert.equal(
    result.contract,
    THORAX_REFERENCE_LANDMARKS_CONTRACT,
  );
  assert.equal(result.status, "selected");
  assert.equal(
    result.mode,
    "anterior-structural-pair",
  );
  assert.deepEqual(result.surfaceDirection, {x: 0, z: 1});
  assert.ok(
    result.underbust.selected.heightFraction <
      result.chest.heightFraction,
  );
});

test("keeps chest on greatest anterior surface when underbust is not stable", () => {
  const result = findThoraxReferenceLandmarks({
    ...profiledTorsoMesh({monotonic: true}),
    surfaceDirection: {x: 0, z: 1},
    lowerBodyHeightFraction: 0,
    upperBodyHeightFraction: 1,
    sampleCount: 7,
    appendageMergeJumpRatio: 10,
    minProminenceHeightFraction: 0.05,
    minPeakSeparationHeightFraction: 0.1,
    maxPeakSeparationHeightFraction: 0.6,
  });

  assert.equal(result.status, "selected");
  assert.equal(
    result.mode,
    "anterior-maximum-fallback",
  );
  assert.equal(
    result.underbust.status,
    "no-stable-landmark",
  );
  assert.equal(result.chest.heightFraction, 1);
});

test("returns no-valid-slice when no cross-section exists", () => {
  const mesh = profiledTorsoMesh();
  const result = findThoraxReferenceLandmarks({
    positions: mesh.positions,
    triangles: new Uint32Array([]),
    bodyVertexIndices: mesh.bodyVertexIndices,
    surfaceDirection: {x: 0, z: 1},
    lowerBodyHeightFraction: 0,
    upperBodyHeightFraction: 1,
    sampleCount: 7,
  });

  assert.equal(result.status, "no-valid-slice");
  assert.equal(result.chest, null);
});

test("does not mutate source positions", () => {
  const mesh = profiledTorsoMesh();
  const before = new Float64Array(mesh.positions);

  findThoraxReferenceLandmarks({
    ...mesh,
    surfaceDirection: {x: 0, z: 1},
    lowerBodyHeightFraction: 0,
    upperBodyHeightFraction: 1,
    sampleCount: 7,
    appendageMergeJumpRatio: 10,
  });

  assert.deepEqual(mesh.positions, before);
});


test("centimeter chest measurement exposes the thorax-selected reference", () => {
  const mesh = profiledTorsoMesh();
  const before = new Float64Array(mesh.positions);

  const result = measureThoraxChestCircumferenceCm({
    ...mesh,
    canonicalHeightCm: 180,
    surfaceDirection: {x: 0, z: 1},
    lowerBodyHeightFraction: 0,
    upperBodyHeightFraction: 1,
    sampleCount: 7,
    appendageMergeJumpRatio: 10,
    minProminenceHeightFraction: 0.05,
    minPeakSeparationHeightFraction: 0.1,
    maxPeakSeparationHeightFraction: 0.6,
  });

  assert.equal(result.status, "measured");
  assert.equal(result.contract, THORAX_REFERENCE_LANDMARKS_CONTRACT);
  assert.equal(result.landmarks.status, "selected");
  assert.deepEqual(
    result.reference.selected,
    result.landmarks.chest,
  );
  assert.ok(result.circumferenceCm > 0);
  assert.equal(
    result.cmPerUnit,
    180 / result.landmarks.bodyBounds.height,
  );
  assert.deepEqual(mesh.positions, before);
});
