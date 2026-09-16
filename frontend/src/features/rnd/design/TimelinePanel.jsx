/** TimelinePanel — riwayat kronologis: status, versi, nilai, umpan balik, unggahan. */
import { DESIGN_EVENT_LABEL, DESIGN_STATUS_META, fmtScore } from "../rndMeta";

const fmtAt = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "");
const TONE = {
  approve: "#1A7A3A", activate: "#0F6E4A", request_revision: "#C62828", archive: "#6B6B73",
  scored: "#B26A00", feedback: "#0058CC", new_version: "#6B219A", submit: "#0058CC",
};

export default function TimelinePanel({ design }) {
  const rows = [...(design.timeline || [])].sort((a, b) => (a.at < b.at ? 1 : -1));
  if (!rows.length) return <p className="text-[11.5px] text-[#9A9BA3]" data-testid="design-timeline-empty">Belum ada riwayat.</p>;
  return (
    <ol className="relative ml-2 border-l border-[#E5E5EA]" data-testid="design-timeline">
      {rows.map((e) => {
        const tone = TONE[e.event] || "#8E8E93";
        return (
          <li key={e.id} className="relative mb-3 pl-4" data-testid={`design-timeline-${e.event}`}>
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white" style={{ background: tone }} />
            <p className="text-[11.5px]">
              <b style={{ color: tone }}>{DESIGN_EVENT_LABEL[e.event] || e.event}</b>
              {e.version && <span className="ml-1 rounded bg-[#F5F5F7] px-1 text-[9.5px] font-bold text-[#6B6B73]">v{e.version}</span>}
              {e.score !== null && e.score !== undefined && <span className="ml-1 text-[10.5px] font-semibold">nilai {fmtScore(e.score)}</span>}
              {e.to_status && e.from_status && e.from_status !== e.to_status && (
                <span className="ml-1 text-[10px] text-[#8E8E93]">
                  {DESIGN_STATUS_META[e.from_status]?.label || e.from_status} → {DESIGN_STATUS_META[e.to_status]?.label || e.to_status}
                </span>
              )}
            </p>
            {e.note && <p className="text-[11px] text-[#3C3C43]">{e.note}</p>}
            <p className="text-[9.5px] text-[#9A9BA3]">{e.by}{e.role && ` (${e.role})`} · {fmtAt(e.at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
