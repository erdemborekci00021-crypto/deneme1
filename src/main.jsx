import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  ShieldAlert,
  Settings2,
  ChartNoAxesCombined,
  Plus,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Clock3,
  Check,
  Factory,
  ChevronDown,
  Download,
  Menu,
  Play,
  CheckCheck,
  Paperclip,
  Trash2,
  Pause,
  ArrowRight,
} from "lucide-react";
import "./style.css";
const nav = [
  ["dashboard", "Genel bakış", LayoutDashboard],
  ["jobs", "İş emirleri", ClipboardList],
  ["calendar", "Üretim takvimi", CalendarDays],
  ["risk", "Termin takibi", ShieldAlert],
  ["reports", "Raporlar", ChartNoAxesCombined],
  ["settings", "Makine ayarları", Settings2],
];
import {
  colors,
  date,
  longDate,
  time,
  fmt,
  total,
  ms,
  plusDay,
  busy,
  cap,
  pct,
  api,
} from "./utils.js";
import Badge from "./components/Badge.jsx";
import JobForm from "./components/JobForm.jsx";
import SettingsForm from "./components/SettingsForm.jsx";
function App() {
  const [state, setState] = useState(null),
    [page, setPage] = useState("dashboard"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [sort, setSort] = useState("due"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [menu, setMenu] = useState(false),
    [view, setView] = useState("week"),
    [day, setDay] = useState(""),
    [history, setHistory] = useState([]),
    [customer, setCustomer] = useState(""),
    [priority, setPriority] = useState("");
  useEffect(() => {
    api("/state")
      .then((s) => {
        setState(s);
        setDay(s.now.slice(0, 10));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function act(path, method, body, msg = "Kaydedildi") {
    setWorking(true);
    setError("");
    try {
      const r = await api(path, method, body);
      setState((s) => ({ ...s, ...r }));
      const late = r.jobs?.filter((j) => ["late", "overdue"].includes(j.risk));
      setToast(
        msg +
          (late?.length ? ` • ${late.length} iş için termin uyarısı var.` : ""),
      );
      return r;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setWorking(false);
    }
  }
  if (!state)
    return (
      <div className="loading">
        <Factory size={40} />
        <h2>Atölyeniz hazırlanıyor</h2>
        <p>{error || "Üretim planı yükleniyor…"}</p>
      </div>
    );
  const { jobs, settings, now } = state,
    today = now.slice(0, 10),
    todayWork = busy(jobs, today),
    todayCap = cap(settings, today),
    active = jobs.filter(
      (j) => !["Tamamlandı", "İptal edildi"].includes(j.status),
    ),
    risks = active.filter((j) => ["tight", "late", "overdue"].includes(j.risk)),
    completed = jobs.filter((j) => j.status === "Tamamlandı");
  const todaySegments = jobs
    .flatMap((j) =>
      (j.segments || [])
        .filter((s) => s.start.slice(0, 10) === today)
        .map((s) => ({ ...s, job: j })),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const weekStart = plusDay(
    today,
    -((new Date(today + "T12:00Z").getUTCDay() + 6) % 7),
  );
  const utilization = (start, count) => {
    let planned = 0,
      capacity = 0;
    for (let i = 0; i < count; i++) {
      const d = plusDay(start, i);
      planned += busy(jobs, d);
      capacity += cap(settings, d);
    }
    return { planned, capacity, percent: pct(planned, capacity) };
  };
  const weekly = utilization(weekStart, 7),
    monthly = utilization(
      today.slice(0, 7) + "-01",
      new Date(+today.slice(0, 4), +today.slice(5, 7), 0).getDate(),
    );
  const openJob = async (j) => {
    setModal(j);
    setHistory(await api(`/jobs/${j.id}/history`));
  };
  const go = (p) => {
    setPage(p);
    setMenu(false);
    setFilter("all");
    setQuery("");
  };
  const filtered = jobs
    .filter((j) =>
      [j.orderNo, j.part, j.customer, j.drawing].some((v) =>
        v?.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")),
      ),
    )
    .filter((j) => !customer || j.customer === customer)
    .filter((j) => !priority || j.priority === priority)
    .filter(
      (j) => page !== "risk" || ["tight", "late", "overdue"].includes(j.risk),
    )
    .filter(
      (j) =>
        filter === "all" ||
        (filter === "today" &&
          j.segments.some((s) => s.start.slice(0, 10) === today)) ||
        (filter === "week" &&
          j.segments.some(
            (s) =>
              s.start.slice(0, 10) >= weekStart &&
              s.start.slice(0, 10) < plusDay(weekStart, 7),
          )) ||
        (filter === "next" &&
          j.segments.some(
            (s) =>
              s.start.slice(0, 10) >= plusDay(weekStart, 7) &&
              s.start.slice(0, 10) < plusDay(weekStart, 14),
          )) ||
        (filter === "late" && ["late", "overdue"].includes(j.risk)) ||
        (filter === "risk" && ["tight", "late", "overdue"].includes(j.risk)) ||
        (filter === "done" && j.status === "Tamamlandı") ||
        (filter === "waiting" &&
          ["Bekliyor", "Planlandı", "Beklemede"].includes(j.status)),
    )
    .sort((a, b) =>
      sort === "risk"
        ? ["overdue", "late", "tight", "safe", "paused", "completed"].indexOf(
            a.risk,
          ) -
          ["overdue", "late", "tight", "safe", "paused", "completed"].indexOf(
            b.risk,
          )
        : sort === "priority"
          ? ["Çok Acil", "Acil", "Normal", "Düşük"].indexOf(a.priority) -
            ["Çok Acil", "Acil", "Normal", "Düşük"].indexOf(b.priority)
          : (a[sort] || "z").localeCompare(b[sort] || "z"),
    );
  function table(items) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>İŞ EMRİ / PARÇA</th>
              <th>MÜŞTERİ</th>
              <th>TOPLAM SÜRE</th>
              <th>TERMİN</th>
              <th>ÖNCELİK</th>
              <th>PLANLANAN BAŞLANGIÇ / BİTİŞ</th>
              <th>DURUM</th>
              <th>TERMİN DURUMU</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((j) => (
              <tr
                key={j.id}
                onClick={() => openJob(j)}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && openJob(j)}
              >
                <td>
                  <b>{j.part}</b>
                  <small>
                    {j.orderNo} · {j.drawing || "Resim no yok"}
                  </small>
                </td>
                <td>{j.customer}</td>
                <td>{fmt(total(j))}</td>
                <td>
                  {date(j.due)}
                  <small>{time(j.due)}</small>
                </td>
                <td>
                  <span
                    className={
                      "priority p" +
                      ["Çok Acil", "Acil", "Normal", "Düşük"].indexOf(
                        j.priority,
                      )
                    }
                  >
                    {j.priority}
                  </span>
                </td>
                <td>
                  {date(j.plannedStart)} {time(j.plannedStart)}
                  <small>
                    {date(j.plannedEnd)} {time(j.plannedEnd)}
                  </small>
                </td>
                <td>{j.status}</td>
                <td>
                  <Badge risk={j.risk} />
                </td>
                <td>
                  <ArrowUpRight size={16} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <div className="empty">Bu görünümde iş emri bulunmuyor.</div>
        )}
      </div>
    );
  }
  function summaryCard(title, value, sub, Icon, cls = "") {
    return (
      <div className={"metric " + cls}>
        <div className="metric-top">
          <span>{title}</span>
          <Icon size={19} />
        </div>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    );
  }
  return (
    <div className="app">
      <aside className={menu ? "sidebar expanded" : "sidebar"}>
        <a className="brand" onClick={() => go("dashboard")}>
          <span className="brand-mark">
            <Factory size={22} />
          </span>
          atölye<span className="brand-dot">.</span>
        </a>
        <div className="workspace-label">ÜRETİM YÖNETİMİ</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              className={page === id ? "nav active" : "nav"}
              key={id}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {label}
              {id === "risk" && risks.length > 0 && (
                <span className="nav-count">{risks.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="machine-indicator">
            <span className="online" />
            <div>
              <b>{settings.machineName}</b>
              <small>Tek makine · İstanbul</small>
            </div>
          </div>
          <div className="profile">
            <span>EA</span>
            <div>
              <b>Atölye yöneticisi</b>
              <small>Üretim çalışma alanı</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-btn"
              aria-label="Menüyü aç"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            Çalışma alanı <span>/</span>
            <b>{nav.find((n) => n[0] === page)[1]}</b>
          </div>
          <div className="top-right">
            <span className="live-dot" /> Kayıtlar kalıcı{" "}
            <div className="avatar">EA</div>
          </div>
        </header>
        <div className="content">
          <div className="page-title">
            <div>
              <div className="eyebrow">CNC ÜRETİM PLANLAMA</div>
              <h1>
                {page === "dashboard"
                  ? "Atölyenize genel bakış"
                  : nav.find((n) => n[0] === page)[1]}
              </h1>
              <p>
                {page === "dashboard"
                  ? `${longDate(today)} · İşlerinizi planlayın, terminlerinizi kontrol altında tutun.`
                  : page === "calendar"
                    ? "Makinenizin çalışma takvimi, tek bir yerde."
                    : page === "risk"
                      ? "Yaklaşan teslim tarihlerini ve kapasite risklerini takip edin."
                      : page === "settings"
                        ? "Çalışma saatleri, molalar ve planlı duruşları yönetin."
                        : page === "reports"
                          ? "Üretim ve kapasite verilerinizi değerlendirin."
                          : "Tüm üretim işleriniz ve planlama bilgileri."}
              </p>
            </div>
            <div className="title-actions">
              {page !== "settings" && (
                <button
                  className="btn"
                  disabled={working}
                  onClick={() =>
                    act("/plan", "POST", {}, "Üretim planı yeniden hesaplandı")
                  }
                >
                  <RefreshCw size={16} className={working ? "spin" : ""} />
                  Yeniden planla
                </button>
              )}
              <button
                className="btn primary"
                onClick={() => {
                  setModal("new");
                  setHistory([]);
                }}
              >
                <Plus size={18} />
                Yeni iş emri
              </button>
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Uyarıyı kapat">
                <X size={16} />
              </button>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <div className="metrics">
                {summaryCard(
                  "Bugünkü üretim",
                  fmt(todayWork),
                  `${todaySegments.length} planlı iş · ${fmt(todayCap)} kapasite`,
                  Clock3,
                )}
                {summaryCard(
                  "Makine doluluğu",
                  `%${pct(todayWork, todayCap)}`,
                  `${fmt(Math.max(0, todayCap - todayWork))} boş kapasite`,
                  ChartNoAxesCombined,
                )}
                {summaryCard(
                  "Aktif iş emirleri",
                  active.length,
                  `${completed.length} iş tamamlandı`,
                  ClipboardList,
                )}
                {summaryCard(
                  "Termin uyarıları",
                  risks.length,
                  `${risks.filter((j) => j.risk === "overdue").length} gecikmiş · ${risks.filter((j) => j.risk !== "overdue").length} riskli`,
                  ShieldAlert,
                  risks.length ? "warn" : "",
                )}
              </div>
              <div className="dashboard-grid">
                <section className="panel today-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        Bugünün üretim planı{" "}
                        <span className="count">{todaySegments.length}</span>
                      </h2>
                      <p>İşler, başlangıç saatine göre sıralandı.</p>
                    </div>
                    <button className="text-btn" onClick={() => go("calendar")}>
                      Takvimi aç <ArrowUpRight size={15} />
                    </button>
                  </div>
                  <div className="day-strip">
                    <CalendarDays size={17} />
                    <b>{longDate(today)}</b>
                    <span>{settings.machineName}</span>
                  </div>
                  <div className="production-list">
                    {todaySegments.map((s, i) => (
                      <div
                        className="production-row"
                        key={s.job.id + "-" + s.start}
                        onClick={() => openJob(s.job)}
                      >
                        <div className="production-time">
                          <b>{time(s.start)}</b>
                          <small>{time(s.end)}</small>
                        </div>
                        <div
                          className="job-line"
                          style={{
                            background: colors[(s.job.id - 1) % colors.length],
                          }}
                        />
                        <div className="production-info">
                          <span className="order-label">
                            {s.job.orderNo} <span>· {s.job.customer}</span>
                          </span>
                          <h3>{s.job.part}</h3>
                          <div className="production-meta">
                            <span>
                              <Clock3 size={13} />
                              {fmt((ms(s.end) - ms(s.start)) / 60000)}
                            </span>
                            <span>Termin: {date(s.job.due)}</span>
                          </div>
                        </div>
                        <div className="production-end">
                          <Badge risk={s.job.risk} />
                          <ArrowUpRight size={16} />
                        </div>
                      </div>
                    ))}
                    {!todaySegments.length && (
                      <div className="empty">
                        Bugün planlanmış iş yok. Yeni iş ekleyerek başlayın.
                      </div>
                    )}
                  </div>
                  <div className="panel-footer">
                    <span className="online" />
                    Molalar ve duruşlar otomatik olarak hesaba katılır.
                  </div>
                </section>
                <section className="panel capacity">
                  <div className="panel-heading">
                    <div>
                      <h2>Makine kapasitesi</h2>
                      <p>{settings.machineName}</p>
                    </div>
                    <Factory size={20} />
                  </div>
                  <div
                    className="ring"
                    style={{
                      "--percent":
                        Math.min(100, pct(todayWork, todayCap)) + "%",
                    }}
                  >
                    <div>
                      <strong>%{pct(todayWork, todayCap)}</strong>
                      <small>bugünkü doluluk</small>
                    </div>
                  </div>
                  <div className="capacity-legend">
                    <span>
                      <i />
                      Planlanan <b>{fmt(todayWork)}</b>
                    </span>
                    <span>
                      <i />
                      Boş kapasite{" "}
                      <b>{fmt(Math.max(0, todayCap - todayWork))}</b>
                    </span>
                  </div>
                  <div className="mini-bar">
                    <div>
                      <span>Bu hafta</span>
                      <b>%{weekly.percent}</b>
                    </div>
                    <div className="bar">
                      <i
                        style={{ width: Math.min(100, weekly.percent) + "%" }}
                      />
                    </div>
                  </div>
                  <div className="mini-bar">
                    <div>
                      <span>Bu ay</span>
                      <b>%{monthly.percent}</b>
                    </div>
                    <div className="bar">
                      <i
                        style={{ width: Math.min(100, monthly.percent) + "%" }}
                      />
                    </div>
                  </div>
                  <button className="text-btn" onClick={() => go("settings")}>
                    Çalışma saatlerini düzenle <ArrowRight size={14} />
                  </button>
                </section>
              </div>
              <section className="panel upcoming">
                <div className="panel-heading">
                  <div>
                    <h2>Yaklaşan terminler</h2>
                    <p>Teslim tarihi en yakın olan aktif işler.</p>
                  </div>
                  <button className="text-btn" onClick={() => go("jobs")}>
                    Tüm iş emirleri <ArrowUpRight size={15} />
                  </button>
                </div>
                {table(
                  [...active]
                    .sort((a, b) => a.due.localeCompare(b.due))
                    .slice(0, 5),
                )}
              </section>
              {risks.length > 0 && (
                <section className="risk-banner">
                  <ShieldAlert />
                  <div>
                    <h3>{risks.length} iş için termin kontrolü gerekiyor</h3>
                    <p>
                      {risks.map((j) => j.orderNo).join(", ")} — kapasite ve
                      öncelikleri gözden geçirin.
                    </p>
                  </div>
                  <button className="btn" onClick={() => go("risk")}>
                    Riskleri incele <ArrowRight size={15} />
                  </button>
                </section>
              )}
              <div className="bottom-note">
                <span>
                  <span className="live-dot" />
                  Otomatik planlama aktif
                </span>
                <span>
                  Öncelik + en erken termin ·{" "}
                  {settings.mode === "forward" ? "İleri" : "Geriye doğru"}{" "}
                  planlama
                </span>
              </div>
            </>
          )}
          {["jobs", "risk"].includes(page) && (
            <>
              <div className="filter-tabs">
                {[
                  ["all", page === "risk" ? "Tüm uyarılar" : "Tüm işler"],
                  ["today", "Bugün"],
                  ["week", "Bu hafta"],
                  ["next", "Gelecek hafta"],
                  ["late", "Geciken"],
                  ["risk", "Riskli"],
                  ["done", "Tamamlanan"],
                  ["waiting", "Bekleyen"],
                ].map(([v, l]) => (
                  <button
                    key={v}
                    className={filter === v ? "selected" : ""}
                    onClick={() => setFilter(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <section className="panel">
                <div className="list-controls">
                  <div className="search">
                    <Search size={17} />
                    <input
                      aria-label="İş emri ara"
                      placeholder="İş emri, parça, müşteri veya resim no ara…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <select
                    aria-label="Müşteri filtresi"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                  >
                    <option value="">Tüm müşteriler</option>
                    {[...new Set(jobs.map((j) => j.customer))].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Öncelik filtresi"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="">Tüm öncelikler</option>
                    {["Çok Acil", "Acil", "Normal", "Düşük"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Sıralama"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="due">Termin sırası</option>
                    <option value="priority">Öncelik sırası</option>
                    <option value="plannedStart">Başlangıç sırası</option>
                    <option value="risk">Risk sırası</option>
                  </select>
                </div>
                {table(filtered)}
                <div className="panel-footer">
                  {filtered.length} iş emri gösteriliyor · Detay için bir satıra
                  tıklayın.
                </div>
              </section>
              {page === "risk" &&
                risks.map((j) => (
                  <div className="risk-banner" key={j.id}>
                    <ShieldAlert />
                    <div>
                      <h3>
                        {j.orderNo} · {j.part}
                      </h3>
                      <p>
                        {j.reason}{" "}
                        {j.missingMinutes > 0 &&
                          `Termin öncesinde gereken ek kapasite: ${fmt(j.missingMinutes)}.`}
                      </p>
                    </div>
                    <button className="btn" onClick={() => openJob(j)}>
                      İşi incele
                    </button>
                  </div>
                ))}
            </>
          )}
          {page === "calendar" && (
            <section className="panel">
              <div className="calendar-toolbar">
                <div className="view-switch">
                  {[
                    ["day", "Gün"],
                    ["week", "Hafta"],
                    ["month", "Ay"],
                  ].map(([v, l]) => (
                    <button
                      key={v}
                      className={view === v ? "selected" : ""}
                      onClick={() => setView(v)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="date-nav">
                  <button
                    className="icon-btn"
                    aria-label="Önceki"
                    onClick={() =>
                      setDay(
                        plusDay(
                          day,
                          view === "day" ? -1 : view === "week" ? -7 : -30,
                        ),
                      )
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <b>{longDate(day)}</b>
                  <button
                    className="icon-btn"
                    aria-label="Sonraki"
                    onClick={() =>
                      setDay(
                        plusDay(
                          day,
                          view === "day" ? 1 : view === "week" ? 7 : 30,
                        ),
                      )
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button className="btn" onClick={() => setDay(today)}>
                    Bugün
                  </button>
                  <input
                    aria-label="Takvim tarihi"
                    type="date"
                    value={day}
                    onChange={(e) => setDay(e.target.value || today)}
                  />
                </div>
              </div>
              <div className="calendar-hint">
                <Factory size={16} />
                {settings.machineName}
                <span>
                  İşi başka bir güne/saat aralığına sürükleyin. Diğer işler
                  yeniden hesaplanır.
                </span>
              </div>
              {view === "month" ? (
                <div className="month-grid">
                  {Array.from(
                    {
                      length: new Date(
                        +day.slice(0, 4),
                        +day.slice(5, 7),
                        0,
                      ).getDate(),
                    },
                    (_, i) =>
                      day.slice(0, 7) + "-" + String(i + 1).padStart(2, "0"),
                  ).map((d) => (
                    <div
                      className={"month-day " + (d === today ? "is-today" : "")}
                      key={d}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        const id = +e.dataTransfer.getData("text/plain");
                        if (id)
                          act(
                            "/jobs/" + id,
                            "PUT",
                            { manualStart: d + "T08:00" },
                            "İş taşındı; plan güncellendi",
                          );
                      }}
                    >
                      <b>
                        {d.slice(-2)}{" "}
                        <small>
                          {new Date(d + "T12:00Z").toLocaleDateString("tr-TR", {
                            weekday: "short",
                          })}
                        </small>
                      </b>
                      {jobs
                        .filter((j) =>
                          j.segments.some((s) => s.start.slice(0, 10) === d),
                        )
                        .map((j) => (
                          <button
                            key={j.id}
                            draggable
                            onDragStart={(e) =>
                              e.dataTransfer.setData("text/plain", j.id)
                            }
                            style={{
                              borderLeftColor:
                                colors[(j.id - 1) % colors.length],
                            }}
                            onClick={() => openJob(j)}
                          >
                            {j.orderNo} · {j.part}
                          </button>
                        ))}
                      <small>
                        {fmt(busy(jobs, d))} / {fmt(cap(settings, d))}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="gantt-wrap">
                  <div className="gantt">
                    <div className="gantt-head">
                      <div>GÜN / SAAT</div>
                      {Array.from({ length: 24 }, (_, i) => (
                        <span key={i}>{String(i).padStart(2, "0")}:00</span>
                      ))}
                    </div>
                    {Array.from({ length: view === "day" ? 1 : 7 }, (_, i) =>
                      plusDay(day, i),
                    ).map((d) => {
                      const shift =
                        settings.days[new Date(d + "T12:00Z").getUTCDay()];
                      return (
                        <div className="gantt-row" key={d}>
                          <div
                            className={
                              "gantt-date " + (d === today ? "current" : "")
                            }
                          >
                            <b>
                              {new Date(d + "T12:00Z").toLocaleDateString(
                                "tr-TR",
                                {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                },
                              )}
                            </b>
                            <small>
                              {fmt(busy(jobs, d))} / {fmt(cap(settings, d))}
                            </small>
                          </div>
                          <div className="gantt-track">
                            {Array.from({ length: 24 }, (_, h) => (
                              <div
                                className={
                                  "hour-cell " +
                                  (!shift.enabled ||
                                  h < +shift.start.slice(0, 2) ||
                                  h >= +shift.end.slice(0, 2)
                                    ? "off"
                                    : "")
                                }
                                key={h}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  const id =
                                    +e.dataTransfer.getData("text/plain");
                                  if (id)
                                    act(
                                      "/jobs/" + id,
                                      "PUT",
                                      {
                                        manualStart:
                                          d +
                                          "T" +
                                          String(h).padStart(2, "0") +
                                          ":00",
                                      },
                                      "İş taşındı; terminler yeniden hesaplandı",
                                    );
                                }}
                              />
                            ))}
                            {settings.breaks.map((b, i) => (
                              <div
                                key={"break" + i}
                                className="pause-block"
                                style={{
                                  left:
                                    ((+b.start.slice(0, 2) +
                                      +b.start.slice(3) / 60) /
                                      24) *
                                      100 +
                                    "%",
                                  width:
                                    ((ms(d + "T" + b.end) -
                                      ms(d + "T" + b.start)) /
                                      60000 /
                                      1440) *
                                      100 +
                                    "%",
                                }}
                                title={b.name}
                              >
                                Mola
                              </div>
                            ))}
                            {settings.outages
                              .filter(
                                (o) =>
                                  o.start.slice(0, 10) <= d &&
                                  o.end.slice(0, 10) >= d,
                              )
                              .map((o, i) => (
                                <div
                                  key={"out" + i}
                                  className="pause-block outage"
                                  style={{
                                    left:
                                      Math.max(
                                        0,
                                        ((ms(o.start) - ms(d + "T00:00")) /
                                          86400000) *
                                          100,
                                      ) + "%",
                                    width:
                                      ((Math.min(
                                        ms(o.end),
                                        ms(plusDay(d, 1) + "T00:00"),
                                      ) -
                                        Math.max(
                                          ms(o.start),
                                          ms(d + "T00:00"),
                                        )) /
                                        86400000) *
                                        100 +
                                      "%",
                                  }}
                                  title={o.name}
                                >
                                  {o.name}
                                </div>
                              ))}
                            {jobs.flatMap((j) =>
                              j.segments
                                .filter((s) => s.start.slice(0, 10) === d)
                                .map((s) => (
                                  <button
                                    className="gantt-block"
                                    draggable
                                    key={j.id + s.start}
                                    onDragStart={(e) =>
                                      e.dataTransfer.setData("text/plain", j.id)
                                    }
                                    onClick={() => openJob(j)}
                                    style={{
                                      left:
                                        ((ms(s.start) - ms(d + "T00:00")) /
                                          86400000) *
                                          100 +
                                        "%",
                                      width:
                                        ((ms(s.end) - ms(s.start)) / 86400000) *
                                          100 +
                                        "%",
                                      background:
                                        colors[(j.id - 1) % colors.length],
                                    }}
                                    title={`${j.orderNo} · ${j.part} · ${j.customer}\n${time(s.start)}–${time(s.end)} · ${fmt(total(j))}\nTermin: ${date(j.due)} ${time(j.due)}`}
                                  >
                                    <b>
                                      {j.orderNo} · {j.part}
                                    </b>
                                    <small>
                                      {time(s.start)}–{time(s.end)}
                                    </small>
                                  </button>
                                )),
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="panel-footer">
                Planlama saat dilimi: Europe/Istanbul · Bölünebilir işler,
                molalarda ve gün sonunda bölünür.
              </div>
            </section>
          )}
          {page === "settings" && (
            <SettingsForm
              settings={settings}
              working={working}
              save={(s) =>
                act(
                  "/settings",
                  "PUT",
                  s,
                  "Makine takvimi kaydedildi ve plan güncellendi",
                )
              }
            />
          )}
          {page === "reports" && (
            <>
              <div className="metrics">
                {summaryCard(
                  "Haftalık kullanım",
                  `%${weekly.percent}`,
                  `${fmt(weekly.planned)} / ${fmt(weekly.capacity)}`,
                  ChartNoAxesCombined,
                )}
                {summaryCard(
                  "Aylık kullanım",
                  `%${monthly.percent}`,
                  `${fmt(monthly.planned)} / ${fmt(monthly.capacity)}`,
                  Factory,
                )}
                {summaryCard(
                  "Tamamlanan işler",
                  completed.length,
                  `${completed.filter((j) => j.actualEnd && j.actualEnd <= j.due).length} iş termininde tamamlandı`,
                  CheckCheck,
                )}
                {summaryCard(
                  "Ortalama gecikme",
                  fmt(
                    completed.length
                      ? Math.round(
                          completed.reduce(
                            (n, j) =>
                              n +
                              (j.actualEnd
                                ? Math.max(
                                    0,
                                    (ms(j.actualEnd) - ms(j.due)) / 60000,
                                  )
                                : 0),
                            0,
                          ) / completed.length,
                        )
                      : 0,
                  ),
                  "Tamamlanan işler · takvim süresi",
                  Clock3,
                )}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Haftalık makine kullanımı</h2>
                      <p>Planlanan süre / kullanılabilir kapasite</p>
                    </div>
                  </div>
                  <div className="chart">
                    {Array.from({ length: 7 }, (_, i) =>
                      plusDay(weekStart, i),
                    ).map((d) => (
                      <div className="chart-col" key={d}>
                        <span>{fmt(busy(jobs, d))}</span>
                        <div className="chart-track">
                          <i
                            style={{
                              height:
                                Math.min(
                                  100,
                                  pct(busy(jobs, d), cap(settings, d)),
                                ) + "%",
                            }}
                          />
                        </div>
                        <b>
                          {new Date(d + "T12:00Z").toLocaleDateString("tr-TR", {
                            weekday: "short",
                          })}
                        </b>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Müşteri bazında işler</h2>
                  </div>
                  <div className="customer-list">
                    {[...new Set(jobs.map((j) => j.customer))].map((c) => (
                      <div key={c}>
                        <span>{c}</span>
                        <b>{jobs.filter((j) => j.customer === c).length} iş</b>
                        <small>
                          {fmt(
                            jobs
                              .filter((j) => j.customer === c)
                              .reduce((n, j) => n + total(j), 0),
                          )}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Plan / gerçekleşen karşılaştırması</h2>
                    <p>Gerçek süreyi iş detayından kaydedebilirsiniz.</p>
                  </div>
                  <button
                    className="btn"
                    onClick={() => {
                      const rows = [
                        [
                          "İş emri",
                          "Parça",
                          "Müşteri",
                          "Planlanan dakika",
                          "Gerçek dakika",
                          "Fark dakika",
                          "Gerçek başlangıç",
                          "Gerçek bitiş",
                          "Termin",
                        ],
                        ...jobs.map((j) => [
                          j.orderNo,
                          j.part,
                          j.customer,
                          total(j),
                          j.actualMinutes ?? "",
                          j.actualMinutes == null
                            ? ""
                            : j.actualMinutes - total(j),
                          j.actualStart || "",
                          j.actualEnd || "",
                          j.due,
                        ]),
                      ];
                      const csv =
                        "\uFEFF" +
                        rows
                          .map((r) =>
                            r
                              .map(
                                (v) =>
                                  '"' + String(v).replaceAll('"', '""') + '"',
                              )
                              .join(";"),
                          )
                          .join("\r\n");
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(
                        new Blob([csv], { type: "text/csv;charset=utf-8" }),
                      );
                      a.download = "uretim-raporu.csv";
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                  >
                    <Download size={16} />
                    CSV indir
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>İŞ EMRİ</th>
                        <th>PARÇA</th>
                        <th>PLANLANAN</th>
                        <th>GERÇEK</th>
                        <th>FARK</th>
                        <th>GERÇEK BAŞLANGIÇ</th>
                        <th>GERÇEK BİTİŞ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id} onClick={() => openJob(j)}>
                          <td>{j.orderNo}</td>
                          <td>{j.part}</td>
                          <td>{fmt(total(j))}</td>
                          <td>
                            {j.actualMinutes == null
                              ? "—"
                              : fmt(j.actualMinutes)}
                          </td>
                          <td>
                            {j.actualMinutes == null
                              ? "—"
                              : `${j.actualMinutes - total(j) >= 0 ? "+" : "−"}${fmt(Math.abs(j.actualMinutes - total(j)))}`}
                          </td>
                          <td>
                            {date(j.actualStart)} {time(j.actualStart)}
                          </td>
                          <td>
                            {date(j.actualEnd)} {time(j.actualEnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <JobForm
          job={modal === "new" ? null : modal}
          now={now}
          history={history}
          error={error}
          close={() => setModal(null)}
          working={working}
          save={async (j, file) => {
            const r = await act(
              j.id ? "/jobs/" + j.id : "/jobs",
              j.id ? "PUT" : "POST",
              j,
              "İş emri kaydedildi",
            );
            if (r) {
              if (file) {
                try {
                  const f = await fetch(`/api/jobs/${j.id || r.id}/file`, {
                    method: "POST",
                    headers: {
                      "Content-Type": file.type,
                      "X-Filename": encodeURIComponent(file.name),
                    },
                    body: file,
                  });
                  if (!f.ok) throw Error((await f.json()).error);
                  setState(await api("/state"));
                } catch (e) {
                  setError("İş kaydedildi, dosya yüklenemedi: " + e.message);
                }
              }
              setModal(null);
            }
          }}
          remove={async (id) => {
            if (window.confirm("Bu iş emri kalıcı olarak silinsin mi?")) {
              const r = await act(
                "/jobs/" + id,
                "DELETE",
                undefined,
                "İş emri silindi",
              );
              if (r) setModal(null);
            }
          }}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
