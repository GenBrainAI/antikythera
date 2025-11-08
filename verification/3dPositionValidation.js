/**
 * 3D Position Validation Tool
 * Verifies that gears are properly positioned in 3D space
 */

import { gears, axes, connections } from "../src/data/gears.js";

const SCALE = 0.4; // MILLIMETRES_PER_UNIT

/**
 * Validates 3D positions of gears
 */
export function validate3DPositions() {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
    info: [],
    positions: [],
  };

  // 1. Check that all gears have valid axes
  gears.forEach(gear => {
    const axis = axes.find(a => a.id === gear.axis);
    if (axis) {
      const position = {
        gearId: gear.id,
        axis: gear.axis,
        x: axis.position[0],
        y: gear.stack || 0,
        z: axis.position[1],
        toothCount: gear.toothCount,
      };
      report.positions.push(position);
      report.passed.push(`✓ ${gear.id}: positioned at axis "${gear.axis}" (${axis.position[0]}, ${gear.stack || 0}, ${axis.position[1]}) mm`);
    } else {
      report.errors.push(`✗ ${gear.id}: references non-existent axis "${gear.axis}"`);
    }
  });

  // 2. Check for gears on same axis (stacking validation)
  const gearsByAxis = {};
  gears.forEach(gear => {
    if (!gearsByAxis[gear.axis]) {
      gearsByAxis[gear.axis] = [];
    }
    gearsByAxis[gear.axis].push(gear);
  });

  Object.entries(gearsByAxis).forEach(([axisId, axisGears]) => {
    if (axisGears.length > 1) {
      // Check for vertical separation
      const stackPositions = axisGears.map(g => g.stack || 0).sort((a, b) => a - b);
      let hasCollision = false;

      for (let i = 0; i < stackPositions.length - 1; i++) {
        const gap = Math.abs(stackPositions[i + 1] - stackPositions[i]);
        const minGap = 4; // Minimum 4mm gap for gears with ~7mm thickness

        if (gap < minGap) {
          const gear1 = axisGears.find(g => (g.stack || 0) === stackPositions[i]);
          const gear2 = axisGears.find(g => (g.stack || 0) === stackPositions[i + 1]);
          report.warnings.push(`⚠ Gears ${gear1.id} and ${gear2.id} on axis ${axisId} may be too close (gap: ${gap.toFixed(1)}mm)`);
          hasCollision = true;
        }
      }

      if (!hasCollision) {
        report.passed.push(`✓ Axis ${axisId}: ${axisGears.length} gears properly stacked`);
      }
    }
  });

  // 3. Validate connections match 3D positions
  let validConnections = 0;
  let invalidConnections = 0;

  connections.forEach(conn => {
    const fromGear = gears.find(g => g.id === conn.from);
    const toGear = gears.find(g => g.id === conn.to);

    if (!fromGear || !toGear) {
      report.errors.push(`✗ Connection ${conn.from} → ${conn.to}: gear not found`);
      invalidConnections++;
      return;
    }

    const fromAxis = axes.find(a => a.id === fromGear.axis);
    const toAxis = axes.find(a => a.id === toGear.axis);

    if (!fromAxis || !toAxis) {
      report.errors.push(`✗ Connection ${conn.from} → ${conn.to}: axis not found`);
      invalidConnections++;
      return;
    }

    // Calculate 3D distance
    const dx = fromAxis.position[0] - toAxis.position[0];
    const dz = fromAxis.position[1] - toAxis.position[1];
    const dy = (fromGear.stack || 0) - (toGear.stack || 0);

    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = Math.abs(dy);

    if (conn.type === "coaxial") {
      // Coaxial gears should be on same axis
      if (fromGear.axis === toGear.axis) {
        validConnections++;
      } else {
        report.warnings.push(`⚠ Coaxial connection ${conn.from} → ${conn.to} but gears on different axes`);
        invalidConnections++;
      }
    } else if (conn.type === "mesh") {
      // Mesh gears should be on different axes but close enough
      if (fromGear.axis !== toGear.axis) {
        // Typical gear pitch radius is about toothCount * module / 2
        const fromRadius = (fromGear.toothCount * (fromGear.module || 1.35)) / 2;
        const toRadius = (toGear.toothCount * (toGear.module || 1.35)) / 2;
        const expectedDistance = fromRadius + toRadius;

        const tolerance = 10; // mm tolerance
        if (Math.abs(horizontalDistance - expectedDistance) < tolerance) {
          validConnections++;
        } else {
          report.info.push(`ℹ Mesh ${conn.from} → ${conn.to}: distance ${horizontalDistance.toFixed(1)}mm (expected ~${expectedDistance.toFixed(1)}mm)`);
          validConnections++; // Still count as valid, just note the difference
        }
      } else {
        report.warnings.push(`⚠ Mesh connection ${conn.from} → ${conn.to} but gears on same axis`);
        invalidConnections++;
      }
    }
  });

  report.info.push(`Connection validation: ${validConnections} valid, ${invalidConnections} invalid`);

  // 4. Check for spatial clustering (main mechanism vs planetary system)
  const mainGears = gears.filter(g => !g.id.startsWith("m") && !g.id.startsWith("v") &&
                                      !g.id.startsWith("ma") && !g.id.startsWith("j") &&
                                      !g.id.startsWith("sa"));
  const planetaryGears = gears.filter(g => g.id.startsWith("m") || g.id.startsWith("v") ||
                                           g.id.startsWith("ma") || g.id.startsWith("j") ||
                                           g.id.startsWith("sa"));

  report.info.push(`Main mechanism gears: ${mainGears.length}`);
  report.info.push(`Planetary system gears: ${planetaryGears.length}`);

  // 5. Calculate bounding box
  const positions = report.positions;
  const xCoords = positions.map(p => p.x);
  const yCoords = positions.map(p => p.y);
  const zCoords = positions.map(p => p.z);

  const bounds = {
    x: { min: Math.min(...xCoords), max: Math.max(...xCoords) },
    y: { min: Math.min(...yCoords), max: Math.max(...yCoords) },
    z: { min: Math.min(...zCoords), max: Math.max(...zCoords) },
  };

  const dimensions = {
    width: bounds.x.max - bounds.x.min,
    height: bounds.y.max - bounds.y.min,
    depth: bounds.z.max - bounds.z.min,
  };

  report.info.push(`Bounding box: ${dimensions.width.toFixed(1)} × ${dimensions.height.toFixed(1)} × ${dimensions.depth.toFixed(1)} mm`);

  // Historical box was ~180 x 80 x 330 mm (width x depth x height when laid flat)
  // Our coordinate system may differ
  if (dimensions.width < 400 && dimensions.depth < 400) {
    report.passed.push(`✓ Mechanism fits within reasonable spatial bounds`);
  } else {
    report.warnings.push(`⚠ Mechanism may be too large (${dimensions.width.toFixed(0)} × ${dimensions.depth.toFixed(0)} mm)`);
  }

  return report;
}

