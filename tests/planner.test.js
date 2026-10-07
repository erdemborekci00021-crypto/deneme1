import test from "node:test";
import assert from "node:assert/strict";
import {
  plan,
  defaultSettings,
  parse,
  calendar,
  duration,
} from "../server/planner.js";
const now = "2026-10-19T08:00";
const settings = () => structuredClone(defaultSettings);
const job = (id, mins, due = "2026-10-27T17:00", extra = {}) => ({
  id,
  part: "Parça",
  priority: "Normal",
  status: "Bekliyor",
  processingMinutes: mins,
  setupMinutes: 0,
  toolMinutes: 0,
  inspectionMinutes: 0,
  due,
  splittable: true,
  ...extra,
});
test("EDD: earlier deadline runs first regardless of insertion order", () => {
  const p = plan(
    [job(1, 180), job(2, 600, "2026-10-20T17:00")],
    settings(),
    now,
  );
  assert.equal(p[1].plannedStart, now);
  assert.equal(p[0].plannedStart, "2026-10-20T09:00");
});
test("manual urgency overrides EDD and propagates delays", () => {
  const p = plan(
    [
      job(1, 480, "2026-10-19T18:00"),
      job(2, 180, "2026-10-27T17:00", { priority: "Çok Acil" }),
    ],
    settings(),
    now,
  );
  assert.equal(p[1].plannedStart, now);
  assert.equal(p[0].risk, "late");
  assert.equal(p[0].missingMinutes, 120);
});
test("setup/tool/inspection count toward machine duration", () => {
  const p = plan(
    [
      job(1, 360, "2026-10-27T17:00", {
        setupMinutes: 60,
        toolMinutes: 30,
        inspectionMinutes: 30,
      }),
    ],
    settings(),
    now,
  );
  assert.equal(duration(p[0]), 480);
  assert.equal(p[0].plannedEnd, "2026-10-19T17:00");
});
test("lunch and weekends excluded; 20h split over days", () => {
  const p = plan([job(1, 1200)], settings(), "2026-10-23T08:00")[0];
  assert.equal(p.plannedEnd, "2026-10-27T10:00");
  assert.equal(p.segments.length, 5);
  for (const s of p.segments) {
    assert.ok(s.end.slice(11) <= "12:00" || s.start.slice(11) >= "13:00");
    assert.notEqual(new Date(parse(s.start)).getUTCDay(), 0);
    assert.notEqual(new Date(parse(s.start)).getUTCDay(), 6);
  }
});
test("outages subtracted and overlapping downtime not double counted", () => {
  const s = settings();
  s.outages = [
    { start: "2026-10-19T08:00", end: "2026-10-19T10:00" },
    { start: "2026-10-19T09:00", end: "2026-10-19T11:00" },
  ];
  const p = plan([job(1, 120)], s, now)[0];
  assert.equal(p.plannedStart, "2026-10-19T11:00");
  assert.equal(p.plannedEnd, "2026-10-19T14:00");
});
test("non-splittable work requires one continuous slot", () => {
  const p = plan(
    [job(1, 360, undefined, { splittable: false })],
    settings(),
    now,
  )[0];
  assert.equal(p.plannedStart, null);
  assert.equal(p.risk, "late");
  assert.match(p.reason, /kesintisiz/);
});
test("non-splittable work chooses afternoon continuous window", () => {
  const p = plan(
    [job(1, 300, undefined, { splittable: false })],
    settings(),
    now,
  )[0];
  assert.deepEqual(p.segments, [
    { start: "2026-10-19T13:00", end: "2026-10-19T18:00" },
  ]);
});
test("backward planning uses latest valid pre-deadline slots", () => {
  const s = settings();
  s.mode = "backward";
  const p = plan([job(1, 600, "2026-10-20T17:00")], s, now)[0];
  assert.equal(p.plannedEnd, "2026-10-20T17:00");
  assert.equal(p.plannedStart, "2026-10-19T16:00");
  assert.equal(p.risk, "tight");
});
test("backward impossible deadline falls back and flags missing capacity", () => {
  const s = settings();
  s.mode = "backward";
  const p = plan([job(1, 360, "2026-10-19T11:00")], s, now)[0];
  assert.equal(p.risk, "late");
  assert.equal(p.missingMinutes, 180);
});
test("manual moves shift other work without overlapping reservations", () => {
  const p = plan(
    [
      job(1, 180, "2026-10-19T11:00"),
      job(2, 180, undefined, { manualStart: "2026-10-19T08:00" }),
    ],
    settings(),
    now,
  );
  assert.equal(p[1].plannedStart, now);
  assert.equal(p[0].risk, "late");
  const segments = p
    .flatMap((j) => j.segments)
    .sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < segments.length; i++)
    assert.ok(segments[i - 1].end <= segments[i].start);
});
test("completed/cancelled/on-hold work consumes no capacity", () => {
  const p = plan(
    [
      job(1, 500, undefined, { status: "Tamamlandı" }),
      job(2, 500, undefined, { status: "Beklemede" }),
      job(3, 500, undefined, { status: "İptal edildi" }),
      job(4, 60),
    ],
    settings(),
    now,
  );
  assert.equal(p[3].plannedStart, now);
  assert.deepEqual(
    p.slice(0, 3).map((j) => j.segments),
    [[], [], []],
  );
});
test("past due work is overdue regardless of allocated end", () => {
  assert.equal(
    plan([job(1, 60, "2026-10-18T17:00")], settings(), now)[0].risk,
    "overdue",
  );
});
test("fully disabled calendar reports no capacity", () => {
  const s = settings();
  s.days.forEach((d) => (d.enabled = false));
  assert.equal(calendar(s, parse(now)).length, 0);
  assert.equal(plan([job(1, 60)], s, now)[0].plannedStart, null);
});
test("in-production reservation is preserved and excludes other jobs", () => {
  const j = job(1, 60, undefined, {
    status: "Üretimde",
    segments: [{ start: now, end: "2026-10-19T09:00" }],
  });
  const p = plan(
    [j, job(2, 60, undefined, { priority: "Çok Acil" })],
    settings(),
    now,
  );
  assert.equal(p[0].plannedStart, now);
  assert.equal(p[1].plannedStart, "2026-10-19T09:00");
});
