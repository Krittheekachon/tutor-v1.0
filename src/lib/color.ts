export const PASTEL_COLORS = [
  '#F5A9C0',
  '#F7C8D8',
  '#A9D7EF',
  '#C9B8E8',
  '#FFC9A8',
  '#C8E8D4',
  '#F3E3A6',
  '#D8C8DC',
  '#F4B8A8',
  '#B8E2E0',
]

export function isHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

export function normalizeHex(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (/^#[0-9A-Fa-f]{3}$/.test(withHash)) {
    const [, r, g, b] = withHash
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  return isHexColor(withHash) ? withHash.toUpperCase() : withHash
}

export function hexToRgba(hex: string, alpha: number): string {
  if (!isHexColor(hex)) return `rgba(245, 169, 192, ${alpha})`
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function readableTextColor(hex: string): string {
  if (!isHexColor(hex)) return '#3d2b34'
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? '#3d2b34' : '#fffafc'
}

export function softTone(hex: string): 'pink' | 'blue' | 'purple' | 'peach' | 'green' | 'gray' {
  if (!isHexColor(hex)) return 'pink'
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  if (blue > red && blue > green) return 'blue'
  if (green > red && green > blue) return 'green'
  if (red > blue && green > blue && red > 200 && green > 160) return 'peach'
  if (red > green && blue > green) return 'purple'
  return 'pink'
}
