import { formatDuration, formatThaiDate } from './date'
import type { buildLessonSummary } from './lessonSummary'
import type { Course, Student } from './types'

const COPY_TEMPLATE = {
  heading: '🎀 ꒰ อัปเดตชั่วโมงเรียน ꒱ 🧜🏻‍♀️',
  name: (name: string) => `⭐️ name 𓏬 ${name} ⭐️`,
  total: (duration: string) => `꒰ ชั่วโมงทั้งหมด ꒱  ${duration}`,
  cumulative: (duration: string) => `ཐི เรียนไปแล้ว ꒱ ཋྀ  ${duration}`,
  remaining: (duration: string) => `🫧 คงเหลือ  ${duration}`,
  completed: '🫧 ครบตามคอร์สแล้ว 🎉',
}

const displayMinutes = (minutes: number) => Number.isFinite(minutes) ? minutes : 0

export function reportProgress(cumulative: number, total: number) {
  return total > 0 ? Math.min(1, Math.max(0, displayMinutes(cumulative) / total)) : 0
}

export function buildLessonReportText(report: Report, course: Course, student: Student) {
  const duration = (minutes: number) => formatDuration(displayMinutes(minutes))
  return [
    COPY_TEMPLATE.heading,
    COPY_TEMPLATE.name((student.nickname ?? '').trim()),
    '',
    COPY_TEMPLATE.total(duration(course.purchased_minutes)),
    COPY_TEMPLATE.cumulative(duration(report.cumulativeMinutes)),
    report.remainingMinutes === 0 ? COPY_TEMPLATE.completed : COPY_TEMPLATE.remaining(duration(report.remainingMinutes)),
  ].join('\n')
}

type Report = ReturnType<typeof buildLessonSummary>

export function formatReportDuration(minutes: number) {
  return formatDuration(displayMinutes(minutes), 'short').replace(/น\.$/, 'นาที')
}

