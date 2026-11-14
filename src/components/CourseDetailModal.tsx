import { useMemo, useState } from 'react'
import {
  archiveCourse,
  deleteAttachment,
  deleteCourse,
  deletePayment,
  restoreCourse,
  uploadAttachment,
} from '../lib/api'
import { calculateCourseStats } from '../lib/calc'
import {
  formatBaht,
  formatDuration,
  formatFileSize,
  formatPercent,
  formatScheduleList,
  formatThaiDate,
  formatTimeRange,
} from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import type { Attachment, Payment, Session } from '../lib/types'
import { AttachmentButton } from './AttachmentButton'
import { CourseFormModal } from './CourseFormModal'
import { ExtraSessionModal } from './ExtraSessionModal'
import { FilePickerField } from './FilePickerField'
import { PaymentFormModal } from './PaymentFormModal'
import { ScheduleFormModal } from './ScheduleFormModal'
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

export function CourseDetailModal({
  courseId,
  onClose,
  onBackToStudent,
}: {
  courseId: string
  onClose: () => void
  onBackToStudent: () => void
}) {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [courseFormOpen, setCourseFormOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'archive' | 'delete' | null>(null)
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null)
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)

  const course = (data?.courses ?? []).find((item) => item.id === courseId) ?? null
  const student = course
    ? (data?.students ?? []).find((item) => item.id === course.student_id) ?? null
    : null

  const courseStats = useMemo(
    () =>
      course
        ? calculateCourseStats(course, data?.logs ?? [], data?.sessions ?? [], data?.payments ?? [])
        : null,
    [course, data],
  )

  const logs = useMemo(
    () =>
      (data?.logs ?? [])
        .filter((log) => log.course_id === courseId)
        .sort((a, b) => {
          const dateCompare = b.taught_on.localeCompare(a.taught_on)
          return dateCompare !== 0 ? dateCompare : b.created_at.localeCompare(a.created_at)
        }),
    [data, courseId],
  )

  const payments = useMemo(
    () =>
      (data?.payments ?? [])
        .filter((payment) => payment.course_id === courseId)
        .sort((a, b) => b.received_on.localeCompare(a.received_on)),
    [data, courseId],
  )

  const attachments = useMemo(
    () =>
      (data?.attachments ?? [])
        .filter((attachment) => attachment.course_id === courseId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [data, courseId],
  )

  const rules = useMemo(
    () =>
      (data?.rules ?? [])
        .filter((rule) => rule.course_id === courseId && rule.active)
        .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
    [data, courseId],
  )

  const sessions = useMemo(() => {
    const logMap = new Map(logs.map((log) => [log.session_id, log]))
    return (data?.sessions ?? [])
      .filter((session) => session.course_id === courseId)
      .sort((a, b) => {
        const dateCompare = b.session_date.localeCompare(a.session_date)
        return dateCompare !== 0 ? dateCompare : b.start_time.localeCompare(a.start_time)
      })
      .map((session) => ({ session, log: logMap.get(session.id) ?? null }))
  }, [data, courseId, logs])

  if (!data || !course || !student || !courseStats) return null

  const hasHistory = logs.length > 0 || payments.length > 0
  const historyToShow = showAllHistory ? sessions : sessions.slice(0, 12)
  const paidTotal = payments.reduce((total, item) => total + Number(item.amount_baht), 0)
  const outstanding = Math.max(0, Number(course.price_baht) - paidTotal)
  const isArchived = Boolean(course.archived_at)

  async function handleArchive() {
    setBusy(true)
    try {
      await archiveCourse(course!.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'เก็บคอร์สเข้าคลังแล้ว ประวัติยังอยู่ครบ' : 'เก็บเข้าคลังแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setConfirmAction(null)
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    setBusy(true)
    try {
      await restoreCourse(course!.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'นำคอร์สกลับจากคลังแล้ว' : 'นำกลับแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCourse() {
    setBusy(true)
    try {
      await deleteCourse(course!.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ลบคอร์สแล้ว' : 'ลบแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
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

  async function handleDeletePayment() {
    if (!paymentToDelete) return
    setBusy(true)
    try {
      await deletePayment(paymentToDelete.id)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ลบรายการรับเงินแล้ว' : 'ลบแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setPaymentToDelete(null)
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteAttachment() {
    if (!attachmentToDelete) return
    setBusy(true)
    try {
      await deleteAttachment(attachmentToDelete)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'ลบไฟล์แนบแล้ว' : 'ลบไฟล์แล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setAttachmentToDelete(null)
    } catch (error) {
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !course) {
      setUploadError('กรุณาเลือกไฟล์ก่อนอัปโหลด')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      await uploadAttachment(course.owner_id, course.id, uploadFile)
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'อัปโหลดไฟล์แนบแล้ว' : 'อัปโหลดแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      setUploadFile(null)
    } catch (error) {
      setUploadError(toThaiError(error))
    } finally {
      setUploading(false)
    }
  }

  const endDateLabel = courseStats.completionDate
    ? formatThaiDate(courseStats.completionDate)
    : courseStats.estimatedEndDate
      ? formatThaiDate(courseStats.estimatedEndDate)
      : 'ยังประเมินไม่ได้'
  const endDateHint = courseStats.completionDate
    ? 'วันที่สอนครบจริงตามลำดับการสอน'
    : isArchived
      ? 'คอร์สอยู่ในคลัง จึงไม่นับนัดในอนาคต'
      : courseStats.estimatedEndDate
        ? 'จากนัดในอนาคตที่ยังมีผล'
        : 'ยังประเมินไม่ได้'

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={course.subject}
        subtitle={`${student.nickname} • เริ่ม ${formatThaiDate(course.start_date)}`}
        icon="book"
        size="wide"
        busy={busy || uploading}
        footer={
          <>
            <Button variant="ghost" icon="arrow-left" onClick={onBackToStudent} disabled={busy}>
              กลับไปนักเรียน
            </Button>
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              ปิด
            </Button>
          </>
        }
      >
        <div className="course-detail-top">
          <div className="course-detail-identity">
            <span
              className="student-color-dot student-color-dot-lg"
              style={{ backgroundColor: student.color_hex }}
            />
            <div>
              <div className="course-title-line">
                <h3>{course.subject}</h3>
                {isArchived && <Badge tone="gray">คอร์สอยู่ในคลัง</Badge>}
                {courseStats.completionDate && <Badge tone="green">สอนครบแล้ว</Badge>}
                {courseStats.overMinutes > 0 && <Badge tone="peach">เกินเวลา</Badge>}
              </div>
              <p>{student.nickname} • {formatDuration(course.purchased_minutes)} • {formatBaht(Number(course.price_baht))}</p>
            </div>
          </div>
          <div className="course-top-actions">
            <Button variant="ghost" size="sm" icon="edit" onClick={() => setCourseFormOpen(true)}>
              แก้ไขคอร์ส
            </Button>
            {isArchived ? (
              <Button variant="soft" size="sm" icon="restore" onClick={() => void handleRestore()} loading={busy}>
                นำกลับจากคลัง
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon="archive"
                onClick={() => setConfirmAction('archive')}
              >
                เก็บเข้าคลัง
              </Button>
            )}
            {!hasHistory && (
              <Button
                variant="ghost"
                size="sm"
                icon="trash"
                className="danger-text"
                onClick={() => setConfirmAction('delete')}
              >
                ลบคอร์ส
              </Button>
            )}
          </div>
        </div>

        {isArchived && (
          <div className="inline-note">
            <Icon name="archive" size={16} />
            คอร์สนี้ถูกซ่อนจากรายการและตารางนัดในอนาคต แต่ประวัติการสอน ไฟล์ และการรับเงินยังเปิดดูได้
          </div>
        )}

        <div className="course-progress-panel">
          <div className="course-progress-head">
            <div>
              <span className="progress-eyebrow">ความคืบหน้าคอร์ส</span>
              <strong className="progress-percent">{formatPercent(courseStats.progressPct)}</strong>
            </div>
            <div className="course-progress-numbers">
              <span>สอนแล้ว {formatDuration(courseStats.actualMinutes, 'short')}</span>
              <span>จาก {formatDuration(courseStats.purchasedMinutes, 'short')}</span>
            </div>
          </div>
          <ProgressBar value={courseStats.progressPct} label="ความคืบหน้าคอร์ส" />
          <div className="course-progress-foot">
            <span>
              {courseStats.remainingMinutes > 0
                ? `เหลือ ${formatDuration(courseStats.remainingMinutes)}`
                : 'สอนครบตามชั่วโมงที่ซื้อแล้ว'}
            </span>
            {courseStats.overMinutes > 0 && (
              <span className="over-time">สอนเกิน {formatDuration(courseStats.overMinutes)}</span>
            )}
            <span>มูลค่าที่สอนไป {formatBaht(courseStats.valueTaughtBaht)}</span>
          </div>
        </div>

        <div className="course-info-grid">
          <div className="course-info-card info-end">
            <span className="info-label">
              <Icon name="calendar" size={16} /> วันจบโดยประมาณ
            </span>
            <strong>{endDateLabel}</strong>
            <small>{endDateHint}</small>
            {!courseStats.completionDate &&
              !courseStats.estimatedEndDate &&
              !isArchived &&
              courseStats.estimateShortfallMinutes > 0 && (
                <span className="shortfall-note">
                  ต้องนัดเพิ่ม {formatDuration(courseStats.estimateShortfallMinutes)}
                </span>
              )}
          </div>
          <div className="course-info-card info-paid">
            <span className="info-label">
              <Icon name="wallet" size={16} /> ยอดรับเงินจริง
            </span>
            <strong>{formatBaht(paidTotal)}</strong>
            <small>จากค่าเรียน {formatBaht(Number(course.price_baht))}</small>
          </div>
          <div className="course-info-card info-value">
            <span className="info-label">
              <Icon name="book" size={16} /> มูลค่าที่สอนไป
            </span>
            <strong>{formatBaht(courseStats.valueTaughtBaht)}</strong>
            <small>คิดตามสัดส่วนเวลา ไม่เกินราคาคอร์ส</small>
          </div>
          <div className="course-info-card info-outstanding">
            <span className="info-label">
              <Icon name="clock" size={16} /> ยังไม่ได้รับชำระ
            </span>
            <strong>{formatBaht(outstanding)}</strong>
            <small>{payments.length} รายการรับเงิน</small>
          </div>
        </div>

        {course.content && (
          <div className="course-content-box">
            <h4>
              <Icon name="book" size={16} /> เนื้อหาการสอน
            </h4>
            <p>{course.content}</p>
          </div>
        )}

        <section className="detail-section">
          <div className="section-row">
            <div>
              <h3 className="subheading">ตารางประจำ</h3>
              <p className="subheading-note">แก้ตารางแล้วมีผลกับนัดในอนาคตตามวันที่มีผล</p>
            </div>
            <div className="section-actions-inline">
              <Button
                variant="ghost"
                size="sm"
                icon="calendar-plus"
                onClick={() => setExtraOpen(true)}
                disabled={isArchived}
              >
                เพิ่มนัดนอกรอบ
              </Button>
              <Button
                variant="soft"
                size="sm"
                icon="repeat"
                onClick={() => setScheduleOpen(true)}
                disabled={isArchived}
              >
                แก้ตารางประจำ
              </Button>
            </div>
          </div>
          {rules.length > 0 ? (
            <div className="rule-chip-list">
              {rules.map((rule) => (
                <span className="rule-chip" key={rule.id}>
                  <span className="rule-dot" style={{ backgroundColor: student.color_hex }} />
                  {formatScheduleList([rule])}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted-line">ยังไม่ได้ตั้งตารางประจำ ใช้ปุ่ม «แก้ตารางประจำ» เพื่อเริ่มต้น</p>
          )}
        </section>

        <section className="detail-section">
          <div className="section-row">
            <div>
              <h3 className="subheading">การรับเงิน</h3>
              <p className="subheading-note">แยกจากมูลค่าที่สอนไป และบันทึกได้หลายรายการ</p>
            </div>
            <Button variant="soft" size="sm" icon="plus" onClick={() => setPaymentOpen(true)}>
              บันทึกรับเงิน
            </Button>
          </div>
          {payments.length === 0 ? (
            <p className="muted-line">ยังไม่มีรายการรับเงิน</p>
          ) : (
            <div className="payment-list">
              {payments.map((payment) => (
                <div className="payment-row" key={payment.id}>
                  <span className="payment-date">{formatThaiDate(payment.received_on)}</span>
                  <span className="payment-amount">{formatBaht(Number(payment.amount_baht))}</span>
                  <span className="payment-note">{payment.note || '—'}</span>
                  <button
                    type="button"
                    className="row-icon-button danger-text"
                    aria-label="ลบรายการรับเงิน"
                    onClick={() => setPaymentToDelete(payment)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="detail-section">
          <div className="section-row">
            <div>
              <h3 className="subheading">ไฟล์แนบการสอน</h3>
              <p className="subheading-note">
                กดเพื่อดูตัวอย่างไฟล์
              </p>
            </div>
          </div>

          {attachments.length === 0 ? (
            <p className="muted-line">ยังไม่มีไฟล์แนบ</p>
          ) : (
            <div className="attachment-manage-list">
              {attachments.map((attachment) => (
                <div className="attachment-manage-row" key={attachment.id}>
                  <AttachmentButton attachment={attachment} compact={false} />
                  {attachment.size_bytes ? (
                    <span className="attachment-manage-size">{formatFileSize(attachment.size_bytes)}</span>
                  ) : null}
                  <button
                    type="button"
                    className="row-icon-button danger-text"
                    aria-label={`ลบไฟล์ ${attachment.file_name}`}
                    onClick={() => setAttachmentToDelete(attachment)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="upload-row">
            <FilePickerField
              file={uploadFile}
              onChange={setUploadFile}
              onError={setUploadError}
              disabled={uploading}
              label="เลือกไฟล์เพื่อเพิ่ม"
              existingCount={attachments.length}
            />
            <Button
              variant="soft"
              size="sm"
              icon="attachment"
              onClick={() => void handleUpload()}
              disabled={!uploadFile}
              loading={uploading}
            >
              อัปโหลดไฟล์
            </Button>
          </div>
          {uploadError && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{uploadError}</span>
            </div>
          )}
        </section>

        <section className="detail-section">
          <div className="section-row">
            <div>
              <h3 className="subheading">นัดและประวัติการสอน</h3>
              <p className="subheading-note">
                {sessions.length} รายการ • ประวัติถูกเก็บไว้แม้เก็บคอร์สเข้าคลัง
              </p>
            </div>
            {sessions.length > 12 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllHistory((current) => !current)}
              >
                {showAllHistory ? 'ย่อประวัติ' : `ดูทั้งหมด ${sessions.length} รายการ`}
              </Button>
            )}
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              compact
              title="ยังไม่มีนัด"
              description="ตั้งตารางประจำหรือเพิ่มนัดนอกรอบเพื่อเริ่มต้น"
            />
          ) : (
            <div className="history-list">
              {historyToShow.map(({ session, log }) => (
                <HistoryRow
                  key={session.id}
                  session={session}
                  actualMinutes={log?.actual_minutes ?? null}
                  taughtOn={log?.taught_on ?? null}
                  content={session.note || course.content}
                  color={student.color_hex}
                />
              ))}
            </div>
          )}
        </section>

        <div className="student-admin-zone">
          <div>
            <h3 className="subheading">จัดการคอร์ส</h3>
            <p className="subheading-note">
              {hasHistory
                ? 'คอร์สนี้มีประวัติแล้ว จึงเก็บเข้าคลังแทนการลบเพื่อรักษาประวัติ'
                : 'คอร์สนี้ยังไม่มีประวัติการสอนหรือการรับเงิน ลบถาวรได้หลังยืนยัน'}
            </p>
          </div>
          <div className="student-admin-actions">
            {!hasHistory && (
              <Button
                variant="ghost"
                className="danger-text"
                icon="trash"
                onClick={() => setConfirmAction('delete')}
                disabled={busy}
              >
                ลบคอร์สถาวร
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <CourseFormModal
        open={courseFormOpen}
        mode="edit"
        student={student}
        course={course}
        onClose={() => setCourseFormOpen(false)}
      />

      <ScheduleFormModal
        open={scheduleOpen}
        course={course}
        student={student}
        onClose={() => setScheduleOpen(false)}
      />

      <PaymentFormModal
        open={paymentOpen}
        course={course}
        student={student}
        onClose={() => setPaymentOpen(false)}
      />

      <ExtraSessionModal
        open={extraOpen}
        onClose={() => setExtraOpen(false)}
        initialCourseId={course.id}
      />

      <ConfirmDialog
        open={confirmAction === 'archive'}
        title="เก็บคอร์สเข้าคลัง?"
        description="คอร์สจะถูกซ่อนจากรายการและตารางนัดในอนาคต แต่ประวัตินัด การสอน ไฟล์ และการรับเงินยังเปิดดูได้"
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
        title="ลบคอร์สนี้ถาวร?"
        description="คอร์ส ตารางนัด ไฟล์แนบ และข้อมูลที่เกี่ยวข้องจะถูกลบและกู้คืนไม่ได้"
        confirmLabel="ลบถาวร"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDeleteCourse()}
        onClose={() => {
          if (!busy) setConfirmAction(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(paymentToDelete)}
        title="ลบรายการรับเงินนี้?"
        description={
          paymentToDelete
            ? `${formatThaiDate(paymentToDelete.received_on)} • ${formatBaht(Number(paymentToDelete.amount_baht))}`
            : ''
        }
        confirmLabel="ลบรายการ"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDeletePayment()}
        onClose={() => {
          if (!busy) setPaymentToDelete(null)
        }}
      />

      <ConfirmDialog
        open={Boolean(attachmentToDelete)}
        title="ลบไฟล์แนบนี้?"
        description={attachmentToDelete?.file_name ?? ''}
        confirmLabel="ลบไฟล์"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleDeleteAttachment()}
        onClose={() => {
          if (!busy) setAttachmentToDelete(null)
        }}
      />
    </>
  )
}

function HistoryRow({
  session,
  actualMinutes,
  taughtOn,
  content,
  color,
}: {
  session: Session
  actualMinutes: number | null
  taughtOn: string | null
  content: string
  color: string
}) {
  const isCanceled = session.status === 'canceled'
  const isTaught = actualMinutes !== null
  return (
    <div className={`history-row ${isCanceled ? 'is-canceled' : ''}`}>
      <span className="history-color" style={{ backgroundColor: color }} />
      <div className="history-date">
        <strong>{formatThaiDate(session.session_date)}</strong>
        <span>{formatTimeRange(session.start_time, session.end_time)}</span>
      </div>
      <div className="history-main">
        <div className="history-badges">
          {session.kind === 'extra' && <Badge tone="peach">นอกรอบ</Badge>}
          {isTaught && <Badge tone="green">สอนแล้ว</Badge>}
          {isCanceled && <Badge tone="gray">ยกเลิก</Badge>}
          {session.status === 'moved' && <Badge tone="purple">เลื่อนแล้ว</Badge>}
          {!isTaught && !isCanceled && <Badge tone="blue">รอสอน</Badge>}
        </div>
        <p>{content || 'ไม่มีเนื้อหาบันทึกไว้'}</p>
        {isTaught && (
          <span className="history-taught">
            สอนจริง {formatDuration(actualMinutes as number, 'short')}
            {taughtOn ? ` • บันทึกวันที่ ${formatThaiDate(taughtOn)}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
