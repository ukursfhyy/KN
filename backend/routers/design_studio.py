"""Design Studio router — siklus hidup desain, nilai per versi, colorway, kategori, tag, kode otomatis.

Menumpang koleksi `design_gallery` (bukan koleksi kedua). Izin:
- lihat   : `rnd.view` | `hr.view`
- tulis   : `rnd.manage` | `hr.manage_attendance` | `design_request.deliver` (desainer)
- menilai : `rnd.assess` (admin/manager) — review, nilai, revisi, ACC, aktifkan, arsip
"""
from typing import Any, Dict, List

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile

from dependencies import audit, require_permission
from entity_scope import assert_entity_access, entity_ctx
from routers.design_gallery import _perm_manage, _perm_view
from schemas_design_gallery import (CategoryIn, CategoryPatch, ColorwayIn, DesignFeedbackIn,
                                    DesignScoreIn, DesignTransitionIn, DesignVersionIn)
from services import design_gallery_service as gallery
from services import design_studio_service as studio
from services.design_studio_service import DesignError

router = APIRouter(prefix="/api")


def _err(exc: Exception, code: int = 400) -> HTTPException:
    return HTTPException(status_code=code, detail=str(exc))


async def _perm_assess(request: Request) -> Dict[str, Any]:
    return await require_permission(request, "rnd", "assess")


async def _guard(gallery_id: str, ctx) -> Dict[str, Any]:
    doc = await gallery.get_gallery(gallery_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Desain tidak ditemukan.")
    assert_entity_access(doc, "design_gallery", ctx)
    return doc


# ═══ META: kategori · tag · kode ═════════════════════════════════════════════
@router.get("/design-studio/meta")
async def studio_meta(request: Request, entity_id: str = Query("")) -> Dict[str, Any]:
    actor = await _perm_view(request)
    ctx = await entity_ctx(request)
    eid = entity_id or ctx.active_entity_id
    return {"statuses": [{"value": s, "label": studio.STATUS_LABEL[s]} for s in studio.STATUSES if s != "retired"],
            "transitions": {k: {"from": sorted(v[0]), "to": v[1]} for k, v in studio.TRANSITIONS.items()},
            "categories": await studio.list_categories(),
            "code": await studio.code_config(eid),
            "designer_code": actor.get("designer_code") or studio.designer_prefix(actor.get("name", ""))}


@router.get("/design-studio/next-code")
async def studio_next_code(request: Request, design_type: str = Query("motif"),
                           category_code: str = Query("")) -> Dict[str, Any]:
    actor = await _perm_view(request)
    ctx = await entity_ctx(request)
    return await studio.next_code(ctx.active_entity_id, actor, design_type, category_code)


@router.get("/design-studio/tags")
async def studio_tags(request: Request, q: str = Query(""), limit: int = Query(20, ge=1, le=100)) -> List[Dict[str, Any]]:
    await _perm_view(request)
    return await studio.suggest_tags(q, limit)


@router.get("/design-studio/categories")
async def list_categories(request: Request, design_type: str = Query(""),
                          status: str = Query("active")) -> List[Dict[str, Any]]:
    await _perm_view(request)
    return await studio.list_categories(design_type, status)


@router.post("/design-studio/categories")
async def create_category(payload: CategoryIn, request: Request) -> Dict[str, Any]:
    actor = await require_permission(request, "rnd", "manage")
    try:
        doc = await studio.create_category(payload.model_dump())
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_category_created", "design_categories", doc["id"], doc)
    return doc


@router.patch("/design-studio/categories/{cat_id}")
async def patch_category(cat_id: str, payload: CategoryPatch, request: Request) -> Dict[str, Any]:
    actor = await require_permission(request, "rnd", "manage")
    try:
        doc = await studio.update_category(cat_id, payload.model_dump(exclude_unset=True))
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_category_updated", "design_categories", cat_id,
                payload.model_dump(exclude_unset=True))
    return doc


# ═══ LIFECYCLE ═══════════════════════════════════════════════════════════════
async def _do_transition(gallery_id: str, action: str, payload: DesignTransitionIn,
                         request: Request, assess: bool) -> Dict[str, Any]:
    actor = await (_perm_assess(request) if assess else _perm_manage(request))
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        doc = await studio.transition(gallery_id, action, actor, payload.note, payload.score,
                                      ctx.active_entity_id)
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], f"design_{action}", "design_gallery", gallery_id,
                {"code": doc.get("code"), "version": doc.get("version"), "status": doc.get("status")},
                reason=payload.note or "")
    return doc


