import express from "express";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  plan,
  defaultSettings,
  workshopNow,
  duration,
  parse,
} from "./planner.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(path.join(root, "data"), { recursive: true });
const db = new DatabaseSync(
  process.env.DB_PATH || path.join(root, "data", "workshop.sqlite"),
);
db.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, jobId INTEGER, at TEXT, action TEXT); CREATE TABLE IF NOT EXISTS files (jobId INTEGER PRIMARY KEY, name TEXT, mime TEXT, data BLOB);",
);
const settings = () =>
  JSON.parse(db.prepare("SELECT body FROM config WHERE id=1").get().body);
if (!db.prepare("SELECT id FROM config").get()) {
  db.prepare("INSERT INTO config VALUES (1,?)").run(
    JSON.stringify(defaultSettings),
  );
  const examples = [
    ["Gövde", 600, "2026-10-20", "Atlas Makine", "Alüminyum 6082"],
    ["Flanş", 180, "2026-10-27", "Eksen Otomasyon", "Çelik C45"],
    ["Kapak", 300, "2026-10-22", "Atlas Makine", "Alüminyum 7075"],
    ["Bağlantı Parçası", 480, "2026-10-30", "Nova Endüstri", "Paslanmaz 304"],
  ];
  examples.forEach(([part, processingMinutes, date, customer, material], i) =>
    db
      .prepare("INSERT INTO jobs(body) VALUES (?)")
      .run(
        JSON.stringify({
          orderNo: `IE-${1025 + i}`,
          part,
          drawing: `TR-${240 + i}`,
          customer,
          quantity: [12, 25, 8, 20][i],
          processingMinutes,
          setupMinutes: 0,
          toolMinutes: 0,
          inspectionMinutes: 0,
          due: `${date}T17:00`,
          priority: "Normal",
          material,
          status: "Bekliyor",
          splittable: true,
          notes: "",
          tooling: "",
          machineId: 1,
        }),
      ),
  );
}
const jobs = () =>
  db
    .prepare(
      "SELECT jobs.*, files.name AS attachmentName FROM jobs LEFT JOIN files ON jobs.id=files.jobId ORDER BY jobs.id",
    )
    .all()
    .map((r) => ({
      ...JSON.parse(r.body),
      id: r.id,
      attachmentName: r.attachmentName,
    }));
const history = (id, action) =>
  db
    .prepare("INSERT INTO history(jobId,at,action) VALUES (?,?,?)")
    .run(id, workshopNow(), action);
