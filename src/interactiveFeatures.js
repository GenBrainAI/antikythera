import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

/**
 * Interactive Features Module
 * Implements gear network visualization, step-through mode, and educational features
 */

/**
 * Finds all connected gears from a starting gear
 */
export function findConnectedGears(startGearId, connections) {
  const connected = new Set([startGearId]);
  const queue = [startGearId];
  const chain = [];

  while (queue.length > 0) {
    const current = queue.shift();

    connections.forEach(conn => {
      if (conn.from === current && !connected.has(conn.to)) {
        connected.add(conn.to);
        queue.push(conn.to);
        chain.push({ from: current, to: conn.to, type: conn.type });
      } else if (conn.to === current && !connected.has(conn.from)) {
        connected.add(conn.from);
        queue.push(conn.from);
        chain.push({ from: conn.from, to: current, type: conn.type });
      }
    });
  }

  return { connected: Array.from(connected), chain };
}

/**
 * Highlights a gear chain in the 3D scene
 */
export function highlightGearChain(gearIds, gearMeshes, highlight = true) {
  gearMeshes.forEach((gearEntry, id) => {
    const { mesh } = gearEntry;
    const isInChain = gearIds.includes(id);

    mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        if (highlight && isInChain) {
          child.material.emissive = new THREE.Color(0x00ff88);
          child.material.emissiveIntensity = 0.8;
        } else if (highlight && !isInChain) {
          child.material.opacity = 0.3;
          child.material.transparent = true;
        } else {
          // Reset
          const baseColor = gearEntry.data.color || 0xc9c3b1;
          child.material.emissive = new THREE.Color(baseColor).multiplyScalar(0.15);
          child.material.emissiveIntensity = 0.35;
          child.material.opacity = 1.0;
          child.material.transparent = false;
        }
      }
    });
  });
}

/**
 * Creates torque/force visualization arrows
 */
export function createTorqueArrows(chain, gearMeshes, scale) {
  const arrows = [];

  chain.forEach(link => {
    const fromGear = gearMeshes.get(link.from);
    const toGear = gearMeshes.get(link.to);

    if (fromGear && toGear) {
      const fromPos = new THREE.Vector3();
      const toPos = new THREE.Vector3();
      fromGear.mesh.getWorldPosition(fromPos);
      toGear.mesh.getWorldPosition(toPos);

      const direction = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
      const midpoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);

      const arrowHelper = new THREE.ArrowHelper(
        direction,
        midpoint,
        20 * scale,
        0xff00ff,
        5 * scale,
        3 * scale
      );

      arrows.push(arrowHelper);
    }
  });

  return arrows;
}

/**
 * Creates a connectivity graph visualization
 */
export function createConnectivityGraph(gears, connections) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");

  // Clear background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Layout gears in a circle
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 50;

  const gearPositions = new Map();
  gears.forEach((gear, index) => {
    const angle = (index / gears.length) * 2 * Math.PI;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    gearPositions.set(gear.id, { x, y });
  });

  // Draw connections
  ctx.strokeStyle = "#666666";
  ctx.lineWidth = 1;

  connections.forEach(conn => {
    const from = gearPositions.get(conn.from);
    const to = gearPositions.get(conn.to);

    if (from && to) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  });

  // Draw gear nodes
  gears.forEach(gear => {
    const pos = gearPositions.get(gear.id);
    if (pos) {
      ctx.fillStyle = `#${gear.color.toString(16).padStart(6, "0")}`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(gear.id.toUpperCase(), pos.x, pos.y + 20);
    }
  });

  return canvas;
}

/**
 * Step-through mode controller
 */
export class StepThroughController {
  constructor(gearSystem) {
    this.gearSystem = gearSystem;
    this.isPaused = true;
    this.stepSize = 0.01;  // radians
    this.currentStep = 0;
  }

  stepForward() {
    this.currentStep += this.stepSize;
    this.gearSystem.setGearRotation("b1", this.currentStep);
  }

  stepBackward() {
    this.currentStep -= this.stepSize;
    this.gearSystem.setGearRotation("b1", this.currentStep);
  }

  reset() {
    this.currentStep = 0;
    this.gearSystem.setGearRotation("b1", 0);
  }

  setStepSize(size) {
    this.stepSize = size;
  }

  getCurrentStep() {
    return this.currentStep;
  }
}

/**
 * Creates educational annotations for gears
 */
export function createEducationalAnnotation(gear, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#00ff88";
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  // Title
  ctx.font = "bold 28px Arial";
  ctx.fillStyle = "#00ff88";
  ctx.textAlign = "center";
  ctx.fillText(gear.label, canvas.width / 2, 40);

  // Details
  ctx.font = "18px Arial";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";

  let y = 80;
  const lineHeight = 25;

  const details = [
    `ID: ${gear.id.toUpperCase()}`,
    `Teeth: ${gear.toothCount}`,
    `Module: ${(gear.module || 1.35).toFixed(2)}mm`,
    `Axis: ${gear.axis}`,
    `Trains: ${(gear.trains || []).join(", ")}`,
    "",
    "Function:",
  ];

  details.forEach(line => {
    ctx.fillText(line, 30, y);
    y += lineHeight;
  });

  // Function text (wrapped)
  ctx.font = "14px Arial";
  ctx.fillStyle = "#cccccc";
  const functionText = gear.function || "No description available";
  const words = functionText.split(" ");
  let line = "";
  const maxWidth = canvas.width - 60;

  words.forEach(word => {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line, 30, y);
      line = word + " ";
      y += 20;
    } else {
      line = testLine;
    }
  });
  ctx.fillText(line, 30, y);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(80 * scale, 60 * scale, 1);
  sprite.position.y = 50 * scale;

  return sprite;
}

/**
 * Calculates speed reduction/multiplication through a gear train
 */
export function calculateSpeedReduction(chain, gears) {
  let totalRatio = 1.0;
  const steps = [];

  chain.forEach(link => {
    const fromGear = gears.find(g => g.id === link.from);
    const toGear = gears.find(g => g.id === link.to);

    if (fromGear && toGear && link.type === "mesh") {
      const ratio = -(fromGear.toothCount / toGear.toothCount);
      totalRatio *= ratio;

      steps.push({
        from: link.from,
        to: link.to,
        ratio,
        cumulative: totalRatio,
      });
    }
  });

  return { totalRatio, steps };
}
