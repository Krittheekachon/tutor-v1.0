import { useState } from 'react'
import { archiveCourse } from '../lib/api'
import { toThaiError } from '../lib/errors'
import { useAppData } from '../state/AppDataContext'
import { CourseFormModal } from './CourseFormModal'
import { Button, Modal, useToast } from './ui'

export function CourseCompletionPrompt() {
  const { data, refresh } = useAppData()
  const { pushToast } = useToast()
  const [dismissed, setDismissed] = useState<string[]>([])
  const [renewing, setRenewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const course = data?.courses.find(item => !item.archived_at && !dismissed.includes(item.id) &&
    !data.students.find(student => student.id === item.student_id)?.archived_at &&
    item.purchased_minutes > 0 && data.logs.filter(log => log.course_id === item.id)
      .reduce((sum, log) => sum + log.actual_minutes, 0) >= item.purchased_minutes)
  const student = data?.students.find(item => item.id === course?.student_id)
  if (!course || !student) return null
  const dismiss = () => { setDismissed(ids => [...ids, course.id]); setRenewing(false) }
  async function finish() {
    if (busy || !course) return
    setBusy(true)
    try {
      await archiveCourse(course.id)
      const refreshed = await refresh()
      pushToast(refreshed ? 'จบคอร์สและเก็บเข้าคลังแล้ว ประวัติยังอยู่ครบ' : 'เก็บเข้าคลังแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ', refreshed ? 'success' : 'warning')
      dismiss()
    } catch (error) { pushToast(toThaiError(error), 'error') }
    finally { setBusy(false) }
  }
  return <>
    <Modal open={!renewing} onClose={dismiss} busy={busy} title="สอนครบคอร์สแล้ว" subtitle={`${student.nickname} • ${course.subject}`} icon="check" size="md"
      footer={<>
        <Button variant="secondary" disabled={busy} onClick={() => setRenewing(true)}>ต่อคอร์ส</Button>
        <Button icon="archive" loading={busy} onClick={() => void finish()}>จบคอร์สและเก็บเข้าคลัง</Button>
      </>}>
      <p>ต่อคอร์สเพื่อเพิ่มชั่วโมงและเรียนตามตารางเดิม หรือจบคอร์สเพื่อเก็บข้อมูลและประวัติทั้งหมดเข้าคลัง</p>
    </Modal>
    <CourseFormModal open={renewing} mode="renew" course={course} student={student} onClose={() => setRenewing(false)} onSaved={dismiss} />
  </>
}
