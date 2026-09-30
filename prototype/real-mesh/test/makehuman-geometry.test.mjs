import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBidirectionalTarget,
  applyTarget,
  collectTriangleVertexIndices,
  getObjGroupTriangles,
  parseMakeHumanObj,
  parseMakeHumanTarget,
} from "../makehuman-geometry.mjs";

const quadObj = `
# synthetic MakeHuman-like OBJ
v 0 0 0
v 1 0 0
v 1 2 0
v 0 2 0
vt 0 0
vt 1 0
vt 1 1
vt 0 1
f 1/1 2/2 3/3 4/4
`;

test("OBJ parser preserves original vertex indices and triangulates quads", () => {
  const parsed = parseMakeHumanObj(quadObj);

  assert.equal(parsed.vertexCount, 4);
  assert.equal(parsed.triangleCount, 2);
  assert.deepEqual(Array.from(parsed.positions), [
    0, 0, 0,
    1, 0, 0,
    1, 2, 0,
    0, 2, 0,
  ]);
  assert.deepEqual(Array.from(parsed.triangles), [0, 1, 2, 0, 2, 3]);
});

test("OBJ parser preserves group membership while keeping source indices", () => {
  const parsed = parseMakeHumanObj(`
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 9 9 9
v 10 9 9
v 9 10 9
g body
f 1 2 3 4
g helper-marker
f 5 6 7
`);

  const body = getObjGroupTriangles(parsed, "body");
  const helper = getObjGroupTriangles(parsed, "helper-marker");

  assert.deepEqual(Array.from(body), [0, 1, 2, 0, 2, 3]);
  assert.deepEqual(Array.from(helper), [4, 5, 6]);
  assert.deepEqual(
    Array.from(collectTriangleVertexIndices(body)),
    [0, 1, 2, 3],
  );
  assert.equal(parsed.triangleCount, 3);
  assert.equal(parsed.groups.body.triangleCount, 2);
  assert.equal(parsed.groups["helper-marker"].triangleCount, 1);
});

test("missing required group is reported explicitly", () => {
  const parsed = parseMakeHumanObj(quadObj);
  assert.throws(
    () => getObjGroupTriangles(parsed, "body"),
    /OBJ group not found: body/,
  );
});

test("OBJ parser supports negative face indices", () => {
  const parsed = parseMakeHumanObj(`
v 0 0 0
v 1 0 0
v 0 1 0
f -3 -2 -1
`);

  assert.deepEqual(Array.from(parsed.triangles), [0, 1, 2]);
});

test("target parser reads sparse CC0 delta lines", () => {
  const deltas = parseMakeHumanTarget(`
# target header
0 .1 0 -.2
2 -.05 .25 0
`);

  assert.deepEqual(deltas, [
    {index: 0, dx: 0.1, dy: 0, dz: -0.2},
    {index: 2, dx: -0.05, dy: 0.25, dz: 0},
  ]);
});

test("target application preserves base positions and changes indexed vertices", () => {
  const base = new Float64Array([
    0, 0, 0,
    1, 0, 0,
    1, 2, 0,
  ]);
  const before = Array.from(base);
  const deltas = [
    {index: 1, dx: 2, dy: 0, dz: -1},
  ];

  const result = applyTarget(base, deltas, 0.5);

  assert.deepEqual(Array.from(base), before);
  assert.deepEqual(Array.from(result), [
    0, 0, 0,
    2, 0, -0.5,
    1, 2, 0,
  ]);
});

test("bidirectional target chooses increase or decrease side", () => {
  const base = new Float64Array([0, 0, 0]);
  const decrease = [{index: 0, dx: -2, dy: 0, dz: 0}];
  const increase = [{index: 0, dx: 3, dy: 0, dz: 0}];

  assert.deepEqual(
    Array.from(applyBidirectionalTarget(base, decrease, increase, 0.5)),
    [1.5, 0, 0],
  );
  assert.deepEqual(
    Array.from(applyBidirectionalTarget(base, decrease, increase, -0.5)),
    [-1, 0, 0],
  );
});

test("target application rejects out-of-range source indices", () => {
  const base = new Float64Array([0, 0, 0]);

  assert.throws(
    () =>
      applyTarget(
        base,
        [{index: 4, dx: 1, dy: 0, dz: 0}],
        1,
      ),
    /out of range/,
  );
});

test("parsers reject malformed input", () => {
  assert.throws(() => parseMakeHumanObj("v 0 nope 0\nf 1 1 1"), /Invalid number/);
  assert.throws(
    () => parseMakeHumanTarget("0 1 2\n"),
    /Malformed target/,
  );
});
