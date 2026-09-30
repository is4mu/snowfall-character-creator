import { measurePositionArrayHeightUnits } from "./makehuman-measurement.mjs";

function assertPositions(positions) {
  if (!(positions instanceof Float64Array || positions instanceof Float32Array)) {
    throw new TypeError("positions must be a floating-point typed array");
  }
  if (positions.length % 3 !== 0) {
    throw new TypeError("positions length must be divisible by 3");
  }
}

function assertTriangles(triangles) {
  if (!(triangles instanceof Uint32Array) && !Array.isArray(triangles)) {
    throw new TypeError("triangles must be a Uint32Array or array");
  }
  if (triangles.length % 3 !== 0) {
    throw new TypeError("triangles length must be divisible by 3");
  }
}

function readVertex(positions, index) {
  const vertexCount = positions.length / 3;
  if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
    throw new RangeError(`triangle vertex index out of range: ${index}`);
  }

  const offset = index * 3;
  return {
    x: positions[offset],
    y: positions[offset + 1],
    z: positions[offset + 2],
  };
}

function pointKey(point, tolerance) {
  return [
    Math.round(point.x / tolerance),
    Math.round(point.z / tolerance),
  ].join(":");
}

function edgeIntersectionAtY(a, b, planeY, epsilon) {
  const da = a.y - planeY;
  const db = b.y - planeY;
  const aOn = Math.abs(da) <= epsilon;
  const bOn = Math.abs(db) <= epsilon;

  if (aOn && bOn) {
    return {coplanar: true, points: [a, b]};
  }
  if (aOn) return {coplanar: false, points: [a]};
  if (bOn) return {coplanar: false, points: [b]};
  if ((da > 0 && db > 0) || (da < 0 && db < 0)) {
    return {coplanar: false, points: []};
  }

  const t = da / (da - db);
  return {
    coplanar: false,
    points: [{
      x: a.x + (b.x - a.x) * t,
      y: planeY,
      z: a.z + (b.z - a.z) * t,
    }],
  };
}

function uniquePoints(points, tolerance) {
  const map = new Map();
  for (const point of points) {
    const key = pointKey(point, tolerance);
    if (!map.has(key)) map.set(key, point);
  }
  return [...map.values()];
}

function farthestPair(points) {
  let best = null;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      const dz = points[j].z - points[i].z;
      const distanceSquared = dx * dx + dz * dz;
      if (!best || distanceSquared > best.distanceSquared) {
        best = {
          a: points[i],
          b: points[j],
          distanceSquared,
        };
      }
    }
  }
  return best;
}

export function sliceMeshAtHorizontalPlane(
  positions,
  triangles,
  planeY,
  {
    epsilon = 1e-9,
    pointTolerance = 1e-7,
  } = {},
) {
  assertPositions(positions);
  assertTriangles(triangles);
  if (!Number.isFinite(planeY)) {
    throw new TypeError("planeY must be finite");
  }
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new TypeError("epsilon must be a finite positive number");
  }
  if (!Number.isFinite(pointTolerance) || pointTolerance <= 0) {
    throw new TypeError("pointTolerance must be a finite positive number");
  }

  const rawSegments = [];
  let coplanarTriangleCount = 0;

  for (let i = 0; i < triangles.length; i += 3) {
    const vertices = [
      readVertex(positions, triangles[i]),
      readVertex(positions, triangles[i + 1]),
      readVertex(positions, triangles[i + 2]),
    ];

    const distances = vertices.map((vertex) => vertex.y - planeY);
    if (
      distances.every((value) => value > epsilon) ||
      distances.every((value) => value < -epsilon)
    ) {
      continue;
    }

    if (distances.every((value) => Math.abs(value) <= epsilon)) {
      coplanarTriangleCount += 1;
      continue;
    }

    const points = [];
    for (const [aIndex, bIndex] of [[0, 1], [1, 2], [2, 0]]) {
      const result = edgeIntersectionAtY(
        vertices[aIndex],
        vertices[bIndex],
        planeY,
        epsilon,
      );
      points.push(...result.points);
    }

    const unique = uniquePoints(points, pointTolerance);
    if (unique.length < 2) continue;

    const pair = unique.length === 2
      ? {a: unique[0], b: unique[1]}
      : farthestPair(unique);

    if (!pair || pair.distanceSquared === 0) continue;

    rawSegments.push({
      a: {x: pair.a.x, z: pair.a.z},
      b: {x: pair.b.x, z: pair.b.z},
    });
  }

  return {
    planeY,
    rawSegments,
    coplanarTriangleCount,
  };
}

