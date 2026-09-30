import assert from "node:assert/strict";
import test from "node:test";

import { mapBodyToRenderModel } from "../adapter.mjs";

const explicitBody = {
  model: "scc-body-v1",
  shapePrior: "neutral",
  measurements: {
    heightCm: 170,
    shoulderBreadthCm: 40,
    chestCircumferenceCm: 92,
    waistCircumferenceCm: 76,
    hipCircumferenceCm: 94,
    inseamCm: 79,
    footLengthCm: 26,
  },
  composition: {
    bodyFatFraction: 0.22,
    muscularity: 0.4,
  },
};

test("maps SCC body input to a renderer-only contract", () => {
  const result = mapBodyToRenderModel(explicitBody);

  assert.equal(result.sourceModel, "scc-body-v1");
  assert.equal(result.rendererContract, "scc-procedural-body-render-v0");
  assert.equal(result.dimensions.heightM, 1.7);
  assert.equal(result.composition.bodyFatFraction, 0.22);
});

test("explicit semantic measurements override shape-prior defaults", () => {
  const feminine = mapBodyToRenderModel({
    ...explicitBody,
    shapePrior: "feminine",
  });
  const masculine = mapBodyToRenderModel({
    ...explicitBody,
    shapePrior: "masculine",
  });

  assert.equal(feminine.dimensions.shoulderBreadthM, 0.4);
  assert.equal(masculine.dimensions.shoulderBreadthM, 0.4);
  assert.equal(
    feminine.fallbackFields.includes("measurements.shoulderBreadthCm"),
    false,
  );
  assert.equal(
    masculine.fallbackFields.includes("measurements.shoulderBreadthCm"),
    false,
  );
});

test("shape prior only changes missing values", () => {
  const base = {
    model: "scc-body-v1",
    measurements: {
      heightCm: 170,
    },
  };

  const feminine = mapBodyToRenderModel({...base, shapePrior: "feminine"});
  const masculine = mapBodyToRenderModel({...base, shapePrior: "masculine"});

  assert.notEqual(
    feminine.dimensions.shoulderBreadthM,
    masculine.dimensions.shoulderBreadthM,
  );
  assert.ok(
    feminine.fallbackFields.includes("measurements.shoulderBreadthCm"),
  );
});

test("composition affects renderer parameters without changing source facts", () => {
  const lean = mapBodyToRenderModel({
    ...explicitBody,
    composition: {bodyFatFraction: 0.10, muscularity: 0.2},
  });
  const soft = mapBodyToRenderModel({
    ...explicitBody,
    composition: {bodyFatFraction: 0.40, muscularity: 0.2},
  });

  assert.equal(lean.dimensions.heightM, soft.dimensions.heightM);
  assert.ok(
    soft.dimensions.torso.waistHalfDepthM >
      lean.dimensions.torso.waistHalfDepthM,
  );
});

test("does not pretend underdetermined surface shape is solved", () => {
  const result = mapBodyToRenderModel(explicitBody);

  assert.ok(result.unresolvedShapeDimensions.includes("shoulderSlope"));
  assert.ok(
    result.unresolvedShapeDimensions.includes("chestOrBreastProjection"),
  );
  assert.ok(result.unresolvedShapeDimensions.includes("gluteProjection"));
  assert.ok(result.unresolvedShapeDimensions.includes("posture"));
});

test("rejects non-SCC body models", () => {
  assert.throws(
    () => mapBodyToRenderModel({model: "some-renderer-body"}),
    /scc-body-v1/,
  );
});
