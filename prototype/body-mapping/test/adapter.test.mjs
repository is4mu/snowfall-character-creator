import assert from "node:assert/strict";
import test from "node:test";

import { mapBodyToRenderModel } from "../adapter.mjs";

const explicitBody = {
  model: "scc-body-v1",
  shapePrior: "neutral",
  measurements: {
    heightCm: 170,
    shoulderBreadthCm: 40,
    shoulderSlopeDeg: 12,
    armLengthCm: 64.5,
    upperArmLengthCm: 25,
    forearmLengthCm: 22,
    thighLengthCm: 41,
    lowerLegLengthCm: 38,
    handLengthCm: 17.5,
    chestCircumferenceCm: 92,
    chestBreadthCm: 31,
    chestDepthCm: 24,
    waistCircumferenceCm: 76,
    waistBreadthCm: 27,
    waistDepthCm: 20,
    abdominalDepthCm: 21.5,
    hipCircumferenceCm: 94,
    hipBreadthCm: 35,
    buttockDepthCm: 24,
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
  assert.equal(
    feminine.dimensions.torso.chestHalfDepthM,
    masculine.dimensions.torso.chestHalfDepthM,
  );
  assert.notEqual(
    feminine.rendererLocalSurface.chestAnteriorShare,
    masculine.rendererLocalSurface.chestAnteriorShare,
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

test("explicit shoulder slope and limb segment lengths map directly", () => {
  const result = mapBodyToRenderModel(explicitBody);

  assert.equal(result.dimensions.shoulderSlopeDeg, 12);
  assert.equal(result.dimensions.arms.upperLengthM, 0.25);
  assert.equal(result.dimensions.arms.forearmLengthM, 0.22);
  assert.equal(result.dimensions.legs.upperLengthM, 0.41);
  assert.equal(result.dimensions.legs.lowerLengthM, 0.38);

  for (const field of [
    "measurements.shoulderSlopeDeg",
    "measurements.upperArmLengthCm",
    "measurements.forearmLengthCm",
    "measurements.thighLengthCm",
    "measurements.lowerLegLengthCm",
  ]) {
    assert.equal(result.fallbackFields.includes(field), false);
  }
});

test("partial limb segment input reports only the missing segment", () => {
  const measurements = {...explicitBody.measurements};
  delete measurements.forearmLengthCm;

  const result = mapBodyToRenderModel({
    ...explicitBody,
    measurements,
  });

  assert.equal(
    result.fallbackFields.includes("measurements.upperArmLengthCm"),
    false,
  );
  assert.equal(
    result.fallbackFields.includes("measurements.forearmLengthCm"),
    true,
  );
  assert.equal(result.dimensions.arms.upperLengthM, 0.25);
});

test("explicit breadth and depth map directly to renderer cross-sections", () => {
  const result = mapBodyToRenderModel(explicitBody);

  assert.equal(result.dimensions.torso.chestHalfWidthM, 0.155);
  assert.equal(result.dimensions.torso.chestHalfDepthM, 0.12);
  assert.equal(result.dimensions.torso.waistHalfWidthM, 0.135);
  assert.equal(result.dimensions.torso.waistHalfDepthM, 0.10);
  assert.equal(result.dimensions.torso.hipHalfWidthM, 0.175);
  assert.equal(result.dimensions.torso.hipHalfDepthM, 0.12);
});

test("partial torso cross-section input reports only the missing dimension", () => {
  const measurements = {...explicitBody.measurements};
  delete measurements.chestDepthCm;

  const result = mapBodyToRenderModel({
    ...explicitBody,
    measurements,
  });

  assert.equal(
    result.fallbackFields.includes("measurements.chestBreadthCm"),
    false,
  );
  assert.equal(
    result.fallbackFields.includes("measurements.chestDepthCm"),
    true,
  );
});

test("abdominal depth is canonical while local surface distribution is renderer-only", () => {
  const before = JSON.stringify(explicitBody);
  const result = mapBodyToRenderModel(explicitBody);

  assert.equal(result.dimensions.torso.abdomenHalfDepthM, 0.1075);
  assert.equal(
    result.fallbackFields.includes("measurements.abdominalDepthCm"),
    false,
  );

  assert.equal(result.rendererLocalSurface.contract, "scc-procedural-surface-v0");
  assert.equal(
    Object.prototype.hasOwnProperty.call(explicitBody, "rendererLocalSurface"),
    false,
  );
  assert.equal(JSON.stringify(explicitBody), before);

  const repeated = mapBodyToRenderModel(explicitBody);
  assert.deepEqual(
    repeated.rendererLocalSurface,
    result.rendererLocalSurface,
  );
});

test("missing abdominal depth is an explicit renderer fallback", () => {
  const measurements = {...explicitBody.measurements};
  delete measurements.abdominalDepthCm;

  const result = mapBodyToRenderModel({
    ...explicitBody,
    measurements,
  });

  assert.equal(
    result.fallbackFields.includes("measurements.abdominalDepthCm"),
    true,
  );
  assert.ok(result.dimensions.torso.abdomenHalfDepthM > 0);
});

test("composition metadata does not rewrite explicit anthropometric dimensions", () => {
  const lean = mapBodyToRenderModel({
    ...explicitBody,
    composition: {bodyFatFraction: 0.10, muscularity: 0.2},
  });
  const soft = mapBodyToRenderModel({
    ...explicitBody,
    composition: {bodyFatFraction: 0.40, muscularity: 0.8},
  });

  assert.equal(
    lean.dimensions.torso.waistHalfDepthM,
    soft.dimensions.torso.waistHalfDepthM,
  );
  assert.equal(
    lean.dimensions.torso.chestHalfWidthM,
    soft.dimensions.torso.chestHalfWidthM,
  );
  assert.notEqual(
    lean.composition.bodyFatFraction,
    soft.composition.bodyFatFraction,
  );
});

test("does not pretend underdetermined surface shape is solved", () => {
  const result = mapBodyToRenderModel(explicitBody);

  assert.equal(
    result.unresolvedShapeDimensions.includes("shoulderSlope"),
    false,
  );
  assert.equal(
    result.unresolvedShapeDimensions.includes("upperToLowerLimbSegmentRatios"),
    false,
  );
  assert.equal(
    result.unresolvedShapeDimensions.includes("torsoCrossSectionProfile"),
    false,
  );
  assert.ok(
    result.unresolvedShapeDimensions.includes(
      "torsoCrossSectionProfileBeyondBreadthDepth",
    ),
  );
  assert.ok(
    result.unresolvedShapeDimensions.includes(
      "chestSurfaceDistributionBeyondGrossDepth",
    ),
  );
  assert.ok(
    result.unresolvedShapeDimensions.includes(
      "abdomenSurfaceDistributionBeyondDepth",
    ),
  );
  assert.ok(
    result.unresolvedShapeDimensions.includes(
      "gluteSurfaceDistributionBeyondGrossDepth",
    ),
  );
  assert.ok(result.unresolvedShapeDimensions.includes("posture"));
});

test("rejects non-SCC body models", () => {
  assert.throws(
    () => mapBodyToRenderModel({model: "some-renderer-body"}),
    /scc-body-v1/,
  );
});
