import { useEffect, useState, type FormEvent } from 'react'
import { deleteAttachment, uploadAttachment, updateSessionNote } from '../lib/api'
import { formatThaiDate, formatTimeRange } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import { attachmentSessionId } from '../lib/attachments'
import { ContentAttachments } from './ContentAttachments'
import { AttachmentButton } from './AttachmentButton'
import type { Attachment, Course, Session, Student } from '../lib/types'
import {
  Badge,
  Button,
  ConfirmDialog,
  Field,
  Icon,
  Modal,
  useToast,
} from './ui'

export function SessionNoteModal({
  open,
  session,
  course,
  student,
  onClose,
}: {
  open: boolean
  session: Session
  course: Course
  student: Student
  onClose: () => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [note, setNote] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<Attachment[]>([])
  const [removed, setRemoved] = useState<string[]>([])
  const existing = [...(data?.attachments ?? []), ...uploaded]
    .filter((file, index, all) => attachmentSessionId(file) === session.id && all.findIndex(item => item.id === file.id) === index)
  const visible = existing.filter(file => !removed.includes(file.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    if (!open) return
    setNote(session.note)
    setFiles([])
    setUploaded([])
    setRemoved([])
    setBusy(false)
    setError(null)
    setConfirmClear(false)
  }, [open, session])

  const hasExistingNote = session.note.trim().length > 0 || existing.length > 0

  async function saveNote(nextNote: string, clear = false) {
    setBusy(true)
    setError(null)
    try {
      if (!clear) {
        for (const file of files) {
          const attachment = await uploadAttachment(course.owner_id, course.id, file, session.id)
          setUploaded(current => [...current, attachment])
          setFiles(current => current.filter(item => item !== file))
        }
      }
      for (const attachment of existing.filter(file => clear || removed.includes(file.id))) {
        await deleteAttachment(attachment)
        setUploaded(current => current.filter(item => item.id !== attachment.id))
      }
      await updateSessionNote(session.id, nextNote)
      const refreshed = await refresh()
      pushToast(
        refreshed
          ? (nextNote.trim() || (!clear && (files.length > 0 || visible.length > 0)))
            ? 'บันทึกโน้ตของนัดนี้แล้ว'
            : 'ลบโน้ตของนัดนี้แล้ว'
          : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmClear(false)
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
      setConfirmClear(false)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    void saveNote(note)
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title={hasExistingNote ? 'แก้ไขโน้ตของนัดนี้' : 'เพิ่มโน้ตในปฏิทิน'}
        subtitle={`${student.nickname} • ${course.subject}`}
        icon="note"
        footer={
          <>
            {hasExistingNote && (
              <Button
                type="button"
                variant="ghost"
                className="danger-text"
                icon="trash"
                onClick={() => setConfirmClear(true)}
                disabled={busy}
              >
                ลบโน้ต
              </Button>
            )}
            <span className="footer-spacer" />
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" form="session-note-form" loading={busy} icon="check">
              บันทึกโน้ต
            </Button>
          </>
        }
      >
        <form id="session-note-form" onSubmit={handleSubmit} noValidate>
          <div className="note-context">
            <span className="note-context-date">{formatThaiDate(session.session_date)}</span>
            <Badge tone="pink">{formatTimeRange(session.start_time, session.end_time)} น.</Badge>
            <Badge tone="gray">{course.subject}</Badge>
          </div>

          <Field
            label="โน้ตของนัดนี้"
            htmlFor="session-note"
            hint="แนบไฟล์หรือวางรูปได้แม้ไม่มีข้อความ • สูงสุด 5,000 ตัวอักษร"
          >
            <ContentAttachments files={files} onChange={setFiles} disabled={busy}>
            <textarea
              id="session-note"
              className="input textarea note-textarea"
              rows={5}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="เช่น ส่งการบ้านชุดที่ 3 ให้น้อง / ถ่ายรูปสมุดแล้วส่งในไลน์ / อย่าลืมเช็กงานค้าง"
              maxLength={5000}
              disabled={busy}
            />
            </ContentAttachments>
            {visible.length > 0 && <div className="attachment-manage-list">
              {visible.map(attachment => <div className="attachment-manage-row" key={attachment.id}>
                <AttachmentButton attachment={attachment} compact={false} />
                <button type="button" className="file-remove" disabled={busy}
                  aria-label={`เอาไฟล์ ${attachment.file_name} ออก`}
                  onClick={() => setRemoved(current => [...current, attachment.id])}>
                  <Icon name="x" size={15} />
                </button>
              </div>)}
            </div>}
          </Field>

          <div className="inline-note">
            <Icon name="note" size={16} />
            โน้ตนี้จะแสดงในรายละเอียดของนัดบน Dashboard และมีเครื่องหมาย ✎ บนแถบปฏิทิน
            เพื่อเตือนความจำ โดยไม่กระทบชั่วโมงเรียนหรือค่าเรียน
          </div>

          {error && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}
          {error && <p className="retry-note">ข้อความที่พิมพ์ยังอยู่ครบ ลองบันทึกอีกครั้งได้เลย</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmClear}
        title="ลบโน้ตของนัดนี้?"
        description="ข้อความและไฟล์แนบของโน้ตจะถูกลบออกจากนัดนี้ แต่ข้อมูลการสอนและชั่วโมงยังอยู่ครบ"
        confirmLabel="ลบโน้ต"
        tone="danger"
        busy={busy}
        onConfirm={() => void saveNote('', true)}
        onClose={() => {
          if (!busy) setConfirmClear(false)
        }}
      />
    </>
  )
}