function canonicalEdgeKey(aKey, bKey) {
  return aKey < bKey
    ? `${aKey}|${bKey}`
    : `${bKey}|${aKey}`;
}

function segmentLength(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function polygonPerimeter(points) {
  let perimeter = 0;
  for (let i = 0; i < points.length; i += 1) {
    perimeter += segmentLength(
      points[i],
      points[(i + 1) % points.length],
    );
  }
  return perimeter;
}

function polygonCentroid(points) {
  let x = 0;
  let z = 0;
  for (const point of points) {
    x += point.x;
    z += point.z;
  }
  return {x: x / points.length, z: z / points.length};
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (
    let i = 0, j = polygon.length - 1;
    i < polygon.length;
    j = i, i += 1
  ) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      (a.z > point.z) !== (b.z > point.z) &&
      point.x <
        ((b.x - a.x) * (point.z - a.z)) /
          (b.z - a.z) +
          a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function buildCrossSectionLoops(
  rawSegments,
  {tolerance = 1e-6} = {},
) {
  if (!Array.isArray(rawSegments)) {
    throw new TypeError("rawSegments must be an array");
  }
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new TypeError("tolerance must be a finite positive number");
  }

  const nodeStats = new Map();
  const edges = new Map();

  function registerPoint(point) {
    const key = pointKey(point, tolerance);
    const current = nodeStats.get(key) ?? {
      xSum: 0,
      zSum: 0,
      count: 0,
    };
    current.xSum += point.x;
    current.zSum += point.z;
    current.count += 1;
    nodeStats.set(key, current);
    return key;
  }

  for (const segment of rawSegments) {
    if (!segment?.a || !segment?.b) {
      throw new TypeError("segment endpoints are required");
    }

    const aKey = registerPoint(segment.a);
    const bKey = registerPoint(segment.b);
    if (aKey === bKey) continue;

    const key = canonicalEdgeKey(aKey, bKey);
    if (!edges.has(key)) {
      edges.set(key, {aKey, bKey});
    }
  }

  const pointsByKey = new Map();
  for (const [key, stats] of nodeStats) {
    pointsByKey.set(key, {
      x: stats.xSum / stats.count,
      z: stats.zSum / stats.count,
    });
  }

  const adjacency = new Map();
  function addNeighbor(a, b) {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a).add(b);
  }
  for (const {aKey, bKey} of edges.values()) {
    addNeighbor(aKey, bKey);
    addNeighbor(bKey, aKey);
  }

  const branchNodeCount = [...adjacency.values()].filter(
    (neighbors) => neighbors.size > 2,
  ).length;

  const usedEdges = new Set();
  const loops = [];
  const openChains = [];

  for (const edgeKey of [...edges.keys()].sort()) {
    if (usedEdges.has(edgeKey)) continue;

    const edge = edges.get(edgeKey);
    const start = edge.aKey;
    let previous = start;
    let current = edge.bKey;
    const path = [start, current];
    usedEdges.add(edgeKey);

    let closed = false;
    const safetyLimit = edges.size + 2;

    while (path.length <= safetyLimit) {
      if (current === start) {
        closed = true;
        break;
      }

      const neighbors = [...(adjacency.get(current) ?? [])].sort();
      const candidates = neighbors.filter((neighbor) => {
        const candidateEdge = canonicalEdgeKey(current, neighbor);
        return !usedEdges.has(candidateEdge);
      });

      if (candidates.length === 0) break;

      let next = candidates.find((candidate) => candidate !== previous);
      if (!next) next = candidates[0];

      usedEdges.add(canonicalEdgeKey(current, next));
      previous = current;
      current = next;
      path.push(current);
    }

    if (closed && path.length >= 4) {
      const pointKeys = path.slice(0, -1);
      const points = pointKeys.map((key) => pointsByKey.get(key));
      loops.push({
        points,
        perimeterUnits: polygonPerimeter(points),
        centroid: polygonCentroid(points),
      });
    } else {
      openChains.push({
        points: path.map((key) => pointsByKey.get(key)),
      });
    }
  }

  loops.sort((a, b) => {
    if (b.perimeterUnits !== a.perimeterUnits) {
      return b.perimeterUnits - a.perimeterUnits;
    }
    if (a.centroid.x !== b.centroid.x) {
      return a.centroid.x - b.centroid.x;
    }
    return a.centroid.z - b.centroid.z;
  });

  return {
    segmentCount: edges.size,
    loops,
    openChains,
    branchNodeCount,
  };
}

