import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  MAKEHUMAN_ASSET_MANIFEST,
  MAKEHUMAN_MEASUREMENT_TARGETS,
  MAKEHUMAN_SHAPE_PRIOR_TARGETS,
} from "../asset-manifest.mjs";
import {
  solveCoupledChestCircumference,
} from "../makehuman-coupled-calibration.mjs";
import {
  collectTriangleVertexIndices,
  getObjGroupTriangles,
  parseMakeHumanObj,
  parseMakeHumanTarget,
} from "../makehuman-geometry.mjs";
import {
  applyShapePrior,
  composeShapePriorEndpoints,
} from "../makehuman-shape-prior.mjs";
import {
  fetchVerifiedAssetText,
} from "./pinned-asset-loader.mjs";

const CANONICAL_AUDIT = Object.freeze({
  heightCm: 162,
  shoulderBreadthCm: 38,
  chestCircumferenceCm: 88,
});

function outputPathFromArgs(args) {
  const index = args.indexOf("--output");
  if (index === -1) {
    return "artifacts/pinned-real-mesh-audit.json";
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new TypeError("--output requires a path");
  }
  return value;
}

function baseMeshAsset() {
  return {
    path: MAKEHUMAN_ASSET_MANIFEST.baseMeshPath,
    url: MAKEHUMAN_ASSET_MANIFEST.baseMeshUrl,
    blobSha: MAKEHUMAN_ASSET_MANIFEST.baseMeshBlobSha,
  };
}

async function loadParsedTarget(asset, verifiedAssets) {
  const result = await fetchVerifiedAssetText(asset);
  verifiedAssets.push({
    path: result.path,
    blobSha: result.actualBlobSha,
  });
  return parseMakeHumanTarget(result.text);
}

function assertFloatArrayUnchanged(before, after, label) {
  assert.equal(after.length, before.length, `${label} length changed`);
  for (let index = 0; index < before.length; index += 1) {
    if (before[index] !== after[index]) {
      throw new Error(
        `${label} mutated at scalar index ${index}: ` +
          `${before[index]} -> ${after[index]}`,
      );
    }
  }
}

function summarizeSolve(shapePrior, solved) {
  const chestReference =
    solved.best?.evaluation?.chest?.reference ?? null;
  const boundary =
    chestReference?.appendageMergeBoundary ?? null;
  const selected =
    chestReference?.selected ?? null;

  return {
    shapePrior,
    status: solved.status,
    source: solved.source ?? null,
    bustWeight: solved.bustWeight,
    shoulderWeight: solved.shoulderWeight,
    chestMeasuredCm: solved.chestMeasuredCm,
    chestResidualCm: solved.chestResidualCm,
    shoulderMeasuredCm: solved.shoulderMeasuredCm,
    shoulderResidualCm: solved.shoulderResidualCm,
    measuredChestRangeCm: solved.scan?.measuredRange ?? null,
    bracketCount: solved.scan?.brackets?.length ?? 0,
    selectedChestHeightFraction:
      selected?.heightFraction ?? null,
    appendageMergeBoundaryFraction:
      boundary?.boundaryHeightFraction ?? null,
    appendageMergeJumpRatio:
      boundary?.perimeterRatio ?? null,
  };
}

