import { useEffect, useState, type FormEvent } from 'react'
import { deleteLesson, recordLesson } from '../lib/api'
import { calculateCourseStats, roundMoney } from '../lib/calc'
import {
  formatBaht,
  formatDuration,
  formatMinutesInput,
  formatThaiDate,
  formatTimeRange,
  sessionDurationMinutes,
  todayKey,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import type { Course, LessonLog, Session, Student } from '../lib/types'
import { Badge, Button, ConfirmDialog, Icon, Modal, ProgressBar, useToast } from './ui'

export function LessonModal({
  open,
  session,
  course,
  student,
  log,
  onClose,
}: {
  open: boolean
  session: Session
  course: Course
  student: Student
  log: LessonLog | null
  onClose: () => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [hours, setHours] = useState('0')
  const [minutes, setMinutes] = useState('0')
  const [taughtOn, setTaughtOn] = useState(todayKey())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const scheduledMinutes = sessionDurationMinutes(session.start_time, session.end_time)

  useEffect(() => {
    if (!open) return
    const initial = formatMinutesInput(log?.actual_minutes ?? scheduledMinutes)
    setHours(initial.hours)
    setMinutes(initial.minutes)
    setTaughtOn(log?.taught_on ?? session.session_date)
    setError(null)
    setBusy(false)
    setConfirmDelete(false)
  }, [open, log, scheduledMinutes, session.session_date])

  if (!data) return null

  const courseLogs = data.logs.filter((item) => item.course_id === course.id)
  const otherLogs = courseLogs.filter((item) => item.session_id !== session.id)
  const baseMinutes = otherLogs.reduce((total, item) => total + item.actual_minutes, 0)
  const enteredMinutes = Math.max(0, Math.round(Number(hours) || 0) * 60 + Math.round(Number(minutes) || 0))
  const previewCumulative = baseMinutes + enteredMinutes
  const previewRemaining = Math.max(0, course.purchased_minutes - previewCumulative)
  const previewProgress = course.purchased_minutes > 0
    ? Math.min(100, (previewCumulative / course.purchased_minutes) * 100)
    : 0
  const statsNow = calculateCourseStats(course, data.logs, data.sessions, data.payments)
  const previewValue = course.purchased_minutes > 0
    ? roundMoney(
        Math.min(
          course.price_baht,
          (course.price_baht * Math.min(previewCumulative, course.purchased_minutes)) /
            course.purchased_minutes,
        ),
      )
    : 0

  function validate(): string | null {
    const hourValue = Number(hours)
    const minuteValue = Number(minutes)
    if (!Number.isInteger(hourValue) || hourValue < 0) return 'จำนวนชั่วโมงต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'
    if (!Number.isInteger(minuteValue) || minuteValue < 0 || minuteValue > 59) {
      return 'จำนวนนาทีต้องอยู่ระหว่าง 0 ถึง 59'
    }
    if (enteredMinutes <= 0) return 'กรุณากรอกเวลาที่สอนจริงอย่างน้อย 1 นาที'
    if (enteredMinutes > 1440) return 'เวลาที่สอนจริงต้องไม่เกิน 24 ชั่วโมง'
    if (!taughtOn) return 'กรุณาเลือกวันที่สอนจริง'
    if (taughtOn > todayKey()) return 'วันที่สอนจริงต้องไม่เป็นวันในอนาคต'
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await recordLesson({
        ownerId: course.owner_id,
        sessionId: session.id,
        courseId: course.id,
        taughtOn,
        actualMinutes: enteredMinutes,
      })
      const refreshed = await refresh()
      const summary = `สอนจริง ${formatDuration(enteredMinutes, 'short')} • สะสม ${formatDuration(previewCumulative, 'short')} • เหลือ ${formatDuration(previewRemaining, 'short')}`
      pushToast(
        refreshed ? `บันทึกแล้ว — ${summary}` : `บันทึกแล้ว — ${summary} (แต่รีเฟรชข้อมูลไม่สำเร็จ)`,
        refreshed ? 'success' : 'warning',
      )
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteLesson(session.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ยกเลิกบันทึกการสอนแล้ว' : 'ยกเลิกบันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmDelete(false)
      onClose()
    } catch (deleteError) {
      setError(toThaiError(deleteError))
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title={log ? 'แก้ไขเวลาที่สอนจริง' : 'บันทึกหลังสอน'}
        subtitle={`${student.nickname} • ${course.subject}`}
        icon="clock"
        size="md"
        footer={
          <>
            {log && (
              <Button
                type="button"
                variant="ghost"
                className="danger-text"
                icon="trash"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                ยกเลิกบันทึกนี้
              </Button>
            )}
            <span className="footer-spacer" />
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" form="lesson-form" loading={busy} icon="check">
              {log ? 'บันทึกการแก้ไข' : 'ยืนยันบันทึกการสอน'}
            </Button>
          </>
        }
      >
        <form id="lesson-form" onSubmit={handleSubmit} noValidate>
          <div className="lesson-summary-strip">
            <div className="lesson-session-time">
              <span className="lesson-color-dot" style={{ backgroundColor: student.color_hex }} />
              <span>{formatTimeRange(session.start_time, session.end_time)} น.</span>
              <Badge tone="gray">{formatDuration(scheduledMinutes, 'short')} ตามนัด</Badge>
            </div>
            <span className="lesson-course">{course.subject}</span>
          </div>

          <p className="form-lead">
            กรอกชั่วโมงและนาทีที่สอนจริง ระบบจะใช้ค่านี้แทนบันทึกเดิมของนัดนี้
            โดยไม่บวกยอดซ้ำ
          </p>

          <div className="time-entry-grid">
            <div className="field">
              <label className="field-label" htmlFor="lesson-hours">
                ชั่วโมง
              </label>
              <div className="input-unit-wrap">
                <input
                  id="lesson-hours"
                  className="input input-number"
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                />
                <span className="input-unit">ชม.</span>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="lesson-minutes">
                นาที
              </label>
              <div className="input-unit-wrap">
                <input
                  id="lesson-minutes"
                  className="input input-number"
                  type="number"
                  min={0}
                  max={59}
                  step={1}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                />
                <span className="input-unit">นาที</span>
              </div>
            </div>
          </div>

          <div className="quick-time-row">
            <span>เลือกเร็ว:</span>
            {[30, 60, 90, 120, scheduledMinutes]
              .filter((value, index, values) => values.indexOf(value) === index && value > 0)
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  className="quick-time-chip"
                  onClick={() => {
                    const next = formatMinutesInput(value)
                    setHours(next.hours)
                    setMinutes(next.minutes)
                  }}
                  disabled={busy}
                >
                  {formatDuration(value, 'short')}
                </button>
              ))}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="lesson-date">
              วันที่สอนจริง
            </label>
            <input
              id="lesson-date"
              className="input"
              type="date"
              value={taughtOn}
              max={todayKey()}
              onChange={(event) => setTaughtOn(event.target.value)}
              disabled={busy}
            />
            {taughtOn && <p className="field-hint">{formatThaiDate(taughtOn)}</p>}
          </div>

          <div className="lesson-preview">
            <div className="lesson-preview-head">
              <span>ยอดสะสมหลังบันทึก</span>
              <strong>{formatDuration(previewCumulative)}</strong>
            </div>
            <ProgressBar value={previewProgress} label="ความคืบหน้าหลังบันทึก" />
            <div className="lesson-preview-meta">
              <span>ซื้อ {formatDuration(course.purchased_minutes)}</span>
              <span>
                {previewCumulative >= course.purchased_minutes
                  ? `สอนครบแล้ว${previewCumulative > course.purchased_minutes ? ` • เกิน ${formatDuration(previewCumulative - course.purchased_minutes)}` : ''}`
                  : `เหลือ ${formatDuration(previewRemaining)}`}
              </span>
            </div>
            <div className="lesson-preview-money">
              <span>
                มูลค่าที่สอนไป <strong>{formatBaht(previewValue)}</strong>
              </span>
              {statsNow.actualMinutes > 0 && !log && (
                <span className="lesson-preview-note">
                  ยอดเดิม {formatDuration(statsNow.actualMinutes, 'short')}
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="ยกเลิกบันทึกการสอนนี้?"
        description="สถานะ «สอนแล้ว» จะถูกเอาออก และยอดสะสมของคอร์สจะลดลงตามเวลาที่บันทึกไว้"
        confirmLabel="ยกเลิกบันทึก"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (!busy) setConfirmDelete(false)
        }}
      />
    </>
  )
}
