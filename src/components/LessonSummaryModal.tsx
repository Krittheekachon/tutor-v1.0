import { useEffect, useState } from 'react'
import { formatDuration, formatThaiDateLong } from '../lib/date'
import { buildLessonSummary } from '../lib/lessonSummary'
import { buildLessonReportText, styleLessonReport } from '../lib/lessonReportStyle'
import { useAppData } from '../state/AppDataContext'
import { Button, Modal } from './ui'

export function LessonSummaryModal({ sessionId, onClose }: { sessionId: string | null; onClose: () => void }) {
  const { data } = useAppData()
  const [image, setImage] = useState('')
  const [error, setError] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const session = data?.sessions.find(item => item.id === sessionId)
  const course = data?.courses.find(item => item.id === session?.course_id)
  const student = data?.students.find(item => item.id === course?.student_id)
  const log = data?.logs.find(item => item.session_id === sessionId)
  const summary = data && course && log ? buildLessonSummary(course, log, data.logs, data.sessions) : null
  const accessibleText = summary && student && course && log
    ? `สรุปการสอน ${student.nickname} วิชา ${course.subject} ${formatThaiDateLong(log.taught_on)} สอนวันนี้ ${formatDuration(summary.dailyMinutes)} สะสม ${formatDuration(summary.cumulativeMinutes)} จาก ${formatDuration(course.purchased_minutes)} คงเหลือ ${formatDuration(summary.remainingMinutes)}` : ''

  useEffect(() => { setCopyStatus('idle') }, [sessionId])
  useEffect(() => {
    if (copyStatus === 'idle') return
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2500)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  async function copyText() {
    if (!summary || !student || !course || !log) return
    const content = buildLessonReportText(summary, course, student)
    try {
      await navigator.clipboard.writeText(content)
      setCopyStatus('copied')
    } catch { setCopyStatus('error') }
  }

  useEffect(() => {
    setImage('')
    setError(false)
    if (!data || !course || !student || !log || !sessionId) return
    let active = true
    const report = buildLessonSummary(course, log, data.logs, data.sessions)
    async function render() {
      try {
        await document.fonts.ready
        const canvas = document.createElement('canvas')
        styleLessonReport(canvas, report, course!, student!, log!.taught_on)
        if (active) setImage(canvas.toDataURL('image/png'))
      } catch { if (active) setError(true) }
    }
    void render()
    return () => { active = false }
  }, [data, course, student, log, sessionId])

  function download() {
    const link = document.createElement('a')
    link.href = image
    link.download = `สรุปการสอน-${student?.nickname ?? ''}-${log?.taught_on ?? ''}.png`
    link.click()
  }

  return <Modal open={Boolean(sessionId && log)} onClose={onClose} title="สรุปการสอนวันนี้"
    subtitle="พร้อมส่งให้ผู้ปกครอง" size="md" icon="document"
    footer={<div className="lesson-report-actions">
      <span className="lesson-report-copy-status" role="status" aria-live="polite">
        {copyStatus === 'copied' ? 'คัดลอกแล้ว' : copyStatus === 'error' ? 'คัดลอกไม่สำเร็จ กรุณาลองใหม่' : ''}
      </span>
      <Button variant="ghost" onClick={onClose}>ปิด</Button>
      <Button variant="soft" onClick={() => void copyText()} disabled={!image}>คัดลอกข้อความ</Button>
      <Button onClick={download} disabled={!image}>บันทึกภาพ</Button>
    </div>}>
    {error ? <p className="field-error" role="alert">สร้างภาพไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่</p>
      : image ? <img className="lesson-report-image" src={image} alt={accessibleText} />
      : <p role="status">กำลังสร้างสรุปการสอน…</p>}
  </Modal>
}
