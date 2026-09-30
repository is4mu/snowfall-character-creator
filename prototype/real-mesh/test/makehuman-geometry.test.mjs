import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBidirectionalTarget,
  applyTarget,
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
