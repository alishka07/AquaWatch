import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Droplets,
  Wind,
  Eye,
  Thermometer,
  Camera,
  Calendar,
  MapPin,
  Ruler,
  Biohazard,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CircleCheck,
} from "lucide-react";
import type { Sample, Thresholds } from "./types";
import { DEFAULT_THRESHOLDS } from "./types";
import { assessQuality, pollutionLabel, type QualityTone } from "./thresholds";

const ICON_FOR_SCORE = (score: number) => {
  if (score >= 80) return ShieldCheck;
  if (score >= 60) return CircleCheck;
  if (score >= 40) return ShieldAlert;
  return ShieldX;
};

const TONE: Record<QualityTone, { bg: string; text: string; border: string; bar: string }> = {
  success: {
    bg: "bg-success/15",
    text: "text-success",
    border: "border-success/30",
    bar: "bg-success",
  },
  warning: {
    bg: "bg-warning/15",
    text: "text-warning",
    border: "border-warning/30",
    bar: "bg-warning",
  },
  danger: {
    bg: "bg-destructive/15",
    text: "text-destructive",
    border: "border-destructive/30",
    bar: "bg-destructive",
  },
  critical: {
    bg: "bg-[oklch(0.55_0.22_300)]/15",
    text: "text-[oklch(0.78_0.18_300)]",
    border: "border-[oklch(0.55_0.22_300)]/40",
    bar: "bg-[oklch(0.7_0.2_300)]",
  },
};

export function SampleDialog({
  sample,
  onClose,
  thresholds = DEFAULT_THRESHOLDS,
}: {
  sample: Sample | null;
  onClose: () => void;
  thresholds?: Thresholds;
}) {
  if (!sample) return null;
  const d = new Date(sample.date);
  const quality = assessQuality(sample, thresholds);
  const QIcon = ICON_FOR_SCORE(quality.score);
  const qTone = TONE[quality.tone];
  const poll = pollutionLabel(sample.pollution, thresholds);
  const pTone = TONE[poll.tone];
  const lat = (43.88 + (sample.position.y - 50) * 0.0015).toFixed(5);
  const lon = (77.07 + (sample.position.x - 50) * 0.002).toFixed(5);

  const metrics = [
    {
      icon: Droplets,
      label: "Уровень pH",
      value: sample.ph,
      unit: "",
      color: "text-cyan-accent",
      note:
        sample.ph >= thresholds.ph.min && sample.ph <= thresholds.ph.max ? "в норме" : "вне нормы",
    },
    {
      icon: Wind,
      label: "Растворённый кислород",
      value: sample.oxygen,
      unit: "мг/л",
      color: "text-success",
      note:
        sample.oxygen >= thresholds.oxygen.warn
          ? "в норме"
          : sample.oxygen >= thresholds.oxygen.critical
            ? "понижен"
            : "критично",
    },
    {
      icon: Eye,
      label: "Мутность",
      value: sample.turbidity,
      unit: "NTU",
      color: "text-warning",
      note: sample.turbidity <= thresholds.turbidity.warn ? "в норме" : "повышена",
    },
    {
      icon: Thermometer,
      label: "Температура",
      value: sample.temperature,
      unit: "°C",
      color: "text-primary",
      note: sample.temperature <= thresholds.temperature.warn ? "в норме" : "высокая",
    },
    {
      icon: Droplets,
      label: "Минерализация TDS",
      value: sample.tds,
      unit: "мг/л",
      color: "text-primary",
      note: "демо",
    },
    {
      icon: Eye,
      label: "Проводимость EC",
      value: sample.conductivity,
      unit: "мкСм/см",
      color: "text-primary",
      note: "демо",
    },
    {
      icon: Biohazard,
      label: "Микрочастицы",
      value: sample.microplastics,
      unit: "част/л",
      color: "text-primary",
      note: "скрининг",
    },
  ];
  return (
    <Dialog open={!!sample} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Droplets className="size-5 text-primary" /> Карточка измерения ·{" "}
            {sample.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
          <DialogDescription>
            Учебное измерение. Оценка по настройкам приложения, координаты условные.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            {d.toLocaleDateString("ru-RU")} ·{" "}
            {d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <MapPin className="size-3.5 text-primary" />
            {lat}° N, {lon}° E
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <Ruler className="size-3.5 text-cyan-accent" />
            Глубина {sample.depth} м
          </span>
        </div>

        {/* Quality indicator */}
        <div
          className={`rounded-xl border ${qTone.border} ${qTone.bg} p-4 flex items-center gap-4`}
        >
          <div
            className={`size-14 rounded-xl ${qTone.bg} border ${qTone.border} flex items-center justify-center`}
          >
            <QIcon className={`size-7 ${qTone.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Качество воды
            </div>
            <div className={`text-xl font-bold ${qTone.text}`}>{quality.label}</div>
            <div className="mt-1.5 h-2 rounded-full bg-background/60 overflow-hidden">
              <div
                className={`h-full ${qTone.bar} transition-all`}
                style={{ width: `${quality.score}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Индекс</div>
            <div className={`text-3xl font-bold tabular-nums ${qTone.text}`}>
              {quality.score}
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-border bg-panel/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
                <m.icon className={`size-4 ${m.color}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${m.color}`}>{m.value}</span>
                <span className="text-sm text-muted-foreground">{m.unit}</span>
                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                  {m.note}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pollution */}
        <div className={`rounded-lg border ${pTone.border} ${pTone.bg} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Biohazard className={`size-4 ${pTone.text}`} />
              Уровень загрязнения
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${pTone.text}`}>
              {poll.label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold tabular-nums ${pTone.text}`}>
              {sample.pollution}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-background/60 overflow-hidden">
            <div className={`h-full ${pTone.bar}`} style={{ width: `${sample.pollution}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border bg-panel/30 aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Camera className="size-10 opacity-50" />
          <span className="text-sm">Фото к этой демопробе не прикреплено</span>
          <span className="text-xs opacity-60 font-mono">Видеопоток с аппарата не подключён</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
