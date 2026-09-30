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

function pushTriangle(target, a, b, c) {
  target.push(a, b, c);
}

export function parseMakeHumanObj(text) {
  if (typeof text !== "string") {
    throw new TypeError("OBJ source must be a string");
  }

  const positions = [];
  const triangles = [];
  const groupTriangles = new Map();
  let currentGroup = "default";
  const lines = text.split(/\r?\n/);

  function currentGroupTarget() {
    if (!groupTriangles.has(currentGroup)) {
      groupTriangles.set(currentGroup, []);
    }
    return groupTriangles.get(currentGroup);
  }

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

    if (line.startsWith("g ")) {
      const name = line.slice(2).trim();
      currentGroup = name || "default";
      currentGroupTarget();
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
      const groupTarget = currentGroupTarget();

      for (let j = 1; j < face.length - 1; j += 1) {
        pushTriangle(triangles, face[0], face[j], face[j + 1]);
        pushTriangle(groupTarget, face[0], face[j], face[j + 1]);
      }
    }
  }

  if (positions.length === 0) {
    throw new TypeError("OBJ contains no vertices");
  }
  if (triangles.length === 0) {
    throw new TypeError("OBJ contains no faces");
  }

  const groups = {};
  for (const [name, values] of groupTriangles) {
    if (values.length === 0) continue;
    groups[name] = Object.freeze({
      triangleCount: values.length / 3,
      triangles: new Uint32Array(values),
    });
  }

  return {
    vertexCount: positions.length / 3,
    triangleCount: triangles.length / 3,
    positions: new Float64Array(positions),
    triangles: new Uint32Array(triangles),
    groups: Object.freeze(groups),
  };
}

export function getObjGroupTriangles(parsed, groupName) {
  if (!parsed?.groups || typeof groupName !== "string" || !groupName) {
    throw new TypeError("parsed OBJ groups and a non-empty groupName are required");
  }

  const group = parsed.groups[groupName];
  if (!group) {
    throw new RangeError(`OBJ group not found: ${groupName}`);
  }
  return group.triangles;
}

export function collectTriangleVertexIndices(triangles) {
  if (!(triangles instanceof Uint32Array) && !Array.isArray(triangles)) {
    throw new TypeError("triangles must be a Uint32Array or array");
  }
  if (triangles.length % 3 !== 0) {
    throw new TypeError("triangles length must be divisible by 3");
  }

  const indices = new Set();
  for (const index of triangles) {
    if (!Number.isInteger(index) || index < 0) {
      throw new TypeError(`invalid triangle vertex index: ${index}`);
    }
    indices.add(index);
  }

  return new Uint32Array([...indices].sort((a, b) => a - b));
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
