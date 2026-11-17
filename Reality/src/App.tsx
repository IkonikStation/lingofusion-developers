import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Globe2,
  Orbit,
  Search,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelRightClose,
  MapPin,
  Layers,
  Plus,
  Minus,
  RotateCcw,
  Maximize,
  Minimize,
  Compass,
  Ruler,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FastForward,
  Sun,
  Moon,
  Clock3,
  SlidersHorizontal,
  FlaskConical,
  ArrowUpRight,
  Check,
  X,
  Bookmark,
  Crosshair,
  Eye,
  Grid2X2,
  Mountain,
  Satellite,
  MoveUpRight,
  Info,
  Settings2,
  Keyboard,
  LocateFixed,
  LoaderCircle,
  ArrowLeftRight,
  Download,
} from "lucide-react";
import World from "./components/World";
import type {
  CameraCommand,
  Layers as LayerSettings,
  ViewMode,
} from "./components/World";
import Laboratory from "./components/Laboratory";
import OverviewMap from "./components/OverviewMap";
import {
  LOCATIONS,
  EXPERIMENTS,
  formatCoord,
  parseCoordinates,
  solarState,
  solarElevation,
  daylightHours,
  moonState,
  finite,
  sphericalDistance,
  flatDistance,
  orbit,
} from "./lib/science";
import type { EarthModel, Location, ExperimentId } from "./lib/science";
const INITIAL = new Date("2026-06-21T12:00:00Z").getTime();
const initialCamera: CameraCommand = {
  id: 0,
  lat: 18,
  lon: -25,
  distance: 7.25,
};
const defaultLayers: LayerSettings = {
  clouds: true,
  atmosphere: true,
  grid: false,
  night: true,
  orbits: false,
  labels: true,
  axis: false,
  rays: false,
};
type SavedView = {
  name: string;
  camera: CameraCommand;
  date: number;
  model: EarthModel;
  location: Location | null;
};
function readViews(): SavedView[] {
  try {
    return JSON.parse(localStorage.getItem("terrasim-views") || "[]");
  } catch {
    return [];
  }
}
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      aria-label={label}
      className={`toggle ${value ? "on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        {label}
        <b>
          {value.toFixed(step < 1 ? 2 : 0)}
          <small>{unit}</small>
        </b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as React.CSSProperties
        }
      />
    </label>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="webgl-error">
        The 3D renderer could not start. Please enable WebGL and reload. All
        numerical experiments remain available.
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const [followBody, setFollowBody] = useState<string | null>(null);
  const [overview, setOverview] = useState(false);
  const [model, setModel] = useState<EarthModel>("round");
  const [time, setTime] = useState(INITIAL);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(60);
  const [tilt, setTilt] = useState(23.44);
  const [sunHeight, setSunHeight] = useState(5000);
  const [sunRadius, setSunRadius] = useState(50);
  const [g, setG] = useState(9.81);
  const [intensity, setIntensity] = useState(1.2);
  const [layers, setLayers] = useState(defaultLayers);
  const [quality, setQuality] = useState("high");
  const [fov, setFov] = useState(40);
  const [mode, setMode] = useState<ViewMode>("orbit");
  const [camera, setCamera] = useState(initialCamera);
  const [location, setLocation] = useState<Location | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [immersive, setImmersive] = useState(false);
  const [compare, setCompare] = useState(false);
  const [activeNav, setActiveNav] = useState("Explore");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState("");
  const [lab, setLab] = useState<ExperimentId | null>(null);
  const [help, setHelp] = useState(false);
  const [views, setViews] = useState<SavedView[]>(readViews);
  const [toast, setToast] = useState("");
  const [altitude, setAltitude] = useState((7.25 / 2 - 1) * 6371);
  const [measure, setMeasure] = useState(false);
  const [points, setPoints] = useState<Location[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const lastFrame = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const date = useMemo(() => new Date(time), [time]);
  const solar = useMemo(() => solarState(date, tilt), [date, tilt]);
  const moon = useMemo(() => moonState(date), [date]);
  const observer = location || LOCATIONS[0];
  const elevation = solarElevation(
    observer.lat,
    observer.lon,
    date,
    tilt,
    model,
    sunHeight,
  );
  const daylight = daylightHours(observer.lat, date, tilt, model);
  const filtered = useMemo(() => {
    const coordinate = parseCoordinates(query);
    if (coordinate) return [coordinate];
    if (!query) return LOCATIONS.slice(0, 4);
    return [
      ...LOCATIONS.filter((l) =>
        `${l.name} ${l.country}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(
            query
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ),
      ),
      ...searchResults,
    ];
  }, [query, searchResults]);
  useEffect(() => {
    let id: number;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = now - last;
      last = now;
      if (playing && now - lastFrame.current > 120) {
        setTime((t) =>
          Math.max(
            new Date("1900-01-01").getTime(),
            Math.min(
              new Date("2100-12-31").getTime(),
              t + (now - lastFrame.current) * speed,
            ),
          ),
        );
        lastFrame.current = now;
      } else if (!playing) lastFrame.current = now;
      id = requestAnimationFrame(frame);
      void dt;
    };
    lastFrame.current = last;
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, speed]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setLeftOpen(true);
        setMobilePanel("left");
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }
      if (e.key === "?") setHelp((v) => !v);
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((v) => !v);
      }
      if (e.key.toLowerCase() === "i") setImmersive((v) => !v);
      if (e.key === "Escape") {
        setImmersive(false);
        setLab(null);
        setHelp(false);
        setMeasure(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function setLayer(key: keyof LayerSettings) {
    setLayers((l) => ({ ...l, [key]: !l[key] }));
  }
  function visit(l: Location) {
    if (mode === "space") {
      setMode("orbit");
      setFollowBody(null);
    }
    setLocation(l);
    setCamera({
      id: Date.now(),
      lat: l.lat,
      lon: l.lon,
      distance: mode === "surface" ? camera.distance : 5.3,
    });
    setQuery("");
    setSearchResults([]);
    setSearchNote("");
  }
  async function worldwide() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setSearchNote("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=4&q=${encodeURIComponent(query)}`,
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      setSearchResults(
        data.map((l: any) => ({
          name: l.name || l.display_name.split(",")[0],
          lat: +l.lat,
          lon: +l.lon,
          country: l.display_name.split(",").slice(-1)[0].trim(),
        })),
      );
      if (!data.length)
        setSearchNote("No places found. Try latitude, longitude.");
    } catch {
      setSearchNote("Online search unavailable. Enter latitude, longitude.");
    } finally {
      setSearching(false);
    }
  }
  function saveView() {
    const name = location?.name || `Earth view ${views.length + 1}`;
    const next = [
      ...views,
      { name, camera, date: time, model, location },
    ].slice(-12);
    setViews(next);
    try {
      localStorage.setItem("terrasim-views", JSON.stringify(next));
      setToast("View saved to your bookmarks");
    } catch {
      setToast("Browser storage unavailable; saved for this session");
    }
  }
  function resetView() {
    setFov(40);
    setMode("orbit");
    setCamera({ ...initialCamera, id: Date.now() });
    setLocation(null);
  }
  function nav(name: string) {
    setActiveNav(name);
    if (name === "Compare") {
      setCompare((v) => !v);
      setLeftOpen(compare);
      setRightOpen(compare);
      setMode("orbit");
    } else if (name === "Experiments") setLab("horizon");
    else if (name === "Settings" || name === "Simulate") {
      setRightOpen(true);
      setMobilePanel("right");
    } else setCompare(false);
  }
  function pick(lat: number, lon: number) {
    const p = {
      name: `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`,
      lat,
      lon,
      country: "Picked on Earth",
    };
    if (measure) setPoints((prev) => (prev.length === 2 ? [p] : [...prev, p]));
    else setLocation(p);
  }
  function selectScenario(month: number, day: number, label: string) {
    const d = new Date(date);
    d.setUTCMonth(month, day);
    d.setUTCHours(12, 0, 0, 0);
    setTime(d.getTime());
    setScenarioOpen(false);
    setToast(`${label} · ${d.getUTCFullYear()}`);
  }
  const shared = {
    date,
    tilt,
    sunHeight,
    sunRadius,
    followBody,
    onFollowBody: setFollowBody,
    measurePoints: measure ? points : [],
    intensity,
    layers,
    quality,
    mode,
    command: camera,
    location,
    fov,
    onPick: pick,
  };
  const dateLabel = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const timeLabel = date.toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour12: false,
  });
  return (
    <div
      className={`app ${immersive ? "immersive" : ""} ${compare ? "comparing" : ""}`}
    >
      <div className="viewport-stage">
        <div className={`canvas-grid ${compare ? "split" : ""}`}>
          <div className="canvas-pane">
            <SceneBoundary>
              <World
                {...shared}
                model={compare ? "round" : model}
                onNavigate={setCamera}
                onAltitude={setAltitude}
              />
            </SceneBoundary>
            {compare && (
              <span className="pane-badge">
                <i className="legend-dot green-bg" /> SPHERICAL EARTH{" "}
                <small>WGS84</small>
              </span>
            )}
          </div>
          {compare && (
            <div className="canvas-pane">
              <SceneBoundary>
                <World {...shared} model="flat" onNavigate={setCamera} />
              </SceneBoundary>
              <span className="pane-badge">
                <i className="legend-dot amber-bg" /> FLAT EARTH{" "}
                <small>HYPOTHETICAL</small>
              </span>
            </div>
          )}
        </div>
        <div className="viewport-vignette" />
      </div>
      {!immersive && (
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              resetView();
            }}
            aria-label="TerraSim home"
          >
            <span className="brand-icon">
              <Globe2 size={23} strokeWidth={1.5} />
            </span>
            <span>
              terra<span className="brand-light">sim</span>
              <sup>LAB</sup>
            </span>
          </a>
          <div className="nav-divider" />
          <nav aria-label="Main navigation">
            {["Explore", "Simulate", "Compare", "Experiments", "Settings"].map(
              (name) => (
                <button
                  key={name}
                  className={activeNav === name ? "active" : ""}
                  onClick={() => nav(name)}
                >
                  {name}
                </button>
              ),
            )}
          </nav>
          <div className="header-actions">
            <span className="system-status">
              <i /> All systems nominal
            </span>
            <button className="save-button" onClick={saveView}>
              <Bookmark size={14} />
              Save view
            </button>
            <button
              className="avatar"
              onClick={() => {
                setLeftOpen(true);
                setShowBookmarks((v) => !v);
              }}
              title="Your saved views"
            >
              R
            </button>
          </div>
        </header>
      )}
      {!immersive && (
        <>
          <div className={`viewport-heading ${leftOpen ? "offset-left" : ""}`}>
            <div className="eyebrow">
              <span className="live-dot" /> LIVE SIMULATION{" "}
              <span className="heading-divider">/</span>{" "}
              {mode === "space" ? "SOLAR SYSTEM" : "EARTH"}
            </div>
            <h1>
              {mode === "space"
                ? "A little perspective."
                : compare
                  ? "Two models. One reality."
                  : model === "round"
                    ? "Our extraordinary home."
                    : "A different perspective."}
            </h1>
            <p>
              {mode === "space"
                ? "Explore our celestial neighbourhood."
                : compare
                  ? "Change a variable. See what follows."
                  : "Explore freely. Question everything."}
            </p>
          </div>
          <div className={`view-status ${rightOpen ? "offset-right" : ""}`}>
            <span className="view-status-icon">
              <Orbit size={15} />
            </span>
            {mode === "surface"
              ? "SURFACE VIEW"
              : mode === "space"
                ? "SPACE VIEW"
                : "ORBITAL VIEW"}
            <span className="mini-dot" />
            {quality === "high" ? "HIGH QUALITY" : "PERFORMANCE"}
          </div>
        </>
      )}
      {!immersive && leftOpen && (
        <aside
          className={`left-panel panel ${mobilePanel === "left" ? "mobile-open" : ""}`}
        >
          <div className="panel-title">
            <span>Your workspace</span>
            <button
              className="icon-button"
              aria-label="Collapse workspace"
              onClick={() => setLeftOpen(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
          <div className="search-box">
            <Search size={15} />
            <input
              ref={searchRef}
              aria-label="Search places or coordinates"
              placeholder="Find a place or coordinates"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchResults([]);
                setSearchNote("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  filtered.length ? visit(filtered[0]) : worldwide();
              }}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="workspace-scroll">
            <div className="panel-section model-section">
              <div className="section-label">
                EARTH MODEL{" "}
                <Info
                  size={12}
                  onClick={() => setHelp(true)}
                  aria-label="Model information"
                  role="button"
                  tabIndex={0}
                />
              </div>
              <div className="model-options">
                <button
                  className={model === "round" ? "selected" : ""}
                  onClick={() => setModel("round")}
                >
                  <span className="model-thumb globe-thumb" />
                  <span>Spherical</span>
                  <small>WGS84 ellipsoid</small>
                  {model === "round" && (
                    <span className="model-check">
                      <Check size={10} />
                    </span>
                  )}
                </button>
                <button
                  className={model === "flat" ? "selected" : ""}
                  onClick={() => setModel("flat")}
                >
                  <span className="model-thumb flat-thumb" />
                  <span>Flat disc</span>
                  <small>Hypothetical model</small>
                  {model === "flat" && (
                    <span className="model-check">
                      <Check size={10} />
                    </span>
                  )}
                </button>
              </div>
              {model === "flat" && (
                <p className="flat-warning">
                  Polar azimuthal projection. Distances and areas are distorted.
                </p>
              )}
            </div>
            <div className="panel-section">
              <div className="section-label">NAVIGATION</div>
              <div className="segmented nav-modes">
                {(
                  [
                    ["orbit", "Orbit", Orbit],
                    ["surface", "Surface", Mountain],
                    ["space", "Space", Satellite],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    className={mode === id ? "selected" : ""}
                    onClick={() => {
                      setMode(id);
                      if (id === "space")
                        setLayers((l) => ({ ...l, orbits: true }));
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-section locations-section">
              <div className="section-label">
                <span>
                  {mode === "space"
                    ? "CELESTIAL BODIES"
                    : query
                      ? "SEARCH RESULTS"
                      : showBookmarks
                        ? "SAVED VIEWS"
                        : "QUICK LOCATIONS"}
                </span>
                <button
                  className={showBookmarks ? "green" : ""}
                  onClick={() => setShowBookmarks((v) => !v)}
                  title="Toggle saved views"
                >
                  <Bookmark size={13} />
                </button>
              </div>
              <div className="location-list">
                {mode === "space" && !query ? (
                  [
                    "Overview",
                    "Sun",
                    "Mercury",
                    "Venus",
                    "Earth",
                    "Mars",
                    "Jupiter",
                    "Saturn",
                  ].map((body) => (
                    <button
                      key={body}
                      className={`location-row ${followBody === body ? "selected" : ""}`}
                      onClick={() => {
                        setFollowBody(body === "Overview" ? null : body);
                        setCamera((c) => ({ ...c, id: Date.now() }));
                      }}
                    >
                      <span className="location-symbol">
                        <Orbit size={14} />
                      </span>
                      <span>
                        <b>{body}</b>
                        <small>
                          {body === "Overview"
                            ? "Solar system"
                            : "Follow celestial body"}
                        </small>
                      </span>
                      <MoveUpRight size={13} />
                    </button>
                  ))
                ) : showBookmarks && !query ? (
                  views.length ? (
                    views.map((v, i) => (
                      <button
                        className="location-row"
                        key={i}
                        onClick={() => {
                          setModel(v.model);
                          setTime(v.date);
                          setLocation(v.location);
                          setMode("orbit");
                          setCamera({ ...v.camera, id: Date.now() });
                        }}
                      >
                        <span className="location-symbol">
                          <Bookmark size={14} />
                        </span>
                        <span>
                          <b>{v.name}</b>
                          <small>{new Date(v.date).toLocaleDateString()}</small>
                        </span>
                        <ChevronRight size={13} />
                      </button>
                    ))
                  ) : (
                    <p className="empty-note">
                      Save a view to keep your favourite places here.
                    </p>
                  )
                ) : (
                  filtered.map((l, i) => (
                    <button
                      className={`location-row ${location?.name === l.name ? "selected" : ""}`}
                      key={l.name + i}
                      onClick={() => visit(l)}
                    >
                      <span className="location-symbol">
                        <MapPin size={14} />
                      </span>
                      <span>
                        <b>{l.name}</b>
                        <small>{l.country}</small>
                      </span>
                      <MoveUpRight size={13} />
                    </button>
                  ))
                )}
              </div>
              {query && (
                <button
                  className="worldwide-button"
                  onClick={worldwide}
                  disabled={searching}
                >
                  {searching ? (
                    <LoaderCircle className="spin" size={13} />
                  ) : (
                    <Search size={13} />
                  )}{" "}
                  Search worldwide
                </button>
              )}
              {searchNote && <p className="empty-note">{searchNote}</p>}
            </div>
            <div className="panel-section layers-section">
              <div className="section-label">
                MAP LAYERS <Layers size={13} />
              </div>
              {(
                [
                  ["clouds", "Cloud cover", Sun],
                  ["atmosphere", "Atmosphere", Orbit],
                  ["night", "City lights", Moon],
                  ["grid", "Coordinate grid", Grid2X2],
                ] as const
              ).map(([id, label, Icon]) => (
                <div className="layer-row" key={id}>
                  <span>
                    <Icon size={14} />
                    {label}
                  </span>
                  <Toggle
                    label={label}
                    value={layers[id]}
                    onChange={() => setLayer(id)}
                  />
                </div>
              ))}
            </div>
          </div>
          <button className="lab-invitation" onClick={() => setLab("horizon")}>
            <span className="lab-invite-icon">
              <FlaskConical size={17} />
            </span>
            <span>
              <b>Follow your curiosity.</b>
              <small>Enter the physics lab</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
          <div className="workspace-foot">
            <span className="live-dot" /> A WORLD WORTH EXPLORING
          </div>
        </aside>
      )}
      {!immersive && !leftOpen && (
        <button
          className="panel-restore restore-left"
          onClick={() => setLeftOpen(true)}
          title="Open workspace"
        >
          <Layers size={18} />
        </button>
      )}
      {!immersive && rightOpen && (
        <aside
          className={`right-panel panel ${mobilePanel === "right" ? "mobile-open" : ""}`}
        >
          <div className="panel-title">
            <span>
              {activeNav === "Settings"
                ? "Display & controls"
                : "Simulation controls"}
            </span>
            <button
              className="icon-button"
              aria-label="Collapse simulation controls"
              onClick={() => setRightOpen(false)}
            >
              <PanelRightClose size={16} />
            </button>
          </div>
          <div className="right-scroll">
            <div className="panel-section time-section">
              <div className="section-label">
                DATE & TIME <span className="utc-badge">UTC</span>
              </div>
              <label className="datetime-field">
                <Clock3 size={15} />
                <input
                  aria-label="Simulation date and time UTC"
                  type="datetime-local"
                  step="1"
                  onFocus={() => setPlaying(false)}
                  min="1900-01-01T00:00"
                  max="2100-12-31T23:59"
                  value={date.toISOString().slice(0, 19)}
                  onChange={(e) => {
                    const t = Date.parse(e.target.value + "Z");
                    if (Number.isFinite(t)) setTime(t);
                  }}
                />
              </label>
              <div className="time-caption">
                <span className="live-dot" />
                {playing ? "Time is moving" : "Simulation paused"}
                <span>
                  {Math.abs(speed)}× {speed < 0 ? "reverse" : ""}
                </span>
              </div>
            </div>
            {activeNav === "Settings" ? (
              <>
                <div className="panel-section">
                  <div className="section-label">RENDERING</div>
                  <label className="select-control">
                    Graphics quality
                    <select
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                    >
                      <option value="high">High quality</option>
                      <option value="performance">Performance</option>
                    </select>
                  </label>
                  <Range
                    label="Field of view"
                    value={fov}
                    min={25}
                    max={80}
                    unit="°"
                    onChange={setFov}
                  />
                  <Range
                    label="Solar illumination"
                    value={intensity}
                    min={0.1}
                    max={2}
                    step={0.05}
                    unit="×"
                    onChange={setIntensity}
                  />
                </div>
                <div className="panel-section">
                  <div className="section-label">REFERENCE OVERLAYS</div>
                  {(
                    [
                      ["orbits", "Orbital paths"],
                      ["axis", "Rotation axis"],
                      ["rays", "Solar rays"],
                      ["labels", "Location labels"],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="layer-row" key={key}>
                      <span>{label}</span>
                      <Toggle
                        label={label}
                        value={layers[key]}
                        onChange={() => setLayer(key)}
                      />
                    </div>
                  ))}
                </div>
                <div className="panel-section">
                  <button
                    className="subtle-button"
                    onClick={() => {
                      setLayers(defaultLayers);
                      setFov(40);
                      setQuality("high");
                      setIntensity(1.2);
                      setToast("Display defaults restored");
                    }}
                  >
                    <RotateCcw size={13} /> Restore display defaults
                  </button>
                  <button
                    className="subtle-button"
                    onClick={() => setHelp(true)}
                  >
                    <Keyboard size={13} /> Controls & scientific notes
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="panel-section">
                  <div className="section-label">
                    PLANETARY PARAMETERS <SlidersHorizontal size={13} />
                  </div>
                  <Range
                    label="Axial tilt"
                    value={tilt}
                    min={0}
                    max={45}
                    step={0.01}
                    unit="°"
                    onChange={setTilt}
                  />
                  <div className="range-ticks">
                    <span>0°</span>
                    <button onClick={() => setTilt(23.44)}>
                      Earth · 23.44°
                    </button>
                    <span>45°</span>
                  </div>
                  {model === "flat" ? (
                    <>
                      <Range
                        label="Local Sun height"
                        value={sunHeight}
                        min={100}
                        max={20000}
                        step={100}
                        unit=" km"
                        onChange={setSunHeight}
                      />
                      <Range
                        label="Local Sun radius"
                        value={sunRadius}
                        min={5}
                        max={500}
                        step={5}
                        unit=" km"
                        onChange={setSunRadius}
                      />
                      <Range
                        label="Downward acceleration"
                        value={g}
                        min={0.1}
                        max={20}
                        step={0.01}
                        unit=" m/s²"
                        onChange={setG}
                      />
                      <p className="parameter-note">
                        Hypotheses: stationary plane, straight light rays, local
                        Sun following subsolar longitude. Sun rendered at 8×
                        size for visibility.
                      </p>
                    </>
                  ) : (
                    <div className="parameter-readouts">
                      <div>
                        <span>Mean radius</span>
                        <b>
                          6,371.01 <small>km</small>
                        </b>
                      </div>
                      <div>
                        <span>Sidereal rotation</span>
                        <b>
                          23h 56m <small>04s</small>
                        </b>
                      </div>
                      <div>
                        <span>Equatorial gravity</span>
                        <b>
                          9.7803 <small>m/s²</small>
                        </b>
                      </div>
                    </div>
                  )}
                </div>
                <div className="panel-section">
                  <div className="section-label">
                    SUN & MOON <Sun size={14} />
                  </div>
                  <div className="celestial-card">
                    <span className="celestial-icon sun-icon">
                      <Sun size={20} />
                    </span>
                    <div>
                      <b>The Sun</b>
                      <small>
                        {solar.lat >= 0 ? "Northern" : "Southern"} declination
                      </small>
                    </div>
                    <strong>
                      {Math.abs(solar.lat).toFixed(2)}
                      <small>°</small>
                    </strong>
                  </div>
                  <div className="celestial-card">
                    <span className="celestial-icon moon-icon">
                      <Moon size={19} />
                    </span>
                    <div>
                      <b>{model === "flat" ? "Reference Moon" : "The Moon"}</b>
                      <small>
                        {moon.phase < 180 ? "Waxing" : "Waning"} ·{" "}
                        {Math.round(moon.illumination * 100)}% lit
                      </small>
                    </div>
                    <strong>
                      {finite(moon.distanceKm / 1000, 0)}
                      <small>k km</small>
                    </strong>
                  </div>
                  <Range
                    label="Solar illumination"
                    value={intensity}
                    min={0.1}
                    max={2}
                    step={0.05}
                    unit="×"
                    onChange={setIntensity}
                  />
                </div>
                <div className="panel-section observation-section">
                  <div className="section-label">
                    AT {observer.name.toUpperCase()} <MapPin size={12} />
                  </div>
                  <div className="observation-values">
                    <div>
                      <span>Sun elevation</span>
                      <b>
                        {elevation.toFixed(1)}
                        <small>°</small>
                      </b>
                    </div>
                    <div>
                      <span>Daylight</span>
                      <b>
                        {daylight.toFixed(1)}
                        <small>h</small>
                      </b>
                    </div>
                  </div>
                  <div className="sun-day-track">
                    <span
                      style={{
                        left: `${Math.max(0, Math.min(100, ((elevation + 90) / 180) * 100))}%`,
                      }}
                    >
                      <Sun size={12} />
                    </span>
                  </div>
                  <div className="sun-day-label">
                    <span>−90°</span>
                    <span>Horizon</span>
                    <span>+90°</span>
                  </div>
                </div>
                <div className="panel-section">
                  <div className="layer-row">
                    <span>
                      <Orbit size={14} /> Orbital paths
                    </span>
                    <Toggle
                      label="Orbital paths"
                      value={layers.orbits}
                      onChange={() => setLayer("orbits")}
                    />
                  </div>
                  <div className="layer-row">
                    <span>
                      <Crosshair size={14} /> Rotation axis
                    </span>
                    <Toggle
                      label="Rotation axis"
                      value={layers.axis}
                      onChange={() => setLayer("axis")}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="science-footer">
            <span>
              <i /> CALCULATED, NOT SCRIPTED
            </span>
            <button onClick={() => setHelp(true)} title="About the science">
              <Info size={13} />
            </button>
          </div>
        </aside>
      )}
      {!immersive && !rightOpen && (
        <button
          className="panel-restore restore-right"
          onClick={() => setRightOpen(true)}
          title="Open simulation controls"
        >
          <Settings2 size={18} />
        </button>
      )}
      {!immersive && (
        <div className="mobile-panel-tools">
          <button
            className="mobile-workspace"
            title="Open workspace"
            onClick={() => {
              setLeftOpen(true);
              setMobilePanel((v) => (v === "left" ? null : "left"));
            }}
          >
            <Layers size={17} />
          </button>
          <button
            title="Open simulation controls"
            onClick={() => {
              setRightOpen(true);
              setMobilePanel((v) => (v === "right" ? null : "right"));
            }}
          >
            <Settings2 size={17} />
          </button>
        </div>
      )}
      <div
        className={`viewport-tools ${rightOpen && !immersive ? "offset-right" : ""}`}
      >
        <button
          className="compass-control"
          title="Face north"
          onClick={() => setCamera({ ...camera, id: Date.now(), lat: 25 })}
        >
          <span>N</span>
          <Compass size={28} strokeWidth={1} />
        </button>
        <div className="tool-group">
          <button
            aria-label="Zoom in"
            onClick={() =>
              mode !== "orbit"
                ? setFov((v) => Math.max(25, v - 5))
                : setCamera({
                    ...camera,
                    id: Date.now(),
                    distance: Math.max(2.05, camera.distance * 0.82),
                  })
            }
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() =>
              mode !== "orbit"
                ? setFov((v) => Math.min(80, v + 5))
                : setCamera({
                    ...camera,
                    id: Date.now(),
                    distance: Math.min(35, camera.distance * 1.22),
                  })
            }
          >
            <Minus size={18} />
          </button>
        </div>
        <div className="tool-group">
          <button
            className={overview ? "active" : ""}
            title="Toggle overview map"
            onClick={() => setOverview((v) => !v)}
          >
            <Globe2 size={16} />
          </button>
          <button title="Reset camera" onClick={resetView}>
            <RotateCcw size={16} />
          </button>
          <button
            className={measure ? "active" : ""}
            title="Measure distance"
            onClick={() => {
              setMode("orbit");
              setMeasure((v) => !v);
              setPoints([]);
            }}
          >
            <Ruler size={17} />
          </button>
          <button
            title="Immersive mode (I)"
            onClick={() => setImmersive((v) => !v)}
          >
            {immersive ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>
      {immersive && (
        <button className="exit-immersive" onClick={() => setImmersive(false)}>
          <Minimize size={14} /> Exit immersive mode <kbd>I</kbd>
        </button>
      )}
      {!immersive && (
        <>
          <div className={`planet-caption ${leftOpen ? "offset-left" : ""}`}>
            <span className="planet-caption-line" />
            <span>
              {mode === "space"
                ? "THE SOLAR SYSTEM"
                : model === "round"
                  ? "PLANET EARTH"
                  : "THE FLAT-DISC HYPOTHESIS"}
            </span>
            <small>
              {mode === "space"
                ? "Ephemeris positions · sizes exaggerated"
                : model === "round"
                  ? "4.54 billion years in the making."
                  : "North-polar azimuthal equidistant projection."}
            </small>
          </div>
          <div
            className={`viewport-readouts ${rightOpen ? "offset-right" : ""}`}
          >
            <span>
              <LocateFixed size={12} />
              {formatCoord(camera.lat, camera.lon)}
            </span>
            <span>
              {mode === "space" ? "SCALE" : "CAM ALT"}{" "}
              <b>
                {mode === "space"
                  ? "AU · body sizes exaggerated"
                  : mode === "surface"
                    ? `${finite(altitude * 1000, 1)} m AGL`
                    : `${finite(altitude, 0)} km`}
              </b>
            </span>
          </div>
        </>
      )}
      {overview && (
        <OverviewMap
          camera={camera}
          onClose={() => setOverview(false)}
          onVisit={(lat, lon) =>
            visit({ name: "Map location", lat, lon, country: "World overview" })
          }
        />
      )}
      {measure && (
        <div className="measurement-card">
          <div>
            <Ruler size={15} />
            <b>Distance measurement</b>
            <button
              className="icon-button"
              onClick={() => setMeasure(false)}
              aria-label="Close measurement"
            >
              <X size={15} />
            </button>
          </div>
          <p>
            {points.length === 0
              ? "Double-click the surface to place a starting point."
              : points.length === 1
                ? "Double-click a second point to measure."
                : "Double-click again to start a new measurement."}
          </p>
          {points.map((p, i) => (
            <small key={i}>
              {i ? "B" : "A"} · {formatCoord(p.lat, p.lon)}
            </small>
          ))}
          {points.length === 2 && (
            <strong>
              {finite(
                model === "round"
                  ? sphericalDistance(points[0], points[1])
                  : flatDistance(points[0], points[1]),
                1,
              )}{" "}
              <span>km</span>
            </strong>
          )}
        </div>
      )}
      {compare && !immersive && (
        <div className="comparison-strip">
          <div>
            <ArrowLeftRight size={17} />
            <span>
              Solar elevation at {observer.name}
              <small>Same location. Same moment. Different geometry.</small>
            </span>
          </div>
          <b className="green">
            {solarElevation(observer.lat, observer.lon, date, tilt).toFixed(2)}°
            <small>SPHERICAL</small>
          </b>
          <b className="amber">
            {solarElevation(
              observer.lat,
              observer.lon,
              date,
              tilt,
              "flat",
              sunHeight,
            ).toFixed(2)}
            °<small>FLAT DISC</small>
          </b>
          <button onClick={() => setLab("sunset")}>
            Inspect predictions <ArrowUpRight size={14} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setCompare(false);
              setActiveNav("Explore");
              setLeftOpen(true);
              setRightOpen(true);
            }}
            title="Close comparison"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {!immersive && (
        <footer className="timeline">
          <div className="timeline-top">
            <div className="timeline-date">
              <span className="live-dot" />
              {dateLabel}
              <span className="timeline-time">
                {timeLabel} <small>UTC</small>
              </span>
            </div>
            <div className="timeline-track">
              <div className="timeline-ticks">
                {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
                  <span key={hour}>{String(hour).padStart(2, "0")}:00</span>
                ))}
              </div>
              <input
                aria-label="Time of day"
                type="range"
                min="0"
                max="86399"
                step="60"
                value={
                  date.getUTCHours() * 3600 +
                  date.getUTCMinutes() * 60 +
                  date.getUTCSeconds()
                }
                onChange={(e) => {
                  const d = new Date(date);
                  d.setUTCHours(0, 0, +e.target.value, 0);
                  setTime(d.getTime());
                }}
              />
            </div>
            <div className="timeline-options">
              <span className="timeline-link">
                <Orbit size={13} /> Simulation time
              </span>
              <button onClick={() => setScenarioOpen((v) => !v)}>
                Scenarios <ChevronDown size={13} />
              </button>
              {scenarioOpen && (
                <div className="scenario-menu">
                  <span className="eyebrow">SEASONAL MILESTONES</span>
                  <button
                    onClick={() => selectScenario(2, 20, "March equinox")}
                  >
                    March equinox <small>20 MAR</small>
                  </button>
                  <button
                    onClick={() => selectScenario(5, 21, "June solstice")}
                  >
                    June solstice <small>21 JUN</small>
                  </button>
                  <button
                    onClick={() => selectScenario(8, 22, "September equinox")}
                  >
                    September equinox <small>22 SEP</small>
                  </button>
                  <button
                    onClick={() => selectScenario(11, 21, "December solstice")}
                  >
                    December solstice <small>21 DEC</small>
                  </button>
                  <p>
                    Calendar presets at 12:00 UTC; exact event times vary by
                    year.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="timeline-bottom">
            <div className="playback-controls">
              <button
                title="Reset simulation time"
                onClick={() => setTime(INITIAL)}
              >
                <RotateCcw size={14} />
              </button>
              <span className="playback-divider" />
              <button
                title="Previous day"
                onClick={() => setTime((t) => t - 86400000)}
              >
                <SkipBack size={15} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause simulation" : "Play simulation"}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" />
                )}
              </button>
              <button
                title="Next day"
                onClick={() => setTime((t) => t + 86400000)}
              >
                <SkipForward size={15} />
              </button>
              <span className="playback-divider" />
              <button
                className={speed < 0 ? "green" : ""}
                title="Reverse time"
                onClick={() => setSpeed((s) => -s)}
              >
                <FastForward
                  size={13}
                  style={{ transform: "rotate(180deg)" }}
                />
              </button>
              <select
                aria-label="Simulation speed"
                value={Math.abs(speed)}
                onChange={(e) => setSpeed(+e.target.value * Math.sign(speed))}
              >
                {[1, 60, 600, 3600, 86400].map((s) => (
                  <option value={s} key={s}>
                    {s === 1
                      ? "Real time"
                      : s === 60
                        ? "1 min / sec"
                        : s === 600
                          ? "10 min / sec"
                          : s === 3600
                            ? "1 hour / sec"
                            : "1 day / sec"}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} />
            </div>
            <div className="timeline-center">
              <span className="live-dot" />
              {playing
                ? Math.abs(speed) === 1
                  ? "EXPLORING IN REAL TIME"
                  : "SIMULATION IN MOTION"
                : "YOUR UNIVERSE, ON PAUSE"}
              <span>·</span>{" "}
              {model === "round"
                ? "WGS84 reference model"
                : "Hypothetical flat disc"}
            </div>
            <button className="keyboard-help" onClick={() => setHelp(true)}>
              <Keyboard size={14} />
              <span>Controls & info</span>
              <kbd>?</kbd>
            </button>
          </div>
        </footer>
      )}
      {!immersive && (
        <div className="bottom-status">
          <span>
            TERRASIM <small>V1.0</small>
            <i />
            Built for a curious mind.
          </span>
          <span>
            WebGL renderer <i />
            Textures by Solar System Scope{" "}
            <button onClick={() => setHelp(true)}>
              Attributions <ArrowUpRight size={10} />
            </button>
          </span>
        </div>
      )}
      {lab && (
        <Laboratory
          initial={lab}
          date={date}
          tilt={tilt}
          sunHeight={sunHeight}
          g={g}
          location={observer}
          onTimeChange={(t) => {
            setTime(t);
            setPlaying(false);
          }}
          onClose={() => {
            setLab(null);
            if (activeNav === "Experiments") setActiveNav("Explore");
          }}
        />
      )}
      {help && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHelp(false);
          }}
        >
          <section
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Controls and scientific notes"
          >
            <button
              className="icon-button close-info"
              onClick={() => setHelp(false)}
              title="Close information"
            >
              <X size={20} />
            </button>
            <span className="brand-icon">
              <Globe2 size={26} />
            </span>
            <div className="eyebrow green">THE WORLD IS YOUR LABORATORY</div>
            <h1>A little curiosity goes a long way.</h1>
            <h3>Make yourself at home.</h3>
            <div className="shortcut-grid">
              <span>
                Orbit / look around <kbd>Drag</kbd>
              </span>
              <span>
                Zoom <kbd>Scroll</kbd>
              </span>
              <span>
                Free flight <kbd>W A S D · Q E</kbd>
              </span>
              <span>
                Play / pause <kbd>Space</kbd>
              </span>
              <span>
                Immersive mode <kbd>I</kbd>
              </span>
              <span>
                Pick a location <kbd>Double click</kbd>
              </span>
            </div>
            <h3>Good science starts with clear assumptions.</h3>
            <p>
              The sphere uses WGS84 flattening, Astronomy Engine ephemerides,
              mean-radius great-circle distances, and WGS84 normal gravity.
              Adjustable tilt is a counterfactual obliquity experiment. Surface
              mode follows smooth ellipsoid geometry; streamed elevation,
              detailed buildings, and ground imagery are not included.
            </p>
            <p>
              The flat disc is a north-polar azimuthal equidistant projection
              with a local Sun, straight rays, uniform downward gravity, and a
              stationary surface. Its distances and areas are distorted. Missing
              orbital or stellar mechanisms are shown as no prediction.
              Comparison values are calculated predictions; no measured
              observational dataset is bundled.
            </p>
            <p>
              The Moon’s display distance and size are compressed; its phase
              readout uses ephemerides. Solar-system positions use ephemerides,
              AU-scaled distances, exaggerated body sizes, and sampled orbital
              paths. Rendered cloud imagery is static. Lunar eclipse experiments
              calculate geometric umbral obscuration and offer ephemeris event
              searches; eclipse shadows are not rendered to scale in the
              viewport. Ground cameras use a smooth geometric surface.
            </p>
            <div className="attribution-links">
              <a
                href="https://play.solarsystemscope.com/textures/"
                target="_blank"
                rel="noreferrer"
              >
                Textures: Solar System Scope · CC BY 4.0{" "}
                <ArrowUpRight size={13} />
              </a>
              <a
                href="https://github.com/cosinekitty/astronomy"
                target="_blank"
                rel="noreferrer"
              >
                Astronomy Engine · MIT <ArrowUpRight size={13} />
              </a>
              <a
                href="https://gml.noaa.gov/grad/solcalc/calcdetails.html"
                target="_blank"
                rel="noreferrer"
              >
                NOAA solar reference <ArrowUpRight size={13} />
              </a>
            </div>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
