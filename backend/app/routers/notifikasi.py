"""Router: notifikasi terjadwal per puskesmas - kapus atur, sistem kirim via WA."""
import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.deps import require_kapus
from app.db import get_db
from app.notifikasi_schedule import countdown_text, hitung_next_kirim, now_wib
from app.schemas import NotifikasiJenis, NotifikasiSettings, NotifikasiUpdate
from app.wa_gateway import wa_send_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifikasi", tags=["notifikasi"])

DEFAULT_NOTIF_JENIS = [
    # --- sudah ada ---
    {
        "id": "pelatihan_belum_1tahun",
        "label": "Reminder pelatihan (belum ikut 1 tahun)",
        "deskripsi": "Notifikasi ke staff yang belum mengikuti pelatihan dalam 1 tahun terakhir",
        "aktif": False,
        "jadwal_tipe": "tahunan",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "laporan_ke_pimpinan",
        "label": "Laporan peserta pelatihan ke pimpinan",
        "deskripsi": "Laporan berapa staff sudah/belum ikut pelatihan dikirim ke kepala puskesmas",
        "aktif": False,
        "jadwal_tipe": "mingguan",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "info_jadwal_pelatihan",
        "label": "Info jadwal pelatihan ke staff",
        "deskripsi": "Notifikasi otomatis ke semua staff saat admin membuat jadwal pelatihan baru",
        "aktif": False,
        "jadwal_tipe": "instant",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "reminder_buka_website",
        "label": "Reminder buka website (mingguan)",
        "deskripsi": "Pengingat ke staff untuk membuka website SiAP-PKM setiap 1 minggu",
        "aktif": False,
        "jadwal_tipe": "mingguan",
        "tanggal": None,
        "jam": "09:00",
        "wa_enabled": True,
    },
    # --- baru ---
    {
        "id": "reminder_pelatihan_akan_datang",
        "label": "Reminder pelatihan akan seringkonasi",
        "deskripsi": "Pengingat otomatis 3 hari sebelum jadwal pelatihan diselenggarakan",
        "aktif": False,
        "jadwal_tipe": "harian",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "reminder_baca_materi",
        "label": "Reminder baca materi/literasi (bulanan)",
        "deskripsi": "Pengingat ke staff untuk membaca bahan literasi/materi setiap 1 bulan",
        "aktif": False,
        "jadwal_tipe": "mingguan",
        "tanggal": None,
        "jam": "09:00",
        "wa_enabled": True,
    },
    {
        "id": "notif_materi_baru",
        "label": "Notifikasi saat ada materi baru",
        "deskripsi": "Notifikasi otomatis ke staff saat admin menambahkan materi edukasi baru",
        "aktif": False,
        "jadwal_tipe": "instant",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "reminder_simulasi_bencana",
        "label": "Reminder simulasi bencana (26 April)",
        "deskripsi": "Pengingat tahunan untuk melaksanakan simulasi bencana setiap 26 April",
        "aktif": False,
        "jadwal_tipe": "tahunan",
        "tanggal": "04-26",
        "jam": "08:00",
        "wa_enabled": True,
    },
    {
        "id": "reminder_evaluasi_kompetensi",
        "label": "Reminder evaluasi ulang kompetensi",
        "deskripsi": "Pengingat 6 bulanan agar staff melakukan asesmen ulang kompetensi",
        "aktif": False,
        "jadwal_tipe": "sekali",
        "tanggal": None,
        "jam": "08:00",
        "wa_enabled": True,
    },
]


async def _send_wa_message(wa_phone: str, message: str) -> bool:
    if not wa_phone:
        return False
    try:
        ok, detail = await wa_send_text(wa_phone, message)
        if not ok:
            logger.warning("Gagal kirim WA notif: %s", detail)
        return ok
    except Exception as e:
        logger.warning("Gagal kirim WA notif: %s", e)
        return False


