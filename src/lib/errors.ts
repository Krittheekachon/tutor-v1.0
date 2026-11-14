interface ErrorShape {
  message?: string
  code?: string
  status?: number
  details?: string
  hint?: string
}

function getErrorShape(error: unknown): ErrorShape {
  if (typeof error === 'string') return { message: error }
  if (error && typeof error === 'object') {
    const shape = error as ErrorShape
    return shape
  }
  return {}
}

export function toThaiError(error: unknown): string {
  const { message = '', code = '', status } = getErrorShape(error)
  const lower = message.toLowerCase()

  if (code === 'invalid_credentials' || lower.includes('invalid login credentials')) {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'
  }
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return 'Google Login ยังไม่เปิดใช้งานใน Supabase กรุณาเปิด provider Google และตรวจสอบ Client ID/Secret'
  }
  if (lower.includes('redirect_uri_mismatch') || lower.includes('redirect uri mismatch')) {
    return 'Redirect URL ไม่ตรงกับการตั้งค่า Google OAuth กรุณาตรวจสอบ Authorized redirect URI'
  }
  if (lower.includes('signups not allowed') || lower.includes('signup is disabled')) {
    return 'บัญชี Google นี้ยังไม่ได้รับอนุญาตให้เข้าใช้งาน กรุณาใช้บัญชีเจ้าของที่สร้างไว้ใน Supabase'
  }
  if (lower.includes('access_denied') || lower.includes('user denied')) {
    return 'คุณยกเลิกการเข้าสู่ระบบด้วย Google'
  }
  if (code === 'email_not_confirmed' || lower.includes('email not confirmed')) {
    return 'อีเมลนี้ยังไม่ได้รับการยืนยัน กรุณายืนยันอีเมลผ่าน Supabase Dashboard ก่อนเข้าสู่ระบบ'
  }
  if (lower.includes('invalid api key') || lower.includes('apikey')) {
    return 'คีย์เชื่อมต่อ Supabase ไม่ถูกต้อง กรุณาตรวจสอบค่า VITE_SUPABASE_PUBLISHABLE_KEY'
  }
  if (lower.includes('failed to fetch') || lower.includes('network') || lower.includes('fetch failed')) {
    return 'เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'
  }
  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลดังกล่าว กรุณาเข้าสู่ระบบใหม่'
  }
  if (code === 'PGRST301' || lower.includes('jwt expired') || status === 401) {
    return 'เซสชันหมดอายุ กรุณาออกจากระบบแล้วเข้าสู่ระบบใหม่'
  }
  if (code === '23505' || lower.includes('duplicate key')) {
    return 'ข้อมูลรายการนี้มีอยู่แล้ว ระบบจึงไม่บันทึกซ้ำ'
  }
  if (code === '23503' || lower.includes('has_history')) {
    return 'รายการนี้มีประวัติการสอนหรือการรับเงินแล้ว จึงลบไม่ได้ กรุณาใช้ «เก็บเข้าคลัง» เพื่อซ่อนโดยเก็บประวัติไว้'
  }
  if (lower.includes('bucket not found')) {
    return 'ไม่พบ Storage bucket “course-files” กรุณารัน SQL migration ให้ครบถ้วน'
  }
  if (lower.includes('payload too large') || lower.includes('maximum allowed size')) {
    return 'ไฟล์มีขนาดใหญ่เกินกำหนด (สูงสุด 20 MB)'
  }
  if (lower.includes('mime type') && lower.includes('not supported')) {
    return 'ประเภทไฟล์นี้ยังไม่รองรับ กรุณาใช้ PDF รูปภาพ เอกสาร Word/Excel หรือไฟล์ข้อความ'
  }
  if (lower.includes('row too large') || lower.includes('exceeded')) {
    return 'ข้อมูลมีขนาดใหญ่เกินกำหนด กรุณาลองใหม่อีกครั้ง'
  }
  if (message) {
    return `เกิดข้อผิดพลาด: ${message}`
  }
  return 'เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองอีกครั้ง'
}
