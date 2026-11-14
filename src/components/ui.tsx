import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type IconName =
  | 'calendar'
  | 'users'
  | 'search'
  | 'plus'
  | 'logout'
  | 'chevron-left'
  | 'chevron-right'
  | 'clock'
  | 'wallet'
  | 'edit'
  | 'trash'
  | 'archive'
  | 'restore'
  | 'arrow-left'
  | 'attachment'
  | 'external'
  | 'video'
  | 'sparkles'
  | 'x'
  | 'check'
  | 'alert'
  | 'book'
  | 'document'
  | 'refresh'
  | 'user'
  | 'calendar-plus'
  | 'repeat'
  | 'note'
  | 'eye'
  | 'eye-off'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 20, className, strokeWidth = 1.8 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 20v-1.8c0-2.1-1.8-3.7-4-3.7H7c-2.2 0-4 1.6-4 3.7V20" />
          <circle cx="9.5" cy="7.5" r="3.5" />
          <path d="M17 4.5a3.2 3.2 0 0 1 0 6.2M18.5 14.8c1.8.4 3.1 1.8 3.1 3.6V20" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17l5-5-5-5M15 12H3" />
          <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
        </svg>
      )
    case 'chevron-left':
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      )
    case 'chevron-right':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z" />
          <path d="M4 8h15M16 12h4M16 12a2 2 0 1 0 0 4h4" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
        </svg>
      )
    case 'archive':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="4" rx="1.5" />
          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
        </svg>
      )
    case 'restore':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5M12 8v4l3 2" />
        </svg>
      )
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
      )
    case 'attachment':
      return (
        <svg {...common}>
          <path d="m20 11.5-8.5 8.5a5 5 0 0 1-7-7L14 3.5a3.5 3.5 0 0 1 5 5L9.5 18a2 2 0 0 1-3-3L15 6.5" />
        </svg>
      )
    case 'external':
      return (
        <svg {...common}>
          <path d="M14 4h6v6M20 4l-9 9" />
          <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="3" />
          <path d="m16 10 5-3v10l-5-3z" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3z" />
          <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM5.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L3 17l1.8-.7z" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 3.9 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z" />
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M8 7h8M8 11h5" />
        </svg>
      )
    case 'document':
      return (
        <svg {...common}>
          <path d="M6 2h8l5 5v15H6z" />
          <path d="M14 2v6h5M9 13h6M9 17h6" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5M3 12A9 9 0 0 1 18.5 5.8L21 8M21 3v5h-5" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      )
    case 'calendar-plus':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18M12 13v6M9 16h6" />
        </svg>
      )
    case 'repeat':
      return (
        <svg {...common}>
          <path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" />
        </svg>
      )
    case 'note':
      return (
        <svg {...common}>
          <path d="M4 4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <path d="M14 2v6h6M8 12h8M8 16h5" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'eye-off':
      return (
        <svg {...common}>
          <path d="m3 3 18 18M10.6 5.2A11.7 11.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17.6 17.6 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 5.4-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </svg>
      )
    default:
      return null
  }
}

export function Bow({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M20.5 22.5C15 15.8 8.4 14.2 6.3 18.4c-2.2 4.5 3.9 10 11.2 8.8"
        fill="#F7B3C9"
        stroke="#DE7FA2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M27.5 22.5C33 15.8 39.6 14.2 41.7 18.4c2.2 4.5-3.9 10-11.2 8.8"
        fill="#F7B3C9"
        stroke="#DE7FA2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M21.5 26.5c-2.5 4.6-3.8 9.3-1.9 12.7 2.3-.6 4.4-2.5 6.4-5.6 2 3.1 4.1 5 6.4 5.6 1.9-3.4.6-8.1-1.9-12.7"
        fill="#F9C3D4"
        stroke="#DE7FA2"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="19.5" y="20.8" width="9" height="8.5" rx="3" fill="#F39FBB" stroke="#DE7FA2" strokeWidth="2" />
      <circle cx="24" cy="25" r="1.3" fill="#FFF7FA" />
    </svg>
  )
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-bow">
        <Bow size={compact ? 34 : 42} />
      </span>
      <span className="brand-text">
        <span className="brand-title">ตารางสอนของฉัน</span>
        {!compact && <span className="brand-subtitle">Tutor’s little planner</span>}
      </span>
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'sky'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  loading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner spinner-small" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  icon: IconName
  variant?: ButtonVariant
}) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn-${variant} ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  )
}

