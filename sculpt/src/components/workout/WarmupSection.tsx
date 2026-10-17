import type { SessionExercise, Units } from '../../db/types'
import { WARMUP_CHECKLIST } from '../../data/program'
import { Card, Pill } from '../ui'
import { IconCheck, IconChevronDown } from '../ui/Icons'
import { haptic } from '../../lib/haptics'
import { exerciseFor, fmtModeLoad } from './helpers'

export interface WarmupSectionProps {
  checked: Set<string>
  onToggleItem: (id: string) => void
  /** The exercise carrying the ramp-up sets (first compound), if any. */
  ramp: { exIdx: number; ex: SessionExercise } | null
  onToggleWarmup: (exIdx: number, i: number) => void
  units: Units
  expanded: boolean
  onToggleExpanded: () => void
}

export function WarmupSection({ checked, onToggleItem, ramp, onToggleWarmup, units, expanded, onToggleExpanded }: WarmupSectionProps) {
  const total = WARMUP_CHECKLIST.length + (ramp?.ex.warmups.length ?? 0)
  const done = WARMUP_CHECKLIST.filter(i => checked.has(i.id)).length + (ramp?.ex.warmups.filter(w => w.done).length ?? 0)
  const mins = Math.round(WARMUP_CHECKLIST.reduce((a, i) => a + i.seconds, 0) / 60)
  const working = ramp ? ramp.ex.sets[0]?.load ?? ramp.ex.sets[0]?.prescribedLoad ?? null : null

  return (
    <Card className="ex-card">
      <button className="row-between" style={{ width: '100%', textAlign: 'left', minHeight: 36 }} onClick={() => { haptic.tap(); onToggleExpanded() }} aria-expanded={expanded}>
        <div className="grow">
          <div className="row" style={{ gap: 8 }}>
            <span className="subtitle">Warm-up</span>
            <Pill tone={done === total && total > 0 ? 'good' : 'default'}>{done}/{total}</Pill>
          </div>
          <div className="small">≈ {mins} min · get warm, prime the glutes, then ramp up</div>
        </div>
        <span className={`collapse-btn ${expanded ? 'collapse-btn--open' : ''}`}><IconChevronDown size={20} /></span>
      </button>

      {expanded && (
        <div className="mt-8 stagger">
          {WARMUP_CHECKLIST.map(item => {
            const on = checked.has(item.id)
            return (
              <button key={item.id} className={`wu-item ${on ? 'wu-item--on' : ''}`} style={{ width: '100%', textAlign: 'left' }} onClick={() => { haptic.tap(); onToggleItem(item.id) }}>
                <span className={`wu-check ${on ? 'wu-check--on' : ''}`}><IconCheck size={16} /></span>
                <span className="grow">
                  <div className="wu-label" style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                  <div className="small">{item.detail}</div>
                </span>
                <span className="tiny num">{Math.round(item.seconds / 60) || 1} min</span>
              </button>
            )
          })}

          {ramp && ramp.ex.warmups.length > 0 && (
            <div className="mt-8">
              <div className="eyebrow" style={{ marginBottom: 4 }}>Ramp-up · {exerciseFor(ramp.ex).shortName}</div>
              {ramp.ex.warmups.map((w, i) => {
                const pct = working && w.load != null ? Math.round((w.load / working) * 100) : null
                return (
                  <button key={i} className={`wu-ramp ${w.done ? 'wu-item--on' : ''}`} style={{ width: '100%', textAlign: 'left' }} onClick={() => { haptic.tap(); onToggleWarmup(ramp.exIdx, i) }}>
                    <span className={`wu-check ${w.done ? 'wu-check--on' : ''}`}><IconCheck size={16} /></span>
                    <span className="wu-ramp__pct num">{pct != null ? `${pct}%` : 'warm'}</span>
                    <span className="wu-label num" style={{ fontWeight: 700 }}>{fmtModeLoad(w.load, ramp.ex.loadMode, units)} × {w.reps ?? w.prescribedReps}</span>
                    <span className="tiny" style={{ marginLeft: 'auto' }}>easy</span>
                  </button>
                )
              })}
            </div>
          )}
          {ramp && ramp.ex.warmups.length === 0 && ramp.ex.calibration && ramp.ex.loadMode === 'weight' && (
            <p className="tiny mt-8">Ramp-up sets appear once you pick a working weight for {exerciseFor(ramp.ex).shortName}.</p>
          )}
        </div>
      )}
    </Card>
  )
}
