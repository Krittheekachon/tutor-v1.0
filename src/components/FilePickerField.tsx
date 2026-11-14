import { useId, useRef } from 'react'
import { validateAttachmentFile } from '../lib/api'
import { formatFileSize } from '../lib/date'
import { Icon } from './ui'

export function FilePickerField({
  file,
  onChange,
  onError,
  disabled = false,
  label = 'แนบไฟล์การสอน (ไม่บังคับ)',
  existingCount = 0,
}: {
  file: File | null
  onChange: (file: File | null) => void
  onError: (message: string | null) => void
  disabled?: boolean
  label?: string
  existingCount?: number
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  function handleFile(nextFile: File | null) {
    if (!nextFile) {
      onChange(null)
      onError(null)
      return
    }
    const validationError = validateAttachmentFile(nextFile)
    if (validationError) {
      onError(validationError)
      onChange(null)
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    onError(null)
    onChange(nextFile)
  }

  return (
    <div className="file-picker">
      <div className="file-picker-row">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          disabled={disabled}
        />
        <button
          type="button"
          className="file-select-button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Icon name="attachment" size={18} />
          <span>{file ? 'เปลี่ยนไฟล์' : label}</span>
        </button>
        {file && (
          <div className="file-selected">
            <Icon name="document" size={16} />
            <span className="file-selected-name">{file.name}</span>
            <span className="file-selected-size">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="file-remove"
              onClick={() => handleFile(null)}
              disabled={disabled}
              aria-label="เอาไฟล์ออก"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        )}
      </div>
      {!file && (
        <p className="field-hint">
          PDF รูปภาพ Word Excel หรือ TXT ขนาดไม่เกิน 20 MB
          {existingCount > 0 ? ` • มีไฟล์เดิม ${existingCount} ไฟล์` : ''}
        </p>
      )}
    </div>
  )
}