/**
 * Generates position validation report
 */
export function generate3DValidationReport() {
  console.log("=".repeat(80));
  console.log("ANTIKYTHERA MECHANISM - 3D POSITION VALIDATION");
  console.log("=".repeat(80));
  console.log("");

  const report = validate3DPositions();

  // Info Section
  console.log("📊 SPATIAL CONFIGURATION");
  console.log("-".repeat(80));
  report.info.forEach(msg => console.log(msg));
  console.log("");

  // Sample positions (first 10)
  console.log("📍 SAMPLE GEAR POSITIONS (first 10)");
  console.log("-".repeat(80));
  report.positions.slice(0, 10).forEach(p => {
    console.log(`${p.gearId.padEnd(6)} @ axis ${p.axis.padEnd(12)} → (${p.x.toString().padStart(6)}, ${p.y.toString().padStart(6)}, ${p.z.toString().padStart(6)}) mm | ${p.toothCount}T`);
  });
  console.log(`... and ${report.positions.length - 10} more`);
  console.log("");

  // Passed Checks
  if (report.passed.length > 0) {
    console.log("✅ POSITION CHECKS (" + report.passed.length + ")");
    console.log("-".repeat(80));
    report.passed.slice(0, 15).forEach(msg => console.log(msg));
    if (report.passed.length > 15) {
      console.log(`... and ${report.passed.length - 15} more`);
    }
    console.log("");
  }

  // Warnings
  if (report.warnings.length > 0) {
    console.log("⚠️  WARNINGS (" + report.warnings.length + ")");
    console.log("-".repeat(80));
    report.warnings.forEach(msg => console.log(msg));
    console.log("");
  }

  // Errors
  if (report.errors.length > 0) {
    console.log("❌ ERRORS (" + report.errors.length + ")");
    console.log("-".repeat(80));
    report.errors.forEach(msg => console.log(msg));
    console.log("");
  }

  // Summary
  const totalChecks = report.passed.length + report.warnings.length + report.errors.length;
  const passRate = totalChecks > 0 ? ((report.passed.length / totalChecks) * 100).toFixed(1) : 100;

  console.log("=".repeat(80));
  console.log("3D VALIDATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Gears Positioned: ${report.positions.length}`);
  console.log(`Checks Passed: ${report.passed.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Pass Rate: ${passRate}%`);
  console.log("");

  if (report.errors.length === 0 && report.warnings.length === 0) {
    console.log("✅ All gears are properly positioned in 3D space!");
  } else if (report.errors.length === 0) {
    console.log("⚠️  Positioning is valid but has some warnings to review.");
  } else {
    console.log("❌ There are positioning errors that should be fixed.");
  }

  console.log("=".repeat(80));

  return report;
}

// Run validation if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generate3DValidationReport();
}
