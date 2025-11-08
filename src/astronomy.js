/**
 * Astronomical Algorithms Module
 * Simplified planetary position calculations based on Keplerian orbital elements
 * Based on Jean Meeus "Astronomical Algorithms" with simplifications
 */

// Orbital elements for planets (epoch J2000.0)
// Format: [a (AU), e, i (deg), L (deg), ϖ (deg), Ω (deg)]
// a: semi-major axis, e: eccentricity, i: inclination
// L: mean longitude, ϖ: longitude of perihelion, Ω: longitude of ascending node

const ORBITAL_ELEMENTS = {
  mercury: {
    a: 0.38709927,     // AU
    e: 0.20563593,
    i: 7.00497902,     // degrees
    L: 252.25032350,   // mean longitude at epoch
    perihelion: 77.45779628,
    node: 48.33076593,
    period: 87.9691,   // days
  },
  venus: {
    a: 0.72333566,
    e: 0.00677672,
    i: 3.39467605,
    L: 181.97909950,
    perihelion: 131.60246718,
    node: 76.67984255,
    period: 224.701,
  },
  earth: {
    a: 1.00000261,
    e: 0.01671123,
    i: -0.00001531,
    L: 100.46457166,
    perihelion: 102.93768193,
    node: 0.0,
    period: 365.256,
  },
  mars: {
    a: 1.52371034,
    e: 0.09339410,
    i: 1.84969142,
    L: -4.55343205,
    perihelion: -23.94362959,
    node: 49.55953891,
    period: 686.980,
  },
  jupiter: {
    a: 5.20288700,
    e: 0.04838624,
    i: 1.30439695,
    L: 34.39644051,
    perihelion: 14.72847983,
    node: 100.47390909,
    period: 4332.589,
  },
  saturn: {
    a: 9.53667594,
    e: 0.05386179,
    i: 2.48599187,
    L: 49.95424423,
    perihelion: 92.59887831,
    node: 113.66242448,
    period: 10759.22,
  },
  moon: {
    a: 0.00257,        // AU (384400 km)
    e: 0.0549,
    i: 5.145,
    L: 218.316,
    perihelion: 83.353,
    node: 125.045,
    period: 27.3217,   // days
  },
};

/**
 * Calculate Julian Day Number from a date
 */
export function dateToJulianDay(date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate() +
    date.getUTCHours() / 24.0 +
    date.getUTCMinutes() / 1440.0 +
    date.getUTCSeconds() / 86400.0;

  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + 12 * a - 3;

  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  return jdn;
}

/**
 * Calculate days since J2000.0 epoch (January 1, 2000, 12:00 TT)
 */
export function daysSinceJ2000(date) {
  const jd = dateToJulianDay(date);
  const J2000 = 2451545.0;
  return jd - J2000;
}

/**
 * Convert degrees to radians
 */
function deg2rad(degrees) {
  return degrees * Math.PI / 180.0;
}

/**
 * Normalize angle to 0-360 degrees
 */
function normalizeAngle(angle) {
  angle = angle % 360;
  if (angle < 0) angle += 360;
  return angle;
}

/**
 * Solve Kepler's equation for eccentric anomaly
 */
function solveKepler(M, e, tolerance = 1e-6) {
  M = deg2rad(M);
  let E = M;  // Initial guess

  for (let i = 0; i < 100; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;

    if (Math.abs(dE) < tolerance) {
      return E;
    }
  }

  return E;
}

/**
 * Calculate heliocentric position of a planet
 * Returns {x, y, z} in AU
 */
