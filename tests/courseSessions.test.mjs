import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({ entryPoints: ['src/lib/courseSessions.ts'], bundle: true, write: false, format: 'esm' })
const { selectCourseSessions } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const now = new Date('2026-11-14T00:00:00+07:00')
const course = { id: 'c', purchased_minutes: 180, archived_at: null }
const make = (id, date, extra = {}) => ({ id, course_id: 'c', session_date: date, start_time: '09:00', end_time: '10:00', status: 'scheduled', kind: 'regular', ...extra })
const sessions = [make('taught', '2026-11-10'), make('a', '2026-11-15'), make('b', '2026-11-22'), make('c', '2026-11-29'), make('far', '2029-11-13')]
const logs = [{ session_id: 'taught', course_id: 'c', actual_minutes: 60 }]
const ids = (rows, c = course, entries = logs) => selectCourseSessions(c, rows, entries, now).map(s => s.id)
assert.deepEqual(ids(sessions), ['taught', 'a', 'b'], 'only remaining purchased hours are scheduled')
assert.deepEqual(ids(sessions.map(s => s.id === 'a' ? { ...s, status: 'canceled' } : s)), ['taught', 'a', 'b', 'c'], 'cancellation pushes the last appointment back')
assert.deepEqual(ids(sessions.map(s => s.id === 'a' ? { ...s, session_date: '2026-12-06', status: 'moved' } : s)), ['taught', 'a', 'b'], 'moved lesson is preserved and extends the course end')
assert.deepEqual(ids(sessions, course, [{ ...logs[0], actual_minutes: 30 }]), ['taught', 'a', 'b', 'c'], 'short teaching extends the course')
assert.deepEqual(ids(sessions, course, [{ ...logs[0], actual_minutes: 180 }]), ['taught'], 'completed course retains history only')
assert.deepEqual(ids(sessions, { ...course, archived_at: '2026-11-14' }), ['taught'], 'archive hides upcoming appointments')
assert.deepEqual(ids(sessions, { ...course, purchased_minutes: 240 }), ['taught', 'a', 'b', 'c'], 'renewal restores the same recurring calendar')
assert.deepEqual(ids([...sessions, make('extra', '2026-11-16', { kind: 'extra' })]), ['taught', 'a', 'extra'], 'extra lesson consumes outstanding hours')
assert.deepEqual(ids([...sessions, make('other', '2026-11-15', { course_id: 'other' })]), ['taught', 'a', 'b'], 'other courses do not leak into history')
console.log('PASS: course boundary, cancellation, move, actual duration, completion, archive, renewal and extra lesson')
