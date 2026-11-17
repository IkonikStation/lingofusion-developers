import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Line,
  Billboard,
  Text,
  useTexture,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { vertex, earthFragment } from "../lib/shaders";
import Surface from "./Surface";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import {
  geoVector,
  solarState,
  moonState,
  DEG,
  RADIUS,
  planetPositions,
  WGS84,
  solarElevation,
  sphericalDistance,
  flatDistance,
  finite,
} from "../lib/science";
import type { EarthModel, Location } from "../lib/science";
export type Layers = {
  clouds: boolean;
  atmosphere: boolean;
  grid: boolean;
  night: boolean;
  orbits: boolean;
  labels: boolean;
  axis: boolean;
  rays: boolean;
};
export type ViewMode = "orbit" | "surface" | "space";
export type CameraCommand = {
  id: number;
  lat: number;
  lon: number;
  distance: number;
  direction?: [number, number, number];
};
export type WorldProps = {
  model: EarthModel;
  date: Date;
  tilt: number;
  sunHeight: number;
  intensity: number;
  layers: Layers;
  quality: string;
  mode: ViewMode;
  command: CameraCommand;
  location: Location | null;
  fov: number;
  onNavigate?: (command: CameraCommand) => void;
  onAltitude?: (alt: number) => void;
  onPick?: (lat: number, lon: number) => void;
  measurePoints?: Location[];
  sunRadius: number;
  followBody: string | null;
  onFollowBody?: (body: string | null) => void;
};
function Earth({
  model,
  date,
  tilt,
  sunHeight,
  intensity,
  layers,
  quality,
  onPick,
  sunRadius,
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
  const sun = solarState(date, tilt);
  const isFlat = model === "flat";
  const sunVector = useMemo(() => {
    if (!isFlat) return new THREE.Vector3(...geoVector(sun.lat, sun.lon, 100));
    const r = ((90 - sun.lat) / 180) * 3.5;
    return new THREE.Vector3(
      r * Math.sin(sun.lon * DEG),
      (sunHeight * 3.5) / (Math.PI * RADIUS),
      r * Math.cos(sun.lon * DEG),
    );
  }, [sun.lat, sun.lon, isFlat, sunHeight]);
  useMemo(() => {
    day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
    day.anisotropy = night.anisotropy = 8;
    cloud.anisotropy = 4;
  }, [day, night, cloud]);
  const uniforms = useMemo(
    () => ({
      dayMap: { value: day },
      nightMap: { value: night },
      sun: { value: sunVector },
      intensity: { value: intensity },
      nightLights: { value: layers.night ? 1 : 0 },
      flatModel: { value: isFlat ? 1 : 0 },
      cloudMap: { value: cloud },
      showClouds: { value: layers.clouds ? 1 : 0 },
    }),
    [
      day,
      night,
      sunVector,
      intensity,
      layers.night,
      isFlat,
      cloud,
      layers.clouds,
    ],
  );
  const geometry = useMemo(() => {
    if (!isFlat)
      return new THREE.SphereGeometry(
        2,
        quality === "high" ? 160 : 64,
        quality === "high" ? 100 : 40,
      ).scale(1, WGS84.b / WGS84.a, 1);
    const vertices: number[] = [],
      uvs: number[] = [],
      normals: number[] = [];
    const rings = 64,
      segments = 180;
    const add = (r: number, j: number) => {
      const angle = (j / segments) * Math.PI * 2 - Math.PI;
      vertices.push(r * 3.5 * Math.sin(angle), 0, r * 3.5 * Math.cos(angle));
      uvs.push(j / segments, 1 - r);
      normals.push(0, 1, 0);
    };
    for (let i = 0; i < rings; i++)
      for (let j = 0; j < segments; j++) {
        add(i / rings, j);
        add((i + 1) / rings, j + 1);
        add((i + 1) / rings, j);
        add(i / rings, j);
        add(i / rings, j + 1);
        add((i + 1) / rings, j + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    return g;
  }, [isFlat, quality]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const grid = useMemo(() => {
    const lines: [number, number, number][][] = [];
    const point = (lat: number, lon: number): [number, number, number] =>
      isFlat
        ? [
            ((90 - lat) / 180) * 3.5 * Math.sin(lon * DEG),
            0.014,
            ((90 - lat) / 180) * 3.5 * Math.cos(lon * DEG),
          ]
        : geoVector(lat, lon, 2.008);
    for (let lat = -60; lat <= 60; lat += 30) {
      const l: [number, number, number][] = [];
      for (let lon = -180; lon <= 180; lon += 3) l.push(point(lat, lon));
      lines.push(l);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const l: [number, number, number][] = [];
      for (let lat = -90; lat <= 90; lat += 3) l.push(point(lat, lon));
      lines.push(l);
    }
    return lines;
  }, [isFlat]);
  const pick = (e: any) => {
    e.stopPropagation();
    if (!onPick) return;
    if (isFlat) {
      const r = Math.hypot(e.point.x, e.point.z);
      onPick(90 - (r / 3.5) * 180, Math.atan2(e.point.x, e.point.z) / DEG);
    } else {
      onPick(
        Math.asin(e.point.y / e.point.length()) / DEG,
        Math.atan2(-e.point.z, e.point.x) / DEG,
      );
    }
  };
  return (
    <group>
      <mesh geometry={geometry} onDoubleClick={pick}>
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={earthFragment}
          uniforms={uniforms}
          side={THREE.DoubleSide}
        />
      </mesh>
      {isFlat && (
        <mesh position={[0, -0.07, 0]}>
          <cylinderGeometry args={[3.5, 3.5, 0.12, 180]} />
          <meshBasicMaterial color="#172836" />
        </mesh>
      )}
      {!isFlat && layers.clouds && (
        <mesh scale={[1, WGS84.b / WGS84.a, 1]}>
          <sphereGeometry args={[2.014, 96, 64]} />
          <shaderMaterial
            vertexShader={vertex}
            fragmentShader={`uniform sampler2D clouds;uniform vec3 sun;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;void main(){float c=texture2D(clouds,vUv).r;float l=max(dot(normalize(vNormal),normalize(sun)),0.);gl_FragColor=vec4(vec3(.75,.85,1.)*(.05+l*1.05),c*.69);#include <colorspace_fragment>\n}`.replace(
              ";#include",
              ";\n#include",
            )}
            uniforms={{ clouds: { value: cloud }, sun: { value: sunVector } }}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
      {!isFlat && layers.atmosphere && (
        <mesh scale={[1, WGS84.b / WGS84.a, 1]}>
          <sphereGeometry args={[2.055, 96, 64]} />
          <shaderMaterial
            vertexShader={vertex}
            fragmentShader={`uniform vec3 sun;varying vec3 vNormal;varying vec3 vWorld;void main(){vec3 n=normalize(vNormal);vec3 v=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(n,v)),4.);float lit=smoothstep(-.3,.6,dot(n,normalize(sun)));gl_FragColor=vec4(vec3(.12,.44,1.)*rim*(.12+lit),rim*.7);}`}
            uniforms={{ sun: { value: sunVector } }}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
      {layers.grid &&
        grid.map((points, i) => (
          <Line
            key={i}
            points={points}
            color="#8abfc4"
            transparent
            opacity={0.2}
            lineWidth={0.6}
          />
        ))}
      {layers.axis && (
        <Line
          points={[
            [0, -3, 0],
            [0, 3, 0],
          ]}
          color="#c4e68c"
          dashed
          dashSize={0.08}
          gapSize={0.06}
          lineWidth={1}
        />
      )}
      {layers.rays &&
        [-0.6, 0, 0.6].map((a, i) => (
          <Line
            key={i}
            points={[
              sunVector
                .clone()
                .normalize()
                .multiplyScalar(8)
                .add(new THREE.Vector3(0, a, 0)),
              [0, a, 0],
            ]}
            color="#e8cc83"
            transparent
            opacity={0.55}
            dashed
            dashSize={0.12}
            gapSize={0.08}
          />
        ))}
      {isFlat && (
        <group position={sunVector}>
          <mesh>
            <sphereGeometry
              args={[
                Math.max(0.015, ((sunRadius * 3.5) / (Math.PI * RADIUS)) * 8),
                24,
                24,
              ]}
            />
            <meshBasicMaterial color="#fff2b1" />
          </mesh>
          <pointLight color="#fff5c9" intensity={4} />
        </group>
      )}
    </group>
  );
}
function LocationMarker({
  location,
  model,
  layers,
}: Pick<WorldProps, "location" | "model" | "layers">) {
  if (!location) return null;
  const p =
    model === "round"
      ? geoVector(location.lat, location.lon, 2.03)
      : ([
          ((90 - location.lat) / 180) * 3.5 * Math.sin(location.lon * DEG),
          0.04,
          ((90 - location.lat) / 180) * 3.5 * Math.cos(location.lon * DEG),
        ] as [number, number, number]);
  return (
    <group position={p}>
      <mesh>
        <sphereGeometry args={[0.018, 12, 12]} />
        <meshBasicMaterial color="#d5ff95" />
      </mesh>
      {layers.labels && (
        <Suspense fallback={null}>
          <Billboard position={[0, 0.08, 0]}>
            <Text
              font="/fonts/dm-sans.ttf"
              fontSize={0.055}
              color="#d6efc4"
              outlineColor="#09150c"
              outlineWidth={0.005}
            >
              {location.name}
            </Text>
          </Billboard>
        </Suspense>
      )}
    </group>
  );
}
function Starfield({ surface = false }: { surface?: boolean }) {
  const positions = useMemo(() => {
    let seed = 3478;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const a = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      const theta = rand() * Math.PI * 2,
        z = rand() * 2 - 1,
        r = 80;
      const s = Math.sqrt(1 - z * z);
      a[i * 3] = r * s * Math.cos(theta);
      a[i * 3 + 1] = r * z;
      a[i * 3 + 2] = r * s * Math.sin(theta);
    }
    return a;
  }, []);
  return (
    <points scale={surface ? 100000 : 1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={surface ? 6500 : 0.065}
        color="#becbdb"
        sizeAttenuation
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </points>
  );
}
function Moon({ date, layers }: Pick<WorldProps, "date" | "layers">) {
  const m = moonState(date);
  const p = geoVector(m.lat, m.lon, 7);
  return (
    <group>
      <mesh position={p}>
        <sphereGeometry args={[0.16, 32, 24]} />
        <meshStandardMaterial color="#a7a59d" roughness={1} />
      </mesh>
      {layers.labels && (
        <Suspense fallback={null}>
          <Billboard position={[p[0], p[1] + 0.24, p[2]]}>
            <Text
              font="/fonts/dm-sans.ttf"
              fontSize={0.065}
              letterSpacing={0.15}
              color="#a3b1b8"
            >
              MOON
            </Text>
          </Billboard>
        </Suspense>
      )}
      {layers.orbits && (
        <Line
          points={Array.from({ length: 181 }, (_, i) =>
            geoVector(5 * Math.sin(i * 2 * DEG), i * 2, 7),
          )}
          color="#608ca2"
          transparent
          opacity={0.15}
          lineWidth={0.6}
        />
      )}
    </group>
  );
}
const planetData = [
  { a: 0.387, e: 0.206, days: 88, r: 0.06, color: "#a3a3a0" },
  { a: 0.723, e: 0.007, days: 225, r: 0.105, color: "#dfba78" },
  { a: 1, e: 0.017, days: 365.25, r: 0.12, color: "#709dcc" },
  { a: 1.524, e: 0.093, days: 687, r: 0.083, color: "#c27855" },
  { a: 5.203, e: 0.049, days: 4333, r: 0.32, color: "#c5ac8c" },
  { a: 9.537, e: 0.057, days: 10759, r: 0.27, color: "#d1bf93" },
];
function SolarSystem({
  date,
  layers,
  onFollowBody,
}: Pick<WorldProps, "date" | "layers" | "onFollowBody">) {
  const planets = useMemo(() => planetPositions(date), [date]);
  const orbits = useMemo(
    () =>
      planetData.map((p, index) => {
        return Array.from({ length: 121 }, (_, i) => {
          const d = new Date(
            Date.UTC(2026, 0, 1) + ((p.days * i) / 120) * 86400000,
          );
          const v = planetPositions(d)[index];
          return [v.x * 2.5, v.z * 2.5, -v.y * 2.5] as [number, number, number];
        });
      }),
    [],
  );
  return (
    <group>
      <pointLight intensity={80} decay={1} />
      <ambientLight intensity={0.35} />
      <mesh>
        <sphereGeometry args={[0.55, 48, 32]} />
        <meshBasicMaterial color="#ffdc85" />
      </mesh>
      <Suspense fallback={null}>
        <Billboard position={[0, 0.85, 0]}>
          <Text
            font="/fonts/dm-sans.ttf"
            fontSize={0.12}
            letterSpacing={0.15}
            color="#d6c89d"
          >
            SUN
          </Text>
        </Billboard>
      </Suspense>
      {planets.map((p, i) => (
        <group key={p.name}>
          {layers.orbits && (
            <Line
              points={orbits[i]}
              color="#728295"
              transparent
              opacity={0.22}
              lineWidth={0.6}
            />
          )}
          <group position={[p.x * 2.5, p.z * 2.5, -p.y * 2.5]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onFollowBody?.(p.name);
              }}
            >
              <sphereGeometry args={[planetData[i].r, 32, 24]} />
              <meshStandardMaterial color={planetData[i].color} />
            </mesh>
            {i === 5 && (
              <mesh rotation={[Math.PI / 2.5, 0, 0]}>
                <ringGeometry args={[0.36, 0.55, 64]} />
                <meshBasicMaterial
                  color="#b5a58b"
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            )}
            {layers.labels && (
              <Suspense fallback={null}>
                <Billboard position={[0, planetData[i].r + 0.25, 0]}>
                  <Text
                    font="/fonts/dm-sans.ttf"
                    fontSize={0.12}
                    letterSpacing={0.15}
                    color="#a6b9bf"
                  >
                    {p.name.toUpperCase()}
                  </Text>
                </Billboard>
              </Suspense>
            )}
          </group>
        </group>
      ))}
    </group>
  );
}
function CameraRig({
  command,
  model,
  mode,
  fov,
  onNavigate,
  onAltitude,
  date,
  followBody,
}: WorldProps) {
  const { camera, gl } = useThree();
  const bodyPosition = useMemo(() => {
    const b = planetPositions(date).find((p) => p.name === followBody);
    return b
      ? new THREE.Vector3(b.x * 2.5, b.z * 2.5, -b.y * 2.5)
      : new THREE.Vector3();
  }, [date, followBody]);
  const lastBodyPosition = useRef(new THREE.Vector3());
  const ref = useRef<OrbitControlsType>(null);
  const destination = useRef<THREE.Vector3 | null>(null);
  const target = useRef(new THREE.Vector3());
  const active = useRef(false);
  const lastAlt = useRef(0);
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const blur = () => keys.current.clear();
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  useEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = fov;
    perspective.near = mode === "surface" ? 0.3 : 0.005;
    perspective.far = mode === "surface" ? 1e8 : 200;
    camera.updateProjectionMatrix();
  }, [fov, camera, mode]);
  useEffect(() => {
    let p: THREE.Vector3;
    target.current.set(0, 0, 0);
    if (mode === "space") {
      target.current.copy(bodyPosition);
      lastBodyPosition.current.copy(bodyPosition);
      p = followBody
        ? bodyPosition.clone().add(new THREE.Vector3(1.8, 1.2, 2.5))
        : new THREE.Vector3(10, 14, 23);
    } else if (mode === "surface") {
      p = new THREE.Vector3(0, 1.7, 0);
      target.current.set(0, 1.7, -100);
      camera.up.set(0, 1, 0);
    } else if (model === "flat") {
      const radius = ((90 - command.lat) / 180) * 3.5;
      const at = new THREE.Vector3(
        radius * Math.sin(command.lon * DEG),
        0,
        radius * Math.cos(command.lon * DEG),
      );
      p = new THREE.Vector3(0, 10, 9).multiplyScalar(command.distance / 7.2);
      if (command.distance < 6.8) {
        target.current.copy(at);
        p.add(at);
      }
      camera.up.set(0, 1, 0);
    } else {
      p = command.direction
        ? new THREE.Vector3(...command.direction).multiplyScalar(
            command.distance,
          )
        : new THREE.Vector3(
            ...geoVector(command.lat, command.lon, command.distance),
          );
      camera.up.set(0, 1, 0);
    }
    destination.current = p;
    active.current = true;
  }, [command, model, mode, camera, followBody]);
  useFrame((state, delta) => {
    const controls = ref.current;
    if (!controls) return;
    if (mode === "space" && followBody) {
      const shift = bodyPosition.clone().sub(lastBodyPosition.current);
      camera.position.add(shift);
      controls.target.add(shift);
      target.current.add(shift);
      destination.current?.add(shift);
      lastBodyPosition.current.copy(bodyPosition);
    }
    if (active.current && destination.current) {
      camera.position.lerp(destination.current, 1 - Math.exp(-delta * 4));
      controls.target.lerp(target.current, 1 - Math.exp(-delta * 4));
      if (
        camera.position.distanceTo(destination.current) < 0.0002 &&
        controls.target.distanceTo(target.current) < 0.0002
      )
        active.current = false;
      controls.update();
    }
    const k = keys.current;
    if (k.size) {
      active.current = false;
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      const right = new THREE.Vector3()
        .crossVectors(forward, camera.up)
        .normalize();
      const speed =
        delta *
        (mode === "surface"
          ? 5
          : Math.max(0.005, camera.position.length() * 0.15));
      const move = new THREE.Vector3();
      if (k.has("w")) move.add(forward);
      if (k.has("s")) move.sub(forward);
      if (k.has("a")) move.sub(right);
      if (k.has("d")) move.add(right);
      if (k.has("q")) move.sub(camera.up);
      if (k.has("e")) move.add(camera.up);
      move.multiplyScalar(speed);
      camera.position.add(move);
      controls.target.add(move);
      controls.update();
    }
    if (state.clock.elapsedTime - lastAlt.current > 0.6) {
      lastAlt.current = state.clock.elapsedTime;
      onAltitude?.(
        Math.max(
          0,
          mode === "surface"
            ? camera.position.y / 1000
            : model === "flat"
              ? (camera.position.y * Math.PI * RADIUS) / 3.5
              : (camera.position.length() / 2 - 1) * RADIUS,
        ),
      );
    }
  });
  return (
    <OrbitControls
      ref={ref}
      camera={camera}
      domElement={gl.domElement}
      enableDamping
      dampingFactor={0.08}
      minDistance={mode === "surface" ? 1 : model === "round" ? 2.015 : 1}
      maxDistance={mode === "space" ? 90 : mode === "surface" ? 5000 : 35}
      enablePan={mode === "space" || mode === "surface"}
      zoomSpeed={0.7}
      rotateSpeed={0.55}
      onStart={() => {
        active.current = false;
      }}
      onEnd={() => {
        if (onNavigate && mode === "orbit") {
          if (model === "flat") {
            onNavigate({
              ...command,
              id: Date.now(),
              distance:
                camera.position.distanceTo(
                  ref.current?.target || new THREE.Vector3(),
                ) /
                (Math.hypot(10, 9) / 7.2),
            });
            return;
          }
          const d = camera.position.clone().normalize();
          onNavigate({
            id: Date.now(),
            lat: Math.asin(d.y) / DEG,
            lon: Math.atan2(-d.z, d.x) / DEG,
            distance: camera.position.length(),
            direction: d.toArray() as [number, number, number],
          });
        }
      }}
    />
  );
}

function Measurement({
  points,
  model,
}: {
  points: Location[];
  model: EarthModel;
}) {
  const positions = useMemo(() => {
    if (points.length < 2) return [];
    if (model === "flat")
      return points.map(
        (p) =>
          [
            ((90 - p.lat) / 180) * 3.5 * Math.sin(p.lon * DEG),
            0.04,
            ((90 - p.lat) / 180) * 3.5 * Math.cos(p.lon * DEG),
          ] as [number, number, number],
      );
    const a = new THREE.Vector3(...geoVector(points[0].lat, points[0].lon, 1));
    const b = new THREE.Vector3(...geoVector(points[1].lat, points[1].lon, 1));
    const angle = a.angleTo(b);
    return Array.from({ length: 100 }, (_, i) => {
      const t = i / 99;
      const v =
        angle < 0.00001
          ? a.clone()
          : a
              .clone()
              .multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
              .add(
                b.clone().multiplyScalar(Math.sin(t * angle) / Math.sin(angle)),
              );
      return v.normalize().multiplyScalar(2.03).toArray() as [
        number,
        number,
        number,
      ];
    });
  }, [points, model]);
  return (
    <group>
      {positions.length > 1 && (
        <Line points={positions} color="#dbf6b2" lineWidth={2} />
      )}{" "}
      {points.map((p, i) => {
        const pos =
          model === "round"
            ? geoVector(p.lat, p.lon, 2.04)
            : ([
                ((90 - p.lat) / 180) * 3.5 * Math.sin(p.lon * DEG),
                0.05,
                ((90 - p.lat) / 180) * 3.5 * Math.cos(p.lon * DEG),
              ] as [number, number, number]);
        return (
          <group key={i} position={pos}>
            <mesh>
              <sphereGeometry args={[0.025, 12, 12]} />
              <meshBasicMaterial color="#dbf6b2" />
            </mesh>
            <Suspense fallback={null}>
              <Billboard position={[0, 0.07, 0]}>
                <Text
                  font="/fonts/dm-sans.ttf"
                  fontSize={0.065}
                  color="#d6efc4"
                  outlineColor="#09150c"
                  outlineWidth={0.005}
                >
                  {i ? "B" : "A"}
                </Text>
              </Billboard>
            </Suspense>
          </group>
        );
      })}
    </group>
  );
}
function SurfaceSky({ date, tilt, command, model, sunHeight }: WorldProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const elevation = solarElevation(
    command.lat,
    command.lon,
    date,
    tilt,
    model,
    sunHeight,
  );
  const up = new THREE.Vector3(0, 1, 0);
  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={mesh} renderOrder={-5}>
      <sphereGeometry args={[500000, 32, 24]} />
      <shaderMaterial
        vertexShader={vertex}
        fragmentShader={`uniform vec3 up;uniform float daylight;varying vec3 vWorld;void main(){vec3 direction=normalize(vWorld-cameraPosition);float h=dot(direction,up);float horizon=pow(1.-abs(h),5.);vec3 sky=mix(vec3(.055,.16,.33),vec3(.37,.57,.72),horizon);float strength=smoothstep(-12.,8.,daylight);vec3 twilight=vec3(.55,.24,.12)*horizon*exp(-pow((daylight+3.)/7.,2.));gl_FragColor=vec4(sky*strength+twilight,clamp(strength+length(twilight),0.,1.));}`}
        uniforms={{ up: { value: up }, daylight: { value: elevation } }}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
function VisibleSun({ date, tilt }: Pick<WorldProps, "date" | "tilt">) {
  const s = solarState(date, tilt);
  return (
    <group position={geoVector(s.lat, s.lon, 60)}>
      <mesh>
        <sphereGeometry args={[0.279, 24, 24]} />
        <meshBasicMaterial color="#fff1cc" toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <shaderMaterial
          vertexShader={vertex}
          fragmentShader={`varying vec3 vNormal;varying vec3 vWorld;void main(){float center=pow(max(dot(normalize(vNormal),normalize(cameraPosition-vWorld)),0.),5.);gl_FragColor=vec4(1.,.65,.25,center*.18);}`}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Content(props: WorldProps) {
  const sun = solarState(props.date, props.tilt);
  return (
    <>
      <color attach="background" args={["#080c11"]} />
      <Starfield surface={props.mode === "surface"} />
      {props.mode === "surface" && <SurfaceSky {...props} />}{" "}
      {props.mode === "surface" ? (
        <Surface {...props} />
      ) : props.mode === "space" ? (
        <SolarSystem
          date={props.date}
          layers={props.layers}
          onFollowBody={props.onFollowBody}
        />
      ) : (
        <>
          <Earth {...props} />
          <LocationMarker {...props} />
          {props.measurePoints && (
            <Measurement points={props.measurePoints} model={props.model} />
          )}{" "}
          {props.model === "round" && <VisibleSun {...props} />}
          <directionalLight
            position={geoVector(sun.lat, sun.lon, 100)}
            intensity={2.4}
          />
          <ambientLight intensity={0.08} />
          {props.model === "round" && <Moon {...props} />}
        </>
      )}
      <CameraRig {...props} />
    </>
  );
}
export default function World(props: WorldProps) {
  const [error, setError] = useState(false);
  const { active, progress } = useProgress();
  return (
    <div className="world-canvas">
      {active && !error && (
        <div className="loading-overlay">
          <div className="scene-loading">
            <span />
            Preparing your planet · {Math.round(progress)}%
          </div>
        </div>
      )}
      {error ? (
        <div className="webgl-error">
          WebGL is unavailable. Enable hardware acceleration to explore the 3D
          world. The laboratory and predictions remain available.
        </div>
      ) : (
        <Canvas
          camera={{
            position: [6.4, 2.5, 2.4],
            fov: 40,
            near: 0.0001,
            far: 200,
          }}
          dpr={props.quality === "high" ? [1, 1.75] : 1}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.25;
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
              setError(true);
            });
          }}
          fallback={
            <div className="webgl-error">
              WebGL is required for the viewport. Your browser may need hardware
              acceleration enabled.
            </div>
          }
        >
          <Suspense fallback={null}>
            <Content {...props} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
