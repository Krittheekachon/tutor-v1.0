import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { build } from 'esbuild'

// Exercise the actual save/load flow without touching the connected database.
const tables = {
  students: [], courses: [{ id: 'course', start_date: '2026-11-01', archived_at: null }],
  schedule_rules: [{ id: 'old-rule', course_id: 'course', active: true,
    weekday: 6, start_time: '09:00', end_time: '10:00', effective_from: '2026-11-01' }],
  sessions: Array.from({ length: 1105 }, (_, i) => ({
    id: `session-${String(i).padStart(4, '0')}`, course_id: 'course', rule_id: 'old-rule',
    kind: 'regular', status: 'scheduled', session_date: '2026-11-14',
    start_time: '09:00', end_time: '10:00', recurrence_key: `old-${i}`,
  })),
  lesson_logs: [{ session_id: 'session-0000' }], payments: [], attachments: [],
}
tables.sessions.push(
  { id: 'past', course_id: 'course', kind: 'regular', status: 'scheduled', session_date: '2026-11-07' },
  { id: 'moved', course_id: 'course', kind: 'regular', status: 'moved', session_date: '2026-11-14' },
  { id: 'canceled', course_id: 'course', kind: 'regular', status: 'canceled', session_date: '2026-11-14' },
  { id: 'extra', course_id: 'course', kind: 'extra', status: 'scheduled', session_date: '2026-11-14' },
)
const originalDate = globalThis.Date
globalThis.Date = class extends originalDate {
  constructor(...args) { super(...(args.length ? args : ['2026-11-14T05:00:00Z'])) }
}
globalThis.__scheduleTestClient = { from(table) {
  let operation = 'select', values, filters = [], start = 0, end = 999, sortKey
  const query = {
    select() { return query },
    eq(key, value) { filters.push(row => row[key] === value); return query },
    gte(key, value) { filters.push(row => row[key] >= value); return query },
    in(key, list) { filters.push(row => list.includes(row[key])); return query },
    order(key) { sortKey = key; return query },
    range(a, b) { start = a; end = b; return query },
    update(value) { operation = 'update'; values = value; return query },
    delete() { operation = 'delete'; return query },
    insert(value) { operation = 'insert'; values = value; return query },
    upsert(value) { operation = 'upsert'; values = value; return query },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        const matches = row => filters.every(filter => filter(row))
        if (operation === 'update') tables[table].filter(matches).forEach(row => Object.assign(row, values))
        if (operation === 'delete') tables[table] = tables[table].filter(row => !matches(row))
        if (operation === 'insert' || operation === 'upsert') {
          for (const row of values) {
            if (operation === 'upsert' && tables[table].some(item => item.recurrence_key === row.recurrence_key)) continue
            tables[table].push({ id: randomUUID(), ...row })
          }
        }
        let rows = tables[table].filter(matches)
        if (sortKey) rows.sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])))
        return { data: structuredClone(rows.slice(start, end + 1)), error: null }
      }).then(resolve, reject)
    },
  }
  return query
} }
const result = await build({ entryPoints: ['src/lib/api.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', plugins: [{ name: 'mock-supabase', setup(builder) {
    builder.onResolve({ filter: /^\.\/supabase$/ }, () => ({ path: 'supabase', namespace: 'mock' }))
    builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `
      export const requireSupabase = () => globalThis.__scheduleTestClient;
      export const MAX_FILE_BYTES = 20971520, SIGNED_URL_TTL_SECONDS = 60, SUPABASE_BUCKET = 'course-files';
    ` }))
  } }] })
const { replaceSchedule, loadAllData } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
await replaceSchedule({ ownerId: 'owner', courseId: 'course', today: '2026-11-14',
  effectiveFrom: '2026-11-14', slots: [{ weekday: 6, start_time: '13:00', end_time: '14:30' }] })
const data = await loadAllData('owner')
assert.equal(data.sessions.filter(row => row.id.startsWith('session-')).length, 1, 'replace all pages, preserving the taught appointment')
for (const id of ['session-0000', 'past', 'moved', 'canceled', 'extra']) {
  assert.ok(data.sessions.some(row => row.id === id), `preserve ${id}`)
}
const updated = data.sessions.filter(row => row.rule_id !== 'old-rule' && row.kind === 'regular' && row.status === 'scheduled' && row.session_date === '2026-11-14')
assert.equal(updated.length, 1, 'create the new appointment on the effective date')
assert.equal(updated[0].start_time, '13:00')
assert.equal(updated[0].end_time, '14:30')
const reloaded = await loadAllData('owner')
assert.equal(reloaded.sessions.length, data.sessions.length, 'reload must not duplicate appointments')
globalThis.Date = originalDate
delete globalThis.__scheduleTestClient
console.log('PASS: schedule edits update today and all future pages; history and exceptions survive; reload is idempotent')
