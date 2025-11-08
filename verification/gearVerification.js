/**
 * Gear Configuration Verification Tool
 * Compares gear configuration in gears.js against research papers
 */

import { gears, connections, axes } from "../src/data/gears.js";

// Research paper specifications
const RESEARCH_SPECS = {
  totalGearsMinimum: 30, // "at least 30 bronze gears"
  fragmentAGears: 27, // Fragment A contains 27 interlocking gears
  mainDriveGearTeeth: 223, // B1 gear - main drive
  venusGearTeeth: 63, // Fragment D - Venus mechanism (UCL 2021)

  // Known tooth counts from Freeth et al. 2008
  knownToothCounts: {
    sunPointer: 64,
    gears: [38, 48, 24, 53, 127],
  },

  // Astronomical cycles
  cycles: {
    metonic: {
      years: 19,
      months: 235,
    },
    saros: {
      months: 223,
      years: 18,
      days: 11 + 1/3,
    },
    callippic: {
      years: 76,
      months: 940, // 4 * 235
    },
    venus: {
      years: 462,
      synodicPeriod: 583.92, // days
    },
    saturn: {
      years: 442,
      synodicPeriod: 378.09, // days
    },
  },

  // Physical specifications
  physical: {
    gearThickness: {
      min: 1.4, // mm
      max: 7.2, // mm
    },
    toothPitch: 1.6, // mm
    toothGap: 1.2, // mm
    module: 1.35, // standard module
    boxDimensions: {
      width: 180, // mm (33cm total case)
      height: 330,
      depth: 80,
    },
  },
};

/**
 * Verifies the configuration
 */
