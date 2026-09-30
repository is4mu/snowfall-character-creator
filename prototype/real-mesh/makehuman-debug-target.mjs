import { applyBidirectionalTarget } from "./makehuman-geometry.mjs";

export const RENDERER_TARGET_DEBUG_CONTRACT =
  "scc-makehuman-target-debug-v0";

export function applyRendererTargetDebug({
  basePositions,
  decreaseDeltas,
  increaseDeltas,
  signedWeight,
  field,
  modifier,
}) {
  if (!field || !modifier) {
    throw new TypeError("field and modifier are required");
  }

  const positions = applyBidirectionalTarget(
    basePositions,
    decreaseDeltas,
    increaseDeltas,
    signedWeight,
  );

  return {
    contract: RENDERER_TARGET_DEBUG_CONTRACT,
    rendererLocal: true,
    calibrated: false,
    field,
    modifier,
    signedWeight,
    positions,
  };
}
