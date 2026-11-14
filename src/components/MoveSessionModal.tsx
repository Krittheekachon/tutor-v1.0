import { useEffect, useState, type FormEvent } from 'react'
import { moveSession } from '../lib/api'
import {
  formatDuration,
  formatThaiDateLong,
  formatTimeRange,
  isValidTime,
  sessionDurationMinutes,
  timeToMinutes,
  todayKey,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { findSessionConflicts } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { Course, Session, Student } from '../lib/types'
import { Badge, Button, ConfirmDialog, Icon, Modal, useToast } from './ui'
import { TimeInput } from './TimeInput'

export function MoveSessionModal({
  open,
  session,
  student,
  course,
  onClose,
}: {
  open: boolean
  session: Session
  student: Student
  course: Course
  onClose: () => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [date, setDate] = useState(session.session_date)
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5))
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(session.session_date)
    setStartTime(session.start_time.slice(0, 5))
    setEndTime(session.end_time.slice(0, 5))
    setBusy(false)
    setError(null)
    setConflictOpen(false)
  }, [open, session])

  if (!data) return null

  const schedulableCourseIds = new Set(
    data.courses.filter((item) => !item.archived_at).map((item) => item.id),
  )
  const conflicts = findSessionConflicts(
    { id: session.id, session_date: date, start_time: startTime, end_time: endTime },
    data.sessions.filter((item) => schedulableCourseIds.has(item.course_id)),
  )

  function validate(): string | null {
    if (!date) return 'กรุณาเลือกวันที่ใหม่'
    if (date < todayKey()) return 'วันที่ใหม่ต้องเป็นวันนี้หรือวันในอนาคต'
    if (!startTime || !endTime) return 'กรุณากรอกเวลาเริ่มและเวลาจบ'
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return 'กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:MM'
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return 'เวลาจบต้องมากกว่าเวลาเริ่ม'
    return null
  }

  async function save() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setConflictOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await moveSession({
        sessionId: session.id,
        date,
        startTime,
        endTime,
      })
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'เลื่อนนัดเรียบร้อยแล้ว' : 'เลื่อนนัดแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConflictOpen(false)
      onClose()
    } catch (moveError) {
      setError(toThaiError(moveError))
      setConflictOpen(false)
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (conflicts.length > 0) {
      setConflictOpen(true)
      return
    }
    void save()
  }

  function conflictLabel(conflict: Session): string {
    const conflictCourse = data?.courses.find((item) => item.id === conflict.course_id)
    const conflictStudent = data?.students.find((item) => item.id === conflictCourse?.student_id)
    return `${conflictStudent?.nickname ?? 'นักเรียน'} • ${formatTimeRange(conflict.start_time, conflict.end_time)}`
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title="เลื่อนนัดครั้งนี้"
        subtitle={`${student.nickname} • ${course.subject}`}
        icon="calendar"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" form="move-form" loading={busy} icon="calendar">
              ยืนยันการเลื่อน
            </Button>
          </>
        }
      >
        <form id="move-form" onSubmit={handleSubmit} noValidate>
          <div className="move-original">
            <Badge tone="gray">นัดเดิม</Badge>
            <span>{formatThaiDateLong(session.original_date)}</span>
            <span>{formatTimeRange(session.original_start_time, session.original_end_time)} น.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="move-date">
              วันที่ใหม่ <span className="field-required">*</span>
            </label>
            <input
              id="move-date"
              className="input"
              type="date"
              min={todayKey()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={busy}
            />
            {date && <p className="field-hint">{formatThaiDateLong(date)}</p>}
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="move-start">
                เวลาเริ่ม <span className="field-required">*</span>
              </label>
              <TimeInput
                id="move-start"
                value={startTime}
                onChange={setStartTime}
                disabled={busy}
                ariaLabel="เวลาเริ่มใหม่"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="move-end">
                เวลาจบ <span className="field-required">*</span>
              </label>
              <TimeInput
                id="move-end"
                value={endTime}
                onChange={setEndTime}
                disabled={busy}
                ariaLabel="เวลาจบใหม่"
              />
            </div>
          </div>

          <div className="inline-note">
            <Icon name="clock" size={16} />
            ระยะเวลาหลังเลื่อน {formatDuration(sessionDurationMinutes(startTime, endTime), 'short')}
          </div>

          {conflicts.length > 0 && (
            <div className="warning-box" role="status">
              <Icon name="alert" size={18} />
              <div>
                <strong>เวลาซ้อนกับนัดอื่น {conflicts.length} นัด</strong>
                <ul>
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>{conflictLabel(conflict)}</li>
                  ))}
                </ul>
                <span>ยังบันทึกได้ แต่จะมีการเตือนอีกครั้งก่อนยืนยัน</span>
              </div>
            </div>
          )}

          {error && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={conflictOpen}
        title="ยืนยันเลื่อนทั้งที่มีเวลาซ้อน?"
        description={`เวลาที่เลือกซ้อนกับ ${conflicts.length} นัด ระบบอนุญาตให้บันทึก แต่ควรตรวจสอบตารางอีกครั้ง`}
        confirmLabel="ยืนยันเลื่อนนัด"
        cancelLabel="กลับไปแก้เวลา"
        tone="warning"
        busy={busy}
        onConfirm={() => void save()}
        onClose={() => {
          if (!busy) setConflictOpen(false)
        }}
      />
    </>
  )
}
