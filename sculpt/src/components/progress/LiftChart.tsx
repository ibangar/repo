import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { LoadMode, Units } from '../../db/types'
import { formatLoad, toDisplay } from '../../engine/units'
import type { E1rmPoint } from '../../lib/stats'
import { C, ChartTip, Grad, tooltipCursor, xAxisProps, yAxisProps, dateTick } from './chart'

interface Props { points: E1rmPoint[]; units: Units; loadMode: LoadMode; color?: string; height?: number }

/** e1RM over time. Best point is marked gold. For power lifts the raw load is plotted. */
export function LiftChart({ points, units, loadMode, color = C.pink, height = 220 }: Props) {
  const isHeight = loadMode === 'height'
  const isLoadOnly = isHeight || loadMode === 'bell'
  const fmtVal = (v: number) => (isHeight ? `${Math.round(v)} cm` : formatLoad(v, units))
  const data = points.map(p => ({ ...p, disp: isHeight ? p.value : Math.round(toDisplay(p.value, units) * 10) / 10 }))
  const vals = data.map(d => d.disp)
  const lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = Math.max(1, (hi - lo) * 0.25)
  const gradId = `lift-${color.replace('#', '')}`
  return (
    <div style={{ height, marginLeft: -8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <defs><Grad id={gradId} color={color} from={0.4} /></defs>
          <CartesianGrid stroke={C.line} vertical={false} />
          <XAxis dataKey="date" tickFormatter={dateTick} {...xAxisProps} />
          <YAxis domain={[Math.floor(lo - pad), Math.ceil(hi + pad)]} {...yAxisProps} />
          <Tooltip cursor={tooltipCursor} content={<ChartTip render={p => (
            <>
              <div style={{ fontSize: 16, fontWeight: 900 }} className="num">{fmtVal(p.value as number)}</div>
              <div className="tiny">{isLoadOnly ? `${p.reps} reps` : `${formatLoad(p.load as number, units)} × ${p.reps}`}{p.isBest ? ' · best' : ''}</div>
            </>
          )} />} />
          <Area type="monotone" dataKey="disp" stroke="none" fill={`url(#${gradId})`} isAnimationActive animationDuration={900} />
          <Line type="monotone" dataKey="disp" stroke={color} strokeWidth={2.5} isAnimationActive animationDuration={900}
            dot={(props: { cx?: number; cy?: number; payload?: E1rmPoint; index?: number }) => {
              const { cx, cy, payload, index } = props
              if (cx == null || cy == null) return <g key={index} />
              const best = payload?.isBest
              return (
                <g key={index}>
                  {best && <circle cx={cx} cy={cy} r={9} fill={C.gold} opacity={0.25} />}
                  <circle cx={cx} cy={cy} r={best ? 5 : 3.5} fill={best ? C.gold : color} stroke={C.surface} strokeWidth={2} />
                </g>
              )
            }}
            activeDot={{ r: 6, fill: color, stroke: C.surface, strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
