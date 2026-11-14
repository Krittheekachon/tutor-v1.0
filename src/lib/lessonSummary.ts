import type { Course, LessonLog, Session } from './types'

export function buildLessonSummary(course: Course, log: LessonLog, logs: LessonLog[], sessions: Session[]) {
  const courseLogs = logs.filter(item => item.course_id === course.id).sort((a, b) =>
    a.taught_on.localeCompare(b.taught_on) ||
    (sessions.find(item => item.id === a.session_id)?.start_time ?? '').localeCompare(sessions.find(item => item.id === b.session_id)?.start_time ?? '') ||
    (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.id.localeCompare(b.id))
  const beforeMinutes = courseLogs.filter(item => item.taught_on < log.taught_on)
    .reduce((total, item) => total + item.actual_minutes, 0)
  const lessons = courseLogs.flatMap((item, index) => item.session_id === log.session_id
    ? [{ log: item, session: sessions.find(session => session.id === item.session_id), lessonNumber: index + 1 }] : [])
  const dailyMinutes = courseLogs.filter(item => item.taught_on === log.taught_on)
    .reduce((total, item) => total + item.actual_minutes, 0)
  const cumulativeMinutes = beforeMinutes + dailyMinutes
  return { lessons, beforeMinutes, dailyMinutes, cumulativeMinutes,
    remainingMinutes: Math.max(0, course.purchased_minutes - cumulativeMinutes),
    overMinutes: Math.max(0, cumulativeMinutes - course.purchased_minutes) }
}
