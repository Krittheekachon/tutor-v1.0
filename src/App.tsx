import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { signOutUser } from './lib/api'
import { toThaiError } from './lib/errors'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { AppDataProvider, useAppData } from './state/AppDataContext'
import { DashboardPage } from './components/DashboardPage'
import { StudentsPage } from './components/StudentsPage'
import { LoginPage, MissingConfigPage } from './components/LoginPage'
import { ProfileModal } from './components/ProfileModal'
import { getDisplayName, getInitial } from './lib/profile'
import {
  Bow,
  Button,
  ConfirmDialog,
  ErrorPanel,
  Icon,
  LoadingScreen,
  Logo,
  ShortcutLinks,
  Spinner,
  ToastProvider,
  useToast,
} from './components/ui'

type Tab = 'dashboard' | 'students'

function tabFromHash(): Tab {
  return window.location.hash === '#students' ? 'students' : 'dashboard'
}

export default function App() {
  return (
    <ToastProvider>
      {isSupabaseConfigured && supabase ? <AuthApp /> : <MissingConfigPage />}
    </ToastProvider>
  )
}

function AuthApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) {
      document.title = 'TutorNote — กำลังโหลด'
    } else if (!session) {
      document.title = 'TutorNote — เข้าสู่ระบบ'
    }
  }, [authLoading, session])

  useEffect(() => {
    let active = true
    if (!supabase) {
      setAuthLoading(false)
      return
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setAuthLoading(false)
      })
      .catch((error: unknown) => {
        if (!active) return
        setAuthError(toThaiError(error))
        setAuthLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (nextSession) setAuthError(null)
      setAuthLoading(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (authLoading) {
    return <LoadingScreen message="กำลังตรวจสอบบัญชี…" />
  }

  if (!session) {
    return <LoginPage initialError={authError} />
  }

  return (
    <AppDataProvider userId={session.user.id}>
      <DataGate
        email={session.user.email ?? ''}
        displayName={getDisplayName(session.user)}
      />
    </AppDataProvider>
  )
}

function DataGate({ email, displayName }: { email: string; displayName: string }) {
  const { data, loading, error, refresh, refreshing } = useAppData()

  if (loading) {
    return <LoadingScreen message="กำลังโหลดตารางสอนของคุณ…" />
  }

  if (!data) {
    return (
      <main className="fatal-page">
        <div className="fatal-card">
          <Bow size={58} />
          <h1>เปิดตารางสอนไม่สำเร็จ</h1>
          <p>{error ?? 'ไม่พบข้อมูล กรุณาลองใหม่อีกครั้ง'}</p>
          <Button icon="refresh" onClick={() => void refresh()} loading={refreshing}>
            ลองอีกครั้ง
          </Button>
          <p className="fatal-hint">
            หากยังไม่สำเร็จ ให้ตรวจสอบว่าได้รัน SQL migration และตั้งค่า environment variables ครบแล้ว
          </p>
        </div>
      </main>
    )
  }

  return <AuthenticatedApp email={email} displayName={displayName} />
}

function AuthenticatedApp({ email, displayName }: { email: string; displayName: string }) {
  const { data, error, refresh, refreshing } = useAppData()
  const { pushToast } = useToast()
  const [tab, setTab] = useState<Tab>(() => tabFromHash())
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [localDisplayName, setLocalDisplayName] = useState(displayName)

  useEffect(() => {
    setLocalDisplayName(displayName)
  }, [displayName])

  useEffect(() => {
    document.title = tab === 'students' ? 'TutorNote — นักเรียน' : 'TutorNote — ตารางสอน'
  }, [tab])

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const switchTab = useCallback((nextTab: Tab) => {
    setTab(nextTab)
    if (window.location.hash !== `#${nextTab}`) {
      window.history.replaceState(null, '', `#${nextTab}`)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  async function handleRefresh() {
    const ok = await refresh()
    if (ok) pushToast('อัปเดตข้อมูลล่าสุดแล้ว', 'info')
    else pushToast('รีเฟรชข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง', 'error')
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await signOutUser()
      setLogoutOpen(false)
    } catch (logoutError) {
      pushToast(toThaiError(logoutError), 'error')
      setLoggingOut(false)
    }
  }

  if (!data) return <LoadingScreen message="กำลังโหลดตารางสอนของคุณ…" />

  const avatar = getInitial(localDisplayName)

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <button
            type="button"
            className="brand-button"
            onClick={() => switchTab('dashboard')}
            aria-label="ไปที่หน้าปฏิทิน"
          >
            <Logo />
          </button>

          <nav className="main-nav" aria-label="เมนูหลัก">
            <button
              type="button"
              className={`nav-item ${tab === 'dashboard' ? 'is-active' : ''}`}
              onClick={() => switchTab('dashboard')}
              aria-current={tab === 'dashboard' ? 'page' : undefined}
            >
              <Icon name="calendar" size={18} />
              <span>ปฏิทินสอน</span>
            </button>
            <button
              type="button"
              className={`nav-item ${tab === 'students' ? 'is-active' : ''}`}
              onClick={() => switchTab('students')}
              aria-current={tab === 'students' ? 'page' : undefined}
            >
              <Icon name="users" size={18} />
              <span>นักเรียน</span>
            </button>
          </nav>

          <div className="header-actions">
            <div className="header-shortcuts">
              <ShortcutLinks compact />
            </div>
            <button
              type="button"
              className={`refresh-button ${refreshing ? 'is-spinning' : ''}`}
              onClick={() => void handleRefresh()}
              aria-label="รีเฟรชข้อมูล"
              title="รีเฟรชข้อมูล"
              disabled={refreshing}
            >
              {refreshing ? <Spinner label="กำลังรีเฟรช" /> : <Icon name="refresh" size={18} />}
            </button>
            <button
              type="button"
              className="user-chip"
              onClick={() => setProfileOpen(true)}
              title={`${localDisplayName} • ${email}`}
              aria-label="แก้ไขชื่อที่แสดง"
            >
              <span className="user-avatar">{avatar}</span>
              <span className="user-copy">
                <strong>{localDisplayName}</strong>
                <small>{email}</small>
              </span>
            </button>
            <button
              type="button"
              className="logout-button"
              onClick={() => setLogoutOpen(true)}
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <Icon name="logout" size={18} />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="global-error">
          <ErrorPanel
            message={error}
            onRetry={() => {
              void refresh().then((ok) => {
                if (ok) pushToast('เชื่อมต่อข้อมูลได้อีกครั้งแล้ว', 'success')
              })
            }}
            compact
          />
        </div>
      )}

      <main className="app-main">
        {tab === 'dashboard' ? (
          <DashboardPage
            displayName={localDisplayName}
            onGoToStudents={() => switchTab('students')}
          />
        ) : (
          <StudentsPage />
        )}
      </main>

      <footer className="app-footer">
        <span>
          <Bow size={18} /> ตารางสอนของฉัน
        </span>
        <span>เวลาไทย (Asia/Bangkok) • ข้อมูลของคุณเห็นได้เฉพาะบัญชีนี้</span>
      </footer>

      <nav className="mobile-nav" aria-label="เมนูมือถือ">
        <button
          type="button"
          className={tab === 'dashboard' ? 'is-active' : ''}
          onClick={() => switchTab('dashboard')}
          aria-current={tab === 'dashboard' ? 'page' : undefined}
        >
          <Icon name="calendar" size={22} />
          <span>ปฏิทินสอน</span>
        </button>
        <button
          type="button"
          className={tab === 'students' ? 'is-active' : ''}
          onClick={() => switchTab('students')}
          aria-current={tab === 'students' ? 'page' : undefined}
        >
          <Icon name="users" size={22} />
          <span>นักเรียน</span>
        </button>
      </nav>

      <ProfileModal
        open={profileOpen}
        currentName={localDisplayName}
        email={email}
        onClose={() => setProfileOpen(false)}
        onSaved={setLocalDisplayName}
      />

      <ConfirmDialog
        open={logoutOpen}
        title="ออกจากระบบ?"
        description="ข้อมูลยังอยู่ครบใน Supabase และจะเห็นอีกครั้งเมื่อเข้าสู่ระบบด้วยบัญชีเดิม"
        confirmLabel="ออกจากระบบ"
        tone="warning"
        busy={loggingOut}
        onConfirm={() => void handleLogout()}
        onClose={() => {
          if (!loggingOut) setLogoutOpen(false)
        }}
      />
    </div>
  )
}
