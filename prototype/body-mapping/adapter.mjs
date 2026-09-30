const PI = Math.PI;

const PRIOR_RATIOS = {
  neutral: {
    armSpan: 1.0,
    sittingHeight: 0.52,
    shoulderBreadth: 0.24,
    chestCircumference: 0.54,
    underbustCircumference: 0.46,
    waistCircumference: 0.45,
    hipCircumference: 0.56,
    neckCircumference: 0.22,
    upperArmCircumference: 0.18,
    forearmCircumference: 0.16,
    wristCircumference: 0.095,
    thighCircumference: 0.33,
    calfCircumference: 0.22,
    ankleCircumference: 0.13,
    armLength: 0.36,
    inseam: 0.46,
    handLength: 0.11,
    handBreadth: 0.048,
    footLength: 0.15,
    footBreadth: 0.057,
    headCircumference: 0.33,
    bodyFatFraction: 0.22,
    muscularity: 0.40,
  },
  masculine: {
    armSpan: 1.01,
    sittingHeight: 0.52,
    shoulderBreadth: 0.255,
    chestCircumference: 0.56,
    underbustCircumference: 0.49,
    waistCircumference: 0.46,
    hipCircumference: 0.55,
    neckCircumference: 0.225,
    upperArmCircumference: 0.185,
    forearmCircumference: 0.165,
    wristCircumference: 0.10,
    thighCircumference: 0.325,
    calfCircumference: 0.225,
    ankleCircumference: 0.135,
    armLength: 0.365,
    inseam: 0.47,
    handLength: 0.112,
    handBreadth: 0.050,
    footLength: 0.153,
    footBreadth: 0.059,
    headCircumference: 0.335,
    bodyFatFraction: 0.18,
    muscularity: 0.50,
  },
  feminine: {
    armSpan: 0.995,
    sittingHeight: 0.525,
    shoulderBreadth: 0.225,
    chestCircumference: 0.55,
    underbustCircumference: 0.44,
    waistCircumference: 0.42,
    hipCircumference: 0.57,
    neckCircumference: 0.205,
    upperArmCircumference: 0.17,
    forearmCircumference: 0.15,
    wristCircumference: 0.09,
    thighCircumference: 0.34,
    calfCircumference: 0.215,
    ankleCircumference: 0.125,
    armLength: 0.355,
    inseam: 0.455,
    handLength: 0.105,
    handBreadth: 0.045,
    footLength: 0.147,
    footBreadth: 0.055,
    headCircumference: 0.325,
    bodyFatFraction: 0.26,
    muscularity: 0.35,
  },
};