function savePlan() {
  const before = jobs();
  const after = plan(before, settings());
  db.exec("BEGIN");
  try {
    for (const j of after)
      db.prepare("UPDATE jobs SET body=? WHERE id=?").run(
        JSON.stringify(j),
        j.id,
      );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return after;
}
function validate(j) {
  if (!j.orderNo?.trim() || !j.part?.trim() || !j.customer?.trim())
    throw Error("İş emri, parça ve müşteri alanlarını doldurun.");
  for (const key of [
    "processingMinutes",
    "setupMinutes",
    "toolMinutes",
    "inspectionMinutes",
  ])
    if (
      !Number.isFinite(Number(j[key])) ||
      Number(j[key]) < 0 ||
      Number(j[key]) > 525600
    )
      throw Error("Süreler 0–525600 dakika arasında olmalı.");
  if (duration(j) <= 0) throw Error("Toplam süre sıfırdan büyük olmalı.");
  if (!Number.isInteger(Number(j.quantity)) || j.quantity < 1)
    throw Error("Adet pozitif tam sayı olmalı.");
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(j.due) ||
    !Number.isFinite(parse(j.due))
  )
    throw Error("Geçerli termin tarihi ve saati girin.");
  if (
    !["Çok Acil", "Acil", "Normal", "Düşük"].includes(j.priority) ||
    ![
      "Bekliyor",
      "Planlandı",
      "Üretimde",
      "Tamamlandı",
      "Beklemede",
      "İptal edildi",
    ].includes(j.status)
  )
    throw Error("Öncelik veya durum geçersiz.");
  if (
    j.manualStart &&
    (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(j.manualStart) ||
      !Number.isFinite(parse(j.manualStart)))
  )
    throw Error("Manuel başlangıç geçersiz.");
  if (j.actualStart && j.actualEnd && parse(j.actualEnd) < parse(j.actualStart))
    throw Error("Gerçek bitiş başlangıçtan önce olamaz.");
  if (
    j.actualMinutes !== undefined &&
    (!Number.isFinite(Number(j.actualMinutes)) || Number(j.actualMinutes) < 0)
  )
    throw Error("Gerçek süre geçersiz.");
}
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.get("/api/state", (req, res) =>
  res.json({ jobs: savePlan(), settings: settings(), now: workshopNow() }),
);
app.post("/api/jobs", (req, res) => {
  validate(req.body);
  if (jobs().some((j) => j.orderNo === req.body.orderNo))
    throw Error("Bu iş emri numarası zaten var.");
  const r = db
    .prepare("INSERT INTO jobs(body) VALUES (?)")
    .run(JSON.stringify({ ...req.body, machineId: 1 }));
  history(Number(r.lastInsertRowid), "İş emri oluşturuldu");
  res.status(201).json({ jobs: savePlan(), id: Number(r.lastInsertRowid) });
});
app.put("/api/jobs/:id", (req, res) => {
  const old = jobs().find((j) => j.id === Number(req.params.id));
  if (!old) return res.status(404).json({ error: "İş bulunamadı." });
  const beforeRisks = new Map(jobs().map((j) => [j.id, j.risk]));
  const next = { ...old, ...req.body, id: old.id };
  validate(next);
  if (jobs().some((j) => j.id !== old.id && j.orderNo === next.orderNo))
    throw Error("Bu iş emri numarası zaten var.");
  if (next.status === "Üretimde" && old.status !== "Üretimde")
    next.actualStart = req.body.actualStart || workshopNow();
  if (next.status === "Tamamlandı" && old.status !== "Tamamlandı") {
    next.actualEnd = req.body.actualEnd || workshopNow();
    if (next.actualStart && req.body.actualMinutes == null)
      next.actualMinutes = Math.round(
        (parse(next.actualEnd) - parse(next.actualStart)) / 60000,
      );
  }
  db.prepare("UPDATE jobs SET body=? WHERE id=?").run(
    JSON.stringify(next),
    old.id,
  );
  history(
    old.id,
    `İş güncellendi • ${next.status}${next.manualStart ? " • Manuel başlangıç: " + next.manualStart : ""}`,
  );
  const after = savePlan();
  res.json({
    jobs: after,
    affected: after.filter(
      (j) =>
        ["late", "overdue"].includes(j.risk) &&
        !["late", "overdue"].includes(beforeRisks.get(j.id)),
    ).length,
  });
});
app.delete("/api/jobs/:id", (req, res) => {
  db.prepare("DELETE FROM jobs WHERE id=?").run(req.params.id);
  db.prepare("DELETE FROM files WHERE jobId=?").run(req.params.id);
  history(Number(req.params.id), "İş silindi");
  res.json({ jobs: savePlan() });
});
app.get("/api/jobs/:id/history", (req, res) =>
  res.json(
    db
      .prepare("SELECT * FROM history WHERE jobId=? ORDER BY id DESC")
      .all(req.params.id),
  ),
);
app.post(
  "/api/jobs/:id/file",
  express.raw({
    type: ["application/pdf", "image/png", "image/jpeg"],
    limit: "10mb",
  }),
  (req, res) => {
    if (!jobs().some((j) => j.id === Number(req.params.id)))
      return res.sendStatus(404);
    if (!Buffer.isBuffer(req.body))
      throw Error("PDF, PNG veya JPEG dosyası seçin.");
    const mime = req.get("content-type");
    if (
      mime === "application/pdf" &&
      req.body.subarray(0, 5).toString() !== "%PDF-"
    )
      throw Error("Geçerli PDF dosyası değil.");
    if (
      mime === "image/png" &&
      !req.body
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw Error("Geçerli PNG dosyası değil.");
    if (mime === "image/jpeg" && req.body.readUInt16BE(0) !== 0xffd8)
      throw Error("Geçerli JPEG dosyası değil.");
    db.prepare("INSERT OR REPLACE INTO files VALUES (?,?,?,?)").run(
      req.params.id,
      decodeURIComponent(req.get("x-filename") || "Teknik resim"),
      mime,
      req.body,
    );
    history(Number(req.params.id), "Teknik resim yüklendi");
    res.json({ ok: true });
  },
);
app.get("/api/jobs/:id/file", (req, res) => {
  const f = db.prepare("SELECT * FROM files WHERE jobId=?").get(req.params.id);
  if (!f) return res.status(404).send("Teknik resim yüklenmemiş.");
  res
    .set("Content-Type", f.mime)
    .set("X-Content-Type-Options", "nosniff")
    .set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
    )
    .send(Buffer.from(f.data));
});
app.put("/api/settings", (req, res) => {
  const s = req.body;
  const time = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  if (
    !s.machineName?.trim() ||
    !["forward", "backward"].includes(s.mode) ||
    !Number.isFinite(Number(s.riskMinutes)) ||
    s.riskMinutes < 0 ||
    !Array.isArray(s.days) ||
    s.days.length !== 7
  )
    throw Error("Makine ayarları geçersiz.");
  for (const d of s.days)
    if (!time(d.start) || !time(d.end) || d.start >= d.end)
      throw Error("Vardiya bitişi başlangıçtan sonra olmalı.");
  for (const b of s.breaks)
    if (!time(b.start) || !time(b.end) || b.start >= b.end)
      throw Error("Mola saatleri geçersiz.");
  for (const o of s.outages)
    if (
      !Number.isFinite(parse(o.start)) ||
      !Number.isFinite(parse(o.end)) ||
      o.start >= o.end
    )
      throw Error("Duruş tarihleri geçersiz.");
  db.prepare("UPDATE config SET body=? WHERE id=1").run(JSON.stringify(s));
  history(null, "Makine takvimi güncellendi");
  res.json({ jobs: savePlan(), settings: s });
});
app.post("/api/plan", (req, res) => res.json({ jobs: savePlan() }));
if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
}
app.use((err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.status || 400)
    .json({ error: err.message || "İşlem tamamlanamadı." });
});
app.listen(Number(process.env.PORT || 3000), "0.0.0.0", (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log(`Atölye hazır • port ${process.env.PORT || 3000}`);
});
