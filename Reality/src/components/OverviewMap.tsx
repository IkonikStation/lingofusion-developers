import { Crosshair, X } from "lucide-react";
import type { CameraCommand } from "./World";
export default function OverviewMap({
  camera,
  onVisit,
  onClose,
}: {
  camera: CameraCommand;
  onVisit: (lat: number, lon: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="overview-map">
      <header>
        <Crosshair size={11} />
        <span>WORLD OVERVIEW</span>
        <button onClick={onClose} title="Close overview map">
          <X size={11} />
        </button>
      </header>
      <button
        className="overview-surface"
        aria-label="Navigate using the overview map"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onVisit(
            90 - ((e.clientY - r.top) / r.height) * 180,
            ((e.clientX - r.left) / r.width) * 360 - 180,
          );
        }}
      >
        <img
          src="/textures/earth-day-2k.jpg"
          alt="Equirectangular map of Earth"
          draggable={false}
        />
        <span
          className="overview-crosshair"
          style={{
            left: `${((camera.lon + 180) / 360) * 100}%`,
            top: `${((90 - camera.lat) / 180) * 100}%`,
          }}
        >
          <i />
          <i />
        </span>
      </button>
      <small>Click anywhere to explore.</small>
    </div>
  );
}
