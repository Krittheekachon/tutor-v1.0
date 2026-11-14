import { useEffect, useState, type FormEvent } from 'react'
import { createCourse, updateCourse } from '../lib/api'
import { formatThaiDate, todayKey, weekdayFromDateKey } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { validateSlots } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { Course, ScheduleSlotInput, Student } from '../lib/types'
import { FilePickerField } from './FilePickerField'
import { makeEmptySlot, ScheduleSlotsEditor } from './ScheduleSlotsEditor'
import { Button, Field, Icon, Modal, useToast } from './ui'

export function CourseFormModal({
  open,
  mode,
  student,
  course,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'add' | 'edit' | 'renew'
  student: Student
  course?: Course | null
  onClose: () => void
  onSaved?: (courseId: string) => void
}) {
  const { data, ownerId, refresh } = useAppData()
  const { pushToast } = useToast()
  const [subject, setSubject] = useState('')
  const [startDate, setStartDate] = useState(todayKey())
  const [content, setContent] = useState('')
  const [hours, setHours] = useState('8')
  const [price, setPrice] = useState('4000')
  const [slots, setSlots] = useState<ScheduleSlotInput[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const existingAttachments = course
    ? (data?.attachments ?? []).filter((attachment) => attachment.course_id === course.id).length
    : 0

  useEffect(() => {
    if (!open) return
    setSubject(course?.subject ?? '')
    setStartDate(course?.start_date ?? todayKey())
    setContent(course?.content ?? '')
    setHours(course ? String(Number((course.purchased_minutes / 60).toFixed(2))) : '8')
    setPrice(course ? String(Number(course.price_baht)) : '4000')
    setSlots(mode === 'add' ? [makeEmptySlot(weekdayFromDateKey(todayKey()))] : [])
    setFile(null)
    setBusy(false)
    setError(null)
    setFileError(null)
  }, [open, mode, course])

  function validate(): string | null {
    if (!subject.trim()) return 'กรุณากรอกวิชา'
    if (!startDate) return 'กรุณาเลือกวันที่เริ่ม'
    const hourValue = Number(hours)
    if (!Number.isFinite(hourValue) || hourValue <= 0) return 'เวลาที่ซื้อต้องมากกว่า 0 ชั่วโมง'
    if (mode === 'renew' && course) {
      const actual = (data?.logs ?? []).filter(log => log.course_id === course.id).reduce((sum, log) => sum + log.actual_minutes, 0)
      if (course.purchased_minutes + Math.round(hourValue * 60) <= actual) return 'กรุณาเพิ่มชั่วโมงให้มากกว่าเวลาที่สอนเกินไปแล้ว เพื่อให้มีชั่วโมงเรียนคงเหลือ'
    }
    const priceValue = Number(price)
    if (!Number.isFinite(priceValue) || priceValue < 0) return 'ค่าเรียนต้องเป็น 0 บาทขึ้นไป'
    if (mode === 'add' && slots.length > 0) {
      const slotError = validateSlots(slots)
      if (slotError) return slotError
    }
    if (fileError) return fileError
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
      if ((mode === 'edit' || mode === 'renew') && course) {
        await updateCourse({
          ownerId,
          courseId: course.id,
          subject,
          startDate,
          content,
          purchasedMinutes: Math.round(Number(hours) * 60) + (mode === 'renew' ? course.purchased_minutes : 0),
          priceBaht: Number(price) + (mode === 'renew' ? Number(course.price_baht) : 0),
          file,
        })
        const refreshed = await refresh()
        pushToast(
          refreshed ? 'แก้ไขคอร์สแล้ว' : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
          refreshed ? 'success' : 'warning',
        )
        onSaved?.(course.id)
        onClose()
      } else {
        const courseId = await createCourse({
          ownerId,
          studentId: student.id,
          subject,
          startDate,
          content,
          purchasedMinutes: Math.round(Number(hours) * 60),
          priceBaht: Number(price),
          slots,
          file,
        })
        const refreshed = await refresh()
        pushToast(
          refreshed ? 'เพิ่มคอร์สใหม่แล้ว' : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
          refreshed ? 'success' : 'warning',
        )
        onSaved?.(courseId)
        onClose()
      }
    } catch (saveError) {
      setError(toThaiError(saveError))
    } finally {
      setBusy(false)
    }
  }

  const minutePreview = Number(hours) > 0 ? Math.round(Number(hours) * 60) : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title={mode === 'add' ? `เพิ่มคอร์สให้ ${student.nickname}` : mode === 'renew' ? 'ต่อคอร์ส' : 'แก้ไขรายละเอียดคอร์ส'}
      subtitle={
        mode === 'add'
          ? 'คอร์สใหม่แยกชั่วโมง ค่าเรียน และตารางของตัวเอง'
          : 'แก้ข้อมูลคอร์ส ส่วนตารางประจำแก้ได้จากหน้ารายละเอียดคอร์ส'
      }
      icon={mode === 'add' ? 'plus' : 'edit'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="submit" form="course-form" loading={busy} icon="check">
            {mode === 'add' ? 'เพิ่มคอร์ส' : mode === 'renew' ? 'ยืนยันต่อคอร์ส' : 'บันทึกการแก้ไข'}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={handleSubmit} noValidate>
        <div className="course-form-student">
          <span className="student-color-dot" style={{ backgroundColor: student.color_hex }} />
          <span>{student.nickname}</span>
          <span className="course-form-student-hint">คอร์สจะใช้สีประจำตัวนักเรียนนี้</span>
        </div>

        <div className="form-row">
          <Field label="วิชา" htmlFor="course-subject" required>
            <input
              id="course-subject"
              className="input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="เช่น ภาษาอังกฤษ ป.6"
              maxLength={120}
              disabled={busy}
            />
          </Field>
          <Field label="วันที่เริ่ม" htmlFor="course-start-date" required>
            <input
              id="course-start-date"
              className="input"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={busy}
            />
            {startDate && <p className="field-hint">{formatThaiDate(startDate)}</p>}
          </Field>
        </div>

        <Field
          label="เนื้อหาการสอน"
          htmlFor="course-content"
          hint="ข้อความนี้จะแสดงใต้ปฏิทินในรายละเอียดของทุกนัด"
        >
          <textarea
            id="course-content"
            className="input textarea"
            rows={3}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="เช่น ปูพื้นฐานไวยากรณ์ + ทำข้อสอบย้อนหลัง"
            maxLength={5000}
            disabled={busy}
          />
        </Field>

        <div className="form-row form-row-2">
          <Field label="เวลาที่ซื้อ (ชั่วโมง)" htmlFor="course-hours" required>
            <div className="input-unit-wrap">
              <input
                id="course-hours"
                className="input"
                type="number"
                min={0.5}
                step={0.5}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
              <span className="input-unit">ชม.</span>
            </div>
            {minutePreview > 0 && (
              <p className="field-hint">= {minutePreview.toLocaleString('th-TH')} นาที</p>
            )}
          </Field>
          <Field label="ค่าเรียนต่อคอร์ส (บาท)" htmlFor="course-price" required>
            <div className="input-unit-wrap">
              <input
                id="course-price"
                className="input"
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={busy}
                inputMode="decimal"
              />
              <span className="input-unit">บาท</span>
            </div>
          </Field>
        </div>

        <Field label="ไฟล์แนบการสอน (ไม่บังคับ)">
          <FilePickerField
            file={file}
            onChange={setFile}
            onError={setFileError}
            disabled={busy}
            existingCount={existingAttachments}
          />
          {fileError && <p className="field-error">{fileError}</p>}
        </Field>

        {mode === 'add' && (
          <div className="form-section form-section-tight">
            <div className="form-section-title">
              <span className="form-step">ตาราง</span>
              <div>
                <h3>ตารางประจำของคอร์สนี้</h3>
                <p>ใส่ตอนนี้หรือเพิ่มภายหลังในรายละเอียดคอร์สก็ได้</p>
              </div>
            </div>
            <ScheduleSlotsEditor slots={slots} onChange={setSlots} disabled={busy} />
          </div>
        )}

        {mode === 'renew' && <p className="form-lead">กรอกชั่วโมงและค่าเรียนที่ซื้อเพิ่ม ระบบจะบวกกับยอดเดิมและคงตารางสอน ประวัติ และไฟล์ทั้งหมดไว้</p>}
        {mode !== 'add' && (
          <div className="inline-note">
            <Icon name="repeat" size={16} />
            ต้องการเปลี่ยนวันหรือเวลาเรียนประจำ? ใช้ปุ่ม «แก้ตารางประจำ» ในรายละเอียดคอร์ส
          </div>
        )}

        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {error && <p className="retry-note">ค่าที่กรอกยังอยู่ครบ กดบันทึกอีกครั้งเพื่อลองใหม่ได้</p>}
      </form>
    </Modal>
  )
}
