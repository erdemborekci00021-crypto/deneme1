// Portable Windows entry point. No installed Node, npm or network required.
import { spawn } from "node:child_process";
process.env.NODE_ENV = "production";
process.env.HOST = "127.0.0.1";
process.env.PORT = process.env.PORT || "3000";
delete process.env.DB_PATH;
await import("./server/index.js");
const url = `http://127.0.0.1:${process.env.PORT}`;
let attempts = 0;
const timer = setInterval(async () => {
  try {
    const response = await fetch(`${url}/api/state`);
    if (!response.ok) return;
    const state = await response.json();
    if (!state.settings?.machineName || !Array.isArray(state.jobs)) return;
    clearInterval(timer);
    console.log(`Tarayıcıda açın: ${url}`);
    if (process.platform === "win32") {
      const browser = spawn("cmd.exe", ["/d", "/c", "start", "", url], {
        windowsHide: true,
        stdio: "ignore",
      });
      browser.on("error", () => console.log("Tarayıcıyı elle açabilirsiniz."));
    }
  } catch {
    if (++attempts >= 30) {
      clearInterval(timer);
      console.error("Uygulama başlamadı; sunucu hata mesajını kontrol edin.");
    }
  }
}, 1000);
