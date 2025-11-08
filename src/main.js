import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/webxr/XRControllerModelFactory.js";
import { createGearMesh } from "./gearFactory.js";
import { axes, gears, MILLIMETRES_PER_UNIT, trains, connections } from "./data/gears.js";
import { GearSystem } from "./system.js";
import { createFrontDialAssembly } from "./frontDial.js";
import {
  createPositionLabel,
  detectGearCollisions,
  highlightOverlappingGears,
  createConnectingRod,
  createAngularMomentumArrow,
  createCollisionReport,
  createVerticalStackIndicator,
  createLayerGridPlane,
} from "./visualizationHelpers.js";
import {
  exportModelAsJSON,
  exportModelAsCSV,
  exportModelAsLaTeX,
  generateFlowDiagram,
  generateTransferMatrix,
  downloadFile,
} from "./mathematicalModel.js";
import {
  createValidationDashboard,
  updateValidationDashboard,
  toggleValidationDashboard,
} from "./validationDashboard.js";
import {
  calculateAllPlanetsPositions,
  dateToJulianDay,
  daysSinceJ2000,
  calculateMoonPhase,
} from "./astronomy.js";
import {
  createEnhancedSolarSystem,
  updateCelestialBodies,
  createZodiacBackground,
  createEclipticPlane,
  createEclipseMarkers,
} from "./solarSystemEnhanced.js";

const scale = MILLIMETRES_PER_UNIT;
const container = document.getElementById("canvas-container");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);
const vrButton = VRButton.createButton(renderer);
document.body.appendChild(vrButton);

renderer.xr.addEventListener("sessionstart", () => {
  dolly.position.set(-180 * scale, 1.6, 0);
  document.getElementById("ui-panel").style.display = "none";
});

renderer.xr.addEventListener("sessionend", () => {
  dolly.position.set(320, 220, 420);
  camera.position.set(0, 1.6, 0);
  controls.target.set(-180 * scale, 0, 0);
  document.getElementById("ui-panel").style.display = "flex";
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070b);

const camera = new THREE.PerspectiveCamera(
  40,
  container.clientWidth / window.innerHeight,
  0.1,
  4000,
);
camera.position.set(0, 1.6, 0); // Set position for VR

const dolly = new THREE.Group();
dolly.position.set(320, 220, 420);
dolly.add(camera);
scene.add(dolly);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 120;
controls.maxDistance = 1200;
controls.target.set(-180 * scale, 0, 0);

const ambient = new THREE.AmbientLight(0x3c4250, 0.8);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfce8c3, 0.8);
keyLight.position.set(260, 340, 220);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x4c6ef5, 0.45);
rimLight.position.set(-260, -180, 360);
scene.add(rimLight);

const floorGeometry = new THREE.CircleGeometry(640 * scale, 96);
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x10131c,
  metalness: 0.2,
  roughness: 0.9,
  transparent: true,
  opacity: 0.45,
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotateX(-Math.PI / 2);
floor.position.set(-160 * scale, -26 * scale, 0);
scene.add(floor);

const axisGroups = new Map();
const axisHelpers = [];
const gearMeshes = new Map();
const pickTargets = [];
let dialPointerBindings = [];
let celestialBodyBindings = [];

// Visualization helpers
const positionLabels = new Map();
const angularMomentumArrows = new Map();
const connectingRods = [];
const stackIndicators = new Map();
const layerGrids = [];
let collisionReportElement = null;

