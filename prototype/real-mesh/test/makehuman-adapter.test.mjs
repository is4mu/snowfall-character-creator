import assert from "node:assert/strict";
import test from "node:test";

import {
  MAKEHUMAN_ASSET_MANIFEST,
  MAKEHUMAN_MEASUREMENT_TARGETS,
} from "../asset-manifest.mjs";
import {
  MAKEHUMAN_FIELD_MAPPING,
  getMakeHumanMeasurementTargetPair,
  makeHumanShapePriorPlan,
  planMakeHumanMapping,
} from "../makehuman-adapter.mjs";

const body = {
  model: "scc-body-v1",
  shapePrior: "feminine",
  measurements: {
    heightCm: 162,
    shoulderBreadthCm: 38,
    chestCircumferenceCm: 88,
    waistCircumferenceCm: 66,
    hipCircumferenceCm: 91,
    upperArmLengthCm: 25,
    forearmLengthCm: 22,
    thighLengthCm: 39,
    lowerLegLengthCm: 35,
    chestDepthCm: 23.5,
  },
  composition: {
    bodyFatFraction: 0.26,
    muscularity: 0.35,
  },
};

test("asset manifest is pinned to a CC0 graphical asset source", () => {
  assert.equal(MAKEHUMAN_ASSET_MANIFEST.assetLicense, "CC0-1.0");
  assert.equal(
    MAKEHUMAN_ASSET_MANIFEST.upstreamCommit,
    "a8bc2d54ff0ac92e78ff71431b1023eda42bf482",
  );
  assert.match(
    MAKEHUMAN_ASSET_MANIFEST.baseMeshUrl,
    /a8bc2d54ff0ac92e78ff71431b1023eda42bf482/,
  );
  assert.equal(
    MAKEHUMAN_ASSET_MANIFEST.upstreamCodeLicense,
    "AGPL-3.0-or-later",
  );
});

test("first shoulder target pair is pinned to exact upstream assets", () => {
  const pair = MAKEHUMAN_MEASUREMENT_TARGETS.shoulderBreadthCm;

  assert.equal(pair.calibrationStatus, "experimental-calibration");
  assert.equal(
    pair.decrease.blobSha,
    "eb25c3214db91206340ba5e28fcd7f29fadae4a9",
  );
  assert.equal(
    pair.increase.blobSha,
    "0d6ba8d828c7d9ee42ef18a814d413712214ac21",
  );
  assert.match(
    pair.decrease.url,
    /a8bc2d54ff0ac92e78ff71431b1023eda42bf482/,
  );
  assert.match(
    pair.increase.url,
    /a8bc2d54ff0ac92e78ff71431b1023eda42bf482/,
  );
});

test("adapter exposes only explicitly pinned target pairs", () => {
  const pair = getMakeHumanMeasurementTargetPair("shoulderBreadthCm");

  assert.equal(
    pair.modifier,
    "measure/measure-shoulder-dist-decr|incr",
  );
  assert.throws(
    () => getMakeHumanMeasurementTargetPair("waistBreadthCm"),
    /No pinned MakeHuman target pair/,
  );
});

test("stage 1 maps canonical height to a real-mesh scale target", () => {
  const plan = planMakeHumanMapping(body);

  assert.equal(plan.sourceModel, "scc-body-v1");
  assert.equal(plan.targetHeightM, 1.62);
  assert.equal(plan.adapterContract, "scc-makehuman-adapter-v0");
});

test("measurement coverage is explicit instead of silently approximated", () => {
  const plan = planMakeHumanMapping(body);
  const byField = new Map(plan.coverage.map((entry) => [entry.field, entry]));

  assert.equal(
    byField.get("measurements.shoulderBreadthCm").status,
    "prototype-calibrated",
  );
  assert.equal(
    byField.get("measurements.abdominalDepthCm").status,
    "unmapped",
  );
  assert.equal(
    byField.get("measurements.chestDepthCm").status,
    "unverified-upstream-candidate",
  );
});

test("all frozen Body Model measurement fields have an adapter coverage state", () => {
  assert.equal(Object.keys(MAKEHUMAN_FIELD_MAPPING).length, 35);

  for (const mapping of Object.values(MAKEHUMAN_FIELD_MAPPING)) {
    assert.ok(
      [
        "stage1-direct",
        "prototype-calibrated",
        "needs-calibration",
        "unmapped",
        "unverified-upstream-candidate",
      ].includes(mapping.status),
    );
  }
});

test("calibration queue includes only supported authored measurements", () => {
  const plan = planMakeHumanMapping(body);
  const fields = plan.calibrationQueue.map((item) => item.field);

  assert.equal(fields.includes("measurements.shoulderBreadthCm"), false);
  assert.ok(fields.includes("measurements.chestCircumferenceCm"));
  assert.ok(fields.includes("measurements.upperArmLengthCm"));
  assert.equal(fields.includes("measurements.chestDepthCm"), false);
});

test("prototype shoulder calibration is separated from pending calibration queue", () => {
  const plan = planMakeHumanMapping(body);

  assert.equal(plan.prototypeCalibrations.length, 1);
  assert.deepEqual(plan.prototypeCalibrations[0], {
    field: "measurements.shoulderBreadthCm",
    targetValue: 38,
    unit: "cm",
    modifier: "measure/measure-shoulder-dist-decr|incr",
    calibrationContract: "scc-makehuman-shoulder-calibration-v0",
    landmarkStatus: "provisional-cc0-derived",
  });
});

test("shapePrior plans renderer morphology without identity input", () => {
  assert.deepEqual(makeHumanShapePriorPlan("feminine"), {
    contract: "scc-makehuman-shape-prior-v0",
    value: 0,
    source: "body.shapePrior",
    rendererLocal: true,
    endpointPolicy: "equal-three-source-group-blend",
    precedence: "explicit-measurements-after-prior",
  });
  assert.equal(makeHumanShapePriorPlan("neutral").value, 0.5);
  assert.equal(makeHumanShapePriorPlan("masculine").value, 1);
});

test("body fat is not falsely equated with MakeHuman Weight", () => {
  const plan = planMakeHumanMapping(body);

  assert.equal(plan.composition.bodyFatFraction.status, "unmapped");
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      plan.composition.bodyFatFraction,
      "modifier",
    ),
    false,
  );
});

test("planning does not mutate canonical body data", () => {
  const before = JSON.stringify(body);
  planMakeHumanMapping(body);
  assert.equal(JSON.stringify(body), before);
});

test("rejects non-SCC body models", () => {
  assert.throws(
    () => planMakeHumanMapping({model: "makehuman-native"}),
    /scc-body-v1/,
  );
});
