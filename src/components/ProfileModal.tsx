import { useEffect, useState, type FormEvent } from 'react'
import { updateDisplayName } from '../lib/api'
import { toThaiError } from '../lib/errors'
import { getInitial } from '../lib/profile'
import { Button, Field, Icon, Modal, useToast } from './ui'

export function ProfileModal({
  open,
  currentName,
  email,
  onClose,
  onSaved,
}: {
  open: boolean
  currentName: string
  email: string
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const { pushToast } = useToast()
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(currentName)
    setError(null)
    setBusy(false)
  }, [open, currentName])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('กรุณากรอกชื่อที่แสดง')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateDisplayName(trimmed)
      onSaved(trimmed)
      pushToast('อัปเดตชื่อที่แสดงแล้ว')
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="แก้ไขชื่อที่แสดง"
      subtitle="ชื่อนี้ใช้แสดงในแอปแทนอีเมล"
      icon="user"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="submit" form="profile-form" loading={busy} icon="check">
            บันทึกชื่อ
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="profile-preview">
          <span className="profile-preview-avatar">{getInitial(name || currentName)}</span>
          <div className="profile-preview-copy">
            <strong>{name.trim() || 'ชื่อที่แสดง'}</strong>
            <span>{email}</span>
          </div>
        </div>

        <Field
          label="ชื่อที่แสดง"
          htmlFor="profile-name"
          hint="เช่น อาจารย์หยก • ใช้ได้สูงสุด 60 ตัวอักษร"
          required
        >
          <input
            id="profile-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="อาจารย์หยก"
            maxLength={60}
            disabled={busy}
            autoComplete="name"
          />
        </Field>

        <div className="inline-note">
          <Icon name="user" size={16} />
          เปลี่ยนได้เฉพาะชื่อที่แสดงในแอป อีเมลและวิธีเข้าสู่ระบบยังเหมือนเดิม
        </div>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}
        {error && <p className="retry-note">ค่าที่กรอกยังอยู่ครบ ลองบันทึกอีกครั้งได้เลย</p>}
      </form>
    </Modal>
  )
}