// Presentation only. The modal continues to preview and download the same PNG.
export function styleLessonReport(canvas: HTMLCanvasElement, report: Report, course: Course, student: Student, date: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  const styles = getComputedStyle(document.documentElement)
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const ink = color('--ink', '#3d2b34'), muted = color('--muted', '#8c7480')
  const secondaryInk = color('--ink-soft', '#5e4854')
  const pink = color('--pink-deep', '#d56891')
  const chip = color('--pink-soft', '#fde7ee'), border = color('--line', '#f1dce4')
  const font = styles.getPropertyValue('--font-body').trim() || '"Noto Sans Thai", Tahoma, sans-serif'
  // The 800px card is typically displayed around 320px wide in chat.
  const sizes = { prominent: 36, main: 21, secondary: 17, small: 17, total: 26 }
  const lineHeight = 1.4
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
    draw.push(() => {
      setFont(size, weight, italic); ctx!.textBaseline = 'alphabetic'; ctx!.fillStyle = fill
      // Use physical coordinates: Safari can misplace aligned Thai text on canvas.
      ctx!.textAlign = 'left'; ctx!.direction = 'ltr'
      const offset = align === 'center' ? ctx!.measureText(value).width / 2 : align === 'right' ? ctx!.measureText(value).width : 0
      const metrics = ctx!.measureText(value)
      const baseline = y + size * lineHeight / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
      ctx!.fillText(value, x - offset, baseline)
    })
  }
  function centeredText(value: string, x: number, centerY: number, size: number, fill: string, weight = 400, align: CanvasTextAlign = 'left') {
    draw.push(() => {
      setFont(size, weight); ctx!.textBaseline = 'alphabetic'; ctx!.textAlign = 'left'; ctx!.direction = 'ltr'; ctx!.fillStyle = fill
      const metrics = ctx!.measureText(value)
      const offset = align === 'center' ? metrics.width / 2 : align === 'right' ? metrics.width : 0
      // A shared font reference keeps Thai and numeric header text on one baseline.
      const reference = ctx!.measureText('อิคคิว คณิตศาสตร์ 0123456789')
      const ascent = reference.fontBoundingBoxAscent ?? reference.actualBoundingBoxAscent
      const descent = reference.fontBoundingBoxDescent ?? reference.actualBoundingBoxDescent
      ctx!.fillText(value, x - offset, centerY + (ascent - descent) / 2)
    })
  }
  function box(x: number, y: number, w: number, h: number, radius: number, fill: string) {
    draw.push(() => { ctx!.beginPath(); ctx!.roundRect(x, y, w, h, radius); ctx!.fillStyle = fill; ctx!.fill() })
  }
  let y = 44
  const dateText = formatThaiDate(date)
  const headerCenterY = y + sizes.small * lineHeight / 2
  centeredText('TutoNote · สรุปการสอน', padding, headerCenterY, sizes.small, pink, 400)
  centeredText(dateText, width - padding, headerCenterY, sizes.small, muted, 400, 'right')
  y += sizes.small * lineHeight + 20
  for (const line of wrap(student.nickname, inner, sizes.prominent, 700)) {
    text(line, padding, y, sizes.prominent, ink, 700); y += sizes.prominent * lineHeight
  }
  y += 16
  const subjectLines = wrap(course.subject, inner - 28, sizes.secondary, 500)
  const chipWidth = Math.min(inner, Math.max(...subjectLines.map(line => measure(line, sizes.secondary, 500))) + 28)
  const chipLineHeight = sizes.secondary * lineHeight
  box(padding, y, chipWidth, subjectLines.length * chipLineHeight + 12, 18, chip)
  subjectLines.forEach((line, index) => centeredText(line, padding + chipWidth / 2, y + 6 + chipLineHeight / 2 + index * chipLineHeight, sizes.secondary, secondaryInk, 500, 'center'))
  y += subjectLines.length * chipLineHeight + 12 + 24
  const columnWidth = inner / 2
  const leftCenter = padding + columnWidth / 2
  const rightCenter = leftCenter + columnWidth
  text('เรียนไปแล้ว', leftCenter, y, sizes.main, secondaryInk, 500, 'center')
  text('คงเหลือ', rightCenter, y, sizes.main, secondaryInk, 500, 'center')
  const cumulative = formatReportDuration(report.cumulativeMinutes)
  const remaining = report.remainingMinutes === 0 ? 'ครบแล้ว' : formatReportDuration(report.remainingMinutes)
  // Canvas equivalent of equal grid columns and a responsive, non-wrapping font.
  // Both values share the size required by the longer value.
  const valueWidth = columnWidth - 32
  const heroSize = Math.min(52, 52 * valueWidth / Math.max(measure(cumulative, 52, 700), measure(remaining, 52, 700)))
  const labelHeight = sizes.main * lineHeight
  const heroLineHeight = heroSize * lineHeight
  const labelGap = 12
  const heroCenterY = y + labelHeight + labelGap + heroLineHeight / 2
  const blockHeight = labelHeight + labelGap + heroLineHeight
  centeredText(cumulative, leftCenter, heroCenterY, heroSize, pink, 700, 'center')
  centeredText(remaining, rightCenter, heroCenterY, heroSize, ink, 700, 'center')
  setFont(sizes.main, 500)
  const labelMetrics = ['เรียนไปแล้ว', 'คงเหลือ'].map(value => ctx.measureText(value))
  const labelTop = (labelHeight - Math.max(...labelMetrics.map(metrics => metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent))) / 2
  box(width / 2 - 0.5, y + labelTop, 1, blockHeight - labelTop, 0, border)
  y += blockHeight + 26
  const progress = reportProgress(report.cumulativeMinutes, course.purchased_minutes)
  box(padding, y, inner, 16, 8, border)
  if (progress > 0) box(padding, y, inner * progress, 16, 8, color('--pink', '#f3a8c0'))
  y += 36
  text(`จากทั้งหมด ${formatReportDuration(course.purchased_minutes)}`, width / 2, y, sizes.total, secondaryInk, 500, 'center')
  y += sizes.total * lineHeight + padding
  canvas.width = width * 2
  canvas.height = Math.ceil(y * 2)
  ctx.scale(2, 2); ctx.textBaseline = 'top'
  ctx.fillStyle = color('--surface', '#fffdfd'); ctx.fillRect(0, 0, width, y)
  draw.forEach(command => command())
  // Keep the same border in the preview and the saved bitmap.
  ctx.strokeStyle = border; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(0.5, 0.5, width - 1, y - 1, 20); ctx.stroke()
}
