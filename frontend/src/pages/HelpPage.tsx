import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  ChevronDown,
  ExternalLink,
  Mail,
  BookOpen,
  Shield,
  FileText,
} from 'lucide-react'

import { useTheme } from '../context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

const faqData = [
  {
    question: 'Apa itu SiAP-PKM?',
    answer:
      'SiAP-PKM (Sistem Kesiapsiagaan Puskesmas) adalah platform digital untuk meningkatkan kesiapsiagaan bencana gempa bumi di lingkungan puskesmas. Melalui sistem ini, petugas dapat mengikuti skrining, pelatihan, dan edukasi kesiapsiagaan.',
    icon: BookOpen,
  },
  {
    question: 'Bagaimana cara mengikuti skrining?',
    answer:
      'Masuk ke menu Ruangan Petugas, pilih \'Kuis Kesiapsiagaan\', lalu jawab seluruh pertanyaan pada setiap bagian. Hasil akan langsung terlihat setelah Anda menyelesaikan seluruh pertanyaan.',
    icon: FileText,
  },
  {
    question: 'Apakah data saya aman?',
    answer:
      'Ya. Data Anda disimpan dengan enkripsi dan hanya dapat diakses oleh administrator yang berwenang. Kami tidak membagikan data pribadi Anda kepada pihak ketiga. Selengkapnya dapat dibaca di halaman Kebijakan Privasi.',
    icon: Shield,
  },
  {
    question: 'Berapa kali saya bisa mengikuti skrining?',
    answer:
      'Pre-test dapat diikuti sekali. Setelah menyelesaikan seluruh materi pelatihan, Anda dapat mengikuti post-test sekali. Kedua hasil dapat dibandingkan untuk melihat peningkatan.',
    icon: FileText,
  },
  {
    question: 'Bagaimana jika saya lupa kata sandi?',
    answer:
      'Hubungi administrator puskesmas Anda untuk mengatur ulang kata sandi. Nomor kontak tersedia di halaman Kontak.',
    icon: Mail,
  },
  {
    question: 'Apa yang dimaksud dengan Indeks Kesiapsiagaan?',
    answer:
      'Indeks Kesiapsiagaan adalah skor 0-100 yang mengukur tingkat kesiapsiagaan gempa bumi Anda. Terdiri dari tiga dimensi: Pengetahuan, Sikap, dan Tindakan. Skor ≥80 termasuk Tinggi, 60-79 Menengah, dan <60 Rendah.',
    icon: Shield,
  },
  {
    question: 'Bagaimana cara mengekspor hasil skrining?',
    answer:
      'Administrator dapat mengunduh hasil skrining dalam format PDF dan Excel melalui menu Skrining Kesiapsiagaan di dashboard admin.',
    icon: FileText,
  },
  {
    question: 'Apakah saya bisa menghapus data saya?',
    answer:
      'Anda dapat mengajukan penghapusan data pribadi dengan menghubungi administrator. Permintaan akan diproses sesuai kebijakan privasi yang berlaku.',
    icon: Shield,
  },
]

function FaqItem({
  question,
  answer,
  icon: Icon,
  isOpen,
  onToggle,
}: {
  question: string
  answer: string
  icon: React.ComponentType<{ className?: string }>
  isOpen: boolean
  onToggle: () => void
}) {
  const { theme } = useTheme()
  const day = theme === 'day'

  return (
    <div
      className={`rounded-xl border transition-colors duration-200 ${
        isOpen
          ? day
            ? 'border-health-200/60 bg-health-50/50 shadow-sm'
            : 'border-cyan-500/25 bg-white/5 shadow-sm'
          : day
            ? 'border-slate-200/70 bg-white/40'
            : 'border-white/10 bg-white/5'
      }`}
    >
      <button
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-200 ${
              day
                ? 'bg-health-100 text-health-700'
                : 'bg-cyan-900/50 text-cyan-300'
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <span
            className={`text-sm font-semibold leading-snug ${day ? 'text-slate-800' : 'text-slate-100'}`}
          >
            {question}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          } ${day ? 'text-slate-400' : 'text-slate-400'}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: easeOutExpo }}
            className="overflow-hidden"
          >
            <div
              className={`border-t px-5 pb-4 pt-3 text-sm leading-relaxed ${
                day
                  ? 'border-slate-200 text-slate-600'
                  : 'border-white/10 text-slate-300'
              }`}
            >
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  function toggle(i: number) {
    setOpenIndex((prev) => (prev === i ? null : i))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
            <HelpCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-theme">Bantuan & Panduan</h1>
            <p className="mt-1.5 text-sm text-theme-muted">
              Pertanyaan yang sering ditanyakan tentang SiAP-PKM
            </p>
          </div>
        </div>
      </motion.div>

      {/* FAQ list */}
      <div className="space-y-3">
        {faqData.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: easeOutExpo, delay: i * 0.04 }}
          >
            <FaqItem
              question={item.question}
              answer={item.answer}
              icon={item.icon}
              isOpen={openIndex === i}
              onToggle={() => toggle(i)}
            />
          </motion.div>
        ))}
      </div>

      {/* Contact support */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOutExpo, delay: faqData.length * 0.04 }}
        className="glass-panel border border-[var(--panel-border)] p-6 text-center"
      >
        <p className="text-sm text-theme-muted">
          Butuh bantuan lain?{' '}
          <Link
            to="/kontak"
            className="inline-flex items-center gap-1 font-semibold text-health-600 transition hover:text-health-700 hover:underline focus-ring"
          >
            Hubungi kami di halaman Kontak
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
