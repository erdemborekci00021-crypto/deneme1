import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
test("API CRUD, scheduling, attachments and persistence across restart", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "cnc-api-"));
  let proc;
  const port = 32000 + Math.floor(Math.random() * 10000),
    url = `http://127.0.0.1:${port}`;
  const start = async () => {
    proc = spawn(process.execPath, ["server/index.js"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        DB_PATH: path.join(folder, "test.sqlite"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let logs = "";
    proc.stderr.on("data", (x) => (logs += x));
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch(url + "/api/state");
        if (r.ok) return;
      } catch {}
      if (proc.exitCode !== null) throw Error(logs);
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error("Server did not start: " + logs);
  };
  const stop = async () => {
    const exited = once(proc, "exit");
    proc.kill();
    await exited;
  };
  const call = async (p, method = "GET", body) => {
    const r = await fetch(url + "/api" + p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    await start();
    const initial = (await call("/state")).data;
    assert.equal(initial.jobs.length, 4);
    const input = {
      orderNo: "TEST-1",
      part: "Test flanş",
      drawing: "T1",
      customer: "Test müşteri",
      quantity: 2,
      processingMinutes: 60,
      setupMinutes: 15,
      toolMinutes: 0,
      inspectionMinutes: 5,
      due: "2026-10-27T17:00",
      priority: "Acil",
      status: "Bekliyor",
      splittable: true,
    };
    const create = await call("/jobs", "POST", input);
    assert.equal(create.status, 201);
    const id = create.data.id;
    assert.ok(create.data.jobs.find((j) => j.id === id).segments.length);
    assert.equal((await call("/jobs", "POST", input)).status, 400);
    assert.equal(
      (
        await call("/jobs", "POST", {
          ...input,
          orderNo: "BAD",
          processingMinutes: -1,
        })
      ).status,
      400,
    );
    const move = await call("/jobs/" + id, "PUT", {
      manualStart: "2026-10-26T08:00",
    });
    assert.equal(move.status, 200);
    assert.equal(
      move.data.jobs.find((j) => j.id === id).plannedStart,
      "2026-10-26T08:00",
    );
    const pdf = Buffer.from("%PDF-1.4\n%%EOF");
    const upload = await fetch(url + `/api/jobs/${id}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "X-Filename": "test.pdf" },
      body: pdf,
    });
    assert.equal(upload.status, 200);
    const download = await fetch(url + `/api/jobs/${id}/file`);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
    assert.ok((await call("/jobs/" + id + "/history")).data.length >= 3);
    const cfg = initial.settings;
    cfg.outages.push({
      name: "Test bakım",
      start: "2026-10-26T08:00",
      end: "2026-10-26T10:00",
    });
    const update = await call("/settings", "PUT", cfg);
    assert.equal(update.status, 200);
    assert.equal(
      update.data.jobs.find((j) => j.id === id).plannedStart,
      "2026-10-26T10:00",
    );
    cfg.days[1].end = "07:00";
    assert.equal((await call("/settings", "PUT", cfg)).status, 400);
    await stop();
    await start();
    const restored = (await call("/state")).data;
    assert.equal(restored.jobs.length, 5);
    assert.equal(restored.settings.outages[0].name, "Test bakım");
    assert.equal(restored.jobs.find((j) => j.id === id).part, "Test flanş");
    const complete = await call("/jobs/" + id, "PUT", {
      status: "Tamamlandı",
      actualMinutes: 90,
      actualStart: "2026-10-07T08:00",
      actualEnd: "2026-10-07T09:30",
    });
    assert.equal(complete.status, 200);
    assert.equal(complete.data.jobs.find((j) => j.id === id).actualMinutes, 90);
    assert.equal(complete.data.jobs.find((j) => j.id === id).risk, "completed");
    assert.equal(
      complete.data.jobs.find((j) => j.id === id).plannedStart,
      "2026-10-26T10:00",
    );
    assert.equal((await call("/jobs/" + id, "DELETE")).status, 200);
    assert.equal((await call("/state")).data.jobs.length, 4);
  } finally {
    if (proc && proc.exitCode === null) await stop();
    rmSync(folder, { recursive: true, force: true });
  }
});
