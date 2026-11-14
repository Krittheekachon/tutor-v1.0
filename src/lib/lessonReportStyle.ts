import { formatDuration, formatThaiDate, formatTimeRange } from './date'
import type { buildLessonSummary } from './lessonSummary'
import type { Course, Student } from './types'

type Report = ReturnType<typeof buildLessonSummary>

export function formatReportDuration(minutes: number) {
  return formatDuration(minutes, 'short').replace(/น\.$/, 'นาที')
}

// Presentation only. The modal continues to preview and download the same PNG.
export function styleLessonReport(canvas: HTMLCanvasElement, report: Report, course: Course, student: Student, date: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const styles = getComputedStyle(document.documentElement)
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const ink = color('--ink', '#3d2b34'), muted = color('--muted', '#8c7480')
  const pink = color('--pink-deep', '#d56891'), soft = color('--pink-wash', '#fff3f7')
  const chip = color('--pink-soft', '#fde7ee'), border = color('--line', '#f1dce4')
  const font = styles.getPropertyValue('--font-body').trim() || '"Noto Sans Thai", Tahoma, sans-serif'
  const sizes = { prominent: 36, main: 21, secondary: 17 }
  const width = 800, padding = 48, inner = width - padding * 2
  const draw: Array<() => void> = []
  function setFont(size: number, weight = 400, italic = false) {
    ctx!.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`
  }
  function measure(text: string, size: number, weight = 400) {
    setFont(size, weight); return ctx!.measureText(text).width
  }
  function wrap(text: string, maxWidth: number, size: number, weight = 400) {
    const lines: string[] = []
    setFont(size, weight)
    for (const paragraph of text.split('\n')) {
      let line = ''
      for (const { segment } of new Intl.Segmenter('th', { granularity: 'word' }).segment(paragraph)) {
        if (line && ctx!.measureText(line + segment).width > maxWidth) { lines.push(line.trimEnd()); line = '' }
        for (const { segment: char } of new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(segment)) {
          if (line && ctx!.measureText(line + char).width > maxWidth) { lines.push(line.trimEnd()); line = '' }
          line += char
        }
      }
      lines.push(line.trimEnd())
    }
    return lines
  }
  function text(value: string, x: number, y: number, size = sizes.main, fill = ink, weight = 400, align: CanvasTextAlign = 'left', italic = false) {
    draw.push(() => { setFont(size, weight, italic); ctx!.textBaseline = 'top'; ctx!.fillStyle = fill; ctx!.textAlign = align; ctx!.fillText(value, x, y) })
  }
  function centeredText(value: string, x: number, centerY: number, size: number, fill: string, weight = 400, align: CanvasTextAlign = 'left') {
    draw.push(() => {
      setFont(size, weight); ctx!.textBaseline = 'alphabetic'; ctx!.textAlign = align; ctx!.fillStyle = fill
      const metrics = ctx!.measureText(value)
      ctx!.fillText(value, x, centerY + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2)
    })
  }
  function box(x: number, y: number, w: number, h: number, radius: number, fill: string) {
    draw.push(() => { ctx!.beginPath(); ctx!.roundRect(x, y, w, h, radius); ctx!.fillStyle = fill; ctx!.fill() })
  }
  let y = 44
  const dateText = formatThaiDate(date)
  text('TutoNote · สรุปการสอน', padding, y, sizes.secondary, pink, 500)
  text(dateText, width - padding, y, sizes.secondary, muted, 400, 'right')
  y += 44
  for (const line of wrap(student.nickname, inner, sizes.prominent, 700)) {
    text(line, padding, y, sizes.prominent, ink, 700); y += 54
  }
  const subjectLines = wrap(course.subject, inner - 32, sizes.secondary, 500)
  const chipWidth = Math.min(inner, Math.max(...subjectLines.map(line => measure(line, sizes.secondary, 500))) + 32)
  box(padding, y, chipWidth, subjectLines.length * 26 + 16, 18, chip)
  subjectLines.forEach((line, index) => centeredText(line, padding + chipWidth / 2, y + 21 + index * 26, sizes.secondary, pink, 500, 'center'))
  y += subjectLines.length * 26 + 44
  for (const line of wrap(formatReportDuration(report.dailyMinutes), inner, sizes.prominent, 700)) {
    text(line, width / 2, y, sizes.prominent, pink, 700, 'center'); y += 54
  }
  text('สอนวันนี้', width / 2, y, sizes.secondary, muted, 400, 'center')
  y += 48
  box(padding, y, inner, 10, 5, '#e5e7eb')
  const progress = course.purchased_minutes > 0 ? Math.min(1, Math.max(0, report.cumulativeMinutes / course.purchased_minutes)) : 0
  if (progress > 0) box(padding, y, inner * progress, 10, 5, color('--pink', '#f3a8c0'))
  y += 28
  const remaining = report.overMinutes > 0 ? `เกิน ${formatReportDuration(report.overMinutes)}` : `เหลือ ${formatReportDuration(report.remainingMinutes)}`
  const cumulative = `สะสม ${formatReportDuration(report.cumulativeMinutes)} / ${formatReportDuration(course.purchased_minutes)}`
  const statsWidth = inner - measure(remaining, sizes.secondary) - 24
  const cumulativeLines = wrap(cumulative, statsWidth, sizes.secondary)
  cumulativeLines.forEach((line, index) => text(line, padding, y + index * 26, sizes.secondary, muted))
  text(remaining, width - padding, y, sizes.secondary, muted, 400, 'right')
  y += cumulativeLines.length * 26 + 18
  if (report.beforeMinutes > 0) {
    text(`สะสมก่อนวันนี้ ${formatReportDuration(report.beforeMinutes)}`, padding, y, sizes.secondary, muted)
    y += 36
  }
  y += 20
  for (const item of report.lessons) {
    const top = y, inset = padding + 24, bodyWidth = inner - 48
    const badge = `สอนจริง ${formatReportDuration(item.log.actual_minutes)}`
    const badgeWidth = measure(badge, sizes.secondary, 500) + 24
    const time = item.session ? `${formatTimeRange(item.session.start_time, item.session.end_time)} น.` : 'ไม่ระบุเวลานัด'
    const heading = `ครั้งที่ ${item.lessonNumber} · ${time}`
    const headingLines = wrap(heading, bodyWidth - badgeWidth - 48, sizes.secondary, 600)
    const headerHeight = Math.max(headingLines.length * 26, 34)
    const height = 24 + headerHeight + 24
    box(padding, top, inner, height, 22, soft)
    // Draw the clock directly, keeping the exported image independent of SVG support.
    draw.push(() => {
      ctx!.strokeStyle = pink; ctx!.lineWidth = 2; ctx!.beginPath()
      ctx!.arc(inset + 12, top + 40, 11, 0, Math.PI * 2); ctx!.stroke()
      ctx!.beginPath(); ctx!.moveTo(inset + 12, top + 33); ctx!.lineTo(inset + 12, top + 40)
      ctx!.lineTo(inset + 17, top + 43); ctx!.stroke()
    })
    headingLines.forEach((line, lineIndex) => centeredText(line, inset + 34, top + 40 + lineIndex * 26, sizes.secondary, ink, 600))
    box(width - padding - 24 - badgeWidth, top + 22, badgeWidth, 34, 12, chip)
    centeredText(badge, width - padding - 36, top + 39, sizes.secondary, pink, 500, 'right')
    y += height + 24
  }
  y += 24
  canvas.width = width * 2
  canvas.height = Math.ceil(y * 2)
  ctx.scale(2, 2); ctx.textBaseline = 'top'
  ctx.fillStyle = color('--surface', '#fffdfd'); ctx.fillRect(0, 0, width, y)
  draw.forEach(command => command())
  // Keep the same border in the preview and the saved bitmap.
  ctx.strokeStyle = border; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(0.5, 0.5, width - 1, y - 1, 20); ctx.stroke()
}