axes.forEach((axis) => {
  const group = new THREE.Group();
  group.position.set(axis.position[0] * scale, axis.height * scale, axis.position[1] * scale);
  group.userData.axis = axis;

  const shaftGeometry = new THREE.CylinderGeometry(
    Math.max(axis.radius * 0.12 * scale, 0.8 * scale),
    Math.max(axis.radius * 0.12 * scale, 0.8 * scale),
    160 * scale,
    24,
  );
  const shaftMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3f4b,
    metalness: 0.6,
    roughness: 0.5,
    transparent: true,
    opacity: 0.55,
  });
  const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
  shaft.position.y = 40 * scale;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  const baseGeometry = new THREE.CylinderGeometry(
    axis.radius * 0.35 * scale,
    axis.radius * 0.35 * scale,
    6 * scale,
    32,
  );
  const base = new THREE.Mesh(baseGeometry, new THREE.MeshStandardMaterial({
    color: 0x1b1f2b,
    metalness: 0.4,
    roughness: 0.8,
  }));
  base.position.y = -3 * scale;
  base.receiveShadow = true;
  group.add(base);

  const label = createAxisLabel(axis.label);
  label.position.set(0, 96 * scale, 0);
  group.add(label);
  axisHelpers.push({ shaft, label });

  axisGroups.set(axis.id, group);
  scene.add(group);
});

const { group: frontDialGroup, pointerBindings: frontDialBindings } = createFrontDialAssembly({
  scale,
  axisGroups,
});
scene.add(frontDialGroup);
dialPointerBindings = frontDialBindings.map((binding) => ({
  pivot: binding.pivot,
  gearId: binding.gearId,
  ratio: binding.ratio ?? 1,
  phase: binding.phase ?? 0,
}));

const solarSystemGroup = createSolarSystem(scale);
scene.add(solarSystemGroup);

// Create validation dashboard
const validationDashboardElement = createValidationDashboard();
document.body.appendChild(validationDashboardElement);

const showToothMarkersCheckbox = document.getElementById("show-tooth-markers");

gears.forEach((gear) => {
  const axisGroup = axisGroups.get(gear.axis);
  if (!axisGroup) return;
  const mesh = createGearMesh(gear, {
    scale,
    showToothMarkers: showToothMarkersCheckbox.checked,
  });
  mesh.position.y = gear.stack * scale;
  axisGroup.add(mesh);
  gearMeshes.set(gear.id, { mesh, data: gear });

  const { rim, hub, bore, toothMeshes } = mesh.userData;
  pickTargets.push(rim, hub, bore, ...toothMeshes);

  // Create position label (hidden by default)
  const axis = axes.find(a => a.id === gear.axis);
  if (axis) {
    const label = createPositionLabel(gear, axis.position, gear.stack, scale);
    label.visible = false;
    mesh.add(label);
    positionLabels.set(gear.id, label);
  }

  // Create angular momentum arrow (hidden by default)
  const arrow = createAngularMomentumArrow(gear, 1, scale);
  arrow.visible = false;
  mesh.add(arrow);
  angularMomentumArrows.set(gear.id, arrow);

  // Create vertical stack indicator (hidden by default)
  const stackIndicator = createVerticalStackIndicator(mesh, axis.height, scale);
  if (stackIndicator) {
    stackIndicator.visible = false;
    mesh.add(stackIndicator);
    stackIndicators.set(gear.id, stackIndicator);
  }
});

const gearSystem = new GearSystem(gearMeshes);

// VR controller setup
const controller1 = renderer.xr.getController(0);
scene.add(controller1);

const controller2 = renderer.xr.getController(1);
scene.add(controller2);

const controllerModelFactory = new XRControllerModelFactory();

const controllerGrip1 = renderer.xr.getControllerGrip(0);
controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
scene.add(controllerGrip1);

const controllerGrip2 = renderer.xr.getControllerGrip(1);
controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));
scene.add(controllerGrip2);

const line = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
);
line.name = "line";
line.scale.z = 500;
controller1.add(line);

controller1.addEventListener("selectstart", () => {
  if (hoveredGear) {
    focusOnGear(hoveredGear);
    setSelectedGear(hoveredGear);
  }
});

controller2.addEventListener("selectstart", () => {
  if (renderer.xr.isPresenting) {
    isDragging = true;
    dragStartMatrix.copy(controller2.matrixWorld);
  }
});

controller2.addEventListener("selectend", () => {
  isDragging = false;
});


