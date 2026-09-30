import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  MAKEHUMAN_ASSET_MANIFEST,
  MAKEHUMAN_SHAPE_PRIOR_TARGETS,
} from "./asset-manifest.mjs";
import {
  getMakeHumanMeasurementTargetPair,
  planMakeHumanMapping,
} from "./makehuman-adapter.mjs";
import { solveShoulderBreadthTarget } from "./makehuman-calibration.mjs";
import {
  collectTriangleVertexIndices,
  getObjGroupTriangles,
  parseMakeHumanObj,
  parseMakeHumanTarget,
} from "./makehuman-geometry.mjs";
import {
  assertPinnedShoulderLandmarks,
  measurePositionBoundsUnits,
} from "./makehuman-measurement.mjs";
import {
  applyShapePrior,
  composeShapePriorEndpoints,
} from "./makehuman-shape-prior.mjs";

const viewport = document.querySelector("#viewport");
const diagnostics = document.querySelector("#diagnostics");
const sourceView = document.querySelector("#source-json");
const assetStatus = document.querySelector("#asset-status");
const heightInput = document.querySelector("#height");
const heightValue = document.querySelector("#height-value");
const priorSelect = document.querySelector("#shape-prior");
const shoulderBreadthInput = document.querySelector("#shoulder-breadth");
const shoulderBreadthValue = document.querySelector("#shoulder-breadth-value");
const shoulderCalibrationStatus = document.querySelector(
  "#shoulder-calibration-status",
);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f3f3);

const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
camera.position.set(2.1, 1.45, 3.5);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
viewport.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 7;

scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.1));

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 5, 4);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 0.9);
fill.position.set(-3, 2, -3);
scene.add(fill);

const grid = new THREE.GridHelper(4, 20, 0xbbbbbb, 0xdddddd);
scene.add(grid);

let workingBody;
let meshRoot;
let basePositions;
let bodyTriangles;
let bodyVertexIndices;
let currentBodyBounds;
let shapePriorEndpoints;
let shapePriorRender;
let shoulderTargetPair;
let shoulderTargetDeltas;
let shoulderCalibration;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resize() {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(500, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

function neutralGrayMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xb7b7b7,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
}

function fitMeshToCanonicalHeight(targetHeightM) {
  if (!meshRoot || !currentBodyBounds || currentBodyBounds.height <= 0) return;

  const scale = targetHeightM / currentBodyBounds.height;
  meshRoot.scale.setScalar(scale);
  meshRoot.position.set(
    -((currentBodyBounds.minX + currentBodyBounds.maxX) / 2) * scale,
    -currentBodyBounds.minY * scale,
    -((currentBodyBounds.minZ + currentBodyBounds.maxZ) / 2) * scale,
  );
  meshRoot.updateMatrixWorld(true);
}

function renderDiagnostics() {
  const plan = planMakeHumanMapping(workingBody);
  fitMeshToCanonicalHeight(plan.targetHeightM);

  const authoredCoverage = plan.coverage.filter((entry) => entry.value !== null);

  diagnostics.textContent = JSON.stringify(
    {
      adapterContract: plan.adapterContract,
      targetHeightM: plan.targetHeightM,
      shapePriorPlan: plan.shapePriorPlan,
      shapePriorRender: shapePriorRender
        ? {
            contract: shapePriorRender.contract,
            rendererLocal: shapePriorRender.rendererLocal,
            source: shapePriorRender.source,
            shapePrior: shapePriorRender.shapePrior,
            normalizedValue: shapePriorRender.normalizedValue,
            endpointPolicy: shapePriorRender.endpointPolicy,
          }
        : {status: "not-ready"},
      authoredCoverage,
      calibrationQueue: plan.calibrationQueue,
      prototypeCalibrations: plan.prototypeCalibrations,
      shoulderCalibration: shoulderCalibration
        ? {
            contract: shoulderCalibration.contract,
            status: shoulderCalibration.status,
            experimental: shoulderCalibration.experimental,
            targetCm: shoulderCalibration.targetCm,
            measuredCm: shoulderCalibration.measuredCm,
            residualCm: shoulderCalibration.residualCm,
            minReachableCm: shoulderCalibration.minReachableCm,
            maxReachableCm: shoulderCalibration.maxReachableCm,
            rendererWeight: shoulderCalibration.weight,
            iterations: shoulderCalibration.iterations,
          }
        : {
            status: "not-ready",
            targetCm: workingBody.measurements?.shoulderBreadthCm ?? null,
          },
      limitations: plan.limitations,
    },
    null,
    2,
  );

  sourceView.textContent = JSON.stringify(workingBody, null, 2);
}

async function fetchTargetDeltas(asset) {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(
      `Failed to load target ${asset.path}: HTTP ${response.status}`,
    );
  }
  return parseMakeHumanTarget(await response.text());
}