@router.post("/design-gallery/{gallery_id}/lifecycle/submit")
async def lc_submit(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "submit", payload, request, assess=False)


@router.post("/design-gallery/{gallery_id}/lifecycle/start-review")
async def lc_start_review(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "start_review", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/lifecycle/request-revision")
async def lc_request_revision(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "request_revision", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/lifecycle/approve")
async def lc_approve(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "approve", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/lifecycle/activate")
async def lc_activate(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "activate", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/lifecycle/archive")
async def lc_archive(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "archive", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/lifecycle/reopen")
async def lc_reopen(gallery_id: str, payload: DesignTransitionIn, request: Request):
    return await _do_transition(gallery_id, "reopen", payload, request, assess=True)


@router.post("/design-gallery/{gallery_id}/new-version")
async def new_version(gallery_id: str, payload: DesignVersionIn, request: Request) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        doc = await studio.new_version(gallery_id, actor, payload.note,
                                       payload.model_dump(exclude_unset=True))
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_version_bumped", "design_gallery", gallery_id,
                {"version": doc.get("version")}, reason=payload.note)
    return doc


@router.post("/design-gallery/{gallery_id}/versions/{version}/score")
async def score_version(gallery_id: str, version: int, payload: DesignScoreIn,
                        request: Request) -> Dict[str, Any]:
    actor = await _perm_assess(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        doc = await studio.score_version(gallery_id, version, actor, payload.score, payload.note)
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_version_scored", "design_gallery", gallery_id,
                {"version": version, "score": payload.score}, reason=payload.note or "")
    return doc


@router.post("/design-gallery/{gallery_id}/feedback")
async def add_feedback(gallery_id: str, payload: DesignFeedbackIn, request: Request) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        fb = await studio.add_feedback(gallery_id, actor, payload.text, payload.version)
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_feedback", "design_gallery", gallery_id,
                {"feedback_id": fb["id"]}, reason=payload.text[:200])
    return fb


# ═══ COLORWAY ════════════════════════════════════════════════════════════════
@router.post("/design-gallery/{gallery_id}/colorways")
async def add_colorway(gallery_id: str, payload: ColorwayIn, request: Request) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        cw = await studio.add_colorway(gallery_id, actor, payload.model_dump())
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_colorway_added", "design_gallery", gallery_id,
                {"colorway": cw["code"]})
    return cw


@router.put("/design-gallery/{gallery_id}/colorways/{cw_id}")
async def update_colorway(gallery_id: str, cw_id: str, payload: ColorwayIn, request: Request) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        cw = await studio.update_colorway(gallery_id, cw_id, payload.model_dump(exclude_unset=True))
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_colorway_updated", "design_gallery", gallery_id, {"colorway": cw_id})
    return cw


@router.delete("/design-gallery/{gallery_id}/colorways/{cw_id}")
async def delete_colorway(gallery_id: str, cw_id: str, request: Request) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    try:
        res = await studio.delete_colorway(gallery_id, cw_id)
    except DesignError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], "design_colorway_deleted", "design_gallery", gallery_id, {"colorway": cw_id})
    return res


# ═══ BERKAS BERJENIS (referensi / mockup / artwork) ═══════════════════════════
@router.post("/design-gallery/{gallery_id}/files-kind/{kind}")
async def upload_kind_file(gallery_id: str, kind: str, request: Request,
                           file: UploadFile = File(...),
                           caption: str = Query(""), colorway_id: str = Query("")) -> Dict[str, Any]:
    actor = await _perm_manage(request)
    ctx = await entity_ctx(request)
    await _guard(gallery_id, ctx)
    if kind not in ("artwork", "reference", "mockup"):
        raise HTTPException(status_code=400, detail="Jenis berkas harus artwork, reference, atau mockup.")
    data = await file.read()
    try:
        fmeta = await gallery.add_file(gallery_id, file.filename or kind, file.content_type or "", data,
                                       kind=kind, caption=caption, uploaded_by=actor.get("name", ""),
                                       colorway_id=colorway_id)
    except ValueError as exc:
        raise _err(exc) from exc
    await audit(actor["name"], f"design_{kind}_uploaded", "design_gallery", gallery_id,
                {"file": fmeta.get("filename")})
    return fmeta
