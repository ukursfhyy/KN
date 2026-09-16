/** VersionsPanel — setiap versi: artwork, nilai (0–2), catatan penilai, status ACC; penilai bisa memberi nilai. */
import { useState } from "react";
import { Star } from "lucide-react";
import { designFileUrl, scoreDesignVersion } from "../rndApi";
import { errMsg, fmtScore } from "../rndMeta";
import ScoreInput, { ScoreBadge } from "./ScoreInput";

const fmtAt = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "");

export default function VersionsPanel({ design, canAssess, minAcc, onDone, onError }) {
  const [editing, setEditing] = useState(null); // version number
  const [score, setScore] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const versions = [...(design.versions || [])].sort((a, b) => b.version - a.version);
  const filesOf = (v) => (design.files || []).filter((f) => (f.kind || "artwork") === "artwork" && (f.version || 1) === v);

  const save = async (v) => {
    if (score === null) { onError?.("Pilih nilai dulu."); return; }
    setBusy(true);
    try {
      await scoreDesignVersion(design.id, v, { score, note });
      setEditing(null); onDone?.(`Nilai v${v} tersimpan: ${fmtScore(score)}.`);
    } catch (e) { onError?.(errMsg(e, "Nilai gagal disimpan.")); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2" data-testid="design-versions-panel">
      {versions.map((v) => {
        const files = filesOf(v.version);
        const isCur = v.version === design.version;
        return (
          <div key={v.version} data-testid={`design-version-${v.version}`}
            className={`rounded-lg border p-3 ${isCur ? "border-[#6B219A] bg-[#FBF8FE]" : "border-[#EFF0F2] bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[12.5px] font-bold">v{v.version} {isCur && <span className="ml-1 rounded bg-[#6B219A] px-1.5 py-0.5 text-[9px] text-white">versi berjalan</span>}
                  {v.acc && <span className="ml-1 rounded bg-[#1A7A3A] px-1.5 py-0.5 text-[9px] text-white">ACC FINAL</span>}</p>
                <p className="text-[10.5px] text-[#6B6B73]">{v.note || "—"} · {v.by} · {fmtAt(v.at)}</p>
              </div>
              <div className="text-right">
                <ScoreBadge value={v.score} acc={v.acc} size="lg" testId={`design-version-score-${v.version}`} />
                {v.score_by && <p className="mt-0.5 text-[9.5px] text-[#8E8E93]">oleh {v.score_by} · {fmtAt(v.score_at)}</p>}
              </div>
            </div>
            {v.score_note && (
              <p className="mt-2 rounded bg-white/80 px-2 py-1 text-[11px] text-[#3C3C43]" data-testid={`design-version-scorenote-${v.version}`}>
                <b>Catatan penilai:</b> {v.score_note}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {files.map((f) => (
                <a key={f.id} href={designFileUrl(design.id, f.id)} target="_blank" rel="noreferrer" title={f.filename}
                  className="block h-14 w-14 overflow-hidden rounded border border-[#E5E5EA] bg-[#F5F5F7]">
                  {f.content_type?.startsWith("image/")
                    ? <img src={designFileUrl(design.id, f.id)} alt={f.filename} className="h-full w-full object-cover" />
                    : <span className="flex h-full items-center justify-center text-[9px]">PDF</span>}
                </a>
              ))}
              {files.length === 0 && <span className="text-[10.5px] text-[#9A9BA3]">belum ada artwork untuk versi ini</span>}
            </div>
            {canAssess && !v.acc && (
              editing === v.version ? (
                <div className="mt-2 space-y-2 rounded-lg border border-[#E5E5EA] bg-white p-2">
                  <ScoreInput value={score} onChange={setScore} minAcc={minAcc} testId={`design-score-input-${v.version}`} />
                  <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="catatan penilaian (kenapa nilainya sekian / apa yang kurang)" data-testid={`design-score-note-${v.version}`} />
                  <div className="flex justify-end gap-2">
                    <button className="secondary-button !py-1 text-[11px]" onClick={() => setEditing(null)}>Batal</button>
                    <button className="primary-button !py-1 text-[11px]" disabled={busy} onClick={() => save(v.version)}
                      data-testid={`design-score-save-${v.version}`}>Simpan nilai</button>
                  </div>
                </div>
              ) : (
                <button className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B219A] hover:underline"
                  onClick={() => { setEditing(v.version); setScore(v.score ?? null); setNote(v.score_note || ""); }}
                  data-testid={`design-score-edit-${v.version}`}>
                  <Star size={12} /> {v.score === null || v.score === undefined ? "Beri nilai" : "Ubah nilai"}
                </button>
              )
            )}
            {(v.score_history || []).length > 1 && (
              <details className="mt-1 text-[10px] text-[#8E8E93]">
                <summary className="cursor-pointer">riwayat nilai ({v.score_history.length})</summary>
                {v.score_history.map((h, i) => <p key={i}>{fmtScore(h.score)} · {h.by} · {fmtAt(h.at)} {h.note && `— ${h.note}`}</p>)}
              </details>
            )}
          </div>
        );
      })}
    </div>
  );
}
