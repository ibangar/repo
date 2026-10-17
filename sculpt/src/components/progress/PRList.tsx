import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import type { PR } from '../../db/types'
import { EXERCISE_MAP } from '../../data/exercises'
import { fmtDate } from '../../lib/format'
import { groupPRsByMonth } from '../../lib/stats'
import { IconTrophy } from '../ui/Icons'
import { Empty } from '../ui'
import { haptic } from '../../lib/haptics'

const TYPE_LABEL: Record<PR['type'], string> = { e1rm: 'e1RM', load: 'Heaviest', reps: 'Reps', height: 'Box', bell: 'Bell' }

export function PRList({ prs, limit = 30 }: { prs: PR[]; limit?: number }) {
  const [filter, setFilter] = useState<string>('all')
  const exerciseIds = useMemo(() => [...new Set(prs.map(p => p.exerciseId))].filter(id => EXERCISE_MAP[id]).sort((a, b) => EXERCISE_MAP[a].shortName.localeCompare(EXERCISE_MAP[b].shortName)), [prs])
  const filtered = useMemo(() => (filter === 'all' ? prs : prs.filter(p => p.exerciseId === filter)).slice(0, 999), [prs, filter])
  const groups = useMemo(() => groupPRsByMonth(filtered), [filtered])
  let shown = 0

  if (!prs.length) return <Empty icon={<IconTrophy size={28} />} title="No PRs yet" body="Beat a previous best and it lands here with a trophy." />

  return (
    <div className="stack">
      <div className="chip-row">
        <button className={`chip ${filter === 'all' ? 'chip--on' : ''}`} onClick={() => { haptic.tap(); setFilter('all') }}>All</button>
        {exerciseIds.map(id => (
          <button key={id} className={`chip ${filter === id ? 'chip--on' : ''}`} onClick={() => { haptic.tap(); setFilter(id) }}>{EXERCISE_MAP[id].shortName}</button>
        ))}
      </div>
      {groups.map(g => {
        if (shown >= limit) return null
        return (
          <div key={g.month}>
            <div className="eyebrow" style={{ margin: '6px 0 2px' }}>{g.label}</div>
            {g.items.map((pr, i) => {
              if (shown++ >= limit) return null
              const ex = EXERCISE_MAP[pr.exerciseId]
              const glute = ex?.goalTag === 'glutes'
              return (
                <motion.div key={pr.id} className="list-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)', flex: 'none' }}>
                    <IconTrophy size={20} />
                  </div>
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{ fontWeight: 800 }}>{ex?.shortName ?? pr.exerciseId}</span>
                      <span className="pill" style={{ padding: '2px 7px', fontSize: 10, background: glute ? 'var(--accent-soft)' : 'var(--surface-3)', color: glute ? 'var(--accent)' : undefined }}>{TYPE_LABEL[pr.type]}</span>
                    </div>
                    <div className="small" style={{ marginTop: 2 }}>{pr.detail}</div>
                  </div>
                  <div className="tiny num" style={{ flex: 'none' }}>{fmtDate(pr.date, { day: 'numeric', month: 'short' })}</div>
                </motion.div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
