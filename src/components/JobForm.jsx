import React, { useState, useEffect } from "react";
import { X, Clock3, Paperclip, Download, Trash2, Check } from "lucide-react";
import { date, time, fmt, total, plusDay } from "../utils.js";
import Badge from "./Badge.jsx";
export default function JobForm({
  job,
  now,
  history,
  error,
  close,
  save,
  remove,
  working,
}) {
  const [j, setJ] = useState(
      job || {
        orderNo: "IE-" + Date.now().toString().slice(-6),
        part: "",
        drawing: "",
        customer: "",
        quantity: 1,
        processingMinutes: 60,
        setupMinutes: 0,
        toolMinutes: 0,
        inspectionMinutes: 0,
        due: plusDay(now.slice(0, 10), 1) + "T17:00",
        priority: "Normal",
        material: "",
        notes: "",
        tooling: "",
        operatorNotes: "",
        status: "Bekliyor",
        splittable: true,
        manualStart: "",
      },
    ),
    [file, setFile] = useState(null);
  const change = (k, v) => setJ((s) => ({ ...s, [k]: v }));
  const field = (label, key, type = "text", extra = {}) => (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={j[key] ?? ""}
        onChange={(e) =>
          change(
            key,
            type === "number" ? Number(e.target.value) : e.target.value,
          )
        }
        {...extra}
      />
    </label>
  );
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={job ? "İş emri detayı" : "Yeni iş emri"}
      >
        <div className="modal-title">
          <div>
            <div className="eyebrow">İŞ EMRİ</div>
            <h2>{job ? j.part : "Yeni iş emri oluştur"}</h2>
            <p>
              {job
                ? `${j.orderNo} · İş bilgileri ve üretim takibi`
                : "İş bilgilerini girin, üretim planını biz hesaplayalım."}
            </p>
          </div>
          <button className="icon-btn" aria-label="Kapat" onClick={close}>
            <X />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(j, file);
          }}
        >
          <div className="modal-body">
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            {job && (
              <div className="job-summary">
                <Badge risk={job.risk} />
                <span>
                  {job.plannedStart
                    ? `${date(job.plannedStart)} ${time(job.plannedStart)} → ${date(job.plannedEnd)} ${time(job.plannedEnd)}`
                    : "Planlanmış zaman yok"}
                </span>
                {job.reason && (
                  <p>
                    {job.reason}{" "}
                    {job.missingMinutes > 0 &&
                      `Gereken ek kapasite: ${fmt(job.missingMinutes)}`}
                  </p>
                )}
              </div>
            )}
            <h3>İş bilgileri</h3>
            <div className="form-grid">
              {field("İş emri numarası *", "orderNo", "text", {
                required: true,
                maxLength: 80,
              })}
              {field("Parça adı *", "part", "text", {
                required: true,
                maxLength: 200,
              })}
              {field("Teknik resim numarası", "drawing")}
              {field("Müşteri adı *", "customer", "text", {
                required: true,
                maxLength: 200,
              })}
              {field("Adet *", "quantity", "number", {
                required: true,
                min: 1,
                step: 1,
              })}
              {field("Malzeme", "material")}
              <label className="field">
                <span>Öncelik</span>
                <select
                  value={j.priority}
                  onChange={(e) => change("priority", e.target.value)}
                >
                  {["Çok Acil", "Acil", "Normal", "Düşük"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>İş durumu</span>
                <select
                  value={j.status}
                  onChange={(e) => change("status", e.target.value)}
                >
                  {[
                    "Bekliyor",
                    "Planlandı",
                    "Üretimde",
                    "Tamamlandı",
                    "Beklemede",
                    "İptal edildi",
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <h3>Süre ve termin</h3>
            <p className="form-hint">
              İşleme süresi, tüm adetler için toplam makine süresidir.
            </p>
            <div className="form-grid four">
              {field("İşleme (dk) *", "processingMinutes", "number", {
                min: 0,
                required: true,
              })}
              {field("Bağlama / setup (dk)", "setupMinutes", "number", {
                min: 0,
              })}
              {field("Takım hazırlık (dk)", "toolMinutes", "number", {
                min: 0,
              })}
              {field("Kontrol / ölçüm (dk)", "inspectionMinutes", "number", {
                min: 0,
              })}
            </div>
            <div className="total-duration">
              <Clock3 size={16} />
              Toplam planlama süresi <b>{fmt(total(j))}</b>
            </div>
            <div className="form-grid">
              {field("Termin tarihi ve saati *", "due", "datetime-local", {
                required: true,
              })}
              {field(
                "Manuel başlangıç (isteğe bağlı)",
                "manualStart",
                "datetime-local",
              )}
            </div>
            <p className="form-hint">
              Manuel başlangıç en erken başlama zamanını belirler. Kapalı
              saatler ve dolu aralıklar otomatik atlanır. Temizlerseniz otomatik
              sıraya döner.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={j.splittable}
                onChange={(e) => change("splittable", e.target.checked)}
              />
              İş bölünebilir{" "}
              <span>Molalara ve sonraki çalışma günlerine yayılabilir.</span>
            </label>
            <h3>Teknik bilgiler</h3>
            <div className="form-grid">
              <label className="field">
                <span>Operasyon notları</span>
                <textarea
                  rows={3}
                  value={j.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
              <label className="field">
                <span>Takım / bağlama bilgileri</span>
                <textarea
                  rows={3}
                  value={j.tooling}
                  onChange={(e) => change("tooling", e.target.value)}
                />
              </label>
            </div>
            <label className="upload">
              <Paperclip size={18} />
              <div>
                <b>Teknik resim ekle</b>
                <small>PDF, PNG veya JPEG · En fazla 10 MB</small>
              </div>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </label>
            {file && <p>{file.name}</p>}
            {job?.attachmentName && (
              <a
                className="text-btn file-link"
                href={"/api/jobs/" + job.id + "/file"}
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                {job.attachmentName} — indir
              </a>
            )}
            <h3>Üretim gerçekleşen bilgileri</h3>
            <div className="form-grid">
              {field("Gerçek başlangıç", "actualStart", "datetime-local")}
              {field("Gerçek bitiş", "actualEnd", "datetime-local")}
              {field("Gerçek toplam süre (dk)", "actualMinutes", "number", {
                min: 0,
              })}
              <label className="field">
                <span>Operatör notları</span>
                <textarea
                  value={j.operatorNotes || ""}
                  onChange={(e) => change("operatorNotes", e.target.value)}
                />
              </label>
            </div>
            <p className="form-hint">
              “Üretimde” seçildiğinde başlangıç, “Tamamlandı” seçildiğinde bitiş
              kaydedilir. Süreyi molaları çıkararak düzeltebilirsiniz.
            </p>
            {history.length > 0 && (
              <>
                <h3>Değişiklik geçmişi</h3>
                <div className="history">
                  {history.map((h) => (
                    <p key={h.id}>
                      <small>
                        {date(h.at)} {time(h.at)}
                      </small>
                      {h.action}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            {job && (
              <button
                type="button"
                className="btn danger"
                onClick={() => remove(job.id)}
              >
                <Trash2 size={15} />
                Sil
              </button>
            )}
            <span />
            <button className="btn" type="button" onClick={close}>
              Vazgeç
            </button>
            <button className="btn primary" disabled={working} type="submit">
              <Check size={16} />
              {working ? "Kaydediliyor…" : "Kaydet ve planla"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
