import { motion } from 'motion/react'
import { eatingTimeline, fastingHours } from '../../lib/stats'

const FILL = {
  sleep: 'rgba(255,255,255,0.04)',
  fast: 'var(--accent-2-soft)',
  meal: 'var(--grad-upper)',
  treat: 'var(--grad-power)',
} as const

/** Horizontal 24 h strip: sleep, fasting window, Meal 1, Meal 2 and Tony's. */
export function EatingTimeline({ mealTimes }: { mealTimes: [string, string] }) {
  const segs = eatingTimeline(mealTimes)
  const fh = fastingHours(mealTimes)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ position: 'relative', height: 34, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex' }}>
        {segs.map((s, i) => (
          <motion.div key={i} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: `${((s.endH - s.startH) / 24) * 100}%`, background: FILL[s.kind], transformOrigin: 'left', borderLeft: s.kind === 'meal' || s.kind === 'treat' ? '2px solid var(--bg)' : undefined, display: 'grid', placeItems: 'center' }}>
            {s.kind === 'treat' && <span style={{ fontSize: 14 }} aria-label="Tony's Chocolonely">🍫</span>}
          </motion.div>
        ))}
      </div>
      <div style={{ position: 'relative', height: 16 }}>
        {[0, 6, 12, 18, 24].map(h => (
          <span key={h} className="tiny num" style={{ position: 'absolute', left: `${(h / 24) * 100}%`, transform: h === 24 ? 'translateX(-100%)' : h === 0 ? undefined : 'translateX(-50%)' }}>{String(h).padStart(2, '0')}</span>
        ))}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="pill pill--upper">Fasting ≈ {fh} h</span>
        <span className="pill" style={{ background: 'var(--accent-2-soft)', color: 'var(--text)' }}>Meal 1 · {mealTimes[0]}</span>
        <span className="pill" style={{ background: 'var(--accent-2-soft)', color: 'var(--text)' }}>Meal 2 · {mealTimes[1]}</span>
        <span className="pill pill--gold">🍫 after dinner</span>
      </div>
    </div>
  )
}
