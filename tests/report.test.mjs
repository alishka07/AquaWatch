import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Run source TypeScript with Node 24, preserving the application's Vite imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (error.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && context.parentURL) {
        const candidate = new URL(`${specifier}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});

const { buildCSV, buildHtmlReport, filterSamples, isValidReportRange, sampleDateRange, summarize } =
  await import("../src/components/app/report.ts");
const { DEFAULT_THRESHOLDS } = await import("../src/components/app/types.ts");

const makeSample = (overrides = {}) => ({
  id: "S-1",
  robotId: "AW-01",
  date: new Date("2026-09-24T12:00:00").toISOString(),
  position: { x: 50, y: 50 },
  ph: 7.2,
  oxygen: 8,
  turbidity: 2,
  temperature: 18,
  tds: 412,
  conductivity: 640,
  microplastics: 14,
  depth: 4.5,
  pollution: 10,
  ...overrides,
});
const range = { from: "2026-09-24", to: "2026-09-24" };

test("date filters include the final millisecond and sort samples without mutating input", () => {
  const late = makeSample({ id: "late", date: new Date("2026-09-24T23:59:59.999").toISOString() });
  const early = makeSample({
    id: "early",
    date: new Date("2026-09-24T00:00:00.000").toISOString(),
  });
  const outside = makeSample({
    id: "outside",
    date: new Date("2026-09-25T00:00:00.000").toISOString(),
  });
  const input = [late, outside, early];
  assert.deepEqual(
    filterSamples(input, { range, robotId: "all" }).map((sample) => sample.id),
    ["early", "late"],
  );
  assert.equal(input[0].id, "late");
});

test("the initial report range follows sample dates and ignores unreadable timestamps", () => {
  assert.deepEqual(
    sampleDateRange([
      makeSample(),
      makeSample({ date: "bad date" }),
      makeSample({ date: "2026-08-02T12:00:00" }),
    ]),
    { from: "2026-08-02", to: "2026-09-24" },
  );
});

test("invalid, reversed, and incomplete ranges produce no data", () => {
  for (const invalid of [
    { from: "", to: range.to },
    { from: "2026-02-30", to: range.to },
    { from: "2026-09-25", to: range.to },
  ]) {
    assert.equal(isValidReportRange(invalid), false);
    assert.deepEqual(filterSamples([makeSample()], { range: invalid, robotId: "all" }), []);
  }
});

test("device selection controls both returned data and its quality summary", () => {
  const input = [
    makeSample(),
    makeSample({ id: "S-2", robotId: "AW-02", pollution: 100, oxygen: 1, turbidity: 20 }),
  ];
  const selected = filterSamples(input, { range, robotId: "AW-01" });
  assert.equal(selected.length, 1);
  assert.equal(summarize(selected, DEFAULT_THRESHOLDS).avgScore, 100);
  assert.ok(summarize(input, DEFAULT_THRESHOLDS).avgScore < 100);
});

test("CSV neutralizes formula-like text while preserving numeric measurements", () => {
  const sample = makeSample({ id: "@malicious", temperature: -1.2 });
  const csv = buildCSV([sample], [{ id: "AW-01", name: "=SUM(1)" }], DEFAULT_THRESHOLDS);
  const [header, row] = csv.split("\n").map((line) => line.split(";"));
  assert.equal(row[header.indexOf("id")], "'@malicious");
  assert.equal(row[header.indexOf("robot_name")], "'=SUM(1)");
  assert.equal(row[header.indexOf("temperature_c")], "-1.2");
  assert.equal(row[header.indexOf("tds_mg_l")], "412");
  assert.equal(row[header.indexOf("conductivity_us_cm")], "640");
  assert.equal(row[header.indexOf("microplastics_screening_particles_l")], "14");
  assert.equal(row[header.indexOf("data_source")], "demo_simulation");
  assert.equal(header.length, row.length);
});

test("CSV quotes delimiters, line breaks, and embedded quotes in names", () => {
  const csv = buildCSV(
    [makeSample()],
    [{ id: "AW-01", name: 'Vessel; "A"\nNew line' }],
    DEFAULT_THRESHOLDS,
  );
  assert.ok(csv.includes('"Vessel; ""A""\nNew line"'));
});

test("print report escapes editable names and identifies simulated and screening data", () => {
  const html = buildHtmlReport(
    [makeSample()],
    [{ id: "AW-01", name: '<img src=x onerror="alert(1)">' }],
    DEFAULT_THRESHOLDS,
    { range, robotId: "all" },
  );
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img src=x"));
  assert.ok(html.includes("Данные симуляции"));
  assert.ok(html.includes("Скрининг микрочастиц"));
  assert.equal((html.match(/<th>/g) ?? []).length, 15);
  assert.equal((html.match(/<td(?: class="[^"]*")?>/g) ?? []).length, 15);
});
