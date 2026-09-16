# Test Credentials
# Agent writes here when creating/modifying auth credentials (admin accounts, test users).
# Testing agent reads this before auth tests. Fork/continuation agents read on startup.

Lingkungan lokal pengujian saja. Base URL API: baca REACT_APP_BACKEND_URL di /app/frontend/.env.
Konteks badan usaha uji: ent_ksc (header X-Entity-Id; pilih badan usaha yang sama di layar).

- Admin: admin@kainnusantara.id / demo12345
- MD (merchandiser): md@kainnusantara.id / demo12345
- Manajer: manager@kainnusantara.id / demo12345
- Sales: sales@kainnusantara.id / demo12345
- Admin Sales: salesadmin@kainnusantara.id / demo12345
- Finance: finance@kainnusantara.id / demo12345
- Gudang: warehouse@kainnusantara.id / demo12345
- Desainer: designer@kainnusantara.id / demo12345 (Sari Melati, role designer, entitas ent_ksc)

DESIGN STUDIO (2026-09-16): layar `?view=rnd-designs&entity=ent_ksc` (hub Desainer → tab "Desain & Pattern"). Klik kartu `design-card-<id>` membuka halaman detail (`design-detail-page`). Kode desain otomatis (mis. BDI-PTR-SLR-001). Nilai versi 0–2 kelipatan 0,25; ambang ACC default 1,5 (`rnd.design_acc_min_score`). Aksi penilai (review/nilai/ACC/aktifkan/arsip) hanya admin/manager; desainer: buat, unggah, ajukan, versi baru, umpan balik, colorway.

Login UI testid: login-email-input, login-password-input, login-submit-button.
Routing uji: ?view=md-products&entity=ent_ksc · ?view=rnd-specs&entity=ent_ksc · ?view=sales.
KNSelect: opsi <testid>-option-<value>, pencarian <testid>-search.
Gunakan prefix TEST_ untuk data baru; bersihkan hanya ID uji.
Jika akun md@ hilang setelah seed: `supervisorctl restart backend` (bootstrap idempoten).

FASE SL (scan label): tugas uji `wms_e2e3d9059660` (KSC/PO-00014, CBN-MEGA-PREM, 250 yard, wh_jakarta, bin A1-01).
CATATAN 2026-09-16: task PO-00014 (`wms_7d68b73ebcc1`) sudah DISELESAIKAN oleh main agent untuk data uji selisih → PO `po_78d343ce4efd` status completed dengan `receipt_variances[0]` (roll RL-00058 label≠aktual). Untuk scan label baru pakai task inbound lain yang masih `waiting_goods` (GET /api/inbound/tasks).
Peran `finance` demo TIDAK memegang `vendor_bill.view` (matriks izin lama) → uji Tagihan Supplier / billing-context dengan admin@ atau manager@.
Pola label per Barang Supplier: `sit_b5ed6c7e1bc9` (NTT-IKAT-GRD, Ntt Weaving) berpola GS1; task scan uji `wms_f808e668a2e7` (KSC/PO-00015, TNI-GRGD-001, 180 yard, status receiving) — contoh label GS1 `(240)NTT-IKAT-GRD(10)DL-G1(21)R1(3231)000300` (=30 yd), fallback supplier `NTT-IKAT-GRD|DL-G1|R2|30|5|BLU`. Selalu undo roll uji.
Contoh label: `{"sku":"CBN-MEGA-PREM","lot":"DL-01","roll":"R1","yd":120.5,"kg":25.1,"color":"RED"}` · `CBN-MEGA-PREM|DL-01|R2|118|24.5|RED` · `(240)CBN-MEGA-PREM(10)DL-01(21)R3(3230)00000120`.
Layar: login gudang → `wms-tab-inbound` → `inbound-task-<id>` → panel `scan-label-panel`. Reset demo: `bash scripts/seed_reset.sh`.


§3-C JUAL SAMPEL (2026-09-16, menu "Jual Sampel" DIHAPUS): sampel = baris SO ber-`is_sample` dari POS
(ProductQuickView `quickview-sample-button`, toggle `toggle-sample-<pid>`, harga manual `sample-price-input-<pid>`).
Confirm SO → tugas outbound `task_subtype=sample_cut`; gudang: WMS Barang Keluar → `sample-cut-panel-<taskId>`
(`sample-cut-code-` isi EPC/nomor roll, `sample-cut-length-`, `sample-cut-use-suggested-`) atau HP gudang tab Sampel.
API: GET /api/sample-quote · POST /api/outbound/tasks/{id}/cut-sample {epc|roll_id, actual_length, reason}.
Contoh EPC roll available ent_ksc: lihat rfid_tags (roll RL-00002 → E20B-639D-27E3-C84F-7696-157A).
Uji regresi: pytest backend/tests/test_sample_pos_flow.py. Master harga sampel: view pricelist (bawah).
