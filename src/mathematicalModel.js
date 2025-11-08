/**
 * Mathematical Model Export Module
 * Generates mathematical representations of the gear system
 */

/**
 * Calculates all gear ratios in the system
 */
export function calculateGearRatios(gears, connections) {
  const ratios = [];

  connections.forEach((conn) => {
    const fromGear = gears.find((g) => g.id === conn.from);
    const toGear = gears.find((g) => g.id === conn.to);

    if (!fromGear || !toGear) return;

    let ratio;
    let description;

    if (conn.type === "coaxial") {
      ratio = 1.0;
      description = `${conn.from} and ${conn.to} are coaxial (1:1 ratio)`;
    } else if (conn.type === "mesh") {
      if (conn.ratio !== undefined) {
        ratio = conn.ratio;
        description = `${conn.from} → ${conn.to}: custom ratio ${ratio.toFixed(6)}`;
      } else {
        ratio = -(fromGear.toothCount / toGear.toothCount);
        description = `${conn.from} (${fromGear.toothCount}T) → ${conn.to} (${toGear.toothCount}T): ratio ${ratio.toFixed(6)}`;
      }
    }

    ratios.push({
      from: conn.from,
      to: conn.to,
      type: conn.type,
      ratio,
      description,
      fromTeeth: fromGear.toothCount,
      toTeeth: toGear.toothCount,
    });
  });

  return ratios;
}

/**
 * Generates a transfer function matrix for the entire gear system
 */
export function generateTransferMatrix(gears, connections) {
  const gearIds = gears.map((g) => g.id);
  const n = gearIds.length;

  // Initialize matrix with zeros
  const matrix = Array(n).fill(0).map(() => Array(n).fill(0));

  // Set diagonal to 1 (gear to itself)
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
  }

  // Fill in direct connections
  connections.forEach((conn) => {
    const fromIndex = gearIds.indexOf(conn.from);
    const toIndex = gearIds.indexOf(conn.to);

    if (fromIndex === -1 || toIndex === -1) return;

    const fromGear = gears[fromIndex];
    const toGear = gears[toIndex];

    let ratio;
    if (conn.type === "coaxial") {
      ratio = 1.0;
    } else if (conn.type === "mesh") {
      if (conn.ratio !== undefined) {
        ratio = conn.ratio;
      } else {
        ratio = -(fromGear.toothCount / toGear.toothCount);
      }
    }

    matrix[toIndex][fromIndex] = ratio;
  });

  return {
    gearIds,
    matrix,
    size: n,
  };
}

/**
 * Calculates cumulative gear ratios from a driver gear to all other gears
 */
export function calculateCumulativeRatios(driverGearId, gears, connections) {
  const ratios = new Map();
  ratios.set(driverGearId, { ratio: 1.0, path: [driverGearId] });

  const queue = [{ id: driverGearId, ratio: 1.0, path: [driverGearId] }];
  const visited = new Set([driverGearId]);

  while (queue.length > 0) {
    const current = queue.shift();

    // Find all connections from current gear
    connections.forEach((conn) => {
      let nextId = null;
      let connectionRatio = 1.0;

      if (conn.from === current.id) {
        nextId = conn.to;
        const fromGear = gears.find((g) => g.id === conn.from);
        const toGear = gears.find((g) => g.id === conn.to);

        if (conn.type === "coaxial") {
          connectionRatio = 1.0;
        } else if (conn.type === "mesh") {
          connectionRatio = conn.ratio !== undefined
            ? conn.ratio
            : -(fromGear.toothCount / toGear.toothCount);
        }
      } else if (conn.to === current.id) {
        nextId = conn.from;
        const fromGear = gears.find((g) => g.id === conn.from);
        const toGear = gears.find((g) => g.id === conn.to);

        if (conn.type === "coaxial") {
          connectionRatio = 1.0;
        } else if (conn.type === "mesh") {
          const baseRatio = conn.ratio !== undefined
            ? conn.ratio
            : -(fromGear.toothCount / toGear.toothCount);
          connectionRatio = 1.0 / baseRatio;
        }
      }

      if (nextId && !visited.has(nextId)) {
        visited.add(nextId);
        const cumulativeRatio = current.ratio * connectionRatio;
        const path = [...current.path, nextId];

        ratios.set(nextId, {
          ratio: cumulativeRatio,
          path,
          pathDescription: path.join(" → "),
        });

        queue.push({
          id: nextId,
          ratio: cumulativeRatio,
          path,
        });
      }
    });
  }

  return ratios;
}

/**
 * Generates an angular momentum flow diagram as text
 */
