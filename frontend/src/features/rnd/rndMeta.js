/**
 * rndMeta (FASE F) — label & warna status R&D di SATU tempat supaya semua layar
 * memakai kosakata yang sama (tidak ada istilah teknis yang bocor ke pengguna).
 */
export const SPEC_STATUS_META = {
  draft: { label: "Draf", cls: "pill-muted" },
  review: { label: "Menunggu ACC", cls: "pill-warning" },
  approved: { label: "Disetujui", cls: "pill-success" },
  rejected: { label: "Ditolak", cls: "pill-danger" },
};

export const SAMPLE_STATUS_META = {
  draft: { label: "Draf", cls: "pill-muted" },
  sent: { label: "Terkirim ke supplier", cls: "pill-info" },
  in_progress: { label: "Dikerjakan", cls: "pill-warning" },
  assessed: { label: "Ada yang ACC", cls: "pill-success" },
  decided: { label: "Pemenang dipilih", cls: "pill-success" },
  cancelled: { label: "Dibatalkan", cls: "pill-danger" },
};

export const LIFECYCLE_META = {
  konsep: { label: "Konsep", tone: "#8E8E93", sellable: false },
  labdip: { label: "Labdip", tone: "#0058CC", sellable: false },
  proofing: { label: "Proofing", tone: "#6B219A", sellable: false },
  disetujui: { label: "Disetujui (belum rilis)", tone: "#B26A00", sellable: false },
  produksi: { label: "Produksi (boleh dijual)", tone: "#1B7F4B", sellable: true },
  dihentikan: { label: "Dihentikan", tone: "#C0392B", sellable: false },
};

export const ROUND_RESULT_META = {
  "": { label: "Menunggu hasil", tone: "#8E8E93" },
  revisi: { label: "Revisi", tone: "#B26A00" },
  acc: { label: "ACC", tone: "#1B7F4B" },
  tolak: { label: "Ditolak", tone: "#C0392B" },
};

// FASE S — label CADANGAN saja. Sumber sebenarnya adalah master `sample_types`
// (dibaca lewat `/api/rnd/meta` → `features/rnd/sampleTypeMeta.js`). Peta ini
// dipertahankan supaya layar tetap terbaca sebelum meta termuat dan untuk dokumen
// lama; jenis yang DITAMBAH pemilik tidak perlu \u2014 dan tidak boleh \u2014 ditulis di sini.
export const SAMPLE_TYPE_LABEL = {
  labdip: "Labdip (kain polos)",
  handfeel: "Handfeel (rasa & konstruksi)",
  proofing: "Proofing (sample printing)",
  bulk_sample: "Bulk sample (dinonaktifkan)",
};

export const DESIGN_TYPE_LABEL = {
  motif: "Motif",
  pattern: "Pattern",
  artwork: "Artwork",
};

export const DESIGN_STATUS_META = {
  draft: { label: "Draf", cls: "pill-muted", tone: "#8E8E93" },
  pending_approval: { label: "Diajukan", cls: "pill-info", tone: "#0058CC" },
  in_review: { label: "Dalam Review", cls: "pill-warning", tone: "#A05000" },
  revision: { label: "Perlu Revisi", cls: "pill-danger", tone: "#C62828" },
  approved: { label: "Disetujui (ACC)", cls: "pill-success", tone: "#1A7A3A" },
  active: { label: "Aktif / Produksi", cls: "pill-success", tone: "#0F6E4A" },
  archived: { label: "Diarsipkan", cls: "pill-muted", tone: "#6B6B73" },
  retired: { label: "Diarsipkan", cls: "pill-muted", tone: "#6B6B73" },
};

/** Urutan tahapan siklus hidup desain untuk stepper (revisi = cabang balik ke desainer). */
export const DESIGN_LIFECYCLE_STEPS = [
  { key: "draft", label: "Draf" },
  { key: "pending_approval", label: "Diajukan" },
  { key: "in_review", label: "Review" },
  { key: "approved", label: "ACC" },
  { key: "active", label: "Aktif" },
];

export const DESIGN_EVENT_LABEL = {
  created: "Desain dibuat", submit: "Diajukan untuk review", start_review: "Review dimulai",
  request_revision: "Diminta revisi", approve: "Disetujui (ACC)", activate: "Diaktifkan untuk produksi",
  archive: "Diarsipkan", reopen: "Dibuka kembali", new_version: "Versi baru",
  scored: "Diberi nilai", feedback: "Umpan balik", colorway_added: "Alternatif warna ditambah",
  artwork_uploaded: "Artwork diunggah", reference_uploaded: "Foto referensi diunggah",
  mockup_uploaded: "Mockup diunggah",
};

export const SCORE_STEPS = Array.from({ length: 9 }, (_, i) => i * 0.25);
export const fmtScore = (v) => (v === null || v === undefined || v === "" ? "—"
  : Number(v).toFixed(2).replace(".", ",").replace(/,?0+$/, "").replace(/,$/, "") || "0");

export const lifecycleMeta = (value) =>
  LIFECYCLE_META[(value || "produksi").toLowerCase()] || LIFECYCLE_META.produksi;

/** Ambil pesan galat backend yang sudah ramah pengguna (Bahasa Indonesia). */
export const errMsg = (e, fallback) => e?.response?.data?.detail || fallback;
