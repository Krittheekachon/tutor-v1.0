import type { Attachment } from './types'

// Note files share the course bucket; the path records the appointment they belong to.
export function attachmentSessionId(attachment: Attachment): string | null {
  const parts = attachment.storage_path.split('/')
  return parts[2] === 'notes' ? parts[3] ?? null : null
}
