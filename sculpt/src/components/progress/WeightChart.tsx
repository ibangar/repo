import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Units } from '../../db/types'
import type { WeeklyWeight } from '../../engine/trends'
import { toDisplay } from '../../engine/units'
import { fmtDateShort } from '../../lib/format'
import { C, ChartTip, Grad, tooltipCursor, xAxisProps, yAxisProps, dateTick } from './chart'

interface Props { weekly: WeeklyWeight[]; trend: number[]; units: Units; height?: number }

/** Weekly average weigh-ins (dots) with the EMA trend line, last 16 weeks. */
export function WeightChart({ weekly, trend, units, height = 220 }: Props) {
  const r1 = (n: number) => Math.round(toDisplay(n, units) * 10) / 10
  const data = weekly.map((w, i) => ({ weekStart: w.weekStart, avg: r1(w.avgKg), trend: r1(trend[i] ?? w.avgKg), n: w.n }))
  const vals = data.flatMap(d => [d.avg, d.trend])
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = Math.max(units === 'kg' ? 0.6 : 1.5, (hi - lo) * 0.3)
  const stepBase = units === 'kg' ? 0.5 : 1
  const min = Math.floor((lo - pad) / stepBase) * stepBase, max = Math.ceil((hi + pad) / stepBase) * stepBase
  let step = stepBase
  while ((max - min) / step > 5) step *= 2
  const ticks: number[] = []
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100)
  return (
    <div style={{ height, marginLeft: -8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs><Grad id="wt-grad" color={C.violet} from={0.35} /></defs>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="weekStart" tickFormatter={dateTick} {...xAxisProps} />
          <YAxis domain={[min, max]} ticks={ticks} {...yAxisProps} width={40} tickFormatter={v => String(v)} />
          <Tooltip cursor={tooltipCursor} content={<ChartTip title={(_, p) => `Week of ${fmtDateShort(String(p.weekStart))}`} render={p => (
            <>
              <div className="num" style={{ fontSize: 16, fontWeight: 900 }}>{String(p.avg)} {units}</div>
              <div className="tiny">trend {String(p.trend)} {units} · {String(p.n)} weigh-in{p.n === 1 ? '' : 's'}</div>
            </>
          )} />} />
          <Area type="monotone" dataKey="trend" stroke="none" fill="url(#wt-grad)" isAnimationActive animationDuration={900} />
          <Line type="monotone" dataKey="trend" stroke={C.violet} strokeWidth={2.5} dot={false} isAnimationActive animationDuration={900} activeDot={false} />
          <Line type="monotone" dataKey="avg" stroke="none" isAnimationActive animationDuration={600}
            dot={{ r: 4, fill: C.pink, stroke: C.surface, strokeWidth: 2 }} activeDot={{ r: 6, fill: C.pink, stroke: C.surface, strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