async def _proses_notifikasi_puskesmas(db, pk_id: str, notif: dict) -> None:
    """Proses satu notifikasi terjadwal: kirim WA ke target yang sesuai."""
    if notif.get("jadwal_tipe") == "instant":
        return
    if not notif.get("wa_enabled", True):
        return

    notif_id = notif.get("id", "")
    now = now_wib()

    # === sudah ada ===
    if notif_id == "pelatihan_belum_1tahun":
        from app.pelatihan_compliance import REMINDER_PELATIHAN_MESSAGE, staff_belum_pelatihan_1tahun

        for s in await staff_belum_pelatihan_1tahun(db, pk_id):
            if s.get("wa_phone"):
                dn = s.get("display_name") or s["username"]
                await _send_wa_message(
                    s["wa_phone"],
                    REMINDER_PELATIHAN_MESSAGE.format(nama=dn),
                )

    elif notif_id == "laporan_ke_pimpinan":
        kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
        if not kapus or not kapus.get("wa_phone"):
            return
        total_staff = await db.users.count_documents({"puskesmas_id": pk_id, "role": "staff"})
        bulan = now.strftime("%Y-%m")
        staff_docs = await db.users.find({"puskesmas_id": pk_id, "role": "staff"}).to_list(500)
        staff_names = {d["username"] for d in staff_docs}
        hadir_di_puskesmas = await db.pelatihan_peserta.count_documents({
            "username": {"$in": list(staff_names)},
            "hadir": True,
            "waktu_absen": {"$regex": f"^{bulan}"},
        })
        belum = int(total_staff) - hadir_di_puskesmas
        await _send_wa_message(
            kapus["wa_phone"],
            f"Laporan Pelatihan - {now.strftime('%B %Y')}\n"
            f"Total staf: {total_staff}\n"
            f"Sudah hadir bulan ini: {hadir_di_puskesmas}\n"
            f"Belum hadir: {belum}\n"
            f"SiAP-PKM",
        )

    elif notif_id == "reminder_buka_website":
        from app.config import settings

        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        url = settings.public_api_base or "https://siap-pkm.id"
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            await _send_wa_message(
                s["wa_phone"],
                f"Halo {dn},\nRutin kunjungi portal SiAP-PKM untuk mempelajari materi kesiapsiagaan bencana terbaru dan ikuti kuis.\n{url}\nSiAP-PKM",
            )

    # === baru ===
    elif notif_id == "reminder_pelatihan_akan_datang":
        from app.config import settings

        # Cari pelatihan yang akan seringkonasi dalam 3 hari ke depan
        target_date = now.strftime("%Y-%m-%d")
        target_plus3 = (now.replace(hour=0, minute=0, second=0, microsecond=0)).strftime("%Y-%m-%d")
        import datetime as dt

        future_date = (now.replace(hour=0, minute=0, second=0, microsecond=0) + dt.timedelta(days=3)).strftime("%Y-%m-%d")

        upcoming = await db.pelatihan.find({
            "tanggal": {"$gte": target_date, "$lte": future_date}
        }).to_list(20)

        if not upcoming:
            return

        lines = []
        for p in upcoming:
            lines.append(f"• {p.get('judul','-')} - {p.get('tanggal','-')} {p.get('waktu_mulai','')} @ {p.get('lokasi','-')}")

        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        url = settings.public_api_base or "https://siap-pkm.id"
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            msg = f"Halo {dn},\nPengingat! Pelatihan berikut akan seringkonasi dalam 3 hari:\n\n"
            msg += "\n".join(lines)
            msg += f"\n\nSilakan konfirmasi kehadiran Anda.\n{url}\nSiAP-PKM"
            await _send_wa_message(s["wa_phone"], msg)

    elif notif_id == "reminder_baca_materi":
        from app.config import settings

        # Cari staff yang belum baca materi dalam 30 hari terakhir
        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        url = settings.public_api_base or "https://siap-pkm.id"
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            await _send_wa_message(
                s["wa_phone"],
                f"Halo {dn},\nJangan lupa baca bahan literasi dan materi kesiapsiagaan bencana terbaru di portal SiAP-PKM.\n\n"
                f"Ayo tingkatkan pengetahuan Anda!\n{url}\nSiAP-PKM",
            )

    elif notif_id == "reminder_simulasi_bencana":
        from app.config import settings

        kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
        if not kapus or not kapus.get("wa_phone"):
            return
        url = settings.public_api_base or "https://siap-pkm.id"
        await _send_wa_message(
            kapus["wa_phone"],
            f"📅 *Pengingat Simulasi Bencana*\n\n"
            f"Bapak/Ibu Kepala Puskesmas,\n\n"
            f"Pada tanggal 26 April setiap tahun, wajib dilaksanakan simulasi bencana. "
            f"Silakan koordinasi dengan tim untuk kesiapan lokasi, skenario, dan daftar hadir.\n\n"
            f"Lihat panduan simulasi: {url}/simulasi\nSiAP-PKM",
        )

    elif notif_id == "reminder_evaluasi_kompetensi":
        from app.config import settings

        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        url = settings.public_api_base or "https://siap-pkm.id"
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            await _send_wa_message(
                s["wa_phone"],
                f"Halo {dn},\nSudah 6 bulan terakhir asesmen kompetensi Anda. "
                f"Silakan lengkapi asesmen ulang melalui portal SiAP-PKM.\n\n"
                f"Akses asesmen: {url}/asesmen\nSiAP-PKM",
            )


