import { useState, type FormEvent } from 'react'
import { signInWithEmail } from '../lib/api'
import { toThaiError } from '../lib/errors'
import { Bow, Button, Icon, Spinner } from './ui'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
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
              <p>สำหรับเจ้าของตารางสอนเท่านั้น</p>
            </div>
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
                disabled={busy}
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
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  disabled={busy}
                >
                  <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="login-submit" loading={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          <div className="login-hint">
            <Icon name="book" size={17} />
            <p>
              บัญชีเจ้าของสร้างไว้ใน Supabase Dashboard แล้ว
              แอปนี้ไม่มีหน้าสมัครสมาชิกและไม่เปิดให้ลงทะเบียนเอง
            </p>
          </div>

          <div className="login-security">
            <span className="security-dot" />
            ข้อมูลของคุณถูกป้องกันด้วย Row Level Security
          </div>
        </div>
      </section>

      <footer className="login-footer">
        <Bow size={20} /> ตารางสอนของฉัน — สำหรับติวเตอร์หนึ่งคน
      </footer>
    </main>
  )
}

export function MissingConfigPage() {
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
