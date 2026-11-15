import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'

const course = { id: 'course', student_id: 'student', subject: 'คณิตศาสตร์ ม.3',
  purchased_minutes: 480, content: 'สมการกำลังสอง\nทบทวนการแยกตัวประกอบ และฝึกทำโจทย์เตรียมสอบ' }
const sessions = [
  { id: 'first', course_id: 'course', start_time: '09:00', end_time: '10:00', note: 'ทำโจทย์ได้ดีขึ้น แนะนำให้ทบทวนแบบฝึกหัดข้อ 1–10' },
  { id: 'second', course_id: 'course', start_time: '14:00', end_time: '15:00', note: 'ฝึกโจทย์เพิ่มเติม' },
]
const logs = [
  { id: 'a', course_id: 'course', session_id: 'before', taught_on: '2026-11-10', actual_minutes: 90 },
  { id: 'b', course_id: 'course', session_id: 'first', taught_on: '2026-11-14', actual_minutes: 75 },
  { id: 'c', course_id: 'course', session_id: 'second', taught_on: '2026-11-14', actual_minutes: 60 },
  { id: 'd', course_id: 'course', session_id: 'later', taught_on: '2026-11-20', actual_minutes: 180 },
  { id: 'e', course_id: 'other', session_id: 'other', taught_on: '2026-11-14', actual_minutes: 300 },
]
const module = await build({ entryPoints: ['src/lib/lessonSummary.ts'], bundle: true, write: false, format: 'esm' })
const { buildLessonSummary } = await import(`data:text/javascript;base64,${Buffer.from(module.outputFiles[0].text).toString('base64')}`)
const presentation = await build({ entryPoints: ['src/lib/lessonReportStyle.ts'], bundle: true, write: false, format: 'esm' })
const { buildLessonReportText } = await import(`data:text/javascript;base64,${Buffer.from(presentation.outputFiles[0].text).toString('base64')}`)
for (const minutes of [0, 1, 479, 480, 600]) {
  const text = buildLessonReportText({ cumulativeMinutes: minutes, remainingMinutes: Math.max(0, 480 - minutes) }, course, {})
  assert.ok(!/🩷|🤍|%|ขอบคุณ/.test(text))
  assert.ok(!/undefined|NaN/.test(text))
  if (minutes >= 480) assert.ok(text.includes('🫧 ครบตามคอร์สแล้ว 🎉'))
}
assert.ok(!/undefined|NaN/.test(buildLessonReportText({}, {}, {})))
const summary = buildLessonSummary(course, logs[1], logs, sessions)
assert.equal(summary.beforeMinutes, 90)
assert.equal(summary.dailyMinutes, 135, 'sum actual minutes for the same course and actual teaching date')
assert.equal(summary.cumulativeMinutes, 225, 'historical reports exclude lessons recorded for later dates')
assert.equal(summary.remainingMinutes, 255)
assert.equal(summary.lessons.length, 1)
assert.equal(summary.lessons[0].lessonNumber, 2)
assert.equal(buildLessonSummary(course, logs[2], logs, sessions).lessons[0].lessonNumber, 3)
const over = buildLessonSummary({ ...course, purchased_minutes: 120 }, logs[1], logs, sessions)
assert.equal(over.remainingMinutes, 0)
assert.equal(over.overMinutes, 105)

const fixture = { courses: [course], sessions, logs,
  students: [{ id: 'student', nickname: 'น้องน้ำตาล' }] }
