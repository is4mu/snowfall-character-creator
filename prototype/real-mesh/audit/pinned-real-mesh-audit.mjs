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
  applyBidirectionalTarget,
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
  measureShoulderBreadthCm,
} from "../makehuman-measurement.mjs";
import {
  measureChestCircumferenceCm,
} from "../chest-reference-plane.mjs";
import {
  sampleTorsoCrossSectionCurve,
} from "../torso-cross-section-audit.mjs";
import {
  fetchVerifiedAssetText,
} from "./pinned-asset-loader.mjs";

const CANONICAL_AUDIT = Object.freeze({
  heightCm: 162,
  shoulderBreadthCm: 38,
  chestCircumferenceCm: 88,
});

const UNDERBUST_AUDIT_WEIGHTS = Object.freeze([
  -1,
  -0.5,
  0,
  0.5,
  1,
]);

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

function summarizeCrossSectionCurve(curve) {
  return {
    contract: curve.contract,
    semanticStatus: curve.semanticStatus,
    lowerBodyHeightFraction: curve.lowerBodyHeightFraction,
    upperBodyHeightFraction: curve.upperBodyHeightFraction,
    sampleCount: curve.sampleCount,
    samples: curve.samples.map((sample) => ({
      index: sample.index,
      heightFraction: sample.heightFraction,
      status: sample.status,
      circumferenceCm: sample.circumferenceCm,
      loopCount: sample.loopCount,
      openChainCount: sample.openChainCount,
      branchNodeCount: sample.branchNodeCount,
      selectedLoopGeometry:
        sample.selectedLoopGeometry ?? null,
    })),
  };
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
  const underbustPair =
    MAKEHUMAN_MEASUREMENT_TARGETS.underbustCircumferenceCm;

  const [
    shoulderDecreaseDeltas,
    shoulderIncreaseDeltas,
    bustDecreaseDeltas,
    bustIncreaseDeltas,
    underbustDecreaseDeltas,
    underbustIncreaseDeltas,
  ] = await Promise.all([
    loadParsedTarget(shoulderPair.decrease, verifiedAssets),
    loadParsedTarget(shoulderPair.increase, verifiedAssets),
    loadParsedTarget(chestPair.decrease, verifiedAssets),
    loadParsedTarget(chestPair.increase, verifiedAssets),
    loadParsedTarget(underbustPair.decrease, verifiedAssets),
    loadParsedTarget(underbustPair.increase, verifiedAssets),
  ]);

  const endpoints = composeShapePriorEndpoints({
    feminineTargets,
    masculineTargets,
  });

  const results = [];
  const underbustExploration = [];

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

    const selectedChestFraction =
      reference.selected.heightFraction;
    const auditLowerFraction =
      Math.max(0, selectedChestFraction - 0.18);
    const auditUpperFraction =
      selectedChestFraction - 0.01;
    const solvedPositionsBefore =
      new Float64Array(solved.positions);
    const baselineCurve = sampleTorsoCrossSectionCurve({
      positions: solved.positions,
      triangles: bodyTriangles,
      bodyVertexIndices,
      canonicalHeightCm: CANONICAL_AUDIT.heightCm,
      lowerBodyHeightFraction: auditLowerFraction,
      upperBodyHeightFraction: auditUpperFraction,
      sampleCount: 29,
    });

    const targetEffects = UNDERBUST_AUDIT_WEIGHTS.map(
      (underbustWeight) => {
        const positions = applyBidirectionalTarget(
          solved.positions,
          underbustDecreaseDeltas,
          underbustIncreaseDeltas,
          underbustWeight,
        );
        const shoulderMeasuredCm = measureShoulderBreadthCm(
          positions,
          CANONICAL_AUDIT.heightCm,
          undefined,
          bodyVertexIndices,
        );
        const chest = measureChestCircumferenceCm({
          positions,
          triangles: bodyTriangles,
          bodyVertexIndices,
          canonicalHeightCm: CANONICAL_AUDIT.heightCm,
        });
        const curve = sampleTorsoCrossSectionCurve({
          positions,
          triangles: bodyTriangles,
          bodyVertexIndices,
          canonicalHeightCm: CANONICAL_AUDIT.heightCm,
          lowerBodyHeightFraction: auditLowerFraction,
          upperBodyHeightFraction: auditUpperFraction,
          sampleCount: 29,
        });

        return {
          underbustWeight,
          shoulderMeasuredCm,
          shoulderDeltaFromTargetCm:
            shoulderMeasuredCm - CANONICAL_AUDIT.shoulderBreadthCm,
          chestStatus: chest.status,
          chestMeasuredCm:
            chest.status === "measured"
              ? chest.circumferenceCm
              : null,
          chestDeltaFromTargetCm:
            chest.status === "measured"
              ? chest.circumferenceCm -
                CANONICAL_AUDIT.chestCircumferenceCm
              : null,
          selectedChestHeightFraction:
            chest.reference?.selected?.heightFraction ?? null,
          crossSectionCurve: summarizeCrossSectionCurve(curve),
        };
      },
    );

    assertFloatArrayUnchanged(
      solvedPositionsBefore,
      solved.positions,
      `${shapePrior} solved geometry during underbust audit`,
    );

    underbustExploration.push({
      contract: "scc-underbust-semantics-audit-v0",
      semanticStatus: "exploratory-only",
      shapePrior,
      targetPair: {
        modifier: underbustPair.modifier,
        calibrationStatus: underbustPair.calibrationStatus,
      },
      coordinateInterpretation: {
        genericSampler: "axis-semantic-neutral",
        makeHumanPositiveZ: "anterior",
        evidence: {
          upstreamCommit:
            MAKEHUMAN_ASSET_MANIFEST.upstreamCommit,
          path:
            "makehuman/data/povray/makehuman_facegroup_documentation.pov",
          blobSha:
            "cb7da1d84de32cef9d6d3d7a3c87bb6787f09835",
        },
        note:
          "Positive-Z is interpreted as anterior only inside this pinned MakeHuman audit; SCC canonical semantics do not depend on renderer axes.",
      },
      auditBand: {
        lowerBodyHeightFraction: auditLowerFraction,
        upperBodyHeightFraction: auditUpperFraction,
        relationToChest:
          "Samples a diagnostic band below the selected chest plane; this band is not an SCC underbust landmark definition.",
      },
      baselineCrossSectionCurve:
        summarizeCrossSectionCurve(baselineCurve),
      targetEffects,
      conclusion:
        "No underbust reference plane or calibration support is inferred by this audit.",
    });

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
    underbustExploration,
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
