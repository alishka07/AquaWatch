import assert from "node:assert/strict";
import test from "node:test";
import { advanceRobotSimulation as tick, BASE_POSITION } from "../src/components/app/simulation.ts";

function robot(overrides = {}) {
  return {
    id: "test-robot", name: "Demo robot", model: "Test", serial: "TEST-001",
    status: "online", battery: 80, signal: 90, position: { x: 10, y: 10 },
    heading: 0, speed: 0, color: "#335e57", samplesPerTrip: 3,
    waypoints: [{ x: 12, y: 10 }, { x: 14, y: 10 }], waypointIdx: 0,
    trail: [], batteryHistory: [], ...overrides,
  };
}

function advance(value, ticks) {
  for (let i = 0; i < ticks; i += 1) value = tick(value);
  return value;
}

test("an idle robot keeps its position, battery, and identity", () => {
  const initial = robot();
  assert.equal(advance(initial, 100), initial);
  const staleSpeed = robot({ speed: 2 });
  const idle = tick(staleSpeed);
  assert.equal(idle.speed, 0);
  assert.deepEqual(idle.position, staleSpeed.position);
  assert.equal(idle.battery, staleSpeed.battery);
});

test("offline never reconnects or starts moving by itself", () => {
  const initial = robot({ status: "offline", signal: 0 });
  assert.equal(advance(initial, 1000), initial);
});

test("a mission moves from its actual position towards the first waypoint", () => {
  const initial = robot({ status: "mission" });
  const next = tick(initial);
  assert.deepEqual(next.position, { x: 11.2, y: 10 });
  assert.equal(next.waypointIdx, 0);
  assert.equal(next.status, "mission");
  assert.ok(next.battery < initial.battery);
  assert.equal(next.speed, 1.8);
});

test("mission visits waypoints in order and stops permanently at the last one", () => {
  const initial = robot({ status: "mission" });
  const firstWaypoint = advance(initial, 2);
  assert.deepEqual(firstWaypoint.position, initial.waypoints[0]);
  assert.equal(firstWaypoint.waypointIdx, 1);
  assert.equal(firstWaypoint.status, "mission");
  const finished = advance(firstWaypoint, 2);
  assert.deepEqual(finished.position, initial.waypoints[1]);
  assert.equal(finished.waypointIdx, initial.waypoints.length);
  assert.equal(finished.status, "online");
  assert.equal(finished.speed, 0);
  assert.equal(advance(finished, 100), finished);
});

test("a waypoint at the current position advances without dividing by zero", () => {
  const initial = robot({ status: "mission", waypoints: [{ x: 10, y: 10 }] });
  const finished = tick(initial);
  assert.deepEqual(finished.position, initial.position);
  assert.equal(finished.heading, initial.heading);
  assert.equal(finished.status, "online");
  assert.equal(finished.waypointIdx, 1);
});

test("RTL returns to the base instead of following the mission waypoints", () => {
  const initial = robot({ status: "rtl", position: { x: 25, y: 60 }, waypoints: [{ x: 90, y: 10 }] });
  const finished = tick(initial);
  assert.deepEqual(finished.position, BASE_POSITION);
  assert.equal(finished.status, "online");
  assert.equal(finished.speed, 0);
  assert.equal(advance(finished, 10), finished);
});

test("RTL also works when no route is assigned", () => {
  const returned = advance(robot({ status: "rtl", waypoints: [] }), 100);
  assert.deepEqual(returned.position, BASE_POSITION);
  assert.equal(returned.status, "online");
});

test("an empty or exhausted mission route safely stops", () => {
  for (const initial of [robot({ status: "mission", waypoints: [] }), robot({ status: "mission", waypointIdx: 2 })]) {
    const stopped = tick(initial);
    assert.equal(stopped.status, "online");
    assert.equal(stopped.speed, 0);
    assert.deepEqual(stopped.position, initial.position);
    assert.equal(stopped.waypointIdx, initial.waypoints.length);
  }
});

test("zero battery stops every state without changing the position", () => {
  for (const status of ["online", "offline", "mission", "rtl"]) {
    const initial = robot({ status, battery: 0, speed: 2 });
    const stopped = tick(initial);
    assert.equal(stopped.battery, 0);
    assert.equal(stopped.status, "offline");
    assert.equal(stopped.signal, 0);
    assert.equal(stopped.speed, 0);
    assert.deepEqual(stopped.position, initial.position);
    assert.equal(tick(stopped), stopped);
  }
});

test("battery depletion during a tick stops future movement", () => {
  const exhausted = tick(robot({ status: "mission", battery: 0.01 }));
  assert.equal(exhausted.battery, 0);
  assert.equal(exhausted.status, "offline");
  assert.equal(exhausted.speed, 0);
  assert.equal(exhausted.signal, 0);
  assert.equal(advance(exhausted, 100), exhausted);
});

test("ticks do not mutate the source robot and histories stay bounded", () => {
  const initial = robot({ status: "mission", trail: Array.from({ length: 28 }, () => ({ x: 9, y: 10 })), batteryHistory: Array(30).fill(80) });
  const before = structuredClone(initial);
  const next = tick(initial);
  assert.deepEqual(initial, before);
  assert.equal(next.trail.length, 28);
  assert.equal(next.batteryHistory.length, 30);
  assert.deepEqual(next.trail.at(-1), initial.position);
  assert.equal(next.batteryHistory.at(-1), next.battery);
});
