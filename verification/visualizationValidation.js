/**
 * 3D Visualization Validation Tool
 * Validates that the Three.js rendering matches the gear configuration
 * Run this in the browser console after loading the visualization
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { gears, axes, connections } from "../src/data/gears.js";

const SCALE = 0.4; // MILLIMETRES_PER_UNIT

/**
 * Validates that all gears are rendered in the scene
 */
export function validateGearsRendered(scene) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  let gearsFound = 0;
  const gearMeshesInScene = new Map();

  scene.traverse((object) => {
    if (object.userData && object.userData.gear) {
      const gearId = object.userData.gear.id;
      gearMeshesInScene.set(gearId, object);
      gearsFound++;
    }
  });

  report.info = [`Found ${gearsFound} gear meshes in scene`];

  gears.forEach(gear => {
    if (gearMeshesInScene.has(gear.id)) {
      report.passed.push(`✓ ${gear.id}: rendered in scene`);
    } else {
      report.errors.push(`✗ ${gear.id}: NOT found in scene`);
    }
  });

  return { report, gearMeshesInScene };
}

/**
 * Validates gear positions match configuration
 */
export function validateGearPositions(gearMeshesInScene) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  const TOLERANCE = 0.5; // mm tolerance for position differences

  gears.forEach(gear => {
    const mesh = gearMeshesInScene.get(gear.id);
    if (!mesh) {
      report.errors.push(`✗ ${gear.id}: mesh not found for position check`);
      return;
    }

    const axis = axes.find(a => a.id === gear.axis);
    if (!axis) {
      report.errors.push(`✗ ${gear.id}: axis "${gear.axis}" not found`);
      return;
    }

    // Get world position
    const worldPos = new THREE.Vector3();
    mesh.getWorldPosition(worldPos);

    // Expected position from configuration
    const expectedX = axis.position[0] * SCALE;
    const expectedY = (gear.stack || 0) * SCALE;
    const expectedZ = axis.position[1] * SCALE;

    // Calculate differences
    const dx = Math.abs(worldPos.x - expectedX);
    const dy = Math.abs(worldPos.y - expectedY);
    const dz = Math.abs(worldPos.z - expectedZ);

    const maxDiff = Math.max(dx, dy, dz);

    if (maxDiff < TOLERANCE) {
      report.passed.push(`✓ ${gear.id}: position correct (Δ=${maxDiff.toFixed(2)}mm)`);
    } else if (maxDiff < TOLERANCE * 3) {
      report.warnings.push(`⚠ ${gear.id}: position slightly off (Δ=${maxDiff.toFixed(2)}mm)`);
    } else {
      report.errors.push(`✗ ${gear.id}: position mismatch (Δ=${maxDiff.toFixed(2)}mm)`);
      report.errors.push(`   Expected: (${expectedX.toFixed(1)}, ${expectedY.toFixed(1)}, ${expectedZ.toFixed(1)})`);
      report.errors.push(`   Actual:   (${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)}, ${worldPos.z.toFixed(1)})`);
    }
  });

  return report;
}

/**
 * Validates gear sizes match tooth counts
 */
export function validateGearSizes(gearMeshesInScene) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  gears.forEach(gear => {
    const mesh = gearMeshesInScene.get(gear.id);
    if (!mesh || !mesh.userData) {
      report.errors.push(`✗ ${gear.id}: no userData found`);
      return;
    }

    const { pitchRadius, toothMeshes } = mesh.userData;

    // Calculate expected pitch radius
    const module = gear.module || 1.35;
    const expectedRadius = (module * gear.toothCount * 0.5) * SCALE;

    // Check pitch radius
    const radiusDiff = Math.abs(pitchRadius - expectedRadius);
    const radiusTolerance = 1.0; // mm

    if (radiusDiff < radiusTolerance) {
      report.passed.push(`✓ ${gear.id}: pitch radius correct (${pitchRadius.toFixed(1)}mm)`);
    } else {
      report.warnings.push(`⚠ ${gear.id}: pitch radius off by ${radiusDiff.toFixed(1)}mm`);
    }

    // Check tooth count (if tooth meshes are rendered)
    if (toothMeshes && toothMeshes.length > 0) {
      if (toothMeshes.length === gear.toothCount) {
        report.passed.push(`✓ ${gear.id}: tooth count matches (${gear.toothCount}T)`);
      } else {
        report.errors.push(`✗ ${gear.id}: tooth count mismatch (expected ${gear.toothCount}, got ${toothMeshes.length})`);
      }
    }
  });

  return report;
}

/**
 * Validates connections are visually correct
 */
