import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield,
  Lock,
  Database,
  RefreshCw,
  UserCheck,
  Clock,
  ClipboardList,
  Mail,
  ChevronRight,
} from 'lucide-react'

import { useTheme } from '../context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

interface PolicySectionProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  content: React.ReactNode
  delay?: number
}

function PolicySection({ icon: Icon, title, content, delay = 0 }: PolicySectionProps) {
  const { theme } = useTheme()
  const day = theme === 'day'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOutExpo, delay }}
      className="glass-panel border border-[var(--panel-border)] p-6 md:p-7"
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            day
              ? 'bg-gradient-to-br from-health-400 to-health-600 text-white shadow-md shadow-health-400/25'
              : 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-md shadow-cyan-500/25'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-bold text-theme">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-theme-muted">{content}</div>
    </motion.div>
  )
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-health-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Back link */}
      <p>
        <Link
          to="/"
          className="text-sm font-medium text-merah-bright hover:underline focus-ring"
        >
          ← Beranda
        </Link>
      </p>

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOutExpo }}
        className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-health-400 to-health-600 text-white shadow-lg shadow-health-400/30">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-theme">Kebijakan Privasi &amp; Keamanan Data</h1>
            <p className="mt-1.5 text-sm text-theme-muted">Diperbarui: Oktober 2026</p>
          </div>
        </div>
      </motion.div>

      {/* 1. Pengumpulan Data */}
      <PolicySection
        icon={Database}
        title="1. Pengumpulan Data"
        delay={0.05}
        content={
          <>
            <p>
              Kami mengumpulkan data pribadi yang Anda berikan saat mendaftar dan menggunakan layanan
              SiAP-PKM. Data yang dikumpulkan meliputi:
            </p>
            <BulletList
              items={[
                <span>
                  Nama lengkap dan informasi akun (username, kata sandi terenkripsi)
                </span>,
                <span>Affiliasi puskesmas tempat Anda bekerja</span>,
                <span>Nomor WhatsApp untuk komunikasi dan notifikasi</span>,
                <span>
                  Data demografis: usia, jenis kelamin, pendidikan terakhir, dan pengalaman kerja
                </span>,
                <span>Jawaban kuis dan hasil skrining kesiapsiagaan</span>,
              ]}
            />
            <p className="mt-3">
              Semua data dikumpulkan dengan persetujuan pengguna pada saat registrasi dan saat mengisi
              formulir skrining.
            </p>
          </>
        }
      />

      {/* 2. Autentikasi & Akses */}
      <PolicySection
        icon={Lock}
        title="2. Autentikasi &amp; Akses"
        delay={0.1}
        content={
          <>
            <p>
              Seluruh pengguna wajib melakukan autentikasi melalui token JWT (JSON Web Token) setiap
              kali mengakses sistem. Akses data diatur berdasarkan peran (role-based access):
            </p>
            <BulletList
              items={[
                <span>
                  <strong>Administrator:</strong> Dapat melihat seluruh data pengguna dan hasil
                  skrining di seluruh puskesmas.
                </span>,
                <span>
                  <strong>Kepala Puskesmas:</strong> Dapat melihat data agregat (ringkasan) petugas
                  di puskesmas yang menjadi tanggung jawabnya.
                </span>,
                <span>
                  <strong>Petugas/Staff:</strong> Hanya dapat melihat data dan hasil skrining
                  masing-masing.
                </span>,
              ]}
            />
            <p className="mt-3">
              Semua sesi otomatis berakhir setelah 7 hari tidak aktif. Token tidak diperbarui secara
              otomatis setelah masa berlaku habis.
            </p>
          </>
        }
      />

      {/* 3. Proteksi Data */}
      <PolicySection
        icon={Shield}
        title="3. Proteksi Data"
        delay={0.15}
        content={
          <>
            <p>Kami menerapkan langkah-langkah keamanan berikut untuk melindungi data Anda:</p>
            <BulletList
              items={[
                <span>
                  Data disimpan dalam database MongoDB dengan kontrol akses yang ketat.
                </span>,
                <span>
                  Kredensial basis data disimpan dalam variabel lingkungan (environment variables)
                  dan tidak pernah hardcoded.
                </span>,
                <span>
                  Seluruh endpoint API diakses melalui protokol HTTPS terenkripsi.
                </span>,
                <span>
                  Data sensitif seperti nomor WhatsApp disimpan dalam bentuk terenkripsi.
                </span>,
                <span>
                  Akses ke sistem administratif dibatasi hanya untuk pengguna yang terverifikasi.
                </span>,
              ]}
            />
          </>
        }
      />

      {/* 4. Backup & Pemulihan */}
      <PolicySection
        icon={RefreshCw}
        title="4. Backup &amp; Pemulihan"
        delay={0.2}
        content={
          <>
            <p>
              Kami melakukan pencadangan data secara otomatis setiap hari. Backup disimpan selama 30
              hari. Dalam kasus kehilangan data atau insiden yang memerlukan pemulihan:
            </p>
            <BulletList
              items={[
                <span>Proses pemulihan dapat diminta kepada administrator.</span>,
                <span>
                  Pemulihan hanya dapat dilakukan dalam periode retensi backup, yaitu 30 hari sejak
                  backup dibuat.
                </span>,
                <span>
                  Data yang sudah melewati periode retensi tidak dapat dipulihkan.
                </span>,
              ]}
            />
          </>
        }
      />

      {/* 5. Hak Pengguna */}
      <PolicySection
        icon={UserCheck}
        title="5. Hak Pengguna"
        delay={0.25}
        content={
          <>
            <p>Anda memiliki hak penuh atas data pribadi Anda, termasuk:</p>
            <BulletList
              items={[
                <span>
                  <strong>(a) Akses:</strong> Mengakses dan melihat seluruh data pribadi Anda yang
                  tersimpan dalam sistem.
                </span>,
                <span>
                  <strong>(b) Koreksi:</strong> Mengajukan perbaikan atas data yang tidak akurat
                  atau tidak lengkap.
                </span>,
                <span>
                  <strong>(c) Penghapusan:</strong> Mengajukan penghapusan data pribadi Anda dari
                  sistem.
                </span>,
                <span>
                  <strong>(d) Penarikan Persetujuan:</strong> Menarik persetujuan pengumpulan data
                  kapan saja dengan menghubungi administrator.
                </span>,
              ]}
            />
            <p className="mt-3">
              Untuk menggunakan hak-hak tersebut, silakan hubungi administrator puskesmas Anda atau
              kirim email ke alamat yang tercantum di bagian Kontak di bawah.
            </p>
          </>
        }
      />

      {/* 6. Kebijakan Retensi */}
      <PolicySection
        icon={Clock}
        title="6. Kebijakan Retensi"
        delay={0.3}
        content={
          <>
            <p>Data disimpan dalam periode sebagai berikut:</p>
            <BulletList
              items={[
                <span>
                  <strong>Hasil Skrining:</strong> Disimpan tanpa batas waktu untuk keperluan
                  penelitian dan peningkatan kualitas layanan.
                </span>,
                <span>
                  <strong>Akun Pengguna Aktif:</strong> Diretain selama pengguna masih aktif
                  menggunakan sistem.
                </span>,
                <span>
                  <strong>Akun Tidak Aktif:</strong> Akun yang tidak digunakan selama 2 tahun atau
                  lebih dapat diarsipkan. Data yang diarsipkan tidak dihapus tetapi diakses dengan
                  hak terbatas.
                </span>,
              ]}
            />
          </>
        }
      />

      {/* 7. Pelaporan & Audit */}
      <PolicySection
        icon={ClipboardList}
        title="7. Pelaporan &amp; Audit"
        delay={0.35}
        content={
          <>
            <p>
              Semua tindakan dalam sistem dicatat dalam log aktivitas yang mencakup informasi tentang
              siapa yang melakukan tindakan dan kapan tindakan tersebut dilakukan. Log ini berguna
              untuk:
            </p>
            <BulletList
              items={[
                <span>
                  Keamanan: mendeteksi akses tidak sah atau aktivitas mencurigakan.
                </span>,
                <span>
                  Audit: memastikan kepatuhan terhadap regulasi perlindungan data.
                </span>,
                <span>
                  Analisis: memahami pola penggunaan sistem untuk peningkatan layanan.
                </span>,
              ]}
            />
            <p className="mt-3">
              Log aktivitas disimpan selama 12 bulan untuk keperluan keamanan dan audit.
            </p>
          </>
        }
      />

      {/* 8. Kontak */}
      <PolicySection
        icon={Mail}
        title="8. Kontak"
        delay={0.4}
        content={
          <>
            <p>
              Jika Anda memiliki pertanyaan, kekhawatiran, atau permintaan terkait privasi dan
              keamanan data Anda, silakan hubungi kami melalui:
            </p>
            <BulletList
              items={[
                <span>
                  <strong>Administrator Puskesmas:</strong> Hubungi langsung administrator di
                  puskesmas Anda.
                </span>,
                <span>
                  <strong>Email:</strong> hubungi administrator — untuk detail kontak, silakan
                  kunjungi{' '}
                  <Link
                    to="/kontak"
                    className="inline-flex items-center gap-0.5 font-semibold text-health-600 transition hover:text-health-700 hover:underline focus-ring"
                  >
                    halaman Kontak
                  </Link>
                  .
                </span>,
              ]}
            />
            <p className="mt-3 text-xs">
              Kami akan merespons permintaan privasi dalam waktu 14 hari kerja sejak permintaan
              diterima.
            </p>
          </>
        }
      />

      {/* Footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.45 }}
        className="text-center"
      >
        <p className="text-xs text-theme-muted/60">
          Kebijakan privasi ini merupakan bagian dari komitmen SiAP-PKM dalam melindungi data
          pribadi pengguna. Seluruh ketentuan dapat berubah sewaktu-waktu dengan pemberitahuan
          terlebih dahulu.
        </p>
      </motion.div>
    </div>
  )
}
