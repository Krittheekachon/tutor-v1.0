import { calculateStudentStats } from './calc'
import { formatScheduleList, formatThaiDate, todayKey } from './date'
import type { AppData } from './types'

export type StudentSort = 'name' | 'remaining-desc' | 'remaining-asc' | 'end-asc' | 'end-desc'

export function studentListRows(data: AppData, options: {
  archived: boolean; search: string; weekday: string; subject: string; sort: StudentSort
}) {
  const query = options.search.trim().toLocaleLowerCase('th')
  const hasFilters = Boolean(options.weekday || options.subject)
  const today = todayKey()
  return data.students.filter(student => Boolean(student.archived_at) === options.archived)
    .filter(student => !query || student.nickname.toLocaleLowerCase('th').includes(query))
    .flatMap(student => {
      const courses = data.courses.filter(course => course.student_id === student.id &&
        (student.archived_at || !course.archived_at) &&
        (!options.subject || course.subject === options.subject) &&
        (!options.weekday || data.rules.some(rule => rule.course_id === course.id && rule.active &&
          (!rule.effective_to || rule.effective_to >= today) && rule.weekday === Number(options.weekday))))
      if (hasFilters && !courses.length) return []
      const courseIds = new Set(courses.map(course => course.id))
      const rules = data.rules.filter(rule => courseIds.has(rule.course_id) && rule.active &&
        (!rule.effective_to || rule.effective_to >= today))
      const stats = calculateStudentStats(courses, data.logs, data.sessions, data.payments)
      const endDate = stats.completionDate ?? (stats.canEstimate ? stats.estimatedEndDate : null)
      return [{ student, subjects: [...new Set(courses.map(course => course.subject))],
        schedule: formatScheduleList(rules), rules, stats, endDate,
        endLabel: endDate ? formatThaiDate(endDate) : 'ยังประเมินไม่ได้', courseCount: courses.length }]
    }).sort((a, b) => {
      const byName = () => a.student.nickname.localeCompare(b.student.nickname, 'th')
      if (options.sort === 'remaining-desc') return b.stats.remainingMinutes - a.stats.remainingMinutes || byName()
      if (options.sort === 'remaining-asc') return a.stats.remainingMinutes - b.stats.remainingMinutes || byName()
      if (options.sort === 'end-asc' || options.sort === 'end-desc') {
        if (!a.endDate || !b.endDate) return a.endDate ? -1 : b.endDate ? 1 : byName()
        return a.endDate.localeCompare(b.endDate) * (options.sort === 'end-asc' ? 1 : -1) || byName()
      }
      return byName()
    })
}