const playToggle = document.getElementById("play-toggle");
const speedControl = document.getElementById("speed-control");
const dateInput = document.getElementById("date-input");
const setDateBtn = document.getElementById("set-date-btn");
const trainFilter = document.getElementById("train-filter");
const gearSelect = document.getElementById("gear-select");
const showAxesCheckbox = document.getElementById("show-axes");
const showPositionLabelsCheckbox = document.getElementById("show-position-labels");
const showCollisionDetectionCheckbox = document.getElementById("show-collision-detection");
const showConnectingRodsCheckbox = document.getElementById("show-connecting-rods");
const showAngularMomentumCheckbox = document.getElementById("show-angular-momentum");
const showStackIndicatorsCheckbox = document.getElementById("show-stack-indicators");
const showLayerGridsCheckbox = document.getElementById("show-layer-grids");
const exportJSONBtn = document.getElementById("export-json");
const exportCSVBtn = document.getElementById("export-csv");
const exportLaTeXBtn = document.getElementById("export-latex");
const showFlowDiagramBtn = document.getElementById("show-flow-diagram");
const showTransferMatrixBtn = document.getElementById("show-transfer-matrix");
const showValidationDashboardCheckbox = document.getElementById("show-validation-dashboard");
const tooltip = document.getElementById("tooltip");
const detailFields = document.querySelectorAll("#gear-details [data-field]");

let isPaused = false;
let selectedGearId = null;
let hoveredGear = null;
let isDragging = false;
const dragStartMatrix = new THREE.Matrix4();

initialiseUI();
setDetails(null);
updateAnimationSpeed();
gearSystem.togglePause(isPaused);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener("pointermove", (event) => {
  pointer.x = (event.offsetX / renderer.domElement.clientWidth) * 2 - 1;
  pointer.y = -(event.offsetY / renderer.domElement.clientHeight) * 2 + 1;
  updateHover(event);
});

renderer.domElement.addEventListener("pointerleave", () => {
  hoveredGear = null;
  tooltip.hidden = true;
});

renderer.domElement.addEventListener("click", () => {
  if (hoveredGear) {
    focusOnGear(hoveredGear);
    setSelectedGear(hoveredGear);
  }
});

window.addEventListener("resize", onWindowResize);

playToggle.addEventListener("click", () => {
  isPaused = !isPaused;
  gearSystem.togglePause(isPaused);
  playToggle.textContent = isPaused ? "Play" : "Pause";
  if (!isPaused) {
    // If we are playing, ensure the speed is not 0
    if (Number(speedControl.value) === 0) {
      speedControl.value = "30.44"; // Default to 1 month/sec
    }
  } else {
    speedControl.value = "0";
  }
  updateAnimationSpeed();
});

speedControl.addEventListener("change", () => {
  const speed = Number(speedControl.value);
  isPaused = speed === 0;
  gearSystem.togglePause(isPaused);
  playToggle.textContent = isPaused ? "Play" : "Pause";
  updateAnimationSpeed();
});

trainFilter.addEventListener("change", () => {
  const trainId = trainFilter.value;
  if (trainId === "all") {
    gearSystem.highlightTrain(null);
    gearSelect.value = "";
    selectedGearId = null;
    setDetails(null);
    return;
  }
  const train = trains.find((t) => t.id === trainId);
  gearSystem.highlightTrain(train);
});

gearSelect.addEventListener("change", () => {
  const selected = gearSelect.value;
  if (!selected) {
    selectedGearId = null;
    setDetails(null);
    return;
  }
  trainFilter.value = "all";
  gearSystem.highlightTrain(null);
  focusOnGear(selected);
  setSelectedGear(selected);
});

showAxesCheckbox.addEventListener("change", () => {
  const visible = showAxesCheckbox.checked;
  axisHelpers.forEach(({ shaft, label }) => {
    shaft.visible = visible;
    label.visible = visible;
  });
});

