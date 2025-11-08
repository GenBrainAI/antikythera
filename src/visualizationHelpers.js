import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

/**
 * Creates position labels for gears showing their 3D coordinates
 */
export function createPositionLabel(gear, axisPosition, stack, scale) {
  const canvas = document.createElement("canvas");
  const size = 512;
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, size, size);
  context.fillStyle = "rgba(0, 0, 0, 0.7)";
  context.fillRect(0, 0, size, size);

  context.font = "bold 32px 'Courier New', monospace";
  context.fillStyle = "#00ff88";
  context.textAlign = "center";
  context.textBaseline = "top";

  const x = axisPosition[0];
  const y = stack;
  const z = axisPosition[1];

  context.fillText(`${gear.id}`, size / 2, 20);
  context.font = "24px 'Courier New', monospace";
  context.fillStyle = "#88ccff";
  context.fillText(`X: ${x.toFixed(1)}mm`, size / 2, 70);
  context.fillText(`Y: ${y.toFixed(1)}mm`, size / 2, 110);
  context.fillText(`Z: ${z.toFixed(1)}mm`, size / 2, 150);
  context.fillStyle = "#ffaa44";
  context.fillText(`Teeth: ${gear.toothCount}`, size / 2, 200);
  context.fillText(`Module: ${(gear.module || 1.35).toFixed(2)}`, size / 2, 240);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(40 * scale, 40 * scale, 1);
  sprite.position.y = 60 * scale;

  return sprite;
}

/**
 * Detects collisions between gears based on their bounding volumes
 */
export function detectGearCollisions(gearMeshes, axisGroups, scale) {
  const collisions = [];
  const gearArray = Array.from(gearMeshes.values());

  for (let i = 0; i < gearArray.length; i++) {
    for (let j = i + 1; j < gearArray.length; j++) {
      const gear1 = gearArray[i];
      const gear2 = gearArray[j];

      // Get world positions
      const pos1 = new THREE.Vector3();
      const pos2 = new THREE.Vector3();
      gear1.mesh.getWorldPosition(pos1);
      gear2.mesh.getWorldPosition(pos2);

      // Get bounding data
      const radius1 = gear1.mesh.userData.outerRadius || 10 * scale;
      const radius2 = gear2.mesh.userData.outerRadius || 10 * scale;
      const thickness1 = gear1.mesh.userData.thickness || 4 * scale;
      const thickness2 = gear2.mesh.userData.thickness || 4 * scale;

      // Check horizontal distance
      const horizontalDist = Math.sqrt(
        Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.z - pos2.z, 2)
      );

      // Check vertical overlap
      const verticalDist = Math.abs(pos1.y - pos2.y);
      const verticalOverlap = verticalDist < (thickness1 + thickness2) / 2;

      // If they're on the same axis (very close horizontally) and overlap vertically
      if (horizontalDist < 2 * scale && verticalOverlap) {
        collisions.push({
          gear1: gear1.data.id,
          gear2: gear2.data.id,
          type: "vertical_overlap",
          distance: verticalDist,
        });
      }

      // If they're at similar heights and too close horizontally
      if (verticalOverlap && horizontalDist < (radius1 + radius2) * 0.8) {
        // Check if they're supposed to mesh
        const shouldMesh = checkIfGearsShouldMesh(gear1.data.id, gear2.data.id);
        if (!shouldMesh) {
          collisions.push({
            gear1: gear1.data.id,
            gear2: gear2.data.id,
            type: "horizontal_overlap",
            distance: horizontalDist,
            clearance: horizontalDist - (radius1 + radius2),
          });
        }
      }
    }
  }

  return collisions;
}

/**
 * Helper to check if two gears should mesh (simplified)
 */
function checkIfGearsShouldMesh(id1, id2) {
  // This should be enhanced with actual connection data
  // For now, we'll assume gears should mesh if they're close
  return false;
}

/**
 * Highlights overlapping gears with colored outlines
 */
