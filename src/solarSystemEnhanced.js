import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";
import { calculateAllPlanetsPositions, getZodiacSign } from "./astronomy.js";

/**
 * Creates an enhanced solar system with both mechanism and actual astronomical positions
 */
export function createEnhancedSolarSystem(scale) {
  const solarSystemGroup = new THREE.Group();
  solarSystemGroup.position.set(0, 150 * scale, 0);

  // Add Sun
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(15 * scale, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 1,
    }),
  );
  solarSystemGroup.add(sun);

  // Add Earth at orbital distance
  const earthRing = new THREE.Mesh(
    new THREE.TorusGeometry(40 * scale, 0.5 * scale, 16, 100),
    new THREE.MeshStandardMaterial({ color: 0x4444aa }),
  );
  earthRing.rotation.x = Math.PI / 2;
  solarSystemGroup.add(earthRing);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(6 * scale, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x4488ff }),
  );
  earth.position.x = 40 * scale;
  earthRing.add(earth);

  // Planet data with both mechanism gear and actual properties
  const planetData = [
    {
      name: "Mercury",
      gear: "m5",
      color: 0xcccccc,
      radius: 4,
      distance: 30,
      actualDistance: 25,  // Scaled for visualization
    },
    {
      name: "Venus",
      gear: "v4",
      color: 0xfdca40,
      radius: 6,
      distance: 50,
      actualDistance: 35,
    },
    {
      name: "Mars",
      gear: "ma3",
      color: 0xff6b6b,
      radius: 5,
      distance: 70,
      actualDistance: 60,
    },
    {
      name: "Jupiter",
      gear: "j3",
      color: 0xffd166,
      radius: 10,
      distance: 100,
      actualDistance: 200,
    },
    {
      name: "Saturn",
      gear: "sa3",
      color: 0xc4a287,
      radius: 8,
      distance: 130,
      actualDistance: 380,
    },
    {
      name: "Moon",
      gear: "k2",
      color: 0x8c8c8c,
      radius: 3,
      distance: 20,
      actualDistance: 15,  // From Earth
    },
  ];

  const celestialBodies = [];

  planetData.forEach(p => {
    // Mechanism-driven planet (semi-transparent)
    const mechanismRing = new THREE.Mesh(
      new THREE.TorusGeometry(p.distance * scale, 0.3 * scale, 12, 100),
      new THREE.MeshStandardMaterial({
        color: 0x666666,
        transparent: true,
        opacity: 0.3,
      }),
    );
    mechanismRing.rotation.x = Math.PI / 2;
    solarSystemGroup.add(mechanismRing);

    const mechanismPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * scale, 32, 32),
      new THREE.MeshStandardMaterial({
        color: p.color,
        transparent: true,
        opacity: 0.7,
        emissive: p.color,
        emissiveIntensity: 0.3,
      }),
    );
    mechanismPlanet.position.x = p.distance * scale;
    mechanismRing.add(mechanismPlanet);

    // Actual astronomical position (solid)
    const actualPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(p.radius * scale * 1.2, 32, 32),
      new THREE.MeshStandardMaterial({
        color: p.color,
        emissive: p.color,
        emissiveIntensity: 0.5,
      }),
    );
    solarSystemGroup.add(actualPlanet);

    // Connection line between mechanism and actual
    const lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.5,
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    solarSystemGroup.add(line);

    // Label
    const label = createPlanetLabel(p.name, scale);
    actualPlanet.add(label);

    celestialBodies.push({
      name: p.name,
      gearId: p.gear,
      mechanismRing,
      mechanismPlanet,
      actualPlanet,
      connectionLine: line,
      distance: p.actualDistance,
      data: p,
    });
  });

  return { group: solarSystemGroup, bodies: celestialBodies };
}

/**
 * Updates celestial body positions based on current date and gear positions
 */
export function updateCelestialBodies(bodies, date, gearMeshes, scale, showComparison) {
  const actualPositions = calculateAllPlanetsPositions(date);
  const AU_TO_UNITS = 200 * scale;  // Scale factor for visualization

  bodies.forEach(body => {
    // Update mechanism-driven position
    const gearEntry = gearMeshes.get(body.gearId);
    if (gearEntry) {
      body.mechanismRing.rotation.z = gearEntry.mesh.rotation.y;
    }

    // Update actual astronomical position
    const planetName = body.name.toLowerCase();
    if (actualPositions[planetName]) {
      const pos = actualPositions[planetName];

      // Convert to visualization coordinates (project onto XZ plane for simplicity)
      const x = pos.x * AU_TO_UNITS;
      const z = pos.y * AU_TO_UNITS;

      body.actualPlanet.position.set(x, 0, z);
      body.actualPlanet.visible = showComparison;

      // Update connection line
      if (showComparison) {
        const mechanismPos = new THREE.Vector3();
        body.mechanismPlanet.getWorldPosition(mechanismPos);

        const actualPos = body.actualPlanet.position.clone();

        const positions = new Float32Array([
          mechanismPos.x, mechanismPos.y, mechanismPos.z,
          actualPos.x, actualPos.y, actualPos.z,
        ]);

        body.connectionLine.geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );
        body.connectionLine.visible = true;
      } else {
        body.connectionLine.visible = false;
      }
    }
  });
}