export function measureHorizontalSurfaceLoopsUnits(
  positions,
  triangles,
  planeY,
  options = {},
) {
  const slice = sliceMeshAtHorizontalPlane(
    positions,
    triangles,
    planeY,
    options,
  );
  const topology = buildCrossSectionLoops(
    slice.rawSegments,
    options,
  );

  return {
    planeY,
    coplanarTriangleCount: slice.coplanarTriangleCount,
    ...topology,
  };
}

export function selectCentralSurfaceLoop(
  loops,
  center = {x: 0, z: 0},
) {
  if (!Array.isArray(loops) || loops.length === 0) {
    throw new RangeError("no closed cross-section loops are available");
  }
  if (!Number.isFinite(center.x) || !Number.isFinite(center.z)) {
    throw new TypeError("center must contain finite x and z values");
  }

  const containing = loops.filter((loop) =>
    pointInPolygon(center, loop.points),
  );
  if (containing.length > 0) {
    return [...containing].sort(
      (a, b) => b.perimeterUnits - a.perimeterUnits,
    )[0];
  }

  return [...loops].sort((a, b) => {
    const aDistance = Math.hypot(
      a.centroid.x - center.x,
      a.centroid.z - center.z,
    );
    const bDistance = Math.hypot(
      b.centroid.x - center.x,
      b.centroid.z - center.z,
    );
    if (aDistance !== bDistance) return aDistance - bDistance;
    return b.perimeterUnits - a.perimeterUnits;
  })[0];
}

export function measureCentralHorizontalCircumferenceCm({
  positions,
  triangles,
  planeY,
  canonicalHeightCm,
  heightVertexIndices,
  center = {x: 0, z: 0},
  options = {},
}) {
  if (!Number.isFinite(canonicalHeightCm) || canonicalHeightCm <= 0) {
    throw new TypeError(
      "canonicalHeightCm must be a finite positive number",
    );
  }

  const crossSection = measureHorizontalSurfaceLoopsUnits(
    positions,
    triangles,
    planeY,
    options,
  );

  if (crossSection.openChains.length > 0) {
    return {
      status: "open-cross-section",
      circumferenceCm: null,
      crossSection,
    };
  }

  if (crossSection.branchNodeCount > 0) {
    return {
      status: "non-manifold-cross-section",
      circumferenceCm: null,
      crossSection,
    };
  }

  const loop = selectCentralSurfaceLoop(
    crossSection.loops,
    center,
  );
  const rawHeight = measurePositionArrayHeightUnits(
    positions,
    heightVertexIndices,
  );
  const cmPerUnit = canonicalHeightCm / rawHeight;

  return {
    status: "measured",
    circumferenceCm: loop.perimeterUnits * cmPerUnit,
    perimeterUnits: loop.perimeterUnits,
    rawHeightUnits: rawHeight,
    cmPerUnit,
    selectedLoop: loop,
    crossSection,
  };
}