async def notify_jadwal_pelatihan_baru(db, pelatihan_doc: dict) -> None:
    """Kirim WA ke staff puskesmas yang mengaktifkan info jadwal pelatihan."""
    judul = pelatihan_doc.get("judul", "")
    tanggal = pelatihan_doc.get("tanggal", "")
    waktu = pelatihan_doc.get("waktu_mulai", "")
    lokasi = pelatihan_doc.get("lokasi", "-")
    line = f"• {judul} - {tanggal} {waktu} @ {lokasi}"

    cursor = db.notifikasi_settings.find({
        "notifikasi": {"$elemMatch": {"id": "info_jadwal_pelatihan", "aktif": True, "wa_enabled": True}},
    })
    async for settings_doc in cursor:
        pk_id = str(settings_doc.get("puskesmas_id", ""))
        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            await _send_wa_message(
                s["wa_phone"],
                f"Halo {dn},\nAda jadwal pelatihan baru:\n{line}\n\nSilakan konfirmasi kehadiran Anda.\nSiAP-PKM",
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.notifikasi_settings.update_one(
            {"puskesmas_id": pk_id, "notifikasi.id": "info_jadwal_pelatihan"},
            {"$set": {"notifikasi.$.terakhir_kirim": now_iso}},
        )


async def notify_materi_baru(db, materi_doc: dict) -> None:
    """Kirim WA ke staff saat admin menambahkan materi edukasi baru."""
    judul = materi_doc.get("title", "")
    kategori = materi_doc.get("category", "")
    url = materi_doc.get("url", "") or materi_doc.get("thumbnail_url", "") or ""

    cursor = db.notifikasi_settings.find({
        "notifikasi": {"$elemMatch": {"id": "notif_materi_baru", "aktif": True, "wa_enabled": True}},
    })
    async for settings_doc in cursor:
        pk_id = str(settings_doc.get("puskesmas_id", ""))
        staff_docs = await db.users.find(
            {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
        ).to_list(500)
        for s in staff_docs:
            dn = s.get("display_name") or s["username"]
            msg = f"Halo {dn},\n📚 Materi edukasi baru tersedia:\n"
            msg += f"*{judul}*"
            if kategori:
                msg += f"\nKategori: {kategori}"
            msg += f"\n\nAyo baca sekarang!\nSiAP-PKM"
            await _send_wa_message(s["wa_phone"], msg)

        now_iso = datetime.now(timezone.utc).isoformat()
        await db.notifikasi_settings.update_one(
            {"puskesmas_id": pk_id, "notifikasi.id": "notif_materi_baru"},
            {"$set": {"notifikasi.$.terakhir_kirim": now_iso}},
        )


async def notify_lapor_bencana_all(submission_doc: dict) -> None:
    """Kirim WA ke SEMUA kepala puskesmas di sistem saat ada laporan bencana masuk."""
    db = get_db()
    dari = submission_doc.get("nama", "Tidak diketahui")
    jenis = submission_doc.get("jenis_bencana", "-")
    lokasi = submission_doc.get("lokasi", "-")
    tanggal = submission_doc.get("tanggal_kejadian", "-")
    now_local = now_wib().strftime("%d %b %Y %H:%M")
    from app.config import settings

    url = settings.public_api_base or "https://siap-pkm.id"

    kapus_docs = await db.users.find(
        {"role": "kepala_puskesmas", "wa_phone": {"$exists": True, "$ne": ""}}
    ).to_list(200)

    for kapus in kapus_docs:
        if not kapus.get("wa_phone"):
            continue
        await _send_wa_message(
            kapus["wa_phone"],
            f"🚨 *Laporan Bencana Baru*\n\n"
            f"Bapak/Ibu Kepala Puskesmas,\n\n"
            f"Ada laporan bencana baru yang masuk:\n"
            f"• Pelapor: {dari}\n"
            f"• Jenis: {jenis}\n"
            f"• Lokasi: {lokasi}\n"
            f"• Tanggal: {tanggal}\n"
            f"• Waktu laporan: {now_local} WIB\n\n"
            f"Segera cek dan tindak lanjuti.\n{url}/admin\nSiAP-PKM",
        )


async def notify_lapor_bencana(db, submission_doc: dict) -> None:
    """Kirim WA ke kepala puskesmas saat ada laporan bencana masuk (satu puskesmas tertentu)."""
    pk_id = str(submission_doc.get("puskesmas_id", ""))
    if not pk_id:
        return

    kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
    if not kapus or not kapus.get("wa_phone"):
        return

    dari = submission_doc.get("nama", "Tidak diketahui")
    jenis = submission_doc.get("jenis_bencana", "-")
    lokasi = submission_doc.get("lokasi", "-")
    tanggal = submission_doc.get("tanggal_kejadian", "-")
    now_local = now_wib().strftime("%d %b %Y %H:%M")
    from app.config import settings

    url = settings.public_api_base or "https://siap-pkm.id"
    await _send_wa_message(
        kapus["wa_phone"],
        f"🚨 *Laporan Bencana Baru*\n\n"
        f"Bapak/Ibu Kepala Puskesmas,\n\n"
        f"Ada laporan bencana baru yang masuk:\n"
        f"• Pelapor: {dari}\n"
        f"• Jenis: {jenis}\n"
        f"• Lokasi: {lokasi}\n"
        f"• Tanggal: {tanggal}\n"
        f"• Waktu laporan: {now_local} WIB\n\n"
        f"Segera cek dan tindak lanjuti.\n{url}/admin\nSiAP-PKM",
    )


async def _cek_dan_kirim_notifikasi() -> None:
    """Background task: cek semua notifikasi aktif terjadwal, kirim yang sudah waktunya."""
    try:
        db = get_db()
        now_utc = datetime.now(timezone.utc)
        cursor = db.notifikasi_settings.find({
            "notifikasi": {"$elemMatch": {"aktif": True, "jadwal_tipe": {"$ne": "instant"}}},
        })
        async for settings_doc in cursor:
            pk_id = str(settings_doc.get("puskesmas_id", ""))
            for notif in settings_doc.get("notifikasi", []):
                if not notif.get("aktif", False):
                    continue
                if notif.get("jadwal_tipe") == "instant":
                    continue
                next_kirim = notif.get("next_kirim")
                if not next_kirim:
                    # Backfill jadwal yang belum punya next_kirim
                    next_kirim = hitung_next_kirim(notif)
                    if next_kirim:
                        await db.notifikasi_settings.update_one(
                            {"puskesmas_id": pk_id, "notifikasi.id": notif["id"]},
                            {"$set": {"notifikasi.$.next_kirim": next_kirim}},
                        )
                    continue
                try:
                    next_dt = datetime.fromisoformat(next_kirim)
                    if next_dt.tzinfo is None:
                        next_dt = next_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    continue
                if now_utc >= next_dt:
                    await _proses_notifikasi_puskesmas(db, pk_id, notif)
                    tipe = notif.get("jadwal_tipe", "sekali")
                    if tipe == "sekali":
                        new_next = None
                    else:
                        new_next = hitung_next_kirim(notif, after=now_wib())
                    await db.notifikasi_settings.update_one(
                        {"puskesmas_id": pk_id, "notifikasi.id": notif["id"]},
                        {"$set": {
                            "notifikasi.$.terakhir_kirim": now_utc.isoformat(),
                            "notifikasi.$.next_kirim": new_next,
                        }},
                    )
    except Exception as e:
        logger.error("Error cek notifikasi: %s", e)


_scheduler_task: asyncio.Task | None = None


async def start_notifikasi_scheduler() -> None:
    """Jalankan loop pengecekan notifikasi setiap 30 detik."""
    global _scheduler_task

    async def _loop():
        while True:
            await _cek_dan_kirim_notifikasi()
            await asyncio.sleep(30)

    _scheduler_task = asyncio.create_task(_loop())
    logger.info("Notifikasi scheduler dimulai (interval 30 detik, zona WIB)")


def _enrich_notif(n: dict) -> dict:
    nd = dict(n)
    if nd.get("aktif") and nd.get("jadwal_tipe") != "instant":
        if not nd.get("next_kirim"):
            nd["next_kirim"] = hitung_next_kirim(nd)
        nd["countdown"] = countdown_text(nd.get("next_kirim"))
    else:
        nd["countdown"] = None
    return nd


@router.get("/{pk_id}", response_model=NotifikasiSettings)
async def get_notifikasi_settings(pk_id: str, username: str = Depends(require_kapus)):
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Hanya bisa atur notifikasi puskesmas Anda sendiri")

    doc = await db.notifikasi_settings.find_one({"puskesmas_id": pk_id})
    if not doc:
        defaults = [_enrich_notif(n) for n in DEFAULT_NOTIF_JENIS]
        return NotifikasiSettings(puskesmas_id=pk_id, notifikasi=[NotifikasiJenis(**n) for n in defaults])

    notif_list = []
    for n in doc.get("notifikasi", []):
        try:
            notif_list.append(NotifikasiJenis(**_enrich_notif(n)))
        except Exception:
            pass
    return NotifikasiSettings(puskesmas_id=pk_id, notifikasi=notif_list)


@router.put("/{pk_id}", response_model=NotifikasiSettings)
async def update_notifikasi_settings(
    pk_id: str,
    body: NotifikasiUpdate,
    username: str = Depends(require_kapus),
):
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Hanya bisa atur notifikasi puskesmas Anda sendiri")

    notif_docs = []
    for n in body.notifikasi:
        nd = n.model_dump(exclude={"countdown"})
        nd["next_kirim"] = hitung_next_kirim(nd)
        notif_docs.append(_enrich_notif(nd))

    await db.notifikasi_settings.update_one(
        {"puskesmas_id": pk_id},
        {"$set": {"puskesmas_id": pk_id, "notifikasi": notif_docs}},
        upsert=True,
    )
    return NotifikasiSettings(
        puskesmas_id=pk_id,
        notifikasi=[NotifikasiJenis(**n) for n in notif_docs],
    )


@router.post("/{pk_id}/test-kirim/{notif_id}")
async def test_kirim_notifikasi(pk_id: str, notif_id: str, username: str = Depends(require_kapus)):
    """Test kirim notifikasi sekarang (untuk testing)."""
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Hanya bisa test notifikasi puskesmas Anda sendiri")

    doc = await db.notifikasi_settings.find_one({"puskesmas_id": pk_id})
    notif = None
    if doc:
        for n in doc.get("notifikasi", []):
            if n.get("id") == notif_id:
                notif = n
                break
    if not notif:
        for n in DEFAULT_NOTIF_JENIS:
            if n["id"] == notif_id:
                notif = n
                break
    if not notif:
        raise HTTPException(status_code=404, detail="Jenis notifikasi tidak ditemukan")

    if notif_id == "info_jadwal_pelatihan":
        pel = await db.pelatihan.find({}).sort("created_at", -1).limit(1).to_list(1)
        if pel:
            await notify_jadwal_pelatihan_baru(db, pel[0])
        else:
            raise HTTPException(status_code=400, detail="Belum ada jadwal pelatihan untuk di-test")
    else:
        await _proses_notifikasi_puskesmas(db, pk_id, notif)

    return {"ok": True, "message": f"Notifikasi '{notif.get('label', notif_id)}' dikirim secara test"}