export function validateConnections(gearMeshesInScene) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  connections.forEach(conn => {
    const fromMesh = gearMeshesInScene.get(conn.from);
    const toMesh = gearMeshesInScene.get(conn.to);

    if (!fromMesh || !toMesh) {
      report.errors.push(`✗ Connection ${conn.from} → ${conn.to}: mesh not found`);
      return;
    }

    const fromPos = new THREE.Vector3();
    const toPos = new THREE.Vector3();
    fromMesh.getWorldPosition(fromPos);
    toMesh.getWorldPosition(toPos);

    const distance = fromPos.distanceTo(toPos);

    if (conn.type === "coaxial") {
      // Coaxial gears should be very close in XZ but different in Y
      const horizontalDist = Math.sqrt(
        Math.pow(fromPos.x - toPos.x, 2) + Math.pow(fromPos.z - toPos.z, 2)
      );
      const verticalDist = Math.abs(fromPos.y - toPos.y);

      if (horizontalDist < 1.0 && verticalDist > 0.5) {
        report.passed.push(`✓ Coaxial ${conn.from} ⟷ ${conn.to}: correct (vgap=${verticalDist.toFixed(1)}mm)`);
      } else {
        report.warnings.push(`⚠ Coaxial ${conn.from} ⟷ ${conn.to}: unusual spacing (h=${horizontalDist.toFixed(1)}mm, v=${verticalDist.toFixed(1)}mm)`);
      }
    } else if (conn.type === "mesh") {
      // Mesh gears should be at expected distance
      const fromGear = gears.find(g => g.id === conn.from);
      const toGear = gears.find(g => g.id === conn.to);

      if (fromGear && toGear) {
        const fromRadius = ((fromGear.module || 1.35) * fromGear.toothCount * 0.5) * SCALE;
        const toRadius = ((toGear.module || 1.35) * toGear.toothCount * 0.5) * SCALE;
        const expectedDistance = fromRadius + toRadius;

        const distanceDiff = Math.abs(distance - expectedDistance);
        const tolerance = 5.0; // mm

        if (distanceDiff < tolerance) {
          report.passed.push(`✓ Mesh ${conn.from} ⚔ ${conn.to}: correct (d=${distance.toFixed(1)}mm)`);
        } else {
          report.warnings.push(`⚠ Mesh ${conn.from} ⚔ ${conn.to}: distance off (expected ${expectedDistance.toFixed(1)}mm, got ${distance.toFixed(1)}mm)`);
        }
      }
    }
  });

  return report;
}

/**
 * Checks for visual overlaps using bounding boxes
 */
export function detectVisualOverlaps(gearMeshesInScene) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  const gearArray = Array.from(gearMeshesInScene.entries());
  let overlapsFound = 0;

  for (let i = 0; i < gearArray.length; i++) {
    for (let j = i + 1; j < gearArray.length; j++) {
      const [id1, mesh1] = gearArray[i];
      const [id2, mesh2] = gearArray[j];

      // Calculate bounding boxes
      const box1 = new THREE.Box3().setFromObject(mesh1);
      const box2 = new THREE.Box3().setFromObject(mesh2);

      if (box1.intersectsBox(box2)) {
        // Get gear data
        const gear1 = gears.find(g => g.id === id1);
        const gear2 = gears.find(g => g.id === id2);

        // Check if they're supposed to mesh (then intersection is expected)
        const areConnected = connections.some(
          c => (c.from === id1 && c.to === id2) || (c.from === id2 && c.to === id1)
        );

        if (areConnected) {
          report.passed.push(`✓ ${id1} ∩ ${id2}: bounding boxes intersect (expected for meshing gears)`);
        } else {
          // Check if they're on same axis (coaxial, so vertical separation is OK)
          if (gear1.axis === gear2.axis) {
            const stack1 = gear1.stack || 0;
            const stack2 = gear2.stack || 0;
            const gap = Math.abs(stack1 - stack2);

            if (gap < 2.0) {
              report.errors.push(`✗ ${id1} ∩ ${id2}: gears on same axis overlap (gap=${gap.toFixed(1)}mm)`);
              overlapsFound++;
            } else {
              report.passed.push(`✓ ${id1} & ${id2}: same axis but separated (gap=${gap.toFixed(1)}mm)`);
            }
          } else {
            report.warnings.push(`⚠ ${id1} ∩ ${id2}: bounding boxes intersect unexpectedly`);
            overlapsFound++;
          }
        }
      }
    }
  }

  if (overlapsFound === 0) {
    report.passed.push(`✓ No unexpected gear overlaps detected`);
  }

  return report;
}

/**
 * Validates rotation directions match angular momentum flow
 */
