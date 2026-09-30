import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCrossSectionLoops,
  measureCentralHorizontalCircumferenceCm,
  measureHorizontalSurfaceLoopsUnits,
  selectCentralSurfaceLoop,
} from "../body-cross-section.mjs";

function boxMesh({
  minX,
  maxX,
  minY,
  maxY,
  minZ,
  maxZ,
}) {
  const positions = new Float64Array([
    minX, minY, minZ,
    maxX, minY, minZ,
    maxX, minY, maxZ,
    minX, minY, maxZ,
    minX, maxY, minZ,
    maxX, maxY, minZ,
    maxX, maxY, maxZ,
    minX, maxY, maxZ,
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

function combineMeshes(meshes) {
  const positions = [];
  const triangles = [];
  let vertexOffset = 0;

  for (const mesh of meshes) {
    positions.push(...mesh.positions);
    for (const index of mesh.triangles) {
      triangles.push(index + vertexOffset);
    }
    vertexOffset += mesh.positions.length / 3;
  }

  return {
    positions: new Float64Array(positions),
    triangles: new Uint32Array(triangles),
  };
}

test("horizontal slice measures a closed rectangular perimeter", () => {
  const mesh = boxMesh({
    minX: -1,
    maxX: 1,
    minY: -2,
    maxY: 2,
    minZ: -1,
    maxZ: 1,
  });

  const result = measureHorizontalSurfaceLoopsUnits(
    mesh.positions,
    mesh.triangles,
    0,
  );

  assert.equal(result.openChains.length, 0);
  assert.equal(result.branchNodeCount, 0);
  assert.equal(result.loops.length, 1);
  assert.ok(Math.abs(result.loops[0].perimeterUnits - 8) < 1e-9);
});

test("triangulation seams do not change geometric perimeter", () => {
  const mesh = boxMesh({
    minX: -2,
    maxX: 2,
    minY: -1,
    maxY: 1,
    minZ: -0.5,
    maxZ: 0.5,
  });

  const result = measureHorizontalSurfaceLoopsUnits(
    mesh.positions,
    mesh.triangles,
    0.125,
  );

  assert.equal(result.loops.length, 1);
  assert.ok(Math.abs(result.loops[0].perimeterUnits - 10) < 1e-9);
});

test("central selector chooses torso loop instead of detached side loop", () => {
  const torso = boxMesh({
    minX: -1,
    maxX: 1,
    minY: -2,
    maxY: 2,
    minZ: -0.75,
    maxZ: 0.75,
  });
  const side = boxMesh({
    minX: 3,
    maxX: 3.5,
    minY: -2,
    maxY: 2,
    minZ: -0.25,
    maxZ: 0.25,
  });
  const mesh = combineMeshes([torso, side]);

  const result = measureHorizontalSurfaceLoopsUnits(
    mesh.positions,
    mesh.triangles,
    0,
  );
  const loop = selectCentralSurfaceLoop(
    result.loops,
    {x: 0, z: 0},
  );

  assert.equal(result.loops.length, 2);
  assert.ok(Math.abs(loop.perimeterUnits - 7) < 1e-9);
  assert.ok(Math.abs(loop.centroid.x) < 1e-9);
});

test("centimeter normalization uses explicit body height vertices only", () => {
  const mesh = boxMesh({
    minX: -1,
    maxX: 1,
    minY: -2,
    maxY: 2,
    minZ: -1,
    maxZ: 1,
  });

  const positions = new Float64Array([
    ...mesh.positions,
    0, -100, 0,
  ]);
  const bodyVertexIndices = new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7]);

  const result = measureCentralHorizontalCircumferenceCm({
    positions,
    triangles: mesh.triangles,
    planeY: 0,
    canonicalHeightCm: 160,
    heightVertexIndices: bodyVertexIndices,
  });

  assert.equal(result.status, "measured");
  assert.ok(Math.abs(result.rawHeightUnits - 4) < 1e-9);
  assert.ok(Math.abs(result.circumferenceCm - 320) < 1e-9);
});

test("open chains are reported instead of accepted as circumference", () => {
  const topology = buildCrossSectionLoops([
    {a: {x: 0, z: 0}, b: {x: 1, z: 0}},
    {a: {x: 1, z: 0}, b: {x: 1, z: 1}},
  ]);

  assert.equal(topology.loops.length, 0);
  assert.equal(topology.openChains.length, 1);
});

test("branching topology is reported as non-manifold", () => {
  const topology = buildCrossSectionLoops([
    {a: {x: 0, z: 0}, b: {x: 1, z: 0}},
    {a: {x: 1, z: 0}, b: {x: 1, z: 1}},
    {a: {x: 1, z: 1}, b: {x: 0, z: 1}},
    {a: {x: 0, z: 1}, b: {x: 0, z: 0}},
    {a: {x: 1, z: 0}, b: {x: 2, z: 0}},
  ]);

  assert.ok(topology.branchNodeCount > 0);
});
