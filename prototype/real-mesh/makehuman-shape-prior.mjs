import { applyTarget } from "./makehuman-geometry.mjs";

export const SHAPE_PRIOR_CONTRACT =
  "scc-makehuman-shape-prior-v0";

const SHAPE_PRIOR_VALUE = Object.freeze({
  feminine: 0,
  neutral: 0.5,
  masculine: 1,
});

function validateTargetList(targets, label) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new TypeError(`${label} must contain at least one parsed target`);
  }
  for (const target of targets) {
    if (!Array.isArray(target)) {
      throw new TypeError(`${label} must contain parsed target arrays`);
    }
  }
}

function toDeltaMap(deltas) {
  const map = new Map();
  for (const delta of deltas) {
    if (
      !delta ||
      !Number.isInteger(delta.index) ||
      delta.index < 0 ||
      !Number.isFinite(delta.dx) ||
      !Number.isFinite(delta.dy) ||
      !Number.isFinite(delta.dz)
    ) {
      throw new TypeError("invalid parsed target delta");
    }
    if (map.has(delta.index)) {
      throw new TypeError(`duplicate target vertex index: ${delta.index}`);
    }
    map.set(delta.index, delta);
  }
  return map;
}

export function averageTargetDeltas(targets) {
  validateTargetList(targets, "targets");

  const maps = targets.map(toDeltaMap);
  const indices = new Set();

  for (const map of maps) {
    for (const index of map.keys()) indices.add(index);
  }

  const result = [];
  const count = maps.length;

  for (const index of [...indices].sort((a, b) => a - b)) {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    for (const map of maps) {
      const delta = map.get(index);
      if (delta) {
        dx += delta.dx;
        dy += delta.dy;
        dz += delta.dz;
      }
    }

    result.push({
      index,
      dx: dx / count,
      dy: dy / count,
      dz: dz / count,
    });
  }

  return result;
}

export function interpolateTargetDeltas(
  startDeltas,
  endDeltas,
  amount,
) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError("interpolation amount must be between 0 and 1");
  }

  const start = toDeltaMap(startDeltas);
  const end = toDeltaMap(endDeltas);
  const indices = new Set([...start.keys(), ...end.keys()]);
  const result = [];

  for (const index of [...indices].sort((a, b) => a - b)) {
    const a = start.get(index) ?? {dx: 0, dy: 0, dz: 0};
    const b = end.get(index) ?? {dx: 0, dy: 0, dz: 0};

    result.push({
      index,
      dx: a.dx * (1 - amount) + b.dx * amount,
      dy: a.dy * (1 - amount) + b.dy * amount,
      dz: a.dz * (1 - amount) + b.dz * amount,
    });
  }

  return result;
}

export function shapePriorValue(shapePrior) {
  if (!Object.hasOwn(SHAPE_PRIOR_VALUE, shapePrior)) {
    throw new TypeError(`Unsupported shapePrior: ${shapePrior}`);
  }
  return SHAPE_PRIOR_VALUE[shapePrior];
}

export function composeShapePriorEndpoints({
  feminineTargets,
  masculineTargets,
}) {
  validateTargetList(feminineTargets, "feminineTargets");
  validateTargetList(masculineTargets, "masculineTargets");

  return {
    feminine: averageTargetDeltas(feminineTargets),
    masculine: averageTargetDeltas(masculineTargets),
  };
}

export function applyShapePrior({
  basePositions,
  endpoints,
  shapePrior,
}) {
  if (!endpoints?.feminine || !endpoints?.masculine) {
    throw new TypeError("shape prior endpoints are required");
  }

  const normalizedValue = shapePriorValue(shapePrior);
  const deltas = interpolateTargetDeltas(
    endpoints.feminine,
    endpoints.masculine,
    normalizedValue,
  );
  const positions = applyTarget(basePositions, deltas, 1);

  return {
    contract: SHAPE_PRIOR_CONTRACT,
    rendererLocal: true,
    source: "body.shapePrior",
    shapePrior,
    normalizedValue,
    endpointPolicy: "equal-three-source-group-blend",
    positions,
  };
}
