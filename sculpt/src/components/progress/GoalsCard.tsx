import { motion } from 'motion/react'
import type { Units } from '../../db/types'
import { MEASURE_LABELS } from '../../engine/trends'
import { CM_PER_IN } from '../../engine/units'
import { MEASURE_GOAL_CAPTION, type GoalRow } from '../../lib/stats'
import { IconArrowDown, IconArrowUp, IconMinus } from '../ui/Icons'

const VERDICT_COLOR = { good: 'var(--good)', watch: 'var(--warn)', neutral: 'var(--muted)' } as const
const VERDICT_LABEL = { good: 'On track', watch: 'Watch', neutral: 'Steady' } as const

export function fmtDelta(cm: number, units: Units): string {
  const v = units === 'kg' ? cm : cm / CM_PER_IN
  const r = Math.round(v * 10) / 10
  return `${r > 0 ? '+' : ''}${r} ${units === 'kg' ? 'cm' : 'in'}`
}
export function fmtLen(cm: number | null, units: Units): string {
  if (cm == null) return '—'
  const v = units === 'kg' ? cm : cm / CM_PER_IN
  return `${Math.round(v * 10) / 10} ${units === 'kg' ? 'cm' : 'in'}`
}

/** Tape-measure goals: first vs latest with arrows, deltas and a coloured verdict. */
export function GoalsCard({ rows, units, compact }: { rows: GoalRow[]; units: Units; compact?: boolean }) {
  return (
    <div className="stack" style={{ gap: 0 }}>
      {rows.map((r, i) => {
        const v = r.verdict
        const color = v ? VERDICT_COLOR[v] : 'var(--muted)'
        const Arrow = r.delta == null ? IconMinus : r.delta > 0.4 ? IconArrowUp : r.delta < -0.4 ? IconArrowDown : IconMinus
        const hips = r.key === 'hips'
        return (
          <motion.div key={r.key} className="list-item" style={{ minHeight: compact ? 48 : 60 }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: v === 'good' ? 'var(--good-soft)' : v === 'watch' ? 'rgba(255,176,32,0.16)' : 'var(--surface-3)', color, flex: 'none' }}>
              <Arrow size={18} />
            </div>
            <div className="grow">
              <div className="row" style={{ gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{MEASURE_LABELS[r.key]}</span>
                {hips && v === 'good' && <span aria-hidden>🍑</span>}
              </div>
              <div className="tiny">{compact ? `${fmtLen(r.first, units)} → ${fmtLen(r.last, units)}` : MEASURE_GOAL_CAPTION[r.key]}</div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div className="num" style={{ fontWeight: 900, fontSize: 15, color: r.delta == null ? 'var(--muted)' : color }}>{r.delta == null ? '—' : fmtDelta(r.delta, units)}</div>
              <div className="tiny" style={{ color, fontWeight: 700 }}>{v ? VERDICT_LABEL[v] : 'No data'}</div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
