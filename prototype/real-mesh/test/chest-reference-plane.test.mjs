import assert from "node:assert/strict";
import test from "node:test";

import {
  CHEST_REFERENCE_PLANE_CONTRACT,
  detectAppendageMergeBoundary,
  findChestReferencePlane,
  measureChestCircumferenceCm,
} from "../chest-reference-plane.mjs";

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
  const flat = rings.flat();
  const positions = new Float64Array(flat.flat());
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
      Array.from({length: 12}, (_, i) => i),
    ),
  };
}

function combineMeshes(a, b) {
  const positions = new Float64Array([
    ...a.positions,
    ...b.positions,
  ]);
  const offset = a.positions.length / 3;
  const triangles = new Uint32Array([
    ...a.triangles,
    ...[...b.triangles].map((index) => index + offset),
  ]);
  const bodyVertexIndices = new Uint32Array(
    Array.from(
      {length: positions.length / 3},
      (_, index) => index,
    ),
  );
  return {positions, triangles, bodyVertexIndices};
}

function sideBoxMesh() {
  const positions = new Float64Array([
    4, -2, -0.25,
    4.5, -2, -0.25,
    4.5, -2, 0.25,
    4, -2, 0.25,
    4, 2, -0.25,
    4.5, 2, -0.25,
    4.5, 2, 0.25,
    4, 2, 0.25,
  ]);
  const triangles = new Uint32Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);
  return {positions, triangles};
}

test("finder selects the known widest torso section", () => {
  const mesh = stackedTorsoMesh();

  const result = findChestReferencePlane({
    ...mesh,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 5,
  });

  assert.equal(result.contract, CHEST_REFERENCE_PLANE_CONTRACT);
  assert.equal(result.status, "selected");
  assert.equal(result.experimental, true);
  assert.ok(Math.abs(result.selected.heightFraction - 0.5) < 1e-12);
  assert.ok(Math.abs(result.selected.planeY) < 1e-12);
  assert.ok(Math.abs(result.selected.perimeterUnits - 12) < 1e-9);
});

test("detached side loop does not replace the central torso candidate", () => {
  const mesh = combineMeshes(
    stackedTorsoMesh(),
    sideBoxMesh(),
  );

  const result = findChestReferencePlane({
    ...mesh,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 5,
    center: {x: 0, z: 0},
  });

  assert.equal(result.status, "selected");
  assert.ok(Math.abs(result.selected.planeY) < 1e-12);
  assert.ok(Math.abs(result.selected.centroid.x) < 1e-9);
});

test("measurement converts the selected raw perimeter using body height", () => {
  const mesh = stackedTorsoMesh();

  const result = measureChestCircumferenceCm({
    ...mesh,
    canonicalHeightCm: 160,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 5,
  });

  assert.equal(result.status, "measured");
  assert.ok(Math.abs(result.cmPerUnit - 40) < 1e-9);
  assert.ok(Math.abs(result.circumferenceCm - 480) < 1e-9);
});

test("deterministic tie-break prefers sample nearest band midpoint", () => {
  const positions = new Float64Array([
    -1, -2, -1,
    1, -2, -1,
    1, -2, 1,
    -1, -2, 1,
    -1, 2, -1,
    1, 2, -1,
    1, 2, 1,
    -1, 2, 1,
  ]);
  const triangles = new Uint32Array([
    0, 1, 2, 0, 2, 3,
    4, 6, 5, 4, 7, 6,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ]);

  const result = findChestReferencePlane({
    positions,
    triangles,
    bodyVertexIndices: new Uint32Array([0,1,2,3,4,5,6,7]),
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 5,
  });

  assert.equal(result.status, "selected");
  assert.ok(Math.abs(result.selected.heightFraction - 0.5) < 1e-12);
});

test("invalid search band fails explicitly", () => {
  const mesh = stackedTorsoMesh();

  assert.throws(
    () => findChestReferencePlane({
      ...mesh,
      lowerBodyHeightFraction: 0.8,
      upperBodyHeightFraction: 0.6,
      sampleCount: 5,
    }),
    /lower < upper/,
  );
});

test("no valid contour returns no-valid-slice with diagnostics", () => {
  const mesh = stackedTorsoMesh();

  const result = findChestReferencePlane({
    positions: mesh.positions,
    triangles: new Uint32Array([]),
    bodyVertexIndices: mesh.bodyVertexIndices,
    lowerBodyHeightFraction: 0.25,
    upperBodyHeightFraction: 0.75,
    sampleCount: 3,
  });

  assert.equal(result.status, "no-valid-slice");
  assert.equal(result.selected, null);
  assert.equal(result.samples.length, 3);
  assert.ok(result.samples.every((sample) => sample.status === "no-loop"));
});

test("appendage merge detector requires loop loss plus perimeter jump", () => {
  const boundary = detectAppendageMergeBoundary([
    {
      index: 0,
      heightFraction: 0.74,
      perimeterUnits: 8.8,
      loopCount: 3,
    },
    {
      index: 1,
      heightFraction: 0.75,
      perimeterUnits: 8.9,
      loopCount: 3,
    },
    {
      index: 2,
      heightFraction: 0.76,
      perimeterUnits: 12.9,
      loopCount: 1,
    },
  ], {jumpRatio: 1.25});

  assert.deepEqual(boundary, {
    lowerSampleIndex: 1,
    boundarySampleIndex: 2,
    lowerHeightFraction: 0.75,
    boundaryHeightFraction: 0.76,
    previousLoopCount: 3,
    boundaryLoopCount: 1,
    loopLoss: 2,
    previousPerimeterUnits: 8.9,
    boundaryPerimeterUnits: 12.9,
    perimeterRatio: 12.9 / 8.9,
    jumpRatio: 1.25,
  });
});

test("loop loss without a large perimeter jump is not an axilla boundary", () => {
  const boundary = detectAppendageMergeBoundary([
    {
      index: 0,
      heightFraction: 0.74,
      perimeterUnits: 8.8,
      loopCount: 3,
    },
    {
      index: 1,
      heightFraction: 0.75,
      perimeterUnits: 9.1,
      loopCount: 1,
    },
  ], {jumpRatio: 1.25});

  assert.equal(boundary, null);
});

test("perimeter jump without loop loss is not an axilla boundary", () => {
  const boundary = detectAppendageMergeBoundary([
    {
      index: 0,
      heightFraction: 0.74,
      perimeterUnits: 8,
      loopCount: 1,
    },
    {
      index: 1,
      heightFraction: 0.75,
      perimeterUnits: 12,
      loopCount: 1,
    },
  ], {jumpRatio: 1.25});

  assert.equal(boundary, null);
});

test("non-adjacent valid samples do not create a synthetic merge boundary", () => {
  const boundary = detectAppendageMergeBoundary([
    {
      index: 0,
      heightFraction: 0.74,
      perimeterUnits: 8,
      loopCount: 3,
    },
    {
      index: 2,
      heightFraction: 0.76,
      perimeterUnits: 12,
      loopCount: 1,
    },
  ], {jumpRatio: 1.25});

  assert.equal(boundary, null);
});

test("appendage merge ratio must be greater than one", () => {
  assert.throws(
    () => detectAppendageMergeBoundary([], {jumpRatio: 1}),
    /greater than one|> 1/,
  );

  const mesh = stackedTorsoMesh();
  assert.throws(
    () => findChestReferencePlane({
      ...mesh,
      lowerBodyHeightFraction: 0.25,
      upperBodyHeightFraction: 0.75,
      sampleCount: 5,
      appendageMergeJumpRatio: 1,
    }),
    /> 1/,
  );
});
