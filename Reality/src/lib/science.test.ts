import { describe, expect, it } from "vitest";
import {
  sphericalDistance,
  flatDistance,
  project,
  geoVector,
  solarState,
  solarElevation,
  daylightHours,
  horizonDistance,
  hiddenHeight,
  gravity,
  shadowLength,
  orbit,
  foucaultPeriod,
  parseCoordinates,
  moonState,
  experimentResults,
  EXPERIMENTS,
  LOCATIONS,
  lunarShadow,
  nextLunarEclipse,
} from "./science";
const june = new Date("2026-06-21T12:00:00Z");
describe("geography and coordinate systems", () => {
  it("calculates quarter and half circumferences, including antipodes", () => {
    expect(
      sphericalDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }),
    ).toBeCloseTo(10007.56, 1);
    expect(
      sphericalDistance({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }),
    ).toBeCloseTo(20015.11, 1);
  });
  it("calculates London to New York within a kilometre of the mean-radius reference", () => {
    expect(sphericalDistance(LOCATIONS[1], LOCATIONS[2])).toBeCloseTo(
      5570.23,
      1,
    );
  });
  it("preserves radial distances from the north pole and exposes southern distortion", () => {
    expect(project(90, 100)).toEqual({ x: 0, y: -0 });
    expect(flatDistance({ lat: 90, lon: 0 }, { lat: 0, lon: 0 })).toBeCloseTo(
      10007.557,
      2,
    );
    const a = { lat: -33, lon: 0 },
      b = { lat: -33, lon: 90 };
    expect(flatDistance(a, b)).toBeGreaterThan(sphericalDistance(a, b) * 1.5);
  });
  it("maps Greenwich, east and poles to rendering coordinates", () => {
    expect(geoVector(0, 0)).toEqual([2, 0, -0]);
    expect(geoVector(0, 90)[2]).toBeCloseTo(-2);
    expect(geoVector(90, 0)[1]).toBeCloseTo(2);
  });
  it("validates coordinate entry and limits", () => {
    expect(parseCoordinates("45.5, -73.6")?.lat).toBe(45.5);
    expect(parseCoordinates("-90 180")?.lon).toBe(180);
    expect(parseCoordinates("91, 0")).toBeNull();
    expect(parseCoordinates("Tokyo")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });
});
describe("ephemerides and daylight", () => {
  it("has June and December solstice declinations near measured obliquity", () => {
    expect(solarState(june).lat).toBeCloseTo(23.44, 1);
    expect(solarState(new Date("2026-12-21T12:00:00Z")).lat).toBeCloseTo(
      -23.44,
      1,
    );
  });
  it("matches the geometric equatorial solar-noon elevation", () => {
    const s = solarState(june);
    expect(solarElevation(0, s.lon, june)).toBeCloseTo(90 - s.lat, 8);
    expect(solarElevation(s.lat, s.lon, june)).toBeCloseTo(90, 5);
  });
  it("has polar day and night, and approximately 12 hours at the equator", () => {
    expect(daylightHours(80, june)).toBe(24);
    expect(daylightHours(-80, june)).toBe(0);
    expect(daylightHours(0, june)).toBeCloseTo(12.12, 1);
  });
  it("makes a zero-tilt experimental Sun lie on the equator", () => {
    expect(solarState(june, 0).lat).toBeCloseTo(0);
  });
  it("does not fabricate sunset for an unobstructed local Sun", () => {
    for (let hour = 0; hour < 24; hour += 3) {
      const d = new Date(june);
      d.setUTCHours(hour);
      expect(solarElevation(45, -73, d, 23.44, "flat", 5000)).toBeGreaterThan(
        0,
      );
    }
    expect(daylightHours(45, june, 23.44, "flat")).toBe(24);
  });
  it("has a physical lunar distance and fractional illumination", () => {
    const m = moonState(june);
    expect(m.distanceKm).toBeGreaterThan(350000);
    expect(m.distanceKm).toBeLessThan(410000);
    expect(m.illumination).toBeGreaterThanOrEqual(0);
    expect(m.illumination).toBeLessThanOrEqual(1);
  });
});
describe("physics", () => {
  it("predicts the 2-metre geometric horizon and hides more ship at greater distances", () => {
    expect(horizonDistance(2)).toBeCloseTo(5.048, 2);
    expect(hiddenHeight(10, 2)).toBeGreaterThan(1);
    expect(hiddenHeight(20, 2)).toBeGreaterThan(hiddenHeight(10, 2));
    expect(hiddenHeight(20, 2, "flat")).toBe(0);
    expect(horizonDistance(2, "flat")).toBe(Infinity);
  });
  it("matches WGS84 equatorial and polar normal gravity", () => {
    expect(gravity(0, 0)).toBeCloseTo(9.7803253, 6);
    expect(gravity(90, 0)).toBeCloseTo(9.8321849, 6);
    expect(gravity(45, 10000)).toBeLessThan(gravity(45, 0));
  });
  it("calculates shadows and excludes direct nighttime shadows", () => {
    expect(shadowLength(2, 45)).toBeCloseTo(2);
    expect(shadowLength(2, -1)).toBe(Infinity);
  });
  it("matches an ISS-like circular orbit", () => {
    const o = orbit(400);
    expect(o.speed).toBeCloseTo(7.67, 2);
    expect(o.period).toBeCloseTo(92.41, 1);
  });
  it("produces sidereal precession at poles and none at the equator", () => {
    expect(foucaultPeriod(90)).toBeCloseTo(23.9345, 3);
    expect(foucaultPeriod(0)).toBe(Infinity);
    expect(foucaultPeriod(30)).toBeCloseTo(47.869, 2);
  });
  it("supplies explicit formula, units and notes for all fifteen experiments", () => {
    for (const e of EXPERIMENTS) {
      const r = experimentResults(e[0], {
        height: 100,
        distance: 50,
        pole: 2,
        lat: 45,
        lon: -73,
        date: june,
        tilt: 23.44,
        sunHeight: 5000,
        g: 9.81,
        destination: LOCATIONS[2],
      });
      expect(r.formula.length).toBeGreaterThan(5);
      expect(r.note.length).toBeGreaterThan(30);
      expect(r.unit).toBeTruthy();
      expect(typeof r.round).toBe("number");
    }
  });
  it("leaves undefined flat orbital mechanisms explicitly unsolved", () => {
    const r = experimentResults("satellite", {
      height: 400000,
      distance: 50,
      pole: 2,
      lat: 45,
      lon: -73,
      date: june,
      tilt: 23.44,
      sunHeight: 5000,
      g: 9.81,
      destination: LOCATIONS[2],
    });
    expect(Number.isNaN(r.flat)).toBe(true);
  });
});

describe("eclipse geometry", () => {
  it("has no lunar umbral overlap when the Moon is on the day side", () => {
    expect(lunarShadow(new Date("2026-06-15T02:00:00Z")).obscuration).toBe(0);
  });
  it("finds the March 2026 total lunar eclipse and recovers full umbral coverage", () => {
    const e = nextLunarEclipse(new Date("2026-01-01T00:00:00Z"));
    expect(e.kind).toBe("total");
    expect(e.date.toISOString().slice(0, 10)).toBe("2026-03-03");
    expect(lunarShadow(e.date).obscuration).toBeCloseTo(1, 4);
  });
});
