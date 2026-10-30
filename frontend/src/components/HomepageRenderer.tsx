import {
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  Maximize2,
  X,
} from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useTheme } from '../context/ThemeContext'
import { easeOutExpo, imageMediaUrl, staggerLight } from '@dr-diah/siaga-frontend-core'
import type { HomepageSection } from '../types'

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: staggerLight,
  },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: easeOutExpo },
  },
}

type HeroImageItem = { url: string; caption?: string }

function carouselControlClassName(extra = '') {
  return `flex cursor-pointer items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-black/65 focus-ring ${extra}`
}

function HeroCarousel({ urls }: { urls: HeroImageItem[] }) {
  const [current, setCurrent] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reduceMotion = useReducedMotion()

  const stopAutoplay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  const goTo = useCallback(
    (index: number) => {
      stopAutoplay()
      setCurrent((index + urls.length) % urls.length)
    },
    [stopAutoplay, urls.length],
  )

  const prev = useCallback(() => goTo(current - 1), [current, goTo])
  const next = useCallback(() => goTo(current + 1), [current, goTo])

  useEffect(() => {
    if (urls.length <= 1 || fullscreen) return
    intervalRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % urls.length)
    }, 4500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [urls.length, fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    stopAutoplay()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false)
      if (e.key === 'ArrowLeft') goTo(current - 1)
      if (e.key === 'ArrowRight') goTo(current + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [fullscreen, current, goTo, stopAutoplay])

  if (!urls.length) return null

  const active = urls[current]
  const slideTransition = reduceMotion ? '' : 'transition-opacity duration-500'

  const fullscreenOverlay = fullscreen
    ? createPortal(
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto layar penuh"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
            <p className="truncate text-sm font-medium text-white/90">
              {active.caption || `Foto ${current + 1}`}
              {urls.length > 1 ? (
                <span className="ml-2 text-white/55">
                  {current + 1} / {urls.length}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label="Tutup layar penuh"
              className={carouselControlClassName('h-10 w-10 shrink-0')}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-4 sm:px-10">
            <img
              src={imageMediaUrl(active.url)}
              alt={active.caption || `Foto ${current + 1}`}
              className="max-h-[calc(100dvh-7rem)] max-w-full object-contain"
            />
            {urls.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={prev}
                  aria-label="Foto sebelumnya"
                  className={carouselControlClassName('absolute left-3 top-1/2 h-11 w-11 -translate-y-1/2 sm:left-6')}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={next}
                  aria-label="Foto berikutnya"
                  className={carouselControlClassName('absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2 sm:right-6')}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </>
            ) : null}
          </div>

          {urls.length > 1 ? (
            <div className="flex shrink-0 justify-center gap-2 border-t border-white/10 px-4 py-4">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Ke foto ${i + 1}`}
                  aria-current={i === current ? 'true' : undefined}
                  className={`h-2 cursor-pointer rounded-full transition-all duration-200 ${
                    i === current ? 'w-7 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <div className="relative w-full" aria-label="Galeri foto">
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-gradient-to-b from-slate-50/90 to-white shadow-md ring-1 ring-health-500/10 dark:from-cosmic-900/70 dark:to-cosmic-800/50 dark:ring-cyan-500/15 sm:h-96 md:h-[26rem] lg:h-[30rem]">
          {urls.map((img, i) => (
            <div
              key={i}
              className={`absolute inset-0 ${slideTransition}`}
              style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
            >
              <img
                src={imageMediaUrl(img.url)}
                alt={img.caption || `Foto ${i + 1}`}
                className="h-full w-full object-contain p-1 sm:p-2"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              {img.caption ? (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-4 pb-3 pt-10">
                  <p className="text-sm font-medium text-white">{img.caption}</p>
                </div>
              ) : null}
            </div>
          ))}

          <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
            {urls.length > 1 ? (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
                {current + 1}/{urls.length}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label="Lihat layar penuh"
              className={carouselControlClassName('h-9 w-9 gap-1.5 px-3 sm:h-10 sm:w-auto sm:min-w-[2.5rem]')}
            >
              <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden text-xs font-semibold sm:inline">Layar penuh</span>
            </button>
          </div>
        </div>

        {urls.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Foto sebelumnya"
              className={carouselControlClassName('absolute left-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2')}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Foto berikutnya"
              className={carouselControlClassName('absolute right-3 top-1/2 z-10 h-10 w-10 -translate-y-1/2')}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              {urls.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Ke foto ${i + 1}`}
                  aria-current={i === current ? 'true' : undefined}
                  className={`h-2 cursor-pointer rounded-full transition-all duration-200 ${
                    i === current ? 'w-7 bg-white shadow-sm' : 'w-2 bg-white/55 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {fullscreenOverlay}
    </>
  )
}

export function HomepageRenderer({ sections }: { sections: HomepageSection[] }) {
  const { theme } = useTheme()
  const isDay = theme === 'day'
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="space-y-10 md:space-y-12"
      variants={stagger}
      initial={reduceMotion ? 'show' : 'hidden'}
      animate="show"
    >
      {sections.map((section) => {
        if (section.type === 'hero') {
          const heroImages = (section as { heroImages?: HeroImageItem[] }).heroImages
          const rawImages = (section as { images?: string[] }).images
          const urls: HeroImageItem[] =
            heroImages?.length
              ? [...heroImages]
              : rawImages?.length
                ? rawImages.map((url) => ({ url }))
                : []

          return (
            <motion.section
              key={section.id}
              variants={fadeUp}
              aria-labelledby={`hero-title-${section.id}`}
              className="home-hero-shell relative overflow-hidden rounded-3xl border border-[var(--panel-border)] shadow-[0_24px_80px_-20px_rgba(8,145,178,0.2)] dark:shadow-[0_28px_90px_-24px_rgba(0,0,0,0.55)]"
            >
              <div
                className="absolute inset-0 z-[1] bg-gradient-to-br from-white/95 via-cyan-50/58 to-amber-50/38 dark:from-cosmic-950/90 dark:via-merah/16 dark:to-cosmic-900/86"
                aria-hidden
              />
              <div className="absolute inset-0 z-[2] border border-white/30 ring-1 ring-amber-500/10 dark:border-white/6 dark:ring-amber-500/8" />

              <div className="relative z-10 px-5 py-9 sm:px-8 sm:py-11 md:px-11 md:py-14">
                <div className="min-w-0 space-y-6">
                  {section.badge ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-white/92 px-3.5 py-1.5 text-xs font-semibold text-amber-950 shadow-sm dark:border-amber-400/25 dark:bg-cosmic-800/78 dark:text-amber-100/95">
                      <CloudLightning className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
                      {section.badge}
                    </div>
                  ) : null}
                  <h1
                    id={`hero-title-${section.id}`}
                    className="font-[family-name:var(--font-heading)] text-[1.75rem] font-bold leading-[1.12] tracking-tight sm:text-4xl md:text-[2.65rem] md:leading-[1.08]"
                  >
                    <span
                      className={
                        isDay
                          ? 'bg-gradient-to-r from-health-800 via-health-600 to-cta-700 bg-clip-text text-transparent dark:from-white dark:via-cyan-100 dark:to-emerald-100'
                          : 'bg-gradient-to-r from-white via-cyan-100 to-emerald-100/95 bg-clip-text text-transparent'
                      }
                    >
                      {section.title}
                    </span>
                  </h1>
                  {section.subtitle ? (
                    <p className="max-w-2xl text-base leading-relaxed text-theme-muted sm:text-lg">{section.subtitle}</p>
                  ) : null}
                  {section.highlight ? (
                    <blockquote className="max-w-2xl border-l-4 border-health-600 py-1 pl-5 text-sm italic leading-relaxed text-theme-muted dark:border-cyan-500/75 sm:text-base">
                      {section.highlight}
                    </blockquote>
                  ) : null}

                  {urls.length > 0 && <HeroCarousel urls={urls} />}
                </div>
              </div>
            </motion.section>
          )
        }
        if (section.type === 'text') {
          return (
            <motion.section
              key={section.id}
              variants={fadeUp}
              className="rounded-3xl border border-[var(--panel-border)] bg-white/75 p-6 shadow-sm dark:bg-cosmic-800/45 md:p-9"
            >
              {section.title ? (
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-tight text-theme md:text-2xl">
                  {section.title}
                </h2>
              ) : null}
              {section.body ? (
                <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-[1.7] text-theme-muted">
                  {section.body}
                </p>
              ) : null}
            </motion.section>
          )
        }
        if (section.type === 'cards') {
          return (
            <motion.section key={section.id} variants={fadeUp} className="space-y-6">
              {section.title ? (
                <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-tight text-theme md:text-2xl">
                  {section.title}
                </h2>
              ) : null}
              <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5">
                {(section.items ?? []).map((c, i) => {
                  const inner = (
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-theme sm:text-base">{c.title}</h3>
                      {c.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-theme-muted sm:text-sm">{c.description}</p>
                      ) : null}
                    </div>
                  )
                  const className =
                    'card-lift group flex min-h-[4.5rem] cursor-pointer items-center gap-4 rounded-2xl border border-[var(--panel-border)] bg-white/82 p-5 shadow-sm focus-ring dark:bg-cosmic-800/55'
                  if (c.href?.startsWith('http')) {
                    return (
                      <li key={`${section.id}-${i}`}>
                        <a href={c.href} target="_blank" rel="noreferrer" className={className}>
                          {inner}
                        </a>
                      </li>
                    )
                  }
                  if (c.href) {
                    return (
                      <li key={`${section.id}-${i}`}>
                        <Link to={c.href} className={className}>
                          {inner}
                        </Link>
                      </li>
                    )
                  }
                  return (
                    <li key={`${section.id}-${i}`}>
                      <div className="glass-panel group flex min-h-[4.5rem] items-center gap-4 p-5">{inner}</div>
                    </li>
                  )
                })}
              </ul>
            </motion.section>
          )
        }
        return null
      })}
    </motion.div>
  )
}
