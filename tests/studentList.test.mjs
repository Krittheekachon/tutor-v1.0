import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/lib/studentList.ts'], bundle: true, write: false, format: 'esm' })
const { studentListRows } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const students = [
  { id: 'a', nickname: 'เอ', archived_at: null },
  { id: 'b', nickname: 'บี', archived_at: null },
  { id: 'c', nickname: 'ซี', archived_at: null },
  { id: 'd', nickname: 'ดี', archived_at: '2026-01-01' },
]
const courses = [
  { id: 'am', student_id: 'a', subject: 'คณิตศาสตร์', purchased_minutes: 600 },
  { id: 'as', student_id: 'a', subject: 'วิทยาศาสตร์', purchased_minutes: 300 },
  { id: 'bm', student_id: 'b', subject: 'คณิตศาสตร์', purchased_minutes: 120 },
  { id: 'cm', student_id: 'c', subject: 'คณิตศาสตร์', purchased_minutes: 1800 },
  { id: 'dm', student_id: 'd', subject: 'คณิตศาสตร์', purchased_minutes: 240 },
].map(course => ({ ...course, start_date: '2026-01-01', archived_at: null, price_baht: 1000 }))
const rules = [
  { course_id: 'am', weekday: 1 }, { course_id: 'as', weekday: 2 },
  { course_id: 'bm', weekday: 2 }, { course_id: 'cm', weekday: 1 },
].map((rule, index) => ({ ...rule, id: `rule-${index}`, active: true, effective_from: '2026-01-01', start_time: '10:00', end_time: '12:00' }))
const sessions = [
  { course_id: 'am', session_date: '2099-01-04', start_time: '09:00', end_time: '19:00' },
  { course_id: 'as', session_date: '2099-01-03', start_time: '09:00', end_time: '14:00' },
  { course_id: 'bm', session_date: '2099-01-02', start_time: '09:00', end_time: '11:00' },
].map((session, index) => ({ ...session, id: `session-${index}`, status: 'scheduled' }))
const data = { students, courses, rules, sessions, logs: [], payments: [], attachments: [] }
const options = { archived: false, search: '', weekday: '', subject: '', sort: 'name' }
const rows = patch => studentListRows(data, { ...options, ...patch })
const ids = patch => rows(patch).map(row => row.student.id)
assert.deepEqual(ids({ sort: 'remaining-desc' }), ['c', 'a', 'b'])
assert.deepEqual(ids({ sort: 'remaining-asc' }), ['b', 'a', 'c'])
assert.deepEqual(ids({ sort: 'end-asc' }), ['b', 'a', 'c'])
assert.deepEqual(ids({ sort: 'end-desc' }), ['a', 'b', 'c'], 'unknown dates stay last in either direction')
assert.deepEqual(ids({ weekday: '2' }), ['b', 'a'])
assert.deepEqual(ids({ subject: 'วิทยาศาสตร์' }), ['a'])
assert.deepEqual(ids({ weekday: '2', subject: 'คณิตศาสตร์' }), ['b'], 'day and subject must match the same course')
assert.equal(rows({ subject: 'วิทยาศาสตร์' })[0].stats.remainingMinutes, 300, 'statistics use the filtered courses')
assert.deepEqual(ids({ weekday: '7' }), [])
assert.deepEqual(ids({ search: '  บี ' }), ['b'])
assert.deepEqual(ids({ archived: true }), ['d'])
assert.equal(courses.length, data.courses.length)
assert.equal(data.students[0].id, 'a', 'sorting must not mutate the original data')
const partial = structuredClone(data)
partial.sessions = partial.sessions.filter(session => session.course_id !== 'as')
assert.equal(studentListRows(partial, options).find(row => row.student.id === 'a').endDate, null, 'partial estimates must not imply all courses finish on that date')
console.log('PASS: remaining hours, finish dates, unknown dates, combined day/subject filters, scoped totals, search and archive')
export { data }
