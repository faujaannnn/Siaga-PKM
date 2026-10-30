import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  X,
} from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  toast: (title: string, message?: string, type?: ToastType, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// Hook shares this module with the provider; fast-refresh still reloads the components.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  error: <XCircle className="h-5 w-5 text-rose-500" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
  info: <Info className="h-5 w-5 text-health-600" />,
}

const TOAST_BORDER: Record<ToastType, string> = {
  success: 'border-emerald-200 bg-emerald-50',
  error: 'border-rose-200 bg-rose-50',
  warning: 'border-amber-200 bg-amber-50',
  info: 'border-health-200 bg-health-50',
}

const TOAST_ACCENT: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-health-500',
}

const TOAST_TITLE: Record<ToastType, string> = {
  success: 'text-emerald-800',
  error: 'text-rose-800',
  warning: 'text-amber-800',
  info: 'text-health-800',
}

let counter = 0
function newId() {
  return `toast-${++counter}-${Date.now()}`
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`pointer-events-auto flex w-80 items-start gap-3 rounded-2xl border p-4 shadow-xl ${TOAST_BORDER[toast.type]}`}
      role="alert"
    >
      <div className={`mt-0.5 shrink-0 rounded-full p-1 ${TOAST_ACCENT[toast.type]}/10`}>
        {TOAST_ICONS[toast.type]}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${TOAST_TITLE[toast.type]}`}>{toast.title}</p>
        {toast.message ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{toast.message}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 focus-ring"
        aria-label="Tutup"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = newId()
      const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 4000)
      setToasts((prev) => [...prev, { ...toast, id }])
      timers.current[id] = setTimeout(() => removeToast(id), duration)
    },
    [removeToast],
  )

  const toast = useCallback(
    (title: string, message?: string, type: ToastType = 'info', duration?: number) => {
      addToast({ title, message, type, duration })
    },
    [addToast],
  )

  return (
    <ToastContext.Provider value={{ addToast, removeToast, toast }}>
      {children}
      {/* Toast container - fixed top-right */}
      <div
        aria-live="polite"
        aria-label="Notifikasi"
        className="pointer-events-none fixed right-4 top-20 z-[100] flex flex-col gap-2"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

// ─── Confirmation Dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  type?: 'danger' | 'warning' | 'info'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  type = 'info',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const btnColor = {
    danger: 'bg-rose-600 hover:bg-rose-700 focus-ring-rose',
    warning: 'bg-amber-600 hover:bg-amber-700 focus-ring-amber',
    info: 'bg-health-600 hover:bg-health-700 focus-ring-health',
  }[type]

  const iconColor = {
    danger: 'text-rose-500 bg-rose-100',
    warning: 'text-amber-500 bg-amber-100',
    info: 'text-health-600 bg-health-100',
  }[type]

  const Icon = {
    danger: XCircle,
    warning: AlertTriangle,
    info: Info,
  }[type]

  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 p-6">
          <div className={`shrink-0 rounded-full p-2.5 ${iconColor}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">{message}</div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 focus-ring"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${btnColor} focus-ring`}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Memproses…
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Inline Error Banner ───────────────────────────────────────────────────────

interface InlineErrorProps {
  message: string
  onDismiss?: () => void
}

export function InlineError({ message, onDismiss }: InlineErrorProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-rose-400 transition hover:text-rose-600 focus-ring"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

// ─── Inline Success Banner ─────────────────────────────────────────────────────

interface InlineSuccessProps {
  message: string
  onDismiss?: () => void
}

export function InlineSuccess({ message, onDismiss }: InlineSuccessProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      <span className="flex-1">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-emerald-400 transition hover:text-emerald-600 focus-ring"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
