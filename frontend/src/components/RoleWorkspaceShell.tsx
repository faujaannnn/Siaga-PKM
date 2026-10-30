import { ArrowLeft, Home, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

export type WorkspaceTab<T extends string = string> = {
  id: T
  label: string
  shortLabel?: string
  icon: React.ReactNode
}

type RoleWorkspaceShellProps<T extends string> = {
  mainId: string
  roleEyebrow: string
  title: string
  subtitle?: React.ReactNode
  username?: string
  displayName?: string
  tabs: WorkspaceTab<T>[]
  activeTab: T
  onTabChange: (id: T) => void
  onLogout: () => void
  maxWidth?: '2xl' | '4xl' | '5xl'
  homeHref?: string
  extraActions?: React.ReactNode
  children: React.ReactNode
}

const maxW: Record<string, string> = {
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
}

export function tabBtn(active: boolean) {
  return `flex w-full min-h-[3rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition duration-200 focus-ring ${
    active ? 'bg-merah/15 text-theme ring-1 ring-merah/25' : 'text-theme-muted hover:text-theme'
  }`
}

export function panelCard(extra = '') {
  return `glass-panel border border-[var(--panel-border)] p-5 md:p-6 ${extra}`.trim()
}

export const fieldClass =
  'w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm text-theme transition duration-200 focus-ring'

export const btnPrimary =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-merah/15 transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-ring'

export const btnSecondary =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-2.5 text-sm font-medium text-theme-muted transition duration-200 hover:text-theme focus-ring'

export const btnGhost =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring'

export function RoleWorkspaceShell<T extends string>({
  mainId,
  roleEyebrow,
  title,
  subtitle,
  username,
  displayName,
  tabs,
  activeTab,
  onTabChange,
  onLogout,
  maxWidth = '5xl',
  homeHref = '/',
  extraActions,
  children,
}: RoleWorkspaceShellProps<T>) {
  const gridCols =
    tabs.length <= 2 ? 'md:grid-cols-2' : tabs.length === 3 ? 'md:grid-cols-3' : tabs.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-5'

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <a className="skip-to-content" href={`#${mainId}`}>
        Lewati ke isi
      </a>
      <main className={`mx-auto flex ${maxW[maxWidth]} flex-col gap-8 outline-none`} id={mainId} tabIndex={-1}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: easeOutExpo }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            to={homeHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Beranda
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {extraActions}
            <Link to="/" className={btnGhost}>
              <Home className="h-4 w-4" aria-hidden />
              Situs
            </Link>
            <button type="button" onClick={onLogout} className={`${btnGhost} border-rose-200 text-rose-800 hover:bg-rose-50`}>
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.04 }}
          className={panelCard()}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-health-600">{roleEyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold text-theme md:text-3xl">{title}</h1>
          {subtitle ? <div className="mt-2 text-sm text-theme-muted">{subtitle}</div> : null}
          {(displayName || username) && (
            <p className="mt-2 text-sm text-theme-muted">
              {displayName?.trim() ? (
                <>
                  Halo, <span className="font-medium text-theme">{displayName.trim()}</span>
                </>
              ) : null}
              {username ? (
                <>
                  {displayName?.trim() ? ' · ' : ''}
                  Akun: <span className="font-medium text-theme">{username}</span>
                </>
              ) : null}
            </p>
          )}
        </motion.div>

        <div className="space-y-2">
          <div className="md:hidden">
            <label htmlFor={`${mainId}-tab`} className="mb-1 block text-xs font-medium text-theme-muted">
              Bagian panel
            </label>
            <select
              id={`${mainId}-tab`}
              className={`${fieldClass} font-medium`}
              value={activeTab}
              onChange={(e) => onTabChange(e.target.value as T)}
            >
              {tabs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className={`hidden gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 md:grid ${gridCols}`}>
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => onTabChange(t.id)} className={tabBtn(activeTab === t.id)}>
                <span className="shrink-0">{t.icon}</span>
                <span className="text-center leading-tight">{t.shortLabel ?? t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOutExpo, delay: 0.06 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
