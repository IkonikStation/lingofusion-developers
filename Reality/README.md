# TerraSim

An interactive Earth and astronomy laboratory built with React, TypeScript, Three.js, React Three Fiber, and Astronomy Engine. The default experience is a single immersive globe. **Compare** explicitly opens a synchronized globe/disc pair.

## Run locally

Requires Node.js 22.12+ (Node 26 was used for verification).

```sh
npm install
npm run dev
```

Open **http://localhost:5173**. The Earth imagery and fonts are bundled; basic use needs no API key. Optional worldwide place search calls OpenStreetMap Nominatim, subject to network availability and that service's usage policy. Searches are initiated explicitly, not sent on every keystroke. Built-in places and coordinate entry work offline after installation.

```sh
npm test            # physics, geodesy, astronomy, and eclipse checks
npm run build      # strict TypeScript check and production build
npm run preview    # serve dist/ locally
```

## Explore

- Drag to orbit or look around; scroll to zoom. Use **W A S D** to fly and **Q / E** to descend / ascend.
- Select **Spherical** or **Flat disc**. Location, time, and experiment variables are retained. The flat disc makes its projection distortion explicit.
- Search built-in cities, search worldwide, or enter `45.5019, -73.5674`. Double-click the globe to pick a location.
- **Orbit**, **Surface**, and **Space** use distinct camera and scale configurations. Surface mode starts at 1.7 metres in a local tangent frame. Space shows Sun through Saturn and supports following a body.
- Save camera/time/model/location bookmarks with **Save view**. Bookmarks use browser local storage, limited to the latest 12 views.
- The globe button in the viewport toolbar opens a clickable overview map. The ruler measures two double-clicked surface points and draws the corresponding path.
- **Space** toggles playback; **I** toggles immersive mode; **Escape** closes overlays; **⌘/Ctrl K** focuses geographic search; **?** opens controls and scientific notes.
- The timeline supports pause, reverse, date/time to the second in UTC, day stepping, time acceleration, and seasonal calendar presets. Presets are illustrative calendar dates at noon, not precise solstice/equinox event solvers.
- Smaller screens expose workspace/settings drawer buttons. Panels and the lab can scroll independently.

## Physics laboratory

All 15 experiments evaluate formulas from current inputs rather than playing predefined outcome animations:

| Experiment            | Calculation                                                    |
| --------------------- | -------------------------------------------------------------- |
| Horizon               | Tangent distance from observer altitude                        |
| Ships / line of sight | Curvature-hidden target height using spherical geometry        |
| Sunrise / sunset      | Solar elevation from location and ephemeris                    |
| Shadows               | Vertical pole length divided by tangent of solar elevation     |
| Eratosthenes          | Simultaneous solar elevation difference between two places     |
| Seasons / polar day   | Sunrise-hour-angle daylight duration versus date and obliquity |
| Free fall             | Vacuum fall using local or assumed uniform acceleration        |
| Foucault              | Sidereal precession period versus latitude                     |
| Flights               | Great-circle versus projected planar distance                  |
| Satellites            | Spherical two-body circular speed and period                   |
| Lunar eclipses        | Moon/umbra circle overlap from Sun–Earth–Moon vectors          |
| Stars                 | Northern celestial-pole altitude versus latitude               |
| Solar time            | Mean solar-time offset from longitude                          |

The lab includes parameter controls, computed comparison cards, sampled charts, formulas, units, explicit assumptions, and CSV export. The eclipse experiment can find the next ephemeris-predicted lunar eclipse and move the simulation to its peak. Charts sample their labelled variable; infinity and missing solutions are preserved rather than replaced with zero. CSV leaves unspecified model solutions empty.

## Architecture and units

- `src/lib/science.ts`: UI-independent geographic, astronomical, physics, projection, eclipse, and experiment calculations. Public distances use km, observer/drop heights use metres, angles use degrees, time uses UTC `Date`, and gravitational acceleration uses m/s². Astronomy Engine supplies double-precision ephemeris vectors.
- `src/lib/shaders.ts`: shared day/night solar lighting, water highlight, and cloud shading.
- `src/components/World.tsx`: orbital renderer, polar disc mesh, atmospheric rim, cloud shell, city lights, grids, stars, Moon, Sun, AU-scaled solar system, navigation, and measured paths.
- `src/components/Surface.tsx`: local tangent-frame ground geometry in metres. Ellipsoid patches are generated from WGS84 geometry with local vertex coordinates to avoid planet-sized position subtraction in the GPU. The flat patch samples the inverse polar projection. The surface camera and orbit camera intentionally use different clipping ranges and units.
- `src/components/Laboratory.tsx`: experiment inputs, model predictions, sampled charts, and CSV exports.
- `src/components/OverviewMap.tsx`: equirectangular navigation map.
- `src/App.tsx`: shared clock, scenarios, model configuration, search, bookmarks, measurement selection, and panels.

React owns the experiment state and clock. Both comparison viewports share date, location, camera commands, and parameters. Orbital geometry uses Earth radius 2; solar-system positions use 2.5 scene units per AU. Surface scenes use metres. Shader lighting uses the same solar state as numerical readouts. Planetary and lunar visual sizes and distances are deliberately compressed or exaggerated where necessary and labelled accordingly.