export function validateRotationDirections(gearMeshesInScene, lastRotations) {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
  };

  if (!lastRotations || Object.keys(lastRotations).length === 0) {
    report.warnings.push(`⚠ No rotation data available (mechanism may not be animated yet)`);
    return report;
  }

  connections.forEach(conn => {
    const fromRotation = lastRotations[conn.from];
    const toRotation = lastRotations[conn.to];

    if (fromRotation === undefined || toRotation === undefined) {
      return; // Skip if no rotation data
    }

    if (conn.type === "mesh") {
      // Meshing gears should rotate in opposite directions
      const fromSign = Math.sign(fromRotation);
      const toSign = Math.sign(toRotation);

      if (fromSign !== 0 && toSign !== 0 && fromSign !== toSign) {
        report.passed.push(`✓ Mesh ${conn.from} ⚔ ${conn.to}: opposite rotation ✓`);
      } else if (fromSign === 0 || toSign === 0) {
        // One gear not rotating yet
      } else {
        report.errors.push(`✗ Mesh ${conn.from} ⚔ ${conn.to}: same rotation direction (angular momentum error!)`);
      }
    } else if (conn.type === "coaxial") {
      // Coaxial gears should rotate in same direction
      const fromSign = Math.sign(fromRotation);
      const toSign = Math.sign(toRotation);

      if (fromSign !== 0 && toSign !== 0 && fromSign === toSign) {
        report.passed.push(`✓ Coaxial ${conn.from} ⟷ ${conn.to}: same rotation ✓`);
      } else if (fromSign === 0 || toSign === 0) {
        // One gear not rotating yet
      } else {
        report.errors.push(`✗ Coaxial ${conn.from} ⟷ ${conn.to}: opposite rotation (should be same!)`);
      }
    }
  });

  return report;
}

/**
 * Main validation function - runs all checks
 */
export function runFullVisualizationValidation(scene, lastRotations = {}) {
  console.log("=".repeat(80));
  console.log("3D VISUALIZATION VALIDATION");
  console.log("=".repeat(80));
  console.log("");

  const results = {};

  // 1. Check gears are rendered
  console.log("1️⃣  GEAR RENDERING CHECK");
  console.log("-".repeat(80));
  const { report: renderReport, gearMeshesInScene } = validateGearsRendered(scene);
  results.rendering = renderReport;
  printReport(renderReport);

  // 2. Validate positions
  console.log("\n2️⃣  POSITION VALIDATION");
  console.log("-".repeat(80));
  const positionReport = validateGearPositions(gearMeshesInScene);
  results.positions = positionReport;
  printReport(positionReport);

  // 3. Validate sizes
  console.log("\n3️⃣  SIZE & TOOTH COUNT VALIDATION");
  console.log("-".repeat(80));
  const sizeReport = validateGearSizes(gearMeshesInScene);
  results.sizes = sizeReport;
  printReport(sizeReport);

  // 4. Validate connections
  console.log("\n4️⃣  CONNECTION VALIDATION");
  console.log("-".repeat(80));
  const connectionReport = validateConnections(gearMeshesInScene);
  results.connections = connectionReport;
  printReport(connectionReport);

  // 5. Check for overlaps
  console.log("\n5️⃣  OVERLAP DETECTION");
  console.log("-".repeat(80));
  const overlapReport = detectVisualOverlaps(gearMeshesInScene);
  results.overlaps = overlapReport;
  printReport(overlapReport);

  // 6. Validate rotation directions (if animated)
  console.log("\n6️⃣  ROTATION DIRECTION VALIDATION");
  console.log("-".repeat(80));
  const rotationReport = validateRotationDirections(gearMeshesInScene, lastRotations);
  results.rotations = rotationReport;
  printReport(rotationReport);

  // Summary
  console.log("\n" + "=".repeat(80));
  console.log("VALIDATION SUMMARY");
  console.log("=".repeat(80));

  const totalPassed = Object.values(results).reduce((sum, r) => sum + r.passed.length, 0);
  const totalWarnings = Object.values(results).reduce((sum, r) => sum + r.warnings.length, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);
  const totalChecks = totalPassed + totalWarnings + totalErrors;

  console.log(`Total Checks: ${totalChecks}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`⚠️  Warnings: ${totalWarnings}`);
  console.log(`❌ Errors: ${totalErrors}`);

  const passRate = totalChecks > 0 ? ((totalPassed / totalChecks) * 100).toFixed(1) : 100;
  console.log(`Pass Rate: ${passRate}%`);
  console.log("");

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log("✅ All visualization checks PASSED!");
  } else if (totalErrors === 0) {
    console.log("⚠️  Visualization is valid but has warnings to review.");
  } else {
    console.log("❌ Visualization has errors that should be fixed.");
  }

  console.log("=".repeat(80));

  return results;
}

function printReport(report) {
  if (report.info) {
    report.info.forEach(msg => console.log(msg));
  }

  if (report.passed.length > 0) {
    console.log(`\n✅ Passed (${report.passed.length}):`);
    report.passed.slice(0, 10).forEach(msg => console.log(msg));
    if (report.passed.length > 10) {
      console.log(`   ... and ${report.passed.length - 10} more`);
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${report.warnings.length}):`);
    report.warnings.forEach(msg => console.log(msg));
  }

  if (report.errors.length > 0) {
    console.log(`\n❌ Errors (${report.errors.length}):`);
    report.errors.forEach(msg => console.log(msg));
  }
}

// For browser console usage
if (typeof window !== "undefined") {
  window.validateVisualization = runFullVisualizationValidation;
  console.log("✨ Visualization validation tool loaded!");
  console.log("Usage: validateVisualization(scene, lastRotations)");
}
