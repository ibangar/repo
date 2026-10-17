import { createPortal } from 'react-dom'
import { Ring } from '../ui'
import { IconTimer } from '../ui/Icons'
import { haptic } from '../../lib/haptics'
import { mmss } from './helpers'
import type { RestTimer } from './useRestTimer'

/** Floating bottom rest-timer bar. Rendered in a portal so page transforms can't trap it. */
export function RestBar({ timer, label }: { timer: RestTimer; label?: string }) {
  if (!timer.active) return null
  const frac = timer.total ? timer.remaining / timer.total : 0
  return createPortal(
    <div className={`rest-bar ${timer.finished ? 'rest-bar--done' : ''}`} role="timer" aria-live="polite">
      <Ring value={frac} size={52} stroke={6} color={timer.finished ? 'var(--good)' : 'var(--accent)'}>
        <IconTimer size={18} />
      </Ring>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="tiny rest-bar__label">{timer.finished ? 'Rest over – go!' : `Rest${label ? ` · ${label}` : ''}`}</div>
        <div className="rest-bar__time num">{mmss(timer.remaining)}</div>
      </div>
      <button className="rest-bar__btn num" onClick={() => { haptic.tap(); timer.adjust(-30) }} aria-label="30 seconds less">−30</button>
      <button className="rest-bar__btn num" onClick={() => { haptic.tap(); timer.adjust(30) }} aria-label="30 seconds more">+30</button>
      <button className="rest-bar__btn rest-bar__btn--skip" onClick={() => { haptic.tap(); timer.skip() }}>Skip</button>
    </div>,
    document.body,
  )
}
