import {
  Body,
  Equator,
  Observer,
  SiderealTime,
  MoonPhase,
  GeoVector,
  Ecliptic,
  HelioVector,
  SearchLunarEclipse,
} from "astronomy-engine";
export const DEG = Math.PI / 180;
export const RADIUS = 6371.0088; // IUGG mean radius, km
export const MU = 398600.4418; // Earth's GM, km³/s²
export const WGS84 = { a: 6378.137, b: 6356.752314245, f: 1 / 298.257223563 };
export type EarthModel = "round" | "flat";
export type Location = {
  name: string;
  lat: number;
  lon: number;
  country: string;
};
export const LOCATIONS: Location[] = [
  { name: "Montréal", lat: 45.5019, lon: -73.5674, country: "Canada" },
  { name: "New York", lat: 40.7128, lon: -74.006, country: "United States" },
  { name: "London", lat: 51.5074, lon: -0.1278, country: "United Kingdom" },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503, country: "Japan" },
  { name: "Sydney", lat: -33.8688, lon: 151.2093, country: "Australia" },
  { name: "North Pole", lat: 90, lon: 0, country: "Arctic Ocean" },
  { name: "South Pole", lat: -90, lon: 0, country: "Antarctica" },
  { name: "Equator", lat: 0, lon: 0, country: "Gulf of Guinea" },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241, country: "South Africa" },
  { name: "Singapore", lat: 1.3521, lon: 103.8198, country: "Singapore" },
  { name: "Reykjavík", lat: 64.1466, lon: -21.9426, country: "Iceland" },
  { name: "Ushuaia", lat: -54.8019, lon: -68.303, country: "Argentina" },
];
export const wrap = (n: number) => ((((n + 180) % 360) + 360) % 360) - 180;
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export function sphericalDistance(
  a: Pick<Location, "lat" | "lon">,
  b: Pick<Location, "lat" | "lon">,
) {
  const dl = (b.lat - a.lat) * DEG,
    do_ = (b.lon - a.lon) * DEG;
  const h =
    Math.sin(dl / 2) ** 2 +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(do_ / 2) ** 2;
  return RADIUS * 2 * Math.asin(Math.sqrt(clamp(h, 0, 1)));
}
export function project(lat: number, lon: number) {
  const r = RADIUS * (90 - lat) * DEG;
  return { x: r * Math.sin(lon * DEG), y: r * Math.cos(lon * DEG) };
}
export function flatDistance(
  a: Pick<Location, "lat" | "lon">,
  b: Pick<Location, "lat" | "lon">,
) {
  const p = project(a.lat, a.lon),
    q = project(b.lat, b.lon);
  return Math.hypot(p.x - q.x, p.y - q.y);
}
export function geoVector(
  lat: number,
  lon: number,
  r = 2,
): [number, number, number] {
  return [
    r * Math.cos(lat * DEG) * Math.cos(lon * DEG),
    r * Math.sin(lat * DEG),
    -r * Math.cos(lat * DEG) * Math.sin(lon * DEG),
  ];
}
export function solarState(date: Date, tilt = 23.44) {
  const eq = Equator(Body.Sun, date, new Observer(0, 0, 0), true, true);
  const ec = Ecliptic(GeoVector(Body.Sun, date, true));
  // Actual ephemeris at default tilt. A changed tilt is an explicit obliquity experiment.
  const dec =
    Math.abs(tilt - 23.44) < 0.001
      ? eq.dec
      : Math.asin(Math.sin(tilt * DEG) * Math.sin(ec.elon * DEG)) / DEG;
  const ra =
    Math.abs(tilt - 23.44) < 0.001
      ? eq.ra * 15
      : Math.atan2(
          Math.cos(tilt * DEG) * Math.sin(ec.elon * DEG),
          Math.cos(ec.elon * DEG),
        ) / DEG;
  const lon = wrap(ra - SiderealTime(date) * 15);
  return { lat: dec, lon, distanceAU: eq.dist };
}
export function solarElevation(
  lat: number,
  lon: number,
  date: Date,
  tilt = 23.44,
  model: EarthModel = "round",
  sunHeight = 5000,
) {
  const s = solarState(date, tilt);
  if (model === "flat")
    return Math.atan2(sunHeight, flatDistance({ lat, lon }, s)) / DEG;
  return (
    Math.asin(
      clamp(
        Math.sin(lat * DEG) * Math.sin(s.lat * DEG) +
          Math.cos(lat * DEG) *
            Math.cos(s.lat * DEG) *
            Math.cos((lon - s.lon) * DEG),
        -1,
        1,
      ),
    ) / DEG
  );
}
export function daylightHours(
  lat: number,
  date: Date,
  tilt = 23.44,
  model: EarthModel = "round",
) {
  if (model === "flat") return 24; // Unobstructed local Sun always above an infinite planar horizon.
  const d = solarState(date, tilt).lat * DEG,
    phi = lat * DEG;
  const cosH =
    (Math.sin(-0.833 * DEG) - Math.sin(phi) * Math.sin(d)) /
    (Math.cos(phi) * Math.cos(d));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return (2 * Math.acos(cosH)) / DEG / 15;
}
export function horizonDistance(heightM: number, model: EarthModel = "round") {
  return model === "round"
    ? Math.sqrt((2 * RADIUS * heightM) / 1000 + (heightM / 1000) ** 2)
    : Infinity;
}
export function horizonDip(heightM: number) {
  return Math.acos(RADIUS / (RADIUS + heightM / 1000)) / DEG;
}
export function hiddenHeight(
  distanceKm: number,
  heightM: number,
  model: EarthModel = "round",
) {
  if (model === "flat") return 0;
  const angle = Math.max(
    0,
    distanceKm / RADIUS - Math.acos(RADIUS / (RADIUS + heightM / 1000)),
  );
  return RADIUS * (1 / Math.cos(angle) - 1) * 1000;
}
export function gravity(lat: number, heightM: number) {
  const s = Math.sin(lat * DEG);
  return (
    ((9.7803253359 * (1 + 0.00193185265241 * s * s)) /
      Math.sqrt(1 - 0.00669437999013 * s * s)) *
    (RADIUS / (RADIUS + heightM / 1000)) ** 2
  );
}
export function shadowLength(height: number, elevation: number) {
  return elevation <= 0 ? Infinity : height / Math.tan(elevation * DEG);
}
export function orbit(altitudeKm: number) {
  const r = RADIUS + altitudeKm;
  return {
    speed: Math.sqrt(MU / r),
    period: (2 * Math.PI * Math.sqrt(r ** 3 / MU)) / 60,
  };
}
export function foucaultPeriod(lat: number) {
  return Math.abs(lat) < 1e-8
    ? Infinity
    : 23.9344696 / Math.abs(Math.sin(lat * DEG));
}
export function moonState(date: Date) {
  const v = GeoVector(Body.Moon, date, true);
  const eq = Equator(Body.Moon, date, new Observer(0, 0, 0), true, true);
  const phase = MoonPhase(date);
  return {
    lat: eq.dec,
    lon: wrap(eq.ra * 15 - SiderealTime(date) * 15),
    distanceKm: Math.hypot(v.x, v.y, v.z) * 149597870.7,
    phase,
    illumination: (1 - Math.cos(phase * DEG)) / 2,
  };
}
export function planetPositions(date: Date) {
  return [
    Body.Mercury,
    Body.Venus,
    Body.Earth,
    Body.Mars,
    Body.Jupiter,
    Body.Saturn,
  ].map((body) => {
    const v = HelioVector(body, date);
    return { name: body, x: v.x, y: v.y, z: v.z };
  });
}
export function parseCoordinates(query: string): Location | null {
  const parts = query
    .trim()
    .split(/[,\s]+/)
    .map(Number);
  if (
    parts.length === 2 &&
    parts.every(Number.isFinite) &&
    Math.abs(parts[0]) <= 90 &&
    Math.abs(parts[1]) <= 180
  )
    return {
      name: "Custom location",
      lat: parts[0],
      lon: parts[1],
      country: "Coordinates",
    };
  return null;
}
export function formatCoord(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? "E" : "W"}`;
}
export function finite(n: number, decimals = 2) {
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })
    : "∞";
}
export const EXPERIMENTS = [
  ["horizon", "Horizon & curvature", "How far can you see?", "Ruler"],
  ["ships", "Beyond the horizon", "Watch a vessel disappear", "Ship"],
  ["sunset", "Sunrise & sunset", "Follow the day–night boundary", "Sunset"],
  ["shadows", "Sun angles & shadows", "Measure your local sunlight", "Sun"],
  ["eratosthenes", "Measure the Earth", "Two cities. One shadow.", "Triangle"],
  [
    "seasons",
    "Seasons & solstices",
    "Explore axial tilt and daylight",
    "Orbit",
  ],
  ["polar", "Midnight Sun", "Visit the polar extremes", "Snowflake"],
  [
    "gravity",
    "Gravity & free fall",
    "Drop an object in both models",
    "ArrowDown",
  ],
  ["coriolis", "Foucault pendulum", "A world in rotation", "Waves"],
  ["routes", "Flight paths", "Compare geodesics and distances", "Route"],
  [
    "satellite",
    "Satellite orbits",
    "Find a stable circular orbit",
    "Satellite",
  ],
  ["eclipse", "Lunar shadow", "Explore eclipse alignment", "Moon"],
  ["stars", "Celestial rotation", "Latitude and the celestial poles", "Stars"],
  ["sightline", "Over the water", "Test a line of sight", "Eye"],
  ["timezones", "Solar time", "One moment, different skies", "Clock"],
] as const;
export type ExperimentId = (typeof EXPERIMENTS)[number][0];
export function experimentResults(
  id: ExperimentId,
  p: {
    height: number;
    distance: number;
    pole: number;
    lat: number;
    lon: number;
    date: Date;
    tilt: number;
    sunHeight: number;
    g: number;
    destination: Location;
  },
) {
  const {
    height: h,
    distance: d,
    lat,
    lon,
    date,
    tilt,
    sunHeight,
    g,
    destination: dest,
  } = p;
  const roundSun = solarElevation(lat, lon, date, tilt),
    flatSun = solarElevation(lat, lon, date, tilt, "flat", sunHeight);
  const result = (
    title: string,
    unit: string,
    round: number,
    flat: number,
    formula: string,
    note: string,
  ) => ({ title, unit, round, flat, formula, note });
  switch (id) {
    case "horizon":
      return result(
        "Distance to horizon",
        "km",
        horizonDistance(h),
        Infinity,
        "d = √(2Rh + h²)",
        "Geometric horizon; excludes terrain and atmospheric refraction. The unobstructed planar surface has no curvature horizon.",
      );
    case "ships":
    case "sightline":
      return result(
        "Height hidden by curvature",
        "m",
        hiddenHeight(d, h),
        0,
        "h = R[sec(max(0, d/R − acos(R/(R+hₒ)))) − 1]",
        "Spherical geometry with a mean Earth radius. Observer height and distance change the hidden height; refraction is excluded.",
      );
    case "sunset":
      return result(
        "Solar elevation",
        "°",
        roundSun,
        flatSun,
        "sin α = sin φ sin δ + cos φ cos δ cos H",
        "The local Sun remains above an unobstructed flat plane. No additional light cutoff or refraction has been invented to create sunset.",
      );
    case "shadows":
      return result(
        "Shadow of a vertical pole",
        "m",
        shadowLength(p.pole, roundSun),
        shadowLength(p.pole, flatSun),
        "L = pole height / tan(α)",
        "No direct solar shadow is reported while the Sun is below the horizon (∞). Pole height is adjustable.",
      );
    case "eratosthenes": {
      const sd = sphericalDistance({ lat, lon }, dest);
      const de = Math.abs(
        roundSun - solarElevation(dest.lat, dest.lon, date, tilt),
      );
      const df = Math.abs(
        flatSun -
          solarElevation(dest.lat, dest.lon, date, tilt, "flat", sunHeight),
      );
      return result(
        "Solar elevation difference",
        "°",
        de,
        df,
        "Δα = |α₁ − α₂|",
        `Baseline: ${finite(sd, 0)} km. The classical circumference inference requires simultaneous measurements near a shared meridian at solar noon.`,
      );
    }
    case "seasons":
    case "polar":
      return result(
        "Daylight duration",
        "h",
        daylightHours(lat, date, tilt),
        24,
        "cos H₀ = [sin(−0.833°) − sin φ sin δ] / (cos φ cos δ)",
        "Round model uses a conventional −0.833° sunrise threshold. The flat model uses straight rays from a local Sun over an unobstructed plane.",
      );
    case "gravity":
      return result(
        "Free-fall time from altitude",
        "s",
        Math.sqrt((2 * h) / gravity(lat, h)),
        Math.sqrt((2 * h) / g),
        "t = √(2h / g)",
        "Vacuum fall with constant local acceleration over the fall. Round model uses WGS84 normal gravity with an inverse-square height correction. Flat acceleration is an editable assumption.",
      );
    case "coriolis":
      return result(
        "Foucault precession period",
        "h",
        foucaultPeriod(lat),
        Infinity,
        "T = sidereal day / |sin φ|",
        "The baseline flat disc is stationary. A rotating disc requires a specified rotation law and different inertial forces; no equivalence is assumed.",
      );
    case "routes":
      return result(
        "Surface travel distance",
        "km",
        sphericalDistance({ lat, lon }, dest),
        flatDistance({ lat, lon }, dest),
        "dₛ = 2R asin(√a); d𝒇 = |P₁ − P₂|",
        "Round result is a mean-radius great circle. Flat result is a straight line on the north-polar azimuthal equidistant map, whose distances and areas are distorted.",
      );
    case "satellite":
      return result(
        "Circular orbital speed",
        "km/s",
        orbit(h / 1000).speed,
        NaN,
        "v = √(GM / r); T = 2π√(r³ / GM)",
        `Spherical two-body period: ${finite(orbit(h / 1000).period, 1)} min. Uniform downward flat gravity has no closed circular satellite solution; — denotes no solution.`,
      );
    case "eclipse":
      return result(
        "Lunar umbral obscuration",
        "%",
        lunarShadow(date).obscuration * 100,
        NaN,
        "Obscuration = circle overlap / lunar disc area",
        "Geometric overlap of the Moon with Earth’s conical umbra using ephemeris vectors and solar/lunar radii. Excludes atmospheric shadow enlargement. Flat model specifies no occulting body.",
      );
    case "stars":
      return result(
        "Northern celestial pole elevation",
        "°",
        lat,
        NaN,
        "altitude of NCP = geographic latitude",
        "Geometric celestial-pole altitude, negative south of the equator. This flat configuration has no stellar-dome model. No stellar catalog or empirical residual is claimed.",
      );
    case "timezones":
      return result(
        "Solar time difference",
        "h",
        wrap(dest.lon - lon) / 15,
        wrap(dest.lon - lon) / 15,
        "Δt = Δlongitude / 15° per hour",
        "Mean solar-time offset, not civil time zones. A 24-hour local-Sun circuit is an explicit flat assumption; matching this angular offset does not imply matching solar elevations.",
      );
  }
}

export function lunarShadow(date: Date) {
  const m = GeoVector(Body.Moon, date, true),
    s = GeoVector(Body.Sun, date, true);
  const AU = 149597870.7;
  const sd = Math.hypot(s.x, s.y, s.z) * AU;
  const along = (-(m.x * s.x + m.y * s.y + m.z * s.z) * AU * AU) / sd;
  const md = Math.hypot(m.x, m.y, m.z) * AU;
  const separation = Math.sqrt(Math.max(0, md * md - along * along));
  const umbra = WGS84.a - ((696340 - WGS84.a) * along) / sd;
  const mr = 1737.4;
  let area = 0;
  if (along > 0 && umbra > 0 && separation < umbra + mr) {
    if (separation <= Math.abs(umbra - mr))
      area = Math.PI * Math.min(umbra, mr) ** 2;
    else {
      const d = separation;
      const a = Math.acos(
        clamp((d * d + mr * mr - umbra * umbra) / (2 * d * mr), -1, 1),
      );
      const b = Math.acos(
        clamp((d * d + umbra * umbra - mr * mr) / (2 * d * umbra), -1, 1),
      );
      area =
        mr * mr * a +
        umbra * umbra * b -
        0.5 *
          Math.sqrt(
            Math.max(
              0,
              (-d + mr + umbra) *
                (d + mr - umbra) *
                (d - mr + umbra) *
                (d + mr + umbra),
            ),
          );
    }
  }
  return {
    obscuration: clamp(area / (Math.PI * mr * mr), 0, 1),
    separation,
    umbraRadius: umbra,
    moonRadius: mr,
    behindEarth: along > 0,
  };
}
export function nextLunarEclipse(date: Date) {
  const e = SearchLunarEclipse(date);
  return { date: e.peak.date, kind: e.kind, obscuration: e.obscuration };
}