showToothMarkersCheckbox.addEventListener("change", () => {
  const visible = showToothMarkersCheckbox.checked;
  gearMeshes.forEach(({ mesh }) => {
    mesh.userData.toothMeshes.forEach((tooth) => {
      tooth.visible = visible;
    });
  });
});

showPositionLabelsCheckbox.addEventListener("change", () => {
  const visible = showPositionLabelsCheckbox.checked;
  positionLabels.forEach((label) => {
    label.visible = visible;
  });
});

showCollisionDetectionCheckbox.addEventListener("change", () => {
  const enabled = showCollisionDetectionCheckbox.checked;
  if (enabled) {
    updateCollisionDetection();
  } else {
    // Remove collision highlighting
    highlightOverlappingGears(gearMeshes, []);
    if (collisionReportElement) {
      collisionReportElement.remove();
      collisionReportElement = null;
    }
  }
});

showConnectingRodsCheckbox.addEventListener("change", () => {
  const visible = showConnectingRodsCheckbox.checked;
  if (visible) {
    createAllConnectingRods();
  } else {
    removeAllConnectingRods();
  }
});

showAngularMomentumCheckbox.addEventListener("change", () => {
  const visible = showAngularMomentumCheckbox.checked;
  angularMomentumArrows.forEach((arrow) => {
    arrow.visible = visible;
  });
});

showStackIndicatorsCheckbox.addEventListener("change", () => {
  const visible = showStackIndicatorsCheckbox.checked;
  stackIndicators.forEach((indicator) => {
    if (indicator) {
      indicator.visible = visible;
    }
  });
});

showLayerGridsCheckbox.addEventListener("change", () => {
  const visible = showLayerGridsCheckbox.checked;
  if (visible) {
    createLayerGrids();
  } else {
    removeLayerGrids();
  }
});

setDateBtn.addEventListener("click", () => {
  const targetDate = new Date(dateInput.value);
  if (isNaN(targetDate)) return;

  // The mechanism's epoch is considered to be around 223 BCE for the Saros cycle.
  // For simplicity, we'll use a more recent and easily calculable epoch.
  const epoch = new Date("2000-01-01");
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const daysDifference = (targetDate - epoch) / millisecondsPerDay;

  // The b1 gear completes one rotation per year (365 days).
  const rotationPerDay = (2 * Math.PI) / 365.25; // Use 365.25 to account for leap years
  const targetAngle = daysDifference * rotationPerDay;

  gearSystem.setGearRotation("b1", targetAngle);
});

exportJSONBtn.addEventListener("click", () => {
  const model = exportModelAsJSON(gears, connections);
  const json = JSON.stringify(model, null, 2);
  downloadFile(json, "antikythera-model.json", "application/json");
});

exportCSVBtn.addEventListener("click", () => {
  const csv = exportModelAsCSV(gears, connections);
  downloadFile(csv, "antikythera-gear-ratios.csv", "text/csv");
});

exportLaTeXBtn.addEventListener("click", () => {
  const latex = exportModelAsLaTeX(gears, connections);
  downloadFile(latex, "antikythera-model.tex", "text/plain");
});

showFlowDiagramBtn.addEventListener("click", () => {
  const diagram = generateFlowDiagram("b1", gears, connections);
  showModal("Angular Momentum Flow Diagram", `<pre>${diagram}</pre>`);
});

showTransferMatrixBtn.addEventListener("click", () => {
  const matrixData = generateTransferMatrix(gears, connections);
  let content = `<h3>Transfer Matrix (${matrixData.size}x${matrixData.size})</h3>`;
  content += `<p>Gear Order: ${matrixData.gearIds.join(", ")}</p>`;
  content += `<div style="max-height: 400px; overflow: auto; font-family: monospace; font-size: 10px;">`;
  content += `<table style="border-collapse: collapse;">`;

  // Header row
  content += `<tr><th></th>`;
  matrixData.gearIds.forEach((id) => {
    content += `<th style="padding: 2px; border: 1px solid #ccc;">${id}</th>`;
  });
  content += `</tr>`;

  // Matrix rows
  matrixData.matrix.forEach((row, i) => {
    content += `<tr><th style="padding: 2px; border: 1px solid #ccc;">${matrixData.gearIds[i]}</th>`;
    row.forEach((val) => {
      const color = val === 0 ? "#ddd" : (val === 1 ? "#cfc" : (val > 0 ? "#ffc" : "#fcc"));
      content += `<td style="padding: 2px; border: 1px solid #ccc; background: ${color};">${val.toFixed(3)}</td>`;
    });
    content += `</tr>`;
  });

  content += `</table></div>`;
  showModal("Transfer Function Matrix", content);
});

