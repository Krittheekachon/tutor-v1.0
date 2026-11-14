import { sessionDurationMinutes, sessionEndInstant } from './date'
import type { Course, LessonLog, Session } from './types'

// Keep recorded history; allocate only the outstanding hours to upcoming appointments.
// Re-evaluated after every refresh, including moves, cancellations and edited logs.
export function selectCourseSessions<T extends Session>(course: Course, sessions: T[], logs: LessonLog[], now = new Date()): T[] {
  const courseLogs = logs.filter(log => log.course_id === course.id)
  const logged = new Set(courseLogs.map(log => log.session_id))
  let remaining = Math.max(0, course.purchased_minutes - courseLogs.reduce((sum, log) => sum + log.actual_minutes, 0))
  const selected = new Set<string>()
  const ordered = sessions.filter(session => session.course_id === course.id).sort((a, b) =>
    a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id))
  // A moved/extra appointment is an explicit commitment. Reserve its hours first
  // so moving a lesson beyond the original end extends that end instead of hiding it.
  if (!course.archived_at && remaining > 0) {
    for (const session of ordered) {
      if (logged.has(session.id) || session.status === 'canceled') continue
      if (sessionEndInstant(session.session_date, session.end_time).getTime() <= now.getTime()) continue
      if (session.status !== 'moved' && session.kind !== 'extra') continue
      selected.add(session.id)
      remaining -= sessionDurationMinutes(session.start_time, session.end_time)
    }
  }
  for (const session of ordered) {
    if (selected.has(session.id)) continue
    const past = sessionEndInstant(session.session_date, session.end_time).getTime() <= now.getTime()
    if (logged.has(session.id) || past) {
      selected.add(session.id)
      continue
    }
    if (course.archived_at) continue
    if (session.status === 'canceled') {
      if (remaining > 0) selected.add(session.id)
      continue
    }
    if (remaining <= 0) continue
    selected.add(session.id)
    remaining -= sessionDurationMinutes(session.start_time, session.end_time)
  }
  return sessions.filter(session => selected.has(session.id))
}
