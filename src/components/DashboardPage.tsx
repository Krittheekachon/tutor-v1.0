import { attachmentSessionId } from '../lib/attachments'
import { useMemo, useState } from 'react'
import { cancelSession, restoreSession } from '../lib/api'
import { calculateCourseStats } from '../lib/calc'
import { hexToRgba } from '../lib/color'
import {
  CALENDAR_WEEKDAY_HEADERS,
  addMonthsKey,
  calendarGridDays,
  formatDuration,
  formatMonthTitle,
  formatThaiDateLong,
  formatTimeRange,
  isSameMonth,
  sessionDurationMinutes,
  sessionEndInstant,
  todayKey,
  weekdayFromDateKey,
  yearMonthFromKey,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { groupSessionsByDate, sortSessionsByTime } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { Attachment, Course, LessonLog, Session, Student } from '../lib/types'
import {
  Badge,
  Bow,
  Button,
  ConfirmDialog,
  Icon,
  ProgressBar,
  ShortcutLinks,
  useMediaQuery,
  useNow,
  useToast,
} from './ui'
import { ExtraSessionModal } from './ExtraSessionModal'
import { LessonModal } from './LessonModal'
import { MoveSessionModal } from './MoveSessionModal'
import { SessionNoteModal } from './SessionNoteModal'
import { AttachmentButton } from './AttachmentButton'
import { LessonSummaryModal } from './LessonSummaryModal'

interface SessionView {
  session: Session
  course: Course
  student: Student
  log: LessonLog | null
  attachments: Attachment[]
  actualMinutes: number
  purchasedMinutes: number
  remainingMinutes: number
  progressPct: number
}

export function DashboardPage({
  onGoToStudents,
  displayName,
}: {
  onGoToStudents: () => void
  displayName: string
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const now = useNow(30_000)
  const isMobile = useMediaQuery('(max-width: 700px)')
  const today = todayKey(now)
  const [selectedDate, setSelectedDate] = useState(today)
  const [extraOpen, setExtraOpen] = useState(false)
  const [lessonSessionId, setLessonSessionId] = useState<string | null>(null)
  const [moveSessionId, setMoveSessionId] = useState<string | null>(null)
  const [noteSessionId, setNoteSessionId] = useState<string | null>(null)
  const [summarySessionId, setSummarySessionId] = useState<string | null>(null)
  const [cancelSessionTarget, setCancelSessionTarget] = useState<Session | null>(null)
  const [canceling, setCanceling] = useState(false)

  const maxEvents = isMobile ? 2 : 3

  const studentById = useMemo(
    () => new Map((data?.students ?? []).map((student) => [student.id, student])),
    [data],
  )
  const courseById = useMemo(
    () => new Map((data?.courses ?? []).map((course) => [course.id, course])),
    [data],
  )
  const logBySession = useMemo(
    () => new Map((data?.logs ?? []).map((log) => [log.session_id, log])),
    [data],
  )
  const attachmentsByCourse = useMemo(() => {
    const map = new Map<string, Attachment[]>()
    for (const attachment of data?.attachments ?? []) {
      const list = map.get(attachment.course_id) ?? []
      list.push(attachment)
      map.set(attachment.course_id, list)
    }
    return map
  }, [data])
  const statsByCourse = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateCourseStats>>()
    if (!data) return map
    for (const course of data.courses) {
      map.set(
        course.id,
        calculateCourseStats(course, data.logs, data.sessions, data.payments, now),
      )
    }
    return map
  }, [data, now])

  const visibleSessions = useMemo(() => {
    if (!data) return []
    return data.sessions.filter((session) => {
      const course = courseById.get(session.course_id)
      const student = course ? studentById.get(course.student_id) : null
      if (!course || !student) return false
      const isFuture = sessionEndInstant(session.session_date, session.end_time).getTime() > now.getTime()
      if (isFuture && (course.archived_at || student.archived_at)) return false
      return true
    })
  }, [data, courseById, studentById, now])

  const sessionsByDate = useMemo(() => groupSessionsByDate(visibleSessions), [visibleSessions])
  const view = yearMonthFromKey(selectedDate)
  const gridDays = useMemo(() => calendarGridDays(view.year, view.monthIndex), [view.year, view.monthIndex])
  const monthSessions = useMemo(
    () =>
      visibleSessions.filter(
        (session) =>
          isSameMonth(session.session_date, view.year, view.monthIndex) &&
          session.status !== 'canceled',
      ),
    [visibleSessions, view.year, view.monthIndex],
  )
  const monthTaughtCount = monthSessions.filter((session) => logBySession.has(session.id)).length
  const monthActualMinutes = monthSessions.reduce(
    (total, session) => total + (logBySession.get(session.id)?.actual_minutes ?? 0),
    0,
  )
  const todaySessions = (sessionsByDate.get(today) ?? []).filter(
    (session) => session.status !== 'canceled',
  )

  const selectedSessions = sessionsByDate.get(selectedDate) ?? []
  const selectedActiveSessions = selectedSessions.filter((session) => session.status !== 'canceled')
  const selectedPlannedMinutes = selectedActiveSessions.reduce(
    (total, session) => total + sessionDurationMinutes(session.start_time, session.end_time),
    0,
  )

  const sessionViews = useMemo<SessionView[]>(() => {
    return sortSessionsByTime(selectedSessions)
      .map((session) => {
        const course = courseById.get(session.course_id)
        const student = course ? studentById.get(course.student_id) : null
        if (!course || !student) return null
        const stats = statsByCourse.get(course.id)
        return {
          session,
          course,
          student,
          log: logBySession.get(session.id) ?? null,
          attachments: (attachmentsByCourse.get(course.id) ?? []).filter(file => !attachmentSessionId(file) || attachmentSessionId(file) === session.id),
          actualMinutes: stats?.actualMinutes ?? 0,
          purchasedMinutes: course.purchased_minutes,
          remainingMinutes: stats?.remainingMinutes ?? course.purchased_minutes,
          progressPct: stats?.progressPct ?? 0,
        }
      })
      .filter((item): item is SessionView => item !== null)
  }, [selectedSessions, courseById, studentById, statsByCourse, logBySession, attachmentsByCourse])

  const activeCourseCount = data?.courses.filter((course) => !course.archived_at).length ?? 0
  const activeStudentCount = data?.students.filter((student) => !student.archived_at).length ?? 0
  const hasAnyStudents = activeStudentCount > 0
  const hasSchedule = activeCourseCount > 0

  const lessonView = lessonSessionId
    ? sessionViews.find((item) => item.session.id === lessonSessionId) ?? null
    : null
  const moveView = moveSessionId
    ? sessionViews.find((item) => item.session.id === moveSessionId) ?? null
    : null
  const noteView = noteSessionId
    ? sessionViews.find((item) => item.session.id === noteSessionId) ?? null
    : null

  function goMonth(offset: number) {
    setSelectedDate((current) => addMonthsKey(current, offset))
  }

  function goToday() {
    setSelectedDate(today)
  }

  function selectDate(date: string) {
    setSelectedDate(date)
  }

  async function handleCancel() {
    if (!cancelSessionTarget) return
    setCanceling(true)
    try {
      await cancelSession(cancelSessionTarget.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ยกเลิกนัดครั้งนี้แล้ว' : 'ยกเลิกนัดแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setCancelSessionTarget(null)
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setCanceling(false)
    }
  }

  async function handleRestore(session: Session) {
    try {
      await restoreSession(session)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'คืนสถานะนัดแล้ว' : 'คืนสถานะแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    }
  }

  if (!data) return null

  return (
    <div className="page dashboard-page">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <span className="eyebrow" title={displayName}>
            <span className="eyebrow-bow">
              <Bow size={17} />
            </span>
            <span className="hero-owner-name">สวัสดี {displayName}</span>
          </span>
          <h1>{formatThaiDateLong(today)}</h1>
          <p>
            {todaySessions.length > 0
              ? `วันนี้มี ${todaySessions.length} นัด • สอนแล้ว ${todaySessions.filter((item) => logBySession.has(item.id)).length} นัด`
              : 'วันนี้ยังไม่มีนัด พักดื่มน้ำอุ่น ๆ ก่อนนะ'}
          </p>
          <div className="hero-chips">
            <span className="hero-chip chip-pink">
              <Icon name="users" size={15} /> {activeStudentCount} นักเรียน
            </span>
            <span className="hero-chip chip-blue">
              <Icon name="book" size={15} /> {activeCourseCount} คอร์ส
            </span>
            <span className="hero-chip chip-green">
              <Icon name="clock" size={15} /> {monthSessions.length} นัดเดือนนี้
            </span>
          </div>
        </div>
        <div className="hero-actions">
          <Button icon="calendar-plus" onClick={() => setExtraOpen(true)} disabled={!hasSchedule}>
            เพิ่มนัดนอกรอบ
          </Button>
          <Button variant="secondary" icon="users" onClick={onGoToStudents}>
            จัดการนักเรียน
          </Button>
          <ShortcutLinks />
        </div>
        <span className="hero-bow" aria-hidden="true">
          <Bow size={86} />
        </span>
      </section>

      {!hasAnyStudents && (
        <div className="onboarding-strip">
          <span className="onboarding-icon">
            <Bow size={34} />
          </span>
          <div>
            <strong>เริ่มต้นด้วยนักเรียนคนแรก</strong>
            <p>เพิ่มชื่อ วิชา เวลาที่ซื้อ และตารางประจำ แล้วปฏิทินจะเริ่มขึ้นให้เอง</p>
          </div>
          <Button variant="soft" icon="plus" onClick={onGoToStudents}>
            ไปเพิ่มนักเรียน
          </Button>
        </div>
      )}

      <section className="calendar-card" aria-labelledby="calendar-title">
        <div className="calendar-toolbar">
          <div className="calendar-title-wrap">
            <span className="calendar-mini-icon">
              <Icon name="calendar" size={20} />
            </span>
            <div>
              <h2 id="calendar-title">{formatMonthTitle(view.year, view.monthIndex)}</h2>
              <p>
                {monthSessions.length} นัด • สอนแล้ว {monthTaughtCount} นัด
                {monthActualMinutes > 0 ? ` • ${formatDuration(monthActualMinutes, 'short')}` : ''}
              </p>
            </div>
          </div>
          <div className="calendar-nav">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={() => goMonth(-1)}
              aria-label="เดือนก่อนหน้า"
            >
              <Icon name="chevron-left" size={19} />
            </button>
            <button type="button" className="today-button" onClick={goToday}>
              วันนี้
            </button>
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={() => goMonth(1)}
              aria-label="เดือนถัดไป"
            >
              <Icon name="chevron-right" size={19} />
            </button>
          </div>
        </div>

        <div className="calendar-scroll">
          <div className="calendar-weekdays" aria-hidden="true">
            {CALENDAR_WEEKDAY_HEADERS.map((label, index) => (
              <span key={label} className={index === 0 || index === 6 ? 'is-weekend' : ''}>
                {label}
              </span>
            ))}
          </div>
          <div className="calendar-grid" role="grid" aria-label={formatMonthTitle(view.year, view.monthIndex)}>
            {gridDays.map((date) => {
              const daySessions = sessionsByDate.get(date) ?? []
              const dayNumber = Number(date.slice(8, 10))
              const inMonth = isSameMonth(date, view.year, view.monthIndex)
              const isToday = date === today
              const isSelected = date === selectedDate
              const isWeekend = weekdayFromDateKey(date) >= 6
              const overflow = Math.max(0, daySessions.length - maxEvents)
              return (
                <div
                  key={date}
                  role="gridcell"
                  tabIndex={0}
                  aria-selected={isSelected}
                  aria-label={`${formatThaiDateLong(date)} ${daySessions.length} นัด`}
                  className={[
                    'calendar-day',
                    inMonth ? '' : 'is-outside',
                    isToday ? 'is-today' : '',
                    isSelected ? 'is-selected' : '',
                    isWeekend ? 'is-weekend' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDate(date)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      selectDate(date)
                    }
                  }}
                >
                  <div className="calendar-day-head">
                    <span className="calendar-day-number">{dayNumber}</span>
                    {isToday && <span className="today-label">วันนี้</span>}
                  </div>
                  <div className="calendar-events">
                    {daySessions.slice(0, maxEvents).map((session) => {
                      const course = courseById.get(session.course_id)
                      const student = course ? studentById.get(course.student_id) : null
                      if (!course || !student) return null
                      const isCanceled = session.status === 'canceled'
                      const isTaught = logBySession.has(session.id)
                      const statusLabel = isTaught ? 'สอนแล้ว' : isCanceled ? 'ยกเลิก' : 'ยังไม่ได้สอน'
                      const hasNote = session.note.trim().length > 0 || (data?.attachments ?? []).some(file => attachmentSessionId(file) === session.id)
                      return (
                        <button
                          key={session.id}
                          type="button"
                          className={`calendar-event ${isTaught ? 'is-taught' : isCanceled ? 'is-canceled' : ''} ${hasNote ? 'has-note' : ''}`}
                          style={{
                            backgroundColor: isCanceled ? '#f2ebee' : hexToRgba(student.color_hex, 0.46),
                            borderLeftColor: isCanceled ? '#c9b8c0' : student.color_hex,
                          }}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedDate(date)
                            if (isTaught) setSummarySessionId(session.id)
                            else setNoteSessionId(session.id)
                          }}
                          title={`${formatTimeRange(session.start_time, session.end_time)} ${student.nickname} • ${statusLabel} • ${isTaught ? 'ดูสรุปการสอน' : hasNote ? 'ดูโน้ต' : 'เพิ่มโน้ต'}`}
                          aria-label={`${student.nickname} ${formatTimeRange(session.start_time, session.end_time)} ${statusLabel} ${isTaught ? 'ดูสรุปการสอน' : hasNote ? 'ดูโน้ตของนัดนี้' : 'เพิ่มโน้ตของนัดนี้'}`}
                        >
                          <span className="calendar-event-time">{session.start_time.slice(0, 5)}</span>
                          <span className="calendar-event-name">{student.nickname}</span>
                          {hasNote && (
                            <span className="calendar-event-note" title="มีโน้ต" aria-label="มีโน้ต">
                              ✎
                            </span>
                          )}
                        </button>
                      )
                    })}
                    {overflow > 0 && <span className="calendar-more">+อีก {overflow} นัด</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="calendar-footnote">
          <span>
            <Icon name="clock" size={14} /> เวลาไทย 24 ชั่วโมง
          </span>
          <span className="calendar-legend">
            <i className="legend-dot legend-confirmed" /> นัดปกติ
            <i className="legend-dot legend-taught" /> สอนแล้ว
            <i className="legend-dot legend-canceled" /> ยกเลิก
            <span className="legend-note">✎</span> มีโน้ต
          </span>
        </div>
      </section>

      <section className="day-detail" aria-labelledby="day-detail-title">
        <div className="day-detail-head">
          <div>
            <span className="eyebrow">รายละเอียดนัด</span>
            <h2 id="day-detail-title">{formatThaiDateLong(selectedDate)}</h2>
            <p>
              {selectedActiveSessions.length > 0
                ? `${selectedActiveSessions.length} นัด • รวม ${formatDuration(selectedPlannedMinutes, 'short')}`
                : 'ยังไม่มีนัดในวันนี้'}
              {selectedSessions.length > selectedActiveSessions.length
                ? ` • ยกเลิก ${selectedSessions.length - selectedActiveSessions.length} นัด`
                : ''}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon="calendar-plus"
            onClick={() => setExtraOpen(true)}
            disabled={!hasSchedule}
          >
            เพิ่มนัดนอกรอบ
          </Button>
        </div>

        {sessionViews.length === 0 ? (
          <div className="day-empty">
            <Bow size={62} />
            <h3>วันนี้ยังว่างอยู่</h3>
            <p>
              {hasSchedule
                ? 'ไม่มีนัดในวันที่เลือก เพิ่มนัดนอกรอบได้ถ้ามีคลาสพิเศษ'
                : 'เพิ่มนักเรียนและตั้งตารางประจำก่อน แล้วนัดจะปรากฏบนปฏิทิน'}
            </p>
            <Button
              variant="soft"
              icon={hasSchedule ? 'calendar-plus' : 'plus'}
              onClick={hasSchedule ? () => setExtraOpen(true) : onGoToStudents}
            >
              {hasSchedule ? 'เพิ่มนัดนอกรอบ' : 'ไปเพิ่มนักเรียน'}
            </Button>
          </div>
        ) : (
          <div className="session-card-list">
            {sessionViews.map((viewItem) => (
              <SessionCard
                key={viewItem.session.id}
                viewItem={viewItem}
                now={now}
                onRecord={() => setLessonSessionId(viewItem.session.id)}
                onMove={() => setMoveSessionId(viewItem.session.id)}
                onCancel={() => setCancelSessionTarget(viewItem.session)}
                onRestore={() => void handleRestore(viewItem.session)}
                onNote={() => setNoteSessionId(viewItem.session.id)}
                onSummary={() => setSummarySessionId(viewItem.session.id)}
              />
            ))}
          </div>
        )}
      </section>

      <ExtraSessionModal
        open={extraOpen}
        onClose={() => setExtraOpen(false)}
        initialDate={selectedDate}
      />

      {lessonView && (
        <LessonModal
          open={Boolean(lessonSessionId)}
          session={lessonView.session}
          course={lessonView.course}
          student={lessonView.student}
          log={lessonView.log}
          onClose={() => setLessonSessionId(null)}
          onSummary={() => setSummarySessionId(lessonView.session.id)}
        />
      )}

      {moveView && (
        <MoveSessionModal
          open={Boolean(moveSessionId)}
          session={moveView.session}
          course={moveView.course}
          student={moveView.student}
          onClose={() => setMoveSessionId(null)}
        />
      )}

      <LessonSummaryModal sessionId={summarySessionId} onClose={() => setSummarySessionId(null)} />

      {noteView && (
        <SessionNoteModal
          open={Boolean(noteSessionId)}
          session={noteView.session}
          course={noteView.course}
          student={noteView.student}
          onClose={() => setNoteSessionId(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(cancelSessionTarget)}
        title="ยกเลิกนัดครั้งนี้?"
        description={
          cancelSessionTarget
            ? `นัดของ ${studentById.get(
                courseById.get(cancelSessionTarget.course_id)?.student_id ?? '',
              )?.nickname ?? 'นักเรียน'} ในวันที่ ${formatThaiDateLong(cancelSessionTarget.session_date)} จะถูกทำเครื่องหมายว่ายกเลิก และยังเปิดดูประวัติได้`
            : ''
        }
        confirmLabel="ยกเลิกนัด"
        tone="danger"
        busy={canceling}
        onConfirm={() => void handleCancel()}
        onClose={() => {
          if (!canceling) setCancelSessionTarget(null)
        }}
      />
    </div>
  )
}

function SessionCard({
  viewItem,
  now,
  onRecord,
  onMove,
  onCancel,
  onRestore,
  onNote,
  onSummary,
}: {
  viewItem: SessionView
  now: Date
  onRecord: () => void
  onMove: () => void
  onCancel: () => void
  onRestore: () => void
  onNote: () => void
  onSummary: () => void
}) {
  const { session, course, student, log, attachments, actualMinutes, purchasedMinutes, remainingMinutes, progressPct } =
    viewItem
  const isCanceled = session.status === 'canceled'
  const isMoved = session.status === 'moved'
  const isExtra = session.kind === 'extra'
  const isTaught = Boolean(log)
  const hasNote = session.note.trim().length > 0 || attachments.some(file => attachmentSessionId(file) === session.id)
  const plannedMinutes = sessionDurationMinutes(session.start_time, session.end_time)
  const isPast = sessionEndInstant(session.session_date, session.end_time).getTime() <= now.getTime()
  const originalChanged =
    session.session_date !== session.original_date ||
    session.start_time.slice(0, 5) !== session.original_start_time.slice(0, 5)

  return (
    <article
      className={[
        'session-card',
        isCanceled ? 'is-canceled' : '',
        isTaught ? 'is-taught' : '',
        isExtra ? 'is-extra' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ borderLeftColor: student.color_hex }}
    >
      <div className="session-time-block">
        <strong>{session.start_time.slice(0, 5)}</strong>
        <span>ถึง {session.end_time.slice(0, 5)}</span>
        <small>{formatDuration(plannedMinutes, 'short')}</small>
      </div>

      <div className="session-main">
        <div className="session-title-row">
          <div className="session-name-wrap">
            <span className="student-color-dot" style={{ backgroundColor: student.color_hex }} />
            <h3>{isTaught ? <button type="button" className="session-summary-name"
              onClick={onSummary} title="ดูสรุปการสอน">{student.nickname}</button> : student.nickname}</h3>
            <span className="session-subject">{course.subject}</span>
          </div>
          <div className="session-title-tools">
            <button
              type="button"
              className={`session-note-trigger ${hasNote ? 'has-note' : ''}`}
              onClick={onNote}
              title={hasNote ? 'แก้ไขโน้ตของนัดนี้' : 'เพิ่มโน้ตของนัดนี้'}
            >
              <Icon name="note" size={13} />
              <span>{hasNote ? 'มีโน้ต' : 'โน้ต'}</span>
            </button>
            <div className="session-badges">
              {isExtra && <Badge tone="peach">นอกรอบ</Badge>}
              {isTaught && (
                <Badge tone="green" dot>
                  สอนแล้ว
                </Badge>
              )}
              {isMoved && <Badge tone="purple">เลื่อนแล้ว</Badge>}
              {isCanceled && <Badge tone="gray">ยกเลิก</Badge>}
              {!isTaught && !isCanceled && isPast && <Badge tone="red">ยังไม่บันทึก</Badge>}
            </div>
          </div>
        </div>

        <div className="session-meta">
          <span>
            <Icon name="clock" size={15} />
            {formatTimeRange(session.start_time, session.end_time)} น.
          </span>
          {originalChanged && !isCanceled && (
            <span className="session-original">
              เดิม {formatThaiDateLong(session.original_date)} •{' '}
              {formatTimeRange(session.original_start_time, session.original_end_time)}
            </span>
          )}
        </div>

        {course.content ? (
          <p className="session-content">{course.content}</p>
        ) : !hasNote ? (
          <p className="session-content">ยังไม่ได้ระบุเนื้อหาที่วางไว้</p>
        ) : null}

        {hasNote && (
          <div className="session-note-box">
            <span className="session-note-icon">
              <Icon name="note" size={15} />
            </span>
            <div>
              <span className="session-note-label">โน้ตของนัดนี้</span>
              <p>{session.note}</p>
            </div>
            <button
              type="button"
              className="session-note-edit"
              onClick={onNote}
              aria-label="แก้ไขโน้ต"
            >
              <Icon name="edit" size={14} />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="session-attachments">
            <span className="attachment-label">
              <Icon name="attachment" size={15} /> ไฟล์แนบ
            </span>
            <div className="attachment-list">
              {attachments.map((attachment) => (
                <AttachmentButton key={attachment.id} attachment={attachment} />
              ))}
            </div>
          </div>
        )}

        {isTaught && log && (
          <div className="taught-summary">
            <div className="taught-numbers">
              <span>
                สอนจริง <strong>{formatDuration(log.actual_minutes)}</strong>
              </span>
              <span>
                สะสม <strong>{formatDuration(actualMinutes)}</strong> / {formatDuration(purchasedMinutes)}
              </span>
              <span>
                {remainingMinutes > 0
                  ? `เหลือ ${formatDuration(remainingMinutes)}`
                  : actualMinutes > purchasedMinutes
                    ? `สอนครบแล้ว • เกิน ${formatDuration(actualMinutes - purchasedMinutes)}`
                    : 'สอนครบแล้ว'}
              </span>
            </div>
            <ProgressBar value={progressPct} label={`ความคืบหน้าคอร์ส ${course.subject}`} />
          </div>
        )}

        {isCanceled && (
          <p className="canceled-note">
            นัดนี้ถูกยกเลิกและไม่ถูกนับในชั่วโมงคงเหลือหรือวันจบโดยประมาณ
          </p>
        )}
      </div>

      <div className="session-actions">
        {isTaught ? (
          <>
          <Button variant="soft" size="sm" icon="document" onClick={onSummary}>
            สรุปการสอน
          </Button>
          <Button variant="soft" size="sm" icon="edit" onClick={onRecord}>
            แก้ไขบันทึก
          </Button>
          </>
        ) : isCanceled ? (
          <Button variant="soft" size="sm" icon="restore" onClick={onRestore}>
            คืนสถานะนัด
          </Button>
        ) : (
          <>
            <Button size="sm" icon="check" onClick={onRecord}>
              บันทึกหลังสอน
            </Button>
            <Button variant="ghost" size="sm" icon="calendar" onClick={onMove}>
              เลื่อนนัดครั้งนี้
            </Button>
            <Button variant="ghost" size="sm" icon="x" className="danger-text" onClick={onCancel}>
              ยกเลิกนัดครั้งนี้
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
