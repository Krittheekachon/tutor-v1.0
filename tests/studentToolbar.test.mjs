import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { build } from 'esbuild'
import puppeteer from 'puppeteer-core'
import { data } from './studentList.test.mjs'

const bundle = await build({ stdin: { contents: `
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { StudentsPage } from './src/components/StudentsPage';
  createRoot(document.getElementById('root')).render(<StudentsPage />);
`, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'fixture', setup(builder) {
    builder.onResolve({ filter: /AppDataContext$/ }, () => ({ path: 'context', namespace: 'fixture' }))
    builder.onResolve({ filter: /\/(StudentDetailModal|StudentFormModal|CourseFormModal|CourseDetailModal)$/ }, args =>
      ({ path: args.path.split('/').pop(), namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'context'
      ? `const data = ${JSON.stringify(data)}; export const useAppData = () => ({data});`
      : `export const ${args.path} = () => null;` }))
  } }] })
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true, args: ['--no-sandbox', '--disable-gpu'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewport({ width: 1280, height: 1000 })
  await page.setContent('<html><head><meta charset="utf-8"></head><body><div id="root" style="max-width:1200px;margin:24px auto;padding:0 20px"></div></body></html>')
  await page.addStyleTag({ content: await readFile('src/base.css', 'utf8') + await readFile('src/styles.css', 'utf8') })
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.waitForSelector('#students-sort')
  assert.equal(await page.$eval('.students-filter-status', element => element.textContent.trim()), 'แสดง 3 คน')
  assert.ok(await page.$eval('.students-sort-direction', element => element.disabled))
  assert.equal(await page.$$eval('#students-sort option', elements => elements.length), 3)
  await page.select('#students-sort', 'remaining')
  await page.click('.students-sort-direction')
  assert.equal(await page.$eval('.students-sort-direction path', element => element.getAttribute('d')), 'M12 19V5m-5 5 5-5 5 5')
  await page.select('#students-sort', 'end')
  await page.click('.students-sort-direction')
  assert.equal(await page.$eval('.students-sort-direction path', element => element.getAttribute('d')), 'M12 5v14m-5-5 5 5 5-5')
  await page.select('#students-weekday', '2')
  assert.equal(await page.$eval('.students-filter-status', element => element.textContent.trim()), 'แสดง 2 จาก 3 คน')
  await page.select('#students-subject', 'วิทยาศาสตร์')
  assert.equal(await page.$eval('.students-filter-status', element => element.textContent.trim()), 'แสดง 1 จาก 3 คน')
  await mkdir('screenshots', { recursive: true })
  for (const width of [1280, 360]) {
    await page.setViewport({ width, height: 1000 })
    await page.waitForFunction(() => document.querySelectorAll('.students-table, .student-card-grid').length > 0)
    assert.ok(await page.$$eval('.students-control select', elements => elements.every(element => {
      const rect = element.getBoundingClientRect()
      return rect.height >= 40 && rect.height <= 44 && rect.left >= 0 && rect.right <= innerWidth
    })))
    assert.ok(await page.$$eval('.students-control label', elements => elements.every(element => document.getElementById(element.htmlFor))))
    if (width === 1280) {
      assert.ok(await page.$eval('.students-list-controls', element => {
        const table = document.querySelector('.students-table-card').getBoundingClientRect()
        return table.top - element.getBoundingClientRect().bottom === 16
      }))
    }
    await page.screenshot({ path: `screenshots/student-toolbar-${width}.png`, fullPage: true })
  }
  await page.type('.students-search input', 'เอ')
  await page.click('.students-clear-filters')
  assert.equal(await page.$eval('#students-weekday', element => element.value), '')
  assert.equal(await page.$eval('#students-subject', element => element.value), '')
  assert.equal(await page.$eval('.students-search input', element => element.value), 'เอ', 'toolbar reset preserves search')
  assert.equal(await page.$('.students-clear-filters'), null)
  assert.deepEqual(errors, [])
  console.log('PASS: toolbar at desktop/360px, 42px selects, count, direction toggle, filter reset, labels and table spacing')
} finally { await browser.close() }
