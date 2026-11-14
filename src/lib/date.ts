export const BANGKOK_TIME_ZONE = 'Asia/Bangkok'
export const THAI_LOCALE = 'th-TH-u-ca-buddhist'

export const WEEKDAY_LONG: Record<number, string> = {
  1: 'จันทร์',
  2: 'อังคาร',
  3: 'พุธ',
  4: 'พฤหัสบดี',
  5: 'ศุกร์',
  6: 'เสาร์',
  7: 'อาทิตย์',
}

export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'จ.',
  2: 'อ.',
  3: 'พ.',
  4: 'พฤ.',
  5: 'ศ.',
  6: 'ส.',
  7: 'อา.',
}

// ปฏิทินเริ่มสัปดาห์วันอาทิตย์ (อา. → ส.)
export const CALENDAR_WEEKDAY_HEADERS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function partsToRecord(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
}

/** วันที่ปัจจุบันในเขตเวลา Asia/Bangkok ในรูปแบบ YYYY-MM-DD */
export function todayKey(now: Date = new Date()): string {
  const parts = partsToRecord(dateKeyFormatter.formatToParts(now))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** เวลาปัจจุบันในเขตเวลา Asia/Bangkok ในรูปแบบ HH:MM */
export function nowTimeKey(now: Date = new Date()): string {
  return timeFormatter.format(now)
}

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60
}

export function normalizeTime(value: string): string {
  if (!value) return ''
  return value.slice(0, 5)
}

export function dateKeyParts(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number)
  return { year, month, day }
}

export function utcDateFromKey(dateKey: string): Date {
  const { year, month, day } = dateKeyParts(dateKey)
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

export function dateKeyFromUTC(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDaysKey(dateKey: string, days: number): string {
  const date = utcDateFromKey(dateKey)
  date.setUTCDate(date.getUTCDate() + days)
  return dateKeyFromUTC(date)
}

export function addMonthsKey(dateKey: string, months: number): string {
  const { year, month, day } = dateKeyParts(dateKey)
  const target = new Date(Date.UTC(year, month - 1 + months, 1, 12, 0, 0))
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12, 0, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return dateKeyFromUTC(target)
}

export function diffDaysKey(from: string, to: string): number {
  const fromMs = utcDateFromKey(from).getTime()
  const toMs = utcDateFromKey(to).getTime()
  return Math.round((toMs - fromMs) / 86_400_000)
}

export function weekdayFromDateKey(dateKey: string): number {
  const day = utcDateFromKey(dateKey).getUTCDay()
  return day === 0 ? 7 : day
}

export function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`
}

export function yearMonthFromKey(dateKey: string): { year: number; monthIndex: number } {
  const { year, month } = dateKeyParts(dateKey)
  return { year, monthIndex: month - 1 }
}

export function yearMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
}

export function calendarGridDays(year: number, monthIndex: number): string[] {
  const firstKey = yearMonthKey(year, monthIndex)
  // weekdayFromDateKey: 1 = จันทร์ … 7 = อาทิตย์
  // ถ้าเริ่มสัปดาห์ด้วยอาทิตย์ วันที่ 1 ของเดือนต้องมี leading = 0 เมื่อเป็นวันอาทิตย์
  const leading = weekdayFromDateKey(firstKey) % 7
  const start = addDaysKey(firstKey, -leading)
  return Array.from({ length: 42 }, (_, index) => addDaysKey(start, index))
}

export function isSameMonth(dateKey: string, year: number, monthIndex: number): boolean {
  return dateKey.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`)
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, monthIndex, 1, 12)))
}

export function formatThaiDateLong(dateKey: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(utcDateFromKey(dateKey))
}

export function formatThaiDate(dateKey: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(utcDateFromKey(dateKey))
}

export function formatThaiDateShort(dateKey: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(utcDateFromKey(dateKey))
}

