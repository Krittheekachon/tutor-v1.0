import assert from 'node:assert/strict'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'

const fixture = {
  students: [{ id: 'student', nickname: 'นักเรียน', color_hex: '#f3a8c0' }],
  courses: [{ id: 'course', owner_id: 'owner', student_id: 'student', subject: 'เคมี', start_date: '2026-11-01', content: 'บทเดิม', purchased_minutes: 480, price_baht: 4000, archived_at: null }],
  logs: [{ course_id: 'course', session_id: 'taught', actual_minutes: 480 }],
  sessions: [], rules: [{ id: 'rule', course_id: 'course', weekday: 1 }], payments: [], attachments: [],
}
const bundle = await build({ stdin: { contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {CourseCompletionPrompt} from './src/components/CourseCompletionPrompt';
  import {ToastProvider} from './src/components/ui';
  createRoot(document.getElementById('root')).render(<ToastProvider><CourseCompletionPrompt /></ToastProvider>);
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /AppDataContext$/ }, () => ({ path: 'context', namespace: 'fixture' }))
    builder.onResolve({ filter: /lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'context'
      ? `window.fixture = ${JSON.stringify(fixture)}; export const useAppData = () => ({data: window.fixture, ownerId: 'owner', refresh: async () => true});`
      : `export const archiveCourse = async id => {window.archived = id; window.fixture.courses[0].archived_at = 'now'};
         export const updateCourse = async input => { window.saved = input; Object.assign(window.fixture.courses[0], {purchased_minutes: input.purchasedMinutes, price_baht: input.priceBaht}); };
         export const validateAttachmentFile = () => null;
         export const createCourse = async () => {throw new Error('must preserve existing course')};` }))
  } }] })
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
try {
  for (const action of ['renew', 'finish']) {
    const page = await browser.newPage()
    await page.setContent('<html><body><div id="root"></div></body></html>')
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await page.waitForSelector('[role="dialog"]')
    const click = label => page.evaluate(label => [...document.querySelectorAll('button')].find(button => button.textContent === label).click(), label)
    if (action === 'renew') {
      await click('ต่อคอร์ส')
      await page.waitForSelector('#course-hours')
      await page.$eval('#course-form', form => form.requestSubmit())
      await page.waitForFunction(() => Boolean(window.saved))
      const state = await page.evaluate(() => ({saved: window.saved, data: window.fixture, archived: window.archived}))
      assert.equal(state.saved.courseId, 'course')
      assert.equal(state.saved.purchasedMinutes, 960)
      assert.equal(state.saved.priceBaht, 8000)
      assert.deepEqual(state.data.rules, fixture.rules)
      assert.deepEqual(state.data.logs, fixture.logs)
      assert.equal(state.archived, undefined)
    } else {
      await click('จบคอร์สและเก็บเข้าคลัง')
      await page.waitForFunction(() => window.archived === 'course')
      assert.deepEqual(await page.evaluate(() => window.fixture.logs), fixture.logs)
    }
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await page.close()
  }
  console.log('PASS: completion offers renewal or archive; renewal adds hours/price to same course; schedules and history survive')
} finally { await browser.close() }