export function Spinner({ label = 'กำลังโหลด' }: { label?: string }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function LoadingScreen({ message = 'กำลังโหลดข้อมูล…' }: { message?: string }) {
  return (
    <div className="loading-screen" role="status">
      <div className="loading-card">
        <Bow size={54} />
        <span className="spinner" aria-hidden="true" />
        <p>{message}</p>
        <span className="loading-hint">กำลังจัดตารางให้น่ารักอยู่</span>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-compact' : ''}`}>
      <div className="empty-bow">
        <Bow size={compact ? 38 : 54} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

export function ErrorPanel({
  message,
  onRetry,
  compact = false,
}: {
  message: string
  onRetry?: () => void
  compact?: boolean
}) {
  return (
    <div className={`error-panel ${compact ? 'error-compact' : ''}`} role="alert">
      <span className="error-icon">
        <Icon name="alert" size={20} />
      </span>
      <div className="error-copy">
        <strong>มีบางอย่างไม่เรียบร้อย</strong>
        <p>{message}</p>
      </div>
      {onRetry && (
        <Button variant="soft" size="sm" icon="refresh" onClick={onRetry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: string
  htmlFor?: string
  hint?: string
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="field-required"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="field-hint">{hint}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'pink',
  label,
}: {
  value: number
  tone?: 'pink' | 'green' | 'blue'
  label?: string
}) {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div
      className={`progress ${tone === 'pink' ? '' : `progress-${tone}`}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safe * 100) / 100}
      aria-label={label ?? 'ความคืบหน้า'}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  )
}

export function Badge({
  children,
  tone = 'pink',
  dot = false,
}: {
  children: ReactNode
  tone?: 'pink' | 'blue' | 'purple' | 'peach' | 'green' | 'gray' | 'red'
  dot?: boolean
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

const modalStack: symbol[] = []
let originalBodyOverflow: string | null = null

interface ModalProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'wide'
  busy?: boolean
  icon?: IconName
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
  busy = false,
  icon,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const stackId = useRef(Symbol('modal'))
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2)}`)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  onCloseRef.current = onClose
  busyRef.current = busy

  useEffect(() => {
    if (!open) return
    const id = stackId.current
    if (modalStack.length === 0) originalBodyOverflow = document.body.style.overflow
    modalStack.push(id)
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !busyRef.current &&
        modalStack[modalStack.length - 1] === id
      ) {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    const body = panelRef.current?.querySelector<HTMLElement>('.modal-body')
    if (body) body.scrollTop = 0

    const timer = window.setTimeout(() => {
      const firstInput = panelRef.current?.querySelector<HTMLElement>(
        '.modal-body input:not(.sr-only), .modal-body select:not(.sr-only), .modal-body textarea:not(.sr-only)',
      )
      ;(firstInput ?? panelRef.current?.querySelector<HTMLElement>('.modal-header button'))?.focus({
        preventScroll: true,
      })
      if (body) body.scrollTop = 0
    }, 50)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const index = modalStack.lastIndexOf(id)
      if (index >= 0) modalStack.splice(index, 1)
      if (modalStack.length === 0) {
        document.body.style.overflow = originalBodyOverflow ?? ''
        originalBodyOverflow = null
      }
      window.clearTimeout(timer)
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="modal-layer">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="ปิดหน้าต่าง"
        onClick={() => {
          if (!busy) onClose()
        }}
      />
      <div
        ref={panelRef}
        className={`modal-panel modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
      >
        <header className="modal-header">
          <div className="modal-heading">
            {icon && (
              <span className="modal-icon">
                <Icon name={icon} size={20} />
              </span>
            )}
            <div>
              <h2 id={titleId.current}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <IconButton label="ปิด" icon="x" onClick={onClose} disabled={busy} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'danger',
  onConfirm,
  onClose,
  busy = false,
  children,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning' | 'normal'
  onConfirm: () => void
  onClose: () => void
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="sm"
      busy={busy}
      icon="alert"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description && <p className="confirm-description">{description}</p>}
      {children}
    </Modal>
  )
}

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  pushToast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const pushToast = useCallback((message: string, tone: ToastTone = 'success') => {
    counter.current += 1
    const id = counter.current
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4600)
  }, [])

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
            <span className="toast-icon">
              <Icon
                name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'alert' : 'sparkles'}
                size={17}
              />
            </span>
            <span>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="ปิดข้อความ"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast ต้องใช้ภายใน ToastProvider')
  return context
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const media = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches)
    setMatches(media.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [query])
  return matches
}

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  )
}

export function ShortcutLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`shortcut-links ${compact ? 'shortcuts-compact' : ''}`}>
      <a
        className="shortcut shortcut-meet"
        href="https://meet.google.com/"
        target="_blank"
        rel="noreferrer"
      >
        <span className="shortcut-icon">
          <Icon name="video" size={17} />
        </span>
        <span>Google Meet</span>
        <Icon name="external" size={13} className="shortcut-external" />
      </a>
      <a
        className="shortcut shortcut-chatgpt"
        href="https://chatgpt.com/"
        target="_blank"
        rel="noreferrer"
      >
        <span className="shortcut-icon">
          <Icon name="sparkles" size={17} />
        </span>
        <span>ChatGPT</span>
        <Icon name="external" size={13} className="shortcut-external" />
      </a>
    </div>
  )
}
