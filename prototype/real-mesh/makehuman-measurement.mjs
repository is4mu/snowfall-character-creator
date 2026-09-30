export const MAKEHUMAN_RENDERER_LANDMARKS = Object.freeze({
  shoulderBreadth: Object.freeze({
    status: "provisional-cc0-derived",
    semanticTarget: "scc-body-v1.measurements.shoulderBreadthCm",
    leftIndex: 1357,
    rightIndex: 8049,
    expectedBaseLeft: Object.freeze([-1.8990, 5.2051, 0.6451]),
    expectedBaseRight: Object.freeze([1.8990, 5.2051, 0.6451]),
    note:
      "Adapter-specific landmark pair derived from exact mirror geometry inside the pinned CC0 shoulder target influence region. Requires visual anatomical audit before stable calibration.",
  }),
});

function assertPositionArray(positions) {
  if (!(positions instanceof Float64Array || positions instanceof Float32Array)) {
    throw new TypeError("positions must be a floating-point typed array");
  }
  if (positions.length % 3 !== 0) {
    throw new TypeError("positions length must be divisible by 3");
  }
}

export function measurePositionArrayHeightUnits(positions) {
  assertPositionArray(positions);

  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 1; i < positions.length; i += 3) {
    minY = Math.min(minY, positions[i]);
    maxY = Math.max(maxY, positions[i]);
  }

  const height = maxY - minY;
  if (!Number.isFinite(height) || height <= 0) {
    throw new TypeError("mesh position array has no positive height");
  }
  return height;
}

function readVertex(positions, index) {
  const offset = index * 3;
  if (!Number.isInteger(index) || index < 0 || offset + 2 >= positions.length) {
    throw new RangeError(`landmark vertex index out of range: ${index}`);
  }
  return [
    positions[offset],
    positions[offset + 1],
    positions[offset + 2],
  ];
}

function assertCoordinate(actual, expected, tolerance, label) {
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(actual[axis] - expected[axis]) > tolerance) {
      throw new Error(
        `${label} does not match pinned base mesh at axis ${axis}: ` +
          `expected ${expected[axis]}, got ${actual[axis]}`,
      );
    }
  }
}

export function assertPinnedShoulderLandmarks(
  positions,
  tolerance = 1e-6,
) {
  assertPositionArray(positions);
  const landmark = MAKEHUMAN_RENDERER_LANDMARKS.shoulderBreadth;

  const left = readVertex(positions, landmark.leftIndex);
  const right = readVertex(positions, landmark.rightIndex);

  assertCoordinate(
    left,
    landmark.expectedBaseLeft,
    tolerance,
    "left shoulder landmark",
  );
  assertCoordinate(
    right,
    landmark.expectedBaseRight,
    tolerance,
    "right shoulder landmark",
  );

  return {
    landmarkStatus: landmark.status,
    left,
    right,
  };
}

export function measureShoulderBreadthCm(
  positions,
  canonicalHeightCm,
  landmark = MAKEHUMAN_RENDERER_LANDMARKS.shoulderBreadth,
) {
  assertPositionArray(positions);
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError("canonicalHeightCm must be a finite positive number");
  }

  const left = readVertex(positions, landmark.leftIndex);
  const right = readVertex(positions, landmark.rightIndex);
  const rawHeight = measurePositionArrayHeightUnits(positions);
  const cmPerRawUnit = canonicalHeightCm / rawHeight;

  return Math.abs(right[0] - left[0]) * cmPerRawUnit;
}
