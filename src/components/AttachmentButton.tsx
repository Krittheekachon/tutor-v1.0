import { useRef, useState } from 'react'
import { createAttachmentSignedUrl } from '../lib/api'
import { formatFileSize } from '../lib/date'
import { toThaiError } from '../lib/errors'
import { Button, Modal, useToast } from './ui'
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
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const requestId = useRef(0)
  const isImage = /\.(png|jpe?g|webp)$/i.test(attachment.file_name) ||
    ['image/png', 'image/jpeg', 'image/webp'].includes(attachment.mime_type ?? '')

  function closePreview() {
    requestId.current += 1
    setPreviewOpen(false)
    setPreviewUrl(null)
    setPreviewError(null)
    setBusy(false)
  }

  async function handleOpen() {
    if (busy) return
    setBusy(true)
    if (isImage) {
      const currentRequest = ++requestId.current
      setPreviewOpen(true)
      setPreviewUrl(null)
      setPreviewError(null)
      try {
        const url = await createAttachmentSignedUrl(attachment.storage_path)
        if (currentRequest === requestId.current) setPreviewUrl(url)
      } catch (error) {
        if (currentRequest === requestId.current) setPreviewError(toThaiError(error))
      } finally {
        if (currentRequest === requestId.current) setBusy(false)
      }
      return
    }
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
    } catch (error) {
      if (popup && !popup.closed) popup.close()
      pushToast(toThaiError(error), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <button
      type="button"
      className={`attachment-button ${compact ? 'attachment-compact' : ''}`}
      onClick={() => void handleOpen()}
      disabled={busy}
      title={`ดูตัวอย่าง ${attachment.file_name}`}
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
    <Modal open={previewOpen} onClose={closePreview} title={attachment.file_name}
      subtitle="ตัวอย่างรูปภาพ" size="wide" icon="document"
      footer={<Button variant="ghost" onClick={closePreview}>ปิด</Button>}>
      <div className="attachment-preview">
        {busy && <p className="muted-line" role="status">กำลังโหลดตัวอย่างรูปภาพ…</p>}
        {previewError ? <div className="form-error" role="alert">
          <span>{previewError}</span>
          <Button variant="ghost" size="sm" onClick={() => void handleOpen()}>ลองใหม่</Button>
        </div> : previewUrl && <img src={previewUrl} alt={attachment.file_name}
          onError={() => setPreviewError('โหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่')} />}
      </div>
    </Modal>
    </>
  )
}
