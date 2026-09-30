function parseFiniteNumber(token, context) {
  const value = Number(token);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Invalid number in ${context}: ${token}`);
  }
  return value;
}

function parseObjVertexIndex(token, vertexCount, lineNumber) {
  const raw = token.split("/")[0];
  const index = Number.parseInt(raw, 10);
  if (!Number.isInteger(index) || index === 0) {
    throw new TypeError(
      `Invalid OBJ vertex reference at line ${lineNumber}: ${token}`,
    );
  }

  const zeroBased = index > 0 ? index - 1 : vertexCount + index;
  if (zeroBased < 0 || zeroBased >= vertexCount) {
    throw new RangeError(
      `OBJ vertex index out of range at line ${lineNumber}: ${token}`,
    );
  }
  return zeroBased;
}

export function parseMakeHumanObj(text) {
  if (typeof text !== "string") {
    throw new TypeError("OBJ source must be a string");
  }

  const positions = [];
  const triangles = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("v ")) {
      const parts = line.split(/\s+/);
      if (parts.length < 4) {
        throw new TypeError(`Malformed OBJ vertex at line ${lineNumber}`);
      }
      positions.push(
        parseFiniteNumber(parts[1], `OBJ vertex line ${lineNumber}`),
        parseFiniteNumber(parts[2], `OBJ vertex line ${lineNumber}`),
        parseFiniteNumber(parts[3], `OBJ vertex line ${lineNumber}`),
      );
      continue;
    }

    if (line.startsWith("f ")) {
      const refs = line.split(/\s+/).slice(1);
      if (refs.length < 3) {
        throw new TypeError(`Malformed OBJ face at line ${lineNumber}`);
      }

      const vertexCount = positions.length / 3;
      const face = refs.map((token) =>
        parseObjVertexIndex(token, vertexCount, lineNumber),
      );

      for (let j = 1; j < face.length - 1; j += 1) {
        triangles.push(face[0], face[j], face[j + 1]);
      }
    }
  }

  if (positions.length === 0) {
    throw new TypeError("OBJ contains no vertices");
  }
  if (triangles.length === 0) {
    throw new TypeError("OBJ contains no faces");
  }

  return {
    vertexCount: positions.length / 3,
    triangleCount: triangles.length / 3,
    positions: new Float64Array(positions),
    triangles: new Uint32Array(triangles),
  };
}

export function parseMakeHumanTarget(text) {
  if (typeof text !== "string") {
    throw new TypeError("Target source must be a string");
  }

  const deltas = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    if (parts.length !== 4) {
      throw new TypeError(`Malformed target line ${lineNumber}`);
    }

    const index = Number.parseInt(parts[0], 10);
    if (!Number.isInteger(index) || index < 0) {
      throw new TypeError(`Invalid target vertex index at line ${lineNumber}`);
    }
    if (seen.has(index)) {
      throw new TypeError(`Duplicate target vertex index at line ${lineNumber}`);
    }
    seen.add(index);

    deltas.push({
      index,
      dx: parseFiniteNumber(parts[1], `target line ${lineNumber}`),
      dy: parseFiniteNumber(parts[2], `target line ${lineNumber}`),
      dz: parseFiniteNumber(parts[3], `target line ${lineNumber}`),
    });
  }

  return deltas;
}

export function applyTarget(basePositions, deltas, weight) {
  if (!(basePositions instanceof Float64Array || basePositions instanceof Float32Array)) {
    throw new TypeError("basePositions must be a floating-point typed array");
  }
  if (basePositions.length % 3 !== 0) {
    throw new TypeError("basePositions length must be divisible by 3");
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new RangeError("target weight must be between 0 and 1");
  }

  const result = new Float64Array(basePositions);
  const vertexCount = result.length / 3;

  for (const delta of deltas) {
    if (
      !delta ||
      !Number.isInteger(delta.index) ||
      delta.index < 0 ||
      delta.index >= vertexCount
    ) {
      throw new RangeError(`Target vertex index out of range: ${delta?.index}`);
    }

    const offset = delta.index * 3;
    result[offset] += delta.dx * weight;
    result[offset + 1] += delta.dy * weight;
    result[offset + 2] += delta.dz * weight;
  }

  return result;
}

export function applyBidirectionalTarget(
  basePositions,
  decreaseDeltas,
  increaseDeltas,
  signedWeight,
) {
  if (!Number.isFinite(signedWeight) || signedWeight < -1 || signedWeight > 1) {
    throw new RangeError("signed target weight must be between -1 and 1");
  }

  if (signedWeight === 0) {
    return new Float64Array(basePositions);
  }

  if (signedWeight > 0) {
    return applyTarget(basePositions, increaseDeltas, signedWeight);
  }

  return applyTarget(basePositions, decreaseDeltas, Math.abs(signedWeight));
}
