/**
 * Validation Dashboard Module
 * Real-time monitoring of gear system performance
 */

export function createValidationDashboard() {
  const dashboard = document.createElement("div");
  dashboard.id = "validation-dashboard";
  dashboard.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: #00ff88;
    padding: 15px;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    max-width: 400px;
    max-height: 500px;
    overflow-y: auto;
    border: 2px solid #00ff88;
    z-index: 1000;
    display: none;
  `;

  dashboard.innerHTML = `
    <div style="margin-bottom: 10px; border-bottom: 1px solid #00ff88; padding-bottom: 5px;">
      <strong style="font-size: 13px;">⚙️ SYSTEM VALIDATION DASHBOARD</strong>
    </div>
    <div id="dashboard-stats"></div>
  `;

  return dashboard;
}

export function updateValidationDashboard(gearMeshes, gearSystem, deltaTime) {
  const statsDiv = document.getElementById("dashboard-stats");
  if (!statsDiv) return;

  // Collect statistics
  const stats = {
    totalGears: gearMeshes.size,
    activeGears: 0,
    avgAngularVelocity: 0,
    maxAngularVelocity: 0,
    totalKineticEnergy: 0,
    gearStats: [],
  };

  let totalAngularVelocity = 0;

  gearMeshes.forEach((gearEntry, id) => {
    const { mesh, data, lastRotation = 0 } = gearEntry;
    const currentRotation = mesh.rotation.y;
    const angularVelocity = deltaTime > 0 ? (currentRotation - lastRotation) / deltaTime : 0;

    gearEntry.lastRotation = currentRotation;

    if (Math.abs(angularVelocity) > 0.001) {
      stats.activeGears++;
      totalAngularVelocity += Math.abs(angularVelocity);
      stats.maxAngularVelocity = Math.max(stats.maxAngularVelocity, Math.abs(angularVelocity));

      // Simplified kinetic energy calculation (assuming unit mass)
      const kineticEnergy = 0.5 * Math.pow(angularVelocity, 2);
      stats.totalKineticEnergy += kineticEnergy;

      stats.gearStats.push({
        id,
        label: data.label,
        teeth: data.toothCount,
        angularVelocity,
        rotation: currentRotation,
        rpm: (angularVelocity * 60) / (2 * Math.PI),
      });
    }
  });

  stats.avgAngularVelocity = stats.activeGears > 0
    ? totalAngularVelocity / stats.activeGears
    : 0;

  // Sort by angular velocity
  stats.gearStats.sort((a, b) => Math.abs(b.angularVelocity) - Math.abs(a.angularVelocity));

  // Generate HTML
  let html = `
    <div style="margin-bottom: 10px;">
      <div><span style="color: #88ccff;">Total Gears:</span> ${stats.totalGears}</div>
      <div><span style="color: #88ccff;">Active Gears:</span> ${stats.activeGears}</div>
      <div><span style="color: #88ccff;">Avg ω:</span> ${stats.avgAngularVelocity.toFixed(4)} rad/s</div>
      <div><span style="color: #88ccff;">Max ω:</span> ${stats.maxAngularVelocity.toFixed(4)} rad/s</div>
      <div><span style="color: #88ccff;">Total KE:</span> ${stats.totalKineticEnergy.toFixed(6)} J</div>
    </div>
  `;

  if (stats.gearStats.length > 0) {
    html += `
      <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
        <strong>TOP 10 ACTIVE GEARS (by |ω|)</strong>
      </div>
      <div style="margin-top: 5px; font-size: 10px;">
    `;

    stats.gearStats.slice(0, 10).forEach((gear, idx) => {
      const direction = gear.angularVelocity > 0 ? "↻" : "↺";
      const color = gear.angularVelocity > 0 ? "#4488ff" : "#ff4488";

      html += `
        <div style="margin-bottom: 5px; padding: 3px; background: rgba(255,255,255,0.05); border-left: 3px solid ${color};">
          <div><strong>${idx + 1}. ${gear.id.toUpperCase()}</strong> (${gear.teeth}T) ${direction}</div>
          <div style="padding-left: 10px;">
            ω: ${gear.angularVelocity.toFixed(6)} rad/s<br>
            RPM: ${gear.rpm.toFixed(3)}<br>
            θ: ${(gear.rotation % (2 * Math.PI)).toFixed(4)} rad
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // Add energy conservation check
  const driverGear = gearMeshes.get("b1");
  if (driverGear && driverGear.lastRotation !== undefined) {
    const driverVelocity = driverGear.mesh.rotation.y - driverGear.lastRotation;
    const energyBalance = stats.totalKineticEnergy > 0
      ? ((Math.pow(driverVelocity, 2) * 0.5) / stats.totalKineticEnergy) * 100
      : 0;

    html += `
      <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
        <strong>ENERGY CONSERVATION</strong><br>
        <div style="margin-top: 5px;">
          Driver Energy: ${(Math.pow(driverVelocity, 2) * 0.5).toFixed(6)} J<br>
          System Energy: ${stats.totalKineticEnergy.toFixed(6)} J<br>
          <span style="color: ${energyBalance > 50 ? '#44ff88' : '#ffaa44'};">
            Balance: ${energyBalance.toFixed(2)}%
          </span>
        </div>
      </div>
    `;
  }

  statsDiv.innerHTML = html;
}

export function toggleValidationDashboard(visible) {
  const dashboard = document.getElementById("validation-dashboard");
  if (dashboard) {
    dashboard.style.display = visible ? "block" : "none";
  }
}