function assertFinitePositive(value, name) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${name} must be a finite positive number`);
  }
  return value;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function cmToM(value) {
  return value / 100;
}

function fallbackCm(measurements, field, heightCm, ratio, fallbackFields) {
  const value = measurements[field];
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  fallbackFields.push(`measurements.${field}`);
  return heightCm * ratio;
}

function equivalentRadiusFromCircumference(circumferenceM) {
  return circumferenceM / (2 * PI);
}

function ellipseCircumference(a, b) {
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

function solveEllipseHalfDepth(circumferenceM, halfWidthM) {
  const minDepth = Math.max(0.02, halfWidthM * 0.25);
  let low = minDepth;
  let high = Math.max(halfWidthM * 2.0, circumferenceM / PI);

  if (ellipseCircumference(halfWidthM, low) > circumferenceM) {
    return minDepth;
  }

  for (let i = 0; i < 48; i += 1) {
    const mid = (low + high) / 2;
    if (ellipseCircumference(halfWidthM, mid) < circumferenceM) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function sectionFromMeasurements({
  circumferenceCm,
  breadthCm,
  depthCm,
  widthAspect,
}) {
  const explicitBreadth =
    Number.isFinite(breadthCm) && breadthCm > 0 ? cmToM(breadthCm) : null;
  const explicitDepth =
    Number.isFinite(depthCm) && depthCm > 0 ? cmToM(depthCm) : null;

  if (explicitBreadth && explicitDepth) {
    return {
      halfWidthM: explicitBreadth / 2,
      halfDepthM: explicitDepth / 2,
      usedExplicitCrossSection: true,
    };
  }

  const circumferenceM = cmToM(circumferenceCm);

  if (explicitBreadth) {
    return {
      halfWidthM: explicitBreadth / 2,
      halfDepthM: solveEllipseHalfDepth(circumferenceM, explicitBreadth / 2),
      usedExplicitCrossSection: true,
    };
  }

  if (explicitDepth) {
    const solvedHalfWidth = solveEllipseHalfDepth(
      circumferenceM,
      explicitDepth / 2,
    );
    return {
      halfWidthM: solvedHalfWidth,
      halfDepthM: explicitDepth / 2,
      usedExplicitCrossSection: true,
    };
  }

  const equivalentRadius = equivalentRadiusFromCircumference(circumferenceM);
  const halfWidth = equivalentRadius * widthAspect;
  const halfDepth = solveEllipseHalfDepth(circumferenceM, halfWidth);
  return {
    halfWidthM: halfWidth,
    halfDepthM: halfDepth,
    usedExplicitCrossSection: false,
  };
}

function circumferenceRadius(circumferenceCm, multiplier = 1) {
  return equivalentRadiusFromCircumference(cmToM(circumferenceCm)) * multiplier;
}

export function mapBodyToRenderModel(body) {
  if (!body || body.model !== "scc-body-v1") {
    throw new TypeError("body.model must be scc-body-v1");
  }

  const shapePrior = body.shapePrior ?? "neutral";
  const prior = PRIOR_RATIOS[shapePrior];
  if (!prior) {
    throw new TypeError(`Unsupported shapePrior: ${shapePrior}`);
  }

  const measurements = body.measurements ?? {};
  const fallbackFields = [];

  const heightCm = Number.isFinite(measurements.heightCm)
    ? assertFinitePositive(measurements.heightCm, "measurements.heightCm")
    : 170;

  if (!Number.isFinite(measurements.heightCm)) {
    fallbackFields.push("measurements.heightCm");
  }

  const get = (field, ratioKey = field.replace(/Cm$/, "")) =>
    fallbackCm(measurements, field, heightCm, prior[ratioKey], fallbackFields);

  const armSpanCm = get("armSpanCm", "armSpan");
  const sittingHeightCm = get("sittingHeightCm", "sittingHeight");
  const shoulderBreadthCm = get("shoulderBreadthCm", "shoulderBreadth");
  const chestCircumferenceCm = get("chestCircumferenceCm", "chestCircumference");
  const underbustCircumferenceCm = get("underbustCircumferenceCm", "underbustCircumference");
  const waistCircumferenceCm = get("waistCircumferenceCm", "waistCircumference");
  const hipCircumferenceCm = get("hipCircumferenceCm", "hipCircumference");
  const neckCircumferenceCm = get("neckCircumferenceCm", "neckCircumference");
  const upperArmCircumferenceCm = get("upperArmCircumferenceCm", "upperArmCircumference");
  const forearmCircumferenceCm = get("forearmCircumferenceCm", "forearmCircumference");
  const wristCircumferenceCm = get("wristCircumferenceCm", "wristCircumference");
  const thighCircumferenceCm = get("thighCircumferenceCm", "thighCircumference");
  const calfCircumferenceCm = get("calfCircumferenceCm", "calfCircumference");
  const ankleCircumferenceCm = get("ankleCircumferenceCm", "ankleCircumference");
  const armLengthCm = get("armLengthCm", "armLength");
  const inseamCm = get("inseamCm", "inseam");
  const handLengthCm = get("handLengthCm", "handLength");
  const handBreadthCm = get("handBreadthCm", "handBreadth");
  const footLengthCm = get("footLengthCm", "footLength");
  const footBreadthCm = get("footBreadthCm", "footBreadth");
  const headCircumferenceCm = get("headCircumferenceCm", "headCircumference");

  const bodyFatFraction = Number.isFinite(body.composition?.bodyFatFraction)
    ? clamp01(body.composition.bodyFatFraction)
    : prior.bodyFatFraction;
  if (!Number.isFinite(body.composition?.bodyFatFraction)) {
    fallbackFields.push("composition.bodyFatFraction");
  }

  const muscularity = Number.isFinite(body.composition?.muscularity)
    ? clamp01(body.composition.muscularity)
    : prior.muscularity;
  if (!Number.isFinite(body.composition?.muscularity)) {
    fallbackFields.push("composition.muscularity");
  }

  const softTissueScale = 0.92 + bodyFatFraction * 0.34;
  const muscleScale = 0.88 + muscularity * 0.28;

  const chest = sectionFromMeasurements({
    circumferenceCm: chestCircumferenceCm,
    breadthCm: measurements.chestBreadthCm,
    depthCm: measurements.chestDepthCm,
    widthAspect:
      shapePrior === "masculine" ? 1.19 : shapePrior === "feminine" ? 1.13 : 1.16,
  });
  const waist = sectionFromMeasurements({
    circumferenceCm: waistCircumferenceCm,
    breadthCm: measurements.waistBreadthCm,
    depthCm: measurements.waistDepthCm,
    widthAspect: shapePrior === "feminine" ? 1.16 : 1.14,
  });
  const hip = sectionFromMeasurements({
    circumferenceCm: hipCircumferenceCm,
    breadthCm: measurements.hipBreadthCm,
    depthCm: measurements.buttockDepthCm,
    widthAspect:
      shapePrior === "feminine" ? 1.23 : shapePrior === "masculine" ? 1.15 : 1.19,
  });

  for (const [section, fields] of [
    [chest, ["measurements.chestBreadthCm", "measurements.chestDepthCm"]],
    [waist, ["measurements.waistBreadthCm", "measurements.waistDepthCm"]],
    [hip, ["measurements.hipBreadthCm", "measurements.buttockDepthCm"]],
  ]) {
    if (!section.usedExplicitCrossSection) {
      fallbackFields.push(...fields);
    }
  }

  const heightM = cmToM(heightCm);
  const inseamM = Math.min(cmToM(inseamCm), heightM * 0.58);
  const headCircumferenceM = cmToM(headCircumferenceCm);
  const headHeightM = Math.min(heightM * 0.145, headCircumferenceM / PI * 1.28);
  const neckHeightM = heightM * 0.045;
  const pelvisHeightM = heightM * 0.105;
  const torsoHeightM = Math.max(
    heightM * 0.22,
    heightM - inseamM - headHeightM - neckHeightM - pelvisHeightM,
  );

  const upperLegLengthM = inseamM * 0.53;
  const lowerLegLengthM = inseamM * 0.47;
  const armLengthM = cmToM(armLengthCm);
  const handLengthM = cmToM(handLengthCm);
  const upperArmLengthM = Math.max(0.12, (armLengthM - handLengthM) * 0.52);
  const forearmLengthM = Math.max(0.11, (armLengthM - handLengthM) * 0.48);

  const limbScale = 0.78 + 0.16 * softTissueScale + 0.16 * muscleScale;

  return {
    rendererContract: "scc-procedural-body-render-v0",
    sourceModel: body.model,
    shapePrior,
    fallbackFields: [...new Set(fallbackFields)].sort(),
    dimensions: {
      heightM,
      armSpanM: cmToM(armSpanCm),
      sittingHeightM: cmToM(sittingHeightCm),
      shoulderBreadthM: cmToM(shoulderBreadthCm),
      underbustCircumferenceM: cmToM(underbustCircumferenceCm),
      head: {
        heightM: headHeightM,
        radiusM: headCircumferenceM / (2 * PI),
      },
      neck: {
        heightM: neckHeightM,
        radiusM: circumferenceRadius(neckCircumferenceCm),
      },
      torso: {
        heightM: torsoHeightM,
        chestHalfWidthM: chest.halfWidthM,
        chestHalfDepthM: chest.halfDepthM * softTissueScale,
        waistHalfWidthM: waist.halfWidthM,
        waistHalfDepthM: waist.halfDepthM * softTissueScale,
        hipHalfWidthM: hip.halfWidthM,
        hipHalfDepthM: hip.halfDepthM * softTissueScale,
      },
      pelvis: {
        heightM: pelvisHeightM,
        halfWidthM: hip.halfWidthM,
        halfDepthM: hip.halfDepthM * softTissueScale,
      },
      arms: {
        upperLengthM: upperArmLengthM,
        forearmLengthM,
        handLengthM,
        handBreadthM: cmToM(handBreadthCm),
        upperRadiusM: circumferenceRadius(upperArmCircumferenceCm, limbScale),
        forearmRadiusM: circumferenceRadius(forearmCircumferenceCm, limbScale),
        wristRadiusM: circumferenceRadius(wristCircumferenceCm),
      },
      legs: {
        upperLengthM: upperLegLengthM,
        lowerLengthM: lowerLegLengthM,
        upperRadiusM: circumferenceRadius(thighCircumferenceCm, limbScale),
        calfRadiusM: circumferenceRadius(calfCircumferenceCm, limbScale),
        ankleRadiusM: circumferenceRadius(ankleCircumferenceCm),
        footLengthM: cmToM(footLengthCm),
        footBreadthM: cmToM(footBreadthCm),
      },
    },
    composition: {
      bodyFatFraction,
      muscularity,
      softTissueScale,
      muscleScale,
    },
    unresolvedShapeDimensions: [
      "shoulderSlope",
      "torsoCrossSectionProfileBeyondBreadthDepth",
      "chestOrBreastProjection",
      "abdomenProjection",
      "gluteProjection",
      "upperToLowerLimbSegmentRatios",
      "posture",
      "leftRightAsymmetry",
      "regionalMuscleDistribution",
    ],
  };
}
