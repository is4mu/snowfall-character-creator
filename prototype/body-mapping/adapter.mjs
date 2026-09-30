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
    shoulderSlopeDeg: 12,
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
    shoulderSlopeDeg: 10,
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
    shoulderSlopeDeg: 14,
    bodyFatFraction: 0.26,
    muscularity: 0.35,
  },
};

const SURFACE_POLICY = {
  neutral: {
    chestAnteriorShare: 0.52,
    abdomenAnteriorShare: 0.52,
    glutePosteriorShare: 0.56,
  },
  masculine: {
    chestAnteriorShare: 0.50,
    abdomenAnteriorShare: 0.51,
    glutePosteriorShare: 0.54,
  },
  feminine: {
    chestAnteriorShare: 0.58,
    abdomenAnteriorShare: 0.54,
    glutePosteriorShare: 0.60,
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
      usedExplicitBreadth: true,
      usedExplicitDepth: true,
    };
  }

  const circumferenceM = cmToM(circumferenceCm);

  if (explicitBreadth) {
    return {
      halfWidthM: explicitBreadth / 2,
      halfDepthM: solveEllipseHalfDepth(circumferenceM, explicitBreadth / 2),
      usedExplicitBreadth: true,
      usedExplicitDepth: false,
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
      usedExplicitBreadth: false,
      usedExplicitDepth: true,
    };
  }

  const equivalentRadius = equivalentRadiusFromCircumference(circumferenceM);
  const halfWidth = equivalentRadius * widthAspect;
  const halfDepth = solveEllipseHalfDepth(circumferenceM, halfWidth);
  return {
    halfWidthM: halfWidth,
    halfDepthM: halfDepth,
    usedExplicitBreadth: false,
    usedExplicitDepth: false,
  };
}

function circumferenceRadius(circumferenceCm, multiplier = 1) {
  return equivalentRadiusFromCircumference(cmToM(circumferenceCm)) * multiplier;
}

function resolveSegmentPair({
  measurements,
  firstField,
  secondField,
  availableCm,
  firstRatio,
  fallbackFields,
}) {
  const first = measurements[firstField];
  const second = measurements[secondField];
  const hasFirst = Number.isFinite(first) && first > 0;
  const hasSecond = Number.isFinite(second) && second > 0;

  if (hasFirst && hasSecond) {
    return { firstCm: first, secondCm: second };
  }

  if (hasFirst) {
    fallbackFields.push(`measurements.${secondField}`);
    return {
      firstCm: first,
      secondCm: Math.max(1, availableCm - first),
    };
  }

  if (hasSecond) {
    fallbackFields.push(`measurements.${firstField}`);
    return {
      firstCm: Math.max(1, availableCm - second),
      secondCm: second,
    };
  }

  fallbackFields.push(
    `measurements.${firstField}`,
    `measurements.${secondField}`,
  );
  return {
    firstCm: availableCm * firstRatio,
    secondCm: availableCm * (1 - firstRatio),
  };
}

