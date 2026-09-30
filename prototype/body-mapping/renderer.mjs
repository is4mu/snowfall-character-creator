import * as THREE from "three";

function grayMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xb8b8b8,
    roughness: 0.9,
    metalness: 0.0,
  });
}

function jointMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xa8a8a8,
    roughness: 0.95,
    metalness: 0.0,
  });
}

function makeCylinder(radiusTop, radiusBottom, height, material, radialSegments = 24) {
  const geometry = new THREE.CylinderGeometry(
    Math.max(0.006, radiusTop),
    Math.max(0.006, radiusBottom),
    Math.max(0.012, height),
    radialSegments,
    1,
    false,
  );
  return new THREE.Mesh(geometry, material);
}

function makeEllipsoid(rx, ry, rz, material, segments = 24) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, segments, Math.max(12, Math.floor(segments / 2))),
    material,
  );
  mesh.scale.set(Math.max(0.01, rx), Math.max(0.01, ry), Math.max(0.01, rz));
  return mesh;
}

function makeBox(width, height, depth, material) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(
      Math.max(0.01, width),
      Math.max(0.01, height),
      Math.max(0.01, depth),
    ),
    material,
  );
}

function makeTorsoGeometry(dimensions, surface) {
  const t = dimensions.torso;
  const shoulderHalfWidth = Math.max(
    t.chestHalfWidthM,
    dimensions.shoulderBreadthM / 2,
  );

  const hipDepthM = t.hipHalfDepthM * 2 * 0.92;
  const abdomenDepthM = t.abdomenHalfDepthM * 2;
  const chestDepthM = t.chestHalfDepthM * 2;

  const rings = [
    {
      y: 0,
      halfWidth: t.hipHalfWidthM * 0.96,
      halfDepth: t.hipHalfDepthM * 0.92,
      centerZ:
        -hipDepthM * ((surface?.glutePosteriorShare ?? 0.5) - 0.5),
    },
    {
      y: t.heightM * 0.28,
      halfWidth: t.waistHalfWidthM,
      halfDepth: t.waistHalfDepthM,
      centerZ: 0,
    },
    {
      y: t.heightM * 0.48,
      halfWidth: t.abdomenHalfWidthM,
      halfDepth: t.abdomenHalfDepthM,
      centerZ:
        abdomenDepthM * ((surface?.abdomenAnteriorShare ?? 0.5) - 0.5),
    },
    {
      y: t.heightM * 0.68,
      halfWidth: t.chestHalfWidthM,
      halfDepth: t.chestHalfDepthM,
      centerZ:
        chestDepthM * ((surface?.chestAnteriorShare ?? 0.5) - 0.5),
    },
    {
      y: t.heightM,
      halfWidth: shoulderHalfWidth,
      halfDepth: t.chestHalfDepthM * 0.90,
      centerZ:
        chestDepthM * ((surface?.chestAnteriorShare ?? 0.5) - 0.5) * 0.35,
    },
  ];

  const segments = 36;
  const vertices = [];
  const indices = [];

  const shoulderSlopeRad = THREE.MathUtils.degToRad(
    dimensions.shoulderSlopeDeg ?? 0,
  );

  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    for (let i = 0; i < segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * ring.halfWidth;
      const isShoulderRing = ringIndex === rings.length - 1;
      const shoulderDrop = isShoulderRing
        ? Math.tan(shoulderSlopeRad) * Math.abs(x)
        : 0;
      vertices.push(
        x,
        ring.y - shoulderDrop,
        ring.centerZ + Math.sin(angle) * ring.halfDepth,
      );
    }
  }

  for (let r = 0; r < rings.length - 1; r += 1) {
    for (let i = 0; i < segments; i += 1) {
      const next = (i + 1) % segments;
      const a = r * segments + i;
      const b = r * segments + next;
      const c = (r + 1) * segments + next;
      const d = (r + 1) * segments + i;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addLeg(group, side, dimensions, baseY, material, jointMat) {
  const leg = dimensions.legs;
  const footHeight = Math.max(0.035, leg.ankleRadiusM * 1.5);
  const upperLength = Math.max(0.08, leg.upperLengthM);
  const lowerLength = Math.max(0.08, leg.lowerLengthM);
  const x = side * dimensions.torso.hipHalfWidthM * 0.50;

  const foot = makeBox(
    leg.footBreadthM,
    footHeight,
    leg.footLengthM,
    material,
  );
  foot.position.set(x, baseY + footHeight / 2, leg.footLengthM * 0.16);
  group.add(foot);

  const lower = makeCylinder(
    leg.calfRadiusM * 0.80,
    leg.ankleRadiusM,
    lowerLength,
    material,
  );
  lower.position.set(x, baseY + footHeight + lowerLength / 2, 0);
  group.add(lower);

  const kneeY = baseY + footHeight + lowerLength;
  const knee = makeEllipsoid(
    leg.calfRadiusM * 0.95,
    leg.calfRadiusM * 0.75,
    leg.calfRadiusM * 0.90,
    jointMat,
    18,
  );
  knee.position.set(x, kneeY, 0);
  group.add(knee);

  const upper = makeCylinder(
    leg.upperRadiusM * 0.82,
    leg.calfRadiusM,
    upperLength,
    material,
  );
  upper.position.set(x, kneeY + upperLength / 2, 0);
  group.add(upper);

  return baseY + footHeight + lowerLength + upperLength;
}

function addArm(group, side, dimensions, shoulderY, material, jointMat) {
  const arm = dimensions.arms;
  const x = side * dimensions.shoulderBreadthM / 2;

  const shoulder = makeEllipsoid(
    arm.upperRadiusM * 1.1,
    arm.upperRadiusM * 1.0,
    arm.upperRadiusM * 1.0,
    jointMat,
    18,
  );
  shoulder.position.set(x, shoulderY, 0);
  group.add(shoulder);

  const upper = makeCylinder(
    arm.upperRadiusM,
    arm.forearmRadiusM * 1.04,
    arm.upperLengthM,
    material,
  );
  upper.position.set(x, shoulderY - arm.upperLengthM / 2, 0);
  group.add(upper);

  const elbowY = shoulderY - arm.upperLengthM;
  const elbow = makeEllipsoid(
    arm.forearmRadiusM * 0.9,
    arm.forearmRadiusM * 0.72,
    arm.forearmRadiusM * 0.9,
    jointMat,
    16,
  );
  elbow.position.set(x, elbowY, 0);
  group.add(elbow);

  const forearm = makeCylinder(
    arm.forearmRadiusM,
    arm.wristRadiusM,
    arm.forearmLengthM,
    material,
  );
  forearm.position.set(x, elbowY - arm.forearmLengthM / 2, 0);
  group.add(forearm);

  const hand = makeEllipsoid(
    arm.handBreadthM * 0.48,
    arm.handLengthM * 0.50,
    arm.handBreadthM * 0.22,
    material,
    16,
  );
  hand.position.set(
    x,
    elbowY - arm.forearmLengthM - arm.handLengthM * 0.50,
    0,
  );
  group.add(hand);
}

export function createProceduralBody(renderModel) {
  const group = new THREE.Group();
  group.name = "SCC procedural body prototype";

  const material = grayMaterial();
  const jointMat = jointMaterial();
  const d = renderModel.dimensions;
  const surface = renderModel.rendererLocalSurface;

  const crotchY = addLeg(group, -1, d, 0, material, jointMat);
  addLeg(group, 1, d, 0, material, jointMat);

  const pelvis = makeEllipsoid(
    d.pelvis.halfWidthM,
    d.pelvis.heightM * 0.58,
    d.pelvis.halfDepthM,
    material,
    28,
  );
  const pelvisDepthM = d.pelvis.halfDepthM * 2;
  const pelvisCenterZ =
    -pelvisDepthM * ((surface?.glutePosteriorShare ?? 0.5) - 0.5);
  pelvis.position.set(
    0,
    crotchY + d.pelvis.heightM * 0.48,
    pelvisCenterZ,
  );
  group.add(pelvis);

  const torsoBaseY = crotchY + d.pelvis.heightM * 0.68;
  const torso = new THREE.Mesh(makeTorsoGeometry(d, surface), material);
  torso.position.set(0, torsoBaseY, 0);
  group.add(torso);

  const shoulderSlopeRad = THREE.MathUtils.degToRad(d.shoulderSlopeDeg ?? 0);
  const shoulderDrop =
    Math.tan(shoulderSlopeRad) * (d.shoulderBreadthM / 2);
  const shoulderY = torsoBaseY + d.torso.heightM - shoulderDrop;
  addArm(group, -1, d, shoulderY, material, jointMat);
  addArm(group, 1, d, shoulderY, material, jointMat);

  const neck = makeCylinder(
    d.neck.radiusM * 0.92,
    d.neck.radiusM,
    d.neck.heightM,
    material,
  );
  neck.position.set(
    0,
    torsoBaseY + d.torso.heightM + d.neck.heightM / 2,
    0,
  );
  group.add(neck);

  const headRadius = d.head.radiusM;
  const head = makeEllipsoid(
    headRadius * 0.82,
    d.head.heightM * 0.50,
    headRadius,
    material,
    32,
  );
  head.position.set(
    0,
    torsoBaseY + d.torso.heightM + d.neck.heightM + d.head.heightM / 2,
    0,
  );
  group.add(head);

  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0) {
    const scale = d.heightM / size.y;
    group.scale.setScalar(scale);
  }

  group.userData.renderModel = renderModel;
  return group;
}