export function calculatePlanetPosition(planetName, date) {
  const planet = ORBITAL_ELEMENTS[planetName.toLowerCase()];
  if (!planet) {
    console.error(`Unknown planet: ${planetName}`);
    return { x: 0, y: 0, z: 0 };
  }

  const d = daysSinceJ2000(date);
  const centuries = d / 36525.0;  // Julian centuries

  // Calculate mean anomaly
  const n = 360 / planet.period;  // Mean daily motion (degrees/day)
  const M = normalizeAngle(planet.L + n * d - planet.perihelion);

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKepler(M, planet.e);

  // Calculate true anomaly
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + planet.e) * Math.sin(E / 2),
    Math.sqrt(1 - planet.e) * Math.cos(E / 2)
  );

  // Calculate distance from sun
  const r = planet.a * (1 - planet.e * Math.cos(E));

  // Calculate position in orbital plane
  const cosNu = Math.cos(nu);
  const sinNu = Math.sin(nu);

  // Convert to heliocentric ecliptic coordinates
  const i = deg2rad(planet.i);
  const omega = deg2rad(planet.perihelion - planet.node);
  const Omega = deg2rad(planet.node);

  const x = r * (Math.cos(Omega) * Math.cos(omega + nu) - Math.sin(Omega) * Math.sin(omega + nu) * Math.cos(i));
  const y = r * (Math.sin(Omega) * Math.cos(omega + nu) + Math.cos(Omega) * Math.sin(omega + nu) * Math.cos(i));
  const z = r * (Math.sin(omega + nu) * Math.sin(i));

  return { x, y, z, r, M, E, nu };
}

/**
 * Calculate geocentric position (accounting for Earth's position)
 */
export function calculateGeocentricPosition(planetName, date) {
  const planetPos = calculatePlanetPosition(planetName, date);
  const earthPos = calculatePlanetPosition("earth", date);

  return {
    x: planetPos.x - earthPos.x,
    y: planetPos.y - earthPos.y,
    z: planetPos.z - earthPos.z,
  };
}

/**
 * Calculate all planet positions for a given date
 */
export function calculateAllPlanetsPositions(date) {
  return {
    mercury: calculatePlanetPosition("mercury", date),
    venus: calculatePlanetPosition("venus", date),
    earth: calculatePlanetPosition("earth", date),
    mars: calculatePlanetPosition("mars", date),
    jupiter: calculatePlanetPosition("jupiter", date),
    saturn: calculatePlanetPosition("saturn", date),
    moon: calculateGeocentricPosition("moon", date),
  };
}

/**
 * Convert ecliptic to equatorial coordinates (simplified)
 */
export function eclipticToEquatorial(x, y, z) {
  const epsilon = deg2rad(23.43928);  // Obliquity of ecliptic

  return {
    x: x,
    y: y * Math.cos(epsilon) - z * Math.sin(epsilon),
    z: y * Math.sin(epsilon) + z * Math.cos(epsilon),
  };
}

/**
 * Calculate planetary elongation (angle from Sun as seen from Earth)
 */
export function calculateElongation(planetName, date) {
  const geocentric = calculateGeocentricPosition(planetName, date);
  const elongation = Math.atan2(geocentric.y, geocentric.x) * 180 / Math.PI;
  return normalizeAngle(elongation);
}

/**
 * Get zodiac sign for a given ecliptic longitude
 */
export function getZodiacSign(longitude) {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer",
    "Leo", "Virgo", "Libra", "Scorpio",
    "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];

  const index = Math.floor(longitude / 30);
  return signs[index % 12];
}

/**
 * Calculate Moon phase
 */
export function calculateMoonPhase(date) {
  const sunPos = { x: 0, y: 0, z: 0 };  // Sun at origin
  const moonPos = calculateGeocentricPosition("moon", date);

  const elongation = Math.atan2(moonPos.y, moonPos.x);
  const phase = (elongation * 180 / Math.PI + 180) / 360;

  return {
    illumination: (1 - Math.cos(elongation)) / 2,
    phase: phase,  // 0 = new, 0.5 = full
    name: getMoonPhaseName(phase),
  };
}

function getMoonPhaseName(phase) {
  if (phase < 0.0625 || phase >= 0.9375) return "New Moon";
  if (phase < 0.1875) return "Waxing Crescent";
  if (phase < 0.3125) return "First Quarter";
  if (phase < 0.4375) return "Waxing Gibbous";
  if (phase < 0.5625) return "Full Moon";
  if (phase < 0.6875) return "Waning Gibbous";
  if (phase < 0.8125) return "Last Quarter";
  return "Waning Crescent";
}

/**
 * Calculate synodic period (time between two conjunctions with Sun)
 */
export function calculateSynodicPeriod(planetPeriod) {
  const earthPeriod = 365.256;
  return Math.abs((planetPeriod * earthPeriod) / (planetPeriod - earthPeriod));
}
