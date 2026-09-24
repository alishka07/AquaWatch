import { useEffect, useState, useCallback } from "react";
import { DEFAULT_THRESHOLDS, type Thresholds, type Sample } from "./types";

const STORAGE_KEY = "usv.thresholds.v1";

export const THRESHOLD_PRESETS: { id: string; label: string; values: Thresholds }[] = [
  { id: "general", label: "Учебный профиль: общий", values: DEFAULT_THRESHOLDS },
  {
    id: "sensitive",
    label: "Учебный профиль: чувствительный водоём",
    values: {
      ph: { min: 6.8, warnMin: 7, warnMax: 8, max: 8.2 },
      oxygen: { critical: 5, warn: 7 },
      turbidity: { warn: 3, critical: 5 },
      temperature: { warn: 22 },
      pollution: { ok: 15, warn: 30, danger: 55 },
    },
  },
];

export function thresholdErrors(value: unknown): string[] {
  if (!value || typeof value !== "object") return ["Заполните все пороги числовыми значениями."];
  const groups = value as Record<string, unknown>;
  const fields = {
    ph: ["min", "warnMin", "warnMax", "max"],
    oxygen: ["critical", "warn"],
    turbidity: ["warn", "critical"],
    temperature: ["warn"],
    pollution: ["ok", "warn", "danger"],
  };
  for (const [group, names] of Object.entries(fields)) {
    const values = groups[group];
    if (
      !values ||
      typeof values !== "object" ||
      names.some(
        (name) =>
          typeof (values as Record<string, unknown>)[name] !== "number" ||
          !Number.isFinite((values as Record<string, number>)[name]),
      )
    ) {
      return ["Заполните все поля конечными числовыми значениями."];
    }
  }
  const t = value as Thresholds;
  const errors: string[] = [];
  if (!(
    0 <= t.ph.min &&
    t.ph.min <= t.ph.warnMin &&
    t.ph.warnMin < t.ph.warnMax &&
    t.ph.warnMax <= t.ph.max &&
    t.ph.max <= 14
  ))
    errors.push("pH: 0 ≤ нижняя граница ≤ нижний порог < верхний порог ≤ верхняя граница ≤ 14.");
  if (!(0 <= t.oxygen.critical && t.oxygen.critical < t.oxygen.warn))
    errors.push(
      "Кислород: критический порог должен быть неотрицательным и ниже порога предупреждения.",
    );
  if (!(0 <= t.turbidity.warn && t.turbidity.warn < t.turbidity.critical))
    errors.push("Мутность: порог предупреждения должен быть неотрицательным и ниже критического.");
  if (!(
    0 <= t.pollution.ok &&
    t.pollution.ok < t.pollution.warn &&
    t.pollution.warn < t.pollution.danger &&
    t.pollution.danger <= 100
  ))
    errors.push("Индекс загрязнения: 0 ≤ низкий < умеренный < высокий ≤ 100.");
  if (!(t.temperature.warn >= -10 && t.temperature.warn <= 80))
    errors.push("Температура: укажите порог от −10 до 80 °C.");
  return errors;
}

export function isValidThresholds(value: unknown): value is Thresholds {
  return thresholdErrors(value).length === 0;
}

export function loadThresholds(): Thresholds {
  if (typeof window === "undefined") return DEFAULT_THRESHOLDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THRESHOLDS;
    const parsed: unknown = JSON.parse(raw);
    return isValidThresholds(parsed) ? parsed : DEFAULT_THRESHOLDS;
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

export function saveThresholds(t: Thresholds) {
  if (typeof window === "undefined" || !isValidThresholds(t)) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    return true;
  } catch {
    return false;
  }
}

export function useThresholds() {
  const [thresholds, setState] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  useEffect(() => {
    setState(loadThresholds());
  }, []);

  const set = useCallback((t: Thresholds) => {
    if (!isValidThresholds(t)) return false;
    setState(t);
    return saveThresholds(t);
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_THRESHOLDS);
    return saveThresholds(DEFAULT_THRESHOLDS);
  }, []);

  return { thresholds, setThresholds: set, resetThresholds: reset };
}

export type QualityTone = "success" | "warning" | "danger" | "critical";

export function assessQuality(
  s: Sample,
  t: Thresholds,
): { score: number; tone: QualityTone; label: string } {
  let score = 100;
  if (s.ph < t.ph.min || s.ph > t.ph.max) score -= 25;
  else if (s.ph < t.ph.warnMin || s.ph > t.ph.warnMax) score -= 10;
  if (s.oxygen < t.oxygen.critical) score -= 30;
  else if (s.oxygen < t.oxygen.warn) score -= 12;
  if (s.turbidity > t.turbidity.critical) score -= 25;
  else if (s.turbidity > t.turbidity.warn) score -= 10;
  if (s.temperature > t.temperature.warn) score -= 10;
  score -= Math.max(0, s.pollution - t.pollution.ok) * 0.5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score >= 80) return { score, tone: "success", label: "Отлично" };
  if (score >= 60) return { score, tone: "success", label: "Хорошо" };
  if (score >= 40) return { score, tone: "warning", label: "Удовлетворительно" };
  if (score >= 20) return { score, tone: "danger", label: "Плохо" };
  return { score, tone: "critical", label: "Критическое" };
}

export function pollutionLabel(p: number, t: Thresholds): { label: string; tone: QualityTone } {
  if (p < t.pollution.ok) return { label: "Низкий", tone: "success" };
  if (p < t.pollution.warn) return { label: "Умеренный", tone: "warning" };
  if (p < t.pollution.danger) return { label: "Высокий", tone: "danger" };
  return { label: "Критический", tone: "critical" };
}
