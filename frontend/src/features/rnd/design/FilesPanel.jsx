/** FilesPanel — berkas berjenis: artwork (per versi), foto referensi, mockup. */
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { deleteDesignFile, designFileUrl, uploadDesignKindFile } from "../rndApi";
import { errMsg } from "../rndMeta";

const KIND_META = {
  artwork: { label: "Artwork", hint: "karya siap cetak untuk versi berjalan" },
  reference: { label: "Foto referensi", hint: "inspirasi / acuan dari pembuat desain" },
  mockup: { label: "Mockup", hint: "visual penerapan di produk" },
};

export default function FilesPanel({ design, kind, canEdit, onDone, onError }) {
  const meta = KIND_META[kind];
  const files = (design.files || []).filter((f) => (f.kind || "artwork") === kind);

  const upload = async (file) => {
    try { await uploadDesignKindFile(design.id, kind, file); onDone?.(`${meta.label} "${file.name}" terunggah.`); }
    catch (e) { onError?.(errMsg(e, "Unggah gagal.")); }
  };

  return (
    <div data-testid={`design-files-${kind}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] text-[#6B6B73]">{meta.hint} · {files.length} berkas</p>
        {canEdit && (
          <label className="secondary-button cursor-pointer !py-1 text-[11px]" data-testid={`design-upload-${kind}-label`}>
            <Upload size={12} /> Unggah {meta.label.toLowerCase()}
            <input type="file" className="hidden" accept={kind === "artwork" ? "image/*,.pdf" : "image/*"} multiple
              data-testid={`design-upload-${kind}`}
              onChange={(e) => { Array.from(e.target.files || []).forEach(upload); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {files.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center rounded-lg border border-dashed border-[#D9D9DE] text-[11px] text-[#9A9BA3]">
          <ImageIcon size={18} className="mb-1" /> belum ada {meta.label.toLowerCase()}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {files.map((f) => (
            <div key={f.id} className="group relative overflow-hidden rounded-lg border border-[#E5E5EA] bg-[#F5F5F7]" data-testid={`design-file-${f.id}`}>
              <a href={designFileUrl(design.id, f.id)} target="_blank" rel="noreferrer" className="block aspect-square">
                {f.content_type?.startsWith("image/")
                  ? <img src={designFileUrl(design.id, f.id)} alt={f.filename} className="h-full w-full object-cover" loading="lazy" />
                  : <span className="flex h-full items-center justify-center text-[10px] font-bold">PDF</span>}
              </a>
              <div className="px-1.5 py-1 text-[9.5px] leading-tight">
                <p className="truncate font-semibold" title={f.filename}>{f.filename}</p>
                <p className="text-[#8E8E93]">{kind === "artwork" && `v${f.version || 1} · `}{f.uploaded_by || ""}</p>
              </div>
              {canEdit && (
                <button className="absolute right-1 top-1 hidden rounded bg-white/90 p-1 text-red-500 shadow group-hover:block"
                  data-testid={`design-file-delete-${f.id}`} title="Hapus berkas"
                  onClick={() => deleteDesignFile(design.id, f.id).then(() => onDone?.("Berkas dihapus.")).catch((e) => onError?.(errMsg(e)))}>
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
