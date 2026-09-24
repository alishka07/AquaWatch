import type { Robot, Sample } from "./types";
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const point = (v: unknown) =>
  object(v) && finite(v.x) && finite(v.y) && v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 100;
export function validRobots(v: unknown): v is Robot[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 100 &&
    new Set(v.map((r) => r?.id)).size === v.length &&
    v.every(
      (r) =>
        object(r) &&
        ["id", "name", "model", "serial", "color"].every((k) => typeof r[k] === "string") &&
        ["online", "offline", "mission", "rtl"].includes(String(r.status)) &&
        ["battery", "signal", "heading", "speed", "samplesPerTrip", "waypointIdx"].every((k) =>
          finite(r[k]),
        ) &&
        point(r.position) &&
        Array.isArray(r.waypoints) &&
        r.waypoints.every(point) &&
        Array.isArray(r.trail) &&
        r.trail.every(point) &&
        Array.isArray(r.batteryHistory) &&
        r.batteryHistory.every(finite),
    )
  );
}
export function validSamples(v: unknown): v is Sample[] {
  return (
    Array.isArray(v) &&
    v.length <= 1000 &&
    v.every(
      (s) =>
        object(s) &&
        typeof s.id === "string" &&
        typeof s.robotId === "string" &&
        typeof s.date === "string" &&
        Number.isFinite(Date.parse(s.date)) &&
        point(s.position) &&
        [
          "ph",
          "oxygen",
          "turbidity",
          "temperature",
          "tds",
          "conductivity",
          "microplastics",
          "depth",
          "pollution",
        ].every((k) => finite(s[k])),
    )
  );
}
