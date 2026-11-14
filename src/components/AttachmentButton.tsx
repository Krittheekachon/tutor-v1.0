import { useState } from 'react'
import { createAttachmentSignedUrl } from '../lib/api'
import { formatFileSize } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { useToast } from './ui'
import { Icon } from './ui'
import type { Attachment } from '../lib/types'

export function AttachmentButton({
  attachment,
  compact = true,
}: {
  attachment: Attachment
  compact?: boolean
}) {
  const { pushToast } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleOpen() {
    if (busy) return
    setBusy(true)
    const popup = window.open('about:blank', '_blank')
    if (popup) {
      popup.document.title = 'กำลังเปิดไฟล์…'
      popup.document.body.innerHTML =
        '<p style="font-family:sans-serif;padding:24px;color:#6b5561">กำลังสร้างลิงก์ไฟล์อย่างปลอดภัย…</p>'
    }
    try {
      const url = await createAttachmentSignedUrl(attachment.storage_path)
      if (popup && !popup.closed) {
        popup.opener = null
        popup.location.replace(url)
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      pushToast('เปิดไฟล์แล้ว — signed URL มีอายุ 60 วินาที', 'info')
    } catch (error) {
      if (popup && !popup.closed) popup.close()
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className={`attachment-button ${compact ? 'attachment-compact' : ''}`}
      onClick={() => void handleOpen()}
      disabled={busy}
      title={`เปิด ${attachment.file_name}`}
    >
      {busy ? (
        <span className="spinner spinner-tiny" aria-hidden="true" />
      ) : (
        <Icon name="document" size={compact ? 15 : 18} />
      )}
      <span className="attachment-name">{attachment.file_name}</span>
      {!compact && attachment.size_bytes ? (
        <span className="attachment-size">{formatFileSize(attachment.size_bytes)}</span>
      ) : null}
      <Icon name="external" size={13} className="attachment-external" />
    </button>
  )
}
