import {
  AlertTriangle,
  BookOpen,
  Building2,
  Home,
  LogIn,
  MessageSquare,
  Phone,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'

export function MobileNavDrawer() {
  const ref = useRef<HTMLDialogElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const titleId = useId()

  const open = () => {
    ref.current?.showModal()
    setMenuOpen(true)
  }
  const close = () => {
    ref.current?.close()
    setMenuOpen(false)
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onDialogClose = () => setMenuOpen(false)
    el.addEventListener('close', onDialogClose)
    return () => el.removeEventListener('close', onDialogClose)
  }, [])

  const navItem = (to: string, label: string, Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>, end?: boolean) => (
    <NavLink
      to={to}
      end={end}
      onClick={close}
      className={({ isActive }) =>
        `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition focus-ring ${
          isActive ? 'bg-health-500/15 text-health-800 dark:bg-cyan-500/15 dark:text-cyan-100' : 'text-theme-muted hover:bg-black/[0.05] hover:text-theme'
        }`
      }
    >
      <Icon className="h-4 w-4 opacity-80" aria-hidden />
      {label}
    </NavLink>
  )

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="nav-menu-trigger focus-ring flex h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme transition duration-200 hover:border-health-500/40 md:hidden"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        aria-controls="public-mobile-nav"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span className="sr-only">Buka menu navigasi</span>
      </button>

      <dialog
        id="public-mobile-nav"
        ref={ref}
        className="nav-mobile-dialog"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === ref.current) close()
        }}
      >
        <div className="nav-mobile-dialog-panel flex max-h-[min(100dvh,640px)] flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--header-bg)] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--header-border)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-merah to-red-900 text-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </span>
              <p id={titleId} className="truncate font-semibold text-theme">
                Menu
              </p>
            </div>
            <form method="dialog">
              <button
                type="submit"
                className="focus-ring min-h-11 min-w-11 rounded-lg px-3 text-sm font-medium text-theme-muted transition hover:text-theme"
              >
                Tutup
              </button>
            </form>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 space-y-1">
            {navItem('/', 'Beranda', Home, true)}
            {navItem('/profil', 'Profil', Building2)}
            {navItem('/kontak', 'Kontak', Phone)}
            {navItem('/pelatihan', 'Pelatihan', BookOpen)}
            {navItem('/lapor-bencana', 'Lapor', AlertTriangle)}
            {navItem('/saran-aduan', 'Saran', MessageSquare)}
          </nav>

          <div className="border-t border-[var(--header-border)] px-4 py-4">
            <Link
              to="/login"
              onClick={close}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-ring"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Login
            </Link>
          </div>
        </div>
      </dialog>
    </>
  )
}