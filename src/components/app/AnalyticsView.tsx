import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, CalendarRange, FileText, FlaskConical, Sheet } from "lucide-react";
import { toast } from "sonner";
import type { Robot, Sample, Thresholds } from "./types";
import { assessQuality } from "./thresholds";
import {
  downloadCSV,
  downloadPDF,
  filterSamples,
  isValidReportRange,
  localDateInput,
  sampleDateRange,
  summarize,
  type ReportRange,
} from "./report";

type Props = {
  robots: Robot[];
  samples: Sample[];
  thresholds: Thresholds;
  onSelectSample?: (sample: Sample) => void;
  onInspectParticles?: () => void;
};

const METRICS = [
  { key: "ph", name: "pH", unit: "", decimals: 2 },
  { key: "oxygen", name: "Кислород", unit: "мг/л", decimals: 2 },
  { key: "turbidity", name: "Мутность", unit: "NTU", decimals: 2 },
  { key: "temperature", name: "Температура", unit: "°C", decimals: 1 },
  { key: "tds", name: "TDS", unit: "мг/л", decimals: 0 },
  { key: "conductivity", name: "EC", unit: "мкСм/см", decimals: 0 },
  { key: "microplastics", name: "Микрочастицы", unit: "част/л", decimals: 0 },
  { key: "depth", name: "Глубина", unit: "м", decimals: 1 },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];
