/**
 * DesignDetailPage — halaman khusus satu desain: stepper siklus hidup, aksi sesuai peran,
 * tab Ringkasan · Versi & Nilai · Timeline · Umpan Balik · Warna & Alternatif · Referensi & Mockup.
 */
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import ErrorNotice from "../../../components/ErrorNotice";
import { getDesign, studioMeta } from "../rndApi";
import { DESIGN_LIFECYCLE_STEPS, DESIGN_STATUS_META, DESIGN_TYPE_LABEL, errMsg, fmtScore } from "../rndMeta";
import DesignFormModal from "../DesignFormModal";
import LifecycleActions from "./LifecycleActions";
import VersionsPanel from "./VersionsPanel";
import TimelinePanel from "./TimelinePanel";
import FeedbackThread from "./FeedbackThread";
import ColorwaysPanel, { Swatches } from "./ColorwaysPanel";
import FilesPanel from "./FilesPanel";
import { ScoreBadge } from "./ScoreInput";

const TABS = [
  ["summary", "Ringkasan"], ["versions", "Versi & Nilai"], ["timeline", "Timeline"],
  ["feedback", "Umpan Balik"], ["colors", "Warna & Alternatif"], ["refs", "Referensi & Mockup"],
];

export default function DesignDetailPage({ designId, currentUser, onBack, onChanged }) {
  const [d, setD] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tab, setTab] = useState("summary");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [edit, setEdit] = useState(false);

  const role = currentUser?.role;
  const canAssess = ["admin", "manager"].includes(role);
  const canEdit = canAssess || role === "designer";

  const load = useCallback(async () => {
    try { setD(await getDesign(designId)); setError(""); }
    catch (e) { setError(errMsg(e, "Gagal memuat desain.")); }
  }, [designId]);
  useEffect(() => { load(); studioMeta().then(setMeta).catch(() => {}); }, [load]);

  const done = (msg) => { setOk(msg || ""); setError(""); load(); onChanged?.(); };
  const fail = (msg) => { setError(msg); setOk(""); };

  if (!d) {
    return (
      <div data-testid="design-detail-loading">
        <ErrorNotice message={error} onRetry={load} onDismiss={() => setError("")} testId="design-detail-error" />
        <div className="h-40 animate-pulse rounded-lg bg-[#F5F5F7]" />
      </div>
    );
  }
  const st = DESIGN_STATUS_META[d.status] || DESIGN_STATUS_META.draft;
  const stepIdx = DESIGN_LIFECYCLE_STEPS.findIndex((s) => s.key === d.status);
  const minAcc = meta?.code?.acc_min_score ?? 1.5;
  const cover = (d.files || []).find((f) => (f.kind || "artwork") === "artwork" && (f.version || 1) === d.version)
    || (d.files || []).find((f) => (f.kind || "artwork") === "artwork");

  return (
    <div data-testid="design-detail-page" className="space-y-3">
      <ErrorNotice message={error} onRetry={load} onDismiss={() => setError("")} testId="design-detail-error" />
      {ok && <div className="rounded-lg bg-[#EAF7EF] px-3 py-2 text-[11.5px] text-[#1A7A3A]" data-testid="design-detail-ok">{ok}</div>}

      <div className="section-card">
        <div className="section-body">
          <div className="flex flex-wrap items-start gap-3">
            <button className="secondary-button !py-1.5" onClick={onBack} data-testid="design-detail-back"><ArrowLeft size={13} /> Daftar</button>
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#E5E5EA] bg-[#F5F5F7]">
              {cover ? <img src={`${process.env.REACT_APP_BACKEND_URL}/api/design-gallery/${d.id}/files/${cover.id}`} alt={d.title} className="h-full w-full object-cover" />
                : <span className="flex h-full items-center justify-center text-[9.5px] text-[#9A9BA3]">tanpa artwork</span>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-[16px] font-bold" data-testid="design-detail-code">{d.code}</h2>
                <span className="rounded bg-[#F5F5F7] px-1.5 py-0.5 text-[10px] font-bold text-[#6B6B73]">v{d.version}</span>
                <span className={`status-pill ${st.cls}`} data-testid="design-detail-status">{st.label}</span>
                <ScoreBadge value={d.current_score} acc={d.status === "approved" || d.status === "active"} testId="design-detail-score" />
              </div>
              <p className="text-[13px] font-semibold" data-testid="design-detail-title">{d.title}</p>
              <p className="text-[10.5px] text-[#6B6B73]">
                {DESIGN_TYPE_LABEL[d.design_type] || d.design_type} · {d.category_name || d.category_code || "tanpa kategori"} · desainer <b>{d.created_by}</b>
                {d.final_score !== null && d.final_score !== undefined && <> · nilai ACC final <b>{fmtScore(d.final_score)}</b> (v{d.approved_version})</>}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-1.5">
                <button className="secondary-button !py-1.5" onClick={load} data-testid="design-detail-refresh"><RefreshCw size={13} /></button>
                {canEdit && !["archived", "retired", "active"].includes(d.status) && (
                  <button className="secondary-button !py-1.5 text-[11.5px]" onClick={() => setEdit(true)} data-testid="design-detail-edit"><Pencil size={13} /> Ubah</button>
                )}
              </div>
              <LifecycleActions design={d} canAssess={canAssess} canEdit={canEdit} minAcc={minAcc} onDone={done} onError={fail} />
            </div>
          </div>

          <ol className="mt-3 flex items-center gap-1 overflow-x-auto" data-testid="design-lifecycle-stepper">
            {DESIGN_LIFECYCLE_STEPS.map((s, i) => {
              const state = d.status === "revision" && i === 1 ? "warn" : i < stepIdx ? "done" : i === stepIdx ? "cur" : "todo";
              const cls = { done: "bg-[#1A7A3A] text-white", cur: "bg-[#6B219A] text-white", warn: "bg-[#C62828] text-white", todo: "bg-[#F5F5F7] text-[#8E8E93]" }[state];
              return (
                <li key={s.key} className="flex items-center gap-1" data-testid={`design-step-${s.key}`}>
                  <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold ${cls}`}>
                    {i + 1}. {state === "warn" ? "Perlu Revisi" : s.label}
                  </span>
                  {i < DESIGN_LIFECYCLE_STEPS.length - 1 && <span className="h-px w-4 bg-[#D9D9DE]" />}
                </li>
              );
            })}
            {["archived", "retired"].includes(d.status) && <li className="rounded-full bg-[#6B6B73] px-2.5 py-1 text-[10.5px] font-semibold text-white">Diarsipkan</li>}
          </ol>
        </div>
      </div>

      <div className="section-card">
        <div className="flex flex-wrap gap-1 border-b border-[#EFF0F2] px-3 pt-2" data-testid="design-detail-tabs">
          {TABS.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} data-testid={`design-tab-${k}`}
              className={`-mb-px border-b-2 px-3 py-2 text-[11.5px] font-semibold ${tab === k ? "border-[#6B219A] text-[#6B219A]" : "border-transparent text-[#6B6B73] hover:text-[#1C1C1E]"}`}>
              {l}
              {k === "feedback" && d.feedback_count > 0 && <span className="ml-1 rounded-full bg-[#0058CC] px-1.5 text-[9px] text-white">{d.feedback_count}</span>}
              {k === "colors" && d.colorway_count > 0 && <span className="ml-1 rounded-full bg-[#F5F5F7] px-1.5 text-[9px]">{d.colorway_count}</span>}
            </button>
          ))}
        </div>
        <div className="section-body">
          {tab === "summary" && <Summary d={d} canEdit={canEdit} onDone={done} onError={fail} />}
          {tab === "versions" && <VersionsPanel design={d} canAssess={canAssess} minAcc={minAcc} onDone={done} onError={fail} />}
          {tab === "timeline" && <TimelinePanel design={d} />}
          {tab === "feedback" && <FeedbackThread design={d} currentUser={currentUser} canWrite={canEdit} onDone={done} onError={fail} />}
          {tab === "colors" && <ColorwaysPanel design={d} canEdit={canEdit} onDone={done} onError={fail} />}
          {tab === "refs" && (
            <div className="space-y-4">
              <FilesPanel design={d} kind="reference" canEdit={canEdit} onDone={done} onError={fail} />
              <FilesPanel design={d} kind="mockup" canEdit={canEdit} onDone={done} onError={fail} />
            </div>
          )}
        </div>
      </div>

      {edit && (
        <DesignFormModal mode="edit" design={d} canManageMaster={canAssess} onClose={() => setEdit(false)}
          onSaved={() => { setEdit(false); done("Desain diperbarui."); }} />
      )}
    </div>
  );
}

function Summary({ d, canEdit, onDone, onError }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <FilesPanel design={d} kind="artwork" canEdit={canEdit && !["archived", "retired"].includes(d.status)} onDone={onDone} onError={onError} />
        <div>
          <p className="mb-1 text-[10.5px] font-bold uppercase text-[#8E8E93]">Cerita / catatan</p>
          <p className="whitespace-pre-wrap text-[12px] text-[#3C3C43]" data-testid="design-detail-story">{d.story || "—"}</p>
        </div>
      </div>
      <div className="space-y-3 text-[12px]">
        <Info label="Palet warna"><Swatches colors={d.colors || []} size={22} /></Info>
        <Info label="Peruntukan produk (rekomendasi)">
          {(d.recommended_products || []).length ? (
            <div className="flex flex-wrap gap-1" data-testid="design-detail-products">
              {d.recommended_products.map((p) => <span key={p.id} className="rounded-full bg-[#EEF4FF] px-2 py-0.5 text-[10.5px] text-[#0058CC]"><b>{p.sku}</b> {p.name}</span>)}
            </div>
          ) : <span className="text-[#9A9BA3]">opsional · belum dipilih</span>}
        </Info>
        <Info label="Spesifikasi cetak">
          Repeat {d.repeat_cm ? `${d.repeat_cm} cm` : "—"} · {d.color_count || (d.colors || []).length || 0} warna · {d.screen_count || 0} screen
        </Info>
        <Info label="Tag">
          <div className="flex flex-wrap gap-1" data-testid="design-detail-tags">
            {(d.tags || []).map((t) => <span key={t} className="rounded-full bg-[#F1E9F7] px-2 py-0.5 text-[10.5px] text-[#6B219A]">{t}</span>)}
            {!(d.tags || []).length && <span className="text-[#9A9BA3]">—</span>}
          </div>
        </Info>
        <Info label="Lini">{d.line_code || "semua lini"}</Info>
      </div>
    </div>
  );
}

function Info({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-bold uppercase text-[#8E8E93]">{label}</p>
      <div>{children}</div>
    </div>
  );
}
