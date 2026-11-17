import { useMemo, useState } from "react";
import {
  X,
  ArrowUpRight,
  FlaskConical,
  ChevronRight,
  Info,
  MapPin,
  ArrowRight,
  Download,
} from "lucide-react";
import {
  EXPERIMENTS,
  experimentResults,
  finite,
  LOCATIONS,
  solarElevation,
  DEG,
  RADIUS,
  nextLunarEclipse,
  lunarShadow,
  daylightHours,
} from "../lib/science";
import type { ExperimentId, Location } from "../lib/science";
export type LabProps = {
  date: Date;
  tilt: number;
  sunHeight: number;
  g: number;
  location: Location;
  initial: ExperimentId;
  onClose: () => void;
  onTimeChange?: (time: number) => void;
  onExperiment?: (id: ExperimentId) => void;
};
const display = (n: number) => (Number.isNaN(n) ? "—" : finite(n, 2));
export default function Laboratory(props: LabProps) {
  const [id, setId] = useState<ExperimentId>(props.initial);
  const [height, setHeight] = useState(id === "satellite" ? 400000 : 100);
  const [distance, setDistance] = useState(50);
  const [pole, setPole] = useState(2);
  const [location, setLocation] = useState(props.location);
  const [destination, setDestination] = useState(LOCATIONS[2]);
  const p = {
    height,
    distance,
    pole,
    lat: location.lat,
    lon: location.lon,
    date: props.date,
    tilt: props.tilt,
    sunHeight: props.sunHeight,
    g: props.g,
    destination,
  };
  const result = experimentResults(id, p);
  const exp = EXPERIMENTS.find((e) => e[0] === id)!;
  const solar = ["sunset", "shadows", "timezones", "eratosthenes"].includes(id);
  const seasonal = ["seasons", "polar"].includes(id);
  const latitude = ["coriolis", "stars"].includes(id);
  const isDistance = ["ships", "sightline"].includes(id);
  const maxHeight = Math.max(id === "satellite" ? 1000000 : 1000, height * 1.2);
  const eclipse = useMemo(
    () => (id === "eclipse" ? nextLunarEclipse(props.date) : null),
    [id, props.date.toISOString().slice(0, 10)],
  );
  const xLabel = solar
    ? "UTC hour"
    : seasonal
      ? "Day of year"
      : latitude
        ? "Latitude (degrees)"
        : isDistance
          ? "Distance (km)"
          : id === "routes"
            ? "Longitude offset (degrees)"
            : id === "eclipse"
              ? "Hours from current time"
              : "Altitude (m)";
  const chart = useMemo(
    () =>
      Array.from({ length: 73 }, (_, i) => {
        const t = i / 72;
        let parameter = t * maxHeight;
        let next = {
          ...p,
          height: Math.max(0.1, parameter),
          distance: t * 200,
        };
        let r: { round: number; flat: number };
        if (solar) {
          parameter = t * 24;
          const d = new Date(
            new Date(props.date).setUTCHours(0, 0, 0, 0) + t * 86400000,
          );
          r = {
            round: solarElevation(location.lat, location.lon, d, props.tilt),
            flat: solarElevation(
              location.lat,
              location.lon,
              d,
              props.tilt,
              "flat",
              props.sunHeight,
            ),
          };
        } else if (seasonal) {
          parameter = t * 365;
          const d = new Date(
            Date.UTC(props.date.getUTCFullYear(), 0, 1) + parameter * 86400000,
          );
          r = { round: daylightHours(location.lat, d, props.tilt), flat: 24 };
        } else if (id === "eclipse") {
          parameter = (t - 0.5) * 24;
          r = {
            round:
              lunarShadow(new Date(props.date.getTime() + parameter * 3600000))
                .obscuration * 100,
            flat: NaN,
          };
        } else {
          if (latitude) {
            parameter = -89 + t * 178;
            next = { ...next, lat: parameter };
          }
          if (id === "routes") {
            parameter = t * 180;
            next = {
              ...next,
              destination: {
                ...destination,
                lat: location.lat,
                lon: location.lon + parameter,
              },
            };
          }
          if (isDistance) parameter = t * 200;
          r = experimentResults(id, next);
        }
        return { x: 40 + t * 550, round: r.round, flat: r.flat, parameter };
      }),
    [
      id,
      height,
      distance,
      pole,
      location,
      destination,
      props.date,
      props.tilt,
      props.sunHeight,
      props.g,
      solar,
      seasonal,
      latitude,
      isDistance,
      maxHeight,
    ],
  );
  const values = chart
    .flatMap((p) => [p.round, p.flat])
    .filter(Number.isFinite);
  const min = solar ? -90 : Math.min(0, ...values) * 1.1,
    max = solar ? 90 : seasonal ? 25 : Math.max(1, ...values) * 1.12;
  const y = (n: number) => 186 - ((n - min) / (max - min)) * 150;
  const path = (key: "round" | "flat") =>
    chart
      .filter((p) => Number.isFinite(p[key]))
      .map(
        (p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${y(p[key]).toFixed(1)}`,
      )
      .join(" ");
  const chartTitle = solar
    ? "Solar elevation over 24 hours"
    : seasonal
      ? "Daylight through the year"
      : latitude
        ? "Prediction across geographic latitude"
        : id === "routes"
          ? "Routes along observer latitude"
          : isDistance
            ? "Hidden height across 200 km"
            : id === "eclipse"
              ? "Lunar shadow over 24 hours"
              : "Prediction across altitude";
  const xStart = solar
    ? "00:00 UTC"
    : seasonal
      ? "01 JAN"
      : latitude
        ? "89° S"
        : id === "eclipse"
          ? "−12 hours"
          : "0";
  const xEnd = solar
    ? "24:00 UTC"
    : seasonal
      ? "31 DEC"
      : latitude
        ? "89° N"
        : id === "routes"
          ? "180° east"
          : isDistance
            ? "200 km"
            : id === "eclipse"
              ? "+12 hours"
              : `${finite(maxHeight / 1000, 0)} km`;
  function exportData() {
    const rows = [
      `${xLabel},spherical,flat,unit`,
      ...chart.map(
        (v) =>
          `${v.parameter},${Number.isNaN(v.round) ? "" : v.round},${Number.isNaN(v.flat) ? "" : v.flat},${solar ? "degrees" : result.unit}`,
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrasim-${id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <section
        className="lab-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Physics laboratory"
      >
        <header className="modal-header">
          <span className="modal-brand">
            <FlaskConical size={18} /> THE PHYSICS LAB
          </span>
          <button
            className="icon-button"
            onClick={props.onClose}
            aria-label="Close laboratory"
          >
            <X size={19} />
          </button>
        </header>
        <div className="lab-body">
          <aside className="lab-nav">
            <div className="eyebrow">15 WAYS TO ASK WHY</div>
            {EXPERIMENTS.map((e, i) => (
              <button
                key={e[0]}
                className={id === e[0] ? "active" : ""}
                onClick={() => {
                  setId(e[0]);
                  props.onExperiment?.(e[0]);
                  setHeight(e[0] === "satellite" ? 400000 : 100);
                }}
              >
                <span>{String(i + 1).padStart(2, "0")}</span>
                {e[1]}
                <ChevronRight size={13} />
              </button>
            ))}
          </aside>
          <main className="lab-main">
            <div className="eyebrow green">
              EXPERIMENT{" "}
              {String(EXPERIMENTS.findIndex((e) => e[0] === id) + 1).padStart(
                2,
                "0",
              )}
            </div>
            <h1>{exp[1]}</h1>
            <p className="lab-intro">
              Change a variable. Test a prediction. Follow the evidence.
            </p>
            <div className="lab-configuration">
              <label>
                <MapPin size={13} /> Observer
                <select
                  value={location.name}
                  onChange={(e) =>
                    setLocation(
                      LOCATIONS.find((l) => l.name === e.target.value)!,
                    )
                  }
                >
                  {[
                    ...LOCATIONS,
                    ...(!LOCATIONS.some((l) => l.name === location.name)
                      ? [location]
                      : []),
                  ].map((l) => (
                    <option key={l.name}>{l.name}</option>
                  ))}
                </select>
              </label>
              {["routes", "eratosthenes", "timezones"].includes(id) && (
                <label>
                  <ArrowRight size={13} /> Destination
                  <select
                    value={destination.name}
                    onChange={(e) =>
                      setDestination(
                        LOCATIONS.find((l) => l.name === e.target.value)!,
                      )
                    }
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l.name}>{l.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="lab-sliders">
              {[
                "horizon",
                "ships",
                "gravity",
                "satellite",
                "sightline",
              ].includes(id) && (
                <label>
                  <span>
                    {id === "satellite"
                      ? "Orbital altitude"
                      : "Observer / drop altitude"}
                    <b>{finite(height, 0)} m</b>
                  </span>
                  <input
                    aria-label="Observer altitude"
                    type="range"
                    min={id === "satellite" ? 160000 : 1}
                    max={id === "satellite" ? 2000000 : 10000}
                    step={id === "satellite" ? 1000 : 1}
                    value={height}
                    onChange={(e) => setHeight(+e.target.value)}
                  />
                </label>
              )}
              {["ships", "sightline"].includes(id) && (
                <label>
                  <span>
                    Target distance<b>{distance} km</b>
                  </span>
                  <input
                    aria-label="Target distance"
                    type="range"
                    min="1"
                    max="200"
                    value={distance}
                    onChange={(e) => setDistance(+e.target.value)}
                  />
                </label>
              )}
              {id === "shadows" && (
                <label>
                  <span>
                    Pole height<b>{pole.toFixed(1)} m</b>
                  </span>
                  <input
                    aria-label="Pole height"
                    type="range"
                    min=".1"
                    max="10"
                    step=".1"
                    value={pole}
                    onChange={(e) => setPole(+e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="prediction-heading">
              <span>{result.title}</span>
              <small>MODEL PREDICTIONS</small>
            </div>
            <div className="prediction-cards">
              <div>
                <span>
                  <i className="legend-dot green-bg" /> Spherical Earth{" "}
                  <small>ESTABLISHED</small>
                </span>
                <strong>
                  {display(result.round)}
                  <em>{result.unit}</em>
                </strong>
              </div>
              <div>
                <span>
                  <i className="legend-dot amber-bg" /> Flat Earth{" "}
                  <small>HYPOTHETICAL</small>
                </span>
                <strong>
                  {display(result.flat)}
                  <em>{result.unit}</em>
                </strong>
              </div>
            </div>
            <div className="lab-chart">
              <header>
                <span>{chartTitle}</span>
                <button onClick={exportData} title="Export sampled predictions">
                  <Download size={14} /> CSV
                </button>
              </header>
              <svg
                viewBox="0 0 620 220"
                role="img"
                aria-label="Calculated model prediction chart"
              >
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                  <g key={t}>
                    <line
                      x1="40"
                      y1={36 + t * 150}
                      x2="590"
                      y2={36 + t * 150}
                      stroke="#2c3236"
                      strokeDasharray="3 5"
                    />
                    <text x="30" y={40 + t * 150} textAnchor="end">
                      {finite(max - t * (max - min), 0)}
                    </text>
                  </g>
                ))}
                <path
                  d={path("round")}
                  fill="none"
                  stroke="#c2e994"
                  strokeWidth="2.5"
                />
                <path
                  d={path("flat")}
                  fill="none"
                  stroke="#dcb87e"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                />
                <text x="40" y="211">
                  {xStart}
                </text>
                <text x="590" y="211" textAnchor="end">
                  {xEnd}
                </text>
              </svg>
            </div>
            {eclipse && (
              <div className="eclipse-event">
                <span>
                  <b>Next {eclipse.kind} lunar eclipse</b>
                  <small>
                    {eclipse.date.toLocaleString("en-GB", { timeZone: "UTC" })}{" "}
                    UTC · ephemeris prediction
                  </small>
                </span>
                <button
                  onClick={() => props.onTimeChange?.(eclipse.date.getTime())}
                >
                  Go to peak <ArrowUpRight size={14} />
                </button>
              </div>
            )}
            <div className="formula">
              <span>THE MATHEMATICS</span>
              <code>{result.formula}</code>
            </div>
            <p className="science-note">
              <Info size={16} />
              {result.note}
            </p>
            {id === "horizon" && (
              <p className="reference-note">
                Reference calculation: a 2 m observer has a geometric horizon at{" "}
                {finite(Math.sqrt(2 * RADIUS * 0.002), 2)} km. This is a model
                prediction, not an imported measurement.
              </p>
            )}
            <a
              className="source-link"
              href="https://gml.noaa.gov/grad/solcalc/calcdetails.html"
              target="_blank"
              rel="noreferrer"
            >
              Calculation methods & reference information{" "}
              <ArrowUpRight size={14} />
            </a>
          </main>
        </div>
      </section>
    </div>
  );
}
