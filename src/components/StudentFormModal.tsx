import { useEffect, useState, type FormEvent } from 'react'
import { createStudentWithCourse, updateStudent } from '../lib/api'
import { formatThaiDate, todayKey, weekdayFromDateKey } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { validateSlots } from '../lib/schedule'
import { useAppData } from '../state/AppDataContext'
import type { ScheduleSlotInput, Student } from '../lib/types'
import { ColorPicker } from './ColorPicker'
import { FilePickerField } from './FilePickerField'
import { makeEmptySlot, ScheduleSlotsEditor } from './ScheduleSlotsEditor'
import { Button, Field, Icon, Modal, useToast } from './ui'

export function StudentFormModal({
  open,
  mode,
  student,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'add' | 'edit'
  student?: Student | null
  onClose: () => void
  onSaved?: (studentId: string) => void
}) {
  const { ownerId, refresh } = useAppData()
  const { pushToast } = useToast()
  const [nickname, setNickname] = useState('')
  const [colorHex, setColorHex] = useState('#F5A9C0')
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

  useEffect(() => {
    if (!open) return
    setNickname(student?.nickname ?? '')
    setColorHex(student?.color_hex?.toUpperCase() ?? '#F5A9C0')
    setSubject('')
    setStartDate(todayKey())
    setContent('')
    setHours('8')
    setPrice('4000')
    setSlots(mode === 'add' ? [makeEmptySlot(weekdayFromDateKey(todayKey()))] : [])
    setFile(null)
    setBusy(false)
    setError(null)
    setFileError(null)
  }, [open, mode, student])

  function validate(): string | null {
    if (!nickname.trim()) return 'กรุณากรอกชื่อเล่นนักเรียน'
    if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) return 'สีประจำตัวต้องอยู่ในรูปแบบ #RRGGBB'
    if (mode === 'edit') return null
    if (!subject.trim()) return 'กรุณากรอกวิชา'
    if (!startDate) return 'กรุณาเลือกวันที่เริ่ม'
    const hourValue = Number(hours)
    if (!Number.isFinite(hourValue) || hourValue <= 0) return 'เวลาที่ซื้อต้องมากกว่า 0 ชั่วโมง'
    const priceValue = Number(price)
    if (!Number.isFinite(priceValue) || priceValue < 0) return 'ค่าเรียนต้องเป็น 0 บาทขึ้นไป'
    if (slots.length > 0) {
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
      if (mode === 'edit' && student) {
        await updateStudent({ studentId: student.id, nickname, colorHex })
        const refreshed = await refresh()
        pushToast(
          refreshed ? 'แก้ไขข้อมูลนักเรียนแล้ว' : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
          refreshed ? 'success' : 'warning',
        )
        onSaved?.(student.id)
        onClose()
      } else {
        const newStudentId = await createStudentWithCourse({
          ownerId,
          nickname,
          colorHex,
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
          refreshed ? 'เพิ่มนักเรียนและคอร์สแรกแล้ว' : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
          refreshed ? 'success' : 'warning',
        )
        onSaved?.(newStudentId)
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
      title={mode === 'add' ? 'เพิ่มนักเรียนคนใหม่' : 'แก้ไขข้อมูลนักเรียน'}
      subtitle={
        mode === 'add'
          ? 'ข้อมูลนักเรียนและคอร์สแรกจะถูกบันทึกลง Supabase'
          : 'แก้ชื่อเล่นและสีประจำตัวได้ตามต้องการ'
      }
      icon={mode === 'add' ? 'plus' : 'edit'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="submit" form="student-form" loading={busy} icon="check">
            {mode === 'add' ? 'เพิ่มนักเรียน' : 'บันทึกการแก้ไข'}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={handleSubmit} noValidate>
        <div className="form-section">
          <div className="form-section-title">
            <span className="form-step">1</span>
            <div>
              <h3>ข้อมูลนักเรียน</h3>
              <p>ชื่อเล่นแสดงบนปฏิทินและรายการนัด</p>
            </div>
          </div>

          <Field label="ชื่อเล่น" htmlFor="student-nickname" required>
            <input
              id="student-nickname"
              className="input"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="เช่น น้ำตาลนม"
              maxLength={80}
              disabled={busy}
              autoComplete="off"
            />
          </Field>

          <Field label="สีประจำตัว" required hint="เลือกจากพาเลตพาสเทลหรือกรอก HEX เอง">
            <ColorPicker value={colorHex} onChange={setColorHex} disabled={busy} />
          </Field>
        </div>

        {mode === 'add' && (
          <>
            <div className="form-section">
              <div className="form-section-title">
                <span className="form-step">2</span>
                <div>
                  <h3>คอร์สแรก</h3>
                  <p>ต่อคอร์สหรือเรียนอีกวิชาเพิ่มได้ภายหลัง</p>
                </div>
              </div>

              <div className="form-row">
                <Field label="วิชา" htmlFor="student-subject" required>
                  <input
                    id="student-subject"
                    className="input"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="เช่น คณิตศาสตร์ ม.3"
                    maxLength={120}
                    disabled={busy}
                  />
                </Field>
                <Field label="วันที่เริ่ม" htmlFor="student-start-date" required>
                  <input
                    id="student-start-date"
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
                htmlFor="student-content"
                hint="ใช้แสดงเป็นเนื้อหาที่วางไว้ในรายละเอียดนัด"
              >
                <textarea
                  id="student-content"
                  className="input textarea"
                  rows={3}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="เช่น ติวบทที่ 1–3 เตรียมสอบกลางภาค"
                  maxLength={5000}
                  disabled={busy}
                />
              </Field>

              <div className="form-row form-row-2">
                <Field label="เวลาที่ซื้อ (ชั่วโมง)" htmlFor="student-hours" required>
                  <div className="input-unit-wrap">
                    <input
                      id="student-hours"
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
                <Field label="ค่าเรียนต่อคอร์ส (บาท)" htmlFor="student-price" required>
                  <div className="input-unit-wrap">
                    <input
                      id="student-price"
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
                />
                {fileError && <p className="field-error">{fileError}</p>}
              </Field>
            </div>

            <div className="form-section">
              <div className="form-section-title">
                <span className="form-step">3</span>
                <div>
                  <h3>ตารางประจำ</h3>
                  <p>เพิ่มได้หลายช่วงต่อสัปดาห์ หรือข้ามไปก่อนแล้วตั้งภายหลังก็ได้</p>
                </div>
              </div>
              <ScheduleSlotsEditor
                slots={slots}
                onChange={setSlots}
                disabled={busy}
                emptyText="ยังไม่ได้ตั้งตารางประจำ"
              />
            </div>
          </>
        )}

        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}

        {error && (
          <p className="retry-note">ค่าที่กรอกยังอยู่ครบ กดปุ่มบันทึกอีกครั้งเพื่อลองใหม่ได้เลย</p>
        )}
      </form>
    </Modal>
  )
}
