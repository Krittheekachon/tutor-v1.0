import type { User } from '@supabase/supabase-js'

function readMetadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * ชื่อที่แสดงของเจ้าของ:
 * 1. display_name ที่ตั้งจากในแอป
 * 2. ชื่อที่ได้จาก Google (full_name / name)
 * 3. ชื่อเริ่มต้นสำหรับบัญชีอีเมลที่ยังไม่ได้ตั้งชื่อ
 */
export function getDisplayName(user: User | null): string {
  if (!user) return ''
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  return (
    readMetadataString(metadata, 'display_name') ||
    readMetadataString(metadata, 'full_name') ||
    readMetadataString(metadata, 'name') ||
    'เจ้าของตารางสอน'
  )
}

export function getInitial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'T'
  return Array.from(trimmed)[0]?.toUpperCase() ?? 'T'
}
