import { MAKEHUMAN_ASSET_MANIFEST } from "./asset-manifest.mjs";

export const MAKEHUMAN_FIELD_MAPPING = Object.freeze({
  heightCm: {
    status: "stage1-direct",
    strategy: "uniform-height-scale",
  },
  massKg: { status: "unmapped" },
  armSpanCm: { status: "unmapped" },
  sittingHeightCm: { status: "unmapped" },
  shoulderBreadthCm: {
    status: "needs-calibration",
    modifier: "measure/measure-shoulder-dist-decr|incr",
  },
  chestCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-bust-circ-decr|incr",
  },
  underbustCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-underbust-circ-decr|incr",
  },
  waistCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-waist-circ-decr|incr",
  },
  hipCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-hips-circ-decr|incr",
  },
  neckCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-neck-circ-decr|incr",
  },
  upperArmCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-upperarm-circ-decr|incr",
  },
  forearmCircumferenceCm: { status: "unmapped" },
  wristCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-wrist-circ-decr|incr",
  },
  thighCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-thigh-circ-decr|incr",
  },
  calfCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-calf-circ-decr|incr",
  },
  ankleCircumferenceCm: {
    status: "needs-calibration",
    modifier: "measure/measure-ankle-circ-decr|incr",
  },
  armLengthCm: { status: "unmapped" },
  inseamCm: { status: "unmapped" },
  handLengthCm: { status: "unmapped" },
  handBreadthCm: { status: "unmapped" },
  footLengthCm: { status: "unmapped" },
  footBreadthCm: { status: "unmapped" },
  headCircumferenceCm: { status: "unmapped" },
  chestBreadthCm: { status: "unmapped" },
  chestDepthCm: {
    status: "unverified-upstream-candidate",
    modifier: "measure/measure-frontchest-dist-decr|incr",
    note:
      "Upstream front-chest distance semantics have not yet been proven equivalent to SCC chestDepthCm.",
  },
  waistBreadthCm: { status: "unmapped" },
  waistDepthCm: { status: "unmapped" },
  hipBreadthCm: { status: "unmapped" },
  buttockDepthCm: { status: "unmapped" },
  shoulderSlopeDeg: { status: "unmapped" },
  upperArmLengthCm: {
    status: "needs-calibration",
    modifier: "measure/measure-upperarm-length-decr|incr",
  },
  forearmLengthCm: {
    status: "needs-calibration",
    modifier: "measure/measure-lowerarm-length-decr|incr",
  },
  thighLengthCm: {
    status: "needs-calibration",
    modifier: "measure/measure-upperleg-height-decr|incr",
  },
  lowerLegLengthCm: {
    status: "needs-calibration",
    modifier: "measure/measure-lowerleg-height-decr|incr",
  },
  abdominalDepthCm: { status: "unmapped" },
});

export const MAKEHUMAN_COMPOSITION_MAPPING = Object.freeze({
  bodyFatFraction: {
    status: "unmapped",
    note:
      "MakeHuman Weight is not assumed to be equivalent to SCC bodyFatFraction.",
  },
  muscularity: {
    status: "renderer-seed",
    modifier: "macrodetails-universal/Muscle",
    note:
      "Semantic initialization only; exact geometry must be validated before claiming calibrated support.",
  },
});

const SHAPE_PRIOR_SEED = Object.freeze({
  feminine: 0,
  neutral: 0.5,
  masculine: 1,
});

function positiveNumberOrNull(value) {
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function makeHumanShapePriorSeed(shapePrior = "neutral") {
  if (!(shapePrior in SHAPE_PRIOR_SEED)) {
    throw new TypeError(`Unsupported shapePrior: ${shapePrior}`);
  }

  return {
    modifier: "macrodetails/Gender",
    value: SHAPE_PRIOR_SEED[shapePrior],
    source: "body.shapePrior",
    rendererLocal: true,
  };
}

export function planMakeHumanMapping(body) {
  if (!body || body.model !== "scc-body-v1") {
    throw new TypeError("body.model must be scc-body-v1");
  }

  const measurements = body.measurements ?? {};
  const coverage = [];
  const calibrationQueue = [];

  for (const [field, mapping] of Object.entries(MAKEHUMAN_FIELD_MAPPING)) {
    const value = positiveNumberOrNull(measurements[field]);
    const entry = {
      field: `measurements.${field}`,
      value,
      ...mapping,
    };
    coverage.push(entry);

    if (value !== null && mapping.status === "needs-calibration") {
      calibrationQueue.push({
        field: entry.field,
        targetValue: value,
        unit: field.endsWith("Deg") ? "deg" : field === "massKg" ? "kg" : "cm",
        modifier: mapping.modifier,
      });
    }
  }

  const targetHeightCm = positiveNumberOrNull(measurements.heightCm) ?? 170;

  return {
    adapterContract: MAKEHUMAN_ASSET_MANIFEST.adapterContract,
    sourceModel: body.model,
    asset: MAKEHUMAN_ASSET_MANIFEST,
    targetHeightM: targetHeightCm / 100,
    shapePriorSeed: makeHumanShapePriorSeed(body.shapePrior ?? "neutral"),
    composition: {
      bodyFatFraction: {
        value: Number.isFinite(body.composition?.bodyFatFraction)
          ? body.composition.bodyFatFraction
          : null,
        ...MAKEHUMAN_COMPOSITION_MAPPING.bodyFatFraction,
      },
      muscularity: {
        value: Number.isFinite(body.composition?.muscularity)
          ? body.composition.muscularity
          : null,
        ...MAKEHUMAN_COMPOSITION_MAPPING.muscularity,
      },
    },
    coverage,
    calibrationQueue,
    limitations: [
      "Only canonical height is geometrically applied in stage 1.",
      "Measurement modifier names are renderer-local calibration candidates, not canonical SCC fields.",
      "No MakeHuman application code is reused.",
      "No unsupported SCC measurement is silently approximated.",
    ],
  };
}