export function generateFlowDiagram(driverGearId, gears, connections) {
  const cumulativeRatios = calculateCumulativeRatios(driverGearId, gears, connections);

  let diagram = `Angular Momentum Flow from ${driverGearId.toUpperCase()}\n`;
  diagram += "=".repeat(60) + "\n\n";

  // Sort by path length
  const sorted = Array.from(cumulativeRatios.entries())
    .sort((a, b) => a[1].path.length - b[1].path.length);

  sorted.forEach(([gearId, info]) => {
    const gear = gears.find((g) => g.id === gearId);
    const indent = "  ".repeat(info.path.length - 1);
    const direction = info.ratio > 0 ? "CCW ↻" : "CW ↺";
    const absRatio = Math.abs(info.ratio);

    diagram += `${indent}${gearId.toUpperCase()} (${gear.toothCount}T): `;
    diagram += `ratio = ${info.ratio.toFixed(6)} ${direction}`;

    if (absRatio !== 1.0) {
      diagram += ` | speed = ${(absRatio * 100).toFixed(2)}%`;
    }

    diagram += `\n`;

    if (info.path.length > 1) {
      diagram += `${indent}  Path: ${info.pathDescription}\n`;
    }
    diagram += "\n";
  });

  return diagram;
}

/**
 * Exports the mathematical model as JSON
 */
export function exportModelAsJSON(gears, connections) {
  const ratios = calculateGearRatios(gears, connections);
  const matrix = generateTransferMatrix(gears, connections);
  const cumulativeFromB1 = calculateCumulativeRatios("b1", gears, connections);

  return {
    metadata: {
      exportDate: new Date().toISOString(),
      gearCount: gears.length,
      connectionCount: connections.length,
    },
    gears: gears.map((g) => ({
      id: g.id,
      label: g.label,
      toothCount: g.toothCount,
      module: g.module || 1.35,
      axis: g.axis,
      stack: g.stack,
      trains: g.trains,
    })),
    connections: ratios,
    transferMatrix: matrix,
    cumulativeRatiosFromDriver: Object.fromEntries(cumulativeFromB1),
  };
}

/**
 * Exports the mathematical model as CSV
 */
export function exportModelAsCSV(gears, connections) {
  const ratios = calculateGearRatios(gears, connections);

  let csv = "From Gear,To Gear,Connection Type,From Teeth,To Teeth,Gear Ratio,Description\n";

  ratios.forEach((r) => {
    csv += `${r.from},${r.to},${r.type},${r.fromTeeth},${r.toTeeth},${r.ratio},"${r.description}"\n`;
  });

  return csv;
}

/**
 * Exports the mathematical model as LaTeX equations
 */
export function exportModelAsLaTeX(gears, connections) {
  let latex = "\\documentclass{article}\n";
  latex += "\\usepackage{amsmath}\n";
  latex += "\\usepackage{amssymb}\n";
  latex += "\\begin{document}\n\n";
  latex += "\\section{Antikythera Mechanism - Gear Ratios}\n\n";

  const ratios = calculateGearRatios(gears, connections);

  latex += "\\subsection{Direct Gear Connections}\n\n";
  latex += "\\begin{align*}\n";

  ratios.forEach((r, idx) => {
    if (r.type === "mesh") {
      latex += `  \\frac{\\omega_{\\text{${r.to}}}}{\\omega_{\\text{${r.from}}}} &= `;

      if (r.ratio > 0) {
        latex += `\\frac{${r.fromTeeth}}{${r.toTeeth}}`;
      } else {
        latex += `-\\frac{${r.fromTeeth}}{${r.toTeeth}}`;
      }

      latex += ` = ${r.ratio.toFixed(6)}`;

      if (idx < ratios.length - 1) {
        latex += " \\\\\n";
      }
    }
  });

  latex += "\n\\end{align*}\n\n";

  // Add cumulative ratios from driver
  latex += "\\subsection{Cumulative Ratios from Driver Gear B1}\n\n";
  const cumulative = calculateCumulativeRatios("b1", gears, connections);

  latex += "\\begin{align*}\n";
  const cumulativeArray = Array.from(cumulative.entries())
    .filter(([id]) => id !== "b1")
    .sort((a, b) => a[0].localeCompare(b[0]));

  cumulativeArray.forEach(([gearId, info], idx) => {
    latex += `  \\frac{\\omega_{\\text{${gearId}}}}{\\omega_{\\text{b1}}} &= ${info.ratio.toFixed(6)}`;

    if (idx < cumulativeArray.length - 1) {
      latex += " \\\\\n";
    }
  });

  latex += "\n\\end{align*}\n\n";

  latex += "\\end{document}\n";

  return latex;
}

/**
 * Creates a downloadable file from content
 */
export function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
