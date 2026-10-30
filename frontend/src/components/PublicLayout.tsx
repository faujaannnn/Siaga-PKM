import {
  AlertTriangle,
  BookOpen,
  Building2,
  ChevronUp,
  Code2,
  Cross,
  HelpCircle,
  LogIn,
  MessageSquare,
  Phone,
  Shield,
  Stethoscope,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { MobileNavDrawer } from './MobileNavDrawer'
import { SiteStatsPartnersFooter } from './SiteStatsPartnersFooter'

function ScrollToTopFab() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 340)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fab-scroll-top ${visible ? 'visible' : ''}`}
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </button>
  )
}

export function PublicLayout() {
  const { token, me, logout } = useAuth()

  const navIdle = 'text-theme-muted hover:bg-black/[0.05] hover:text-theme'
  const navActive = 'bg-black/[0.07] text-theme ring-1 ring-merah/20'

  return (
    <div className="flex min-h-svh flex-col">
      <a className="skip-to-content" href="#main-content">
        Lewati ke isi
      </a>
      <header className="sticky top-0 z-50 pt-3 sm:pt-4">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 md:px-6">
          <div className="glass-nav">
            <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-3.5 md:py-4">
              <Link to="/" className="group flex min-w-0 max-w-[65%] cursor-pointer items-center gap-2 sm:max-w-none sm:gap-3 md:min-w-0">
                <div className="flex shrink-0 items-center">
                  <div className="relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-merah to-red-900 text-white shadow-lg shadow-merah/25 ring-2 ring-white/25 active:scale-[0.98] transition-transform duration-200">
                    <Cross className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} aria-hidden />
                  </div>
                </div>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate font-[family-name:var(--font-heading)] text-sm font-semibold tracking-wide text-theme">
                    SiAP-PKM
                  </span>
                  <span className="hidden text-xs text-theme-soft sm:flex sm:items-center sm:gap-1">
                    <Stethoscope
                      className="h-3.5 w-3.5 shrink-0 text-health-600"
                      aria-hidden
                    />
                    <span className="truncate">Kesiapsiagaan Puskesmas</span>
                  </span>
                </span>
              </Link>

              <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                {!token ? (
                  <Link
                    to="/login"
                    className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-3 text-sm font-semibold text-white shadow-md shadow-merah/20 transition duration-200 hover:brightness-105 focus-ring md:hidden"
                  >
                    <LogIn className="h-4 w-4" aria-hidden />
                    <span className="max-[380px]:sr-only">Login</span>
                  </Link>
                ) : null}
                <nav
                  className="hidden min-w-0 flex-wrap items-center justify-end gap-0.5 md:flex md:gap-1"
                  aria-label="Navigasi utama"
                >
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    Beranda
                  </NavLink>
                  <NavLink
                    to="/profil"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <Building2 className="h-4 w-4 opacity-80" aria-hidden />
                    Profil
                  </NavLink>
                  <NavLink
                    to="/kontak"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <Phone className="h-4 w-4 opacity-80" aria-hidden />
                    Kontak
                  </NavLink>
                  <NavLink
                    to="/pelatihan"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <BookOpen className="h-4 w-4 opacity-80" aria-hidden />
                    Pelatihan
                  </NavLink>
                  <NavLink
                    to="/lapor-bencana"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <AlertTriangle className="h-4 w-4 opacity-80" aria-hidden />
                    Lapor
                  </NavLink>
                  <NavLink
                    to="/saran-aduan"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <MessageSquare className="h-4 w-4 opacity-80" aria-hidden />
                    Saran
                  </NavLink>
                  <NavLink
                    to="/bantuan"
                    className={({ isActive }) =>
                      `cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 ${navIdle} ${isActive ? navActive : ''}`
                    }
                  >
                    <HelpCircle className="h-4 w-4 opacity-80" aria-hidden />
                    Bantuan
                  </NavLink>
                  {token ? (
                    <>
                      {me?.role === 'admin' ? (
                        <Link
                          to="/admin"
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 text-emerald-800 hover:bg-emerald-500/10"
                        >
                          <Shield className="h-4 w-4" aria-hidden />
                          Admin
                        </Link>
                      ) : null}
                      {me?.role === 'admin' || me?.role === 'staff' ? (
                        <Link
                          to="/petugas"
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring lg:px-3 text-theme-muted hover:bg-black/[0.05]"
                        >
                          {me?.role === 'admin' ? 'Materi petugas' : 'Ruang petugas'}
                        </Link>
                      ) : null}
                      {me?.role === 'kepala_puskesmas' ? (
                        <Link
                          to="/kapus"
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 text-blue-700 hover:bg-blue-500/10"
                        >
                          <Shield className="h-4 w-4" aria-hidden />
                          Dashboard Kapus
                        </Link>
                      ) : null}
                      {me?.role === 'admin' || me?.role === 'developer' ? (
                        <Link
                          to="/developer"
                          className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring inline-flex items-center gap-1.5 lg:px-3 text-health-700 hover:bg-health-500/10"
                        >
                          <Code2 className="h-4 w-4" aria-hidden />
                          <span className="hidden lg:inline">Developer</span>
                          <span className="lg:hidden">Dev</span>
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => logout()}
                        className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 focus-ring lg:px-3 text-merah hover:bg-merah/[0.08]"
                      >
                        Keluar
                      </button>
                    </>
                  ) : (
                    <Link
                      to="/login"
                      className="ml-0.5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gradient-to-r from-merah to-merah-bright px-3 py-2 text-sm font-semibold text-white shadow-md shadow-merah/20 transition duration-200 hover:brightness-105 focus-ring"
                    >
                      <LogIn className="h-4 w-4" aria-hidden />
                      Login
                    </Link>
                  )}
                </nav>
                <MobileNavDrawer />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="app-main public-page-rail mx-auto w-full max-w-6xl flex-1 scroll-mt-20 px-4 py-5 sm:px-5 sm:py-7 md:px-6 md:py-10"
        tabIndex={-1}
      >
        <Outlet />
      </main>

      <footer
        className="mt-auto border-t py-4 sm:px-4 md:py-5"
        style={{ borderColor: 'var(--header-border)' }}
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          {/* Legal & help links */}
          <div className="mb-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <Link to="/bantuan" className="hover:text-health-600 transition-colors focus-ring rounded">
              Bantuan &amp; Panduan
            </Link>
            <span aria-hidden>·</span>
            <Link to="/privasi" className="hover:text-health-600 transition-colors focus-ring rounded">
              Kebijakan Privasi
            </Link>
            <span aria-hidden>·</span>
            <Link to="/kontak" className="hover:text-health-600 transition-colors focus-ring rounded">
              Kontak
            </Link>
          </div>
          <SiteStatsPartnersFooter copyrightLine="SIAP-PKM 2026" />
        </div>
      </footer>

      <ScrollToTopFab />
    </div>
  )
}
