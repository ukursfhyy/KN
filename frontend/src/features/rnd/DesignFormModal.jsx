/**
 * DesignFormModal — Desain Baru / Ubah Desain.
 * Kode desain OTOMATIS (pola terkonfigurasi: inisial desainer · jenis · kategori · urut),
 * kategori mengikuti jenis, palet warna WAJIB dari master, rekomendasi produk opsional,
 * tag tersimpan (autocomplete).
 */
import { useEffect, useState } from "react";
import { Layers, Save, Settings2, X } from "lucide-react";
import KNSelect from "../../components/KNSelect";
import { overlayDismiss } from "@/utils/overlayDismiss";
import { createDesign, patchDesign, studioCategories, studioNextCode } from "./rndApi";
import { errMsg } from "./rndMeta";
import TagInput from "./design/TagInput";
import ColorPicker from "./design/ColorPicker";
import ProductPicker from "./design/ProductPicker";
import CategoryManagerModal from "./design/CategoryManagerModal";

const TYPE_OPTS = [
  { value: "motif", label: "Motif — corak kain" },
  { value: "pattern", label: "Pattern — pola berulang" },
  { value: "artwork", label: "Artwork — gambar siap cetak" },
];

export default function DesignFormModal({ mode = "create", design, canManageMaster = false, onClose, onSaved }) {
  const [f, setF] = useState({
    title: design?.title || "",
    design_type: design?.design_type || "pattern",
    category_code: design?.category_code || "",
    repeat_cm: design?.repeat_cm ?? "",
    screen_count: design?.screen_count ?? "",
    story: design?.story || "",
    tags: design?.tags || [],
    colors: design?.colors || [],
    products: design?.recommended_products || [],
  });
  const [cats, setCats] = useState([]);
  const [preview, setPreview] = useState(null);
  const [catModal, setCatModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isEdit = mode === "edit";

  const loadCats = () => studioCategories({ design_type: f.design_type }).then(setCats).catch(() => setCats([]));
  useEffect(() => { loadCats(); }, [f.design_type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isEdit) return;
    studioNextCode({ design_type: f.design_type, category_code: f.category_code })
      .then(setPreview).catch(() => setPreview(null));
  }, [f.design_type, f.category_code, isEdit]);

  const num = (v) => (v === "" || v === null ? null : Number(String(v).replace(",", ".")));

  const save = async () => {
    setErr("");
    if (!f.title.trim()) { setErr("Judul desain wajib diisi."); return; }
    if (!f.category_code) { setErr("Pilih kategori sesuai jenis desain."); return; }
    setSaving(true);
    try {
      const body = {
        title: f.title, design_type: f.design_type, category_code: f.category_code,
        repeat_cm: num(f.repeat_cm), screen_count: num(f.screen_count), story: f.story,
        tags: f.tags, colors: f.colors.map((c) => ({ color_id: c.color_id, role: c.role || "" })),
        recommended_product_ids: f.products.map((p) => p.id),
      };
      const res = isEdit ? await patchDesign(design.id, body) : await createDesign(body);
      onSaved?.(res);
    } catch (e) {
      setErr(errMsg(e, "Desain gagal disimpan."));
      setSaving(false);
    }
  };

  const catOpts = cats.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));

  return (
    <div data-testid="design-form-modal"
      className="fixed inset-0 z-[172] flex items-center justify-center bg-black/50 p-4"
      {...overlayDismiss(onClose)}>
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#EFF0F2] px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Layers size={16} className="text-[#6B219A]" />
            {isEdit ? "Ubah Desain" : "Desain Baru"}
          </h2>
          <button className="icon-button" onClick={onClose} data-testid="design-form-close"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {err && (
            <div className="rounded-lg bg-[#FDEDE7] px-3 py-2 text-[11.5px] text-[#C0392B]" data-testid="design-form-error">{err}</div>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
            <Field label="Judul desain *">
              <input className="field" data-testid="design-title-input" value={f.title}
                onChange={(e) => set("title", e.target.value)} placeholder="mis. Salur Pelangi Senja" />
            </Field>
            <Field label={isEdit ? "Kode desain" : "Kode desain (otomatis)"}>
              <div className="field flex items-center justify-between bg-[#FAFBFC] font-mono text-[12.5px] font-bold text-[#1C1C1E]"
                data-testid="design-code-preview">
                <span>{isEdit ? design?.code : (preview?.code || "…")}</span>
                {!isEdit && preview && (
                  <span className="text-[9.5px] font-normal text-[#8E8E93]" title={`Pola: ${preview.pattern}`}>
                    {preview.designer_code} · {preview.parts?.TYPE} · {preview.parts?.CAT}
                  </span>
                )}
              </div>
            </Field>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
            <Field label="Jenis desain">
              <KNSelect data-testid="design-type-select" className="field" value={f.design_type} options={TYPE_OPTS}
                onValueChange={(v) => { set("design_type", v); set("category_code", ""); }} disabled={isEdit} />
            </Field>
            <Field label={<span className="flex items-center justify-between">Kategori {f.design_type} *
              {canManageMaster && (
                <button type="button" className="inline-flex items-center gap-1 text-[10px] text-[#6B219A] hover:underline"
                  data-testid="design-manage-categories" onClick={() => setCatModal(true)}>
                  <Settings2 size={10} /> kelola
                </button>
              )}</span>}>
              <KNSelect data-testid="design-category-select" className="field" value={f.category_code}
                options={catOpts} placeholder="pilih kategori…" onValueChange={(v) => set("category_code", v)} searchable />
            </Field>
          </div>

          <Field label={`Palet warna (dari Pustaka Warna) · ${f.colors.length} warna`}>
            <ColorPicker value={f.colors} onChange={(v) => set("colors", v)} testId="design-colors" />
          </Field>

          <div className="grid gap-2.5 md:grid-cols-2">
            <Field label="Repeat (cm)">
              <input className="field" data-testid="design-repeat-input" value={f.repeat_cm}
                onChange={(e) => set("repeat_cm", e.target.value)} placeholder="32" />
            </Field>
            <Field label="Jumlah screen">
              <input className="field" data-testid="design-screens-input" value={f.screen_count}
                onChange={(e) => set("screen_count", e.target.value)} placeholder="4" />
            </Field>
          </div>

          <Field label="Rekomendasi / peruntukan produk (opsional, bisa lebih dari satu)">
            <ProductPicker value={f.products} onChange={(v) => set("products", v)} testId="design-products" />
          </Field>

          <Field label="Cerita / catatan desain">
            <textarea className="field" rows={2} data-testid="design-story-input" value={f.story}
              onChange={(e) => set("story", e.target.value)} placeholder="mis. inspirasi salur pelangi untuk koleksi lebaran" />
          </Field>
          <Field label="Tag (tersimpan — ketik sedikit lalu pilih)">
            <TagInput value={f.tags} onChange={(v) => set("tags", v)} testId="design-tags" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EFF0F2] px-4 py-3">
          <button className="secondary-button" onClick={onClose} data-testid="design-form-cancel">Batal</button>
          <button className="primary-button" onClick={save} disabled={saving} data-testid="design-form-save">
            <Save size={13} /> {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
      {catModal && (
        <CategoryManagerModal designType={f.design_type} onClose={() => { setCatModal(false); loadCats(); }} />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold text-[#6B6B73]">{label}</span>
      {children}
    </label>
  );
}