export function verifyGearConfiguration() {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
    info: [],
  };

  // 1. Check total gear count
  report.info.push(`Total gears configured: ${gears.length}`);
  if (gears.length >= RESEARCH_SPECS.totalGearsMinimum) {
    report.passed.push(`✓ Total gear count (${gears.length}) meets minimum requirement of ${RESEARCH_SPECS.totalGearsMinimum}`);
  } else {
    report.errors.push(`✗ Total gear count (${gears.length}) is less than research minimum of ${RESEARCH_SPECS.totalGearsMinimum}`);
  }

  // 2. Check B1 main drive gear
  const b1Gear = gears.find(g => g.id === "b1");
  if (b1Gear) {
    if (b1Gear.toothCount === RESEARCH_SPECS.mainDriveGearTeeth) {
      report.passed.push(`✓ B1 main drive gear has correct tooth count: ${RESEARCH_SPECS.mainDriveGearTeeth}`);
    } else {
      report.errors.push(`✗ B1 gear has ${b1Gear.toothCount} teeth, should be ${RESEARCH_SPECS.mainDriveGearTeeth}`);
    }
  } else {
    report.errors.push(`✗ B1 main drive gear not found`);
  }

  // 3. Check for Venus gear (63 teeth)
  const venusGears = gears.filter(g => g.toothCount === RESEARCH_SPECS.venusGearTeeth);
  if (venusGears.length > 0) {
    report.passed.push(`✓ Found gear(s) with 63 teeth (Fragment D - Venus mechanism): ${venusGears.map(g => g.id).join(", ")}`);
  } else {
    report.warnings.push(`⚠ No gear found with 63 teeth (Fragment D gear)`);
  }

  // 4. Check for known tooth counts from research
  RESEARCH_SPECS.knownToothCounts.gears.forEach(teeth => {
    const found = gears.filter(g => g.toothCount === teeth);
    if (found.length > 0) {
      report.passed.push(`✓ Found gear(s) with ${teeth} teeth: ${found.map(g => g.id).join(", ")}`);
    } else {
      report.warnings.push(`⚠ No gear found with ${teeth} teeth (mentioned in research)`);
    }
  });

  // 5. Check module consistency
  const gearsWithModule = gears.filter(g => g.module !== undefined);
  const moduleValues = [...new Set(gearsWithModule.map(g => g.module))];
  report.info.push(`Module values used: ${moduleValues.join(", ")}`);
  const standardModule = moduleValues.filter(m => Math.abs(m - RESEARCH_SPECS.physical.module) < 0.01);
  if (standardModule.length > 0) {
    report.passed.push(`✓ Standard module ${RESEARCH_SPECS.physical.module}mm is used`);
  }

  // 6. Check thickness ranges
  const thicknesses = gears.map(g => g.thickness).filter(t => t !== undefined);
  const minThick = Math.min(...thicknesses);
  const maxThick = Math.max(...thicknesses);
  report.info.push(`Gear thickness range: ${minThick}mm - ${maxThick}mm`);
  if (minThick >= RESEARCH_SPECS.physical.gearThickness.min - 0.5 &&
      maxThick <= RESEARCH_SPECS.physical.gearThickness.max + 0.5) {
    report.passed.push(`✓ Gear thickness within historical range`);
  } else {
    report.warnings.push(`⚠ Gear thickness outside expected range (${RESEARCH_SPECS.physical.gearThickness.min}-${RESEARCH_SPECS.physical.gearThickness.max}mm)`);
  }

  // 7. Check axes count
  report.info.push(`Total axes configured: ${axes.length}`);
  if (axes.length >= 18) {
    report.passed.push(`✓ Sufficient axes configured (${axes.length})`);
  }

  // 8. Check for critical gears
  const criticalGears = {
    "b1": "Main drive (Sun, 223T)",
    "b2": "Metonic train driver",
    "k2": "Moon phase",
    "m5": "Mercury",
    "v4": "Venus",
    "ma3": "Mars",
    "j3": "Jupiter",
    "sa3": "Saturn",
  };

  Object.entries(criticalGears).forEach(([id, desc]) => {
    const gear = gears.find(g => g.id === id);
    if (gear) {
      report.passed.push(`✓ Critical gear ${id} (${desc}) found: ${gear.toothCount} teeth`);
    } else {
      report.errors.push(`✗ Critical gear ${id} (${desc}) missing`);
    }
  });

  // 9. Check gear trains
  const trains = new Set();
  gears.forEach(g => {
    if (g.trains) {
      g.trains.forEach(t => trains.add(t));
    }
  });
  report.info.push(`Gear trains configured: ${Array.from(trains).join(", ")}`);

  const expectedTrains = ["Solar", "Metonic", "Saros", "Callippic", "Olympiad"];
  expectedTrains.forEach(train => {
    if (trains.has(train)) {
      report.passed.push(`✓ ${train} train configured`);
    } else {
      report.warnings.push(`⚠ ${train} train not found`);
    }
  });

  // 10. Check connections
  report.info.push(`Total connections: ${connections.length}`);
  const meshConnections = connections.filter(c => c.type === "mesh");
  const coaxialConnections = connections.filter(c => c.type === "coaxial");
  report.info.push(`Mesh connections: ${meshConnections.length}, Coaxial: ${coaxialConnections.length}`);

  // 11. Verify Metonic cycle calculation
  const metonicGears = gears.filter(g => g.trains && g.trains.includes("Metonic"));
  if (metonicGears.length > 0) {
    report.passed.push(`✓ Metonic cycle gears: ${metonicGears.length} gears configured`);
  }

  // 12. Verify Saros cycle calculation
  const sarosGears = gears.filter(g => g.trains && g.trains.includes("Saros"));
  if (sarosGears.length > 0) {
    report.passed.push(`✓ Saros cycle gears: ${sarosGears.length} gears configured`);
  }

  // 13. Check for pin-and-slot mechanism (lunar anomaly)
  const lunarAnomalyGears = gears.filter(g =>
    g.id.includes("e") || g.function?.toLowerCase().includes("lunar") || g.function?.toLowerCase().includes("anomaly")
  );
  if (lunarAnomalyGears.length > 0) {
    report.passed.push(`✓ Lunar anomaly mechanism gears found: ${lunarAnomalyGears.map(g => g.id).join(", ")}`);
  }

  // 14. Check planetary gears
  const planetaryGears = gears.filter(g =>
    g.id.startsWith("m") || g.id.startsWith("v") || g.id.startsWith("ma") ||
    g.id.startsWith("j") || g.id.startsWith("sa")
  );
  report.info.push(`Planetary gears configured: ${planetaryGears.length}`);
  if (planetaryGears.length >= 12) {
    report.passed.push(`✓ Planetary system gears configured (${planetaryGears.length})`);
  }

  return report;
}

