import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  MAKEHUMAN_ASSET_MANIFEST,
  MAKEHUMAN_MEASUREMENT_TARGETS,
  MAKEHUMAN_SHAPE_PRIOR_TARGETS,
} from "../asset-manifest.mjs";
import {
  evaluateCoupledChestCandidate,
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
  findUnderbustReferencePlane,
} from "../underbust-reference-plane.mjs";
import {
  findThoraxReferenceLandmarks,
} from "../thorax-reference-landmarks.mjs";
import {
  CHEST_REFERENCE_SWEEP_CONTRACT,
  detectChestReferenceJumps,
  detectUnderbustTransitions,
  evenlySpacedWeights,
  jumpNeighborhoodIndices,
  summarizeChestSweepSample,
} from "../chest-reference-sweep.mjs";
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

const PRIMARY_CHEST_REFERENCE_SWEEP = Object.freeze({
  shapePrior: "feminine",
  canonicalHeightCm: 162,
  targetShoulderBreadthCm: 39,
  sampleCount: 81,
});

const CONTROL_CHEST_REFERENCE_SWEEPS = Object.freeze([
  Object.freeze({
    shapePrior: "feminine",
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 38,
    sampleCount: 17,
  }),
  Object.freeze({
    shapePrior: "neutral",
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 38,
    sampleCount: 17,
  }),
  Object.freeze({
    shapePrior: "masculine",
    canonicalHeightCm: 162,
    targetShoulderBreadthCm: 38,
    sampleCount: 17,
  }),
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


function summarizeUnderbustReference(reference, chestFraction, canonicalHeightCm) {
  if (!reference) {
    return {
      status: "not-evaluated",
      selectedHeightFraction: null,
      prominenceHeightFraction: null,
      peakHeightFraction: null,
      chestToUnderbustCm: null,
    };
  }

  const selectedFraction =
    reference.selected?.heightFraction ?? null;

  return {
    status: reference.status,
    selectedHeightFraction: selectedFraction,
    prominenceHeightFraction:
      reference.selected?.prominenceHeightFraction ?? null,
    peakHeightFraction:
      reference.selected?.peakHeightFraction ?? null,
    chestToUnderbustCm:
      Number.isFinite(chestFraction) &&
      Number.isFinite(selectedFraction)
        ? (chestFraction - selectedFraction) * canonicalHeightCm
        : null,
  };
}

function buildSweepJumpNeighborhood({
  jump,
  evaluations,
  summaries,
  bodyTriangles,
  bodyVertexIndices,
  canonicalHeightCm,
}) {
  const indices = jumpNeighborhoodIndices(
    summaries.length,
    [jump],
    1,
  );

  const neighborhood = indices.map((sampleIndex) => {
    const evaluation = evaluations[sampleIndex];
    const summary = summaries[sampleIndex];
    const chestFraction =
      summary.selectedChestHeightFraction;

    let underbustReference = null;
    if (
      evaluation?.status === "measured" &&
      Number.isFinite(chestFraction)
    ) {
      underbustReference = findUnderbustReferencePlane({
        positions: evaluation.positions,
        triangles: bodyTriangles,
        bodyVertexIndices,
        chestReferenceHeightFraction: chestFraction,
        surfaceDirection: {x: 0, z: 1},
      });
    }

    return {
      sampleIndex,
      ...summary,
      underbustReference:
        summarizeUnderbustReference(
          underbustReference,
          chestFraction,
          canonicalHeightCm,
        ),
    };
  });

  return {
    jump,
    neighborhood,
    underbustTransitions:
      detectUnderbustTransitions(neighborhood),
  };
}

function runChestReferenceSweep({
  priorPositions,
  shapePrior,
  canonicalHeightCm,
  targetShoulderBreadthCm,
  sampleCount,
  bustDecreaseDeltas,
  bustIncreaseDeltas,
  shoulderDecreaseDeltas,
  shoulderIncreaseDeltas,
  bodyTriangles,
  bodyVertexIndices,
}) {
  const before = new Float64Array(priorPositions);
  const weights = evenlySpacedWeights(sampleCount);

  const evaluations = weights.map((bustWeight) =>
    evaluateCoupledChestCandidate({
      priorPositions,
      bustDecreaseDeltas,
      bustIncreaseDeltas,
      bustWeight,
      shoulderDecreaseDeltas,
      shoulderIncreaseDeltas,
      canonicalHeightCm,
      targetShoulderBreadthCm,
      bodyTriangles,
      bodyVertexIndices,
      shoulderToleranceCm: 0.01,
    })
  );

  const samples = evaluations.map((evaluation, index) =>
    summarizeChestSweepSample({
      weight: weights[index],
      evaluation,
    })
  );

  const chestReferenceJumps =
    detectChestReferenceJumps(samples);

  const pairedThoraxSamples = evaluations.map(
    (evaluation, index) => {
      const weight = weights[index];

      if (
        evaluation?.status !== "measured" ||
        !evaluation.positions
      ) {
        return {
          weight,
          status: "invalid-evaluation",
          measuredChestCm: null,
          selectedChestHeightFraction: null,
          mode: null,
          underbustReference: {
            status: "not-evaluated",
            selectedHeightFraction: null,
          },
        };
      }

      const landmarks = findThoraxReferenceLandmarks({
        positions: evaluation.positions,
        triangles: bodyTriangles,
        bodyVertexIndices,
        surfaceDirection: {x: 0, z: 1},
      });

      const cmPerUnit =
        canonicalHeightCm / landmarks.bodyBounds.height;
      const selectedChestFraction =
        landmarks.chest?.heightFraction ?? null;
      const pairedChestCm =
        landmarks.status === "selected" &&
        Number.isFinite(landmarks.chest?.perimeterUnits)
          ? landmarks.chest.perimeterUnits * cmPerUnit
          : null;

      return {
        weight,
        status:
          landmarks.status === "selected"
            ? "measured"
            : landmarks.status,
        measuredChestCm: pairedChestCm,
        selectedChestHeightFraction:
          selectedChestFraction,
        mode: landmarks.mode,
        appendageMergeBoundaryFraction:
          landmarks.appendageMergeBoundary
            ?.boundaryHeightFraction ?? null,
        underbustReference: {
          status: landmarks.underbust.status,
          selectedHeightFraction:
            landmarks.underbust.selected
              ?.heightFraction ?? null,
          prominenceHeightFraction:
            landmarks.underbust.selected
              ?.prominenceHeightFraction ?? null,
          peakSeparationHeightFraction:
            landmarks.underbust.selected
              ?.peakSeparationHeightFraction ?? null,
        },
      };
    },
  );

  const pairedThoraxChestJumps =
    detectChestReferenceJumps(pairedThoraxSamples);
  const pairedThoraxUnderbustTransitions =
    detectUnderbustTransitions(pairedThoraxSamples);

  assert.equal(
    pairedThoraxChestJumps.length,
    0,
    `${shapePrior} shoulder-${targetShoulderBreadthCm}: paired thorax chest reference switched by more than one normal sample step`,
  );

  const jumpNeighborhoods = chestReferenceJumps.map((jump) =>
    buildSweepJumpNeighborhood({
      jump,
      evaluations,
      summaries: samples,
      bodyTriangles,
      bodyVertexIndices,
      canonicalHeightCm,
    })
  );

  assertFloatArrayUnchanged(
    before,
    priorPositions,
    `${shapePrior} shoulder-${targetShoulderBreadthCm} chest sweep prior geometry`,
  );

  const measuredValues = samples
    .map((sample) => sample.measuredChestCm)
    .filter(Number.isFinite);

  return {
    contract: CHEST_REFERENCE_SWEEP_CONTRACT,
    semanticStatus: "exploratory-only",
    shapePrior,
    canonicalHeightCm,
    targetShoulderBreadthCm,
    sampleCount,
    measuredChestRangeCm:
      measuredValues.length > 0
        ? {
            min: Math.min(...measuredValues),
            max: Math.max(...measuredValues),
          }
        : null,
    chestReferenceJumps,
    jumpNeighborhoods,
    samples,
    pairedThorax: {
      contract: "scc-thorax-reference-landmarks-v0",
      chestReferenceJumps: pairedThoraxChestJumps,
      underbustTransitions:
        pairedThoraxUnderbustTransitions,
      samples: pairedThoraxSamples,
    },
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
  const priorsByName = new Map();

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
    priorsByName.set(
      shapePrior,
      new Float64Array(prior.positions),
    );

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
    const baselineUnderbustReference =
      findUnderbustReferencePlane({
        positions: solved.positions,
        triangles: bodyTriangles,
        bodyVertexIndices,
        chestReferenceHeightFraction:
          selectedChestFraction,
        surfaceDirection: {x: 0, z: 1},
      });
    assert.equal(
      baselineUnderbustReference.status,
      "selected",
      `${shapePrior}: baseline underbust reference was not selected`,
    );

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
        const chestReferenceHeightFraction =
          chest.reference?.selected?.heightFraction ?? null;
        const underbustReference =
          chestReferenceHeightFraction === null
            ? null
            : findUnderbustReferencePlane({
                positions,
                triangles: bodyTriangles,
                bodyVertexIndices,
                chestReferenceHeightFraction,
                surfaceDirection: {x: 0, z: 1},
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
          underbustReference: underbustReference
            ? {
                contract: underbustReference.contract,
                status: underbustReference.status,
                selectedHeightFraction:
                  underbustReference.selected?.heightFraction ?? null,
                prominenceHeightFraction:
                  underbustReference.selected
                    ?.prominenceHeightFraction ?? null,
                peakHeightFraction:
                  underbustReference.selected?.peakHeightFraction ?? null,
                candidateCount:
                  underbustReference.candidates?.length ?? 0,
              }
            : null,
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
      baselineUnderbustReference: {
        contract: baselineUnderbustReference.contract,
        status: baselineUnderbustReference.status,
        selectedHeightFraction:
          baselineUnderbustReference.selected?.heightFraction ?? null,
        prominenceHeightFraction:
          baselineUnderbustReference.selected
            ?.prominenceHeightFraction ?? null,
        peakHeightFraction:
          baselineUnderbustReference.selected?.peakHeightFraction ?? null,
        candidateCount:
          baselineUnderbustReference.candidates?.length ?? 0,
      },
      targetEffects,
      conclusion:
        "No underbust reference plane or calibration support is inferred by this audit.",
    });

    for (const effect of targetEffects) {
      const isKnownNegative =
        shapePrior === "masculine" &&
        effect.underbustWeight === 1;

      if (isKnownNegative) {
        assert.equal(
          effect.underbustReference?.status,
          "no-stable-landmark",
          "masculine +1 underbust target must remain an explicit negative landmark case",
        );
        continue;
      }

      assert.equal(
        effect.underbustReference?.status,
        "selected",
        `${shapePrior} ${effect.underbustWeight}: expected a stable underbust reference`,
      );
      assert.ok(
        Number.isFinite(
          effect.underbustReference?.selectedHeightFraction,
        ) &&
          Number.isFinite(
            effect.selectedChestHeightFraction,
          ) &&
          effect.selectedChestHeightFraction -
            effect.underbustReference.selectedHeightFraction <=
            0.08 + 1e-12,
        `${shapePrior} ${effect.underbustWeight}: selected underbust reference escaped the immediate below-chest band`,
      );
    }

    results.push(summarizeSolve(shapePrior, solved));
  }

  const sweepCases = [
    PRIMARY_CHEST_REFERENCE_SWEEP,
    ...CONTROL_CHEST_REFERENCE_SWEEPS,
  ];

  const chestReferenceSweep = sweepCases.map((sweepCase) => {
    const priorPositions =
      priorsByName.get(sweepCase.shapePrior);
    assert.ok(
      priorPositions,
      `missing cached prior for ${sweepCase.shapePrior}`,
    );

    return runChestReferenceSweep({
      priorPositions,
      ...sweepCase,
      bustDecreaseDeltas,
      bustIncreaseDeltas,
      shoulderDecreaseDeltas,
      shoulderIncreaseDeltas,
      bodyTriangles,
      bodyVertexIndices,
    });
  });

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
    chestReferenceSweep,
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
