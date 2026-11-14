import {
  addDaysKey,
  addMonthsKey,
  isDateKey,
  isValidTime,
  normalizeTime,
  todayKey,
} from './date'
import { toThaiError } from './errors'
import { selectCourseSessions } from './courseSessions'
import { generateRuleDates, validateSlots } from './schedule'
import {
  MAX_FILE_BYTES,
  requireSupabase,
  SIGNED_URL_TTL_SECONDS,
  SUPABASE_BUCKET,
} from './supabase'
import type {
  AppData,
  Attachment,
  Course,
  LessonLog,
  Payment,
  ScheduleRule,
  ScheduleSlotInput,
  Session,
  Student,
} from './types'

const PAGE_SIZE = 1000
const SESSION_HORIZON_MONTHS = 36

const ALLOWED_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'txt',
  'doc',
  'docx',
  'xls',
  'xlsx',
])

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

function contentTypeForFile(file: File): string {
  if (file.type && ALLOWED_FILE_MIME_TYPES.has(file.type)) return file.type
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? 'text/plain'
}

async function fetchAll<T>(table: string): Promise<T[]> {
  const client = requireSupabase()
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(toThaiError(error))
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function ensureRegularSessions(
  ownerId: string,
  data: Pick<AppData, 'courses' | 'rules' | 'sessions' | 'logs'>,
): Promise<number> {
  const client = requireSupabase()
  const today = todayKey()
  const horizon = addMonthsKey(today, SESSION_HORIZON_MONTHS)
  const existingKeys = new Set(data.sessions.map((session) => session.recurrence_key))
  const rows: Array<Record<string, unknown>> = []

  for (const course of data.courses) {
    if (course.archived_at) continue
    const courseRules = data.rules.filter((rule) => rule.course_id === course.id && rule.active)
    if (courseRules.length === 0) continue
    const startFloor = course.start_date > today ? course.start_date : today
    const endLimit = horizon

    for (const rule of courseRules) {
      const dates = generateRuleDates(rule, startFloor, endLimit)
      for (const date of dates) {
        const recurrenceKey = `${rule.id}:${date}`
        if (existingKeys.has(recurrenceKey)) continue
        existingKeys.add(recurrenceKey)
        rows.push({
          owner_id: ownerId,
          course_id: course.id,
          rule_id: rule.id,
          kind: 'regular',
          recurrence_key: recurrenceKey,
          session_date: date,
          start_time: normalizeTime(rule.start_time),
          end_time: normalizeTime(rule.end_time),
          original_date: date,
          original_start_time: normalizeTime(rule.start_time),
          original_end_time: normalizeTime(rule.end_time),
          status: 'scheduled',
          note: '',
        })
      }
    }
  }

  const candidates = rows.map(row => ({ ...row, id: String(row.recurrence_key) })) as unknown as Session[]
  const neededKeys = new Set(data.courses.flatMap(course =>
    selectCourseSessions(course, [...data.sessions, ...candidates], data.logs).map(session => session.recurrence_key)))
  const neededRows = rows.filter(row => neededKeys.has(String(row.recurrence_key)))
  if (neededRows.length === 0) return 0

  for (let index = 0; index < neededRows.length; index += 400) {
    const batch = neededRows.slice(index, index + 400)
    const { error } = await client
      .from('sessions')
      .upsert(batch, { onConflict: 'owner_id,recurrence_key', ignoreDuplicates: true })
    if (error) throw new Error(toThaiError(error))
  }
  return neededRows.length
}

export async function loadAllData(ownerId: string): Promise<AppData> {
  const [students, courses, rules, sessions, logs, payments, attachments] = await Promise.all([
    fetchAll<Student>('students'),
    fetchAll<Course>('courses'),
    fetchAll<ScheduleRule>('schedule_rules'),
    fetchAll<Session>('sessions'),
    fetchAll<LessonLog>('lesson_logs'),
    fetchAll<Payment>('payments'),
    fetchAll<Attachment>('attachments'),
  ])

  const base: AppData = { students, courses, rules, sessions, logs, payments, attachments }
  const inserted = await ensureRegularSessions(ownerId, base)
  if (inserted > 0) {
    base.sessions = await fetchAll<Session>('sessions')
  }
  base.sessions = courses.flatMap(course => selectCourseSessions(course, base.sessions, logs))
  return base
}

export interface AuthResult {
  ok: boolean
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const client = requireSupabase()
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(toThaiError(error))
  return { ok: true }
}

/**
 * เริ่ม Google OAuth ผ่าน Supabase
 * ใช้ PKCE และ redirect กลับ origin ปัจจุบัน (ไม่พา hash ของแท็บไปด้วย)
 */
export async function signInWithGoogle(): Promise<void> {
  const client = requireSupabase()
  const redirectTo = `${window.location.origin}${window.location.pathname}`
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        prompt: 'select_account',
      },
    },
  })
  if (error) throw new Error(toThaiError(error))
}

