import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  X,
  Battery,
  Signal,
  MapPin,
  OctagonAlert,
  Home,
  Bot,
  Gauge,
  Navigation2,
  Target,
  Pencil,
  Trash2,
  Play,
  Route,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import type { Robot, EventType, EventLogEntry } from "./types";
import { BASE_POSITION, DEMO_ROUTE } from "./simulation";

const toGps = (w: { x: number; y: number }) => ({
  lat: +(43.88 + (w.y - 50) * 0.0015).toFixed(5),
  lon: +(77.07 + (w.x - 50) * 0.002).toFixed(5),
});

type Props = {
  robot: Robot;
  onClose: () => void;
  onUpdate: (r: Robot) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  draftWaypoints: { x: number; y: number }[];
  setDraftWaypoints: (wps: { x: number; y: number }[]) => void;
  logEvent?: (robot: Robot, type: EventType, extra?: string) => EventLogEntry;
};

export function RobotPanel({
  robot,
  onClose,
  onUpdate,
  editMode,
  setEditMode,
  draftWaypoints,
  setDraftWaypoints,
  logEvent,
}: Props) {
  const [estopOpen, setEstopOpen] = useState(false);
  const [rtlOpen, setRtlOpen] = useState(false);
  const [sampleCount, setSampleCount] = useState(String(robot.samplesPerTrip));
  useEffect(() => {
    setSampleCount(String(robot.samplesPerTrip));
  }, [robot.id, robot.samplesPerTrip]);
  const parsedCount = Number(sampleCount);
  const validCount =
    sampleCount.trim() !== "" &&
    Number.isInteger(parsedCount) &&
    parsedCount >= 1 &&
    parsedCount <= 100;
  const unavailable = robot.status === "offline" || robot.battery <= 0;
  const startReason =
    robot.battery <= 0
      ? "Для запуска нужен заряд батареи."
      : robot.status === "offline"
        ? "Робот не в сети. Выберите доступный аппарат."
        : !validCount
          ? "Укажите целое число проб от 1 до 100."
          : draftWaypoints.length < 2
            ? "Добавьте минимум две точки или используйте готовый маршрут."
            : "";

  const emergency = () => {
    const updated: Robot = {
      ...robot,
      status: "offline",
      signal: 0,
      speed: 0,
      lastSeen: "только что",
    };
    onUpdate(updated);
    logEvent?.(updated, "estop", "локальная демосимуляция · остановка оператором");
    toast.success("Демонстрационный робот остановлен", {
      description: `${robot.name}: движение в симуляции прекращено.`,
    });
    setEstopOpen(false);
  };
  const rtl = () => {
    if (unavailable) return;
    const updated: Robot = {
      ...robot,
      status: "rtl",
      waypoints: [{ ...BASE_POSITION }],
      waypointIdx: 0,
      speed: 1.8,
    };
    onUpdate(updated);
    toast.success("Возврат на базу запущен", {
      description: `${robot.name} движется к базе на схеме.`,
    });
    setRtlOpen(false);
    setEditMode(false);
  };
  const launchRoute = () => {
    if (startReason) return;
    onUpdate({
      ...robot,
      status: "mission",
      waypoints: draftWaypoints.map((point) => ({ ...point })),
      waypointIdx: 0,
      trail: [],
      speed: 1.8,
      samplesPerTrip: parsedCount,
    });
    toast.success("Демомаршрут запущен", {
      description: `${robot.name} последовательно пройдёт ${draftWaypoints.length} точки в локальной симуляции.`,
    });
    setEditMode(false);
  };
  const preset = () => {
    setDraftWaypoints(DEMO_ROUTE.map((point) => ({ ...point })));
    setEditMode(true);
  };
  const sparkData = robot.batteryHistory.map((v, i) => ({ i, v }));
  const gps = toGps(robot.position);
  const statusLabel =
    robot.status === "online"
      ? "Готов к работе"
      : robot.status === "mission"
        ? "На маршруте"
        : robot.status === "rtl"
          ? "Возвращается на базу"
          : "Не в сети";

  return (
    <aside
      className="robot-control-panel min-w-0 w-full flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
      aria-label={`Управление ${robot.name}`}
    >
      <div
        className="p-4 border-b border-border flex items-center justify-between gap-2"
        style={{ background: "#edf0e9" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-full bg-white/70">
            <Bot className="size-5" style={{ color: robot.color }} />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold leading-tight truncate">{robot.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {robot.model} · {robot.serial}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onClose}
          aria-label="Закрыть управление роботом"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span
              className="size-1.5 rounded-full"
              style={{ background: robot.status === "offline" ? "#8b8e84" : robot.color }}
            />
            {statusLabel}
          </Badge>
          <span className="text-xs text-muted-foreground">Деморежим</span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Команды изменяют локальную симуляцию. Подключение к реальному аппарату не настроено.
        </p>
        <div className="rounded-xl bg-panel/50 border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Battery className="size-3.5" />
              Заряд батареи
            </div>
            <div className="font-semibold text-lg tabular-nums">{robot.battery.toFixed(1)}%</div>
          </div>
          <div className="h-10 mt-1" role="img" aria-label="История заряда батареи в симуляции">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${robot.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={robot.color} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={robot.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  dataKey="v"
                  stroke={robot.color}
                  strokeWidth={1.5}
                  fill={`url(#spark-${robot.id})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Progress value={robot.battery} className="h-1 mt-1" aria-label="Заряд батареи" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Tile icon={Signal} label="Сигнал" value={`${robot.signal.toFixed(0)}%`} />
          <Tile icon={Gauge} label="Скорость" value={`${robot.speed.toFixed(1)} м/с`} />
          <Tile
            icon={Navigation2}
            label="Курс"
            value={`${((robot.heading + 360) % 360).toFixed(0)}°`}
          />
        </div>
        <div className="rounded-xl bg-panel/50 border border-border p-3 text-xs">
          <div className="flex items-center justify-between text-muted-foreground gap-2">
            <span className="flex items-center gap-1">
              <Target className="size-3" />
              Условные координаты
            </span>
            <span>
              {Math.min(robot.waypointIdx + 1, robot.waypoints.length)} / {robot.waypoints.length}
            </span>
          </div>
          <p className="mt-1.5 text-foreground tabular-nums">
            {gps.lat.toFixed(5)}° N, {gps.lon.toFixed(5)}° E
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="samples-per-trip" className="text-xs text-muted-foreground">
            Количество проб за выезд
          </Label>
          <Input
            id="samples-per-trip"
            type="number"
            min={1}
            max={100}
            step={1}
            value={sampleCount}
            aria-invalid={!validCount}
            aria-describedby={!validCount ? "sample-count-error" : undefined}
            onChange={(e) => {
              const value = e.target.value;
              setSampleCount(value);
              const count = Number(value);
              if (value.trim() && Number.isInteger(count) && count >= 1 && count <= 100)
                onUpdate({ ...robot, samplesPerTrip: count });
            }}
          />
          {!validCount && (
            <p id="sample-count-error" className="text-xs text-destructive" role="alert">
              Введите целое число от 1 до 100.
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-panel/40 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="edit-mode"
              className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="size-3.5 text-primary" />
              Редактировать маршрут
            </Label>
            <Switch id="edit-mode" checked={editMode} onCheckedChange={setEditMode} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              Точки маршрута
            </span>
            <span>{draftWaypoints.length}</span>
          </div>
          {draftWaypoints.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {editMode
                ? "Нажмите на воду на схеме, чтобы добавить точки."
                : "Добавьте точки на схеме или выберите готовый маршрут."}
            </p>
          ) : (
            <ol className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {draftWaypoints.map((point, index) => {
                const g = toGps(point);
                return (
                  <li
                    key={index}
                    className="flex items-center gap-2 bg-card/60 border border-border rounded-lg px-2 py-1"
                  >
                    <span className="size-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-[11px] tabular-nums flex-1 truncate">
                      {g.lat}° N, {g.lon}° E
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      onClick={() =>
                        setDraftWaypoints(draftWaypoints.filter((_, i) => i !== index))
                      }
                      aria-label={`Удалить точку ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={preset}>
              <Route className="size-3.5" />
              Готовый маршрут
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraftWaypoints([])}
              disabled={draftWaypoints.length === 0}
              aria-label="Очистить маршрут"
            >
              <Trash2 className="size-3.5" />
              Очистить
            </Button>
          </div>
          <Button
            onClick={launchRoute}
            disabled={!!startReason}
            aria-describedby={startReason ? "route-start-reason" : undefined}
            className="w-full h-11"
          >
            <Play className="size-4" />
            Запустить демомаршрут
          </Button>
          {startReason && (
            <p id="route-start-reason" className="text-xs leading-relaxed text-muted-foreground">
              {startReason}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <AlertDialog open={rtlOpen} onOpenChange={setRtlOpen}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={unavailable || robot.status === "rtl"}
                variant="outline"
                className="w-full h-11"
              >
                <Home className="size-4" />
                Вернуть на базу
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Вернуть {robot.name} на базу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Текущий маршрут в демосимуляции будет прерван. Аппарат на схеме направится к базе.
                  Действие сохранится в локальном журнале.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={rtl}>Вернуть на базу</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog open={estopOpen} onOpenChange={setEstopOpen}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={robot.status === "offline"}
                variant="outline"
                className="w-full h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <OctagonAlert className="size-4" />
                Остановить аппарат
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Остановить {robot.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Движение демонстрационного аппарата остановится. Его статус изменится на «Не в
                  сети». Команда действует только в локальной симуляции и сохранится в журнале.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={emergency}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Остановить аппарат
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </aside>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-panel/50 border border-border p-2.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="size-3 shrink-0" />
        {label}
      </div>
      <div className="mt-1 font-semibold text-sm tabular-nums">{value}</div>
    </div>
  );
}