const ui = await build({ stdin: { contents: `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { LessonSummaryModal } from './src/components/LessonSummaryModal';
  const root = createRoot(document.getElementById('root'));
  window.renderReport = (data) => {
    if (data) window.reportFixture = data;
    root.render(<LessonSummaryModal sessionId="first" onClose={() => {}} />);
  };
  window.renderReport();
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /AppDataContext$/ }, () => ({ path: 'context', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents:
      `const initial = ${JSON.stringify(fixture)}; export const useAppData = () => ({ data: window.reportFixture ?? initial });` }))
  } }] })
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewport({ width: 900, height: 1000, deviceScaleFactor: 1 })
  await page.setContent('<html><head><meta charset="utf-8"></head><body><div id="root"></div></body></html>')
  await page.addStyleTag({ content: await readFile('src/base.css', 'utf8') + await readFile('src/styles.css', 'utf8') })
  await page.evaluate(() => {
    const draw = CanvasRenderingContext2D.prototype.fillText
    window.reportLabels = []
    window.reportTextBounds = []
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      window.reportLabels.push(args[0])
      const metrics = this.measureText(args[0])
      window.reportTextBounds.push({ text: args[0], font: this.font, x: args[1], right: args[1] + metrics.width,
        top: args[2] - metrics.actualBoundingBoxAscent, bottom: args[2] + metrics.actualBoundingBoxDescent,
        canvasHeight: this.canvas.height / 2, align: this.textAlign })
      return draw.apply(this, args)
    }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async text => { window.copiedReport = text },
    } })
  })
  await page.addScriptTag({ content: ui.outputFiles[0].text })
  await page.waitForSelector('.lesson-report-image')
  await page.waitForFunction(() => document.querySelector('.lesson-report-image').naturalWidth === 1600)
  const image = await page.$eval('.lesson-report-image', element => ({
    src: element.src, width: element.naturalWidth, height: element.naturalHeight, alt: element.alt,
  }))
  assert.ok(image.src.startsWith('data:image/png;base64,'))
  assert.ok(image.height > 0)
  assert.ok(image.alt.includes('2 ชั่วโมง 15 นาที'))
  await mkdir('screenshots', { recursive: true })
  const cdp = await page.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: resolve('screenshots'), eventsEnabled: true })
  const downloaded = new Promise((resolveDownload, reject) => {
    const timer = setTimeout(() => reject(new Error('PNG download timed out')), 10000)
    cdp.on('Browser.downloadProgress', event => {
      if (event.state === 'completed') { clearTimeout(timer); resolveDownload() }
    })
  })
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('บันทึกภาพ')).click())
  await downloaded
  const saved = await readFile('screenshots/สรุปการสอน-น้องน้ำตาล-2026-11-14.png')
  assert.deepEqual(saved, Buffer.from(image.src.split(',')[1], 'base64'), 'actual downloaded PNG is byte-identical to preview')
  await writeFile('screenshots/lesson-report-export.png', saved)
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.textContent.includes('คัดลอกข้อความ')).click())
  const copied = await page.evaluate(() => ({ text: window.copiedReport, status: document.querySelector('[role="status"]').textContent }))
  assert.equal(copied.text, [
    '🎀 ꒰ อัปเดตชั่วโมงเรียน ꒱ 🧜🏻‍♀️',
    '⭐️ name 𓏬 น้องน้ำตาล ⭐️', '',
    '꒰ ชั่วโมงทั้งหมด ꒱  8 ชั่วโมง',
    'ཐི เรียนไปแล้ว ꒱ ཋྀ  3 ชั่วโมง 45 นาที',
    '🫧 คงเหลือ  4 ชั่วโมง 15 นาที',
  ].join('\n'))
  assert.ok(!copied.text.includes('14:00'))
  assert.ok(!copied.text.includes('09:00–10:00'))
  assert.ok(!copied.text.includes('ฝึกโจทย์เพิ่มเติม'))
  assert.equal(copied.status, 'คัดลอกแล้ว')
  assert.ok(!copied.text.includes('undefined'))
  for (const width of [1024, 900, 768, 360]) {
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 })
    assert.ok(await page.$eval('.lesson-report-image', element => element.getBoundingClientRect().right <= window.innerWidth))
    await page.screenshot({ path: `screenshots/lesson-summary-${width}.png` })
  }
  const labels = await page.evaluate(() => window.reportLabels)
  const bounds = await page.evaluate(() => window.reportTextBounds)
  assert.ok(bounds.every(item => item.align === 'left' && item.x >= 0 && item.right <= 800), 'all PNG text fits using physical positions without Safari center/right alignment')
  assert.ok(labels.includes('เรียนไปแล้ว'))
  assert.ok(labels.includes('คงเหลือ'))
  assert.ok(labels.includes('4 ชม. 15 นาที'))
  assert.ok(labels.includes('จากทั้งหมด 8 ชม.'))
  assert.ok(!labels.some(text => /วันนี้สอน|%/.test(text)))
  assert.ok(!labels.some(text => text.startsWith('ครั้งที่')))
  assert.ok(!labels.includes('ขอบคุณที่ไว้วางใจ TutoNote'))
  assert.ok(!labels.includes('คัดลอกข้อความ'), 'buttons stay outside the export')
  const emptyFixture = structuredClone(fixture)
  emptyFixture.courses[0].content = ''
  emptyFixture.sessions.forEach(item => { item.note = '' })
  emptyFixture.logs = emptyFixture.logs.filter(item => item.taught_on >= '2026-11-14')
  emptyFixture.students[0].nickname = 'ชื่อนักเรียนยาวเพื่อทดสอบการตัดบรรทัดให้แสดงครบโดยไม่ล้นออกจากการ์ด'
  emptyFixture.courses[0].subject = 'วิทยาศาสตร์และคณิตศาสตร์เพิ่มเติมสำหรับการเตรียมสอบเข้าศึกษาต่อ'
  await page.evaluate(data => { window.reportLabels = []; window.renderReport(data) }, emptyFixture)
  await page.waitForFunction(() => window.reportLabels.includes('เรียนไปแล้ว'))
  assert.ok(!(await page.evaluate(() => window.reportLabels)).includes('ยังไม่มีบันทึกเนื้อหา'))
  assert.ok(!(await page.evaluate(() => window.reportLabels)).some(text => text.startsWith('สะสมก่อนวันนี้')))
  await page.screenshot({ path: 'screenshots/lesson-summary-empty-360.png' })
  emptyFixture.courses[0].purchased_minutes = 6000
  emptyFixture.logs = [{ ...logs[1], actual_minutes: 630 }]
  await page.evaluate(data => { window.reportLabels = []; window.reportTextBounds = []; window.renderReport(data) }, emptyFixture)
  await page.waitForFunction(() => window.reportLabels.includes('10 ชม. 30 นาที'))
  assert.ok(await page.evaluate(() => window.reportTextBounds.every(item => item.x >= 0 && item.right <= 800)))
  const values = await page.evaluate(() => window.reportTextBounds.filter(item => ['10 ชม. 30 นาที', '89 ชม. 30 นาที'].includes(item.text)))
  assert.equal(values.length, 2)
  assert.equal(values[0].font, values[1].font)
  assert.ok(parseFloat(values[0].font.split(' ')[1]) <= 64)
  assert.ok(parseFloat(values[0].font.split(' ')[1]) > 40)
  assert.ok(values[0].x >= 48 && values[0].right <= 384)
  assert.ok(values[1].x >= 416 && values[1].right <= 752)
  assert.ok(await page.evaluate(() => window.reportTextBounds.every(item => item.top >= 0 && item.bottom <= item.canvasHeight)))
  const labelBottom = await page.evaluate(() => Math.max(...window.reportTextBounds.filter(item => ['เรียนไปแล้ว', 'คงเหลือ'].includes(item.text)).map(item => item.bottom)))
  assert.ok(values.every(item => item.top > labelBottom), 'Thai marks do not overlap the labels')
  assert.ok(await page.$eval('.lesson-report-image', element => element.getBoundingClientRect().right <= 360))
  await page.screenshot({ path: 'screenshots/lesson-summary-long-hours-360.png' })
  emptyFixture.courses[0].purchased_minutes = 630
  await page.evaluate(data => { window.reportLabels = []; window.renderReport(data) }, emptyFixture)
  await page.waitForFunction(() => window.reportLabels.includes('ครบแล้ว'))
  await page.waitForFunction(() => !document.querySelector('.lesson-report-copy-status').textContent)
  assert.deepEqual(errors, [])
  console.log('PASS: unchanged totals, byte-identical PNG download, LINE text copy, 360px/desktop layouts, empty content, zero prior hours and long names')
} finally { await browser.close() }