/**
 * Creates a zodiac constellation background
 */
export function createZodiacBackground(scale) {
  const zodiacGroup = new THREE.Group();

  const zodiacSigns = [
    { name: "Aries", angle: 0, symbol: "♈" },
    { name: "Taurus", angle: 30, symbol: "♉" },
    { name: "Gemini", angle: 60, symbol: "♊" },
    { name: "Cancer", angle: 90, symbol: "♋" },
    { name: "Leo", angle: 120, symbol: "♌" },
    { name: "Virgo", angle: 150, symbol: "♍" },
    { name: "Libra", angle: 180, symbol: "♎" },
    { name: "Scorpio", angle: 210, symbol: "♏" },
    { name: "Sagittarius", angle: 240, symbol: "♐" },
    { name: "Capricorn", angle: 270, symbol: "♑" },
    { name: "Aquarius", angle: 300, symbol: "♒" },
    { name: "Pisces", angle: 330, symbol: "♓" },
  ];

  const radius = 500 * scale;

  zodiacSigns.forEach(sign => {
    const angleRad = (sign.angle * Math.PI) / 180;
    const x = Math.cos(angleRad) * radius;
    const z = Math.sin(angleRad) * radius;

    const label = createZodiacLabel(sign.name, sign.symbol, scale);
    label.position.set(x, 0, z);
    zodiacGroup.add(label);

    // Draw constellation line
    const geometry = new THREE.BufferGeometry();
    const angle1 = ((sign.angle - 15) * Math.PI) / 180;
    const angle2 = ((sign.angle + 15) * Math.PI) / 180;

    const positions = new Float32Array([
      Math.cos(angle1) * radius, 0, Math.sin(angle1) * radius,
      Math.cos(angle2) * radius, 0, Math.sin(angle2) * radius,
    ]);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: 0x444488,
        transparent: true,
        opacity: 0.3,
      })
    );

    zodiacGroup.add(line);
  });

  return zodiacGroup;
}

/**
 * Creates the ecliptic plane visualization
 */
export function createEclipticPlane(scale) {
  const radius = 400 * scale;
  const geometry = new THREE.RingGeometry(radius * 0.95, radius * 1.05, 64);
  const material = new THREE.MeshBasicMaterial({
    color: 0x888844,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.1,
  });

  const eclipticPlane = new THREE.Mesh(geometry, material);
  eclipticPlane.rotation.x = Math.PI / 2;

  // Add grid lines
  const divisions = 24;
  const gridHelper = new THREE.PolarGridHelper(radius, divisions, divisions * 2, 64, 0x888844, 0x444422);
  gridHelper.rotation.x = Math.PI / 2;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.2;

  const group = new THREE.Group();
  group.add(eclipticPlane);
  group.add(gridHelper);

  return group;
}

/**
 * Creates a label for planets
 */
function createPlanetLabel(text, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  context.fillStyle = "rgba(0, 0, 0, 0.7)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = "bold 32px Arial";
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(30 * scale, 15 * scale, 1);
  sprite.position.y = 15 * scale;

  return sprite;
}

/**
 * Creates zodiac constellation labels
 */
function createZodiacLabel(name, symbol, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  context.font = "bold 64px Arial";
  context.fillStyle = "#666699";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(symbol, canvas.width / 2, canvas.height / 2 - 30);

  context.font = "24px Arial";
  context.fillStyle = "#888899";
  context.fillText(name, canvas.width / 2, canvas.height / 2 + 40);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(40 * scale, 40 * scale, 1);

  return sprite;
}

/**
 * Creates eclipse prediction markers
 */
export function createEclipseMarkers(scale) {
  const group = new THREE.Group();

  // This would be populated based on Saros cycle calculations
  // For now, create a sample marker
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(2 * scale, 16, 16),
    new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1,
    })
  );

  group.add(marker);

  return group;
}
