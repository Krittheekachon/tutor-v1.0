import { useEffect, useState } from 'react'

function formatTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d:]/g, '').slice(0, 5)
  if (cleaned.includes(':')) {
    const [hourPart = '', minutePart = ''] = cleaned.split(':')
    const hour = hourPart.slice(0, 2)
    const minute = minutePart.slice(0, 2)
    if (hour.length === 1 && minute.length === 2) return `0${hour}:${minute}`
    return `${hour}:${minute}`.slice(0, 5)
  }
  const digits = cleaned.replace(/:/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return digits
}

function normalizeOnBlur(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return value
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return value
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * ช่องเวลาแบบบังคับ 24 ชั่วโมง (HH:MM)
 * ใช้ text input เพื่อไม่ให้เบราว์เซอร์บาง locale แสดง AM/PM
 */
export function TimeInput({
  id,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  ariaLabel?: string
}) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  return (
    <input
      id={id}
      className="input time-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="HH:MM"
      maxLength={5}
      value={text}
      aria-label={ariaLabel}
      title="เวลา 24 ชั่วโมง เช่น 09:00 หรือ 16:30"
      onChange={(event) => {
        const next = formatTyping(event.target.value)
        setText(next)
        onChange(next)
      }}
      onBlur={() => {
        const normalized = normalizeOnBlur(text)
        setText(normalized)
        onChange(normalized)
      }}
      disabled={disabled}
      spellCheck={false}
    />
  )
}
