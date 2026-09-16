"""Design Studio — pengembangan master desain (`design_gallery`) menjadi siklus hidup utuh.

Menambah: kategori per jenis, kode otomatis terkonfigurasi, tag tersimpan, palet warna
dari Pustaka Warna (wajib master), alternatif warna (colorway), rekomendasi produk,
foto referensi & mockup, nilai 0–2 kelipatan 0,25 per versi, timeline & umpan balik dua arah.
"""
import re
from typing import Any, Dict, List, Optional

from db import db
from core_utils import new_id, now_iso, safe_doc
from services.config_resolver import value_of


class DesignError(ValueError):
    pass


# ═══ LIFECYCLE ═══════════════════════════════════════════════════════════════
STATUSES = ("draft", "pending_approval", "in_review", "revision", "approved",
            "active", "archived", "retired")
STATUS_LABEL = {
    "draft": "Draf", "pending_approval": "Diajukan", "in_review": "Dalam Review",
    "revision": "Perlu Revisi", "approved": "Disetujui (ACC)", "active": "Aktif / Produksi",
    "archived": "Diarsipkan", "retired": "Diarsipkan",
}
TRANSITIONS = {
    "submit": ({"draft", "revision"}, "pending_approval"),
    "start_review": ({"pending_approval"}, "in_review"),
    "request_revision": ({"pending_approval", "in_review"}, "revision"),
    "approve": ({"pending_approval", "in_review"}, "approved"),
    "activate": ({"approved"}, "active"),
    "archive": ({"draft", "revision", "approved", "active", "pending_approval", "in_review"}, "archived"),
    "reopen": ({"archived", "retired"}, "draft"),
}

FILE_KINDS = ("artwork", "reference", "mockup", "ai_illustration")

# ═══ KATEGORI ════════════════════════════════════════════════════════════════
DEFAULT_CATEGORIES = [
    ("motif", "BTK", "Batik"), ("motif", "FLR", "Floral"), ("motif", "GEO", "Geometris"),
    ("motif", "ETN", "Etnik / Tenun"), ("motif", "ABS", "Abstrak"), ("motif", "ANM", "Animal / Fauna"),
    ("pattern", "SLR", "Salur / Garis"), ("pattern", "KTK", "Kotak / Plaid"),
    ("pattern", "PLK", "Polkadot"), ("pattern", "CHV", "Chevron / Zigzag"),
    ("pattern", "HRB", "Herringbone"), ("pattern", "PSL", "Paisley"),
    ("artwork", "ILS", "Ilustrasi"), ("artwork", "TPG", "Tipografi"),
    ("artwork", "FTO", "Fotografi"), ("artwork", "LGO", "Logo / Brand"), ("artwork", "PLC", "Placement Print"),
]


async def ensure_categories() -> None:
    if await db.design_categories.count_documents({}) > 0:
        return
    rows = [{"id": new_id("dcat"), "design_type": t, "code": c, "name": n, "status": "active",
             "created_at": now_iso(), "updated_at": now_iso()} for t, c, n in DEFAULT_CATEGORIES]
    await db.design_categories.insert_many(rows)


async def list_categories(design_type: str = "", status: str = "active") -> List[Dict[str, Any]]:
    await ensure_categories()
    q: Dict[str, Any] = {}
    if design_type:
        q["design_type"] = design_type
    if status and status != "all":
        q["status"] = status
    rows = await db.design_categories.find(q, {"_id": 0}).sort([("design_type", 1), ("name", 1)]).to_list(500)
    return [safe_doc(r) for r in rows]


