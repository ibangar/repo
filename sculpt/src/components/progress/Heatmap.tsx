import { motion } from 'motion/react'
import type { HeatCell } from '../../lib/stats'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** GitHub-style completion heatmap: 7 rows (Mon→Sun) × N week columns. */
export function Heatmap({ cells, today }: { cells: HeatCell[][]; today: string }) {
  const weeks = cells.length
  return (
    <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3, width: 12 }}>
        {DOW.map((d, i) => <span key={i} className="tiny" style={{ lineHeight: 1, display: 'grid', alignItems: 'center', fontWeight: 700, opacity: i % 2 ? 0 : 1 }}>{d}</span>)}
      </div>
      <div className="grow" style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 1fr)`, gap: 3 }} aria-label="Workout heatmap">
        {cells.map((col, ci) => (
          <div key={ci} style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3 }}>
            {col.map((c, ri) => {
              const on = c.count > 0
              const isToday = c.date === today
              return (
                <motion.div
                  key={c.date}
                  title={`${c.date}${on ? ` – ${c.count} session${c.count > 1 ? 's' : ''}` : ''}`}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: c.future ? 0.25 : 1, scale: 1 }}
                  transition={{ delay: (ci * 7 + ri) * 0.006, type: 'spring', stiffness: 300, damping: 22 }}
                  style={{
                    aspectRatio: '1 / 1', borderRadius: 5,
                    background: on ? (c.count > 1 ? 'var(--grad-glutes)' : 'var(--accent)') : 'var(--surface-3)',
                    boxShadow: on ? '0 0 10px rgba(255,77,125,0.35)' : undefined,
                    outline: isToday ? '1.5px solid var(--text)' : undefined, outlineOffset: 1,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