export async function updateDisplayName(displayName: string): Promise<void> {
  const client = requireSupabase()
  const trimmed = displayName.trim()
  if (!trimmed) throw new Error('กรุณากรอกชื่อที่แสดง')
  if (Array.from(trimmed).length > 60) throw new Error('ชื่อที่แสดงต้องยาวไม่เกิน 60 ตัวอักษร')
  const { error } = await client.auth.updateUser({
    data: {
      display_name: trimmed,
    },
  })
  if (error) throw new Error(toThaiError(error))
}

export async function signOutUser(): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw new Error(toThaiError(error))
}

export interface CreateStudentInput {
  ownerId: string
  nickname: string
  colorHex: string
  subject: string
  startDate: string
  content: string
  purchasedMinutes: number
  priceBaht: number
  slots: ScheduleSlotInput[]
  files: File[]
}

export interface CreateCourseInput {
  ownerId: string
  studentId: string
  subject: string
  startDate: string
  content: string
  purchasedMinutes: number
  priceBaht: number
  slots: ScheduleSlotInput[]
  file: File | null
}

function validateCourseFields(input: {
  subject: string
  startDate: string
  purchasedMinutes: number
  priceBaht: number
}): void {
  if (!input.subject.trim()) throw new Error('กรุณากรอกวิชา')
  if (!input.startDate) throw new Error('กรุณาเลือกวันที่เริ่ม')
  if (!isDateKey(input.startDate)) throw new Error('วันที่เริ่มไม่ถูกต้อง')
  if (!Number.isFinite(input.purchasedMinutes) || input.purchasedMinutes <= 0) {
    throw new Error('จำนวนชั่วโมงที่ซื้อต้องมากกว่า 0')
  }
  if (!Number.isFinite(input.priceBaht) || input.priceBaht < 0) {
    throw new Error('ค่าเรียนต้องเป็น 0 บาทขึ้นไป')
  }
}

async function cleanupCourse(courseId: string, uploadedPath: string | string[] | null): Promise<void> {
  const client = requireSupabase()
  try {
    if (uploadedPath) await client.storage.from(SUPABASE_BUCKET).remove(Array.isArray(uploadedPath) ? uploadedPath : [uploadedPath])
  } catch {
    // เก็บกวาดไฟล์เป็น best effort
  }
  try {
    await client.from('courses').delete().eq('id', courseId)
  } catch {
    // เก็บกวาดฐานข้อมูลเป็น best effort
  }
}

export async function createStudentWithCourse(input: CreateStudentInput): Promise<string> {
  const client = requireSupabase()
  const nickname = input.nickname.trim()
  if (!nickname) throw new Error('กรุณากรอกชื่อเล่นนักเรียน')
  validateCourseFields(input)
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.colorHex)) throw new Error('สีประจำตัวต้องอยู่ในรูปแบบ #RRGGBB')
  if (input.slots.length > 0) {
    const slotError = validateSlots(input.slots)
    if (slotError) throw new Error(slotError)
  }

  for (const file of input.files) {
    const error = validateAttachmentFile(file)
    if (error) throw new Error(error)
  }

  const studentId = crypto.randomUUID()
  const courseId = crypto.randomUUID()
  const uploadedPaths: string[] = []

  try {
    const { error: studentError } = await client.from('students').insert({
      id: studentId,
      owner_id: input.ownerId,
      nickname,
      color_hex: input.colorHex,
    })
    if (studentError) throw new Error(toThaiError(studentError))

    const { error: courseError } = await client.from('courses').insert({
      id: courseId,
      owner_id: input.ownerId,
      student_id: studentId,
      subject: input.subject.trim(),
      start_date: input.startDate,
      content: input.content.trim(),
      purchased_minutes: Math.round(input.purchasedMinutes),
      price_baht: input.priceBaht,
    })
    if (courseError) throw new Error(toThaiError(courseError))

    if (input.slots.length > 0) {
      const { error: rulesError } = await client.from('schedule_rules').insert(
        input.slots.map((slot) => ({
          owner_id: input.ownerId,
          course_id: courseId,
          weekday: slot.weekday,
          start_time: slot.start_time,
          end_time: slot.end_time,
          effective_from: input.startDate,
          active: true,
        })),
      )
      if (rulesError) throw new Error(toThaiError(rulesError))
    }

    for (const file of input.files) {
      const uploaded = await uploadAttachment(input.ownerId, courseId, file)
      uploadedPaths.push(uploaded.storage_path)
    }
    return studentId
  } catch (error) {
    await cleanupCourse(courseId, uploadedPaths)
    await client.from('students').delete().eq('id', studentId)
    throw error
  }
}

