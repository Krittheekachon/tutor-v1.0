import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createExtraSession } from '../lib/api'
import {
  formatDuration,
  formatThaiDate,
  formatTimeRange,
  isValidTime,
  timeToMinutes,
  todayKey,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { findSessionConflicts } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { Session, Student } from '../lib/types'
import { Badge, Button, ConfirmDialog, EmptyState, Icon, Modal, useToast } from './ui'
import { TimeInput } from './TimeInput'

export function ExtraSessionModal({
  open,
  onClose,
  initialCourseId,
  initialDate,
}: {
  open: boolean
  onClose: () => void
  initialCourseId?: string
  initialDate?: string
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [search, setSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [date, setDate] = useState(initialDate ?? todayKey())
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('17:30')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setDate(initialDate ?? todayKey())
    setStartTime('16:00')
    setEndTime('17:30')
    setNote('')
    setBusy(false)
    setError(null)
    setConflictOpen(false)

    if (initialCourseId && data) {
      const course = data.courses.find((item) => item.id === initialCourseId)
      if (course) {
        setSelectedStudentId(course.student_id)
        setSelectedCourseId(course.id)
      }
    } else {
      setSelectedStudentId('')
      setSelectedCourseId('')
    }
  }, [open, initialCourseId, initialDate, data])

  if (!data) return null

  const activeStudents = data.students.filter((student) => !student.archived_at)
  const activeCourses = data.courses.filter((course) => !course.archived_at)
  const selectedStudent = activeStudents.find((student) => student.id === selectedStudentId) ?? null
  const studentCourses = selectedStudent
    ? activeCourses.filter((course) => course.student_id === selectedStudent.id)
    : []
  const selectedCourse = activeCourses.find((course) => course.id === selectedCourseId) ?? null

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return activeStudents.slice(0, 6)
    return activeStudents
      .filter((student) => student.nickname.toLowerCase().includes(query))
      .slice(0, 8)
  }, [activeStudents, search])

  const schedulableCourseIds = new Set(activeCourses.map((course) => course.id))
  const schedulableSessions = data.sessions.filter((session) =>
    schedulableCourseIds.has(session.course_id),
  )
  const conflicts = findSessionConflicts(
    { session_date: date, start_time: startTime, end_time: endTime },
    schedulableSessions,
  )

  function chooseStudent(student: Student) {
    setSelectedStudentId(student.id)
    const firstCourse = activeCourses.find((course) => course.student_id === student.id) ?? null
    setSelectedCourseId(firstCourse?.id ?? '')
    setSearch('')
  }

  function conflictLabel(conflict: Session): string {
    const conflictCourse = data?.courses.find((item) => item.id === conflict.course_id)
    const conflictStudent = data?.students.find((item) => item.id === conflictCourse?.student_id)
    return `${conflictStudent?.nickname ?? 'นักเรียน'} • ${formatTimeRange(conflict.start_time, conflict.end_time)}`
  }

  function validate(): string | null {
    if (!selectedStudent) return 'กรุณาเลือกนักเรียน'
    if (!selectedCourse) return 'กรุณาเลือกคอร์ส'
    if (!date) return 'กรุณาเลือกวันที่สอน'
    if (!startTime || !endTime) return 'กรุณากรอกเวลาเริ่มและเวลาจบ'
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return 'กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:MM'
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) return 'เวลาจบต้องมากกว่าเวลาเริ่ม'
    if (!note.trim()) return 'กรุณากรอกเนื้อหาของครั้งนี้'
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
      await createExtraSession({
        ownerId: selectedCourse!.owner_id,
        courseId: selectedCourse!.id,
        date,
        startTime,
        endTime,
        note,
      })
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'เพิ่มนัดนอกรอบเรียบร้อยแล้ว' : 'เพิ่มนัดแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConflictOpen(false)
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        busy={busy}
        title="เพิ่มนัดนอกรอบ"
        subtitle="ใช้นักเรียนและคอร์สเดิม สีจะตามนักเรียนคนนั้น"
        icon="calendar-plus"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ยกเลิก
            </Button>
            <Button type="submit" form="extra-form" loading={busy} icon="plus">
              เพิ่มนัดนอกรอบ
            </Button>
          </>
        }
      >
        <form id="extra-form" onSubmit={handleSubmit} noValidate>
          {activeStudents.length === 0 ? (
            <EmptyState
              compact
              title="ยังไม่มีนักเรียน"
              description="เพิ่มนักเรียนและคอร์สก่อน แล้วจึงเพิ่มนัดนอกรอบได้"
            />
          ) : (
            <>
              {!selectedStudent ? (
                <div className="field">
                  <label className="field-label" htmlFor="extra-student-search">
                    ค้นหานักเรียนเดิม <span className="field-required">*</span>
                  </label>
                  <div className="search-input-wrap">
                    <Icon name="search" size={18} />
                    <input
                      id="extra-student-search"
                      className="input search-input"
                      placeholder="พิมพ์ชื่อเล่น…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      disabled={busy}
                      autoComplete="off"
                    />
                  </div>
                  <div className="student-pick-list">
                    {filteredStudents.length === 0 ? (
                      <p className="student-pick-empty">ไม่พบนักเรียนที่ค้นหา</p>
                    ) : (
                      filteredStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          className="student-pick-item"
                          onClick={() => chooseStudent(student)}
                          disabled={busy}
                        >
                          <span
                            className="student-color-dot"
                            style={{ backgroundColor: student.color_hex }}
                          />
                          <span className="student-pick-name">{student.nickname}</span>
                          <span className="student-pick-subject">
                            {activeCourses
                              .filter((course) => course.student_id === student.id)
                              .map((course) => course.subject)
                              .join(' • ') || 'ยังไม่มีคอร์ส'}
                          </span>
                          <Icon name="chevron-right" size={16} />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="selected-student-bar">
                  <span
                    className="student-color-dot student-color-dot-lg"
                    style={{ backgroundColor: selectedStudent.color_hex }}
                  />
                  <div className="selected-student-copy">
                    <strong>{selectedStudent.nickname}</strong>
                    <span>{studentCourses.length} คอร์สที่ใช้งาน</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedStudentId('')
                      setSelectedCourseId('')
                    }}
                    disabled={busy}
                  >
                    เปลี่ยนนักเรียน
                  </Button>
                </div>
              )}

              {selectedStudent && (
                <div className="field">
                  <label className="field-label" htmlFor="extra-course">
                    เลือกคอร์ส <span className="field-required">*</span>
                  </label>
                  {studentCourses.length === 0 ? (
                    <div className="inline-note warning-inline">
                      <Icon name="alert" size={16} />
                      นักเรียนคนนี้ยังไม่มีคอร์สที่ใช้งาน กรุณาเพิ่มคอร์สก่อน
                    </div>
                  ) : (
                    <select
                      id="extra-course"
                      className="input input-select"
                      value={selectedCourseId}
                      onChange={(event) => setSelectedCourseId(event.target.value)}
                      disabled={busy}
                    >
                      <option value="">— เลือกคอร์ส —</option>
                      {studentCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.subject} • เริ่ม {formatThaiDate(course.start_date)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="form-row">
                <div className="field">
                  <label className="field-label" htmlFor="extra-date">
                    วันที่สอน <span className="field-required">*</span>
                  </label>
                  <input
                    id="extra-date"
                    className="input"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    disabled={busy}
                  />
                  {date && <p className="field-hint">{formatThaiDate(date)}</p>}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="extra-start">
                    เวลาเริ่ม <span className="field-required">*</span>
                  </label>
                  <TimeInput
                    id="extra-start"
                    value={startTime}
                    onChange={setStartTime}
                    disabled={busy}
                    ariaLabel="เวลาเริ่ม"
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="extra-end">
                    เวลาจบ <span className="field-required">*</span>
                  </label>
                  <TimeInput
                    id="extra-end"
                    value={endTime}
                    onChange={setEndTime}
                    disabled={busy}
                    ariaLabel="เวลาจบ"
                  />
                </div>
              </div>

              <div className="inline-note">
                <Icon name="clock" size={16} />
                ระยะเวลา {formatDuration(timeToMinutes(endTime) - timeToMinutes(startTime), 'short')}
                {selectedStudent && (
                  <>
                    {' '}• สีนักเรียน
                    <span
                      className="inline-color-dot"
                      style={{ backgroundColor: selectedStudent.color_hex }}
                    />
                  </>
                )}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="extra-note">
                  เนื้อหาของครั้งนี้ <span className="field-required">*</span>
                </label>
                <textarea
                  id="extra-note"
                  className="input textarea"
                  rows={3}
                  placeholder="เช่น ทบทวนบทที่ 3 และทำแบบฝึกหัดชุด A"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={busy}
                />
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
                    <span>ยังเพิ่มได้ แต่จะมีการยืนยันอีกครั้ง</span>
                  </div>
                </div>
              )}

              {selectedCourse && (
                <div className="extra-preview">
                  <span className="extra-preview-label">นัดที่จะเพิ่ม</span>
                  <div
                    className="extra-preview-bar"
                    style={{
                      backgroundColor: `${selectedStudent?.color_hex}33`,
                      borderLeftColor: selectedStudent?.color_hex,
                    }}
                  >
                    <span>{startTime}</span>
                    <strong>{selectedStudent?.nickname}</strong>
                    <Badge tone="peach">นอกรอบ</Badge>
                  </div>
                </div>
              )}
            </>
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
        title="ยืนยันเพิ่มนัดที่มีเวลาซ้อน?"
        description={`เวลานี้ซ้อนกับ ${conflicts.length} นัด ระบบอนุญาตให้บันทึก แต่ควรตรวจสอบตารางอีกครั้ง`}
        confirmLabel="ยืนยันเพิ่มนัด"
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