showValidationDashboardCheckbox.addEventListener("change", () => {
  toggleValidationDashboard(showValidationDashboardCheckbox.checked);
});

function showModal(title, content) {
  // Create modal if it doesn't exist
  let modal = document.getElementById("math-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "math-modal";
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 10000;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
    `;
    document.body.appendChild(modal);

    const overlay = document.createElement("div");
    overlay.id = "math-modal-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      z-index: 9999;
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("click", () => {
      modal.style.display = "none";
      overlay.style.display = "none";
    });
  }

  const overlay = document.getElementById("math-modal-overlay");
  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
      <h2 style="margin: 0; color: #333;">${title}</h2>
      <button id="close-modal" style="padding: 5px 15px; cursor: pointer;">Close</button>
    </div>
    <div style="color: #333;">
      ${content}
    </div>
  `;

  modal.style.display = "block";
  overlay.style.display = "block";

  document.getElementById("close-modal").addEventListener("click", () => {
    modal.style.display = "none";
    overlay.style.display = "none";
  });
}

function initialiseUI() {
  trains.forEach((train) => {
    const option = document.createElement("option");
    option.value = train.id;
    option.textContent = train.label;
    trainFilter.append(option);
  });

  gears
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((gear) => {
      const option = document.createElement("option");
      option.value = gear.id;
      option.textContent = `${gear.label} (${gear.id.toUpperCase()})`;
      gearSelect.append(option);
    });
}

/**
 * Calculates the driver gear's speed based on the selected value
 * in the speed control dropdown and updates the gear system.
 */
function updateAnimationSpeed() {
  const daysPerSecond = Number(speedControl.value);
  const rotationPerDay = (2 * Math.PI) / 365.25;
  const radiansPerSecond = daysPerSecond * rotationPerDay;
  gearSystem.setDriverSpeed(radiansPerSecond);
}

function onWindowResize() {
  camera.aspect = container.clientWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, window.innerHeight);
}

function updateHover(event) {
  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects(pickTargets, false);
  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    const gearMesh = findGearByMesh(mesh);
    if (gearMesh) {
      hoveredGear = gearMesh.data.id;
      tooltip.hidden = false;
      tooltip.textContent = gearMesh.data.label;
      tooltip.style.left = `${event.clientX}px`;
      tooltip.style.top = `${event.clientY}px`;
      return;
    }
  }
  hoveredGear = null;
  tooltip.hidden = true;
}

function findGearByMesh(mesh) {
  return Array.from(gearMeshes.values()).find((entry) => {
    const { rim, hub, bore, toothMeshes } = entry.mesh.userData;
    return mesh === rim || mesh === hub || mesh === bore || toothMeshes.includes(mesh);
  });
}

function setSelectedGear(gearId) {
  if (selectedGearId === gearId) {
    return;
  }
  if (selectedGearId) {
    const previous = gearMeshes.get(selectedGearId);
    if (previous) {
      setHighlight(previous.mesh, false);
    }
  }
  selectedGearId = gearId;
  if (gearId) {
    const entry = gearMeshes.get(gearId);
    if (entry) {
      setHighlight(entry.mesh, true);
      gearSelect.value = gearId;
      setDetails(entry.data);
    }
  }
}

function setHighlight(mesh, highlighted) {
  mesh.traverse((child) => {
    if (child.isMesh && child.material && "emissiveIntensity" in child.material) {
      child.material.emissiveIntensity = highlighted ? 1.2 : 0.35;
    }
  });
}

