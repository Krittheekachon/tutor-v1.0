import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { replaceSchedule } from '../lib/api'
import {
  addDaysKey,
  formatDuration,
  formatScheduleRule,
  formatThaiDate,
  formatTimeRange,
  todayKey,
  WEEKDAY_LONG,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { findScheduleRuleConflicts, validateSlots } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { Course, ScheduleSlotInput, Student } from '../lib/types'
import { ScheduleSlotsEditor, makeEmptySlot } from './ScheduleSlotsEditor'
import { Button, ConfirmDialog, Field, Icon, Modal, useToast } from './ui'

export function ScheduleFormModal({
  open,
  course,
  student,
  onClose,
}: {
  open: boolean
  course: Course
  student: Student
  onClose: () => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [effectiveFrom, setEffectiveFrom] = useState(addDaysKey(todayKey(), 1))
  const [slots, setSlots] = useState<ScheduleSlotInput[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const activeRules = useMemo(
    () =>
      (data?.rules ?? [])
        .filter((rule) => rule.course_id === course.id && rule.active)
        .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
    [data, course.id],
  )

  useEffect(() => {
    if (!open) return
    setEffectiveFrom(addDaysKey(todayKey(), 1))
    setSlots(
      activeRules.length > 0
        ? activeRules.map((rule) => ({
            id: rule.id,
            weekday: rule.weekday,
            start_time: rule.start_time.slice(0, 5),
            end_time: rule.end_time.slice(0, 5),
          }))
        : [makeEmptySlot(1)],
    )
    setBusy(false)
    setError(null)
    setConfirmOpen(false)
  }, [open, activeRules])

  if (!data) return null

  const allActiveCourseIds = new Set(
    data.courses.filter((item) => !item.archived_at && item.id !== course.id).map((item) => item.id),
  )
  const conflicts = findScheduleRuleConflicts(slots, data.rules, allActiveCourseIds)

  const latestTaughtDate = data.sessions
    .filter(
      (session) =>
        session.course_id === course.id &&
        data.logs.some((log) => log.session_id === session.id),
    )
    .map((session) => session.session_date)
    .sort()
    .at(-1)

  function conflictText(ruleId: string): string {
    const rule = data?.rules.find((item) => item.id === ruleId)
    if (!rule) return ''
    const conflictCourse = data?.courses.find((item) => item.id === rule.course_id)
    const conflictStudent = data?.students.find((item) => item.id === conflictCourse?.student_id)
    return `${conflictStudent?.nickname ?? 'นักเรียน'} • ${conflictCourse?.subject ?? 'คอร์ส'} • ${formatScheduleRule(
      rule.weekday,
      rule.start_time,
      rule.end_time,
    )}`
  }

  function validate(): string | null {
    if (!effectiveFrom) return 'กรุณาเลือกวันที่มีผล'
    if (effectiveFrom < todayKey()) return 'วันที่มีผลต้องเป็นวันนี้หรือวันในอนาคต'
    if (latestTaughtDate && effectiveFrom <= latestTaughtDate) {
      return `มีบันทึกการสอนถึงวันที่ ${formatThaiDate(latestTaughtDate)} กรุณาเลือกวันที่มีผลหลังวันนั้น`
    }
    const slotError = validateSlots(slots)
    if (slotError) return slotError
    return null
  }

  async function save() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      setConfirmOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await replaceSchedule({
        ownerId: course.owner_id,
        courseId: course.id,
        effectiveFrom,
        slots,
        today: todayKey(),
      })
      const refreshed = await refresh()
      pushToast(
        refreshed
          ? 'บันทึกตารางประจำใหม่แล้ว นัดในอนาคตถูกปรับตามวันที่มีผล'
          : 'บันทึกตารางแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmOpen(false)
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
      setConfirmOpen(false)
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
      setConfirmOpen(true)
      return
    }
    void save()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title="แก้ตารางประจำ"
        subtitle={`${student.nickname} • ${course.subject}`}
        icon="repeat"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" form="schedule-form" loading={busy} icon="check">
              บันทึกตารางใหม่
            </Button>
          </>
        }
      >
        <form id="schedule-form" onSubmit={handleSubmit} noValidate>
          {activeRules.length > 0 && (
            <div className="current-schedule-box">
              <span className="current-schedule-label">ตารางปัจจุบัน</span>
              <div className="current-schedule-list">
                {activeRules.map((rule) => (
                  <span key={rule.id} className="current-schedule-chip">
                    {WEEKDAY_LONG[rule.weekday]} {formatTimeRange(rule.start_time, rule.end_time)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Field
            label="วันที่มีผล"
            htmlFor="schedule-effective"
            required
            hint="นัดประจำที่ยังไม่สอนตั้งแต่วันที่มีผลจะถูกปรับตามตารางใหม่ ส่วนประวัตินัดเดิมยังอยู่ครบ"
          >
            <input
              id="schedule-effective"
              className="input"
              type="date"
              min={todayKey()}
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              disabled={busy}
            />
          </Field>

          <div className="field">
            <span className="field-label">ช่วงเวลาเรียนประจำใหม่</span>
            <ScheduleSlotsEditor slots={slots} onChange={setSlots} disabled={busy} />
          </div>

          <div className="schedule-note-list">
            <p>
              <Icon name="check" size={16} />
              นัดที่สอนแล้วจะไม่ถูกแก้และยังอ้างอิงนัดเดิมได้
            </p>
            <p>
              <Icon name="check" size={16} />
              นัดที่เลื่อนหรือยกเลิกไว้จะยังคงอยู่ ส่วนนัดปกติที่ยังไม่สอนตั้งแต่วันที่มีผลจะถูกสร้างใหม่
            </p>
            <p>
              <Icon name="check" size={16} />
              เปิดปฏิทินซ้ำไม่ทำให้เกิดนัดซ้ำ เพราะระบบใช้คีย์คงที่ต่อนัด
            </p>
          </div>

          {conflicts.length > 0 && (
            <div className="warning-box" role="status">
              <Icon name="alert" size={18} />
              <div>
                <strong>ตารางใหม่ซ้อนกับนัดของคอร์สอื่น {conflicts.length} ช่วง</strong>
                <ul>
                  {conflicts.slice(0, 6).map((rule) => (
                    <li key={rule.id}>{conflictText(rule.id)}</li>
                  ))}
                </ul>
                <span>ระบบยังบันทึกได้ แต่จะให้ยืนยันอีกครั้ง</span>
              </div>
            </div>
          )}

          <div className="inline-note">
            <Icon name="clock" size={16} />
            รวมเวลาเรียนต่อสัปดาห์{' '}
            {formatDuration(
              slots.reduce((total, slot) => {
                const [startH, startM] = slot.start_time.split(':').map(Number)
                const [endH, endM] = slot.end_time.split(':').map(Number)
                return total + Math.max(0, endH * 60 + endM - (startH * 60 + startM))
              }, 0),
              'short',
            )}
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

      <ConfirmDialog
        open={confirmOpen}
        title="ยืนยันตารางที่มีเวลาซ้อน?"
        description={`ตารางใหม่ซ้อนกับอีก ${conflicts.length} ช่วงของคอร์สอื่น ระบบอนุญาตให้บันทึก แต่ควรตรวจสอบก่อน`}
        confirmLabel="ยืนยันบันทึกตาราง"
        cancelLabel="กลับไปแก้ไข"
        tone="warning"
        busy={busy}
        onConfirm={() => void save()}
        onClose={() => {
          if (!busy) setConfirmOpen(false)
        }}
      />
    </>
  )
}
