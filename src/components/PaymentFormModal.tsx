import { useEffect, useState, type FormEvent } from 'react'
import { addPayment } from '../lib/api'
import { formatBaht, formatThaiDate, todayKey } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import type { Course, Student } from '../lib/types'
import { Button, Field, Icon, Modal, useToast } from './ui'

export function PaymentFormModal({
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
  const [receivedOn, setReceivedOn] = useState(todayKey())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payments = (data?.payments ?? []).filter((payment) => payment.course_id === course.id)
  const paid = payments.reduce((total, payment) => total + Number(payment.amount_baht), 0)
  const outstanding = Math.max(0, Number(course.price_baht) - paid)

  useEffect(() => {
    if (!open) return
    setReceivedOn(todayKey())
    setAmount(outstanding > 0 ? String(Math.round(outstanding * 100) / 100) : '')
    setNote('')
    setBusy(false)
    setError(null)
  }, [open, outstanding])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (!receivedOn) {
      setError('กรุณาเลือกวันที่รับเงิน')
      return
    }
    const amountValue = Number(amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('จำนวนเงินที่รับต้องมากกว่า 0 บาท')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addPayment({
        ownerId: course.owner_id,
        courseId: course.id,
        receivedOn,
        amountBaht: amountValue,
        note,
      })
      const refreshed = await refresh()
      pushToast(
        refreshed ? 'บันทึกรายการรับเงินแล้ว' : 'บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ',
        refreshed ? 'success' : 'warning',
      )
      onClose()
    } catch (saveError) {
      setError(toThaiError(saveError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="บันทึกการรับเงิน"
      subtitle={`${student.nickname} • ${course.subject}`}
      icon="wallet"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="submit" form="payment-form" loading={busy} icon="check">
            บันทึกรับเงิน
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={handleSubmit} noValidate>
        <div className="payment-summary">
          <div>
            <span>ค่าเรียนทั้งคอร์ส</span>
            <strong>{formatBaht(Number(course.price_baht))}</strong>
          </div>
          <div>
            <span>รับเงินแล้ว</span>
            <strong>{formatBaht(paid)}</strong>
          </div>
          <div className="payment-outstanding">
            <span>ยังไม่ได้รับ</span>
            <strong>{formatBaht(outstanding)}</strong>
          </div>
        </div>

        <Field label="วันที่รับเงิน" htmlFor="payment-date" required>
          <input
            id="payment-date"
            className="input"
            type="date"
            value={receivedOn}
            onChange={(event) => setReceivedOn(event.target.value)}
            disabled={busy}
          />
          {receivedOn && <p className="field-hint">{formatThaiDate(receivedOn)}</p>}
        </Field>

        <Field label="จำนวนเงิน (บาท)" htmlFor="payment-amount" required>
          <div className="input-unit-wrap">
            <input
              id="payment-amount"
              className="input"
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy}
              inputMode="decimal"
            />
            <span className="input-unit">บาท</span>
          </div>
        </Field>

        <Field label="หมายเหตุ" htmlFor="payment-note" hint="เช่น โอนรอบแรก / เงินสด">
          <input
            id="payment-note"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            disabled={busy}
          />
        </Field>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={18} />
            <span>{error}</span>
          </div>
        )}
        {error && <p className="retry-note">ค่าที่กรอกยังอยู่ครบ ลองบันทึกอีกครั้งได้เลย</p>}
      </form>
    </Modal>
  )
}