export async function createCourse(input: CreateCourseInput): Promise<string> {
  const client = requireSupabase()
  validateCourseFields(input)
  if (input.slots.length > 0) {
    const slotError = validateSlots(input.slots)
    if (slotError) throw new Error(slotError)
  }

  const courseId = crypto.randomUUID()
  let uploadedPath: string | null = null
  try {
    const { error: courseError } = await client.from('courses').insert({
      id: courseId,
      owner_id: input.ownerId,
      student_id: input.studentId,
      subject: input.subject.trim(),
      start_date: input.startDate,
      content: input.content.trim(),
      purchased_minutes: Math.round(input.purchasedMinutes),
      price_baht: input.priceBaht,
    })
    if (courseError) throw new Error(toThaiError(courseError))

    if (input.slots.length > 0) {
      const { error: rulesError } = await client.from('schedule_rules').insert(
        input.slots.map((slot) => ({
          owner_id: input.ownerId,
          course_id: courseId,
          weekday: slot.weekday,
          start_time: slot.start_time,
          end_time: slot.end_time,
          effective_from: input.startDate,
          active: true,
        })),
      )
      if (rulesError) throw new Error(toThaiError(rulesError))
    }

    if (input.file) {
      const uploaded = await uploadAttachment(input.ownerId, courseId, input.file)
      uploadedPath = uploaded.storage_path
    }
    return courseId
  } catch (error) {
    await cleanupCourse(courseId, uploadedPath)
    throw error
  }
}

