import { useEffect, useRef, useState } from 'react'
import type { ExerciseDef, Increments, SessionExercise, SetLog, Units } from '../../db/types'
import { Stepper, Toggle } from '../ui'
import { IconCheck } from '../ui/Icons'
import { haptic } from '../../lib/haptics'
import { displayStep, fmtModeLoad, fromDisp, isPowerMode, loadUnit, toDisp } from './helpers'

export interface SetRowProps {
  set: SetLog
  ex: SessionExercise
  def: ExerciseDef
  units: Units
  increments: Increments
  /** "1", "L", "R", "A1", "B2" … */
  label: string
  current: boolean
  last?: { load: number | null; reps: number | null; rir: number }
  onChange: (patch: Partial<SetLog>) => void
  onToggle: () => void
}

/** Steppers have no placeholder prop – set it on the inner input. */
function usePlaceholder(text: string) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector('input')?.setAttribute('placeholder', text) }, [text])
  return ref
}

export function SetRow({ set, ex, def, units, increments, label, current, last, onChange, onToggle }: SetRowProps) {
  const mode = ex.loadMode
  const power = isPowerMode(mode)
  const hasLoad = mode !== 'bodyweight'
  const { step, decimals } = displayStep(def, increments, mode, units)
  const [justDone, setJustDone] = useState(false)
  const loadRef = usePlaceholder(ex.calibration && set.load == null ? 'pick' : '–')
  const repsRef = usePlaceholder(String(set.prescribedReps))
  const unit = loadUnit(mode, units)

  const reps = set.reps
  const hint = reps != null && reps > 0
    ? reps >= ex.repMax && (power || set.rir >= 1) ? 'fire' : reps < ex.repMin ? 'low' : null
    : null
  const lastStr = last ? `${fmtModeLoad(last.load, mode, units, false)} × ${last.reps ?? '—'}${isPowerMode(mode) ? '' : ` @${last.rir}`}` : null
  const rx = `${fmtModeLoad(set.prescribedLoad, mode, units)} × ${set.prescribedReps}`

  const toggle = () => {
    if (!set.done) { setJustDone(true); setTimeout(() => setJustDone(false), 600) }
    onToggle()
  }

  if (set.done) {
    return (
      <div className={`set set--done ${justDone ? 'set--pop' : ''}`}>
        <div className="set__top">
          <div className="set__num">{label}</div>
          <div className="set__done-txt num">
            {fmtModeLoad(set.load, mode, units)} × {set.reps ?? 0}{power ? (set.explosive === false ? '' : ' ⚡') : ` @${set.rir}`}
          </div>
          {set.isPR && <span className="tag tag--pr">PR</span>}
          {hint === 'fire' && <span className="tag tag--fire">🔥</span>}
          {hint === 'low' && <span className="tag tag--low">low</span>}
          <button className="set__check set__check--on" onClick={toggle} aria-label="Undo set"><IconCheck size={22} /></button>
        </div>
      </div>
    )
  }

  return (
    <div className={`set ${current ? 'set--current' : ''}`} data-current={current || undefined}>
      <div className="set__top">
        <div className="set__num">{label}</div>
        <div className="set__rx num">{rx}</div>
        {hint === 'fire' && <span className="tag tag--fire">🔥 top of range</span>}
        {hint === 'low' && <span className="tag tag--low">below range</span>}
        {lastStr && <div className="set__last num">Last: {lastStr}</div>}
      </div>
      <div className="set__inputs">
        {hasLoad ? (
          <div ref={loadRef}>
            <Stepper value={toDisp(set.load, mode, units)} onChange={v => onChange({ load: v == null ? null : fromDisp(v, mode, units) })} step={step} decimals={decimals} allowEmpty />
          </div>
        ) : <span className="pill" style={{ minHeight: 48 }}>Bodyweight</span>}
        <div ref={repsRef}>
          <Stepper value={set.reps ?? set.prescribedReps} onChange={v => onChange({ reps: v })} step={1} min={0} max={200} />
        </div>
        <button className="set__check" onClick={toggle} aria-label="Complete set"><IconCheck size={22} /></button>
      </div>
      <div className="set__bottom">
        {power ? (
          <div className="row" style={{ gap: 8 }}>
            <span className="small" style={{ fontWeight: 700 }}>Explosive?</span>
            <Toggle on={set.explosive !== false} onChange={v => onChange({ explosive: v })} label="Every rep explosive" />
          </div>
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <span className="tiny" style={{ fontWeight: 800 }}>RIR</span>
            <div className="rir" role="radiogroup" aria-label="Reps in reserve">
              {[0, 1, 2, 3, 4].map(r => (
                <button key={r} role="radio" aria-checked={set.rir === r} className={`rir__btn ${set.rir === r ? 'rir__btn--on' : ''}`} onClick={() => { haptic.tap(); onChange({ rir: r }) }}>{r}</button>
              ))}
            </div>
          </div>
        )}
        {hasLoad && ex.calibration && set.load == null
          ? <span className="tiny accent" style={{ fontWeight: 700 }}>← pick a weight ({unit})</span>
          : <span className="tiny" style={{ marginLeft: 'auto' }}>{hasLoad ? `${unit} · reps` : 'reps'}</span>}
      </div>
    </div>
  )
}
