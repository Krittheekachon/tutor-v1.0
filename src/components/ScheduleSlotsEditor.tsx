import { Button, Icon } from './ui'
import { TimeInput } from './TimeInput'
import { isValidTime, WEEKDAY_LONG } from '../lib/date'
import type { ScheduleSlotInput } from '../lib/types'

export function makeEmptySlot(weekday = 1): ScheduleSlotInput {
  return {
    id: crypto.randomUUID(),
    weekday,
    start_time: '16:00',
    end_time: '17:30',
  }
}

export function ScheduleSlotsEditor({
  slots,
  onChange,
  disabled = false,
  emptyText = 'ยังไม่ได้เพิ่มช่วงเวลาเรียน',
}: {
  slots: ScheduleSlotInput[]
  onChange: (slots: ScheduleSlotInput[]) => void
  disabled?: boolean
  emptyText?: string
}) {
  function updateSlot(index: number, patch: Partial<ScheduleSlotInput>) {
    onChange(slots.map((slot, slotIndex) => (slotIndex === index ? { ...slot, ...patch } : slot)))
  }

  function removeSlot(index: number) {
    onChange(slots.filter((_, slotIndex) => slotIndex !== index))
  }

  function addSlot() {
    const nextWeekday = slots.length > 0 ? slots[slots.length - 1].weekday : 1
    onChange([...slots, makeEmptySlot(nextWeekday)])
  }

  return (
    <div className="slots-editor">
      {slots.length === 0 ? (
        <div className="slots-empty">
          <Icon name="clock" size={18} />
          <span>{emptyText} — เพิ่มได้หลายช่วงต่อสัปดาห์</span>
        </div>
      ) : (
        <div className="slot-list">
          {slots.map((slot, index) => {
            const invalid = Boolean(
              (slot.start_time || slot.end_time) &&
                (!isValidTime(slot.start_time) ||
                  !isValidTime(slot.end_time) ||
                  slot.end_time <= slot.start_time),
            )
            return (
              <div className={`slot-row ${invalid ? 'slot-invalid' : ''}`} key={slot.id ?? index}>
                <div className="slot-field slot-weekday">
                  <label className="sr-only" htmlFor={`slot-weekday-${index}`}>
                    วัน
                  </label>
                  <select
                    id={`slot-weekday-${index}`}
                    className="input input-select"
                    value={slot.weekday}
                    onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
                    disabled={disabled}
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
                      <option value={weekday} key={weekday}>
                        วัน{WEEKDAY_LONG[weekday]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="slot-field">
                  <label className="sr-only" htmlFor={`slot-start-${index}`}>
                    เวลาเริ่ม
                  </label>
                  <TimeInput
                    id={`slot-start-${index}`}
                    value={slot.start_time}
                    onChange={(value) => updateSlot(index, { start_time: value })}
                    disabled={disabled}
                    ariaLabel="เวลาเริ่ม"
                  />
                </div>
                <span className="slot-dash">–</span>
                <div className="slot-field">
                  <label className="sr-only" htmlFor={`slot-end-${index}`}>
                    เวลาจบ
                  </label>
                  <TimeInput
                    id={`slot-end-${index}`}
                    value={slot.end_time}
                    onChange={(value) => updateSlot(index, { end_time: value })}
                    disabled={disabled}
                    ariaLabel="เวลาจบ"
                  />
                </div>
                <button
                  type="button"
                  className="slot-remove"
                  onClick={() => removeSlot(index)}
                  disabled={disabled}
                  aria-label={`ลบช่วงเวลาที่ ${index + 1}`}
                >
                  <Icon name="trash" size={17} />
                </button>
                {invalid && <p className="slot-error">กรอกเวลา 24 ชั่วโมง HH:MM และเวลาจบต้องมากกว่าเวลาเริ่ม</p>}
              </div>
            )
          })}
        </div>
      )}
      <Button
        type="button"
        variant="soft"
        size="sm"
        icon="plus"
        onClick={addSlot}
        disabled={disabled}
        className="slot-add"
      >
        เพิ่มช่วงเวลา
      </Button>
    </div>
  )
}
