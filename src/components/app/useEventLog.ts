import { useEffect, useRef, useCallback } from "react";
import { usePersistentState } from "./usePersistentState";
import type { Robot, EventLogEntry, EventType, EventSeverity } from "./types";

const SEV: Record<EventType, EventSeverity> = {
  connected: "success",
  disconnected: "danger",
  low_battery: "warning",
  rtl: "critical",
  estop: "critical",
  mission_start: "success",
  mission_done: "success",
  mission_cancel: "warning",
  manual_start: "warning",
  sample: "success",
  maintenance: "success",
};

const LABEL: Record<EventType, string> = {
  connected: "Подключение к сети",
  disconnected: "Потеря связи",
  low_battery: "Низкий заряд батареи",
  rtl: "Аварийный возврат на базу (RTL)",
  estop: "АВАРИЙНАЯ ОСТАНОВКА (ESTOP)",
  mission_start: "Запуск миссии",
  mission_done: "Миссия завершена",
  mission_cancel: "Миссия прервана",
  manual_start: "Ручное управление в деморежиме",
  sample: "Демонстрационная проба добавлена",
  maintenance: "Запись обслуживания",
};

function seed(robots: Robot[]): EventLogEntry[] {
  const now = Date.now();
  const seeds: { type: EventType; offsetMin: number; robotIdx: number; extra?: string }[] = [
    { type: "connected", offsetMin: 240, robotIdx: 0 },
    { type: "mission_start", offsetMin: 220, robotIdx: 0, extra: "маршрут M-26-05-17 · 6 точек" },
    { type: "connected", offsetMin: 180, robotIdx: 2 },
    { type: "low_battery", offsetMin: 130, robotIdx: 1, extra: "18%" },
    { type: "disconnected", offsetMin: 120, robotIdx: 1 },
    { type: "rtl", offsetMin: 60, robotIdx: 2, extra: "сигнал < 40%" },
    { type: "mission_done", offsetMin: 18, robotIdx: 0 },
  ];
  return seeds
    .map((s, i) => {
      const r = robots[s.robotIdx] ?? robots[0];
      return {
        id: `seed-${i}`,
        ts: now - s.offsetMin * 60_000,
        robotId: r.id,
        robotName: r.name,
        type: s.type,
        severity: SEV[s.type],
        message: s.extra ? `${LABEL[s.type]} · ${s.extra}` : LABEL[s.type],
      };
    })
    .reverse();
}

export function useEventLog(robots: Robot[], fleetReady = true) {
  const [log, setLog, ready] = usePersistentState<EventLogEntry[]>(
    "aquawatch.events.v2",
    seed(robots),
    (v): v is EventLogEntry[] =>
      Array.isArray(v) &&
      v.every(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.ts === "number" &&
          Number.isFinite(new Date(e.ts).getTime()) &&
          typeof e.message === "string" &&
          e.type in SEV &&
          ["success", "danger", "warning", "critical"].includes(e.severity),
      ),
  );
  const prevRef = useRef<Map<string, Robot>>(new Map(robots.map((r) => [r.id, r])));
  const counterRef = useRef(0);
  const observing = useRef(false);

  const push = useCallback(
    (robot: Robot, type: EventType, extra?: string) => {
      counterRef.current += 1;
      const entry: EventLogEntry = {
        id: `evt-${Date.now()}-${counterRef.current}`,
        ts: Date.now(),
        robotId: robot.id,
        robotName: robot.name,
        type,
        severity: SEV[type],
        message: extra ? `${LABEL[type]} · ${extra}` : LABEL[type],
      };
      setLog((l) => [entry, ...l].slice(0, 250));
      return entry;
    },
    [setLog],
  );

  useEffect(() => {
    if (!ready || !fleetReady) return;
    if (!observing.current) {
      prevRef.current = new Map(robots.map((r) => [r.id, r]));
      observing.current = true;
      return;
    }
    const prev = prevRef.current;
    robots.forEach((r) => {
      const p = prev.get(r.id);
      if (!p) {
        push(r, "connected", "добавлен в демофлот");
        prev.set(r.id, r);
        return;
      }
      // status transitions
      if (p.status !== r.status) {
        if (r.status === "offline") push(r, "disconnected");
        else if (p.status === "offline" && (r.status === "online" || r.status === "mission"))
          push(r, "connected");
        if (r.status === "rtl" && p.status !== "rtl") push(r, "rtl");
        if (r.status === "mission" && p.status !== "mission")
          push(r, "mission_start", `маршрут ${r.waypoints.length} точек`);
        if (p.status === "mission" && r.status !== "mission")
          push(
            r,
            r.status === "online" && r.waypointIdx >= r.waypoints.length
              ? "mission_done"
              : "mission_cancel",
          );
      }
      // low battery edge
      if (p.battery >= 20 && r.battery < 20 && r.status !== "offline") {
        push(r, "low_battery", `${r.battery.toFixed(0)}%`);
      }
      prev.set(r.id, r);
    });
  }, [robots, push, ready, fleetReady]);

  return { log, push };
}

export const EVENT_LABEL = LABEL;
