"""Teks dokumentasi & checklist black-box untuk akun role `developer` (MongoDB: education_items, audience=developer)."""

DEVELOPER_ARTICLE_TITLE = "Dokumentasi sistem & panduan black-box testing"

DEVELOPER_ARTICLE_DESCRIPTION = (
    "Ringkasan arsitektur Siaga Bencana (portal petugas Puskesmas), peran pengguna, endpoint API, lingkungan konfigurasi, "
    "dan checklist pengujian fungsional (black-box)."
)

DEVELOPER_ARTICLE_BODY = """
=== 1. Ringkasan sistem ===

Aplikasi ini memisahkan tiga lapisan:
- Backend: FastAPI + Motor (MongoDB), JWT Bearer untuk API terproteksi, unggahan statis di /api/uploads.
- Frontend: React (Vite), React Router, axios ke prefix /api (proxy dev ke backend).
- Data: basis MongoDB (nama DB dari konfigurasi, default siaga_puskesmas). Koleksi utama: users, site_homepage, site_pages, education_items, public_submissions.

Peran pengguna (field users.role):
- admin — mengelola beranda, edukasi (publik/petugas staff/developer), halaman situs, kotak masuk (laporan/saran), unggah media, akun petugas (staff) (hanya admin utama untuk CRUD user).
- staff — hanya GET /api/staff/education (materi audience staff).
- developer — dokumentasi internal + GET /api/developer/education (materi audience developer); tidak mengelola konten admin dan tidak mengakses materi staff.

Autentikasi: POST /api/auth/login { username, password } → access_token. Header: Authorization: Bearer <token>. GET /api/auth/me → username, role, can_manage_users (true hanya untuk admin utama sesuai DEFAULT_ADMIN_USERNAME di .env).

=== 2. Variabel lingkungan backend (penting) ===

- MONGODB_URI, MONGODB_DB
- JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
- DEFAULT_ADMIN_USERNAME / DEFAULT_ADMIN_PASSWORD, DEFAULT_PETUGAS_USERNAME / DEFAULT_PETUGAS_PASSWORD
- DEFAULT_DEVELOPER_USERNAME / DEFAULT_DEVELOPER_PASSWORD (akun dokumentasi; seed memastikan user ada)
- RESET_USERS_ON_START — jika true, semua user dihapus lalu dibuat ulang dari env (hati-hati di produksi)
- UPLOAD_MAX_BYTES, direktori uploads

=== 3. Ringkasan endpoint (pengujian black-box) ===

Publik (tanpa token):
- GET /api/health
- GET /api/public/homepage
- GET /api/public/education  (query opsional: ?category=…)
- GET /api/public/pages, GET /api/public/pages/{slug}
- POST /api/public/submissions  (JSON: form_type lapor_bencana | saran_aduan + field terkait)

Auth:
- POST /api/auth/login
- GET /api/auth/me  (Bearer)

Masyarakat (Bearer, role staff atau admin):
- GET /api/staff/education

Developer / admin dokumentasi:
- GET /api/developer/education  (Bearer, role developer atau admin)

Admin konten (Bearer, role admin):
- GET/PUT /api/admin/homepage
- CRUD /api/admin/education
- CRUD /api/admin/pages
- GET /api/admin/submissions, GET /api/admin/submissions/{id}, PATCH /api/admin/submissions/{id}
- POST /api/admin/upload
- GET /api/admin/users, POST /api/admin/users, DELETE … (admin utama saja untuk beberapa operasi — ikuti error 403)

=== 4. Model data singkat ===

education_items: kind (pdf|drive|video|banner|artikel), audience (public|staff|developer), category (tips_bencana, berita, …), published, sort_order, url/body/lampiran.

site_pages: slug unik, title, body, nav_label, published, sort_order.

public_submissions: form_type, field isian laporan, created_at, read.

=== 5. Checklist black-box testing (fungsional) ===

Gunakan tiga akun uji bila tersedia: admin, petugas/staff, developer (sutra). Centang setiap skenario setelah PASS.

[A] Publik — tanpa login
  [ ] GET /api/health mengembalikan status ok
  [ ] GET /api/public/homepage mengembalikan sections (array, boleh kosong)
  [ ] GET /api/public/education mengembalikan array; item tidak boleh ber-audience staff atau developer
  [ ] GET /api/public/education?kategori=berita memfilter (atau kosong jika tidak ada data)
  [ ] GET /api/public/pages mengembalikan halaman published saja
  [ ] GET /api/public/pages/{slug} 404 untuk slug tidak ada / tidak published
  [ ] POST lapor_bencana valid → 201; invalid (mis. tanpa lokasi) → 400
  [ ] POST saran_aduan valid → 201; tanpa pesan → 400
  [ ] Buka / di browser: beranda memuat tanpa error fatal
  [ ] Buka /edukasi: daftar edukasi + chip filter bekerja
  [ ] Buka /profil dan salah satu /halaman/{slug}
  [ ] Buka /lapor-bencana dan kirim form minimal valid
  [ ] Buka /saran-aduan dan kirim form minimal valid

[B] Login & sesi
  [ ] Login admin benar → redirect /admin (atau sesuai UI)
  [ ] Login staff benar → /petugas
  [ ] Login developer benar → /developer
  [ ] Login password salah → pesan error, tidak set token
  [ ] Setelah login, refresh halaman: token dari localStorage masih dipakai (me terisi)
  [ ] Logout menghapus sesi UI; request berikut ke endpoint admin tanpa token → 401

[C] Ruang petugas (staff / admin)
  [ ] Sebagai staff: GET /api/staff/education hanya item audience staff & published
  [ ] Sebagai developer: GET /api/staff/education harus 403 (bukan masyarakat/staff)
  [ ] UI /petugas menampilkan feed; admin masih bisa buka /petugas; URL lama /masyarakat dialihkan ke /petugas

[D] Ruang developer
  [ ] Sebagai developer: GET /api/developer/education mengembalikan artikel dokumentasi (audience developer)
  [ ] Sebagai staff: GET /api/developer/education → 403
  [ ] Sebagai admin: GET /api/developer/education → 200 (admin boleh baca dokumentasi)
  [ ] UI /developer menampilkan isi handbook

[E] Admin — homepage & edukasi
  [ ] Tanpa token: PUT /api/admin/homepage → 401
  [ ] Sebagai admin: GET/PUT homepage persisten setelah reload
  [ ] CRUD education: buat item publik (pdf/url wajib selain artikel), artikel (body wajib), ubah audience staff/developer, hapus item
  [ ] Upload file ke /api/admin/upload: ekstensi diizinkan vs ditolak; file terlalu besar → 413

[F] Admin — halaman situs & kotak masuk
  [ ] CRUD site_pages: slug unik, konflik slug → 409
  [ ] Daftar submissions terurut; buka detail by id; PATCH read=true memperbarui status

[G] Admin — pengguna (admin utama)
  [ ] Non-admin utama tidak dapat hapus user admin utama
  [ ] Tambah staff baru; login dengan staff baru berhasil

[H] Keamanan & negatif
  [ ] Token palsu / expired → 401 pada /api/auth/me
  [ ] Staff mencoba DELETE /api/admin/education/{id} → 403
  [ ] Developer mencoba PUT /api/admin/homepage → 403
  [ ] CORS preflight (bila frontend beda origin) tidak memblokir GET sederhana

[I] Regresi UI frontend
  [ ] Theme toggle (day/night) tidak merusak layout
  [ ] Link navigasi: Beranda, Edukasi, Profil, Lapor, Saran, Login
  [ ] Responsif sempit: header tidak overflow parah

=== 6. Catatan rilis & data ===

Seed awal mengisi contoh edukasi publik, satu PDF staff, halaman profil placeholder, dan dokumen developer ini. Konten produksi mengganti contoh lewat Admin.

Password default hanya untuk lingkungan pengembangan — ganti di .env sebelum produksi.

=== 7. Kontak teknis ===

Lihat README proyek backend/frontend untuk menjalankan layanan lokal dan proxy Vite ke /api.

=== 8. Asesmen video ML & AI — uji & konfigurasi (selaras Puskesmas) ===

- Modul: petugas/staff login → /petugas → daftar & pemutar Video ML → setelah 4 jawaban, laporan + Indeks KA (LIPI-lite: hanya sisi pengetahuan & sikap, bukan tujuh pilar LIPI penuh / RD/SP/MS belum diisi). Logika asesmen & korpus prompt sama dengan rilis Siaga Bencana Puskesmas (`shared/python/siaga_common`).
- Backend: LLM lewat .env (DEEPSEEK_API_KEY, opsional OLLAMA lokal) — rincian & batasan di `AI_FITUR_DAN_INPUT.txt` repositori ini.
- Endpoint (Bearer, staff): POST /api/public/ml-sessions, PATCH …/watch, POST …/quiz, POST …/quiz/answer.
- Checklist uji: mulai sesi, tonton, lulusi kuis, pastikan 200 + ringkasan; token cadangan/timeout: backend fallback soal, laporan sederhana. Soal 4 (evaluasi) dapat memuat rentang waktu YouTube: frontend membatasi pemutar ke cuplikan start/end dari API (anti-nyontek pada soal 1–3).
- Asisten WhatsApp (opsional, Fonnte + LLM): korpus `fonnte_staff_corpus` menyertakan blok ringkasan asesmen Siaga Bencana; progres selesai tercantum bila tersedia.

— Akhir dokumen developer —
""".strip()
