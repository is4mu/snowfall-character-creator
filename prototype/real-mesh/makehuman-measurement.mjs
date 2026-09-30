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

function validateVertexIndex(index, vertexCount) {
  if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
    throw new RangeError(`vertex index out of range: ${index}`);
  }
}

export function measurePositionBoundsUnits(
  positions,
  vertexIndices = null,
) {
  assertPositionArray(positions);
  const vertexCount = positions.length / 3;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let measuredCount = 0;

  const visit = (index) => {
    validateVertexIndex(index, vertexCount);
    const offset = index * 3;
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
    measuredCount += 1;
  };

  if (vertexIndices === null) {
    for (let index = 0; index < vertexCount; index += 1) {
      visit(index);
    }
  } else {
    if (
      !(vertexIndices instanceof Uint32Array) &&
      !Array.isArray(vertexIndices)
    ) {
      throw new TypeError(
        "vertexIndices must be a Uint32Array, array, or null",
      );
    }
    for (const index of vertexIndices) visit(index);
  }

  if (measuredCount === 0) {
    throw new TypeError("measurement vertex set must not be empty");
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const depth = maxZ - minZ;

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(depth)
  ) {
    throw new TypeError("mesh position bounds are not finite");
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    width,
    height,
    depth,
    vertexCount: measuredCount,
  };
}

export function measurePositionArrayHeightUnits(
  positions,
  vertexIndices = null,
) {
  const {height} = measurePositionBoundsUnits(
    positions,
    vertexIndices,
  );
  if (height <= 0) {
    throw new TypeError("mesh position array has no positive height");
  }
  return height;
}

function readVertex(positions, index) {
  const vertexCount = positions.length / 3;
  validateVertexIndex(index, vertexCount);
  const offset = index * 3;
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
  heightVertexIndices = null,
) {
  assertPositionArray(positions);
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError("canonicalHeightCm must be a finite positive number");
  }

  const left = readVertex(positions, landmark.leftIndex);
  const right = readVertex(positions, landmark.rightIndex);
  const rawHeight = measurePositionArrayHeightUnits(
    positions,
    heightVertexIndices,
  );
  const cmPerRawUnit = canonicalHeightCm / rawHeight;

  return Math.abs(right[0] - left[0]) * cmPerRawUnit;
}
