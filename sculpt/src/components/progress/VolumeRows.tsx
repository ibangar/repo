import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Units, VolumeGroup } from '../../db/types'
import { VOLUME_GROUP_LABELS } from '../../data/exercises'
import { toDisplay } from '../../engine/units'
import { VOLUME_GROUPS, type WeekVolume } from '../../lib/stats'
import { fmtDateShort } from '../../lib/format'
import { C, ChartTip } from './chart'

export const GROUP_COLOR: Record<VolumeGroup, string> = {
  glutes: C.pink, hamstrings: C.orange, quads: C.muted,
  chest: C.violet, delts: C.cyan, back: C.green, arms: C.gold,
}

function fmtVol(kg: number, units: Units): string {
  const v = toDisplay(kg, units)
  return v >= 10_000 ? `${(v / 1000).toFixed(1)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))
}

/** Seven small bar rows (one per muscle group), 8 weeks each. Glutes first and pink. */
export function VolumeRows({ weeks, units, weekComplete }: { weeks: WeekVolume[]; units: Units; weekComplete: boolean }) {
  const order: VolumeGroup[] = ['glutes', 'hamstrings', 'quads', 'chest', 'delts', 'back', 'arms']
  const max = Math.max(1, ...weeks.flatMap(w => VOLUME_GROUPS.map(g => w.volume[g])))
  const cur = weeks[weeks.length - 1]
  const prev = weeks[weeks.length - 2]
  return (
    <div className="stack stagger" style={{ gap: 6 }}>
      {order.map(g => {
        const color = GROUP_COLOR[g]
        const data = weeks.map(w => ({ weekStart: w.weekStart, v: w.volume[g], sets: w.hardSets[g] }))
        const now = cur?.volume[g] ?? 0
        const was = prev?.volume[g] ?? 0
        const diff = weekComplete && was > 0 ? Math.round(((now - was) / was) * 100) : null
        const glutes = g === 'glutes'
        return (
          <div key={g} className="row" style={{ gap: 10, minHeight: 44, padding: glutes ? '6px 8px' : '2px 8px', borderRadius: 12, background: glutes ? 'var(--accent-soft)' : undefined }}>
            <div style={{ width: 84, flex: 'none' }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: glutes ? 'var(--accent)' : 'var(--text)' }}>{VOLUME_GROUP_LABELS[g]}</div>
              <div className="tiny num">{cur ? `${cur.hardSets[g]} sets` : ''}</div>
            </div>
            <div className="grow" style={{ height: 40 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap={3}>
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} wrapperStyle={{ zIndex: 5 }} content={<ChartTip title={(_, p) => `Week of ${fmtDateShort(String(p.weekStart))}`} render={p => (
                    <>
                      <div className="num" style={{ fontSize: 15, fontWeight: 900 }}>{fmtVol(p.v as number, units)} {units}</div>
                      <div className="tiny">{VOLUME_GROUP_LABELS[g]} · {String(p.sets)} hard sets</div>
                    </>
                  )} />} />
                  <Bar dataKey="v" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={700} background={{ fill: 'rgba(255,255,255,0.03)', radius: 3 }} maxBarSize={28}>
                    {data.map((d, i) => <Cell key={d.weekStart} fill={color} fillOpacity={i === data.length - 1 ? 1 : 0.45 + (i / data.length) * 0.3} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ width: 60, flex: 'none', textAlign: 'right' }}>
              <div className="num" style={{ fontWeight: 900, fontSize: 14 }}>{fmtVol(now, units)}</div>
              <div className="tiny num" style={{ color: diff == null ? undefined : diff > 0 ? 'var(--good)' : diff < 0 ? 'var(--muted)' : undefined }}>
                {diff == null ? (weekComplete ? units : 'so far') : `${diff > 0 ? '+' : ''}${diff}%`}
              </div>
            </div>
            <span className="sr-only">{`${VOLUME_GROUP_LABELS[g]}: ${Math.round(now)} kg this week, ${Math.round((now / max) * 100)}% of peak`}</span>
          </div>
        )
      })}
    </div>
  )
}