export function mapBodyToRenderModel(body) {
  if (!body || body.model !== "scc-body-v1") {
    throw new TypeError("body.model must be scc-body-v1");
  }

  const shapePrior = body.shapePrior ?? "neutral";
  const prior = PRIOR_RATIOS[shapePrior];
  const surfacePolicy = SURFACE_POLICY[shapePrior];
  if (!prior || !surfacePolicy) {
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

  const shoulderSlopeDeg = Number.isFinite(measurements.shoulderSlopeDeg)
    ? measurements.shoulderSlopeDeg
    : prior.shoulderSlopeDeg;
  if (!Number.isFinite(measurements.shoulderSlopeDeg)) {
    fallbackFields.push("measurements.shoulderSlopeDeg");
  }

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

  const hasAbdominalDepth =
    Number.isFinite(measurements.abdominalDepthCm) &&
    measurements.abdominalDepthCm > 0;
  const abdominalDepthCm = hasAbdominalDepth
    ? measurements.abdominalDepthCm
    : waist.halfDepthM * 2 * 100 * 1.08;
  if (!hasAbdominalDepth) {
    fallbackFields.push("measurements.abdominalDepthCm");
  }

  for (const [section, breadthField, depthField] of [
    [chest, "measurements.chestBreadthCm", "measurements.chestDepthCm"],
    [waist, "measurements.waistBreadthCm", "measurements.waistDepthCm"],
    [hip, "measurements.hipBreadthCm", "measurements.buttockDepthCm"],
  ]) {
    if (!section.usedExplicitBreadth) {
      fallbackFields.push(breadthField);
    }
    if (!section.usedExplicitDepth) {
      fallbackFields.push(depthField);
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

  const armLengthM = cmToM(armLengthCm);
  const handLengthM = cmToM(handLengthCm);
  const armSegments = resolveSegmentPair({
    measurements,
    firstField: "upperArmLengthCm",
    secondField: "forearmLengthCm",
    availableCm: Math.max(2, armLengthCm - handLengthCm),
    firstRatio: 0.52,
    fallbackFields,
  });
  const legSegments = resolveSegmentPair({
    measurements,
    firstField: "thighLengthCm",
    secondField: "lowerLegLengthCm",
    availableCm: Math.max(2, inseamCm),
    firstRatio: 0.53,
    fallbackFields,
  });
  const upperArmLengthM = cmToM(armSegments.firstCm);
  const forearmLengthM = cmToM(armSegments.secondCm);
  const upperLegLengthM = cmToM(legSegments.firstCm);
  const lowerLegLengthM = cmToM(legSegments.secondCm);

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
      shoulderSlopeDeg,
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
        chestHalfDepthM: chest.halfDepthM,
        waistHalfWidthM: waist.halfWidthM,
        waistHalfDepthM: waist.halfDepthM,
        abdomenHalfWidthM:
          waist.halfWidthM * 0.6 + chest.halfWidthM * 0.4,
        abdomenHalfDepthM: cmToM(abdominalDepthCm) / 2,
        hipHalfWidthM: hip.halfWidthM,
        hipHalfDepthM: hip.halfDepthM,
      },
      pelvis: {
        heightM: pelvisHeightM,
        halfWidthM: hip.halfWidthM,
        halfDepthM: hip.halfDepthM,
      },
      arms: {
        upperLengthM: upperArmLengthM,
        forearmLengthM,
        handLengthM,
        handBreadthM: cmToM(handBreadthCm),
        upperRadiusM: circumferenceRadius(upperArmCircumferenceCm),
        forearmRadiusM: circumferenceRadius(forearmCircumferenceCm),
        wristRadiusM: circumferenceRadius(wristCircumferenceCm),
      },
      legs: {
        upperLengthM: upperLegLengthM,
        lowerLengthM: lowerLegLengthM,
        upperRadiusM: circumferenceRadius(thighCircumferenceCm),
        calfRadiusM: circumferenceRadius(calfCircumferenceCm),
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
    rendererLocalSurface: {
      contract: "scc-procedural-surface-v0",
      chestAnteriorShare: surfacePolicy.chestAnteriorShare,
      abdomenAnteriorShare: surfacePolicy.abdomenAnteriorShare,
      glutePosteriorShare: surfacePolicy.glutePosteriorShare,
      note:
        "Renderer-local front/back distribution policy. These values are recomputed and are not canonical Character Schema fields.",
    },
    unresolvedShapeDimensions: [
      "torsoCrossSectionProfileBeyondBreadthDepth",
      "chestSurfaceDistributionBeyondGrossDepth",
      "abdomenSurfaceDistributionBeyondDepth",
      "gluteSurfaceDistributionBeyondGrossDepth",
      "posture",
      "leftRightAsymmetry",
      "regionalMuscleDistribution",
    ],
  };
}
