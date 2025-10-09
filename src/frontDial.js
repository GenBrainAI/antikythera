import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

function createBronzeMaterial({ color = 0x8a7f67, roughness = 0.45, metalness = 0.85 } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    envMapIntensity: 0.7,
  });
}

function createFrame(width, height, depth, border, material) {
  const frameGroup = new THREE.Group();
  const verticalGeometry = new THREE.BoxGeometry(border, depth, height);
  const horizontalGeometry = new THREE.BoxGeometry(width - border * 2, depth, border);

  const left = new THREE.Mesh(verticalGeometry, material.clone());
  left.position.x = -(width / 2 - border / 2);
  frameGroup.add(left);

  const right = new THREE.Mesh(verticalGeometry, material.clone());
  right.position.x = width / 2 - border / 2;
  frameGroup.add(right);

  const top = new THREE.Mesh(horizontalGeometry, material.clone());
  top.position.z = height / 2 - border / 2;
  frameGroup.add(top);

  const bottom = new THREE.Mesh(horizontalGeometry, material.clone());
  bottom.position.z = -(height / 2 - border / 2);
  frameGroup.add(bottom);

  frameGroup.children.forEach((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });

  return frameGroup;
}

function createDialTexture({ size = 1024, zodiacColor = "#f6d79e", calendarColor = "#2d2c29" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1f1c16";
  ctx.fillRect(0, 0, size, size);

  const center = size / 2;
  const outerRadius = size * 0.46;
  const zodiacInner = size * 0.33;
  const calendarInner = size * 0.2;

  ctx.strokeStyle = zodiacColor;
  ctx.lineWidth = size * 0.01;
  ctx.beginPath();
  ctx.arc(center, center, outerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, zodiacInner, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(center, center, calendarInner, 0, Math.PI * 2);
  ctx.stroke();

  const zodiac = [
    "♈︎", "♉︎", "♊︎", "♋︎", "♌︎", "♍︎", "♎︎", "♏︎", "♐︎", "♑︎", "♒︎", "♓︎",
  ];

  ctx.fillStyle = zodiacColor;
  ctx.font = `${Math.floor(size * 0.05)}px 'Noto Sans Symbols', 'Segoe UI Symbol', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  zodiac.forEach((sign, index) => {
    const angle = (index / zodiac.length) * Math.PI * 2 - Math.PI / 2;
    const radius = (outerRadius + zodiacInner) / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    ctx.fillText(sign, x, y);
  });

  const months = [
    "Thoth",
    "Phaophi",
    "Athyr",
    "Choiak",
    "Tybi",
    "Mechir",
    "Phamenoth",
    "Pharmuthi",
    "Pachons",
    "Payni",
    "Epiphi",
    "Mesore",
  ];

  ctx.fillStyle = calendarColor;
  ctx.font = `${Math.floor(size * 0.035)}px 'Crimson Text', 'Times New Roman', serif`;

  months.forEach((month, index) => {
    const startAngle = (index / months.length) * Math.PI * 2 - Math.PI / 2;
    const endAngle = ((index + 1) / months.length) * Math.PI * 2 - Math.PI / 2;
    const angle = (startAngle + endAngle) / 2;
    const radius = (zodiacInner + calendarInner) / 2;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(month, 0, 0);
    ctx.restore();
  });

  const tickCount = 365;
  ctx.strokeStyle = "#e8cf97";
  ctx.lineWidth = size * 0.004;
  for (let i = 0; i < tickCount; i += 1) {
    const angle = (i / tickCount) * Math.PI * 2;
    const inner = outerRadius;
    const outer = outerRadius + size * 0.015;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
    ctx.lineTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function createPointer(length, baseWidth, thickness, color) {
  const shape = new THREE.Shape();
  const rootInset = baseWidth * 0.45;
  shape.moveTo(-rootInset, -baseWidth / 2);
  shape.lineTo(length * 0.88, -baseWidth / 2);
  shape.lineTo(length, 0);
  shape.lineTo(length * 0.88, baseWidth / 2);
  shape.lineTo(-rootInset, baseWidth / 2);
  shape.lineTo(-rootInset, -baseWidth / 2);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.translate(0, 0, -thickness / 2);

  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.85,
    roughness: 0.35,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createFrontDialAssembly({ scale, axisGroups }) {
  const mainAxis = axisGroups.get("alpha");
  if (!mainAxis) {
    return { group: new THREE.Group(), pointerBindings: [] };
  }

  const assembly = new THREE.Group();
  assembly.name = "Front Dial";
  assembly.position.copy(mainAxis.position);

  const frameWidth = 340 * scale;
  const frameHeight = 220 * scale;
  const frameDepth = 32 * scale;
  const bezel = 28 * scale;

  const frameMaterial = createBronzeMaterial({ color: 0x6b5b41, roughness: 0.55 });
  const frame = createFrame(frameWidth, frameHeight, frameDepth, bezel, frameMaterial);
  assembly.add(frame);

  const dialRadius = 150 * scale;
  const dialThickness = 8 * scale;
  const dialBodyGeometry = new THREE.CylinderGeometry(
    dialRadius,
    dialRadius,
    dialThickness,
    128,
    1,
    true,
  );
  const dialBody = new THREE.Mesh(
    dialBodyGeometry,
    createBronzeMaterial({ color: 0x3b3328, roughness: 0.68, metalness: 0.55 }),
  );
  dialBody.castShadow = true;
  dialBody.receiveShadow = true;
  dialBody.position.y = 0;
  assembly.add(dialBody);

  const faceMaterial = new THREE.MeshStandardMaterial({
    map: createDialTexture(),
    metalness: 0.25,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const faceGeometry = new THREE.CircleGeometry(dialRadius, 128);
  const dialFace = new THREE.Mesh(faceGeometry, faceMaterial);
  dialFace.rotation.x = -Math.PI / 2;
  dialFace.position.y = dialThickness / 2;
  dialFace.castShadow = true;
  dialFace.receiveShadow = true;
  assembly.add(dialFace);

  const backFaceMaterial = createBronzeMaterial({ color: 0x272016, roughness: 0.7, metalness: 0.45 });
  const backFace = new THREE.Mesh(faceGeometry, backFaceMaterial);
  backFace.rotation.x = Math.PI / 2;
  backFace.position.y = -dialThickness / 2;
  backFace.castShadow = true;
  backFace.receiveShadow = true;
  assembly.add(backFace);

  const calendarRingRadius = dialRadius * 1.08;
  const calendarGeometry = new THREE.TorusGeometry(calendarRingRadius, 6 * scale, 24, 128);
  const calendarMaterial = createBronzeMaterial({ color: 0x9b8d68, roughness: 0.4 });
  const calendarRing = new THREE.Mesh(calendarGeometry, calendarMaterial);
  calendarRing.rotation.x = Math.PI / 2;
  calendarRing.position.y = dialThickness / 2 + 2 * scale;
  assembly.add(calendarRing);

  const hubGeometry = new THREE.CylinderGeometry(12 * scale, 12 * scale, 10 * scale, 48);
  const hubMaterial = createBronzeMaterial({ color: 0x4f4634, roughness: 0.5 });
  const hub = new THREE.Mesh(hubGeometry, hubMaterial);
  hub.position.y = dialThickness / 2 + 4 * scale;
  assembly.add(hub);

  const solarPivot = new THREE.Group();
  solarPivot.name = "Solar Pointer";
  solarPivot.position.y = dialThickness / 2 + 6 * scale;
  assembly.add(solarPivot);

  const solarPointer = createPointer(150 * scale, 14 * scale, 4 * scale, 0xf8d27a);
  solarPivot.add(solarPointer);

  const lunarPivot = new THREE.Group();
  lunarPivot.name = "Lunar Pointer";
  lunarPivot.position.copy(solarPivot.position);
  lunarPivot.position.y += 2 * scale;
  assembly.add(lunarPivot);

  const lunarPointer = createPointer(130 * scale, 10 * scale, 3 * scale, 0x9dc4f8);
  lunarPivot.add(lunarPointer);

  const differentialCapGeometry = new THREE.CylinderGeometry(18 * scale, 18 * scale, 4 * scale, 32);
  const differentialCap = new THREE.Mesh(differentialCapGeometry, createBronzeMaterial());
  differentialCap.position.set(0, lunarPivot.position.y + 5 * scale, 0);
  assembly.add(differentialCap);

  const pointerBindings = [
    { pivot: solarPivot, gearId: "b1", ratio: 1, phase: -Math.PI / 2 },
    { pivot: lunarPivot, gearId: "k2", ratio: 1, phase: -Math.PI / 2 },
  ];

  return { group: assembly, pointerBindings };
}
