import { gears as gearDefinitions, connections as connectionDefinitions } from "./data/gears.js";

export class GearSystem {
  constructor(gearMeshes) {
    this.gears = gearMeshes; // Map id -> { mesh, data }
    this.adjacency = new Map();
    this.angularVelocities = new Map();
    this.driverId = null;
    this.driverSpeed = 0; // radians per second
    this.timeScale = 1;

    this.#buildGraph(connectionDefinitions);
  }

  #buildGraph(connections) {
    connections.forEach((conn) => {
      const ratioForward = this.#resolveRatio(conn.from, conn.to, conn);
      const ratioBackward = this.#resolveRatio(conn.to, conn.from, conn, true);
      this.#addEdge(conn.from, conn.to, ratioForward, conn.type);
      this.#addEdge(conn.to, conn.from, ratioBackward, conn.type);
    });
  }

  #addEdge(from, to, ratio, type) {
    if (!this.adjacency.has(from)) {
      this.adjacency.set(from, []);
    }
    this.adjacency.get(from).push({ to, ratio, type });
  }

  #resolveRatio(fromId, toId, conn, reverse = false) {
    const fromGear = gearDefinitions.find((g) => g.id === fromId);
    const toGear = gearDefinitions.find((g) => g.id === toId);

    if (!fromGear || !toGear) {
      return 0;
    }

    if (conn.type === "coaxial") {
      return 1;
    }

    if (conn.type === "mesh") {
      if (conn.ratio !== undefined) {
        return reverse ? 1 / conn.ratio : conn.ratio;
      }
      const baseRatio = -(fromGear.toothCount / toGear.toothCount);
      return reverse ? 1 / baseRatio : baseRatio;
    }

    return 0;
  }

  setDriver(gearId, revolutionsPerMinute) {
    this.driverId = gearId;
    this.driverSpeed = (revolutionsPerMinute / 60) * Math.PI * 2;
    this.#recalculateVelocities();
  }

  setTimeScale(daysPerSecond) {
    this.timeScale = daysPerSecond;
  }

  togglePause(paused) {
    this.paused = paused;
  }

  #recalculateVelocities() {
    this.angularVelocities.clear();
    if (!this.driverId) {
      return;
    }

    const queue = [this.driverId];
    this.angularVelocities.set(this.driverId, this.driverSpeed);

    const visited = new Set([this.driverId]);

    while (queue.length > 0) {
      const current = queue.shift();
      const edges = this.adjacency.get(current) ?? [];
      edges.forEach(({ to, ratio }) => {
        if (ratio === 0) {
          return;
        }
        const nextSpeed = (this.angularVelocities.get(current) ?? 0) * ratio;
        if (!this.angularVelocities.has(to) || !visited.has(to)) {
          this.angularVelocities.set(to, nextSpeed);
        }
        if (!visited.has(to)) {
          visited.add(to);
          queue.push(to);
        }
      });
    }
  }

  update(deltaSeconds) {
    if (this.paused) {
      return;
    }

    const dt = deltaSeconds * this.timeScale;
    this.gears.forEach((entry) => {
      const angularVelocity = this.angularVelocities.get(entry.data.id) ?? 0;
      entry.mesh.rotation.y += angularVelocity * dt;
      entry.mesh.userData.angularVelocity = angularVelocity;
    });
  }

  getGear(id) {
    return this.gears.get(id);
  }

  getGears() {
    return Array.from(this.gears.values()).map((entry) => entry.data);
  }

  getConnections() {
    return connectionDefinitions.slice();
  }

  highlightTrain(train) {
    const ids = new Set(train ? train.gearIds : []);
    this.gears.forEach((entry) => {
      const { mesh, data } = entry;
      const visible = train ? ids.has(data.id) : true;
      mesh.visible = visible;
    });
  }
}