async function main() {
  const outputPath = outputPathFromArgs(process.argv.slice(2));
  const verifiedAssets = [];

  const baseAssetResult = await fetchVerifiedAssetText(
    baseMeshAsset(),
  );
  verifiedAssets.push({
    path: baseAssetResult.path,
    blobSha: baseAssetResult.actualBlobSha,
  });

  const parsed = parseMakeHumanObj(baseAssetResult.text);
  const bodyTriangles = getObjGroupTriangles(
    parsed,
    MAKEHUMAN_ASSET_MANIFEST.anthropometryGroup,
  );
  const bodyVertexIndices =
    collectTriangleVertexIndices(bodyTriangles);

  assert.equal(
    bodyVertexIndices.length,
    MAKEHUMAN_ASSET_MANIFEST.expectedBodyVertexCount,
    "pinned body vertex count drifted",
  );
  assert.equal(
    bodyTriangles.length / 3,
    MAKEHUMAN_ASSET_MANIFEST.expectedBodyTriangleCount,
    "pinned body triangle count drifted",
  );

  const [feminineTargets, masculineTargets] =
    await Promise.all([
      Promise.all(
        MAKEHUMAN_SHAPE_PRIOR_TARGETS.feminine.map(
          (asset) => loadParsedTarget(asset, verifiedAssets),
        ),
      ),
      Promise.all(
        MAKEHUMAN_SHAPE_PRIOR_TARGETS.masculine.map(
          (asset) => loadParsedTarget(asset, verifiedAssets),
        ),
      ),
    ]);

  const shoulderPair =
    MAKEHUMAN_MEASUREMENT_TARGETS.shoulderBreadthCm;
  const chestPair =
    MAKEHUMAN_MEASUREMENT_TARGETS.chestCircumferenceCm;

  const [
    shoulderDecreaseDeltas,
    shoulderIncreaseDeltas,
    bustDecreaseDeltas,
    bustIncreaseDeltas,
  ] = await Promise.all([
    loadParsedTarget(shoulderPair.decrease, verifiedAssets),
    loadParsedTarget(shoulderPair.increase, verifiedAssets),
    loadParsedTarget(chestPair.decrease, verifiedAssets),
    loadParsedTarget(chestPair.increase, verifiedAssets),
  ]);

  const endpoints = composeShapePriorEndpoints({
    feminineTargets,
    masculineTargets,
  });

  const results = [];

  for (const shapePrior of [
    "feminine",
    "neutral",
    "masculine",
  ]) {
    const prior = applyShapePrior({
      basePositions: parsed.positions,
      endpoints,
      shapePrior,
    });
    const priorBefore = new Float64Array(prior.positions);

    const solved = solveCoupledChestCircumference({
      priorPositions: prior.positions,
      bustDecreaseDeltas,
      bustIncreaseDeltas,
      shoulderDecreaseDeltas,
      shoulderIncreaseDeltas,
      canonicalHeightCm: CANONICAL_AUDIT.heightCm,
      targetShoulderBreadthCm:
        CANONICAL_AUDIT.shoulderBreadthCm,
      targetChestCircumferenceCm:
        CANONICAL_AUDIT.chestCircumferenceCm,
      bodyTriangles,
      bodyVertexIndices,
      sampleCount: 17,
      chestToleranceCm: 0.01,
      shoulderToleranceCm: 0.01,
      weightTolerance: 1e-6,
      maxIterations: 48,
    });

    assert.equal(
      solved.status,
      "solved",
      `${shapePrior}: coupled chest calibration did not solve`,
    );
    assert.ok(
      Math.abs(solved.chestResidualCm) <= 0.01,
      `${shapePrior}: chest residual exceeded 0.01 cm`,
    );
    assert.ok(
      Math.abs(solved.shoulderResidualCm) <= 0.01,
      `${shapePrior}: shoulder residual exceeded 0.01 cm`,
    );
    assert.ok(
      solved.bustWeight >= -1 && solved.bustWeight <= 1,
      `${shapePrior}: bust weight escaped renderer range`,
    );
    assert.ok(
      solved.shoulderWeight >= -1 &&
        solved.shoulderWeight <= 1,
      `${shapePrior}: shoulder weight escaped renderer range`,
    );

    const reference =
      solved.best?.evaluation?.chest?.reference;
    assert.ok(
      reference?.appendageMergeBoundary,
      `${shapePrior}: appendage merge boundary was not detected`,
    );
    assert.ok(
      reference.selected.heightFraction <
        reference.appendageMergeBoundary.boundaryHeightFraction,
      `${shapePrior}: selected chest plane is not below appendage merge boundary`,
    );

    assertFloatArrayUnchanged(
      priorBefore,
      prior.positions,
      `${shapePrior} prior geometry`,
    );

    results.push(summarizeSolve(shapePrior, solved));
  }

  verifiedAssets.sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  const report = {
    contract: "scc-pinned-real-mesh-audit-v0",
    generatedAt: new Date().toISOString(),
    upstream: {
      repository:
        MAKEHUMAN_ASSET_MANIFEST.upstreamRepository,
      commit: MAKEHUMAN_ASSET_MANIFEST.upstreamCommit,
      assetLicense:
        MAKEHUMAN_ASSET_MANIFEST.assetLicense,
    },
    canonical: CANONICAL_AUDIT,
    bodySurface: {
      group:
        MAKEHUMAN_ASSET_MANIFEST.anthropometryGroup,
      vertexCount: bodyVertexIndices.length,
      triangleCount: bodyTriangles.length / 3,
    },
    verifiedAssets,
    results,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error?.stack ?? String(error)}\n`,
  );
  process.exitCode = 1;
});
