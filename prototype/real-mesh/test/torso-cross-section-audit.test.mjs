import assert from "node:assert/strict";
import test from "node:test";

import {
  TORSO_CROSS_SECTION_AUDIT_CONTRACT,
  sampleTorsoCrossSectionCurve,
} from "../torso-cross-section-audit.mjs";

function ring(y, halfWidth, halfDepth) {
  return [
    [-halfWidth, y, -halfDepth],
    [halfWidth, y, -halfDepth],
    [halfWidth, y, halfDepth],
    [-halfWidth, y, halfDepth],
  ];
}

function stackedTorsoMesh() {
  const rings = [
    ring(-2, 1, 0.5),
    ring(0, 2, 1),
    ring(2, 1, 0.5),
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
    8, 9, 10, 8, 10, 11,
  );

  return {
    positions,
    triangles: new Uint32Array(triangles),
    bodyVertexIndices: new Uint32Array(
      Array.from({length: 12}, (_, index) => index),
    ),
  };
}

test("samples a deterministic measured torso circumference curve", () => {
  const result = sampleTorsoCrossSectionCurve({
    ...stackedTorsoMesh(),
    canonicalHeightCm: 160,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 3,
  });

  assert.equal(
    result.contract,
    TORSO_CROSS_SECTION_AUDIT_CONTRACT,
  );
  assert.equal(result.semanticStatus, "exploratory-only");
  assert.deepEqual(
    result.samples.map((sample) => sample.status),
    ["measured", "measured", "measured"],
  );
  assert.ok(
    result.samples[1].circumferenceCm >
      result.samples[0].circumferenceCm,
  );
  assert.ok(
    result.samples[1].circumferenceCm >
      result.samples[2].circumferenceCm,
  );

  assert.deepEqual(
    result.samples[1].selectedLoopGeometry.boundsUnits,
    {
      minX: -2,
      maxX: 2,
      minZ: -1,
      maxZ: 1,
    },
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.breadthUnits,
    4,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.depthUnits,
    2,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.positiveZExtentUnits,
    1,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.negativeZExtentUnits,
    1,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.breadthCm,
    160,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.depthCm,
    80,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.positiveZExtentCm,
    40,
  );
  assert.equal(
    result.samples[1].selectedLoopGeometry.negativeZExtentCm,
    40,
  );
});

test("invalid topology is retained instead of fabricated as a measurement", () => {
  const mesh = stackedTorsoMesh();
  const result = sampleTorsoCrossSectionCurve({
    positions: mesh.positions,
    triangles: new Uint32Array([]),
    bodyVertexIndices: mesh.bodyVertexIndices,
    canonicalHeightCm: 160,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 3,
  });

  assert.ok(
    result.samples.every(
      (sample) =>
        sample.status === "no-loop" &&
        sample.circumferenceCm === null,
    ),
  );
});

test("audit band and sample count are validated explicitly", () => {
  const mesh = stackedTorsoMesh();

  assert.throws(
    () => sampleTorsoCrossSectionCurve({
      ...mesh,
      canonicalHeightCm: 160,
      lowerBodyHeightFraction: 0.8,
      upperBodyHeightFraction: 0.7,
    }),
    /lower < upper/,
  );

  assert.throws(
    () => sampleTorsoCrossSectionCurve({
      ...mesh,
      canonicalHeightCm: 160,
      lowerBodyHeightFraction: 0.2,
      upperBodyHeightFraction: 0.7,
      sampleCount: 1,
    }),
    />= 2/,
  );
});

test("explicit center shifts signed Z extents without changing loop depth", () => {
  const result = sampleTorsoCrossSectionCurve({
    ...stackedTorsoMesh(),
    canonicalHeightCm: 160,
    lowerBodyHeightFraction: 0.5,
    upperBodyHeightFraction: 0.5001,
    sampleCount: 2,
    center: {x: 0, z: 0.25},
  });

  const geometry = result.samples[0].selectedLoopGeometry;
  assert.equal(geometry.depthUnits, 2);
  assert.equal(geometry.positiveZExtentUnits, 0.75);
  assert.equal(geometry.negativeZExtentUnits, 1.25);
  assert.equal(geometry.positiveZExtentCm, 30);
  assert.equal(geometry.negativeZExtentCm, 50);
});
