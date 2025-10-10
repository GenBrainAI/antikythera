import { gears as gearDefinitions, connections as connectionDefinitions } from "./data/gears.js";

export class GearSystem {
  constructor(gearMeshes) {
    this.gears = gearMeshes; // Map id -> { mesh, data }
    this.adjacency = new Map();
    this.driverId = null;
    this.driverSpeed = 0; // radians per second

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

  /**
   * Sets the rotational speed of the driver gear.
   * @param {number} radiansPerSecond - The speed in radians per second.
   */
  setDriverSpeed(radiansPerSecond) {
    this.driverId = "b1"; // The driver is always b1 now
    this.driverSpeed = radiansPerSecond;
  }

  /**
   * Toggles the paused state of the animation.
   * @param {boolean} paused - Whether the animation should be paused.
   */
  togglePause(paused) {
    this.paused = paused;
  }

  /**
   * Updates the gear system state for the next frame.
   * @param {number} deltaSeconds - The time elapsed since the last frame in seconds.
   */
  update(deltaSeconds) {
    if (this.paused || !this.driverId) {
      return;
    }

    const driver = this.gears.get(this.driverId);
    if (driver) {
      driver.mesh.rotation.y += this.driverSpeed * deltaSeconds;
      this.propagateRotation(this.driverId, driver.mesh.rotation.y);
    }
  }

  /**
   * Sets the absolute rotation of a specific gear and propagates the change through the system.
   * @param {string} gearId - The ID of the gear to set.
   * @param {number} angle - The absolute angle in radians.
   */
  setGearRotation(gearId, angle) {
    const gear = this.gears.get(gearId);
    if (gear) {
      gear.mesh.rotation.y = angle;
      this.propagateRotation(gearId, angle);
    }
  }

  /**
   * Propagates rotation from a starting gear through the entire connected graph.
   * @param {string} startNodeId - The ID of the gear where the rotation originates.
   * @param {number} startAngle - The absolute angle of the starting gear.
   */
  propagateRotation(startNodeId, startAngle) {
    const queue = [{ id: startNodeId, angle: startAngle }];
    const visited = new Set([startNodeId]);

    while (queue.length > 0) {
      const current = queue.shift();
      const currentGear = this.gears.get(current.id);
      if (!currentGear) continue;

      const edges = this.adjacency.get(current.id) ?? [];
      edges.forEach(({ to, ratio, type }) => {
        if (ratio === 0 || visited.has(to)) {
          return;
        }

        const nextGear = this.gears.get(to);
        if (nextGear) {
          const nextAngle = current.angle * ratio;
          nextGear.mesh.rotation.y = nextAngle;
          visited.add(to);
          queue.push({ id: to, angle: nextAngle });
        }
      });
    }
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