async def create_category(data: Dict[str, Any]) -> Dict[str, Any]:
    code = re.sub(r"[^A-Z0-9]", "", (data.get("code") or "").upper())[:6]
    name = (data.get("name") or "").strip()
    dtype = (data.get("design_type") or "").strip().lower()
    if dtype not in ("motif", "pattern", "artwork"):
        raise DesignError("Jenis desain kategori harus motif, pattern, atau artwork.")
    if len(code) < 2 or not name:
        raise DesignError("Kode kategori (2–6 huruf/angka) dan nama wajib diisi.")
    if await db.design_categories.find_one({"design_type": dtype, "code": code}, {"_id": 1}):
        raise DesignError(f"Kode kategori '{code}' sudah ada untuk jenis {dtype}.")
    doc = {"id": new_id("dcat"), "design_type": dtype, "code": code, "name": name,
           "status": "active", "created_at": now_iso(), "updated_at": now_iso()}
    await db.design_categories.insert_one(doc)
    return safe_doc(doc)


async def update_category(cat_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
    upd: Dict[str, Any] = {}
    if patch.get("name") is not None:
        upd["name"] = str(patch["name"]).strip()
    if patch.get("status") in ("active", "inactive"):
        upd["status"] = patch["status"]
    if not upd:
        raise DesignError("Tidak ada perubahan.")
    upd["updated_at"] = now_iso()
    res = await db.design_categories.find_one_and_update({"id": cat_id}, {"$set": upd},
                                                         projection={"_id": 0}, return_document=True)
    if not res:
        raise DesignError("Kategori tidak ditemukan.")
    return safe_doc(res)


async def category_of(design_type: str, code: str) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    await ensure_categories()
    return safe_doc(await db.design_categories.find_one(
        {"design_type": design_type, "code": code.upper(), "status": "active"}, {"_id": 0}))


# ═══ KODE OTOMATIS ═══════════════════════════════════════════════════════════
def designer_prefix(name: str) -> str:
    """'Budi Santoso' → 'BDI' : huruf pertama + konsonan berikutnya, dilengkapi huruf terakhir."""
    first = re.sub(r"[^A-Za-z]", "", (name or "").strip().split(" ")[0]).upper()
    if not first:
        return "DSG"
    out = first[0] + "".join(ch for ch in first[1:] if ch not in "AEIOU")
    if len(out) < 3:
        out = (out + first[::-1])[:3] if len(first) >= 3 else (out + "X" * 3)[:3]
    return out[:3]


async def code_config(entity_id: str) -> Dict[str, Any]:
    ctx = {"entity_id": entity_id or ""}
    return {
        "pattern": await value_of("rnd.design_code_pattern", ctx),
        "seq_digits": int(await value_of("rnd.design_code_seq_digits", ctx) or 3),
        "type_prefix": {
            "motif": await value_of("rnd.design_prefix_motif", ctx),
            "pattern": await value_of("rnd.design_prefix_pattern", ctx),
            "artwork": await value_of("rnd.design_prefix_artwork", ctx),
        },
        "acc_min_score": float(await value_of("rnd.design_acc_min_score", ctx) or 0),
    }


async def next_code(entity_id: str, actor: Dict[str, Any], design_type: str,
                    category_code: str) -> Dict[str, Any]:
    cfg = await code_config(entity_id)
    dtype = (design_type or "motif").lower()
    dprefix = (actor.get("designer_code") or designer_prefix(actor.get("name", ""))).upper()
    parts = {"DESIGNER": dprefix, "TYPE": cfg["type_prefix"].get(dtype, dtype[:3].upper()),
             "CAT": (category_code or "GEN").upper(), "ENTITY": ""}
    ent = await db.business_entities.find_one({"id": entity_id}, {"_id": 0, "doc_prefix": 1}) or {}
    parts["ENTITY"] = ent.get("doc_prefix", "")
    pattern = cfg["pattern"] or "{DESIGNER}-{TYPE}-{CAT}-{SEQ}"
    base = pattern
    for k, v in parts.items():
        base = base.replace("{" + k + "}", v)
    base = re.sub(r"-{2,}", "-", base)
    prefix = base.split("{SEQ}")[0]
    highest = 0
    async for row in db.design_gallery.find(
            {"entity_id": entity_id, "code": {"$regex": f"^{re.escape(prefix)}\\d+$"}},
            {"_id": 0, "code": 1}):
        try:
            highest = max(highest, int(re.findall(r"\d+$", row["code"])[0]))
        except (IndexError, ValueError):
            continue
    code = base.replace("{SEQ}", f"{highest + 1:0{cfg['seq_digits']}d}")
    return {"code": code, "designer_code": dprefix, "pattern": pattern, "parts": parts}


# ═══ TAG TERSIMPAN ═══════════════════════════════════════════════════════════
async def remember_tags(tags: List[str]) -> None:
    for t in tags or []:
        s = str(t).strip()
        if not s:
            continue
        await db.design_tags.update_one(
            {"name_lc": s.lower()},
            {"$setOnInsert": {"id": new_id("dtag"), "name": s, "name_lc": s.lower(),
                              "created_at": now_iso()},
             "$inc": {"uses": 1}, "$set": {"last_used_at": now_iso()}},
            upsert=True)


async def suggest_tags(q: str = "", limit: int = 20) -> List[Dict[str, Any]]:
    query: Dict[str, Any] = {}
    if q.strip():
        query["name_lc"] = {"$regex": re.escape(q.strip().lower())}
    rows = await db.design_tags.find(query, {"_id": 0, "name": 1, "uses": 1}).sort(
        [("uses", -1), ("name_lc", 1)]).to_list(limit)
    if not rows and not q:
        seen = set()
        async for d in db.design_gallery.find({}, {"_id": 0, "tags": 1}):
            for t in d.get("tags") or []:
                if t.lower() not in seen:
                    seen.add(t.lower())
                    rows.append({"name": t, "uses": 1})
    return rows[:limit]


# ═══ WARNA (wajib dari master) ═══════════════════════════════════════════════
async def resolve_colors(items: List[Any]) -> List[Dict[str, Any]]:
    """Setiap warna WAJIB merujuk `color_library` aktif; detail (kode/nama/hex) disalin dari master."""
    out: List[Dict[str, Any]] = []
    for it in items or []:
        cid = it.get("color_id") if isinstance(it, dict) else str(it)
        if not cid:
            continue
        c = await db.color_library.find_one({"id": cid, "status": "active"}, {"_id": 0})
        if not c:
            raise DesignError(f"Warna '{cid}' tidak ada di Pustaka Warna aktif — pilih dari master, "
                              "tidak boleh diketik bebas.")
        out.append({"color_id": c["id"], "code": c.get("code", ""), "name": c.get("name", ""),
                    "hex": c.get("hex", ""), "system": c.get("system", ""),
                    "role": (it.get("role") if isinstance(it, dict) else "") or ""})
    return out


async def resolve_products(ids: List[str]) -> List[Dict[str, Any]]:
    out = []
    for pid in ids or []:
        p = await db.products.find_one({"id": pid}, {"_id": 0, "id": 1, "sku": 1, "name": 1})
        if not p:
            raise DesignError(f"Produk '{pid}' tidak ditemukan.")
        out.append(p)
    return out


# ═══ TIMELINE & VERSI ════════════════════════════════════════════════════════
def event(actor: Dict[str, Any], kind: str, note: str = "", **extra) -> Dict[str, Any]:
    return {"id": new_id("evt"), "at": now_iso(), "by": actor.get("name", ""),
            "user_id": actor.get("id", ""), "role": actor.get("role", ""),
            "event": kind, "note": (note or "").strip(), **extra}


async def _doc(gallery_id: str) -> Dict[str, Any]:
    cur = await db.design_gallery.find_one({"id": gallery_id}, {"_id": 0})
    if not cur:
        raise DesignError("Desain tidak ditemukan.")
    return cur


def current_version(doc: Dict[str, Any]) -> Dict[str, Any]:
    v = int(doc.get("version") or 1)
    for row in doc.get("versions") or []:
        if int(row.get("version") or 0) == v:
            return row
    return {"version": v}


def _artworks_current(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    v = int(doc.get("version") or 1)
    return [f for f in doc.get("files") or []
            if (f.get("kind") or "artwork") == "artwork" and int(f.get("version") or 1) == v]


def validate_score(value: Any) -> float:
    try:
        s = float(value)
    except (TypeError, ValueError):
        raise DesignError("Nilai harus angka 0 – 2.")
    if s < 0 or s > 2 or abs(s * 4 - round(s * 4)) > 1e-6:
        raise DesignError("Nilai harus di antara 0 dan 2 dengan kelipatan 0,25 (mis. 1,25).")
    return round(s, 2)


def enrich(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not doc:
        return doc
    out = dict(doc)
    cur = current_version(out)
    out["status_label"] = STATUS_LABEL.get(out.get("status") or "draft", out.get("status"))
    out["current_score"] = cur.get("score")
    out["final_score"] = out.get("final_score")
    files = out.get("files") or []
    out["artwork_count"] = sum(1 for f in files if (f.get("kind") or "artwork") == "artwork")
    out["reference_count"] = sum(1 for f in files if f.get("kind") == "reference")
    out["mockup_count"] = sum(1 for f in files if f.get("kind") == "mockup")
    out["colorway_count"] = len(out.get("colorways") or [])
    out["feedback_count"] = len(out.get("feedback") or [])
    return out


async def transition(gallery_id: str, action: str, actor: Dict[str, Any], note: str = "",
                     score: Any = None, entity_id: str = "") -> Dict[str, Any]:
    if action not in TRANSITIONS:
        raise DesignError(f"Aksi '{action}' tidak dikenal.")
    cur = await _doc(gallery_id)
    allowed, target = TRANSITIONS[action]
    status = cur.get("status") or "draft"
    if status not in allowed:
        raise DesignError(f"Aksi ini tidak berlaku untuk status '{STATUS_LABEL.get(status, status)}'. "
                          f"Diperbolehkan dari: {', '.join(STATUS_LABEL[s] for s in sorted(allowed))}.")
    updates: Dict[str, Any] = {"status": target, "updated_at": now_iso()}
    if action == "submit":
        if not (cur.get("code") or "").strip():
            raise DesignError("Desain wajib punya kode sebelum diajukan.")
        if not _artworks_current(cur):
            raise DesignError(f"Versi v{cur.get('version', 1)} belum punya berkas artwork — unggah dulu.")
        updates.update({"submitted_by": actor.get("name", ""), "submitted_at": now_iso()})
    if action == "request_revision" and not (note or "").strip():
        raise DesignError("Catatan revisi wajib diisi supaya desainer tahu apa yang harus diperbaiki.")
    if action == "archive" and not (note or "").strip():
        raise DesignError("Alasan pengarsipan wajib diisi.")
    versions = list(cur.get("versions") or [])
    vidx = next((i for i, v in enumerate(versions)
                 if int(v.get("version") or 0) == int(cur.get("version") or 1)), None)
    if action in ("approve", "request_revision") and score is not None and vidx is not None:
        versions[vidx].update({"score": validate_score(score), "score_by": actor.get("name", ""),
                               "score_at": now_iso(), "score_note": (note or "").strip()})
        updates["versions"] = versions
    if action == "approve":
        cfg = await code_config(entity_id or cur.get("entity_id", ""))
        sc = versions[vidx].get("score") if vidx is not None else None
        if sc is None:
            raise DesignError("Beri nilai (0–2) untuk versi ini sebelum menyetujui.")
        if float(sc) < cfg["acc_min_score"]:
            raise DesignError(f"Nilai {sc} di bawah ambang ACC {cfg['acc_min_score']} — "
                              "minta revisi atau ubah ambang di Pengaturan.")
        if vidx is not None:
            versions[vidx]["acc"] = True
            versions[vidx]["acc_at"] = now_iso()
            updates["versions"] = versions
        updates.update({"approved_by": actor.get("name", ""), "approved_at": now_iso(),
                        "approve_note": note or "", "final_score": sc,
                        "approved_version": cur.get("version", 1)})
    if action == "request_revision":
        updates.update({"reject_reason": note.strip(), "rejected_by": actor.get("name", ""),
                        "rejected_at": now_iso()})
    if action == "activate":
        updates.update({"activated_by": actor.get("name", ""), "activated_at": now_iso()})
    if action == "archive":
        updates.update({"archived_by": actor.get("name", ""), "archived_at": now_iso(),
                        "archive_reason": note.strip()})
    if action == "reopen":
        updates.update({"final_score": None, "approved_by": "", "approved_at": ""})
    ev = event(actor, action, note, from_status=status, to_status=target,
               version=cur.get("version", 1), score=updates.get("versions", versions)[vidx].get("score")
               if vidx is not None and action in ("approve", "request_revision") else None)
    await db.design_gallery.update_one({"id": gallery_id}, {"$set": updates, "$push": {"timeline": ev}})
    await _notify(cur, actor, f"Desain {cur.get('code') or cur.get('title')}: {STATUS_LABEL[target]}",
                  note or f"Status diubah oleh {actor.get('name', '')}.")
    return enrich(safe_doc(await _doc(gallery_id)))


async def score_version(gallery_id: str, version: int, actor: Dict[str, Any], score: Any,
                        note: str = "") -> Dict[str, Any]:
    cur = await _doc(gallery_id)
    s = validate_score(score)
    versions = list(cur.get("versions") or [])
    idx = next((i for i, v in enumerate(versions) if int(v.get("version") or 0) == int(version)), None)
    if idx is None:
        raise DesignError(f"Versi v{version} tidak ditemukan.")
    if versions[idx].get("acc"):
        raise DesignError("Versi yang sudah ACC nilainya final dan tidak bisa diubah.")
    hist = list(versions[idx].get("score_history") or [])
    hist.append({"score": s, "by": actor.get("name", ""), "at": now_iso(), "note": (note or "").strip()})
    versions[idx].update({"score": s, "score_by": actor.get("name", ""), "score_at": now_iso(),
                          "score_note": (note or "").strip(), "score_history": hist})
    ev = event(actor, "scored", note, version=int(version), score=s)
    await db.design_gallery.update_one({"id": gallery_id}, {
        "$set": {"versions": versions, "updated_at": now_iso()}, "$push": {"timeline": ev}})
    await _notify(cur, actor, f"Nilai v{version} desain {cur.get('code') or cur.get('title')}: {s}",
                  note or "")
    return enrich(safe_doc(await _doc(gallery_id)))


async def add_feedback(gallery_id: str, actor: Dict[str, Any], text: str,
                       version: Optional[int] = None) -> Dict[str, Any]:
    cur = await _doc(gallery_id)
    if not (text or "").strip():
        raise DesignError("Isi umpan balik tidak boleh kosong.")
    fb = {"id": new_id("fb"), "text": text.strip(), "by": actor.get("name", ""),
          "user_id": actor.get("id", ""), "role": actor.get("role", ""), "at": now_iso(),
          "version": int(version or cur.get("version") or 1),
          "side": "designer" if actor.get("role") == "designer" else "assessor"}
    ev = event(actor, "feedback", text.strip()[:200], version=fb["version"])
    await db.design_gallery.update_one({"id": gallery_id}, {
        "$push": {"feedback": fb, "timeline": ev}, "$set": {"updated_at": now_iso()}})
    await _notify(cur, actor, f"Umpan balik desain {cur.get('code') or cur.get('title')}",
                  text.strip()[:160])
    return fb


async def new_version(gallery_id: str, actor: Dict[str, Any], note: str,
                      patch: Dict[str, Any]) -> Dict[str, Any]:
    cur = await _doc(gallery_id)
    if (cur.get("status") or "draft") not in ("draft", "revision", "approved", "active"):
        raise DesignError("Versi baru hanya bisa dibuat dari Draf, Perlu Revisi, Disetujui, atau Aktif.")
    if not (note or "").strip():
        raise DesignError("Tulis apa yang berubah pada versi ini.")
    nextv = int(cur.get("version") or 1) + 1
    entry = {"version": nextv, "note": note.strip(), "at": now_iso(), "by": actor.get("name", ""),
             "files": [], "score": None}
    updates: Dict[str, Any] = {"version": nextv, "status": "draft", "updated_at": now_iso()}
    for num, caster in (("repeat_cm", float), ("color_count", int), ("screen_count", int)):
        if patch.get(num) is not None:
            updates[num] = caster(patch[num])
    ev = event(actor, "new_version", note, from_status=cur.get("status"), to_status="draft", version=nextv)
    await db.design_gallery.update_one({"id": gallery_id}, {
        "$set": updates, "$push": {"versions": entry, "timeline": ev}})
    return enrich(safe_doc(await _doc(gallery_id)))


# ═══ COLORWAY (alternatif warna) ════════════════════════════════════════════
async def add_colorway(gallery_id: str, actor: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    cur = await _doc(gallery_id)
    colors = await resolve_colors(data.get("colors") or [])
    if not colors:
        raise DesignError("Alternatif warna wajib punya minimal 1 warna dari Pustaka Warna.")
    n = len(cur.get("colorways") or []) + 1
    cw = {"id": new_id("cw"), "code": f"{cur.get('code') or 'DSG'}-CW{n:02d}",
          "name": (data.get("name") or f"Alternatif {n}").strip(), "colors": colors,
          "note": (data.get("note") or "").strip(), "file_ids": [],
          "is_default": bool(data.get("is_default")), "created_by": actor.get("name", ""),
          "created_at": now_iso()}
    ev = event(actor, "colorway_added", cw["name"], colorway_id=cw["id"])
    await db.design_gallery.update_one({"id": gallery_id}, {
        "$push": {"colorways": cw, "timeline": ev}, "$set": {"updated_at": now_iso()}})
    return cw


async def update_colorway(gallery_id: str, cw_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    cur = await _doc(gallery_id)
    cws = list(cur.get("colorways") or [])
    idx = next((i for i, c in enumerate(cws) if c.get("id") == cw_id), None)
    if idx is None:
        raise DesignError("Alternatif warna tidak ditemukan.")
    if data.get("colors") is not None:
        cws[idx]["colors"] = await resolve_colors(data["colors"])
    if data.get("name") is not None:
        cws[idx]["name"] = str(data["name"]).strip()
    if data.get("note") is not None:
        cws[idx]["note"] = str(data["note"]).strip()
    if data.get("is_default") is not None:
        for c in cws:
            c["is_default"] = False
        cws[idx]["is_default"] = bool(data["is_default"])
    cws[idx]["updated_at"] = now_iso()
    await db.design_gallery.update_one({"id": gallery_id}, {"$set": {"colorways": cws, "updated_at": now_iso()}})
    return cws[idx]


async def delete_colorway(gallery_id: str, cw_id: str) -> Dict[str, Any]:
    await _doc(gallery_id)
    await db.design_gallery.update_one({"id": gallery_id}, {
        "$pull": {"colorways": {"id": cw_id}}, "$set": {"updated_at": now_iso()}})
    return {"id": cw_id, "deleted": True}


async def _notify(doc: Dict[str, Any], actor: Dict[str, Any], title: str, body: str) -> None:
    try:
        from services import notification_service as notif
        roles = ("designer",) if actor.get("role") != "designer" else ("manager", "admin")
        await notif.create_addressed(roles=roles, entity_id=doc.get("entity_id"),
                                     notif_type="design_lifecycle", title=title, body=body[:200],
                                     severity="info", link="rnd-designs", ref=doc.get("id", ""))
    except Exception as exc:  # noqa: BLE001
        print(f"[design_studio] notifikasi gagal: {exc}")
