import React, { useState } from "react";
import {
  Clock3,
  Settings2,
  ShieldAlert,
  Plus,
  X,
  Trash2,
  Check,
} from "lucide-react";
export default function SettingsForm({ settings, working, save }) {
  const [s, setS] = useState(structuredClone(settings));
  const weekdays = [
    "Pazar",
    "Pazartesi",
    "Salı",
    "Çarşamba",
    "Perşembe",
    "Cuma",
    "Cumartesi",
  ];
  const updateDay = (i, k, v) =>
    setS((x) => ({
      ...x,
      days: x.days.map((d, n) => (n === i ? { ...d, [k]: v } : d)),
    }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(s);
      }}
    >
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Çalışma takvimi</h2>
              <p>Her gün için vardiya saatlerini tanımlayın.</p>
            </div>
            <Clock3 size={20} />
          </div>
          <div className="settings-body">
            <label className="field">
              <span>Makine adı</span>
              <input
                required
                value={s.machineName}
                onChange={(e) => setS({ ...s, machineName: e.target.value })}
              />
            </label>
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <div className="shift-row" key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={s.days[i].enabled}
                    onChange={(e) => updateDay(i, "enabled", e.target.checked)}
                  />
                  {weekdays[i]}
                </label>
                <input
                  aria-label={weekdays[i] + " başlangıç"}
                  type="time"
                  required
                  value={s.days[i].start}
                  onChange={(e) => updateDay(i, "start", e.target.value)}
                />
                <span>—</span>
                <input
                  aria-label={weekdays[i] + " bitiş"}
                  type="time"
                  required
                  value={s.days[i].end}
                  onChange={(e) => updateDay(i, "end", e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Planlama tercihleri</h2>
              <p>Termin hesabı ve kapasite kuralları</p>
            </div>
            <Settings2 size={20} />
          </div>
          <div className="settings-body">
            <label className="field">
              <span>Planlama yöntemi</span>
              <select
                value={s.mode}
                onChange={(e) => setS({ ...s, mode: e.target.value })}
              >
                <option value="forward">
                  İleri — mümkün olan en erken başlangıç
                </option>
                <option value="backward">
                  Geriye doğru — termin öncesi en geç başlangıç
                </option>
              </select>
            </label>
            <label className="field">
              <span>Riskli sayılacak çalışma tamponu (dk)</span>
              <input
                type="number"
                min={0}
                required
                value={s.riskMinutes}
                onChange={(e) => setS({ ...s, riskMinutes: +e.target.value })}
              />
            </label>
            <div className="info-box">
              <ShieldAlert size={19} />
              <p>
                Önce manuel başlangıçlar ve üretimdeki işler, ardından öncelik
                ve en erken termin dikkate alınır. Geriye planlama termine
                sığmazsa ilk uygun kapasiteye yerleşir ve gecikme uyarısı
                gösterir.
              </p>
            </div>
            <h3>Günlük molalar</h3>
            {s.breaks.map((b, i) => (
              <div className="break-row" key={i}>
                <input
                  aria-label="Mola adı"
                  value={b.name}
                  onChange={(e) =>
                    setS({
                      ...s,
                      breaks: s.breaks.map((x, n) =>
                        n === i ? { ...x, name: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  aria-label="Mola başlangıç"
                  type="time"
                  required
                  value={b.start}
                  onChange={(e) =>
                    setS({
                      ...s,
                      breaks: s.breaks.map((x, n) =>
                        n === i ? { ...x, start: e.target.value } : x,
                      ),
                    })
                  }
                />
                <input
                  aria-label="Mola bitiş"
                  type="time"
                  required
                  value={b.end}
                  onChange={(e) =>
                    setS({
                      ...s,
                      breaks: s.breaks.map((x, n) =>
                        n === i ? { ...x, end: e.target.value } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Molayı sil"
                  onClick={() =>
                    setS({ ...s, breaks: s.breaks.filter((_, n) => n !== i) })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button
              className="text-btn"
              type="button"
              onClick={() =>
                setS({
                  ...s,
                  breaks: [
                    ...s.breaks,
                    { name: "Mola", start: "15:00", end: "15:15" },
                  ],
                })
              }
            >
              <Plus size={15} />
              Mola ekle
            </button>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Çalışılmayan zamanlar</h2>
            <p>Tatil, bakım, arıza, izin veya planlı duruş ekleyin.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() =>
              setS({
                ...s,
                outages: [
                  ...s.outages,
                  {
                    name: "Makine bakımı",
                    start: workshopDate() + "T08:00",
                    end: workshopDate() + "T18:00",
                  },
                ],
              })
            }
          >
            <Plus size={16} />
            Duruş ekle
          </button>
        </div>
        <div className="settings-body">
          {s.outages.map((o, i) => (
            <div className="outage-row" key={i}>
              {["name", "start", "end"].map((k) => (
                <label className="field" key={k}>
                  <span>
                    {k === "name"
                      ? "Duruş açıklaması"
                      : k === "start"
                        ? "Başlangıç"
                        : "Bitiş"}
                  </span>
                  <input
                    required
                    type={k === "name" ? "text" : "datetime-local"}
                    value={o[k]}
                    onChange={(e) =>
                      setS({
                        ...s,
                        outages: s.outages.map((x, n) =>
                          n === i ? { ...x, [k]: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="icon-btn"
                aria-label="Duruşu sil"
                onClick={() =>
                  setS({ ...s, outages: s.outages.filter((_, n) => n !== i) })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          {!s.outages.length && (
            <div className="empty">Henüz tanımlanmış duruş yok.</div>
          )}
        </div>
      </section>
      <div className="settings-save">
        <span>Değişiklikler tüm aktif işlerin planını yeniden hesaplar.</span>
        <button className="btn primary" disabled={working} type="submit">
          <Check size={16} />
          Ayarları kaydet ve planla
        </button>
      </div>
    </form>
  );
}
function workshopDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
  }).format(new Date());
}