export function highlightOverlappingGears(gearMeshes, collisions) {
  const overlappingIds = new Set();

  collisions.forEach(collision => {
    overlappingIds.add(collision.gear1);
    overlappingIds.add(collision.gear2);
  });

  gearMeshes.forEach((gearEntry, id) => {
    const { mesh } = gearEntry;
    const { rim, hub } = mesh.userData;

    if (overlappingIds.has(id)) {
      // Highlight in red for collisions
      if (rim) {
        rim.material.emissive = new THREE.Color(0xff0000);
        rim.material.emissiveIntensity = 0.8;
      }
      if (hub) {
        hub.material.emissive = new THREE.Color(0xff0000);
        hub.material.emissiveIntensity = 0.6;
      }
    } else {
      // Reset to normal
      if (rim) {
        const baseColor = gearEntry.data.color || 0xc9c3b1;
        rim.material.emissive = new THREE.Color(baseColor).multiplyScalar(0.15);
        rim.material.emissiveIntensity = 0.35;
      }
      if (hub) {
        const baseColor = gearEntry.data.color || 0xc9c3b1;
        hub.material.emissive = new THREE.Color(baseColor).multiplyScalar(0.15);
        hub.material.emissiveIntensity = 0.35;
      }
    }
  });

  return overlappingIds;
}

/**
 * Creates connecting rods between meshing gears
 */
export function createConnectingRod(pos1, pos2, scale) {
  const direction = new THREE.Vector3().subVectors(pos2, pos1);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(pos1, pos2).multiplyScalar(0.5);

  const geometry = new THREE.CylinderGeometry(
    0.5 * scale,
    0.5 * scale,
    length,
    8
  );

  const material = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.7,
    roughness: 0.3,
    transparent: true,
    opacity: 0.4,
  });

  const rod = new THREE.Mesh(geometry, material);
  rod.position.copy(midpoint);

  // Align rod with the direction vector
  const axis = new THREE.Vector3(0, 1, 0);
  rod.quaternion.setFromUnitVectors(axis, direction.normalize());

  return rod;
}

/**
 * Creates visual representation of angular momentum direction
 */
export function createAngularMomentumArrow(gear, rotation, scale) {
  const direction = rotation > 0 ? 1 : -1;
  const color = direction > 0 ? 0x4488ff : 0xff4488;

  const arrowLength = 30 * scale;
  const arrowGeometry = new THREE.CylinderGeometry(
    0,
    2 * scale,
    arrowLength,
    8
  );

  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.7,
  });

  const arrow = new THREE.Mesh(arrowGeometry, material);
  arrow.position.y = 40 * scale * direction;
  arrow.rotation.x = direction > 0 ? 0 : Math.PI;

  return arrow;
}

/**
 * Creates vertical stack indicators for gears on the same axis
 */
export function createVerticalStackIndicator(gearMesh, axisHeight, scale) {
  const gearY = gearMesh.position.y;
  const baseY = axisHeight * scale;
  const distance = Math.abs(gearY);

  if (distance < 1) return null; // Too close to base, no need for indicator

  const geometry = new THREE.CylinderGeometry(
    0.3 * scale,
    0.3 * scale,
    distance,
    8
  );

  const material = new THREE.MeshStandardMaterial({
    color: gearY > 0 ? 0x44ff88 : 0xff8844,
    metalness: 0.5,
    roughness: 0.5,
    transparent: true,
    opacity: 0.4,
  });

  const indicator = new THREE.Mesh(geometry, material);
  indicator.position.y = gearY / 2;

  return indicator;
}

/**
 * Creates a grid plane at different heights to show vertical layers
 */
export function createLayerGridPlane(height, scale, color = 0x444444) {
  const size = 600 * scale;
  const divisions = 20;

  const gridHelper = new THREE.GridHelper(size, divisions, color, color);
  gridHelper.position.y = height * scale;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.2;

  return gridHelper;
}

/**
 * Creates a collision report overlay
 */
export function createCollisionReport(collisions) {
  const report = document.createElement("div");
  report.id = "collision-report";
  report.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: #ff4444;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    max-width: 300px;
    max-height: 400px;
    overflow-y: auto;
    border: 2px solid #ff4444;
    z-index: 1000;
  `;

  if (collisions.length === 0) {
    report.innerHTML = `
      <div style="color: #44ff44; border-color: #44ff44;">
        <strong>✓ No Collisions Detected</strong><br>
        All gears properly positioned
      </div>
    `;
    report.style.borderColor = "#44ff44";
    report.style.color = "#44ff44";
  } else {
    let html = `<strong>⚠ ${collisions.length} Collision(s) Detected</strong><br><br>`;
    collisions.forEach((c, idx) => {
      html += `
        <div style="margin-bottom: 10px; padding: 5px; background: rgba(255,0,0,0.1);">
          ${idx + 1}. ${c.gear1} ↔ ${c.gear2}<br>
          Type: ${c.type}<br>
          Distance: ${c.distance.toFixed(2)}mm
          ${c.clearance ? `<br>Clearance: ${c.clearance.toFixed(2)}mm` : ''}
        </div>
      `;
    });
    report.innerHTML = html;
  }

  return report;
}
