import type { Robot, Sample, Thresholds } from "./types";
import { assessQuality, pollutionLabel } from "./thresholds";

export type ReportRange = { from: string; to: string };
export type ReportFilters = { range: ReportRange; robotId: string };

export function localDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function sampleDateRange(samples: Sample[]): ReportRange {
  const times = samples.map((sample) => Date.parse(sample.date)).filter(Number.isFinite);
  if (times.length === 0) {
    const today = localDateInput(new Date());
    return { from: today, to: today };
  }
  return {
    from: localDateInput(new Date(Math.min(...times))),
    to: localDateInput(new Date(Math.max(...times))),
  };
}

export function isValidReportRange(range: ReportRange): boolean {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00`)) &&
    localDateInput(new Date(`${value}T00:00:00`)) === value;
  return validDate(range.from) && validDate(range.to) && range.from <= range.to;
}

function inRange(iso: string, range: ReportRange): boolean {
  const t = new Date(iso).getTime();
  const from = new Date(range.from + "T00:00:00").getTime();
  const to = new Date(range.to + "T23:59:59.999").getTime();
  return t >= from && t <= to;
}

export function filterSamples(samples: Sample[], filters: ReportFilters): Sample[] {
  if (!isValidReportRange(filters.range)) return [];
  return samples
    .filter((s) => {
      if (filters.robotId !== "all" && s.robotId !== filters.robotId) return false;
      return inRange(s.date, filters.range);
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export function summarize(samples: Sample[], thresholds: Thresholds) {
  const n = samples.length || 1;
  const avg = (
    k: keyof Pick<Sample, "ph" | "oxygen" | "turbidity" | "temperature" | "depth" | "pollution">,
  ) => samples.reduce((a, s) => a + (s[k] as number), 0) / n;
  const scores = samples.map((s) => assessQuality(s, thresholds).score);
  const tones = samples.map((s) => assessQuality(s, thresholds).tone);
  const avgScore = scores.reduce((a, b) => a + b, 0) / n;
  const counts = {
    success: tones.filter((t) => t === "success").length,
    warning: tones.filter((t) => t === "warning").length,
    danger: tones.filter((t) => t === "danger").length,
    critical: tones.filter((t) => t === "critical").length,
  };
  return {
    count: samples.length,
    ph: +avg("ph").toFixed(2),
    oxygen: +avg("oxygen").toFixed(2),
    turbidity: +avg("turbidity").toFixed(2),
    temperature: +avg("temperature").toFixed(1),
    depth: +avg("depth").toFixed(1),
    pollution: +avg("pollution").toFixed(0),
    avgScore: +avgScore.toFixed(1),
    counts,
  };
}

function csvEscape(v: unknown): string {
  let s = String(v ?? "");
  // A device name or ID is text, even when it resembles an Excel formula.
  if (typeof v === "string" && /^(?:\s*[=+\-@]|[\t\r])/.test(s)) s = "'" + s;
  if (/[",;\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCSV(samples: Sample[], robots: Robot[], thresholds: Thresholds): string {
  const robotName = new Map(robots.map((r) => [r.id, r.name]));
  const header = [
    "id",
    "robot_id",
    "robot_name",
    "datetime_iso",
    "lat",
    "lon",
    "ph",
    "oxygen_mg_l",
    "turbidity_ntu",
    "temperature_c",
    "tds_mg_l",
    "conductivity_us_cm",
    "microplastics_screening_particles_l",
    "depth_m",
    "pollution_idx",
    "quality_score",
    "quality_label",
    "pollution_label",
    "data_source",
    "coordinate_source",
  ];
  const lines: string[] = [header.join(";")];
  for (const s of samples) {
    const q = assessQuality(s, thresholds);
    const p = pollutionLabel(s.pollution, thresholds);
    const lat = (43.88 + (s.position.y - 50) * 0.0015).toFixed(5);
    const lon = (77.07 + (s.position.x - 50) * 0.002).toFixed(5);
    lines.push(
      [
        s.id,
        s.robotId,
        robotName.get(s.robotId) ?? s.robotId,
        s.date,
        lat,
        lon,
        s.ph,
        s.oxygen,
        s.turbidity,
        s.temperature,
        s.tds,
        s.conductivity,
        s.microplastics,
        s.depth,
        s.pollution,
        q.score,
        q.label,
        p.label,
        "demo_simulation",
        "demo_map_projection",
      ]
        .map(csvEscape)
        .join(";"),
    );
  }
  return lines.join("\n");
}

export function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(
  samples: Sample[],
  robots: Robot[],
  thresholds: Thresholds,
  filters: ReportFilters,
) {
  const csv = "﻿" + buildCSV(samples, robots, thresholds); // BOM for Excel Cyrillic
  const fn = `subulaq_report_${filters.range.from}_${filters.range.to}.csv`;
  downloadBlob(fn, "text/csv;charset=utf-8", csv);
  return fn;
}

function htmlEscape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function buildHtmlReport(
  samples: Sample[],
  robots: Robot[],
  thresholds: Thresholds,
  filters: ReportFilters,
): string {
  const robotName = new Map(robots.map((r) => [r.id, r.name]));
  const sum = summarize(samples, thresholds);
  const generated = new Date().toLocaleString("ru-RU");
  const robotFilterLabel =
    filters.robotId === "all"
      ? "Все устройства"
      : (robotName.get(filters.robotId) ?? filters.robotId);

  const rows = samples
    .map((s) => {
      const q = assessQuality(s, thresholds);
      const p = pollutionLabel(s.pollution, thresholds);
      const lat = (43.88 + (s.position.y - 50) * 0.0015).toFixed(5);
      const lon = (77.07 + (s.position.x - 50) * 0.002).toFixed(5);
      const d = new Date(s.date);
      return `<tr>
      <td>${htmlEscape(s.id.toUpperCase())}</td>
      <td>${htmlEscape(robotName.get(s.robotId) ?? s.robotId)}</td>
      <td>${d.toLocaleString("ru-RU")}</td>
      <td class="num">${lat}, ${lon}</td>
      <td class="num">${s.ph}</td>
      <td class="num">${s.oxygen}</td>
      <td class="num">${s.turbidity}</td>
      <td class="num">${s.temperature}</td>
      <td class="num">${s.tds}</td>
      <td class="num">${s.conductivity}</td>
      <td class="num">${s.microplastics}</td>
      <td class="num">${s.depth}</td>
      <td class="num">${s.pollution}</td>
      <td class="tone-${q.tone}">${q.score} · ${htmlEscape(q.label)}</td>
      <td class="tone-${p.tone}">${htmlEscape(p.label)}</td>
    </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>SuBulaq · демо-отчёт · ${htmlEscape(filters.range.from)} — ${htmlEscape(filters.range.to)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #263a35; font-size: 11px; }
  h1 { font-size: 18px; margin: 0 0 4px 0; }
  h2 { font-size: 14px; margin: 16px 0 6px 0; }
  .meta { color: #555; font-size: 11px; margin-bottom: 8px; }
  .meta b { color: #111; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 8px 0 12px 0; }
  .stat { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; background: #fafafa; }
  .stat .l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; }
  .stat .v { font-size: 18px; font-weight: 700; color: #111; }
  .stat .s { font-size: 10px; color: #666; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; }
  th { background: #f1f3f5; font-weight: 600; }
  td.num { font-family: ui-monospace, Menlo, Consolas, monospace; text-align: right; }
  .tone-success { color: #15803d; font-weight: 600; }
  .tone-warning { color: #b45309; font-weight: 600; }
  .tone-danger { color: #b91c1c; font-weight: 600; }
  .tone-critical { color: #6b21a8; font-weight: 600; }
  .footer { margin-top: 12px; font-size: 9px; color: #777; }
  .print-btn { position: fixed; top: 12px; right: 12px; padding: 8px 14px; border-radius: 6px;
              background: #335e57; color: #fff; border: 0; font-weight: 600; cursor: pointer; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Печать / Сохранить PDF</button>
  <h1>SuBulaq · демонстрационный отчёт мониторинга воды</h1>
  <p class="meta">Данные симуляции. Координаты рассчитаны по демонстрационной карте. Скрининг микрочастиц не является лабораторным анализом. Оценка качества рассчитана по настройкам приложения.</p>
  <div class="meta">
    Период: <b>${htmlEscape(filters.range.from)}</b> — <b>${htmlEscape(filters.range.to)}</b> ·
    Устройство: <b>${htmlEscape(robotFilterLabel)}</b> ·
    Сформировано: <b>${generated}</b> ·
    Записей: <b>${sum.count}</b>
  </div>

  <h2>Сводка</h2>
  <div class="grid">
    <div class="stat"><div class="l">Средний pH</div><div class="v">${sum.ph}</div><div class="s">порог ${thresholds.ph.min}–${thresholds.ph.max}</div></div>
    <div class="stat"><div class="l">Средний O₂</div><div class="v">${sum.oxygen} <span style="font-size:11px">мг/л</span></div><div class="s">порог ≥ ${thresholds.oxygen.warn}</div></div>
    <div class="stat"><div class="l">Средняя мутность</div><div class="v">${sum.turbidity} <span style="font-size:11px">NTU</span></div><div class="s">порог ≤ ${thresholds.turbidity.warn}</div></div>
    <div class="stat"><div class="l">Средняя температура</div><div class="v">${sum.temperature} °C</div><div class="s">порог ≤ ${thresholds.temperature.warn}</div></div>
    <div class="stat"><div class="l">Средняя глубина</div><div class="v">${sum.depth} м</div></div>
    <div class="stat"><div class="l">Средний индекс загрязнения</div><div class="v">${sum.pollution}/100</div></div>
    <div class="stat"><div class="l">Средний индекс качества</div><div class="v">${sum.avgScore}/100</div></div>
    <div class="stat">
      <div class="l">Распределение</div>
      <div class="s">
        <span class="tone-success">●</span> ${sum.counts.success} ·
        <span class="tone-warning">●</span> ${sum.counts.warning} ·
        <span class="tone-danger">●</span> ${sum.counts.danger} ·
        <span class="tone-critical">●</span> ${sum.counts.critical}
      </div>
    </div>
  </div>

  <h2>Измерения (${sum.count})</h2>
  <table>
    <thead><tr>
      <th>ID</th><th>Устройство</th><th>Дата/время</th><th>Координаты</th>
      <th>pH</th><th>O₂ мг/л</th><th>Мутн. NTU</th><th>T °C</th>
      <th>TDS мг/л</th><th>EC мкСм/см</th><th>МП част/л</th><th>Глубина м</th><th>Загр.</th>
      <th>Качество</th><th>Уровень загр.</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="15" style="text-align:center;color:#888;padding:20px">Нет данных в выбранном периоде</td></tr>`}</tbody>
  </table>

  <div class="footer">
    SuBulaq · демонстрационный отчёт, сформирован автоматически.
    Настроенные пороги: pH ${thresholds.ph.warnMin}–${thresholds.ph.warnMax} (диапазон ${thresholds.ph.min}–${thresholds.ph.max}),
    O₂ ≥ ${thresholds.oxygen.warn} мг/л (критично < ${thresholds.oxygen.critical}),
    мутность ≤ ${thresholds.turbidity.warn} NTU (критично > ${thresholds.turbidity.critical}),
    T ≤ ${thresholds.temperature.warn} °C,
    индекс загрязнения: низкий < ${thresholds.pollution.ok}, умер. < ${thresholds.pollution.warn}, выс. < ${thresholds.pollution.danger}.
  </div>
</body>
</html>`;
}

export function downloadPDF(
  samples: Sample[],
  robots: Robot[],
  thresholds: Thresholds,
  filters: ReportFilters,
) {
  const html = buildHtmlReport(samples, robots, thresholds, filters);
  const win = window.open("", "_blank");
  if (!win) {
    // Pop-up blocked — fall back to HTML download
    const fn = `subulaq_report_${filters.range.from}_${filters.range.to}.html`;
    downloadBlob(fn, "text/html;charset=utf-8", html);
    return { mode: "fallback-html" as const, filename: fn };
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // give the browser a moment to render before triggering print
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 350);
  return {
    mode: "print" as const,
    filename: `subulaq_report_${filters.range.from}_${filters.range.to}.pdf`,
  };
}
