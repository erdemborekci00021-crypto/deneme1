const riskNames = {
  safe: "Güvenli",
  tight: "Riskli",
  late: "Gecikme riski",
  overdue: "Gecikmiş",
  completed: "Tamamlandı",
  paused: "Beklemede",
};
const colors = [
  "#577a69",
  "#668bac",
  "#aa8460",
  "#8a76a4",
  "#699c99",
  "#b58380",
];
const date = (s) =>
  s
    ? new Date(s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("tr-TR", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
const longDate = (s) =>
  new Date(s.slice(0, 10) + "T12:00:00Z").toLocaleDateString("tr-TR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const time = (s) => s?.slice(11, 16) || "—";
const fmt = (n) =>
  `${Math.floor(n / 60)} sa${n % 60 ? " " + Math.round(n % 60) + " dk" : ""}`;
const total = (j) =>
  +j.processingMinutes +
  (+j.setupMinutes || 0) +
  (+j.toolMinutes || 0) +
  (+j.inspectionMinutes || 0);
const ms = (s) => Date.parse(s + "Z");
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const plusDay = (d, n) => iso(ms(d + "T00:00") + n * 86400000);
const busy = (jobs, d) =>
  jobs.reduce(
    (n, j) =>
      n +
      (j.segments || [])
        .filter((s) => s.start.slice(0, 10) === d)
        .reduce((v, s) => v + (ms(s.end) - ms(s.start)) / 60000, 0),
    0,
  );
function cap(settings, d) {
  const shift = settings.days[new Date(d + "T12:00Z").getUTCDay()];
  if (!shift.enabled) return 0;
  let intervals = [[ms(d + "T" + shift.start), ms(d + "T" + shift.end)]];
  for (const stop of [
    ...settings.breaks.map((b) => ({
      start: d + "T" + b.start,
      end: d + "T" + b.end,
    })),
    ...settings.outages,
  ]) {
    const a = ms(stop.start),
      b = ms(stop.end);
    intervals = intervals.flatMap(([x, y]) =>
      b <= x || a >= y
        ? [[x, y]]
        : [
            [x, Math.min(a, y)],
            [Math.max(b, x), y],
          ].filter(([u, v]) => v > u),
    );
  }
  return intervals.reduce((n, [a, b]) => n + (b - a) / 60000, 0);
}
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "İşlem başarısız");
  return data;
}

export {
  riskNames,
  colors,
  date,
  longDate,
  time,
  fmt,
  total,
  ms,
  iso,
  plusDay,
  busy,
  cap,
  pct,
  api,
};