export async function updateStudent(input: {
  studentId: string
  nickname: string
  colorHex: string
}): Promise<void> {
  const client = requireSupabase()
  if (!input.nickname.trim()) throw new Error('กรุณากรอกชื่อเล่นนักเรียน')
  if (!/^#[0-9A-Fa-f]{6}$/.test(input.colorHex)) throw new Error('สีประจำตัวต้องอยู่ในรูปแบบ #RRGGBB')
  const { error } = await client
    .from('students')
    .update({ nickname: input.nickname.trim(), color_hex: input.colorHex })
    .eq('id', input.studentId)
  if (error) throw new Error(toThaiError(error))
}

export async function updateCourse(input: {
  ownerId: string
  courseId: string
  subject: string
  startDate: string
  content: string
  purchasedMinutes: number
  priceBaht: number
  file: File | null
}): Promise<void> {
  const client = requireSupabase()
  validateCourseFields(input)
  const { error } = await client
    .from('courses')
    .update({
      subject: input.subject.trim(),
      start_date: input.startDate,
      content: input.content.trim(),
      purchased_minutes: Math.round(input.purchasedMinutes),
      price_baht: input.priceBaht,
    })
    .eq('id', input.courseId)
  if (error) throw new Error(toThaiError(error))

  if (input.file) {
    await uploadAttachment(input.ownerId, input.courseId, input.file)
  }
}

export interface ReplaceScheduleInput {
  ownerId: string
  courseId: string
  effectiveFrom: string
  slots: ScheduleSlotInput[]
  today: string
}

export async function replaceSchedule(input: ReplaceScheduleInput): Promise<void> {
  const client = requireSupabase()
  if (!input.effectiveFrom || !isDateKey(input.effectiveFrom) || input.effectiveFrom < input.today) {
    throw new Error('วันที่มีผลต้องเป็นวันนี้หรือวันในอนาคต')
  }
  const slotError = validateSlots(input.slots)
  if (slotError) throw new Error(slotError)

  const { data: activeRules, error: rulesReadError } = await client
    .from('schedule_rules')
    .select('*')
    .eq('course_id', input.courseId)
    .eq('active', true)
  if (rulesReadError) throw new Error(toThaiError(rulesReadError))

  for (const rule of (activeRules ?? []) as ScheduleRule[]) {
    const closingDate = input.effectiveFrom > rule.effective_from
      ? addDaysKey(input.effectiveFrom, -1)
      : rule.effective_from
    const effectiveTo = rule.effective_to && rule.effective_to < closingDate
      ? rule.effective_to
      : closingDate
    const { error } = await client
      .from('schedule_rules')
      .update({ active: false, effective_to: effectiveTo })
      .eq('id', rule.id)
    if (error) throw new Error(toThaiError(error))
  }

  // Read every page: a course with many weekly slots can exceed PostgREST's row limit.
  const futureSessions: Array<{ id: string }> = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: sessionsError } = await client
      .from('sessions')
      .select('id')
      .eq('course_id', input.courseId)
      .eq('kind', 'regular')
      .eq('status', 'scheduled')
      .gte('session_date', input.effectiveFrom)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (sessionsError) throw new Error(toThaiError(sessionsError))
    futureSessions.push(...((page ?? []) as Array<{ id: string }>))
    if ((page ?? []).length < PAGE_SIZE) break
  }

  const futureIds = (futureSessions ?? []).map((row) => (row as { id: string }).id)
  if (futureIds.length > 0) {
    const taughtIds = new Set<string>()
    for (let index = 0; index < futureIds.length; index += 200) {
      const { data: logs, error: logsError } = await client
        .from('lesson_logs')
        .select('session_id')
        .in('session_id', futureIds.slice(index, index + 200))
      if (logsError) throw new Error(toThaiError(logsError))
      for (const row of logs ?? []) taughtIds.add((row as { session_id: string }).session_id)
    }
    const deletable = futureIds.filter((id) => !taughtIds.has(id))
    for (let index = 0; index < deletable.length; index += 200) {
      const batch = deletable.slice(index, index + 200)
      const { error } = await client.from('sessions').delete().in('id', batch)
      if (error) throw new Error(toThaiError(error))
    }
  }

  const { error: insertError } = await client.from('schedule_rules').insert(
    input.slots.map((slot) => ({
      owner_id: input.ownerId,
      course_id: input.courseId,
      weekday: slot.weekday,
      start_time: slot.start_time,
      end_time: slot.end_time,
      effective_from: input.effectiveFrom,
      active: true,
    })),
  )
  if (insertError) throw new Error(toThaiError(insertError))
}

export async function createExtraSession(input: {
  ownerId: string
  courseId: string
  date: string
  startTime: string
  endTime: string
  note: string
}): Promise<Session> {
  const client = requireSupabase()
  if (!input.date || !isDateKey(input.date)) throw new Error('กรุณาเลือกวันที่สอนให้ถูกต้อง')
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    throw new Error('กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:MM')
  }
  if (input.endTime <= input.startTime) throw new Error('เวลาจบต้องมากกว่าเวลาเริ่ม')
  const { data, error } = await client
    .from('sessions')
    .insert({
      owner_id: input.ownerId,
      course_id: input.courseId,
      rule_id: null,
      kind: 'extra',
      recurrence_key: `extra:${crypto.randomUUID()}`,
      session_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      original_date: input.date,
      original_start_time: input.startTime,
      original_end_time: input.endTime,
      status: 'scheduled',
      note: input.note.trim(),
    })
    .select('*')
    .single()
  if (error) throw new Error(toThaiError(error))
  return data as Session
}

export async function moveSession(input: {
  sessionId: string
  date: string
  startTime: string
  endTime: string
  note?: string
}): Promise<void> {
  const client = requireSupabase()
  if (!input.date || !isDateKey(input.date)) throw new Error('กรุณาเลือกวันที่ใหม่ให้ถูกต้อง')
  if (!isValidTime(input.startTime) || !isValidTime(input.endTime)) {
    throw new Error('กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:MM')
  }
  if (input.endTime <= input.startTime) throw new Error('เวลาจบต้องมากกว่าเวลาเริ่ม')
  const patch: Record<string, unknown> = {
    session_date: input.date,
    start_time: input.startTime,
    end_time: input.endTime,
    status: 'moved',
  }
  if (input.note !== undefined) patch.note = input.note.trim()
  const { error } = await client.from('sessions').update(patch).eq('id', input.sessionId)
  if (error) throw new Error(toThaiError(error))
}

