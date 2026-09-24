export type Robot = {
  id: string;
  name: string;
  model: string;
  serial: string;
  status: "online" | "offline" | "rtl" | "mission";
  battery: number;
  signal: number;
  position: { x: number; y: number };
  heading: number; // degrees
  speed: number; // m/s
  color: string; // oklch token expression
  lastSeen?: string;
  samplesPerTrip: number;
  waypoints: { x: number; y: number }[];
  waypointIdx: number;
  trail: { x: number; y: number }[];
  batteryHistory: number[];
};

export type Sample = {
  id: string;
  robotId: string;
  position: { x: number; y: number };
  date: string;
  ph: number;
  oxygen: number;
  turbidity: number;
  temperature: number;
  tds: number;
  conductivity: number;
  microplastics: number;
  depth: number; // meters
  pollution: number; // 0..100 index
};

export type EventSeverity = "success" | "danger" | "warning" | "critical";
export type EventType =
  | "connected"
  | "disconnected"
  | "low_battery"
  | "rtl"
  | "estop"
  | "mission_start"
  | "mission_done"
  | "mission_cancel"
  | "manual_start"
  | "sample"
  | "maintenance";

export type Thresholds = {
  ph: { min: number; max: number; warnMin: number; warnMax: number };
  oxygen: { critical: number; warn: number };
  turbidity: { warn: number; critical: number };
  temperature: { warn: number };
  pollution: { ok: number; warn: number; danger: number };
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  ph: { min: 6.5, max: 8.5, warnMin: 6.8, warnMax: 8.2 },
  oxygen: { critical: 4, warn: 6 },
  turbidity: { warn: 5, critical: 8 },
  temperature: { warn: 24 },
  pollution: { ok: 20, warn: 45, danger: 70 },
};

export type EventLogEntry = {
  id: string;
  ts: number; // epoch ms
  robotId: string;
  robotName: string;
  type: EventType;
  severity: EventSeverity;
  message: string;
};
