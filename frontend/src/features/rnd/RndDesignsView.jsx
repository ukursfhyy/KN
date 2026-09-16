/**
 * RndDesignsView — **Desain & Pattern (Master)**: daftar berkartu + filter lengkap
 * (jenis · kategori · status · desainer · tag · produk · warna · nilai · artwork) dan
 * halaman detail per desain (siklus hidup, versi & nilai, timeline, umpan balik, colorway).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Layers, Plus, RefreshCw, Search, Tags, X } from "lucide-react";
import ErrorNotice from "../../components/ErrorNotice";
import LineFilter from "../../components/LineFilter";
import KNSelect from "../../components/KNSelect";
import DesignFormModal from "./DesignFormModal";
import DesignDetailPage from "./design/DesignDetailPage";
import CategoryManagerModal from "./design/CategoryManagerModal";
import { ScoreBadge } from "./design/ScoreInput";
import { designFileUrl, listDesigns, studioCategories } from "./rndApi";
import { DESIGN_STATUS_META, DESIGN_TYPE_LABEL, errMsg } from "./rndMeta";

const STATUS_OPTS = [
  { value: "", label: "Semua status" },
  ...Object.entries(DESIGN_STATUS_META).filter(([k]) => k !== "retired").map(([k, m]) => ({ value: k, label: m.label })),
];
const TYPE_OPTS = [{ value: "", label: "Semua jenis" }, ...Object.entries(DESIGN_TYPE_LABEL).map(([k, l]) => ({ value: k, label: l }))];
const SCORE_OPTS = [
  { value: "", label: "Semua nilai" }, { value: "unscored", label: "Belum dinilai" },
  { value: "1", label: "≥ 1,00" }, { value: "1.5", label: "≥ 1,50" }, { value: "1.75", label: "≥ 1,75" }, { value: "2", label: "= 2,00" },
];
const ARTWORK_OPTS = [{ value: "", label: "Artwork: semua" }, { value: "yes", label: "Sudah ada artwork" }, { value: "no", label: "Belum ada artwork" }];
const EMPTY = { q: "", status: "", type: "", cat: "", designer: "", tag: "", product: "", color: "", score: "", artwork: "", line: "" };

export default function RndDesignsView({ currentUser, selectedEntity }) {
  const [rows, setRows] = useState([]);
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [f, setF] = useState(EMPTY);
  const [showFilters, setShowFilters] = useState(true);
  const [modal, setModal] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [catModal, setCatModal] = useState(false);

  const role = currentUser?.role;
  const canAssess = ["admin", "manager"].includes(role);
  const canCreate = canAssess || role === "designer";
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedEntity && selectedEntity !== "all") params.entity_id = selectedEntity;
      if (f.line) params.line = f.line;
      const res = await listDesigns(params);
      setRows(Array.isArray(res) ? res : res?.items || []);
      setError("");
    } catch (e) { setError(errMsg(e, "Gagal memuat master desain.")); } finally { setLoading(false); }
  }, [selectedEntity, f.line]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { studioCategories({ status: "all" }).then(setCats).catch(() => setCats([])); }, [catModal]);

  const designers = useMemo(() => [...new Set(rows.map((r) => r.created_by).filter(Boolean))].sort(), [rows]);
  const tags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags || []))].sort(), [rows]);
  const products = useMemo(() => {
    const m = new Map(); rows.forEach((r) => (r.recommended_products || []).forEach((p) => m.set(p.id, p))); return [...m.values()];
  }, [rows]);
  const colors = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => [...(r.colors || []), ...(r.colorways || []).flatMap((c) => c.colors || [])].forEach((c) => m.set(c.color_id, c)));
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [rows]);
  const catOpts = useMemo(() => [{ value: "", label: "Semua kategori" },
    ...cats.filter((c) => !f.type || c.design_type === f.type).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))], [cats, f.type]);

  const filtered = useMemo(() => {
    const term = f.q.trim().toLowerCase();
    return rows.filter((d) => {
      const status = d.status === "retired" ? "archived" : (d.status || "draft");
      if (f.status && status !== f.status) return false;
      if (f.type && d.design_type !== f.type) return false;
      if (f.cat && d.category_code !== f.cat) return false;
      if (f.designer && d.created_by !== f.designer) return false;
      if (f.tag && !(d.tags || []).includes(f.tag)) return false;
      if (f.product && !(d.recommended_product_ids || []).includes(f.product)) return false;
      if (f.color && ![...(d.colors || []), ...(d.colorways || []).flatMap((c) => c.colors || [])].some((c) => c.color_id === f.color)) return false;
      const sc = d.current_score;
      if (f.score === "unscored" && sc !== null && sc !== undefined) return false;
      if (f.score && f.score !== "unscored" && !(sc !== null && sc !== undefined && Number(sc) >= Number(f.score))) return false;
      if (f.artwork === "yes" && !d.artwork_count) return false;
      if (f.artwork === "no" && d.artwork_count) return false;
      if (!term) return true;
      return [d.code, d.title, d.story, d.category_name, d.created_by, ...(d.tags || [])].some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [rows, f]);

  const stats = useMemo(() => ({
    total: rows.length,
    review: rows.filter((d) => ["pending_approval", "in_review"].includes(d.status)).length,
    revision: rows.filter((d) => d.status === "revision").length,
    acc: rows.filter((d) => ["approved", "active"].includes(d.status)).length,
  }), [rows]);
  const activeFilters = Object.entries(f).filter(([k, v]) => v && k !== "q" && k !== "line").length;

  if (openId) {
    return <DesignDetailPage designId={openId} currentUser={currentUser} onBack={() => setOpenId(null)} onChanged={load} />;
  }

  return (
    <div data-testid="rnd-designs-view">
      <ErrorNotice message={error} onRetry={load} onDismiss={() => setError("")} testId="rnd-designs-error" />

      <div className="section-card mb-3">
        <div className="section-head">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[#6B219A]" />
            <h2 data-testid="rnd-designs-title">Desain & Pattern (Master)</h2>
          </div>
          <div className="flex items-center gap-2">
            {canAssess && (
              <button className="secondary-button" onClick={() => setCatModal(true)} data-testid="rnd-designs-categories"><Tags size={13} /> Kategori</button>
            )}
            <button className="secondary-button" onClick={load} data-testid="rnd-designs-refresh"><RefreshCw size={13} /> Muat ulang</button>
            {canCreate && (
              <button className="primary-button" data-testid="design-create-button" onClick={() => setModal({ mode: "create" })}>
                <Plus size={13} /> Desain Baru
              </button>
            )}
          </div>
        </div>
        <div className="section-body space-y-2.5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="rnd-designs-stats">
            <Kpi label="Total desain" value={stats.total} />
            <Kpi label="Menunggu review" value={stats.review} tone="#0058CC" />
            <Kpi label="Perlu revisi" value={stats.revision} tone="#C62828" />
            <Kpi label="ACC / Aktif" value={stats.acc} tone="#1B7F4B" />
          </div>
          {okMsg && <div className="rounded-lg bg-[#EAF7EF] px-3 py-2 text-[11.5px] text-[#1A7A3A]" data-testid="rnd-designs-ok">{okMsg}</div>}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9BA3]" />
              <input data-testid="rnd-designs-search" value={f.q} onChange={(e) => set("q", e.target.value)} className="field !pl-8"
                placeholder="Cari kode / judul / tag / desainer…" />
            </div>
            <LineFilter value={f.line} onChange={(v) => set("line", v)} storageKey="rnd-designs"
              allowed={currentUser?.allowed_line_codes} testId="rnd-designs-line-filter" />
            <button className={`secondary-button ${activeFilters ? "!border-[#6B219A] !text-[#6B219A]" : ""}`} onClick={() => setShowFilters((s) => !s)}
              data-testid="rnd-designs-toggle-filters">
              <Filter size={13} /> Filter {activeFilters ? `(${activeFilters})` : ""}
            </button>
            {activeFilters > 0 && (
              <button className="text-[11px] text-[#6B219A] underline" onClick={() => setF({ ...EMPTY, line: f.line })} data-testid="rnd-designs-reset-filter">
                <X size={10} className="inline" /> reset
              </button>
            )}
          </div>
          {showFilters && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="rnd-designs-filters">
              <KNSelect data-testid="rnd-filter-status" className="field" value={f.status} options={STATUS_OPTS} onValueChange={(v) => set("status", v)} />
              <KNSelect data-testid="rnd-filter-type" className="field" value={f.type} options={TYPE_OPTS} onValueChange={(v) => { set("type", v); set("cat", ""); }} />
              <KNSelect data-testid="rnd-filter-category" className="field" value={f.cat} options={catOpts} onValueChange={(v) => set("cat", v)} searchable />
              <KNSelect data-testid="rnd-filter-designer" className="field" value={f.designer} searchable
                options={[{ value: "", label: "Semua desainer" }, ...designers.map((n) => ({ value: n, label: n }))]} onValueChange={(v) => set("designer", v)} />
              <KNSelect data-testid="rnd-filter-tag" className="field" value={f.tag} searchable
                options={[{ value: "", label: "Semua tag" }, ...tags.map((t) => ({ value: t, label: t }))]} onValueChange={(v) => set("tag", v)} />
              <KNSelect data-testid="rnd-filter-product" className="field" value={f.product} searchable
                options={[{ value: "", label: "Semua peruntukan produk" }, ...products.map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` }))]} onValueChange={(v) => set("product", v)} />
              <KNSelect data-testid="rnd-filter-color" className="field" value={f.color} searchable
                options={[{ value: "", label: "Semua warna" }, ...colors.map((c) => ({ value: c.color_id, label: `${c.code} — ${c.name}` }))]} onValueChange={(v) => set("color", v)} />
              <KNSelect data-testid="rnd-filter-score" className="field" value={f.score} options={SCORE_OPTS} onValueChange={(v) => set("score", v)} />
              <KNSelect data-testid="rnd-filter-artwork" className="field" value={f.artwork} options={ARTWORK_OPTS} onValueChange={(v) => set("artwork", v)} />
            </div>
          )}
        </div>
      </div>

      <div className="section-card">
        <div className="section-body">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[230px] animate-pulse rounded-lg bg-[#F5F5F7]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-[#6B6B73]" data-testid="rnd-designs-empty">
              <Layers className="mx-auto mb-2 text-gray-300" size={28} />
              {(activeFilters || f.q.trim()) ? <p>Tidak ada desain yang cocok dengan saringan saat ini.</p>
                : <p>Belum ada desain. Buat desain baru — kode terbentuk otomatis dari inisial desainer, jenis, dan kategori.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((d) => <DesignCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} />)}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <DesignFormModal mode={modal.mode} design={modal.design} canManageMaster={canAssess} onClose={() => setModal(null)}
          onSaved={(res) => { setModal(null); setOkMsg(`Desain ${res?.code || ""} tersimpan.`); load(); if (res?.id) setOpenId(res.id); }} />
      )}
      {catModal && <CategoryManagerModal onClose={() => setCatModal(false)} />}
    </div>
  );
}

function DesignCard({ d, onOpen }) {
  const meta = DESIGN_STATUS_META[d.status || "draft"] || DESIGN_STATUS_META.draft;
  const cover = (d.files || []).find((x) => (x.kind || "artwork") === "artwork" && (x.version || 1) === d.version)
    || (d.files || []).find((x) => (x.kind || "artwork") === "artwork");
  const palette = (d.colors || []).slice(0, 6);
  return (
    <button type="button" onClick={onOpen} data-testid={`design-card-${d.id}`}
      className="overflow-hidden rounded-lg border border-[#E5E5EA] bg-white text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#6B219A]/40">
      <div className="relative flex h-28 items-center justify-center bg-[#F5F5F7]">
        {cover ? <img src={designFileUrl(d.id, cover.id)} alt={d.title} data-testid={`design-cover-${d.id}`} className="h-full w-full object-cover" loading="lazy" />
          : <span className="text-[10.5px] text-[#9A9BA3]">belum ada artwork</span>}
        <span className="absolute left-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-[#6B6B73]">v{d.version || 1}</span>
        {d.colorway_count > 0 && <span className="absolute right-1.5 top-1.5 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-[#6B219A]">+{d.colorway_count} colorway</span>}
      </div>
      <div className="space-y-1 p-2">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate font-mono text-[11.5px] font-bold" data-testid={`design-code-${d.id}`}>{d.code || "tanpa kode"}</span>
          <ScoreBadge value={d.current_score} acc={["approved", "active"].includes(d.status)} testId={`design-score-${d.id}`} />
        </div>
        <p className="truncate text-[11px] text-[#1C1C1E]">{d.title}</p>
        <p className="truncate text-[9.5px] text-[#9A9BA3]">
          {DESIGN_TYPE_LABEL[d.design_type] || d.design_type} · {d.category_name || d.category_code || "—"} · {d.created_by}
        </p>
        <div className="flex items-center justify-between">
          <span className={`status-pill ${meta.cls}`} data-testid={`design-status-${d.id}`}>{meta.label}</span>
          <span className="flex -space-x-1">
            {palette.map((c) => <span key={c.color_id} className="h-3.5 w-3.5 rounded-full border border-white" style={{ background: c.hex }} title={`${c.code} ${c.name}`} />)}
          </span>
        </div>
        {(d.recommended_products || []).length > 0 && (
          <p className="truncate text-[9.5px] text-[#0058CC]">untuk: {d.recommended_products.map((p) => p.sku).join(", ")}</p>
        )}
      </div>
    </button>
  );
}

function Kpi({ label, value, tone = "#1C1C1E" }) {
  return (
    <div className="rounded-lg border border-[#EFF0F2] bg-[#FAFBFC] p-2">
      <p className="text-[9.5px] font-bold uppercase text-[#8E8E93]">{label}</p>
      <p className="text-[14px] font-bold tabular-nums leading-tight" style={{ color: tone }}>{value}</p>
    </div>
  );
}
