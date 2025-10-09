import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

function createMetalMaterial(color = 0xc0c0c0) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.85,
    roughness: 0.3,
    emissive: new THREE.Color(color).multiplyScalar(0.15),
    emissiveIntensity: 0.35,
  });
}

export function createGearMesh(gear, { scale = 0.4, showToothMarkers = true } = {}) {
  const {
    toothCount,
    module = null,
    pitchRadius: providedPitch,
    thickness: rawThickness = 4,
    color = 0xc9c3b1,
    label,
  } = gear;

  const pitchRadius =
    providedPitch !== undefined
      ? providedPitch * scale
      : ((module ?? 1.35) * toothCount * 0.5) * scale;
  const moduleSize = module ?? (providedPitch ? (2 * providedPitch) / toothCount : 1.35);
  const addendum = moduleSize * 1.0 * scale;
  const dedendum = moduleSize * 1.25 * scale;
  const baseRadius = Math.max(pitchRadius - dedendum, pitchRadius * 0.55);
  const outerRadius = pitchRadius + addendum;
  const thickness = rawThickness * scale;

  const material = createMetalMaterial(color);
  const gearGroup = new THREE.Group();
  gearGroup.name = label ?? gear.id;

  const rimGeometry = new THREE.CylinderGeometry(
    baseRadius,
    baseRadius,
    thickness,
    Math.max(32, toothCount * 2),
  );
  const rim = new THREE.Mesh(rimGeometry, material);
  rim.castShadow = true;
  rim.receiveShadow = true;
  gearGroup.add(rim);

  const toothMeshes = [];

  if (showToothMarkers && toothCount > 0) {
    const toothWidth = ((2 * Math.PI * pitchRadius) / toothCount) * 0.7;
    const toothDepthValue = outerRadius - baseRadius;
    const toothGeometry = new THREE.BoxGeometry(
      toothDepthValue,
      thickness * 0.92,
      toothWidth,
    );

    for (let i = 0; i < toothCount; i += 1) {
      const angle = (i / toothCount) * Math.PI * 2;
      const tooth = new THREE.Mesh(toothGeometry, material.clone());
      const radius = baseRadius + toothDepthValue / 2;
      tooth.position.set(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      );
      tooth.rotation.y = angle;
      gearGroup.add(tooth);
      toothMeshes.push(tooth);
    }
  }

  const hubRadius = Math.min(baseRadius * 0.35, pitchRadius * 0.4);
  const hubGeometry = new THREE.CylinderGeometry(hubRadius, hubRadius, thickness * 1.05, 48);
  const hub = new THREE.Mesh(hubGeometry, material.clone());
  hub.material.metalness = 0.65;
  hub.material.roughness = 0.45;
  gearGroup.add(hub);

  const boreRadius = hubRadius * 0.55;
  const boreGeometry = new THREE.CylinderGeometry(boreRadius, boreRadius, thickness * 1.2, 48);
  const boreMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.2,
    roughness: 0.6,
  });
  const bore = new THREE.Mesh(boreGeometry, boreMaterial);
  gearGroup.add(bore);

  gearGroup.children.forEach((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });

  gearGroup.userData = {
    gear,
    pitchRadius,
    baseRadius,
    outerRadius,
    thickness,
    module: moduleSize,
    rim,
    hub,
    bore,
    toothMeshes,
  };

  return gearGroup;
}
