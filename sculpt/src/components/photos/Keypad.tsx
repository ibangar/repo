import { IconCheck, IconChevronLeft } from '../ui/Icons'
import { haptic } from '../../lib/haptics'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/** 3×4 numeric keypad, 72 px round keys, haptic on tap. */
export function Keypad({ onDigit, onDelete, onSubmit, showSubmit, disabled }: { onDigit: (d: string) => void; onDelete: () => void; onSubmit?: () => void; showSubmit?: boolean; disabled?: boolean }) {
  const press = (fn: () => void) => () => { if (disabled) return; haptic.tap(); fn() }
  return (
    <div className="lock__pad" role="group" aria-label="Passcode keypad">
      {KEYS.map(k => <button key={k} className="lock__key" onClick={press(() => onDigit(k))} aria-label={k}>{k}</button>)}
      {showSubmit && onSubmit
        ? <button className="lock__key lock__key--go" onClick={press(onSubmit)} aria-label="Unlock"><IconCheck /></button>
        : <span />}
      <button className="lock__key" onClick={press(() => onDigit('0'))} aria-label="0">0</button>
      <button className="lock__key lock__key--ghost" onClick={press(onDelete)} aria-label="Delete"><IconChevronLeft /></button>
    </div>
  )
}
