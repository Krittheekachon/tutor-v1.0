import { useEffect, useRef, useState, type ReactNode } from 'react'
import { validateAttachmentFile } from '../lib/api'
import { formatFileSize } from '../lib/date'
import { Icon } from './ui'

function ImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url ? <img className="content-attachment-preview" src={url} alt={file.name} /> : null
}

export function ContentAttachments({ files, onChange, disabled, children }: {
  files: File[]
  onChange: (files: File[]) => void
  disabled: boolean
  children: ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function addFiles(incoming: File[]) {
    if (disabled) return
    const invalid = incoming.map(file => {
      const message = validateAttachmentFile(file)
      return message ? `${file.name}: ${message}` : null
    }).filter(Boolean)
    setError(invalid.join('\n') || null)
    const accepted = incoming.filter(file => !validateAttachmentFile(file))
    if (accepted.length) onChange([...files, ...accepted])
  }

  return (
    <div className="content-attachments" onPaste={event => {
      if (disabled) return
      const pasted = Array.from(event.clipboardData.items)
        .filter(item => item.kind === 'file')
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null)
      if (!pasted.length) return
      // Keep normal text paste native, including text copied alongside an image.
      if (!event.clipboardData.getData('text/plain')) event.preventDefault()
      addFiles(pasted)
    }}>
      {children}
      <input ref={inputRef} type="file" multiple className="sr-only"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx"
        disabled={disabled} aria-label="เลือกไฟล์หรือรูปภาพแนบ"
        onChange={event => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }} />
      <button type="button" className="file-select-button" disabled={disabled}
        onClick={() => inputRef.current?.click()}>
        <Icon name="attachment" size={18} /> แนบไฟล์ / รูปภาพ
      </button>
      <p className="field-hint">วางรูปที่แคปหน้าจอหรือ Copy มาในช่องเนื้อหาด้วย Ctrl+V (Mac: ⌘V) ได้เลย • แนบได้หลายไฟล์ ไฟล์ละไม่เกิน 20 MB</p>
      {files.length > 0 && <div className="content-attachment-list">
        {files.map((file, index) => <div className="content-attachment-item" key={index}>
          {['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && <ImagePreview file={file} />}
          <div className="file-selected">
            <Icon name="document" size={16} />
            <span className="file-selected-name">{file.name}</span>
            <span className="file-selected-size">{formatFileSize(file.size)}</span>
            <button type="button" className="file-remove" disabled={disabled}
              aria-label={`เอาไฟล์ ${file.name} ออก`}
              onClick={() => onChange(files.filter((_, i) => i !== index))}>
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>)}
      </div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  )
}
