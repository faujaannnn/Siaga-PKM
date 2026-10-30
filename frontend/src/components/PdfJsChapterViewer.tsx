import '../polyfills/promise-with-resolvers'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

import { TOKEN_KEY } from '../api/client'

/** Dari `public/pdfjs/` (salin saat predev/prebuild); .js supaya MIME application/javascript di Nginx. */
pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdfjs/pdf.worker.js`

type Props = {
  pdfId: string
  pageStart: number
  pageEnd: number
  /** Tautan Drive bila unduhan/render gagal */
  fallbackDriveUrl?: string
  className?: string
}

export function PdfJsChapterViewer({ pdfId, pageStart, pageEnd, fallbackDriveUrl, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const [loadingDoc, setLoadingDoc] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [current, setCurrent] = useState(() => Math.max(1, Math.floor(pageStart)))

  const start = Math.max(1, Math.floor(pageStart))
  const end = Math.max(start, Math.floor(pageEnd))
  const chapterLen = end - start + 1

  useEffect(() => {
    setCurrent(start)
    setErr(null)
  }, [start, end, pdfId])

  useEffect(() => {
    let cancelled = false
    pdfRef.current = null

    const run = async () => {
      setLoadingDoc(true)
      setErr(null)
      try {
        const t = localStorage.getItem(TOKEN_KEY)
        const res = await fetch(`/api/public/ml-pdfs/${encodeURIComponent(pdfId)}/raw.pdf`, {
          headers: t ? { Authorization: `Bearer ${t}` } : {},
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          let msg = res.statusText || `HTTP ${res.status}`
          try {
            const j = JSON.parse(text) as { detail?: unknown }
            const d = j?.detail
            if (typeof d === 'string' && d.trim()) msg = d.trim()
          } catch {
            if (text && text.length < 400) msg = text
          }
          throw new Error(msg)
        }
        const buf = await res.arrayBuffer()
        if (cancelled) return
        const pdf = await pdfjs.getDocument({ data: buf }).promise
        if (cancelled) {
          await pdf.destroy().catch(() => {})
          return
        }
        pdfRef.current = pdf
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Buku tidak bisa dimuat saat ini. Coba lagi.')
        }
      } finally {
        if (!cancelled) setLoadingDoc(false)
      }
    }

    void run()
    return () => {
      cancelled = true
      const p = pdfRef.current
      pdfRef.current = null
      if (p) void p.destroy().catch(() => {})
    }
  }, [pdfId])

  const renderPage = useCallback(async (pageNum: number) => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return
    if (pageNum < 1 || pageNum > pdf.numPages) return

    setLoadingPage(true)
    try {
      const page = await pdf.getPage(pageNum)
      const baseScale = 1.22
      const viewport = page.getViewport({ scale: baseScale })
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const canvasCtx = canvas.getContext('2d')
      if (!canvasCtx) return

      canvas.width = Math.floor(viewport.width * dpr)
      canvas.height = Math.floor(viewport.height * dpr)
      canvas.style.width = `${Math.floor(viewport.width)}px`
      canvas.style.height = `${Math.floor(viewport.height)}px`

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
      await page
        .render({
          canvasContext: canvasCtx,
          viewport,
          transform,
        })
        .promise
    } finally {
      setLoadingPage(false)
    }
  }, [])

  useEffect(() => {
    if (loadingDoc || err) return
    const pdf = pdfRef.current
    if (!pdf) return
    if (current < start || current > end) return
    if (current > pdf.numPages) {
      setErr(`Bab meminta halaman ${current}, tetapi buku hanya punya ${pdf.numPages} halaman.`)
      return
    }
    void renderPage(current)
  }, [loadingDoc, err, current, start, end, renderPage])

  const rel = current - start + 1

  const navBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme transition hover:bg-white/5 focus-ring disabled:pointer-events-none disabled:opacity-35'

  if (loadingDoc) {
    return (
      <div
        className={`flex min-h-[min(58vh,440px)] items-center justify-center rounded-xl border border-[var(--panel-border)] bg-black/8 ${className ?? ''}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-merah-bright opacity-70" aria-hidden />
        <span className="sr-only">Memuat buku…</span>
      </div>
    )
  }

  if (err) {
    return (
      <div
        className={`space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-theme ${className ?? ''}`}
      >
        <p>{err}</p>
        {fallbackDriveUrl ? (
          <a
            href={fallbackDriveUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex font-medium text-merah-bright hover:underline focus-ring rounded-lg"
          >
            Buka dokumen di Google Drive
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-sm">
        <p className="text-theme-muted">
          Dalam bab: halaman <strong className="text-theme">{rel}</strong> dari{' '}
          <strong className="text-theme">{chapterLen}</strong>
          <span className="text-theme-muted"> · Buku penuh hal. {current}</span>
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={navBtn}
            aria-label="Halaman sebelumnya"
            disabled={current <= start || loadingPage}
            onClick={() => setCurrent((p) => Math.max(start, p - 1))}
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            className={navBtn}
            aria-label="Halaman berikutnya"
            disabled={current >= end || loadingPage}
            onClick={() => setCurrent((p) => Math.min(end, p + 1))}
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative max-h-[min(82vh,880px)] overflow-auto rounded-xl border border-[var(--panel-border)] bg-white/90 p-2 dark:bg-black/30">
        {loadingPage ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/15 dark:bg-black/25"
            aria-hidden
          >
            <Loader2 className="h-7 w-7 animate-spin text-merah-bright opacity-80" />
          </div>
        ) : null}
        <canvas ref={canvasRef} className="mx-auto block shadow-sm" />
      </div>
    </div>
  )
}