export async function cancelSession(sessionId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('sessions').update({ status: 'canceled' }).eq('id', sessionId)
  if (error) throw new Error(toThaiError(error))
}

export async function updateSessionNote(sessionId: string, note: string): Promise<void> {
  const client = requireSupabase()
  const trimmed = note.trim()
  if (Array.from(trimmed).length > 5000) {
    throw new Error('โน้ตต้องยาวไม่เกิน 5,000 ตัวอักษร')
  }
  const { error } = await client
    .from('sessions')
    .update({ note: trimmed })
    .eq('id', sessionId)
  if (error) throw new Error(toThaiError(error))
}

export async function restoreSession(session: Session): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('sessions')
    .update({
      status: 'scheduled',
      session_date: session.original_date,
      start_time: session.original_start_time,
      end_time: session.original_end_time,
    })
    .eq('id', session.id)
  if (error) throw new Error(toThaiError(error))
}

export async function recordLesson(input: {
  ownerId: string
  sessionId: string
  courseId: string
  taughtOn: string
  actualMinutes: number
}): Promise<void> {
  const client = requireSupabase()
  if (!Number.isInteger(input.actualMinutes) || input.actualMinutes <= 0 || input.actualMinutes > 1440) {
    throw new Error('เวลาที่สอนจริงต้องอยู่ระหว่าง 1 นาที ถึง 24 ชั่วโมง')
  }
  if (!input.taughtOn || !isDateKey(input.taughtOn)) throw new Error('กรุณาเลือกวันที่สอนจริง')
  const { error } = await client.from('lesson_logs').upsert(
    {
      owner_id: input.ownerId,
      session_id: input.sessionId,
      course_id: input.courseId,
      taught_on: input.taughtOn,
      actual_minutes: input.actualMinutes,
    },
    { onConflict: 'session_id' },
  )
  if (error) throw new Error(toThaiError(error))
}

export async function deleteLesson(sessionId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('lesson_logs').delete().eq('session_id', sessionId)
  if (error) throw new Error(toThaiError(error))
}

export async function addPayment(input: {
  ownerId: string
  courseId: string
  receivedOn: string
  amountBaht: number
  note: string
}): Promise<void> {
  const client = requireSupabase()
  if (!input.receivedOn || !isDateKey(input.receivedOn)) throw new Error('กรุณาเลือกวันที่รับเงิน')
  if (!Number.isFinite(input.amountBaht) || input.amountBaht <= 0) {
    throw new Error('จำนวนเงินที่รับต้องมากกว่า 0 บาท')
  }
  const { error } = await client.from('payments').insert({
    owner_id: input.ownerId,
    course_id: input.courseId,
    received_on: input.receivedOn,
    amount_baht: input.amountBaht,
    note: input.note.trim(),
  })
  if (error) throw new Error(toThaiError(error))
}

export async function deletePayment(paymentId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('payments').delete().eq('id', paymentId)
  if (error) throw new Error(toThaiError(error))
}

export function validateAttachmentFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_FILE_EXTENSIONS.has(extension) && !ALLOWED_FILE_MIME_TYPES.has(file.type)) {
    return 'ประเภทไฟล์นี้ยังไม่รองรับ กรุณาใช้ PDF รูปภาพ เอกสาร Word/Excel หรือไฟล์ข้อความ'
  }
  if (file.size > MAX_FILE_BYTES) return 'ไฟล์มีขนาดใหญ่เกิน 20 MB'
  return null
}

function safeStorageFileName(name: string): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || 'file').slice(-140)
}

