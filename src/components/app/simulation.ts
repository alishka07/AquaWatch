import type { Robot } from "./types";

export const BASE_POSITION = { x: 24, y: 60 };
export const DEMO_ROUTE = [{ x: 30, y: 58 }, { x: 43, y: 54 }, { x: 57, y: 49 }];
const STEP = 1.2;

/** One deterministic demo tick. An idle or disconnected robot cannot move. */
export function advanceRobotSimulation(robot: Robot): Robot {
  if (robot.battery <= 0) {
    return robot.status === "offline" && robot.speed === 0 && robot.battery === 0 && robot.signal === 0
      ? robot
      : { ...robot, battery: 0, speed: 0, signal: 0, status: "offline" };
  }
  if (robot.status === "offline" || robot.status === "online") {
    return robot.speed === 0 ? robot : { ...robot, speed: 0 };
  }

  const index = Math.max(0, Math.floor(robot.waypointIdx));
  const target = robot.status === "rtl" ? BASE_POSITION : robot.waypoints[index];
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
    return { ...robot, status: "online", speed: 0, waypointIdx: robot.waypoints.length };
  }

  const dx = target.x - robot.position.x;
  const dy = target.y - robot.position.y;
  const distance = Math.hypot(dx, dy);
  const arrived = distance <= STEP;
  const position = arrived
    ? { ...target }
    : { x: robot.position.x + (dx / distance) * STEP, y: robot.position.y + (dy / distance) * STEP };
  const waypointIdx = arrived && robot.status === "mission" ? index + 1 : index;
  const finished = arrived && (robot.status === "rtl" || waypointIdx >= robot.waypoints.length);
  const battery = Math.max(0, +(robot.battery - (robot.status === "rtl" ? 0.12 : 0.22)).toFixed(2));

  return {
    ...robot,
    position,
    waypointIdx,
    heading: distance > 0 ? (Math.atan2(dy, dx) * 180) / Math.PI : robot.heading,
    trail: [...robot.trail, robot.position].slice(-28),
    battery,
    batteryHistory: [...robot.batteryHistory, battery].slice(-30),
    status: battery === 0 ? "offline" : finished ? "online" : robot.status,
    speed: battery === 0 || finished ? 0 : 1.8,
    signal: battery === 0 ? 0 : robot.signal,
  };
}
