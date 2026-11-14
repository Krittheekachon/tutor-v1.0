import { useEffect, useState, type FormEvent } from 'react'
import { signInWithEmail, signInWithGoogle } from '../lib/api'
import { toThaiError } from '../lib/errors'
import { Bow, Button, Icon, Spinner } from './ui'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

function readOAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const code =
    search.get('error_code') ??
    hash.get('error_code') ??
    search.get('error') ??
    hash.get('error')
  const description =
    search.get('error_description') ??
    hash.get('error_description') ??
    search.get('error_message') ??
    hash.get('error_message')

  if (!code && !description) return null
  const combined = `${code ?? ''} ${description ?? ''}`.toLowerCase()

  if (combined.includes('access_denied')) return 'คุณยกเลิกการเข้าสู่ระบบด้วย Google'
  if (combined.includes('provider is not enabled')) {
    return 'Google Login ยังไม่เปิดใช้งานใน Supabase กรุณาเปิด provider Google ก่อน'
  }
  if (combined.includes('redirect_uri_mismatch')) {
    return 'Redirect URL ไม่ตรงกับการตั้งค่า Google OAuth กรุณาตรวจสอบ Authorized redirect URI'
  }
  if (combined.includes('signups not allowed')) {
    return 'Google account ใหม่ยังสมัครไม่ได้ เพราะ Supabase ปิด “Allow new users to sign up” อยู่ กรุณาเปิดที่ Authentication → Sign In / Providers'
  }
  return description
    ? `เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ${description}`
    : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง'
}

export function LoginPage({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const authBusy = busy || googleBusy

  useEffect(() => {
    const oauthError = readOAuthErrorFromUrl()
    if (oauthError) {
      setError(oauthError)
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (authBusy) return
    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่านให้ครบ')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await signInWithEmail(email, password)
    } catch (signInError) {
      setError(toThaiError(signInError))
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    if (authBusy) return
    setGoogleBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (signInError) {
      setError(toThaiError(signInError))
    } finally {
      setGoogleBusy(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-decor login-decor-one" aria-hidden="true" />
      <div className="login-decor login-decor-two" aria-hidden="true" />
      <div className="login-decor login-decor-three" aria-hidden="true" />

      <section className="login-hero">
        <div className="login-brand">
          <span className="login-bow">
            <Bow size={62} />
          </span>
          <div>
            <p className="eyebrow">บันทึกทุกชั่วโมงอย่างอบอุ่น</p>
            <h1>
              ตารางสอน
              <span className="login-title-line">ของฉัน</span>
            </h1>
            <p className="login-tagline">
              ปฏิทินสอน ชั่วโมงคงเหลือ และค่าเรียน
              <br />
              อยู่ในสมุดเล่มเล็ก ๆ ที่หยิบใช้ได้ทุกวัน
            </p>
          </div>
        </div>

        <ul className="login-feature-list">
          <li>
            <span className="feature-dot dot-pink" />
            ดูตารางรายเดือนและรายละเอียดนัดในที่เดียว
          </li>
          <li>
            <span className="feature-dot dot-blue" />
            บันทึกเวลาสอนจริง พร้อมยอดสะสมอัตโนมัติ
          </li>
          <li>
            <span className="feature-dot dot-green" />
            รู้วันจบโดยประมาณและยอดรับเงินจริง
          </li>
        </ul>

        <div className="login-quote">
          <span className="quote-mark">“</span>
          <p>สอนไปแล้วกี่ชั่วโมง เหลืออีกเท่าไร — จำง่ายขึ้นเยอะเลย</p>
          <span className="quote-bow">
            <Bow size={28} />
          </span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-icon">
              <Icon name="user" size={22} />
            </span>
            <div>
              <h2 id="login-title">เข้าสู่ระบบ</h2>
              <p>ยินดีต้อนรับกลับมา</p>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="google-login-button"
            onClick={() => void handleGoogleSignIn()}
            disabled={authBusy}
          >
            {googleBusy ? <span className="spinner spinner-small" aria-hidden="true" /> : <GoogleIcon />}
            <span>{googleBusy ? 'กำลังพาไปที่ Google…' : 'ดำเนินการต่อด้วย Google'}</span>
          </button>

          <div className="login-divider">
            <span>หรือเข้าสู่ระบบด้วยอีเมล</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="login-email">
                อีเมล
              </label>
              <input
                id="login-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={authBusy}
                inputMode="email"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="login-password">
                รหัสผ่าน
              </label>
              <div className="password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={authBusy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  disabled={authBusy}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="login-submit"
              loading={busy}
              disabled={googleBusy}
            >
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          {/* <div className="login-hint">
            <Icon name="book" size={17} />
            <p>
              Google account ใหม่จะเริ่มพื้นที่ว่างของตัวเองโดยอัตโนมัติ
              และไม่เห็นข้อมูลของบัญชีอื่น
              ส่วนอีเมล/รหัสผ่านใช้กับบัญชีที่สร้างไว้ใน Supabase Dashboard
            </p>
          </div> */}

          {/* <div className="login-security">
            <span className="security-dot" />
            ข้อมูลของคุณถูกป้องกันด้วย Row Level Security
          </div> */}
        </div>
      </section>

      <footer className="login-footer">
        <Bow size={20} /> ตารางสอนของฉัน — หนึ่งบัญชี หนึ่งพื้นที่ส่วนตัว
      </footer>
    </main>
  )
}

export function MissingConfigPage() {
  useEffect(() => {
    document.title = 'TutorNote — ตั้งค่า'
  }, [])

  return (
    <main className="config-page">
      <div className="config-card">
        <Bow size={58} />
        <p className="eyebrow">ยังอีกนิดเดียว</p>
        <h1>ยังไม่ได้ตั้งค่า Supabase</h1>
        <p className="config-description">
          แอปนี้เชื่อมต่อ Supabase ผ่าน environment variables สองค่าเท่านั้น
          กรุณาสร้างไฟล์ <code>.env.local</code> ที่โฟลเดอร์โปรเจกต์ แล้วใส่ค่าดังนี้
        </p>
        <pre className="config-code">
          <code>
            VITE_SUPABASE_URL=https://your-project-ref.supabase.co{'\n'}
            VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
          </code>
        </pre>
        <p className="config-note">
          ค่าทั้งสองหาได้จาก Supabase Dashboard → Project Settings → API
          อย่าใส่ service_role, secret key หรือรหัสผ่านฐานข้อมูลในไฟล์นี้
        </p>
        <div className="config-steps">
          <span>1. รัน SQL migration</span>
          <span>2. สร้างบัญชีเจ้าของใน Authentication</span>
          <span>3. รีสตาร์ท <code>npm run dev</code></span>
        </div>
        <div className="config-loading">
          <Spinner label="รอการตั้งค่า" /> เมื่อใส่ค่าแล้วให้รีเฟรชหน้านี้
        </div>
      </div>
    </main>
  )
}
