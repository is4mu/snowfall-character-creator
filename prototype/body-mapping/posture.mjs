const DEG_TO_RAD = Math.PI / 180;

export const PREVIEW_POSTURE_CONTRACT = "scc-preview-posture-v0";

const LIMITS = {
  pelvicTiltDeg: [-20, 20],
  trunkFlexionDeg: [-15, 35],
  shoulderProtractionDeg: [0, 30],
  headForwardCm: [0, 12],
  headPitchDeg: [-25, 30],
};

export const DEFAULT_PREVIEW_POSTURE = Object.freeze({
  pelvicTiltDeg: 0,
  trunkFlexionDeg: 0,
  shoulderProtractionDeg: 0,
  headForwardCm: 0,
  headPitchDeg: 0,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finiteOrDefault(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function normalizePreviewPosture(input = {}) {
  const normalized = {};
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const fallback = DEFAULT_PREVIEW_POSTURE[field];
    normalized[field] = clamp(finiteOrDefault(input[field], fallback), min, max);
  }

  return {
    contract: PREVIEW_POSTURE_CONTRACT,
    ...normalized,
  };
}

export function derivePreviewPostureTransforms(input, dimensions) {
  const posture = normalizePreviewPosture(input);

  if (!dimensions || !Number.isFinite(dimensions.shoulderBreadthM)) {
    throw new TypeError("body dimensions with shoulderBreadthM are required");
  }

  const shoulderForwardM =
    Math.sin(posture.shoulderProtractionDeg * DEG_TO_RAD) *
    dimensions.shoulderBreadthM *
    0.35;

  return {
    contract: posture.contract,
    source: posture,
    pelvisPitchRad: posture.pelvicTiltDeg * DEG_TO_RAD,
    trunkPitchRad: posture.trunkFlexionDeg * DEG_TO_RAD,
    shoulderForwardM,
    headForwardM: posture.headForwardCm / 100,
    headPitchRad: posture.headPitchDeg * DEG_TO_RAD,
  };
}