export async function uploadAttachment(
  ownerId: string,
  courseId: string,
  file: File,
  sessionId?: string,
): Promise<Attachment> {
  const client = requireSupabase()
  const fileError = validateAttachmentFile(file)
  if (fileError) throw new Error(fileError)
  const path = `${ownerId}/${courseId}/${sessionId ? `notes/${sessionId}/` : ''}${crypto.randomUUID()}-${safeStorageFileName(file.name)}`
  const { error: uploadError } = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(path, file, {
      contentType: contentTypeForFile(file),
      upsert: false,
    })
  if (uploadError) throw new Error(toThaiError(uploadError))

  const { data, error } = await client
    .from('attachments')
    .insert({
      owner_id: ownerId,
      course_id: courseId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select('*')
    .single()
  if (error) {
    await client.storage.from(SUPABASE_BUCKET).remove([path])
    throw new Error(toThaiError(error))
  }
  return data as Attachment
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const client = requireSupabase()
  const { error: storageError } = await client.storage
    .from(SUPABASE_BUCKET)
    .remove([attachment.storage_path])
  if (storageError) throw new Error(toThaiError(storageError))
  const { error } = await client.from('attachments').delete().eq('id', attachment.id)
  if (error) throw new Error(toThaiError(error))
}

export async function createAttachmentSignedUrl(path: string): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.storage
    .from(SUPABASE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error) throw new Error(toThaiError(error))
  if (!data?.signedUrl) throw new Error('สร้างลิงก์ไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง')
  return data.signedUrl
}

async function removeCourseFiles(courseIds: string[]): Promise<void> {
  if (courseIds.length === 0) return
  const client = requireSupabase()
  const { data, error } = await client
    .from('attachments')
    .select('*')
    .in('course_id', courseIds)
  if (error) throw new Error(toThaiError(error))
  const paths = ((data ?? []) as Attachment[]).map((attachment) => attachment.storage_path)
  if (paths.length > 0) {
    const { error: storageError } = await client.storage.from(SUPABASE_BUCKET).remove(paths)
    if (storageError) throw new Error(toThaiError(storageError))
  }
}

async function assertNoHistory(courseIds: string[]): Promise<void> {
  if (courseIds.length === 0) return
  const client = requireSupabase()
  const [logsResult, paymentsResult] = await Promise.all([
    client.from('lesson_logs').select('id').in('course_id', courseIds).limit(1),
    client.from('payments').select('id').in('course_id', courseIds).limit(1),
  ])
  if (logsResult.error) throw new Error(toThaiError(logsResult.error))
  if (paymentsResult.error) throw new Error(toThaiError(paymentsResult.error))
  if ((logsResult.data ?? []).length > 0 || (paymentsResult.data ?? []).length > 0) {
    throw new Error(
      'รายการนี้มีประวัติการสอนหรือการรับเงินแล้ว จึงลบไม่ได้ กรุณาใช้ «เก็บเข้าคลัง» เพื่อซ่อนโดยเก็บประวัติไว้',
    )
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  const client = requireSupabase()
  await assertNoHistory([courseId])
  await removeCourseFiles([courseId])
  const { error } = await client.from('courses').delete().eq('id', courseId)
  if (error) throw new Error(toThaiError(error))
}

export async function deleteStudent(studentId: string, courseIds: string[]): Promise<void> {
  const client = requireSupabase()
  await assertNoHistory(courseIds)
  await removeCourseFiles(courseIds)
  const { error } = await client.from('students').delete().eq('id', studentId)
  if (error) throw new Error(toThaiError(error))
}

export async function archiveCourse(courseId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('courses')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', courseId)
  if (error) throw new Error(toThaiError(error))
}

export async function restoreCourse(courseId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('courses')
    .update({ archived_at: null })
    .eq('id', courseId)
  if (error) throw new Error(toThaiError(error))
}

export async function archiveStudent(studentId: string): Promise<void> {
  const client = requireSupabase()
  const archivedAt = new Date().toISOString()
  const { error } = await client
    .from('students')
    .update({ archived_at: archivedAt })
    .eq('id', studentId)
  if (error) throw new Error(toThaiError(error))
  const { error: coursesError } = await client
    .from('courses')
    .update({ archived_at: archivedAt })
    .eq('student_id', studentId)
  if (coursesError) throw new Error(toThaiError(coursesError))
}

export async function restoreStudent(studentId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client
    .from('students')
    .update({ archived_at: null })
    .eq('id', studentId)
  if (error) throw new Error(toThaiError(error))
  const { error: coursesError } = await client
    .from('courses')
    .update({ archived_at: null })
    .eq('student_id', studentId)
  if (coursesError) throw new Error(toThaiError(coursesError))
}