async function loadShoulderTargets() {
  shoulderTargetPair =
    getMakeHumanMeasurementTargetPair("shoulderBreadthCm");

  const [decreaseDeltas, increaseDeltas] = await Promise.all([
    fetchTargetDeltas(shoulderTargetPair.decrease),
    fetchTargetDeltas(shoulderTargetPair.increase),
  ]);

  shoulderTargetDeltas = {decreaseDeltas, increaseDeltas};
}

async function loadShapePriorTargets() {
  const [feminineTargets, masculineTargets] = await Promise.all([
    Promise.all(
      MAKEHUMAN_SHAPE_PRIOR_TARGETS.feminine.map(fetchTargetDeltas),
    ),
    Promise.all(
      MAKEHUMAN_SHAPE_PRIOR_TARGETS.masculine.map(fetchTargetDeltas),
    ),
  ]);

  shapePriorEndpoints = composeShapePriorEndpoints({
    feminineTargets,
    masculineTargets,
  });
}

function updateMeshPositions(positions) {
  if (!meshRoot) return;

  meshRoot.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  meshRoot.geometry.computeVertexNormals();
  currentBodyBounds = measurePositionBoundsUnits(
    positions,
    bodyVertexIndices,
  );
}

function renderCanonicalBody() {
  if (!meshRoot || !basePositions || !shapePriorEndpoints) {
    renderDiagnostics();
    return;
  }

  shapePriorRender = applyShapePrior({
    basePositions,
    endpoints: shapePriorEndpoints,
    shapePrior: workingBody.shapePrior ?? "neutral",
  });

  const priorPositions = shapePriorRender.positions;
  const canonicalHeightCm = workingBody.measurements?.heightCm;
  const targetShoulderBreadthCm =
    workingBody.measurements?.shoulderBreadthCm;

  if (
    !shoulderTargetDeltas ||
    !shoulderTargetPair ||
    !Number.isFinite(canonicalHeightCm) ||
    !Number.isFinite(targetShoulderBreadthCm)
  ) {
    shoulderCalibration = undefined;
    updateMeshPositions(priorPositions);
    shoulderCalibrationStatus.textContent =
      "Shoulder calibration requires loaded targets plus canonical heightCm and shoulderBreadthCm.";
    renderDiagnostics();
    return;
  }

  shoulderCalibration = solveShoulderBreadthTarget({
    basePositions: priorPositions,
    decreaseDeltas: shoulderTargetDeltas.decreaseDeltas,
    increaseDeltas: shoulderTargetDeltas.increaseDeltas,
    canonicalHeightCm,
    targetShoulderBreadthCm,
    heightVertexIndices: bodyVertexIndices,
    toleranceCm: 0.01,
  });

  updateMeshPositions(shoulderCalibration.positions);
  shoulderCalibrationStatus.textContent = JSON.stringify(
    {
      status: shoulderCalibration.status,
      experimental: true,
      targetCm: shoulderCalibration.targetCm,
      measuredCm: shoulderCalibration.measuredCm,
      residualCm: shoulderCalibration.residualCm,
      rendererWeight: shoulderCalibration.weight,
      reachableCm: [
        shoulderCalibration.minReachableCm,
        shoulderCalibration.maxReachableCm,
      ],
      precedence: "shapePrior -> explicit shoulderBreadthCm -> height fit",
    },
    null,
    2,
  );
  renderDiagnostics();
}

