import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { WorldProps } from "./World";
import {
  DEG,
  WGS84,
  project,
  solarState,
  geoVector,
  moonState,
} from "../lib/science";
import { vertex, earthFragment } from "../lib/shaders";
// Surface cameras use a local tangent frame in metres, avoiding planet-sized
// coordinates in vertex buffers. The visible patch is an ellipsoid, not a plane.
function ecef(lat: number, lon: number) {
  const e2 = 1 - (WGS84.b / WGS84.a) ** 2;
  const n = (WGS84.a * 1000) / Math.sqrt(1 - e2 * Math.sin(lat * DEG) ** 2);
  return new THREE.Vector3(
    n * Math.cos(lat * DEG) * Math.cos(lon * DEG),
    n * (1 - e2) * Math.sin(lat * DEG),
    -n * Math.cos(lat * DEG) * Math.sin(lon * DEG),
  );
}
export default function Surface({
  model,
  command,
  date,
  tilt,
  sunHeight,
  sunRadius,
  intensity,
  quality,
}: WorldProps) {
  const [day, night, cloud] = useTexture(
    quality === "high"
      ? [
          "/textures/earth-day.jpg",
          "/textures/earth-night.jpg",
          "/textures/earth-clouds.jpg",
        ]
      : [
          "/textures/earth-day-2k.jpg",
          "/textures/earth-night-2k.jpg",
          "/textures/earth-clouds-2k.jpg",
        ],
  );
  const moonTexture = useTexture("/textures/moon.jpg");
  const { lat, lon } = command;
  const flat = model === "flat";
  const center = useMemo(() => ecef(lat, lon), [lat, lon]);
  const up = useMemo(
    () => new THREE.Vector3(...geoVector(lat, lon, 1)),
    [lat, lon],
  );
  const east = useMemo(
    () => new THREE.Vector3(-Math.sin(lon * DEG), 0, -Math.cos(lon * DEG)),
    [lon],
  );
  const north = useMemo(
    () => new THREE.Vector3().crossVectors(up, east),
    [up, east],
  );
  const geometry = useMemo(() => {
    const segments = quality === "high" ? 256 : 128,
      positions: number[] = [],
      normals: number[] = [],
      uvs: number[] = [],
      indices: number[] = [];
    const origin = project(lat, lon);
    for (let j = 0; j <= segments; j++)
      for (let i = 0; i <= segments; i++) {
        const a = i / segments - 0.5,
          b = j / segments - 0.5;
        let latitude: number, longitude: number;
        let p: THREE.Vector3, n: THREE.Vector3;
        if (flat) {
          const x = origin.x + a * 120,
            y = origin.y - b * 120;
          latitude = 90 - Math.hypot(x, y) / 6371.0088 / DEG;
          longitude = Math.atan2(x, y) / DEG;
          p = new THREE.Vector3(a * 120000, 0, b * 120000);
          n = new THREE.Vector3(0, 1, 0);
        } else {
          const global = center
            .clone()
            .addScaledVector(east, a * 90000)
            .addScaledVector(north, -b * 90000);
          const ra = WGS84.a * 1000,
            rb = WGS84.b * 1000;
          global.multiplyScalar(
            1 /
              Math.sqrt(
                (global.x * global.x + global.z * global.z) / (ra * ra) +
                  (global.y * global.y) / (rb * rb),
              ),
          );
          latitude =
            Math.atan2(
              global.y / ((rb * rb) / (ra * ra)),
              Math.hypot(global.x, global.z),
            ) / DEG;
          longitude = Math.atan2(-global.z, global.x) / DEG;
          longitude += 360 * Math.round((lon - longitude) / 360);
          const offset = global.clone().sub(center);
          p = new THREE.Vector3(
            offset.dot(east),
            offset.dot(up),
            -offset.dot(north),
          );
          const normal = new THREE.Vector3(
            global.x / (ra * ra),
            global.y / (rb * rb),
            global.z / (ra * ra),
          ).normalize();
          n = new THREE.Vector3(
            normal.dot(east),
            normal.dot(up),
            -normal.dot(north),
          );
        }
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        uvs.push((longitude + 180) / 360, (latitude + 90) / 180);
        if (i < segments && j < segments) {
          const a = j * (segments + 1) + i,
            b = a + 1,
            c = a + segments + 1,
            d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    return g;
  }, [flat, lat, lon, center, up, east, north, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const solar = solarState(date, tilt);
  const sun = useMemo(() => {
    if (flat) {
      const p = project(solar.lat, solar.lon),
        o = project(lat, lon);
      return new THREE.Vector3(
        (p.x - o.x) * 1000,
        sunHeight * 1000,
        -(p.y - o.y) * 1000,
      );
    }
    const direction = new THREE.Vector3(...geoVector(solar.lat, solar.lon, 1));
    return new THREE.Vector3(
      direction.dot(east),
      direction.dot(up),
      -direction.dot(north),
    ).multiplyScalar(600000);
  }, [flat, solar.lat, solar.lon, lat, lon, sunHeight, east, up, north]);
  const moon = moonState(date);
  const moonDirection = new THREE.Vector3(...geoVector(moon.lat, moon.lon, 1));
  const moonPosition = new THREE.Vector3(
    moonDirection.dot(east),
    moonDirection.dot(up),
    -moonDirection.dot(north),
  ).multiplyScalar(600000);
  moonTexture.colorSpace = THREE.SRGBColorSpace;
  day.wrapS = night.wrapS = THREE.RepeatWrapping;
  return (
    <group>
      {!flat && (
        <>
          <directionalLight position={sun} intensity={1.7} />
          <ambientLight intensity={0.035} />
          <mesh position={moonPosition}>
            <sphereGeometry
              args={[(600000 * 1737.4) / moon.distanceKm, 32, 24]}
            />
            <meshStandardMaterial map={moonTexture} roughness={1} />
          </mesh>
        </>
      )}
      <mesh geometry={geometry}>
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={earthFragment}
          uniforms={{
            dayMap: { value: day },
            nightMap: { value: night },
            cloudMap: { value: cloud },
            showClouds: { value: 0 },
            sun: { value: sun },
            intensity: { value: intensity },
            nightLights: { value: 0 },
            flatModel: { value: flat ? 1 : 0 },
          }}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={sun}>
        <sphereGeometry args={[flat ? sunRadius * 1000 : 2790, 32, 24]} />
        <meshBasicMaterial color="#fff3d9" toneMapped={false} />
      </mesh>
    </group>
  );
}
