import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { mapBodyToRenderModel } from "./adapter.mjs";
import { DEFAULT_PREVIEW_POSTURE } from "./posture.mjs";
import { createProceduralBody } from "./renderer.mjs";

const canvasHost = document.querySelector("#viewport");
const diagnostics = document.querySelector("#diagnostics");
const sourceView = document.querySelector("#source-json");
const priorSelect = document.querySelector("#shape-prior");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f3f3);

const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
camera.position.set(2.1, 1.55, 3.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasHost.append(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.minDistance = 1.8;
controls.maxDistance = 7;

scene.add(new THREE.HemisphereLight(0xffffff, 0x777777, 2.0));

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 5, 4);
key.castShadow = true;
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.0);
fill.position.set(-3, 2, -2);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.1, 64),
  new THREE.MeshStandardMaterial({
    color: 0xdedede,
    roughness: 1,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const axes = new THREE.GridHelper(4, 20, 0xbbbbbb, 0xdddddd);
scene.add(axes);

let sourceCharacter;
let workingBody;
let previewPosture = {...DEFAULT_PREVIEW_POSTURE};
let bodyObject;

const postureControlsConfig = [
  ["pelvicTiltDeg", "Pelvic tilt", -20, 20, 1, "deg"],
  ["trunkFlexionDeg", "Trunk flexion", -15, 35, 1, "deg"],
  ["shoulderProtractionDeg", "Shoulder protraction", 0, 30, 1, "deg"],
  ["headForwardCm", "Head forward", 0, 12, 0.5, "cm"],
  ["headPitchDeg", "Head pitch", -25, 30, 1, "deg"],
];

const controlsConfig = [
  ["heightCm", "Height", 140, 205, 1],
  ["shoulderBreadthCm", "Shoulder breadth", 30, 55, 0.5],
  ["shoulderSlopeDeg", "Shoulder slope", 0, 35, 1, "deg"],
  ["upperArmLengthCm", "Upper-arm length", 18, 40, 0.5],
  ["forearmLengthCm", "Forearm length", 18, 35, 0.5],
  ["thighLengthCm", "Thigh length", 28, 50, 0.5],
  ["lowerLegLengthCm", "Lower-leg length", 25, 50, 0.5],
  ["chestCircumferenceCm", "Chest circumference", 65, 125, 1],
  ["chestBreadthCm", "Chest breadth", 20, 45, 0.5],
  ["chestDepthCm", "Chest depth", 14, 35, 0.5],
  ["waistCircumferenceCm", "Waist circumference", 50, 120, 1],
  ["waistBreadthCm", "Waist breadth", 18, 40, 0.5],
  ["waistDepthCm", "Waist depth", 12, 32, 0.5],
  ["abdominalDepthCm", "Abdominal depth", 12, 40, 0.5],
  ["hipCircumferenceCm", "Hip circumference", 65, 130, 1],
  ["hipBreadthCm", "Hip breadth", 22, 48, 0.5],
  ["buttockDepthCm", "Buttock depth", 14, 36, 0.5],
];

function resize() {
  const rect = canvasHost.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(420, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener("resize", resize);
resize();

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getMeasurement(field) {
  return workingBody.measurements?.[field] ?? "";
}

function rebuild() {
  if (bodyObject) {
    scene.remove(bodyObject);
    bodyObject.traverse((child) => {
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    });
  }

  const mapped = mapBodyToRenderModel(workingBody);
  bodyObject = createProceduralBody(mapped, previewPosture);
  bodyObject.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(bodyObject);

  diagnostics.textContent = JSON.stringify(
    {
      rendererContract: mapped.rendererContract,
      shapePrior: mapped.shapePrior,
      fallbackFields: mapped.fallbackFields,
      rendererLocalSurface: mapped.rendererLocalSurface,
      previewPosture,
      unresolvedShapeDimensions: mapped.unresolvedShapeDimensions,
    },
    null,
    2,
  );
  sourceView.textContent = JSON.stringify(workingBody, null, 2);
}

function makeSlider(field, label, min, max, step, unit = "cm") {
  const wrap = document.createElement("label");
  wrap.className = "control";

  const title = document.createElement("span");
  title.className = "control-title";
  title.textContent = label;

  const row = document.createElement("div");
  row.className = "control-row";

  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = getMeasurement(field);

  const value = document.createElement("output");
  value.textContent = `${input.value} ${unit}`;

  input.addEventListener("input", () => {
    workingBody.measurements ??= {};
    workingBody.measurements[field] = Number(input.value);
    value.textContent = `${input.value} ${unit}`;
    rebuild();
  });

  row.append(input, value);
  wrap.append(title, row);
  return wrap;
}

function makeCompositionSlider(field, label) {
  const wrap = document.createElement("label");
  wrap.className = "control";

  const title = document.createElement("span");
  title.className = "control-title";
  title.textContent = label;

  const row = document.createElement("div");
  row.className = "control-row";

  const input = document.createElement("input");
  input.type = "range";
  input.min = 0;
  input.max = 1;
  input.step = 0.01;
  input.value = workingBody.composition?.[field] ?? 0.5;

  const value = document.createElement("output");
  value.textContent = Number(input.value).toFixed(2);

  input.addEventListener("input", () => {
    workingBody.composition ??= {};
    workingBody.composition[field] = Number(input.value);
    value.textContent = Number(input.value).toFixed(2);
    rebuild();
  });

  row.append(input, value);
  wrap.append(title, row);
  return wrap;
}

function makePostureSlider(field, label, min, max, step, unit) {
  const wrap = document.createElement("label");
  wrap.className = "control";

  const title = document.createElement("span");
  title.className = "control-title";
  title.textContent = label;

  const row = document.createElement("div");
  row.className = "control-row";

  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = previewPosture[field];

  const value = document.createElement("output");
  value.textContent = `${input.value} ${unit}`;

  input.addEventListener("input", () => {
    previewPosture[field] = Number(input.value);
    value.textContent = `${input.value} ${unit}`;
    rebuild();
  });

  row.append(input, value);
  wrap.append(title, row);
  return wrap;
}

function buildPostureControls() {
  const host = document.querySelector("#posture-controls");
  host.replaceChildren();

  for (const config of postureControlsConfig) {
    host.append(makePostureSlider(...config));
  }
}

function buildControls() {
  const host = document.querySelector("#measurement-controls");
  host.replaceChildren();

  for (const config of controlsConfig) {
    host.append(makeSlider(...config));
  }

  host.append(
    makeCompositionSlider("bodyFatFraction", "Body-fat fraction"),
    makeCompositionSlider("muscularity", "Muscularity"),
  );
}

priorSelect.addEventListener("change", () => {
  workingBody.shapePrior = priorSelect.value;
  rebuild();
});

document.querySelector("#reset-posture").addEventListener("click", () => {
  previewPosture = {...DEFAULT_PREVIEW_POSTURE};
  buildPostureControls();
  rebuild();
});

document.querySelector("#sample-mode").addEventListener("click", () => {
  workingBody = deepClone(sourceCharacter.body);
  priorSelect.value = workingBody.shapePrior ?? "neutral";
  buildControls();
  rebuild();
});

document.querySelector("#prior-mode").addEventListener("click", () => {
  const heightCm = sourceCharacter.body.measurements?.heightCm ?? 170;
  workingBody = {
    model: "scc-body-v1",
    shapePrior: priorSelect.value,
    measurements: { heightCm },
  };
  buildControls();
  rebuild();
});

document.querySelector("#front-view").addEventListener("click", () => {
  camera.position.set(0, 1.25, 3.9);
  controls.target.set(0, 0.9, 0);
  controls.update();
});

document.querySelector("#side-view").addEventListener("click", () => {
  camera.position.set(3.9, 1.25, 0);
  controls.target.set(0, 0.9, 0);
  controls.update();
});

async function load() {
  const response = await fetch("../../schema/examples/full.character.json");
  if (!response.ok) {
    throw new Error(`Failed to load example character: ${response.status}`);
  }
  sourceCharacter = await response.json();
  workingBody = deepClone(sourceCharacter.body);
  priorSelect.value = workingBody.shapePrior ?? "neutral";
  buildControls();
  buildPostureControls();
  rebuild();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

load().catch((error) => {
  diagnostics.textContent = error.stack ?? String(error);
});

animate();
