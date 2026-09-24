import { useEffect, useId, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Droplets,
  Wind,
  Eye,
  Thermometer,
  Biohazard,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { Sample, Thresholds } from "./types";
import { DEFAULT_THRESHOLDS } from "./types";
import { assessQuality, thresholdErrors, THRESHOLD_PRESETS } from "./thresholds";

type Props = {
  thresholds: Thresholds;
  onChange: (thresholds: Thresholds) => boolean | void;
  onReset: () => boolean | void;
  samples: Sample[];
};

type Field = { key: string; label: string; hint?: string };
const cards: {
  group: keyof Thresholds;
  title: string;
  subtitle: string;
  icon: typeof Droplets;
  min: number;
  max?: number;
  step: number;
  fields: Field[];
}[] = [
  {
    group: "ph",
    title: "Уровень pH",
    subtitle: "Кислотность воды",
    icon: Droplets,
    min: 0,
    max: 14,
    step: 0.1,
    fields: [
      { key: "min", label: "Нижняя граница", hint: "Ниже — критическое отклонение" },
      { key: "warnMin", label: "Нижний порог", hint: "Ниже — предупреждение" },
      { key: "warnMax", label: "Верхний порог", hint: "Выше — предупреждение" },
      { key: "max", label: "Верхняя граница", hint: "Выше — критическое отклонение" },
    ],
  },
  {
    group: "oxygen",
    title: "Растворённый кислород",
    subtitle: "мг/л",
    icon: Wind,
    min: 0,
    step: 0.1,
    fields: [
      { key: "warn", label: "Предупреждение ниже" },
      { key: "critical", label: "Критический порог" },
    ],
  },
  {
    group: "turbidity",
    title: "Мутность",
    subtitle: "NTU",
    icon: Eye,
    min: 0,
    step: 0.1,
    fields: [
      { key: "warn", label: "Предупреждение выше" },
      { key: "critical", label: "Критический порог" },
    ],
  },
  {
    group: "temperature",
    title: "Температура",
    subtitle: "°C",
    icon: Thermometer,
    min: -10,
    max: 80,
    step: 0.5,
    fields: [{ key: "warn", label: "Предупреждение выше" }],
  },
  {
    group: "pollution",
    title: "Индекс загрязнения",
    subtitle: "Учебная шкала 0–100",
    icon: Biohazard,
    min: 0,
    max: 100,
    step: 1,
    fields: [
      { key: "ok", label: "Низкий до" },
      { key: "warn", label: "Умеренный до" },
      { key: "danger", label: "Высокий до", hint: "Выше — критический" },
    ],
  },
];

export function SettingsView({ thresholds, onChange, onReset, samples }: Props) {
  const [draft, setDraft] = useState<Thresholds>(thresholds);
  useEffect(() => setDraft(thresholds), [thresholds]);
  const errors = useMemo(() => thresholdErrors(draft), [draft]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(thresholds);
  const preset = THRESHOLD_PRESETS.find((p) => JSON.stringify(p.values) === JSON.stringify(draft));
  const liveStats = useMemo(() => {
    if (thresholdErrors(draft).length) return null;
    const quality = samples.map((sample) => assessQuality(sample, draft));
    return {
      avg: quality.length
        ? Math.round(quality.reduce((sum, item) => sum + item.score, 0) / quality.length)
        : null,
      counts: ["success", "warning", "danger", "critical"].map(
        (tone) => quality.filter((item) => item.tone === tone).length,
      ),
    };
  }, [draft, samples]);

  const save = () => {
    if (errors.length) return;
    const stored = onChange(draft);
    if (stored === false)
      toast.warning("Пороги применены на эту сессию", {
        description:
          "Браузер не разрешил сохранить настройки. После перезагрузки проверьте значения.",
      });
    else
      toast.success("Пороги сохранены", {
        description: "Индикаторы качества и отчёты пересчитаны.",
      });
  };
  const reset = () => {
    setDraft(DEFAULT_THRESHOLDS);
    const stored = onReset();
    if (stored === false) toast.warning("Общий учебный профиль применён на эту сессию");
    else toast.info("Применён общий учебный профиль");
  };

  return (
    <div className="space-y-5">
      <section className="workspace-section">
        <div className="section-heading">
          <div>
            <h2>Пороги качества воды</h2>
            <p>
              Выберите учебный профиль или задайте свои значения. Сохранение обновит индикаторы и
              отчёты.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="size-4" />
              Сбросить
            </Button>
            <Button onClick={save} disabled={!dirty || errors.length > 0}>
              <Save className="size-4" />
              {dirty ? "Сохранить изменения" : "Сохранено"}
            </Button>
          </div>
        </div>
        <label className="grid grid-cols-[minmax(0,1fr)] gap-2 text-xs max-w-lg w-full min-w-0">
          Профиль порогов
          <select
            className="app-select w-full min-w-0"
            value={preset?.id ?? "custom"}
            onChange={(event) => {
              const selected = THRESHOLD_PRESETS.find((p) => p.id === event.target.value);
              if (selected) setDraft(structuredClone(selected.values));
            }}
          >
            <option value="custom" disabled>
              Свои значения
            </option>
            {THRESHOLD_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground leading-relaxed mt-4">
          Профили нужны для демонстрации индикаторов. Они не являются нормативами, а учебный индекс
          не заменяет лабораторный анализ.
        </p>
      </section>
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" />
            Проверьте значения перед сохранением
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-3 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Card key={card.group} className="bg-card border-border p-5">
            <div className="flex gap-3 items-center mb-4">
              <card.icon className="size-5 text-primary" />
              <div>
                <h3 className="font-medium text-sm">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
            </div>
            <div className="space-y-4">
              {card.fields.map((field) => (
                <NumRow
                  key={field.key}
                  label={field.label}
                  accessibleLabel={`${card.title}: ${field.label}`}
                  hint={field.hint}
                  value={(draft[card.group] as Record<string, number>)[field.key]}
                  min={card.min}
                  max={card.max}
                  step={card.step}
                  onChange={(value) =>
                    setDraft((previous) => ({
                      ...previous,
                      [card.group]: { ...previous[card.group], [field.key]: value },
                    }))
                  }
                />
              ))}
            </div>
          </Card>
        ))}
        <Card className="bg-card border-border p-5">
          <div className="flex items-center gap-2 text-primary mb-4">
            <CheckCircle2 className="size-5" />
            <h3 className="font-medium text-sm">Предпросмотр пересчёта</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Влияние на {samples.length} демонстрационных проб.
          </p>
          {liveStats ? (
            <>
              <div className="flex justify-between items-end mt-6 mb-4">
                <span className="text-xs text-muted-foreground">Средний учебный индекс</span>
                <strong className="font-normal text-3xl tabular-nums">
                  {liveStats.avg ?? "—"}
                  <small className="text-sm text-muted-foreground">/100</small>
                </strong>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${liveStats.avg ?? 0}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 mt-5">
                {["В пределах", "Внимание", "Отклонение", "Критично"].map((label, i) => (
                  <div className="text-center" key={label}>
                    <strong className="block text-lg font-medium tabular-nums">
                      {liveStats.counts[i]}
                    </strong>
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-destructive mt-5">
              Предпросмотр появится после исправления порогов.
            </p>
          )}
          {dirty && (
            <p className="text-xs text-warning leading-relaxed border-t pt-4 mt-5">
              Есть несохранённые изменения. Примените их кнопкой «Сохранить изменения».
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function NumRow({
  label,
  accessibleLabel,
  value,
  step,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  accessibleLabel: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  const id = useId();
  const invalid = !Number.isFinite(value) || value < min || (max !== undefined && value > max);
  return (
    <div className="grid grid-cols-[1fr_90px] items-center gap-3">
      <div>
        <Label htmlFor={id} className="text-xs leading-relaxed">
          {label}
        </Label>
        {hint && (
          <p id={`${id}-hint`} className="text-[10px] text-muted-foreground mt-1">
            {hint}
          </p>
        )}
      </div>
      <Input
        id={id}
        aria-label={accessibleLabel}
        aria-invalid={invalid}
        aria-describedby={hint ? `${id}-hint` : undefined}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        required
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="h-9 font-mono text-right text-xs"
      />
    </div>
  );
}
