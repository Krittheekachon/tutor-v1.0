import { useMemo, useState } from 'react'
import { studentListRows, type StudentSort } from '../lib/studentList'
import {
  formatDuration,
  formatPercent,
  WEEKDAY_LONG,
} from '../lib/date'
import { useAppData } from '../state/AppDataContext'
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

type StudentRow = ReturnType<typeof studentListRows>[number]

export function StudentsPage() {
  const { data } = useAppData()
  const isMobile = useMediaQuery('(max-width: 860px)')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<StudentSort>('name')
  const [weekday, setWeekday] = useState('')
  const [subject, setSubject] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [addStudentOpen, setAddStudentOpen] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [editStudentId, setEditStudentId] = useState<string | null>(null)
  const [addCourseForStudentId, setAddCourseForStudentId] = useState<string | null>(null)

  const rows = useMemo(() => data ? studentListRows(data, {
    archived: showArchived, search, weekday, subject, sort,
  }) : [], [data, showArchived, search, weekday, subject, sort])
  const subjects = useMemo(() => {
    if (!data) return []
    const studentIds = new Set(data.students.filter(student => Boolean(student.archived_at) === showArchived).map(student => student.id))
    return [...new Set(data.courses.filter(course => studentIds.has(course.student_id) && (showArchived || !course.archived_at))
      .map(course => course.subject))].sort((a, b) => a.localeCompare(b, 'th'))
  }, [data, showArchived])
  const hasFilters = Boolean(search.trim() || weekday || subject)
  function clearFilters() { setSearch(''); setWeekday(''); setSubject('') }

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
            onClick={() => { setShowArchived(false); setSubject('') }}
          >
            กำลังเรียน
            <span className="segment-count">{activeCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={showArchived}
            className={showArchived ? 'is-active' : ''}
            onClick={() => { setShowArchived(true); setSubject('') }}
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

      <div className="students-list-controls">
        <div className="students-control students-sort-control">
          <label htmlFor="students-sort">เรียงตาม</label>
          <div className="students-sort-row">
            <span className="students-select-wrap">
              <select id="students-sort" className="input input-select" value={sort === 'name' ? 'name' : sort.startsWith('remaining-') ? 'remaining' : 'end'}
                onChange={event => setSort(event.target.value === 'remaining' ? 'remaining-desc' : event.target.value === 'end' ? 'end-asc' : 'name')}>
                <option value="name">ชื่อ</option>
                <option value="remaining">ชั่วโมงคงเหลือ</option>
                <option value="end">วันที่จบ</option>
              </select>
            </span>
            <button type="button" className="students-sort-direction" disabled={sort === 'name'}
              aria-label="สลับทิศทางการเรียง"
              title={sort === 'name' ? 'การเรียงชื่อยังไม่รองรับการสลับทิศทาง' : 'สลับทิศทางการเรียง'}
              onClick={() => setSort(current => current === 'remaining-desc' ? 'remaining-asc' : current === 'remaining-asc' ? 'remaining-desc' : current === 'end-asc' ? 'end-desc' : current === 'end-desc' ? 'end-asc' : current)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={sort.endsWith('-asc') ? 'M12 19V5m-5 5 5-5 5 5' : 'M12 5v14m-5-5 5 5 5-5'} />
              </svg>
            </button>
          </div>
        </div>
        <div className={`students-control ${weekday ? 'is-filtered' : ''}`}>
          <label htmlFor="students-weekday">วันเรียนประจำ</label>
          <span className="students-select-wrap">
            <select id="students-weekday" className="input input-select" value={weekday} onChange={event => setWeekday(event.target.value)}>
              <option value="">ทุกวัน</option>
              {[1, 2, 3, 4, 5, 6, 7].map(day => <option key={day} value={day}>วัน{WEEKDAY_LONG[day]}</option>)}
            </select>
          </span>
        </div>
        <div className={`students-control ${subject ? 'is-filtered' : ''}`}>
          <label htmlFor="students-subject">วิชา</label>
          <span className="students-select-wrap">
            <select id="students-subject" className="input input-select" value={subject} onChange={event => setSubject(event.target.value)}>
              <option value="">ทุกวิชา</option>
              {subjects.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </span>
        </div>
        {(weekday || subject) && <button type="button" className="students-clear-filters"
          aria-label="ล้างตัวกรองวันเรียนและวิชา" onClick={() => { setWeekday(''); setSubject('') }}>ล้างตัวกรอง</button>}
        <p className="students-filter-status" role="status"
          title={weekday || subject ? 'ชั่วโมงและวันจบคำนวณจากคอร์สที่ตรงตัวกรอง' : undefined}>
          แสดง {rows.length}{hasFilters ? ` จาก ${showArchived ? archivedCount : activeCount}` : ''} คน
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="students-empty-card">
          <EmptyState
            title={
              hasFilters
                ? 'ไม่พบนักเรียนที่ตรงตัวกรอง'
                : showArchived
                  ? 'คลังยังว่างอยู่'
                  : 'ยังไม่มีนักเรียนในตารางสอน'
            }
            description={
              hasFilters
                ? 'ลองเปลี่ยนคำค้นหา วันเรียน หรือวิชา หรือล้างตัวกรองเพื่อดูรายชื่อทั้งหมด'
                : showArchived
                  ? 'นักเรียนที่เก็บเข้าคลังจะมาอยู่ที่นี่ พร้อมประวัติที่เปิดดูได้'
                  : 'เพิ่มนักเรียนคนแรก แล้วคอร์สและตารางประจำจะเริ่มต้นที่นี่'
            }
            action={
              hasFilters ? (
                <Button variant="soft" icon="x" onClick={clearFilters}>
                  ล้างตัวกรอง
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