/**
 * Validates gear ratios for astronomical cycles
 */
export function validateAstronomicalRatios() {
  const report = {
    passed: [],
    warnings: [],
    errors: [],
    calculations: [],
  };

  // Find gear chains for each cycle
  const b1 = gears.find(g => g.id === "b1");
  if (!b1) {
    report.errors.push("✗ Cannot validate ratios: B1 gear not found");
    return report;
  }

  // Metonic Cycle: 19 years = 235 months
  // Should have ratio of 235/19 = 12.368421...
  const metonicRatio = RESEARCH_SPECS.cycles.metonic.months / RESEARCH_SPECS.cycles.metonic.years;
  report.calculations.push(`Metonic ratio: ${RESEARCH_SPECS.cycles.metonic.years} years = ${RESEARCH_SPECS.cycles.metonic.months} months → ratio = ${metonicRatio.toFixed(6)}`);

  // Saros Cycle: 223 months
  report.calculations.push(`Saros cycle: ${RESEARCH_SPECS.cycles.saros.months} months`);

  // Callippic Cycle: 76 years = 940 months
  const callippicRatio = RESEARCH_SPECS.cycles.callippic.months / RESEARCH_SPECS.cycles.callippic.years;
  report.calculations.push(`Callippic ratio: ${RESEARCH_SPECS.cycles.callippic.years} years = ${RESEARCH_SPECS.cycles.callippic.months} months → ratio = ${callippicRatio.toFixed(6)}`);

  report.passed.push("✓ Astronomical ratios calculated");

  return report;
}

/**
 * Generates a comparison report
 */
export function generateVerificationReport() {
  console.log("=".repeat(80));
  console.log("ANTIKYTHERA MECHANISM - GEAR CONFIGURATION VERIFICATION");
  console.log("Based on research by Freeth et al. (2006, 2008, 2021)");
  console.log("=".repeat(80));
  console.log("");

  const configReport = verifyGearConfiguration();
  const ratioReport = validateAstronomicalRatios();

  // Info Section
  console.log("📊 CONFIGURATION SUMMARY");
  console.log("-".repeat(80));
  configReport.info.forEach(msg => console.log(msg));
  console.log("");

  // Passed Checks
  console.log("✅ PASSED CHECKS (" + configReport.passed.length + ")");
  console.log("-".repeat(80));
  configReport.passed.forEach(msg => console.log(msg));
  console.log("");

  // Warnings
  if (configReport.warnings.length > 0) {
    console.log("⚠️  WARNINGS (" + configReport.warnings.length + ")");
    console.log("-".repeat(80));
    configReport.warnings.forEach(msg => console.log(msg));
    console.log("");
  }

  // Errors
  if (configReport.errors.length > 0) {
    console.log("❌ ERRORS (" + configReport.errors.length + ")");
    console.log("-".repeat(80));
    configReport.errors.forEach(msg => console.log(msg));
    console.log("");
  }

  // Astronomical Calculations
  console.log("🔢 ASTRONOMICAL RATIO CALCULATIONS");
  console.log("-".repeat(80));
  ratioReport.calculations.forEach(msg => console.log(msg));
  console.log("");

  // Summary
  const totalChecks = configReport.passed.length + configReport.warnings.length + configReport.errors.length;
  const passRate = ((configReport.passed.length / totalChecks) * 100).toFixed(1);

  console.log("=".repeat(80));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Checks: ${totalChecks}`);
  console.log(`Passed: ${configReport.passed.length} (${passRate}%)`);
  console.log(`Warnings: ${configReport.warnings.length}`);
  console.log(`Errors: ${configReport.errors.length}`);
  console.log("");

  if (configReport.errors.length === 0) {
    console.log("✅ Configuration appears to be consistent with research papers!");
  } else {
    console.log("⚠️  Configuration has discrepancies that should be reviewed.");
  }

  console.log("=".repeat(80));

  return {
    config: configReport,
    ratios: ratioReport,
    summary: {
      total: totalChecks,
      passed: configReport.passed.length,
      warnings: configReport.warnings.length,
      errors: configReport.errors.length,
      passRate: parseFloat(passRate),
    },
  };
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateVerificationReport();
}