export function formatThaiNumericDate(dateKey: string): string {
  return new Intl.DateTimeFormat(THAI_LOCALE, {
    timeZone: BANGKOK_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(utcDateFromKey(dateKey))
}

export function formatTime(time: string): string {
  return normalizeTime(time)
}

export function formatTimeThai(time: string): string {
  return `${normalizeTime(time)} น.`
}

export function formatTimeRange(start: string, end: string): string {
  return `${normalizeTime(start)}–${normalizeTime(end)}`
}

export function timeToMinutes(time: string): number {
  const [hour, minute] = normalizeTime(time).split(':').map(Number)
  return (hour || 0) * 60 + (minute || 0)
}

export function minutesToTime(minutes: number): string {
  const safe = Math.max(0, Math.min(1439, Math.round(minutes)))
  const hour = Math.floor(safe / 60)
  const minute = safe % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function sessionDurationMinutes(startTime: string, endTime: string): number {
  return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime))
}

export function durationBetweenKeys(startDate: string, startTime: string, endDate: string, endTime: string): number {
  return (
    diffDaysKey(startDate, endDate) * 1440 +
    timeToMinutes(endTime) -
    timeToMinutes(startTime)
  )
}

export function combineDateAndTime(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${normalizeTime(time)}:00+07:00`)
}

export function sessionEndInstant(dateKey: string, endTime: string): Date {
  return combineDateAndTime(dateKey, endTime)
}

export function sessionStartInstant(dateKey: string, startTime: string): Date {
  return combineDateAndTime(dateKey, startTime)
}

export function formatDuration(minutes: number, style: 'long' | 'short' = 'long'): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const mins = safe % 60
  if (style === 'short') {
    if (hours === 0) return `${mins} น.`
    if (mins === 0) return `${hours} ชม.`
    return `${hours} ชม. ${mins} น.`
  }
  if (hours === 0) return `${mins} นาที`
  if (mins === 0) return `${hours} ชั่วโมง`
  return `${hours} ชั่วโมง ${mins} นาที`
}

export function formatMinutesInput(minutes: number): { hours: string; minutes: string } {
  const safe = Math.max(0, Math.round(minutes))
  return {
    hours: String(Math.floor(safe / 60)),
    minutes: String(safe % 60),
  }
}

export function formatBaht(value: number, withSatang = false): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: withSatang ? 2 : 0,
    maximumFractionDigits: withSatang ? 2 : 2,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(value)
}

export function formatPercent(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(rounded)}%`
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatScheduleRule(weekday: number, start: string, end: string): string {
  return `${WEEKDAY_SHORT[weekday] ?? ''} ${formatTimeRange(start, end)}`
}

export function formatScheduleList(
  rules: Array<{ weekday: number; start_time: string; end_time: string }>,
): string {
  if (rules.length === 0) return 'ยังไม่ตั้งตาราง'
  const byWeekday = new Map<number, string[]>()
  for (const rule of rules) {
    const list = byWeekday.get(rule.weekday) ?? []
    list.push(formatTimeRange(rule.start_time, rule.end_time))
    byWeekday.set(rule.weekday, list)
  }
  return [...byWeekday.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, ranges]) => `${WEEKDAY_SHORT[weekday]} ${ranges.join(', ')}`)
    .join(' • ')
}

export function startOfWeekKey(dateKey: string): string {
  return addDaysKey(dateKey, -(weekdayFromDateKey(dateKey) - 1))
}

export function isFutureSession(dateKey: string, time: string, now: Date = new Date()): boolean {
  return sessionStartInstant(dateKey, time).getTime() > now.getTime()
}

export function isSessionNotEnded(dateKey: string, endTime: string, now: Date = new Date()): boolean {
  return sessionEndInstant(dateKey, endTime).getTime() > now.getTime()
}

export function dateTimeAttr(dateKey: string, time: string): string {
  return `${dateKey}T${normalizeTime(time)}:00+07:00`
}
