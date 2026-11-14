import {
  addDaysKey,
  isValidTime,
  sessionEndInstant,
  timeToMinutes,
  weekdayFromDateKey,
} from './date'
import type { ScheduleRule, ScheduleSlotInput, Session } from './types'

export function ruleAppliesOn(rule: ScheduleRule, dateKey: string): boolean {
  if (!rule.active) return false
  if (rule.weekday !== weekdayFromDateKey(dateKey)) return false
  if (dateKey < rule.effective_from) return false
  if (rule.effective_to && dateKey > rule.effective_to) return false
  return true
}

export function generateRuleDates(rule: ScheduleRule, fromKey: string, toKey: string): string[] {
  if (!rule.active || fromKey > toKey) return []
  const start = fromKey > rule.effective_from ? fromKey : rule.effective_from
  const end = rule.effective_to && rule.effective_to < toKey ? rule.effective_to : toKey
  if (start > end) return []
  const offset = (rule.weekday - weekdayFromDateKey(start) + 7) % 7
  let cursor = addDaysKey(start, offset)
  const dates: string[] = []
  while (cursor <= end) {
    dates.push(cursor)
    cursor = addDaysKey(cursor, 7)
  }
  return dates
}

export function slotsOverlap(
  a: Pick<ScheduleSlotInput, 'start_time' | 'end_time'>,
  b: Pick<ScheduleSlotInput, 'start_time' | 'end_time'>,
): boolean {
  return timeToMinutes(a.start_time) < timeToMinutes(b.end_time) &&
    timeToMinutes(b.start_time) < timeToMinutes(a.end_time)
}

export function validateSlots(slots: ScheduleSlotInput[]): string | null {
  if (slots.length === 0) return 'กรุณาเพิ่มตารางประจำอย่างน้อย 1 ช่วง'
  for (const slot of slots) {
    if (!slot.start_time || !slot.end_time) return 'กรุณากรอกเวลาเริ่มและเวลาจบให้ครบ'
    if (!isValidTime(slot.start_time) || !isValidTime(slot.end_time)) {
      return 'กรุณากรอกเวลาเป็นรูปแบบ 24 ชั่วโมง HH:MM เช่น 09:00 หรือ 16:30'
    }
    if (timeToMinutes(slot.end_time) <= timeToMinutes(slot.start_time)) {
      return 'เวลาจบต้องมากกว่าเวลาเริ่ม'
    }
  }
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (slots[i].weekday === slots[j].weekday && slotsOverlap(slots[i], slots[j])) {
        return 'ช่วงเวลาประจำวันเดียวกันซ้อนกัน กรุณาแก้ไขให้ไม่ทับกัน'
      }
    }
  }
  return null
}

export interface SessionTimeCandidate {
  id?: string
  session_date: string
  start_time: string
  end_time: string
}

export function findSessionConflicts(
  candidate: SessionTimeCandidate,
  sessions: Session[],
): Session[] {
  return sessions.filter((session) => {
    if (session.id === candidate.id) return false
    if (session.status === 'canceled') return false
    if (session.session_date !== candidate.session_date) return false
    return (
      timeToMinutes(candidate.start_time) < timeToMinutes(session.end_time) &&
      timeToMinutes(session.start_time) < timeToMinutes(candidate.end_time)
    )
  })
}

export function findScheduleRuleConflicts(
  slots: ScheduleSlotInput[],
  rules: ScheduleRule[],
  courseIds: Set<string>,
): ScheduleRule[] {
  return rules.filter((rule) => {
    if (!rule.active || !courseIds.has(rule.course_id)) return false
    return slots.some(
      (slot) =>
        slot.weekday === rule.weekday &&
        slotsOverlap(slot, { start_time: rule.start_time, end_time: rule.end_time }),
    )
  })
}

export function sessionIsInPast(session: Session, now: Date = new Date()): boolean {
  return sessionEndInstant(session.session_date, session.end_time).getTime() <= now.getTime()
}

export function sortSessionsByTime<T extends { session_date: string; start_time: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const dateCompare = a.session_date.localeCompare(b.session_date)
    if (dateCompare !== 0) return dateCompare
    return a.start_time.localeCompare(b.start_time)
  })
}

export function groupSessionsByDate(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>()
  for (const session of sessions) {
    const list = map.get(session.session_date) ?? []
    list.push(session)
    map.set(session.session_date, list)
  }
  for (const [key, list] of map) {
    map.set(key, sortSessionsByTime(list))
  }
  return map
}