const formatValue = (value: number, decimals = 1) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: decimals });
const dateLabel = (timestamp: number, timeOnly: boolean) =>
  timeOnly
    ? new Date(timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : new Date(timestamp).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const qualityColors = {
  success: "#335e57",
  warning: "#a28b55",
  danger: "#ae6652",
  critical: "#72463d",
};

function previousPeriod(range: ReportRange): { range: ReportRange; shift: number } {
  if (!isValidReportRange(range)) return { range, shift: 0 };
  const start = new Date(`${range.from}T00:00:00`);
  const end = new Date(`${range.to}T00:00:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(start);
  priorStart.setDate(priorStart.getDate() - days);
  return {
    range: { from: localDateInput(priorStart), to: localDateInput(priorEnd) },
    shift: start.getTime() - priorStart.getTime(),
  };
}

export function AnalyticsView({
  robots,
  samples,
  thresholds,
  onSelectSample,
  onInspectParticles,
}: Props) {
  const [customRange, setCustomRange] = useState<ReportRange | null>(null);
  const [robotId, setRobotId] = useState("all");
  const [metricKey, setMetricKey] = useState<MetricKey>("turbidity");
  const [compare, setCompare] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const allRange = useMemo(() => sampleDateRange(samples), [samples]);
  const range = customRange ?? allRange;
  const validRange = isValidReportRange(range);
  const filters = useMemo(() => ({ range, robotId }), [range, robotId]);
  const filtered = useMemo(() => filterSamples(samples, filters), [samples, filters]);
  const sum = useMemo(() => summarize(filtered, thresholds), [filtered, thresholds]);
  const metric = METRICS.find((item) => item.key === metricKey)!;
  const prior = useMemo(() => previousPeriod(range), [range]);
  const previous = useMemo(
    () => (compare ? filterSamples(samples, { range: prior.range, robotId }) : []),
    [compare, samples, prior.range, robotId],
  );
  const chartData = useMemo(
    () =>
      [
        ...filtered
          .filter((sample) => Number.isFinite(sample[metricKey]))
          .map((sample) => ({
            time: Date.parse(sample.date),
            value: sample[metricKey],
            previous: null as number | null,
          })),
        ...previous
          .filter((sample) => Number.isFinite(sample[metricKey]))
          .map((sample) => ({
            time: Date.parse(sample.date) + prior.shift,
            value: null as number | null,
            previous: sample[metricKey],
          })),
      ].sort((a, b) => a.time - b.time),
    [filtered, previous, metricKey, prior.shift],
  );
  const metricValues = filtered.map((sample) => sample[metricKey]).filter(Number.isFinite);
  const metricAverage = metricValues.length
    ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length
    : null;
  const threshold =
    metricKey === "turbidity"
      ? thresholds.turbidity.warn
      : metricKey === "oxygen"
        ? thresholds.oxygen.warn
        : metricKey === "temperature"
          ? thresholds.temperature.warn
          : null;
  const exceedCount = filtered.filter(
    (sample) =>
      sample.ph < thresholds.ph.min ||
      sample.ph > thresholds.ph.max ||
      sample.oxygen < thresholds.oxygen.warn ||
      sample.turbidity > thresholds.turbidity.warn ||
      sample.temperature > thresholds.temperature.warn ||
      sample.pollution >= thresholds.pollution.warn,
  ).length;
  const nameById = new Map(robots.map((robot) => [robot.id, robot.name]));
  const latestRows = [...filtered].reverse();
  const visibleRows = expanded ? latestRows : latestRows.slice(0, 12);

  const setPeriod = (days: number | null) => {
    if (days === null) setCustomRange(null);
    else {
      const start = new Date(`${allRange.to}T00:00:00`);
      start.setDate(start.getDate() - days + 1);
      setCustomRange({ from: localDateInput(start), to: allRange.to });
    }
    setExpanded(false);
  };
  const exportReport = (kind: "csv" | "pdf") => {
    if (!validRange || !filtered.length) return;
    try {
      if (kind === "csv") {
        downloadCSV(filtered, robots, thresholds, filters);
        toast.success(`CSV готов: ${filtered.length} измерений`);
      } else {
        const result = downloadPDF(filtered, robots, thresholds, filters);
        toast.success(result.mode === "print" ? "Отчёт открыт для печати" : "HTML-отчёт скачан", {
          description:
            result.mode === "print"
              ? "Выберите «Сохранить как PDF» в диалоге печати."
              : "Откройте файл и выберите «Печать / Сохранить PDF».",
        });
      }
    } catch {
      toast.error("Не удалось сформировать отчёт", {
        description: "Повторите экспорт. Данные останутся в приложении.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="report-from" className="text-xs text-muted-foreground">
              <CalendarRange className="mr-1.5 inline size-3.5" />
              Начало периода
            </Label>
            <Input
              id="report-from"
              type="date"
              value={range.from}
              onChange={(event) => setCustomRange({ ...range, from: event.target.value })}
              className="w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-to" className="text-xs text-muted-foreground">
              Конец периода
            </Label>
            <Input
              id="report-to"
              type="date"
              value={range.to}
              onChange={(event) => setCustomRange({ ...range, to: event.target.value })}
              className="w-40"
            />
          </div>
          <div className="min-w-44 space-y-2">
            <Label htmlFor="report-device" className="text-xs text-muted-foreground">
              Аппарат
            </Label>
            <Select
              value={robotId}
              onValueChange={(value) => {
                setRobotId(value);
                setExpanded(false);
              }}
            >
              <SelectTrigger id="report-device" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все аппараты</SelectItem>
                {robots.map((robot) => (
                  <SelectItem key={robot.id} value={robot.id}>
                    {robot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {(
              [
                { days: 1, label: "Последний день" },
                { days: 7, label: "7 дней" },
                { days: 30, label: "30 дней" },
                { days: null, label: "Весь период" },
              ] as const
            ).map((item) => (
              <Button
                key={item.label}
                variant="outline"
                size="sm"
                onClick={() => setPeriod(item.days)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
        {!validRange && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            Укажите обе даты. Начало периода должно быть не позже конца.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { title: "Измерений", value: String(filtered.length), detail: "в выбранном периоде" },
          {
            title: "Индекс качества",
            value: filtered.length ? `${sum.avgScore} / 100` : "—",
            detail: "по настроенным порогам",
          },
          {
            title: "Выходы за пороги",
            value: filtered.length ? String(exceedCount) : "—",
            detail: "точек требуют внимания",
          },
          {
            title: "Аппаратов",
            value: String(new Set(filtered.map((sample) => sample.robotId)).size),
            detail: "участвовали в измерениях",
          },
        ].map((item) => (
          <Card key={item.title} className="gap-0 border-border p-4 sm:p-5">
            <div className="text-xs text-muted-foreground">{item.title}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
          </Card>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden border-border bg-card">
        <div
          className="flex flex-wrap gap-1 border-b border-border p-3"
          role="group"
          aria-label="Показатель для графика"
        >
          {METRICS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={metricKey === item.key ? "default" : "ghost"}
              aria-pressed={metricKey === item.key}
              onClick={() => setMetricKey(item.key)}
            >
              {item.name}
            </Button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xl">
                {metric.name}
                {metric.unit && (
                  <span className="ml-2 text-sm text-muted-foreground">{metric.unit}</span>
                )}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {metricKey === "microplastics"
                  ? "Демонстрационный скрининг частиц"
                  : "Измерения в хронологическом порядке"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              {compare ? "Скрыть сравнение" : "Сравнить с прошлым периодом"}
            </Button>
          </div>
          {metricValues.length ? (
            <>
              <div className="mb-5 grid grid-cols-3 gap-3 text-sm">
                {[
                  ["Среднее", metricAverage!],
                  ["Минимум", Math.min(...metricValues)],
                  ["Максимум", Math.max(...metricValues)],
                ].map(([name, value]) => (
                  <div key={String(name)}>
                    <div className="text-xs text-muted-foreground">{name}</div>
                    <div className="mt-1 font-semibold">
                      {formatValue(Number(value), metric.decimals)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        {metric.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="h-64 w-full"
                role="img"
                aria-label={`График ${metric.name}: ${metricValues.length} измерений, минимум ${formatValue(Math.min(...metricValues), metric.decimals)}, максимум ${formatValue(Math.max(...metricValues), metric.decimals)}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 12, right: 16, bottom: 4, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="measurement-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#335e57" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#335e57" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                    tickFormatter={(timestamp) => dateLabel(timestamp, range.from === range.to)}
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      minTickGap={35}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={42}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      labelFormatter={(value) => new Date(Number(value)).toLocaleString("ru-RU")}
                      formatter={(value, name) => [
                        `${formatValue(Number(value), metric.decimals)} ${metric.unit}`,
                        name === "value" ? "Выбранный период" : "Предыдущий период",
                      ]}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                        fontSize: 12,
                      }}
                    />
                    {threshold !== null && (
                      <ReferenceLine
                        y={threshold}
                        stroke="#a28b55"
                        strokeDasharray="5 5"
                        label={{
                          value: "Порог",
                          position: "insideTopRight",
                          fill: "var(--muted-foreground)",
                          fontSize: 11,
                        }}
                        ifOverflow="extendDomain"
                      />
                    )}
                    {metricKey === "ph" &&
                      [thresholds.ph.min, thresholds.ph.max].map((value) => (
                        <ReferenceLine
                          key={value}
                          y={value}
                          stroke="#a28b55"
                          strokeDasharray="5 5"
                          ifOverflow="extendDomain"
                        />
                      ))}
                    <Area
                      type="linear"
                      dataKey="value"
                      stroke="#335e57"
                      fill="url(#measurement-fill)"
                      strokeWidth={2}
                      dot={filtered.length < 15 ? { r: 3, fill: "#335e57" } : false}
                      connectNulls
                      isAnimationActive={false}
                    />
                    {compare && (
                      <Line
                        type="linear"
                        dataKey="previous"
                        stroke="#76806d"
                        strokeWidth={2}
                        strokeDasharray="5 4"
                        connectNulls
                        dot={false}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {compare && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {previous.length
                    ? `Пунктир: ${prior.range.from} — ${prior.range.to}, ${previous.length} измерений. Время совмещено с выбранным периодом.`
                    : "За предыдущий период измерений нет. Выберите более короткий период для сравнения."}
                </p>
              )}
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <FlaskConical className="size-7 text-muted-foreground" />
              <h4 className="font-semibold">Нет измерений за этот период</h4>
              <p className="max-w-md text-sm text-muted-foreground">
                Измените даты или выберите другой аппарат, чтобы увидеть график.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setCustomRange(null);
                  setRobotId("all");
                }}
              >
                Показать все измерения
              </Button>
            </div>
          )}
          {metricKey === "microplastics" && onInspectParticles && (
            <Button className="mt-4" variant="outline" onClick={onInspectParticles}>
              Открыть скрининг частиц
              <ArrowUpRight className="size-4" />
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="gap-3 border-border p-5">
          <h3 className="font-semibold">Распределение качества</h3>
          <p className="text-xs text-muted-foreground">
            Оценка каждой пробы по текущим настройкам.
          </p>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {Object.entries(sum.counts).map(
              ([tone, count]) =>
                count > 0 && (
                  <div
                    key={tone}
                    style={{
                      width: `${(count / filtered.length) * 100}%`,
                      background: qualityColors[tone as keyof typeof qualityColors],
                    }}
                  />
                ),
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {(
              [
                { tone: "success", label: "Хорошее" },
                { tone: "warning", label: "Удовлетворительное" },
                { tone: "danger", label: "Плохое" },
                { tone: "critical", label: "Критическое" },
              ] as const
            ).map((item) => (
              <div className="flex items-center gap-2" key={item.tone}>
                <span
                  className="size-2 rounded-full"
                  style={{ background: qualityColors[item.tone] }}
                />
                <span className="text-muted-foreground">{item.label}</span>
                <span className="ml-auto font-semibold">{sum.counts[item.tone]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="gap-3 border-border bg-secondary/40 p-5">
          <h3 className="font-semibold">Отчёт о выбранных измерениях</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Демонстрационные данные, сводка качества и таблица проб. В CSV сохраняются время,
            координаты и все показатели.
          </p>
          <div className="mt-auto flex flex-wrap gap-2">
            <Button onClick={() => exportReport("pdf")} disabled={!filtered.length || !validRange}>
              <FileText className="size-4" />
              Печать / PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => exportReport("csv")}
              disabled={!filtered.length || !validRange}
            >
              <Sheet className="size-4" />
              Скачать CSV
            </Button>
          </div>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden border-border">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="font-semibold">Журнал измерений</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {["Проба", "Аппарат", "Время", "pH", "O₂, мг/л", "NTU", "°C", "Качество"].map(
                  (label) => (
                    <th key={label} className="px-4 py-3 font-medium">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((sample) => {
                const quality = assessQuality(sample, thresholds);
                return (
                  <tr key={sample.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {onSelectSample ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          onClick={() => onSelectSample(sample)}
                        >
                          {sample.id.toUpperCase()}
                          <ArrowUpRight className="size-3" />
                        </button>
                      ) : (
                        sample.id.toUpperCase()
                      )}
                    </td>
                    <td className="px-4 py-3">{nameById.get(sample.robotId) ?? sample.robotId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {new Date(sample.date).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">{formatValue(sample.ph, 2)}</td>
                    <td className="px-4 py-3">{formatValue(sample.oxygen, 2)}</td>
                    <td className="px-4 py-3">{formatValue(sample.turbidity, 2)}</td>
                    <td className="px-4 py-3">{formatValue(sample.temperature)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: qualityColors[quality.tone] }}
                        />
                        {quality.score} · {quality.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!visibleRows.length && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    В этом периоде проб нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 12 && (
          <div className="border-t border-border p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Свернуть список" : `Показать все ${filtered.length} измерений`}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
