import { PASTEL_COLORS, hexToRgba, isHexColor, normalizeHex, readableTextColor } from '../lib/color'

export function ColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}) {
  const valid = isHexColor(value)
  const previewColor = valid ? value : '#F5A9C0'

  return (
    <div className="color-picker">
      <div className="color-swatches" role="group" aria-label="เลือกสีประจำตัว">
        {PASTEL_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch ${value.toUpperCase() === color.toUpperCase() ? 'is-selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color.toUpperCase())}
            disabled={disabled}
            aria-label={`เลือกสี ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
          />
        ))}
      </div>
      <div className="color-custom">
        <label className="color-hex-label" htmlFor="custom-color">
          HEX
        </label>
        <input
          id="custom-color"
          className="input color-hex-input"
          value={value}
          onChange={(event) => onChange(normalizeHex(event.target.value))}
          placeholder="#F5A9C0"
          maxLength={7}
          disabled={disabled}
          spellCheck={false}
        />
        <input
          type="color"
          className="color-native"
          value={previewColor}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          disabled={disabled}
          aria-label="เลือกสีเอง"
        />
      </div>
      {!valid && value.length > 0 && <p className="field-error">สีต้องอยู่ในรูปแบบ #RRGGBB</p>}
      <div
        className="color-preview"
        style={{
          backgroundColor: hexToRgba(previewColor, 0.9),
          borderLeftColor: previewColor,
          color: readableTextColor(previewColor),
        }}
      >
        <span className="color-preview-time">16:00</span>
        <span className="color-preview-name">ตัวอย่างสีชื่อนักเรียน</span>
      </div>
    </div>
  )
}
