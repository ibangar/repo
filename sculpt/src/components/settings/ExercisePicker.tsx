import { useMemo, useState } from 'react'
import { EXERCISES, EQUIPMENT_LABELS } from '../../data/exercises'
import type { ExerciseDef, GoalTag } from '../../db/types'
import { Input, Pill, Sheet } from '../ui'
import { IconCheck } from '../ui/Icons'
import { haptic } from '../../lib/haptics'

export const GOAL_LABELS: Record<GoalTag, string> = { glutes: 'Glutes', upper: 'Upper body', legStrength: 'Leg strength', power: 'Power' }
const GOAL_ORDER: GoalTag[] = ['glutes', 'upper', 'legStrength', 'power']
const goalTone = (g: GoalTag): 'accent' | 'upper' | 'gold' | 'good' => g === 'glutes' ? 'accent' : g === 'upper' ? 'upper' : g === 'power' ? 'gold' : 'good'

/** Bottom-sheet exercise picker grouped by goal. */
export function ExercisePicker({ open, onClose, onPick, title = 'Pick an exercise', selected, only, subtitle }: {
  open: boolean; onClose: () => void; onPick: (def: ExerciseDef) => void; title?: string; selected?: string; only?: Set<string>; subtitle?: (def: ExerciseDef) => string | undefined
}) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = EXERCISES.filter(e => (!only || only.has(e.id)) && (!needle || e.name.toLowerCase().includes(needle) || e.shortName.toLowerCase().includes(needle)))
    return GOAL_ORDER.map(g => ({ goal: g, items: list.filter(e => e.goalTag === g) })).filter(g => g.items.length)
  }, [q, only])
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      <div className="stack" style={{ gap: 16 }}>
        {groups.map(g => (
          <div key={g.goal}>
            <div className="row" style={{ marginBottom: 6 }}><Pill tone={goalTone(g.goal)}>{GOAL_LABELS[g.goal]}</Pill><span className="tiny">{g.items.length}</span></div>
            {g.items.map(def => {
              const on = def.id === selected
              const sub = subtitle?.(def) ?? def.equipment.map(e => EQUIPMENT_LABELS[e]).join(' · ')
              return (
                <button key={def.id} className="list-item" style={{ width: '100%', textAlign: 'left', color: 'inherit' }} onClick={() => { haptic.tap(); onPick(def) }}>
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{def.name}</div>
                    <div className="small">{sub}</div>
                  </div>
                  {on && <IconCheck size={20} style={{ color: 'var(--accent)' }} />}
                </button>
              )
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="body center" style={{ padding: 20 }}>Nothing matches “{q}”.</p>}
      </div>
    </Sheet>
  )
}