High quality uses bundled 8K textures, denser geometry, and device pixel ratio up to 1.75. Performance uses 2K imagery, reduced geometry density, and pixel ratio 1. Texture assets are cached across viewports. Modern WebGL is required for the 3D view; the numerical lab can still be used if the renderer cannot start.

## Scientific boundaries

This is an operational, extensible first release, not a replacement for a GIS terrain engine or a validated professional ephemeris viewer.

- WGS84 semimajor/semiminor axes define the orbital ellipsoid. Great-circle distances and simple horizon experiments use the IUGG **mean radius** rather than a full ellipsoidal geodesic solver. WGS84 normal gravity includes an approximate inverse-square height correction. Free fall assumes locally constant acceleration and no drag.
- Default Sun/Moon positions use Astronomy Engine coordinates of date. Nonstandard axial tilt is an explicit counterfactual obliquity experiment, changing both declination and right ascension. Day length uses the conventional −0.833° sunrise threshold; most geometric visibility experiments exclude refraction.
- The baseline flat model is a **stationary north-polar azimuthal equidistant disc**, uniform downward gravity, straight light propagation, and a local Sun following a 24-hour subsolar circuit. The local Sun's height and radius are editable; its radius is enlarged 8× in the orbital viewport for visibility, and natural angular size is used in surface mode. There is no invented light cutoff to manufacture sunset. The model therefore predicts 24-hour unobstructed sunlight. No flat stellar dome, occulting body, or orbital mechanism is supplied: undefined predictions show a dash.
- Ground mode is a curved WGS84 reference surface (or plane), textured by satellite imagery. **Streamed elevation, mountains with real relief, buildings, street imagery, and terrain collisions are not implemented.** The surface patch spans roughly 90 km on the ellipsoid or 120 km on the disc. Long-distance ground traversal should use geographic search to recenter the patch.
- Clouds are static recorded imagery, not live weather. Atmospheric rim/sky and water highlights are real-time visual approximations, not a spectral scattering or climate model. The flat orbital view composites its recorded cloud layer onto the disc. Atmosphere currently affects the spherical shell; both surface sky renderings are geometric visual aids.
- The Moon's orbital display radius and size are compressed. Its distance, phase, and illumination readouts use ephemerides. The optional Moon orbit line is an illustrative reference ring rather than a propagated lunar trajectory. Planet paths are sampled ephemerides over one orbital period starting in 2026; body positions update to the selected time. Body sizes are exaggerated. Mercury through Saturn are included; Uranus, Neptune, asteroids, and N-body integration are future modules.
- Lunar eclipse obscuration is geometric: circle intersection with the conical terrestrial umbra, without atmospheric umbral enlargement. Event searches come from Astronomy Engine. Eclipse shadows are not rendered to physical scale in the main viewport. Local solar-eclipse contact/obscuration simulation is not included.
- The star field is a deterministic visual backdrop, **not an astrometric star catalogue**. The celestial-pole experiment supplies the rigorous latitude relation. Civil time-zone boundaries and daylight-saving rules are not included; solar time is distinct from civil time.
- Comparison results are predictions. **No measured observational dataset or empirical error dashboard is bundled.** Reference constants and calculation methods are identified, and the app does not present model agreement as observational validation.

## Sources and asset licensing

- [Astronomy Engine](https://github.com/cosinekitty/astronomy), MIT: astronomical positions, phase, eclipse searches.
- [NGA WGS84](https://earth-info.nga.mil/index.php?dir=wgs84&action=wgs84): ellipsoid and normal-gravity reference.
- [NOAA solar calculation details](https://gml.noaa.gov/grad/solcalc/calcdetails.html): solar/daylight conventions, refraction boundary.
- [Solar System Scope textures](https://play.solarsystemscope.com/textures/), **CC BY 4.0**, by INOVE / Solar System Scope, drawing on NASA Blue Marble: Earth day, night, cloud, and Moon imagery. The 2K variants were downsampled from the bundled 8K originals. [License](https://creativecommons.org/licenses/by/4.0/).
- [DM Sans](https://github.com/google/fonts/tree/main/ofl/dmsans) and [Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk), SIL Open Font License. Licenses are bundled under `public/fonts/`.
- Optional search: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/), OpenStreetMap contributors / ODbL data. The app contains no tracking, paid service keys, or backend account requirement.

## Verification

The production build passes TypeScript checking. The 20 Vitest checks cover distances, antipodes, coordinate parsing/transforms, projection distortion, solstice declination, solar elevation, polar daylight, tilt changes, flat local-Sun visibility, lunar range, horizon geometry, gravity, shadows, orbit speed/period, Foucault precession, all experiment definitions, undefined flat orbital predictions, and lunar umbral geometry. Browser QA exercised model switching, optional comparison, place navigation, bookmarks, observer-height inputs, surface camera, and solar-system navigation. Numeric tests validate calculations, not photorealism or external data availability.

## Native Unreal edition

The native Unreal Engine 5.8 project is in [unreal/TerraSim](unreal/TerraSim/README.md). It adds a physically scaled globe, native atmospheric scattering and a flyable Mont Blanc scene from real elevation and satellite data. Run `unreal/TerraSim/Scripts/launch.sh Alps` for terrain or `unreal/TerraSim/Scripts/launch.sh Earth` for orbit. The browser edition retains the broader astronomy lab.
