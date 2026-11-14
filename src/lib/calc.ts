import {
  sessionDurationMinutes,
  sessionEndInstant,
} from './date'
import type { Course, LessonLog, Payment, Session } from './types'

export interface CourseStats {
  purchasedMinutes: number
  actualMinutes: number
  remainingMinutes: number
  overMinutes: number
  progressPct: number
  valueTaughtBaht: number
  paymentTotalBaht: number
  priceBaht: number
  completionDate: string | null
  estimatedEndDate: string | null
  canEstimate: boolean
  estimateShortfallMinutes: number
  plannedFutureMinutes: number
}

export interface StudentStats {
  purchasedMinutes: number
  actualMinutes: number
  remainingMinutes: number
  overMinutes: number
  progressPct: number
  valueTaughtBaht: number
  paymentTotalBaht: number
  priceBaht: number
  completionDate: string | null
  estimatedEndDate: string | null
  canEstimate: boolean
  estimateShortfallMinutes: number
  courseCount: number
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateCourseStats(
  course: Course,
  logs: LessonLog[],
  sessions: Session[],
  payments: Payment[],
  now: Date = new Date(),
): CourseStats {
  const courseLogs = logs
    .filter((log) => log.course_id === course.id)
    .sort((a, b) => {
      const taughtCompare = a.taught_on.localeCompare(b.taught_on)
      if (taughtCompare !== 0) return taughtCompare
      return a.created_at.localeCompare(b.created_at)
    })

  const actualMinutes = courseLogs.reduce((total, log) => total + log.actual_minutes, 0)
  const purchasedMinutes = course.purchased_minutes
  const remainingMinutes = Math.max(0, purchasedMinutes - actualMinutes)
  const overMinutes = Math.max(0, actualMinutes - purchasedMinutes)
  const progressPct = purchasedMinutes > 0
    ? Math.min(100, (actualMinutes / purchasedMinutes) * 100)
    : 0
  const priceBaht = Number(course.price_baht) || 0
  const valueTaughtBaht = purchasedMinutes > 0
    ? roundMoney(Math.min(priceBaht, (priceBaht * Math.min(actualMinutes, purchasedMinutes)) / purchasedMinutes))
    : 0

  let completionDate: string | null = null
  if (actualMinutes >= purchasedMinutes && courseLogs.length > 0) {
    let cumulative = 0
    for (const log of courseLogs) {
      cumulative += log.actual_minutes
      if (cumulative >= purchasedMinutes) {
        completionDate = log.taught_on
        break
      }
    }
  }

  const loggedSessionIds = new Set(courseLogs.map((log) => log.session_id))
  const futureSessions = sessions
    .filter((session) => {
      if (session.course_id !== course.id) return false
      if (session.status === 'canceled') return false
      if (loggedSessionIds.has(session.id)) return false
      return sessionEndInstant(session.session_date, session.end_time).getTime() > now.getTime()
    })
    .sort((a, b) => {
      const dateCompare = a.session_date.localeCompare(b.session_date)
      if (dateCompare !== 0) return dateCompare
      return a.start_time.localeCompare(b.start_time)
    })

  let estimatedEndDate: string | null = null
  let canEstimate = false
  let plannedFutureMinutes = 0
  let estimateShortfallMinutes = 0

  if (remainingMinutes > 0 && !course.archived_at) {
    let cumulative = 0
    for (const session of futureSessions) {
      cumulative += sessionDurationMinutes(session.start_time, session.end_time)
      if (cumulative >= remainingMinutes) {
        estimatedEndDate = session.session_date
        canEstimate = true
        break
      }
    }
    plannedFutureMinutes = futureSessions.reduce(
      (total, session) => total + sessionDurationMinutes(session.start_time, session.end_time),
      0,
    )
    if (!canEstimate) {
      estimateShortfallMinutes = Math.max(0, remainingMinutes - plannedFutureMinutes)
    }
  }

  return {
    purchasedMinutes,
    actualMinutes,
    remainingMinutes,
    overMinutes,
    progressPct,
    valueTaughtBaht,
    paymentTotalBaht: roundMoney(
      payments
        .filter((payment) => payment.course_id === course.id)
        .reduce((total, payment) => total + Number(payment.amount_baht), 0),
    ),
    priceBaht,
    completionDate,
    estimatedEndDate,
    canEstimate,
    estimateShortfallMinutes,
    plannedFutureMinutes,
  }
}

export function calculateStudentStats(
  courses: Course[],
  logs: LessonLog[],
  sessions: Session[],
  payments: Payment[],
  now: Date = new Date(),
): StudentStats {
  const courseStats = courses.map((course) =>
    calculateCourseStats(course, logs, sessions, payments, now),
  )

  const purchasedMinutes = courseStats.reduce((total, stat) => total + stat.purchasedMinutes, 0)
  const actualMinutes = courseStats.reduce((total, stat) => total + stat.actualMinutes, 0)
  const remainingMinutes = Math.max(0, purchasedMinutes - actualMinutes)
  const overMinutes = Math.max(0, actualMinutes - purchasedMinutes)
  const progressPct = purchasedMinutes > 0 ? Math.min(100, (actualMinutes / purchasedMinutes) * 100) : 0
  const valueTaughtBaht = roundMoney(courseStats.reduce((total, stat) => total + stat.valueTaughtBaht, 0))
  const paymentTotalBaht = roundMoney(courseStats.reduce((total, stat) => total + stat.paymentTotalBaht, 0))
  const priceBaht = roundMoney(courseStats.reduce((total, stat) => total + stat.priceBaht, 0))

  const incomplete = courseStats.filter((stat) => stat.remainingMinutes > 0)
  const completedDates = courseStats
    .map((stat) => stat.completionDate)
    .filter((date): date is string => Boolean(date))
  const estimatedDates = incomplete
    .map((stat) => stat.estimatedEndDate)
    .filter((date): date is string => Boolean(date))

  const allComplete = courses.length > 0 && incomplete.length === 0
  const canEstimate =
    incomplete.length === 0
      ? courses.length > 0
      : incomplete.every((stat) => stat.canEstimate)
  const latestCompletion = completedDates.sort().at(-1) ?? null
  const latestEstimate = estimatedDates.sort().at(-1) ?? null
  const shortfall = incomplete.reduce(
    (total, stat) => total + (stat.canEstimate ? 0 : stat.estimateShortfallMinutes),
    0,
  )

  return {
    purchasedMinutes,
    actualMinutes,
    remainingMinutes,
    overMinutes,
    progressPct,
    valueTaughtBaht,
    paymentTotalBaht,
    priceBaht,
    completionDate: allComplete ? latestCompletion : null,
    estimatedEndDate: allComplete ? null : latestEstimate,
    canEstimate,
    estimateShortfallMinutes: shortfall,
    courseCount: courses.length,
  }
}
