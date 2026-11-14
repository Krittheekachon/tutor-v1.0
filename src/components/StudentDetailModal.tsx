import { useMemo, useState } from 'react'
import { archiveStudent, deleteStudent, restoreStudent } from '../lib/api'
import { calculateStudentStats } from '../lib/calc'
import {
  formatBaht,
  formatDuration,
  formatPercent,
  formatScheduleList,
  formatThaiDate,
  todayKey,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import type { Student } from '../lib/types'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Icon,
  Modal,
  ProgressBar,
  useToast,
} from './ui'

export function StudentDetailModal({
  student,
  onClose,
  onEditStudent,
  onAddCourse,
  onOpenCourse,
}: {
  student: Student
  onClose: () => void
  onEditStudent: () => void
  onAddCourse: () => void
  onOpenCourse: (courseId: string) => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null)

  const courses = useMemo(
    () =>
      (data?.courses ?? [])
        .filter((course) => course.student_id === student.id)
        .sort((a, b) => {
          if (Boolean(a.archived_at) !== Boolean(b.archived_at)) return a.archived_at ? 1 : -1
          return b.start_date.localeCompare(a.start_date)
        }),
    [data, student.id],
  )

  const relevantCourses = useMemo(
    () => (student.archived_at ? courses : courses.filter((course) => !course.archived_at)),
    [courses, student.archived_at],
  )
  const activeCourseIds = useMemo(
    () => new Set(relevantCourses.map((course) => course.id)),
    [relevantCourses],
  )
  const activeRules = useMemo(
    () =>
      (data?.rules ?? []).filter(
        (rule) => activeCourseIds.has(rule.course_id) && rule.active,
      ),
    [data, activeCourseIds],
  )
  const stats = useMemo(
    () =>
      calculateStudentStats(
        relevantCourses,
        data?.logs ?? [],
        data?.sessions ?? [],
        data?.payments ?? [],
      ),
    [relevantCourses, data],
  )

  const allCourseIds = courses.map((course) => course.id)
  const hasHistory =
    (data?.logs ?? []).some((log) => allCourseIds.includes(log.course_id)) ||
    (data?.payments ?? []).some((payment) => allCourseIds.includes(payment.course_id))

  if (!data) return null

  async function handleArchive() {
    setBusy(true)
    try {
      await archiveStudent(student.id)
      const refreshed = await refresh()
      pushToast(
        refreshed
          ? 'เก็บนักเรียนเข้าคลังแล้ว ประวัติยังเปิดดูได้'
          : 'เก็บเข้าคลังแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmAction(null)
      onClose()
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    setBusy(true)
    try {
      await restoreStudent(student.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'นำนักเรียนกลับจากคลังแล้ว' : 'นำกลับแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      await deleteStudent(student.id, allCourseIds)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ลบข้อมูลนักเรียนแล้ว' : 'ลบแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmAction(null)
      onClose()
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={student.nickname}
        subtitle={`${courses.length} คอร์ส • เพิ่มเมื่อ ${formatThaiDate(todayKey(new Date(student.created_at)))}`}
        icon="user"
        size="wide"
        busy={busy}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              ปิด
            </Button>
            <Button variant="secondary" icon="edit" onClick={onEditStudent} disabled={busy}>
              แก้ไขข้อมูล
            </Button>
          </>
        }
      >
        <div className="student-profile">
          <span
            className="student-avatar"
            style={{ backgroundColor: `${student.color_hex}55`, color: '#503542' }}
          >
            {student.nickname.charAt(0)}
          </span>
          <div className="student-profile-copy">
            <div className="student-profile-title">
              <h3>{student.nickname}</h3>
              <span
                className="student-color-chip"
                style={{ backgroundColor: student.color_hex }}
              />
              {student.archived_at && <Badge tone="gray">อยู่ในคลัง</Badge>}
            </div>
            <p>
              {activeRules.length > 0
                ? formatScheduleList(activeRules)
                : 'ยังไม่ได้ตั้งตารางประจำ'}
            </p>
          </div>
        </div>

        <div className="student-stats-grid">
          <div className="mini-stat stat-pink">
            <span>ชั่วโมงสะสม</span>
            <strong>{formatDuration(stats.actualMinutes, 'short')}</strong>
            <small>จาก {formatDuration(stats.purchasedMinutes, 'short')}</small>
          </div>
          <div className="mini-stat stat-blue">
            <span>ชั่วโมงคงเหลือ</span>
            <strong>{formatDuration(stats.remainingMinutes, 'short')}</strong>
            <small>
              {stats.overMinutes > 0
                ? `เกิน ${formatDuration(stats.overMinutes, 'short')}`
                : 'ต่ำสุด 0 นาที'}
            </small>
          </div>
          <div className="mini-stat stat-green">
            <span>ความคืบหน้า</span>
            <strong>{formatPercent(stats.progressPct)}</strong>
            <ProgressBar value={stats.progressPct} />
          </div>
          <div className="mini-stat stat-peach">
            <span>วันจบโดยประมาณ</span>
            <strong className="mini-stat-date">
              {stats.completionDate || stats.estimatedEndDate
                ? formatThaiDate((stats.completionDate ?? stats.estimatedEndDate) as string)
                : 'ยังประเมินไม่ได้'}
            </strong>
            <small>
              {stats.completionDate
                ? 'สอนครบตามเวลาที่ซื้อแล้ว'
                : stats.estimatedEndDate
                  ? 'จากตารางนัดในอนาคต'
                  : stats.estimateShortfallMinutes > 0
                    ? `ต้องนัดเพิ่ม ${formatDuration(stats.estimateShortfallMinutes, 'short')}`
                    : 'ยังประเมินไม่ได้'}
            </small>
          </div>
        </div>

        <div className="section-row">
          <div>
            <h3 className="subheading">คอร์สของนักเรียน</h3>
            <p className="subheading-note">แต่ละคอร์สมีชั่วโมง ค่าเรียน และวันจบแยกกัน</p>
          </div>
          <Button
            variant="soft"
            size="sm"
            icon="plus"
            onClick={onAddCourse}
            disabled={Boolean(student.archived_at) || busy}
          >
            เพิ่มคอร์ส
          </Button>
        </div>

        {student.archived_at && (
          <div className="inline-note">
            <Icon name="archive" size={16} />
            นักเรียนอยู่ในคลัง ต้องนำกลับจากคลังก่อนจึงจะเพิ่มคอร์สใหม่ได้
          </div>
        )}

        {courses.length === 0 ? (
          <EmptyState
            compact
            title="ยังไม่มีคอร์ส"
            description="เพิ่มคอร์สแรกเพื่อเริ่มติดตามชั่วโมงและวันจบ"
            action={
              <Button
                variant="soft"
                icon="plus"
                onClick={onAddCourse}
                disabled={Boolean(student.archived_at)}
              >
                เพิ่มคอร์สแรก
              </Button>
            }
          />
        ) : (
          <div className="student-course-list">
            {courses.map((course) => {
              const courseStats = calculateStudentStats(
                [course],
                data.logs,
                data.sessions,
                data.payments,
                new Date(),
              )
              const courseRuleList = data.rules.filter(
                (rule) => rule.course_id === course.id && rule.active,
              )
              const attachmentCount = data.attachments.filter(
                (attachment) => attachment.course_id === course.id,
              ).length
              return (
                <article
                  key={course.id}
                  className={`student-course-card ${course.archived_at ? 'is-archived' : ''}`}
                  style={{ borderLeftColor: student.color_hex }}
                >
                  <div className="course-card-head">
                    <div>
                      <div className="course-card-title">
                        <h4>{course.subject}</h4>
                        {course.archived_at && <Badge tone="gray">ในคลัง</Badge>}
                        {courseStats.completionDate && <Badge tone="green">สอนครบ</Badge>}
                      </div>
                      <p>
                        เริ่ม {formatThaiDate(course.start_date)} •{' '}
                        {courseRuleList.length > 0
                          ? formatScheduleList(courseRuleList)
                          : 'ยังไม่ตั้งตาราง'}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenCourse(course.id)}>
                      เปิดคอร์ส
                      <Icon name="chevron-right" size={16} />
                    </Button>
                  </div>

                  <div className="course-card-progress">
                    <div className="course-progress-label">
                      <span>
                        {formatDuration(courseStats.actualMinutes, 'short')} /{' '}
                        {formatDuration(course.purchased_minutes, 'short')}
                      </span>
                      <strong>{formatPercent(courseStats.progressPct)}</strong>
                    </div>
                    <ProgressBar value={courseStats.progressPct} />
                  </div>

                  <div className="course-card-meta">
                    <span>
                      <Icon name="wallet" size={15} />
                      {formatBaht(Number(course.price_baht))}
                    </span>
                    <span>
                      <Icon name="clock" size={15} />
                      เหลือ {formatDuration(courseStats.remainingMinutes, 'short')}
                    </span>
                    <span>
                      <Icon name="calendar" size={15} />
                      {courseStats.completionDate
                        ? `จบ ${formatThaiDate(courseStats.completionDate)}`
                        : courseStats.estimatedEndDate
                          ? `คาดว่าจบ ${formatThaiDate(courseStats.estimatedEndDate)}`
                          : 'ยังประเมินไม่ได้'}
                    </span>
                    {attachmentCount > 0 && (
                      <span>
                        <Icon name="attachment" size={15} />
                        {attachmentCount} ไฟล์
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="student-admin-zone">
          <div>
            <h3 className="subheading">จัดการนักเรียน</h3>
            <p className="subheading-note">
              ถ้ามีประวัติการสอนหรือการรับเงินแล้ว ให้เก็บเข้าคลังแทนการลบ
            </p>
          </div>
          <div className="student-admin-actions">
            {student.archived_at ? (
              <Button variant="soft" icon="restore" onClick={() => void handleRestore()} loading={busy}>
                นำกลับจากคลัง
              </Button>
            ) : (
              <Button
                variant="ghost"
                icon="archive"
                onClick={() => setConfirmAction('archive')}
                disabled={busy}
              >
                เก็บเข้าคลัง
              </Button>
            )}
            {!hasHistory && (
              <Button
                variant="ghost"
                className="danger-text"
                icon="trash"
                onClick={() => setConfirmAction('delete')}
                disabled={busy}
              >
                ลบข้อมูลถาวร
              </Button>
            )}
          </div>
          {hasHistory && (
            <p className="admin-hint">
              <Icon name="alert" size={15} />
              พบประวัติการสอนหรือรายการรับเงิน จึงปิดการลบถาวรไว้ เพื่อไม่ให้ประวัติหาย
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmAction === 'archive'}
        title="เก็บนักเรียนเข้าคลัง?"
        description="นักเรียนและคอร์สจะถูกซ่อนจากรายการและตารางนัดในอนาคต แต่ประวัติการสอน ไฟล์แนบ และการรับเงินยังเปิดดูได้จากคลัง"
        confirmLabel="เก็บเข้าคลัง"
        tone="warning"
        busy={busy}
        onConfirm={() => void handleArchive()}
        onClose={() => {
          if (!busy) setConfirmAction(null)
        }}
      />

      <ConfirmDialog
        open={confirmAction === 'delete'}
        title="ลบข้อมูลนักเรียนถาวร?"
        description="นักเรียน คอร์ส ตารางนัด และไฟล์แนบทั้งหมดจะถูกลบถาวรและกู้คืนไม่ได้"
        confirmLabel="ลบถาวร"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onClose={() => {
          if (!busy) setConfirmAction(null)
        }}
      />
    </>
  )
}