function focusOnGear(gearId) {
  const entry = gearMeshes.get(gearId);
  if (!entry) return;
  const worldPosition = new THREE.Vector3();
  entry.mesh.getWorldPosition(worldPosition);
  controls.target.copy(worldPosition);
  controls.update();
}

function setDetails(gear) {
  const fields = new Map();
  detailFields.forEach((el) => {
    fields.set(el.dataset.field, el);
  });

  if (!gear) {
    fields.get("name").textContent = "—";
    fields.get("teeth").textContent = "—";
    fields.get("module").textContent = "—";
    fields.get("function").textContent = "—";
    fields.get("notes").textContent = "Select a gear to inspect its role in the mechanism.";
    return;
  }

  fields.get("name").textContent = `${gear.label} (${gear.id.toUpperCase()})`;
  fields.get("teeth").textContent = `${gear.toothCount} teeth`;
  const moduleValue = gear.module ??
    (gear.pitchRadius ? (gear.pitchRadius * 2) / gear.toothCount : 1.35);
  fields.get("module").textContent = `${moduleValue.toFixed(2)} mm`;
  fields.get("function").textContent = gear.function;
  fields.get("notes").textContent = gear.notes;
}

let lastTime = performance.now();
const tempMatrix = new THREE.Matrix4();

function handleController(controller) {
  if (renderer.xr.isPresenting) {
    const line = controller.getObjectByName("line");
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    const intersects = raycaster.intersectObjects(pickTargets, false);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const gearMesh = findGearByMesh(mesh);
      if (gearMesh) {
        hoveredGear = gearMesh.data.id;
        line.material.color.setHex(0x00ff00);
      }
    } else {
      hoveredGear = null;
      line.material.color.setHex(0xffffff);
    }
  }
}

function handleDrag(controller) {
  if (isDragging) {
    const currentMatrix = controller.matrixWorld;
    const delta = new THREE.Vector3().setFromMatrixPosition(currentMatrix).sub(new THREE.Vector3().setFromMatrixPosition(dragStartMatrix));
    dolly.position.sub(delta);
    dragStartMatrix.copy(currentMatrix);
  }
}

function updateCollisionDetection() {
  const collisions = detectGearCollisions(gearMeshes, axisGroups, scale);
  highlightOverlappingGears(gearMeshes, collisions);

  // Remove old report if exists
  if (collisionReportElement) {
    collisionReportElement.remove();
  }

  // Create new report
  collisionReportElement = createCollisionReport(collisions);
  document.body.appendChild(collisionReportElement);
}

function createAllConnectingRods() {
  // Remove any existing rods first
  removeAllConnectingRods();

  // Create rods for all connections
  connections.forEach((conn) => {
    const gear1 = gearMeshes.get(conn.from);
    const gear2 = gearMeshes.get(conn.to);

    if (gear1 && gear2 && conn.type === "mesh") {
      const pos1 = new THREE.Vector3();
      const pos2 = new THREE.Vector3();
      gear1.mesh.getWorldPosition(pos1);
      gear2.mesh.getWorldPosition(pos2);

      const rod = createConnectingRod(pos1, pos2, scale);
      scene.add(rod);
      connectingRods.push(rod);
    }
  });
}

function removeAllConnectingRods() {
  connectingRods.forEach((rod) => {
    scene.remove(rod);
    rod.geometry.dispose();
    rod.material.dispose();
  });
  connectingRods.length = 0;
}

function updateAngularMomentumArrows() {
  angularMomentumArrows.forEach((arrow, gearId) => {
    const gearEntry = gearMeshes.get(gearId);
    if (gearEntry) {
      const rotation = gearEntry.mesh.rotation.y;
      const angularVelocity = rotation - (gearEntry.lastRotation || 0);
      gearEntry.lastRotation = rotation;

      // Update arrow direction based on rotation direction
      if (Math.abs(angularVelocity) > 0.0001) {
        const direction = angularVelocity > 0 ? 1 : -1;
        arrow.position.y = 40 * scale * direction;
        arrow.rotation.x = direction > 0 ? 0 : Math.PI;

        // Update color
        const color = direction > 0 ? 0x4488ff : 0xff4488;
        arrow.material.color.setHex(color);
        arrow.material.emissive.setHex(color);
      }
    }
  });
}

