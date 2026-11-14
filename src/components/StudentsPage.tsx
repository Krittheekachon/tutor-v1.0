import { useMemo, useState } from 'react'
import { calculateStudentStats } from '../lib/calc'
import {
  formatDuration,
  formatPercent,
  formatScheduleList,
  formatThaiDate,
} from '../lib/date'
import { useAppData } from '../state/AppDataContext'
import type { ScheduleRule, Student } from '../lib/types'
import { StudentDetailModal } from './StudentDetailModal'
import { StudentFormModal } from './StudentFormModal'
import { CourseFormModal } from './CourseFormModal'
import { CourseDetailModal } from './CourseDetailModal'
import {
  Badge,
  Bow,
  Button,
  EmptyState,
  Icon,
  ProgressBar,
  SectionHeading,
  useMediaQuery,
} from './ui'

interface StudentRow {
  student: Student
  subjects: string[]
  schedule: string
  rules: ScheduleRule[]
  stats: ReturnType<typeof calculateStudentStats>
  endDate: string | null
  endLabel: string
  courseCount: number
}

export function StudentsPage() {
  const { data } = useAppData()
  const isMobile = useMediaQuery('(max-width: 860px)')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [addCourseForStudentId, setAddCourseForStudentId] = useState<string | null>(null)

  const rows = useMemo<StudentRow[]>(() => {
    if (!data) return []
    return data.students
      .filter((student) => Boolean(student.archived_at) === showArchived)
      .map((student) => {
        const allCourses = data.courses.filter((course) => course.student_id === student.id)
        const relevantCourses = student.archived_at
          ? allCourses
          : allCourses.filter((course) => !course.archived_at)
        const courseIds = new Set(relevantCourses.map((course) => course.id))
        const rules = data.rules.filter((rule) => courseIds.has(rule.course_id) && rule.active)
        const stats = calculateStudentStats(
          relevantCourses,
          data.logs,
          data.sessions,
          data.payments,
        )
        const subjects = [...new Set(relevantCourses.map((course) => course.subject))]
        const endDate = stats.completionDate ?? stats.estimatedEndDate
        return {
          student,
          subjects,
          schedule: formatScheduleList(rules),
          rules,
          stats,
          endDate,
          endLabel: endDate ? formatThaiDate(endDate) : 'ยังประเมินไม่ได้',
          courseCount: relevantCourses.length,
        }
      })
      .filter((row) => {
        const query = search.trim().toLowerCase()
        return query.length === 0 || row.student.nickname.toLowerCase().includes(query)
      })
      .sort((a, b) => a.student.nickname.localeCompare(b.student.nickname, 'th'))
  }, [data, showArchived, search])

  if (!data) return null

  const activeCount = data.students.filter((student) => !student.archived_at).length
  const archivedCount = data.students.filter((student) => student.archived_at).length
  const selectedStudent = data.students.find((student) => student.id === selectedStudentId) ?? null
  const editStudent = data.students.find((student) => student.id === editStudentId) ?? null
  const addCourseStudent =
    data.students.find((student) => student.id === addCourseForStudentId) ?? null
  const totalLearningMinutes = rows.reduce((total, row) => total + row.stats.actualMinutes, 0)

  function closeStudent() {
    setSelectedStudentId(null)
    setSelectedCourseId(null)
    setEditStudentId(null)
    setAddCourseForStudentId(null)
  }

  return (
    <div className="page students-page">
      <SectionHeading
        eyebrow="รายชื่อนักเรียน"
        title="นักเรียนของฉัน"
        description="ดูชั่วโมงคงเหลือ ความคืบหน้า และวันจบของแต่ละคอร์สในที่เดียว"
        actions={
          <Button icon="plus" onClick={() => setAddStudentOpen(true)}>
            เพิ่มนักเรียน
          </Button>
        }
      />

      <div className="students-summary">
        <div className="students-summary-item">
          <span className="summary-icon summary-pink">
            <Icon name="users" size={19} />
          </span>
          <div>
            <strong>{activeCount}</strong>
            <span>นักเรียนที่กำลังเรียน</span>
          </div>
        </div>
        <div className="students-summary-item">
          <span className="summary-icon summary-blue">
            <Icon name="clock" size={19} />
          </span>
          <div>
            <strong>{formatDuration(totalLearningMinutes, 'short')}</strong>
            <span>ชั่วโมงสะสมในมุมมองนี้</span>
          </div>
        </div>
        <div className="students-summary-item">
          <span className="summary-icon summary-green">
            <Icon name="archive" size={19} />
          </span>
          <div>
            <strong>{archivedCount}</strong>
            <span>นักเรียนในคลัง</span>
          </div>
        </div>
      </div>

      <div className="students-toolbar">
        <div className="segment-toggle" role="tablist" aria-label="มุมมองรายชื่อ">
          <button
            type="button"
            role="tab"
            aria-selected={!showArchived}
            className={!showArchived ? 'is-active' : ''}
            onClick={() => setShowArchived(false)}
          >
            กำลังเรียน
            <span className="segment-count">{activeCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showArchived}
            className={showArchived ? 'is-active' : ''}
            onClick={() => setShowArchived(true)}
          >
            คลัง
            <span className="segment-count">{archivedCount}</span>
          </button>
        </div>

        <div className="search-input-wrap students-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            className="input search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ค้นหาชื่อเล่นนักเรียน…"
            aria-label="ค้นหาชื่อนักเรียน"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearch('')}
              aria-label="ล้างคำค้นหา"
            >
              <Icon name="x" size={15} />
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="students-empty-card">
          <EmptyState
            title={
              search
                ? 'ไม่พบนักเรียนที่ค้นหา'
                : showArchived
                  ? 'คลังยังว่างอยู่'
                  : 'ยังไม่มีนักเรียนในตารางสอน'
            }
            description={
              search
                ? 'ลองพิมพ์ชื่อเล่นให้สั้นลง หรือล้างคำค้นหาแล้วดูรายชื่อทั้งหมด'
                : showArchived
                  ? 'นักเรียนที่เก็บเข้าคลังจะมาอยู่ที่นี่ พร้อมประวัติที่เปิดดูได้'
                  : 'เพิ่มนักเรียนคนแรก แล้วคอร์สและตารางประจำจะเริ่มต้นที่นี่'
            }
            action={
              search ? (
                <Button variant="soft" icon="x" onClick={() => setSearch('')}>
                  ล้างคำค้นหา
                </Button>
              ) : showArchived ? (
                <Button variant="soft" icon="arrow-left" onClick={() => setShowArchived(false)}>
                  กลับไปรายชื่อที่กำลังเรียน
                </Button>
              ) : (
                <Button icon="plus" onClick={() => setAddStudentOpen(true)}>
                  เพิ่มนักเรียนคนแรก
                </Button>
              )
            }
          />
        </div>
      ) : isMobile ? (
        <div className="student-card-grid">
          {rows.map((row) => (
            <StudentMobileCard
              key={row.student.id}
              row={row}
              onOpen={() => setSelectedStudentId(row.student.id)}
            />
          ))}
        </div>
      ) : (
        <div className="students-table-card">
          <table className="students-table">
            <thead>
              <tr>
                <th>นักเรียน</th>
                <th>วิชา</th>
                <th>ตารางประจำ</th>
                <th>ชั่วโมงสะสม</th>
                <th>คงเหลือ</th>
                <th>ความคืบหน้า</th>
                <th>วันจบโดยประมาณ</th>
                <th aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id} onClick={() => setSelectedStudentId(row.student.id)}>
                  <td>
                    <div className="table-student">
                      <span
                        className="table-avatar"
                        style={{ backgroundColor: `${row.student.color_hex}66` }}
                      >
                        {row.student.nickname.charAt(0)}
                      </span>
                      <div>
                        <strong>{row.student.nickname}</strong>
                        <span>
                          {row.courseCount} คอร์ส
                          {row.student.archived_at ? ' • ในคลัง' : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="subject-tag-list">
                      {row.subjects.length > 0 ? (
                        row.subjects.slice(0, 2).map((subject) => (
                          <span className="subject-tag" key={subject}>
                            {subject}
                          </span>
                        ))
                      ) : (
                        <span className="muted-cell">ยังไม่มีคอร์ส</span>
                      )}
                      {row.subjects.length > 2 && (
                        <span className="subject-more">+{row.subjects.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="schedule-cell" title={row.schedule}>
                      {row.schedule}
                    </span>
                  </td>
                  <td>
                    <div className="number-cell">
                      <strong>{formatDuration(row.stats.actualMinutes, 'short')}</strong>
                      <span>จาก {formatDuration(row.stats.purchasedMinutes, 'short')}</span>
                    </div>
                  </td>
                  <td>
                    <div className="number-cell">
                      <strong>{formatDuration(row.stats.remainingMinutes, 'short')}</strong>
                      {row.stats.overMinutes > 0 && (
                        <span className="over-time">เกิน {formatDuration(row.stats.overMinutes, 'short')}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="progress-cell">
                      <span>{formatPercent(row.stats.progressPct)}</span>
                      <ProgressBar value={row.stats.progressPct} />
                    </div>
                  </td>
                  <td>
                    <div className="end-date-cell">
                      <span>{row.endLabel}</span>
                      {row.stats.completionDate ? (
                        <Badge tone="green">สอนครบ</Badge>
                      ) : row.endDate ? (
                        <Badge tone="blue">ประมาณการ</Badge>
                      ) : (
                        <Badge tone="gray">ยังประเมินไม่ได้</Badge>
                      )}
                      {!row.endDate && row.stats.estimateShortfallMinutes > 0 && (
                        <span className="end-shortfall">
                          ต้องนัดเพิ่ม {formatDuration(row.stats.estimateShortfallMinutes, 'short')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="row-open-button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedStudentId(row.student.id)
                      }}
                      aria-label={`เปิดรายละเอียด ${row.student.nickname}`}
                    >
                      <Icon name="chevron-right" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="privacy-footnote">
        <Bow size={20} />
        ข้อมูลนักเรียนทุกคนถูกจัดเก็บใน Supabase และมองเห็นได้เฉพาะบัญชีที่เข้าสู่ระบบนี้
      </div>

      <StudentFormModal
        open={addStudentOpen}
        mode="add"
        onClose={() => setAddStudentOpen(false)}
        onSaved={(studentId) => setSelectedStudentId(studentId)}
      />

      {editStudent && (
        <StudentFormModal
          open={Boolean(editStudentId)}
          mode="edit"
          student={editStudent}
          onClose={() => setEditStudentId(null)}
        />
      )}

      {addCourseStudent && (
        <CourseFormModal
          open={Boolean(addCourseForStudentId)}
          mode="add"
          student={addCourseStudent}
          onClose={() => setAddCourseForStudentId(null)}
          onSaved={(courseId) => {
            setSelectedCourseId(courseId)
            setAddCourseForStudentId(null)
          }}
        />
      )}

      {selectedStudent && !selectedCourseId && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={closeStudent}
          onEditStudent={() => setEditStudentId(selectedStudent.id)}
          onAddCourse={() => setAddCourseForStudentId(selectedStudent.id)}
          onOpenCourse={(courseId) => setSelectedCourseId(courseId)}
        />
      )}

      {selectedCourseId && (
        <CourseDetailModal
          courseId={selectedCourseId}
          onClose={closeStudent}
          onBackToStudent={() => setSelectedCourseId(null)}
        />
      )}
    </div>
  )
}

function StudentMobileCard({ row, onOpen }: { row: StudentRow; onOpen: () => void }) {
  return (
    <button type="button" className="student-mobile-card" onClick={onOpen}>
      <span
        className="student-mobile-color"
        style={{ backgroundColor: row.student.color_hex }}
      />
      <div className="student-mobile-head">
        <div className="student-mobile-name">
          <span
            className="table-avatar"
            style={{ backgroundColor: `${row.student.color_hex}66` }}
          >
            {row.student.nickname.charAt(0)}
          </span>
          <div>
            <strong>{row.student.nickname}</strong>
            <span>{row.courseCount} คอร์ส</span>
          </div>
        </div>
        {row.student.archived_at ? (
          <Badge tone="gray">ในคลัง</Badge>
        ) : row.stats.completionDate ? (
          <Badge tone="green">สอนครบ</Badge>
        ) : (
          <Icon name="chevron-right" size={18} />
        )}
      </div>

      <div className="student-mobile-subjects">
        {row.subjects.length > 0 ? (
          row.subjects.map((subject) => (
            <span className="subject-tag" key={subject}>
              {subject}
            </span>
          ))
        ) : (
          <span className="muted-cell">ยังไม่มีคอร์ส</span>
        )}
      </div>

      <div className="student-mobile-progress">
        <div>
          <span>สะสม</span>
          <strong>{formatDuration(row.stats.actualMinutes, 'short')}</strong>
        </div>
        <div>
          <span>คงเหลือ</span>
          <strong>{formatDuration(row.stats.remainingMinutes, 'short')}</strong>
        </div>
        <div>
          <span>ความคืบหน้า</span>
          <strong>{formatPercent(row.stats.progressPct)}</strong>
        </div>
      </div>
      <ProgressBar value={row.stats.progressPct} />

      <div className="student-mobile-foot">
        <span>
          <Icon name="calendar" size={15} />
          {row.endLabel}
          {!row.endDate && row.stats.estimateShortfallMinutes > 0
            ? ` • ต้องนัดเพิ่ม ${formatDuration(row.stats.estimateShortfallMinutes, 'short')}`
            : ''}
        </span>
        <span className="schedule-cell" title={row.schedule}>
          {row.schedule}
        </span>
      </div>
    </button>
  )
}
