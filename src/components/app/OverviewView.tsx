import { ArrowUpRight, Navigation, FlaskConical, Radio, Route, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeviceStatus } from "./FleetView";
import type { AppView } from "./AppSidebar";
import type { Robot, Sample, EventLogEntry } from "./types";
export function OverviewView({
  robots,
  samples,
  log,
  onNavigate,
  onSelect,
  onInspectParticles,
}: {
  robots: Robot[];
  samples: Sample[];
  log: EventLogEntry[];
  onNavigate: (view: AppView) => void;
  onSelect: (r: Robot) => void;
  onInspectParticles: () => void;
}) {
  const latest = samples[0];
  const metrics = [
    { key: "ph", label: "Кислотность", unit: "pH", value: latest?.ph },
    { key: "turbidity", label: "Мутность", unit: "NTU", value: latest?.turbidity },
    { key: "temperature", label: "Температура", unit: "°C", value: latest?.temperature },
    { key: "tds", label: "Минерализация", unit: "мг/л", value: latest?.tds },
    { key: "conductivity", label: "Проводимость", unit: "мкСм/см", value: latest?.conductivity },
    { key: "microplastics", label: "Микрочастицы", unit: "част/л", value: latest?.microplastics },
  ];
  return (
    <div className="space-y-7">
      <section className="overview-hero">
        <div>
          <span className="hero-context">SuBulaq / наблюдение за водой</span>
          <h2>
            Водоём.
            <br />В поле зрения.
          </h2>
          <p>
            Планируйте маршрут, следите за аппаратами
            <br className="hidden md:block" /> и исследуйте каждое измерение.
          </p>
          <Button onClick={() => onNavigate("map")}>
            Открыть карту <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <span className="hero-caption">
          Капшагайское водохранилище
          <br />
          Визуализация концепции
        </span>
      </section>
      <div className="metric-strip">
        {[
          {
            label: "Аппаратов на связи",
            value: `${robots.filter((r) => r.status !== "offline").length} / ${robots.length}`,
            icon: Radio,
          },
          {
            label: "Активных миссий",
            value: robots.filter((r) => r.status === "mission").length,
            icon: Route,
          },
          { label: "Измерений в архиве", value: samples.length, icon: FlaskConical },
          { label: "Событий в журнале", value: log.length, icon: Bell },
        ].map((m) => (
          <div className="metric-item" key={m.label}>
            <div className="flex justify-between text-muted-foreground">
              <span>{m.label}</span>
              <m.icon className="size-4" />
            </div>
            <strong>{m.value}</strong>
          </div>
        ))}
      </div>
      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Что происходит на воде</h2>
            <p>
              Последняя демонстрационная проба{" "}
              {latest
                ? `· ${new Date(latest.date).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`
                : "ещё не получена"}
            </p>
          </div>
          <Button variant="ghost" onClick={() => onNavigate("analytics")}>
            Все измерения <ArrowUpRight className="size-4" />
          </Button>
        </div>
        <div className="water-metrics">
          {metrics.map((m) => (
            <button
              className="water-metric"
              key={m.key}
              onClick={() =>
                m.key === "microplastics" ? onInspectParticles() : onNavigate("analytics")
              }
            >
              <span>
                {m.label}
                <ArrowUpRight className="size-3.5" />
              </span>
              <strong>
                {m.value ?? "—"}
                <small>{m.unit}</small>
              </strong>
              <span className="metric-note">
                {m.key === "microplastics" ? "Демонстрация скрининга" : "Посмотреть динамику"}
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="overview-lower">
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Флот на сегодня</h2>
              <p>Миссии и готовность к следующему выходу.</p>
            </div>
            <Button variant="ghost" onClick={() => onNavigate("devices")}>
              Весь флот
            </Button>
          </div>
          <div className="mission-list">
            {robots.slice(0, 4).map((r) => (
              <button key={r.id} onClick={() => onSelect(r)} className="fleet-row">
                <span className="vessel-icon">
                  <Navigation className="size-5" />
                </span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.model} · заряд {r.battery.toFixed(0)}%
                  </small>
                </div>
                <DeviceStatus robot={r} />
                <ArrowUpRight className="size-4" />
              </button>
            ))}
          </div>
        </section>
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Последние события</h2>
              <p>Демонстрационный журнал работы.</p>
            </div>
          </div>
          <div className="event-list">
            {log.slice(0, 3).map((e) => (
              <div className="event-row" key={e.id}>
                <span className={`event-dot tone-${e.severity}`} />
                <div>
                  <p className="text-sm">{e.message}</p>
                  <small className="text-muted-foreground">{e.robotName}</small>
                </div>
              </div>
            ))}
          </div>
          <Button variant="ghost" className="mt-3" onClick={() => onNavigate("journal")}>
            Открыть журнал <ArrowUpRight className="size-4" />
          </Button>
        </section>
      </div>
    </div>
  );
}
