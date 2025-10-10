import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js";
import { VRButton } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/webxr/XRControllerModelFactory.js";
import { createGearMesh } from "./gearFactory.js";
import { axes, gears, MILLIMETRES_PER_UNIT, trains } from "./data/gears.js";
import { GearSystem } from "./system.js";
import { createFrontDialAssembly } from "./frontDial.js";

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
const speedSlider = document.getElementById("speed");
const speedValue = document.getElementById("speed-value");
const timeStepSlider = document.getElementById("time-step");
const timeStepValue = document.getElementById("time-step-value");
const trainFilter = document.getElementById("train-filter");
const gearSelect = document.getElementById("gear-select");
const showAxesCheckbox = document.getElementById("show-axes");
const tooltip = document.getElementById("tooltip");
const detailFields = document.querySelectorAll("#gear-details [data-field]");

let isPaused = false;
let selectedGearId = null;
let hoveredGear = null;
let isDragging = false;
const dragStartMatrix = new THREE.Matrix4();

initialiseUI();
setDetails(null);
updateDriver();
updateTimeScale();
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
});

speedSlider.addEventListener("input", () => {
  speedValue.textContent = Number(speedSlider.value).toFixed(1);
  updateDriver();
});

timeStepSlider.addEventListener("input", () => {
  timeStepValue.textContent = `×${Number(timeStepSlider.value).toFixed(1)}`;
  updateTimeScale();
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

  speedValue.textContent = Number(speedSlider.value).toFixed(1);
  timeStepValue.textContent = `×${Number(timeStepSlider.value).toFixed(1)}`;
}

function updateDriver() {
  gearSystem.setDriver("b1", Number(speedSlider.value));
}

function updateTimeScale() {
  gearSystem.setTimeScale(Number(timeStepSlider.value));
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
