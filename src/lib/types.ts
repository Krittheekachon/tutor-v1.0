export type SessionKind = 'regular' | 'extra'
export type SessionStatus = 'scheduled' | 'moved' | 'canceled'

export interface Student {
  id: string
  owner_id: string
  nickname: string
  color_hex: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  owner_id: string
  student_id: string
  subject: string
  start_date: string
  content: string
  purchased_minutes: number
  price_baht: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleRule {
  id: string
  owner_id: string
  course_id: string
  weekday: number
  start_time: string
  end_time: string
  effective_from: string
  effective_to: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  owner_id: string
  course_id: string
  rule_id: string | null
  kind: SessionKind
  recurrence_key: string
  session_date: string
  start_time: string
  end_time: string
  original_date: string
  original_start_time: string
  original_end_time: string
  status: SessionStatus
  note: string
  created_at: string
  updated_at: string
}

export interface LessonLog {
  id: string
  owner_id: string
  session_id: string
  course_id: string
  taught_on: string
  actual_minutes: number
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  owner_id: string
  course_id: string
  received_on: string
  amount_baht: number
  note: string
  created_at: string
  updated_at: string
}

export interface Attachment {
  id: string
  owner_id: string
  course_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export interface AppData {
  students: Student[]
  courses: Course[]
  rules: ScheduleRule[]
  sessions: Session[]
  logs: LessonLog[]
  payments: Payment[]
  attachments: Attachment[]
}

export interface ScheduleSlotInput {
  id?: string
  weekday: number
  start_time: string
  end_time: string
}

export interface SessionWithContext {
  session: Session
  course: Course
  student: Student
  log: LessonLog | null
  attachmentList: Attachment[]
  actualMinutesInCourse: number
  progressPct: number
}
