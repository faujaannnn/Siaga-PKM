import { MotionConfig } from 'framer-motion'
import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'

import { PublicLayout } from './components/PublicLayout'
import { ToastProvider } from './components/ToastProvider'
import { useAuth } from './context/AuthContext'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import { AdminPage } from './pages/AdminPage'
import { DeveloperPage } from './pages/DeveloperPage'
import { KapusPage } from './pages/KapusPage'
import { MonitorPage } from './pages/MonitorPage'
import { MlVideoListPage } from './pages/MlVideoListPage'
import { MlVideoLearningPage } from './pages/MlVideoLearningPage'
import { MasyarakatEvacuationSimPage } from './pages/MasyarakatEvacuationSimPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { LipiQuizPage } from './pages/LipiQuizPage'
import { TriageGamePage } from './pages/TriageGamePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PelatihanPage } from './pages/PelatihanPage'
import { ContactPage } from './pages/ContactPage'
import { ProfileIndexPage } from './pages/ProfileIndexPage'
import { ReportDisasterPage } from './pages/ReportDisasterPage'
import { SitePageView } from './pages/SitePageView'
import { ProfileSetupPage } from './pages/ProfileSetupPage'
import { SkriningKesiapPage } from './pages/SkriningKesiapPage'
import { StaffPage } from './pages/StaffPage'
import { HelpPage } from './pages/HelpPage'
import { PrivacyPage } from './pages/PrivacyPage'

/** Hanya admin & petugas (peran staff) - materi & video ML. */
function RequireStaff({ children }: { children: ReactElement }) {
  const { ready, token, me } = useAuth()
  const location = useLocation()
  if (!ready) return null
  if (!token || !me) return <Navigate to="/login" replace />
  if (me.role === 'developer') return <Navigate to="/developer" replace />
  if (me.role === 'kepala_puskesmas') return <Navigate to="/kapus" replace />
  if (me.role !== 'staff' && me.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  const onProfileSetup = location.pathname === '/petugas/atur-profil'
  if (me.role === 'staff' && me.needs_profile_setup && !onProfileSetup) {
    return <Navigate to="/petugas/atur-profil" replace />
  }
  return children
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { ready, token, me } = useAuth()
  if (!ready) return null
  if (!token || !me) return <Navigate to="/login" replace />
  if (me.role !== 'admin') {
    if (me.role === 'kepala_puskesmas') return <Navigate to="/kapus" replace />
    if (me.role === 'developer') return <Navigate to="/developer" replace />
    return <Navigate to="/petugas" replace />
  }
  return children
}

function RequireKapus({ children }: { children: ReactElement }) {
  const { ready, token, me } = useAuth()
  if (!ready) return null
  if (!token || !me) return <Navigate to="/login" replace />
  if (me.role === 'admin') return <Navigate to="/monitor" replace />
  if (me.role !== 'kepala_puskesmas') return <Navigate to="/login" replace />
  return children
}

function LegacyEdukasiVideoRedirect() {
  const { videoId } = useParams()
  return <Navigate to={`/petugas/video-ml/${encodeURIComponent(videoId ?? '')}`} replace />
}

/** URL lama /masyarakat/… dialihkan ke /petugas/… */
function LegacyRuangPathRedirect() {
  const { '*': splat } = useParams()
  return <Navigate to={splat ? `/petugas/${splat}` : '/petugas'} replace />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MotionConfig reducedMotion="user" transition={{ duration: 0.35, ease: easeOutExpo }}>
            <BrowserRouter>
              <Routes>
                <Route path="/bantuan" element={<HelpPage />} />
                <Route path="/privasi" element={<PrivacyPage />} />
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route
                    path="/petugas/video-ml"
                    element={
                      <RequireStaff>
                        <MlVideoListPage />
                      </RequireStaff>
                    }
                  />
                  <Route
                    path="/petugas/pdf-ml"
                    element={<Navigate to="/petugas" replace />}
                  />
                  <Route
                    path="/petugas/pdf-ml/:pdfId"
                    element={<Navigate to="/petugas" replace />}
                  />
                  <Route
                    path="/petugas/video-ml/:videoId"
                    element={
                      <RequireStaff>
                        <MlVideoLearningPage />
                      </RequireStaff>
                    }
                  />
                  <Route path="/profil" element={<ProfileIndexPage />} />
                  <Route path="/kontak" element={<ContactPage />} />
                  <Route path="/pelatihan" element={<PelatihanPage />} />
                  <Route path="/halaman/:slug" element={<SitePageView />} />
                  <Route path="/lapor-bencana" element={<ReportDisasterPage />} />
                  <Route path="/saran-aduan" element={<FeedbackPage />} />
                  <Route
                    path="/petugas/latihan-triase"
                    element={
                      <RequireStaff>
                        <TriageGamePage />
                      </RequireStaff>
                    }
                  />
                  <Route
                    path="/petugas/kuis-lipi"
                    element={
                      <RequireStaff>
                        <LipiQuizPage />
                      </RequireStaff>
                    }
                  />
                  <Route
                    path="/petugas/simulasi-evakuasi"
                    element={
                      <RequireStaff>
                        <MasyarakatEvacuationSimPage />
                      </RequireStaff>
                    }
                  />
                  <Route path="/jalur-evakuasi" element={<Navigate to="/petugas/simulasi-evakuasi" replace />} />
                  <Route path="/simulasi-evakuasi" element={<Navigate to="/petugas/simulasi-evakuasi" replace />} />
                </Route>
                <Route path="/edukasi" element={<Navigate to="/petugas" replace />} />
                <Route path="/edukasi/video-ml" element={<Navigate to="/petugas/video-ml" replace />} />
                <Route path="/edukasi/video-ml/:videoId" element={<LegacyEdukasiVideoRedirect />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/masyarakat/*" element={<LegacyRuangPathRedirect />} />
                <Route
                  path="/petugas/atur-profil"
                  element={
                    <RequireStaff>
                      <ProfileSetupPage />
                    </RequireStaff>
                  }
                />
                <Route
                  path="/petugas"
                  element={
                    <RequireStaff>
                      <StaffPage />
                    </RequireStaff>
                  }
                />
                <Route
                  path="/kapus"
                  element={
                    <RequireKapus>
                      <KapusPage />
                    </RequireKapus>
                  }
                />
                <Route path="/developer" element={<DeveloperPage />} />
                <Route
                  path="/monitor"
                  element={
                    <RequireAdmin>
                      <MonitorPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/skrining-kesiapsiagaan"
                  element={
                    <RequireAdmin>
                      <SkriningKesiapPage />
                    </RequireAdmin>
                  }
                />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </MotionConfig>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
