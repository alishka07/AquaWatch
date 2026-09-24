import { useState } from "react";
import { Battery, Signal, Navigation, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadBlob } from "./report";
import type { Robot, EventLogEntry } from "./types";

export const STATUS: Record<Robot["status"], string> = {
  online: "Готов к работе",
  mission: "На маршруте",
  rtl: "Возвращается",
  offline: "Нет связи",
};
export function DeviceStatus({ robot }: { robot: Robot }) {
  return (
    <span
      className={`status-pill ${robot.status === "offline" ? "is-offline" : robot.status === "rtl" ? "is-warning" : ""}`}
    >
      <span aria-hidden="true">●</span> {STATUS[robot.status]}
    </span>
  );
}
export function FleetView({
  robots,
  onSelect,
  onHistory,
  onManual,
}: {
  robots: Robot[];
  onSelect: (r: Robot) => void;
  onHistory: (r: Robot) => void;
  onManual: (r: Robot) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = robots.filter(
    (r) =>
      `${r.name} ${r.model} ${r.serial}`.toLowerCase().includes(query.toLowerCase()) &&
      (status === "all" || r.status === status),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Поиск аппарата"
            placeholder="Название, модель или серийный номер"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          className="app-select"
          aria-label="Статус аппарата"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Все статусы</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="device-overview-grid">
        {filtered.map((r) => (
          <article key={r.id} className="device-overview-card">
            <div className="flex justify-between gap-2 items-start">
              <div>
                <h2 className="text-lg font-semibold">{r.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.model} · {r.serial}
                </p>
              </div>
              <DeviceStatus robot={r} />
            </div>
            <div className="fleet-vessel">
              <img
                src="/images/subulaq-product-v2.png"
                alt="Визуализация концепции аппарата SuBulaq"
              />
              <span>Концепция SuBulaq</span>
            </div>
            <div className="grid grid-cols-2 gap-5 py-4">
              <div>
                <p className="flex gap-2 text-sm items-center">
                  <Battery className="size-4" />
                  Батарея <strong className="ml-auto">{r.battery.toFixed(0)}%</strong>
                </p>
                <Progress value={r.battery} className="h-1 mt-3" />
              </div>
              <div>
                <p className="flex gap-2 text-sm items-center">
                  <Signal className="size-4" />
                  Сигнал <strong className="ml-auto">{r.signal.toFixed(0)}%</strong>
                </p>
                <Progress value={r.signal} className="h-1 mt-3" />
              </div>
            </div>
            <div className="flex justify-between text-sm py-3 border-t">
              <span className="text-muted-foreground">План отбора</span>
              <span>{r.samplesPerTrip} проб / выезд</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onSelect(r)}>
                <Navigation className="size-4" />
                Управление
              </Button>
              <Button variant="outline" onClick={() => onHistory(r)}>
                История
              </Button>
              <Button variant="ghost" onClick={() => onManual(r)}>
                FPV
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">Аппараты не найдены. Измените поиск или фильтр.</div>
      )}
    </div>
  );
}
const SEVERITY = {
  success: "Информация",
  warning: "Внимание",
  danger: "Ошибка",
  critical: "Критично",
};
export function EventLog({
  robots,
  log,
  initialRobot = "all",
  readAt,
  onRead,
}: {
  robots: Robot[];
  log: EventLogEntry[];
  initialRobot?: string;
  readAt: number;
  onRead: () => void;
}) {
  const [robot, setRobot] = useState(initialRobot);
  const [severity, setSeverity] = useState("all");
  const [date, setDate] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const filtered = log.filter(
    (e) =>
      (robot === "all" || e.robotId === robot) &&
      (severity === "all" || e.severity === severity) &&
      (!date || new Date(e.ts).toLocaleDateString("en-CA") === date) &&
      (!onlyUnread || e.ts > readAt),
  );
  return (
    <section className="workspace-section">
      <div className="section-heading">
        <div>
          <h2>События и уведомления</h2>
          <p>Команды, миссии и состояние демонстрационного флота.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={onRead}>
            Прочитать все
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadBlob(
                "subulaq-demo-events.json",
                "application/json",
                JSON.stringify({ mode: "demo", events: filtered }, null, 2),
              )
            }
            disabled={!filtered.length}
          >
            <Download className="size-4" />
            Экспорт
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 py-4">
        <select
          aria-label="Устройство в журнале"
          className="app-select"
          value={robot}
          onChange={(e) => setRobot(e.target.value)}
        >
          <option value="all">Все аппараты</option>
          {robots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Уровень события"
          className="app-select"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="all">Все события</option>
          {Object.entries(SEVERITY).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Input
          aria-label="Дата событий"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
        />
        <label className="flex gap-2 items-center text-sm">
          <input
            type="checkbox"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
          />
          Непрочитанные
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setDate("");
            setRobot("all");
            setSeverity("all");
            setOnlyUnread(false);
          }}
        >
          Сбросить
        </Button>
      </div>
      <div className="event-list">
        {filtered.map((e) => (
          <article key={e.id} className="event-row">
            <span className={`event-dot tone-${e.severity}`} aria-label={SEVERITY[e.severity]} />
            <div>
              <p className="font-medium text-sm">
                {e.message} {e.ts > readAt && <span className="text-xs text-primary">· новое</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {e.robotName} · {SEVERITY[e.severity]}
              </p>
            </div>
            <time className="text-xs text-muted-foreground" dateTime={new Date(e.ts).toISOString()}>
              {new Date(e.ts).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </article>
        ))}
      </div>
      {!filtered.length && <div className="empty-state">Нет событий для выбранных фильтров.</div>}
    </section>
  );
}
