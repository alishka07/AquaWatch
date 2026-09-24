import type { Robot, Sample } from "./types";

// Coordinates roughly trace the Kapshagay reservoir shape in %.
// Waypoints are picked inside the water polygon.

export const ROBOT_COLORS = {
  cyan: "#335e57",
  lime: "#697b55",
  amber: "#a77838",
} as const;

export const initialRobots: Robot[] = [
  {
    id: "r1",
    name: "AquaBot-01",
    model: "AB-X200",
    serial: "SN-0001-AQ",
    status: "mission",
    battery: 87,
    signal: 92,
    position: { x: 32, y: 56 },
    heading: 70,
    speed: 2.4,
    color: ROBOT_COLORS.cyan,
    samplesPerTrip: 12,
    waypoints: [
      { x: 32, y: 56 },
      { x: 42, y: 52 },
      { x: 52, y: 49 },
      { x: 60, y: 46 },
      { x: 50, y: 52 },
      { x: 38, y: 58 },
    ],
    waypointIdx: 1,
    trail: [],
    batteryHistory: Array.from({ length: 20 }, (_, i) => 87 + Math.sin(i / 3) * 0.4),
  },
  {
    id: "r2",
    name: "EcoStream-02",
    model: "ES-Pro",
    serial: "SN-0002-ES",
    status: "offline",
    battery: 14,
    signal: 0,
    position: { x: 70, y: 42 },
    heading: 180,
    speed: 0,
    color: ROBOT_COLORS.lime,
    lastSeen: "2 часа назад",
    samplesPerTrip: 8,
    waypoints: [
      { x: 70, y: 42 },
      { x: 76, y: 38 },
      { x: 82, y: 34 },
      { x: 76, y: 40 },
    ],
    waypointIdx: 0,
    trail: [],
    batteryHistory: Array.from({ length: 20 }, () => 14),
  },
  {
    id: "r3",
    name: "HydroScan-03",
    model: "HS-Lite",
    serial: "SN-0003-HS",
    status: "online",
    battery: 64,
    signal: 78,
    position: { x: 55, y: 48 },
    heading: 250,
    speed: 1.9,
    color: ROBOT_COLORS.amber,
    samplesPerTrip: 15,
    waypoints: [
      { x: 55, y: 48 },
      { x: 48, y: 52 },
      { x: 40, y: 55 },
      { x: 35, y: 58 },
      { x: 45, y: 53 },
    ],
    waypointIdx: 1,
    trail: [],
    batteryHistory: Array.from({ length: 20 }, (_, i) => 64 + Math.cos(i / 4) * 0.6),
  },
];

const seed = (i: number) => Math.sin(i * 9301 + 49297) * 233280;
const rand = (i: number) => Math.abs(seed(i) - Math.floor(seed(i)));

// Sample positions follow the reservoir's diagonal water corridor.
// The lake polygon (in MapView) runs roughly SW (8,68) → NE (86,33).
// We parametrize a centerline and add a narrow lateral jitter so all points stay inside the water.
function pointOnLake(t: number, lateral: number) {
  // centerline (matches the path in MapView roughly)
  const cx = 14 + t * 70; // 14 → 84
  const cy = 64 - t * 26 - Math.sin(t * Math.PI) * 2; // 64 → 38, slight bow
  // perpendicular to centerline (approx): direction (70, -26) → normal (26, 70) normalized
  const nLen = Math.hypot(26, 70);
  const nx = 26 / nLen;
  const ny = 70 / nLen;
  // narrower at the ends, wider in the middle
  const halfWidth = 2.2 + Math.sin(t * Math.PI) * 2.3;
  const off = lateral * halfWidth;
  return { x: +(cx + nx * off).toFixed(2), y: +(cy + ny * off).toFixed(2) };
}

export const initialSamples: Sample[] = Array.from({ length: 32 }, (_, i) => {
  const robotIdx = i % 3;
  const robot = initialRobots[robotIdx];
  const t = rand(i + 1);
  const lateral = (rand(i + 7) - 0.5) * 2; // -1..1
  const tds = Math.round(180 + rand(i + 31) * 400);
  return {
    id: `s${i + 1}`,
    robotId: robot.id,
    position: pointOnLake(t, lateral),
    date: new Date(Date.now() - i * 3600_000 * 4).toISOString(),
    ph: +(6.5 + rand(i + 11) * 2).toFixed(2),
    oxygen: +(5 + rand(i + 13) * 6).toFixed(2),
    turbidity: +(1 + rand(i + 17) * 9).toFixed(2),
    temperature: +(12 + rand(i + 19) * 14).toFixed(1),
    tds,
    conductivity: Math.round(tds * 1.55),
    microplastics: Math.round(rand(i + 37) * 18),
    depth: +(1.2 + rand(i + 23) * 18).toFixed(1),
    pollution: +(8 + rand(i + 29) * 70).toFixed(0),
  };
});

export const trendData = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}.05`,
  ph: +(7 + Math.sin(i / 2) * 0.6).toFixed(2),
  oxygen: +(8 + Math.cos(i / 3) * 1.5).toFixed(2),
  turbidity: +(4 + Math.sin(i / 1.5) * 2.5).toFixed(2),
  temperature: +(16 + Math.sin(i / 4) * 4).toFixed(1),
}));

export const RESERVOIR = {
  name: "Капшагайское водохранилище",
  river: "р. Или",
  lat: "43.8800° N",
  lon: "77.0700° E",
};

export const MAP_LANDMARKS = [
  { id: "dam", label: "Плотина ГЭС", x: 18, y: 62, kind: "infra" as const },
  { id: "base", label: "База USV", x: 24, y: 60, kind: "base" as const },
  { id: "bay", label: "Залив Тас-Откель", x: 48, y: 38, kind: "place" as const },
  { id: "mouth", label: "Устье р. Или", x: 88, y: 30, kind: "place" as const },
  { id: "kapsh", label: "г. Капшагай", x: 14, y: 70, kind: "city" as const },
];
