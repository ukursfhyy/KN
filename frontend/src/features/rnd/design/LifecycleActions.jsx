/** LifecycleActions — tombol aksi sesuai status & peran (desainer vs penilai) + dialog catatan/nilai. */
import { useState } from "react";
import { Archive, CheckCircle2, Eye, GitBranch, Rocket, RotateCcw, Send, Undo2 } from "lucide-react";
import { designLifecycle, designNewVersion } from "../rndApi";
import { errMsg, fmtScore } from "../rndMeta";
import ScoreInput from "./ScoreInput";

const ACTIONS = {
  submit: { label: "Ajukan untuk review", icon: Send, side: "designer", cls: "primary-button" },
  start_review: { label: "Mulai review", icon: Eye, side: "assessor", cls: "primary-button" },
  approve: { label: "Setujui (ACC)", icon: CheckCircle2, side: "assessor", cls: "primary-button", needScore: true },
  request_revision: { label: "Minta revisi", icon: RotateCcw, side: "assessor", cls: "secondary-button", needNote: true, optScore: true },
  activate: { label: "Aktifkan untuk produksi", icon: Rocket, side: "assessor", cls: "primary-button" },
  archive: { label: "Arsipkan", icon: Archive, side: "assessor", cls: "secondary-button", needNote: true },
  reopen: { label: "Buka kembali", icon: Undo2, side: "assessor", cls: "secondary-button" },
  new_version: { label: "Buat versi baru", icon: GitBranch, side: "designer", cls: "secondary-button", needNote: true },
};

const BY_STATUS = {
  draft: ["submit", "new_version", "archive"],
  revision: ["new_version", "submit", "archive"],
  pending_approval: ["start_review", "approve", "request_revision", "archive"],
  in_review: ["approve", "request_revision", "archive"],
  approved: ["activate", "new_version", "archive"],
  active: ["new_version", "archive"],
  archived: ["reopen"], retired: ["reopen"],
};

export default function LifecycleActions({ design, canAssess, canEdit, minAcc = 1.5, onDone, onError }) {
  const [dlg, setDlg] = useState(null); // { action }
  const [note, setNote] = useState("");
  const [score, setScore] = useState(null);
  const [busy, setBusy] = useState(false);
  const status = design.status || "draft";
  const curV = (design.versions || []).find((v) => v.version === design.version) || {};

  const visible = (BY_STATUS[status] || []).filter((a) => {
    const m = ACTIONS[a];
    return m.side === "assessor" ? canAssess : canEdit;
  });

  const open = (a) => { setDlg({ action: a }); setNote(""); setScore(curV.score ?? null); };

  const run = async () => {
    const a = dlg.action;
    const m = ACTIONS[a];
    if (m.needNote && !note.trim()) { onError?.("Catatan wajib diisi."); return; }
    if (m.needScore && score === null) { onError?.("Beri nilai versi ini dulu (0–2)."); return; }
    setBusy(true);
    try {
      if (a === "new_version") await designNewVersion(design.id, { note });
      else await designLifecycle(design.id, a.replace(/_/g, "-"), { note, score: (m.needScore || m.optScore) ? score : undefined });
      setDlg(null);
      onDone?.(`${m.label} berhasil.`);
    } catch (e) { onError?.(errMsg(e, "Aksi gagal.")); } finally { setBusy(false); }
  };

  if (!visible.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="design-lifecycle-actions">
      {visible.map((a) => {
        const m = ACTIONS[a]; const Icon = m.icon;
        return (
          <button key={a} className={`${m.cls} !py-1.5 text-[11.5px]`} onClick={() => open(a)} data-testid={`design-action-${a}`}>
            <Icon size={13} /> {m.label}
          </button>
        );
      })}
      {dlg && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/50 p-4" onClick={() => setDlg(null)} data-testid="design-action-dialog">
          <div className="w-full max-w-[520px] space-y-3 rounded-xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[14px] font-bold">{ACTIONS[dlg.action].label} — {design.code} v{design.version}</h3>
            {dlg.action === "submit" && (
              <p className="rounded-lg bg-[#F2F7FF] px-3 py-2 text-[11.5px] text-[#004099]">
                Versi v{design.version} akan masuk antrean penilai. Pastikan artwork versi ini sudah diunggah.
              </p>
            )}
            {dlg.action === "new_version" && (
              <p className="rounded-lg bg-[#F2F7FF] px-3 py-2 text-[11.5px] text-[#004099]">
                v{design.version} → <b>v{design.version + 1}</b>. Status kembali <b>Draf</b>; unggah artwork baru lalu ajukan lagi.
                Versi lama beserta nilainya tetap tersimpan.
              </p>
            )}
            {(ACTIONS[dlg.action].needScore || ACTIONS[dlg.action].optScore) && (
              <div>
                <p className="mb-1 text-[10.5px] font-semibold text-[#6B6B73]">
                  Nilai versi v{design.version} {ACTIONS[dlg.action].needScore ? "*" : "(opsional)"}
                  {curV.score !== null && curV.score !== undefined && <> · nilai tersimpan: <b>{fmtScore(curV.score)}</b></>}
                </p>
                <ScoreInput value={score} onChange={setScore} minAcc={minAcc} testId="design-action-score" />
              </div>
            )}
            <div>
              <p className="mb-1 text-[10.5px] font-semibold text-[#6B6B73]">
                {dlg.action === "new_version" ? "Apa yang berubah pada versi ini? *"
                  : dlg.action === "request_revision" ? "Catatan revisi untuk desainer *"
                    : dlg.action === "archive" ? "Alasan pengarsipan *" : "Catatan (opsional)"}
              </p>
              <textarea className="field" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="design-action-note"
                placeholder={dlg.action === "request_revision" ? "mis. warna latar terlalu gelap, repeat belum rapi" : ""} />
            </div>
            <div className="flex justify-end gap-2">
              <button className="secondary-button" onClick={() => setDlg(null)}>Batal</button>
              <button className="primary-button" onClick={run} disabled={busy} data-testid="design-action-confirm">
                {busy ? "Memproses…" : ACTIONS[dlg.action].label}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
