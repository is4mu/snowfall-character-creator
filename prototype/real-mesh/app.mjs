import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MAKEHUMAN_ASSET_MANIFEST } from "./asset-manifest.mjs";
import { planMakeHumanMapping } from "./makehuman-adapter.mjs";
import { parseMakeHumanObj } from "./makehuman-geometry.mjs";

const viewport = document.querySelector("#viewport");
const diagnostics = document.querySelector("#diagnostics");
const sourceView = document.querySelector("#source-json");
const assetStatus = document.querySelector("#asset-status");
const heightInput = document.querySelector("#height");
const heightValue = document.querySelector("#height-value");
const priorSelect = document.querySelector("#shape-prior");

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

let sourceCharacter;
let workingBody;
let meshRoot;
let nativeHeight = null;

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

function measureNativeHeight(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y;
}

function fitMeshToCanonicalHeight(targetHeightM) {
  if (!meshRoot || !nativeHeight || nativeHeight <= 0) return;

  meshRoot.scale.setScalar(targetHeightM / nativeHeight);
  meshRoot.position.set(0, 0, 0);
  meshRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(meshRoot);
  const center = new THREE.Vector3();
  box.getCenter(center);

  meshRoot.position.x -= center.x;
  meshRoot.position.z -= center.z;
  meshRoot.position.y -= box.min.y;
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
      shapePriorSeed: plan.shapePriorSeed,
      authoredCoverage,
      calibrationQueue: plan.calibrationQueue,
      limitations: plan.limitations,
    },
    null,
    2,
  );

  sourceView.textContent = JSON.stringify(workingBody, null, 2);
}

async function loadRealMesh() {
  try {
    const response = await fetch(MAKEHUMAN_ASSET_MANIFEST.baseMeshUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const source = await response.text();
    const parsed = parseMakeHumanObj(source);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(parsed.positions, 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(parsed.triangles, 1));
    geometry.computeVertexNormals();

    meshRoot = new THREE.Mesh(geometry, neutralGrayMaterial());
    meshRoot.name = "Pinned MakeHuman CC0 base mesh";
    meshRoot.castShadow = true;
    meshRoot.userData.originalVertexCount = parsed.vertexCount;
    meshRoot.userData.originalTriangleCount = parsed.triangleCount;
    meshRoot.userData.originalPositions = parsed.positions;

    nativeHeight = measureNativeHeight(meshRoot);
    scene.add(meshRoot);
    renderDiagnostics();

    assetStatus.textContent = JSON.stringify(
      {
        loaded: true,
        repository: MAKEHUMAN_ASSET_MANIFEST.upstreamRepository,
        commit: MAKEHUMAN_ASSET_MANIFEST.upstreamCommit,
        blobSha: MAKEHUMAN_ASSET_MANIFEST.baseMeshBlobSha,
        license: MAKEHUMAN_ASSET_MANIFEST.assetLicense,
        vertexCount: parsed.vertexCount,
        triangleCount: parsed.triangleCount,
        stableSourceVertexIndices: true,
        nativeObjHeightUnits: nativeHeight,
      },
      null,
      2,
    );
  } catch (error) {
    assetStatus.textContent = [
      "Failed to load or parse pinned base mesh.",
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
  renderDiagnostics();
});

priorSelect.addEventListener("change", () => {
  workingBody.shapePrior = priorSelect.value;
  renderDiagnostics();
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

  sourceCharacter = await response.json();
  workingBody = deepClone(sourceCharacter.body);

  heightInput.value = workingBody.measurements?.heightCm ?? 170;
  heightValue.textContent = `${heightInput.value} cm`;
  priorSelect.value = workingBody.shapePrior ?? "neutral";

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