async function loadRealMesh() {
  try {
    const response = await fetch(MAKEHUMAN_ASSET_MANIFEST.baseMeshUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = parseMakeHumanObj(await response.text());

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(parsed.positions, 3),
    );
    bodyTriangles = getObjGroupTriangles(
      parsed,
      MAKEHUMAN_ASSET_MANIFEST.anthropometryGroup,
    );
    bodyVertexIndices = collectTriangleVertexIndices(bodyTriangles);

    if (
      bodyVertexIndices.length !==
        MAKEHUMAN_ASSET_MANIFEST.expectedBodyVertexCount ||
      bodyTriangles.length / 3 !==
        MAKEHUMAN_ASSET_MANIFEST.expectedBodyTriangleCount
    ) {
      throw new Error(
        "Pinned MakeHuman body group structure does not match the adapter manifest",
      );
    }
    geometry.setIndex(new THREE.BufferAttribute(bodyTriangles, 1));
    geometry.computeVertexNormals();

    meshRoot = new THREE.Mesh(geometry, neutralGrayMaterial());
    meshRoot.name = "Pinned MakeHuman CC0 base mesh";
    meshRoot.castShadow = true;
    basePositions = new Float64Array(parsed.positions);
    meshRoot.userData.originalVertexCount = parsed.vertexCount;
    meshRoot.userData.originalTriangleCount = parsed.triangleCount;
    meshRoot.userData.bodyTriangleCount = bodyTriangles.length / 3;
    meshRoot.userData.bodyVertexCount = bodyVertexIndices.length;
    meshRoot.userData.originalPositions = basePositions;

    currentBodyBounds = measurePositionBoundsUnits(
      basePositions,
      bodyVertexIndices,
    );
    assertPinnedShoulderLandmarks(basePositions);
    scene.add(meshRoot);

    await Promise.all([
      loadShapePriorTargets(),
      loadShoulderTargets(),
    ]);
    renderCanonicalBody();

    assetStatus.textContent = JSON.stringify(
      {
        loaded: true,
        repository: MAKEHUMAN_ASSET_MANIFEST.upstreamRepository,
        commit: MAKEHUMAN_ASSET_MANIFEST.upstreamCommit,
        blobSha: MAKEHUMAN_ASSET_MANIFEST.baseMeshBlobSha,
        license: MAKEHUMAN_ASSET_MANIFEST.assetLicense,
        vertexCount: parsed.vertexCount,
        totalTriangleCount: parsed.triangleCount,
        bodyTriangleCount: bodyTriangles.length / 3,
        bodyVertexCount: bodyVertexIndices.length,
        stableSourceVertexIndices: true,
        anthropometryGroup: MAKEHUMAN_ASSET_MANIFEST.anthropometryGroup,
        nativeBodyHeightUnits: currentBodyBounds.height,
        shapePriorAssets: {
          contract: MAKEHUMAN_SHAPE_PRIOR_TARGETS.contract,
          endpointAssetCount: 3,
          sourceNeutralized: true,
          loaded: true,
        },
        shoulderTargetPair: {
          modifier: shoulderTargetPair.modifier,
          calibrationStatus: shoulderTargetPair.calibrationStatus,
          decreaseBlobSha: shoulderTargetPair.decrease.blobSha,
          increaseBlobSha: shoulderTargetPair.increase.blobSha,
          loaded: true,
        },
      },
      null,
      2,
    );
  } catch (error) {
    assetStatus.textContent = [
      "Failed to load or parse pinned real-mesh assets.",
      String(error?.message ?? error),
      "",
      MAKEHUMAN_ASSET_MANIFEST.baseMeshUrl,
    ].join("\n");
  }
}

heightInput.addEventListener("input", () => {
  workingBody.measurements ??= {};
  workingBody.measurements.heightCm = Number(heightInput.value);
  heightValue.textContent = `${heightInput.value} cm`;
  renderCanonicalBody();
});

priorSelect.addEventListener("change", () => {
  workingBody.shapePrior = priorSelect.value;
  renderCanonicalBody();
});

shoulderBreadthInput.addEventListener("input", () => {
  workingBody.measurements ??= {};
  workingBody.measurements.shoulderBreadthCm =
    Number(shoulderBreadthInput.value);
  shoulderBreadthValue.textContent =
    `${shoulderBreadthInput.value} cm`;
  renderCanonicalBody();
});

document.querySelector("#front-view").addEventListener("click", () => {
  camera.position.set(0, 1.35, 3.4);
  controls.target.set(0, 0.9, 0);
  controls.update();
});

document.querySelector("#side-view").addEventListener("click", () => {
  camera.position.set(3.4, 1.35, 0);
  controls.target.set(0, 0.9, 0);
  controls.update();
});

async function loadCharacter() {
  const response = await fetch("../../schema/examples/full.character.json");
  if (!response.ok) {
    throw new Error(`Failed to load SCC example: ${response.status}`);
  }

  const sourceCharacter = await response.json();
  workingBody = deepClone(sourceCharacter.body);

  heightInput.value = workingBody.measurements?.heightCm ?? 170;
  heightValue.textContent = `${heightInput.value} cm`;
  priorSelect.value = workingBody.shapePrior ?? "neutral";
  shoulderBreadthInput.value =
    workingBody.measurements?.shoulderBreadthCm ?? 38;
  shoulderBreadthValue.textContent =
    `${shoulderBreadthInput.value} cm`;
  shoulderCalibrationStatus.textContent =
    "Loading pinned target assets and experimental renderer landmarks…";

  renderDiagnostics();
  await loadRealMesh();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

loadCharacter().catch((error) => {
  diagnostics.textContent = error.stack ?? String(error);
});

animate();