function createLayerGrids() {
  // Remove any existing grids first
  removeLayerGrids();

  // Find unique stack heights
  const uniqueHeights = new Set();
  gears.forEach((gear) => {
    uniqueHeights.add(gear.stack);
  });

  // Create a grid for each unique height
  uniqueHeights.forEach((height) => {
    const grid = createLayerGridPlane(height, scale);
    scene.add(grid);
    layerGrids.push(grid);
  });
}

function removeLayerGrids() {
  layerGrids.forEach((grid) => {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  });
  layerGrids.length = 0;
}

function animate(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;
  controls.update();
  handleController(controller1);
  handleDrag(controller2);
  gearSystem.update(delta);
  dialPointerBindings.forEach((binding) => {
    const gearEntry = gearMeshes.get(binding.gearId);
    if (!gearEntry) {
      return;
    }
    const baseRotation = (gearEntry.mesh.rotation.y ?? 0) * binding.ratio + binding.phase;
    binding.pivot.rotation.y = baseRotation;
  });
  celestialBodyBindings.forEach((binding) => {
    const gearEntry = gearMeshes.get(binding.gearId);
    if (!gearEntry) {
      return;
    }
    binding.pivot.rotation.z = gearEntry.mesh.rotation.y;
  });

  // Update angular momentum arrows if visible
  if (showAngularMomentumCheckbox.checked) {
    updateAngularMomentumArrows();
  }

  // Update validation dashboard if visible
  if (showValidationDashboardCheckbox.checked) {
    updateValidationDashboard(gearMeshes, gearSystem, delta);
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

function createAxisLabel(text) {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.font = "28px 'Segoe UI', sans-serif";
  context.fillStyle = "rgba(255, 209, 102, 0.92)";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(70 * scale, 70 * scale, 1);
  return sprite;
}

/**
 * Creates the 3D visualization of the solar system, including the Sun,
 * planets, and their orbital rings.
 * @param {number} scale - The global scaling factor for the scene.
 * @returns {THREE.Group} A group containing the entire solar system visualization.
 */
function createSolarSystem(scale) {
  const solarSystemGroup = new THREE.Group();
  solarSystemGroup.position.set(0, 150 * scale, 0);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(15 * scale, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffd700, emissiveIntensity: 1 }),
  );
  solarSystemGroup.add(sun);

  const planetData = [
    { name: "Mercury", gear: "m5", color: 0xcccccc, radius: 4, distance: 30 },
    { name: "Venus", gear: "v4", color: 0xfdca40, radius: 6, distance: 50 },
    { name: "Mars", gear: "ma3", color: 0xff6b6b, radius: 5, distance: 70 },
    { name: "Jupiter", gear: "j3", color: 0xffd166, radius: 10, distance: 100 },
    { name: "Saturn", gear: "sa3", color: 0xc4a287, radius: 8, distance: 130 },
    { name: "Moon", gear: "k2", color: 0x8c8c8c, radius: 3, distance: 20 },
  ];

  planetData.forEach(p => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(p.distance * scale, 0.5 * scale, 16, 100),
      new THREE.MeshStandardMaterial({ color: 0x444444 }),
    );
    ring.rotation.x = Math.PI / 2;
    solarSystemGroup.add(ring);

    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * scale, 32, 32),
      new THREE.MeshStandardMaterial({ color: p.color }),
    );
    planet.position.x = p.distance * scale;
    ring.add(planet);

    celestialBodyBindings.push({
      pivot: ring,
      gearId: p.gear,
    });
  });

  return solarSystemGroup;
}
