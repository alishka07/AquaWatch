import { useState } from "react";
import {
  Play,
  Pause,
  MapPin,
  ArrowUpRight,
  Check,
  FlaskConical,
  Wrench,
  Save,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DeviceStatus } from "./FleetView";
import { usePersistentState } from "./usePersistentState";
import type { Robot, EventLogEntry } from "./types";

export function RobotPicker({
  robots,
  value,
  onChange,
}: {
  robots: Robot[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">Аппарат</span>
      <select
        className="app-select"
        aria-label="Выбрать аппарат"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {robots.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function MissionsView({
  robots,
  log,
  selectedId,
  onPick,
  onUpdate,
  onMap,
}: {
  robots: Robot[];
  log: EventLogEntry[];
  selectedId: string;
  onPick: (id: string) => void;
  onUpdate: (r: Robot) => void;
  onMap: (r: Robot) => void;
}) {
  const r = robots.find((r) => r.id === selectedId) ?? robots[0];
  if (!r) return <div className="empty-state">Добавьте аппарат, чтобы спланировать миссию.</div>;
  const completed = Math.min(r.waypointIdx, r.waypoints.length);
  const percent = r.waypoints.length ? Math.round((completed / r.waypoints.length) * 100) : 0;
  return (
    <div className="space-y-5">
      <RobotPicker robots={robots} value={r.id} onChange={onPick} />
      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Маршрут · {r.name}</h2>
            <p>План точек и ход демонстрационной миссии.</p>
          </div>
          <DeviceStatus robot={r} />
        </div>
        <div className="mission-progress">
          <strong>{percent}%</strong>
          <span>
            {completed} из {r.waypoints.length} точек пройдено
          </span>
        </div>
        <Progress value={percent} className="h-2 my-4" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onMap(r)}>
            <MapPin className="size-4" />
            Редактировать на карте
          </Button>
          <Button
            disabled={
              r.status === "offline" ||
              r.battery <= 0 ||
              r.status === "rtl" ||
              r.waypoints.length < 2
            }
            onClick={() => {
              onUpdate({
                ...r,
                status: r.status === "mission" ? "online" : "mission",
                speed: 0,
                waypointIdx: completed >= r.waypoints.length ? 0 : r.waypointIdx,
              });
              toast.info(
                r.status === "mission" ? "Демомиссия приостановлена" : "Демомиссия запущена",
              );
            }}
          >
            {r.status === "mission" ? (
              <>
                <Pause className="size-4" />
                Пауза
              </>
            ) : (
              <>
                <Play className="size-4" />
                {completed >= r.waypoints.length ? "Повторить маршрут" : "Продолжить маршрут"}
              </>
            )}
          </Button>
        </div>
      </section>
      <div className="overview-lower">
        <section className="workspace-section">
          <div className="section-heading">
            <h2>Точки маршрута</h2>
          </div>
          <ol className="waypoint-list">
            {r.waypoints.map((p, i) => (
              <li key={i}>
                <span className={`waypoint-number ${i < completed ? "is-done" : ""}`}>
                  {i < completed ? <Check className="size-4" /> : i + 1}
                </span>
                <div>
                  <strong>Точка {String(i + 1).padStart(2, "0")}</strong>
                  <small>
                    {(43.88 + (p.y - 50) * 0.0015).toFixed(5)}° N,{" "}
                    {(77.07 + (p.x - 50) * 0.002).toFixed(5)}° E
                  </small>
                </div>
                <span className="text-xs text-muted-foreground">
                  {i < completed
                    ? "Пройдена"
                    : i === completed && r.status === "mission"
                      ? "В пути"
                      : "В плане"}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section className="workspace-section">
          <div className="section-heading">
            <h2>История аппарата</h2>
          </div>
          <div className="event-list">
            {log
              .filter((e) => e.robotId === r.id)
              .slice(0, 10)
              .map((e) => (
                <div className="event-row" key={e.id}>
                  <span className={`event-dot tone-${e.severity}`} />
                  <div>
                    <p className="text-sm">{e.message}</p>
                    <small className="text-muted-foreground">
                      {new Date(e.ts).toLocaleString("ru-RU")}
                    </small>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

type ServiceEntry = { id: string; robotId: string; sensor: string; note: string; date: string };
type ServiceState = {
  membranes: Record<string, { used: number; replaced: string }>;
  entries: ServiceEntry[];
};
const initialService: ServiceState = { membranes: {}, entries: [] };
export function useServiceState() {
  return usePersistentState<ServiceState>(
    "aquawatch.service.v1",
    initialService,
    (v): v is ServiceState =>
      !!v &&
      typeof v === "object" &&
      "membranes" in v &&
      !!v.membranes &&
      typeof v.membranes === "object" &&
      "entries" in v &&
      Array.isArray(v.entries) &&
      v.entries.every(
        (e) =>
          e &&
          typeof e.id === "string" &&
          typeof e.robotId === "string" &&
          typeof e.sensor === "string" &&
          typeof e.note === "string" &&
          typeof e.date === "string" &&
          Number.isFinite(Date.parse(e.date)),
      ) &&
      Object.values(v.membranes).every(
        (m) =>
          m &&
          typeof m.used === "number" &&
          Number.isFinite(m.used) &&
          m.used >= 0 &&
          typeof m.replaced === "string",
      ),
  );
}
export function ServiceView({
  robots,
  selectedId,
  onPick,
  state,
  onChange,
  onLog,
}: {
  robots: Robot[];
  selectedId: string;
  onPick: (id: string) => void;
  state: ServiceState;
  onChange: (s: ServiceState) => void;
  onLog: (r: Robot, note: string) => void;
}) {
  const [sensor, setSensor] = useState("pH-электрод");
  const [note, setNote] = useState("");
  const r = robots.find((r) => r.id === selectedId) ?? robots[0];
  if (!r) return null;
  const membrane = state.membranes[r.id] ?? { used: 0, replaced: "" };
  const left = Math.max(0, 50 - membrane.used);
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    onChange({
      ...state,
      entries: [
        {
          id: crypto.randomUUID(),
          robotId: r.id,
          sensor,
          note: note.trim(),
          date: new Date().toISOString(),
        },
        ...state.entries,
      ],
    });
    onLog(r, `Калибровка: ${sensor}`);
    setNote("");
    toast.success("Запись калибровки сохранена");
  };
  return (
    <div className="space-y-5">
      <RobotPicker robots={robots} value={r.id} onChange={onPick} />
      <div className="overview-lower">
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Мембрана и отбор проб</h2>
              <p>Учебный ресурс — 50 проб на мембрану.</p>
            </div>
            <FlaskConical className="size-6 text-primary" />
          </div>
          <div className="mission-progress">
            <strong>{left * 2}%</strong>
            <span>Осталось {left} проб из 50</span>
          </div>
          <Progress value={left * 2} className="h-2 my-5" />
          <p className="text-sm text-muted-foreground mb-5">
            {membrane.replaced
              ? `Замена отмечена ${new Date(membrane.replaced).toLocaleDateString("ru-RU")}`
              : "Дата замены ещё не отмечена"}
            . Использовано {membrane.used} проб. Счётчик увеличивается при отборе в FPV.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              onChange({
                ...state,
                membranes: {
                  ...state.membranes,
                  [r.id]: { used: 0, replaced: new Date().toISOString() },
                },
              });
              onLog(r, "Замена мембраны");
              toast.success("Замена мембраны отмечена");
            }}
          >
            <Wrench className="size-4" />
            Отметить замену мембраны
          </Button>
        </section>
        <section className="workspace-section">
          <div className="section-heading">
            <div>
              <h2>Записать калибровку</h2>
              <p>Зафиксируйте выполненную проверку датчика.</p>
            </div>
          </div>
          <form onSubmit={add} className="space-y-4 mt-5">
            <label className="grid gap-2 text-sm">
              Датчик
              <select
                className="app-select"
                value={sensor}
                onChange={(e) => setSensor(e.target.value)}
              >
                {["pH-электрод", "Турбидиметр", "TDS / EC", "Термодатчик"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              Результат проверки
              <textarea
                className="app-textarea"
                required
                maxLength={500}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Раствор, отклонение и имя оператора"
              />
            </label>
            <Button type="submit">
              <Save className="size-4" />
              Сохранить калибровку
            </Button>
          </form>
        </section>
      </div>
      <section className="workspace-section">
        <div className="section-heading">
          <h2>Журнал калибровок</h2>
        </div>
        {state.entries.filter((e) => e.robotId === r.id).length ? (
          state.entries
            .filter((e) => e.robotId === r.id)
            .map((e) => (
              <div className="event-row" key={e.id}>
                <Wrench className="size-4 text-primary" />
                <div>
                  <p className="text-sm font-medium">{e.sensor}</p>
                  <p className="text-sm text-muted-foreground">{e.note}</p>
                </div>
                <time className="text-xs">{new Date(e.date).toLocaleDateString("ru-RU")}</time>
              </div>
            ))
        ) : (
          <div className="empty-state">Записей пока нет. Добавьте результат первой проверки.</div>
        )}
      </section>
    </div>
  );
}

type Profile = { name: string; email: string; organization: string; notifications: boolean };
const initialProfile: Profile = {
  name: "Оператор SuBulaq",
  email: "",
  organization: "Bulaq Robotics",
  notifications: true,
};
export function ProfileView() {
  const [profile, setProfile, ready] = usePersistentState(
    "aquawatch.profile.v1",
    initialProfile,
    (v): v is Profile =>
      !!v &&
      typeof v === "object" &&
      "name" in v &&
      typeof v.name === "string" &&
      "email" in v &&
      typeof v.email === "string" &&
      "organization" in v &&
      typeof v.organization === "string" &&
      "notifications" in v &&
      typeof v.notifications === "boolean",
  );
  if (!ready) return null;
  return <ProfileForm initial={profile} onSave={setProfile} />;
}
function ProfileForm({ initial, onSave }: { initial: Profile; onSave: (p: Profile) => void }) {
  const [draft, setDraft] = useState(initial);
  return (
    <div className="overview-lower">
      <section className="workspace-section">
        <div className="flex items-center gap-4 mb-7">
          <span className="profile-avatar">
            <UserRound className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold">Профиль оператора</h2>
            <p className="text-sm text-muted-foreground">Локальный демонстрационный профиль</p>
          </div>
        </div>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...draft, name: draft.name.trim() });
            toast.success("Профиль сохранён");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="profile-name">Имя</Label>
            <Input
              id="profile-name"
              required
              minLength={2}
              maxLength={80}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              maxLength={120}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-org">Организация</Label>
            <Input
              id="profile-org"
              maxLength={120}
              value={draft.organization}
              onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
            />
          </div>
          <Button type="submit" disabled={!draft.name.trim()}>
            <Save className="size-4" />
            Сохранить профиль
          </Button>
        </form>
      </section>
      <section className="workspace-section">
        <div className="section-heading">
          <h2>Ваше рабочее пространство</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-7 mt-4">
          AquaWatch объединяет карту, маршруты, измерения и историю обслуживания в визуальном стиле
          SuBulaq. Профиль, флот и журнал сохраняются в этом браузере.
        </p>
        <div className="mt-6 border-t pt-5 text-sm space-y-3">
          <p>
            Режим: <strong>демонстрационный</strong>
          </p>
          <p>
            Язык: <strong>Русский</strong>
          </p>
          <p>
            Часовой пояс: <strong>Казахстан, UTC+5</strong>
          </p>
        </div>
      </section>
    </div>
  );
}

export function ParticleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [showBoxes, setShowBoxes] = useState(true);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Скрининг микрочастиц</DialogTitle>
          <DialogDescription>
            Учебная визуализация CV-детекции. Кадр и классификация синтетические.
          </DialogDescription>
        </DialogHeader>
        <div className="particle-view" aria-label="Синтетический кадр микрочастиц">
          <svg viewBox="0 0 600 300" role="img" aria-label="Частицы в демонстрационной пробе">
            {Array.from({ length: 32 }, (_, i) => (
              <circle
                key={i}
                cx={25 + ((i * 73) % 550)}
                cy={20 + ((i * 47) % 260)}
                r={2 + (i % 4)}
                fill={i % 2 ? "#b9cbbf" : "#d9c7ba"}
              />
            ))}
            {showBoxes &&
              [
                { x: 78, y: 48, w: 88, h: 60, label: "PE · 0,94" },
                { x: 332, y: 98, w: 70, h: 56, label: "PP · 0,89" },
                { x: 226, y: 196, w: 90, h: 66, label: "PET · 0,93" },
              ].map((b) => (
                <g key={b.label}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} stroke="#b9cbbf" fill="none" />
                  <text x={b.x} y={b.y - 8} fill="#eef4ef" fontSize="12">
                    {b.label}
                  </text>
                </g>
              ))}
          </svg>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBoxes}
            onChange={(e) => setShowBoxes(e.target.checked)}
          />
          Показывать распознавание
        </label>
        <div className="grid grid-cols-3 gap-3">
          {["PE · 46%", "PP · 31%", "PET · 23%"].map((t) => (
            <div className="rounded-md border p-3 text-sm" key={t}>
              {t}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Показан сценарий мобильного прототипа. Определение полимеров в реальной пробе требует
          лабораторного подтверждения.
        </p>
        <Button variant="outline" onClick={onClose}>
          Вернуться к измерениям
          <ArrowUpRight className="size-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}
