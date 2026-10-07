// Times are workshop wall-clock values (Europe/Istanbul), represented as UTC
// internally for arithmetic. No host timezone or daylight-saving assumptions.
export const minute = 60000;
export const parse = (s) =>
  Date.parse(s.length === 10 ? `${s}T00:00:00Z` : `${s.replace(/Z$/, "")}Z`);
export const stamp = (t) => new Date(t).toISOString().slice(0, 16);
export function workshopNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export const defaultSettings = {
  machineName: "CNC Dik İşleme 1",
  mode: "forward",
  riskMinutes: 120,
  days: [
    { enabled: false, start: "08:00", end: "18:00" },
    { enabled: true, start: "08:00", end: "18:00" },
    { enabled: true, start: "08:00", end: "18:00" },
    { enabled: true, start: "08:00", end: "18:00" },
    { enabled: true, start: "08:00", end: "18:00" },
    { enabled: true, start: "08:00", end: "18:00" },
    { enabled: false, start: "08:00", end: "18:00" },
  ],
  breaks: [{ start: "12:00", end: "13:00", name: "Öğle molası" }],
  outages: [],
};
export function subtract(intervals, start, end) {
  return intervals.flatMap(([a, b]) =>
    end <= a || start >= b
      ? [[a, b]]
      : [
          [a, Math.min(start, b)],
          [Math.max(end, a), b],
        ].filter(([x, y]) => y > x),
  );
}
export function calendar(settings, start, horizon = 366) {
  const date = stamp(start).slice(0, 10);
  const midnight = parse(date);
  let free = [];
  for (let i = 0; i < horizon; i++) {
    const day = midnight + i * 86400000,
      d = stamp(day).slice(0, 10),
      shift = settings.days[new Date(day).getUTCDay()];
    if (!shift?.enabled) continue;
    let slots = [
      [
        Math.max(start, parse(`${d}T${shift.start}`)),
        parse(`${d}T${shift.end}`),
      ],
    ].filter(([a, b]) => a < b);
    for (const pause of settings.breaks)
      slots = subtract(
        slots,
        parse(`${d}T${pause.start}`),
        parse(`${d}T${pause.end}`),
      );
    for (const stop of settings.outages)
      slots = subtract(slots, parse(stop.start), parse(stop.end));
    free.push(...slots);
  }
  return free;
}
export const duration = (j) =>
  Number(j.processingMinutes) +
  Number(j.setupMinutes || 0) +
  Number(j.toolMinutes || 0) +
  Number(j.inspectionMinutes || 0);
const priorities = { "Çok Acil": 0, Acil: 1, Normal: 2, Düşük: 3 };
export function allocate(
  free,
  needed,
  {
    earliest = -Infinity,
    latest = Infinity,
    split = true,
    reverse = false,
  } = {},
) {
  const candidates = free
    .map(([a, b]) => [Math.max(a, earliest), Math.min(b, latest)])
    .filter(([a, b]) => b > a);
  if (reverse) candidates.reverse();
  let left = needed * minute,
    result = [];
  for (const [a, b] of candidates) {
    if (!split && b - a < left) continue;
    const take = Math.min(left, b - a);
    result.push(reverse ? [b - take, b] : [a, a + take]);
    left -= take;
    if (left === 0) return result.sort((x, y) => x[0] - y[0]);
  }
  return null;
}
export function plan(jobs, settings, now = workshopNow()) {
  const start = parse(now);
  let free = calendar(settings, start);
  const results = new Map();
  const active = jobs.filter(
    (j) => !["Tamamlandı", "İptal edildi", "Beklemede"].includes(j.status),
  );
  const sorted = [...active].sort(
    (a, b) =>
      (a.status === "Üretimde" ? -1 : b.status === "Üretimde" ? 1 : 0) ||
      (a.manualStart ? 0 : 1) - (b.manualStart ? 0 : 1) ||
      priorities[a.priority] - priorities[b.priority] ||
      parse(a.due) - parse(b.due) ||
      duration(a) - duration(b) ||
      a.id - b.id,
  );
  for (const j of sorted) {
    const earliest = j.manualStart
      ? Math.max(start, parse(j.manualStart))
      : start;
    const opts = { earliest, split: j.splittable !== false };
    let segments;
    if (j.status === "Üretimde" && j.segments?.length) {
      // In-progress remaining reservations are immutable; exclude elapsed segments.
      segments = j.segments.map((s) => [parse(s.start), parse(s.end)]);
    }
    if (!segments && settings.mode === "backward" && !j.manualStart)
      segments = allocate(free, duration(j), {
        ...opts,
        latest: parse(j.due),
        reverse: true,
      });
    if (!segments) segments = allocate(free, duration(j), opts);
    let missing = 0;
    if (!segments) {
      results.set(j.id, {
        ...j,
        segments: [],
        plannedStart: null,
        plannedEnd: null,
        risk: parse(j.due) < start ? "overdue" : "late",
        reason:
          j.splittable === false
            ? "366 günlük takvimde uygun kesintisiz kapasite yok."
            : "366 günlük takvimde işi tamamlayacak uygun kapasite yok.",
        missingMinutes: duration(j),
      });
      continue;
    }
    const end = segments.at(-1)[1],
      due = parse(j.due);
    // Missing capacity is this job's work scheduled after its deadline.
    missing = segments.reduce(
      (n, [a, b]) => n + Math.max(0, b - Math.max(a, due)) / minute,
      0,
    );
    const slack = free.reduce(
      (n, [a, b]) =>
        n + Math.max(0, Math.min(b, due) - Math.max(a, end)) / minute,
      0,
    );
    const risk =
      due < start
        ? "overdue"
        : end > due
          ? "late"
          : slack < settings.riskMinutes
            ? "tight"
            : "safe";
    results.set(j.id, {
      ...j,
      status: j.status === "Bekliyor" ? "Planlandı" : j.status,
      segments: segments.map(([a, b]) => ({ start: stamp(a), end: stamp(b) })),
      plannedStart: stamp(segments[0][0]),
      plannedEnd: stamp(end),
      risk,
      missingMinutes: Math.ceil(missing),
      slackMinutes: Math.floor(slack),
      reason:
        risk === "late"
          ? "Mevcut kapasiteyle termin tarihine yetişmiyor."
          : risk === "tight"
            ? "Termin öncesinde çalışma tamponu az."
            : risk === "overdue"
              ? "Termin geçti; iş henüz tamamlanmadı."
              : "",
    });
    for (const [a, b] of segments) free = subtract(free, a, b);
  }
  return jobs.map(
    (j) =>
      results.get(j.id) || {
        ...j,
        segments: [],
        plannedStart: j.status === "Tamamlandı" ? j.plannedStart : null,
        plannedEnd: j.status === "Tamamlandı" ? j.plannedEnd : null,
        risk: j.status === "Tamamlandı" ? "completed" : "paused",
        missingMinutes: 0,
      },
  );
}
