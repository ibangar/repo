import type { ReactNode } from 'react'
import { fmtDateShort } from '../../lib/format'

/** Shared chart palette – matches the design tokens in global.css. */
export const C = {
  pink: '#ff4d7d',
  violet: '#8b6cff',
  gold: '#ffb547',
  green: '#2fd38a',
  cyan: '#38d6ff',
  orange: '#ff8a5c',
  muted: '#7d8095',
  line: 'rgba(255,255,255,0.08)',
  surface: '#151621',
  surface3: '#262838',
}

export const axisTick = { fontSize: 11, fill: C.muted, fontWeight: 600 } as const
export const xAxisProps = { axisLine: false, tickLine: false, tick: axisTick, tickMargin: 8, minTickGap: 24 } as const
export const yAxisProps = { axisLine: false, tickLine: false, tick: axisTick, width: 36 } as const

export const dateTick = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? fmtDateShort(v) : String(v ?? ''))

/** Area/bar gradient. Use `url(#id)` as the fill. */
export function Grad({ id, color, from = 0.55, to = 0 }: { id: string; color: string; from?: number; to?: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={from} />
      <stop offset="100%" stopColor={color} stopOpacity={to} />
    </linearGradient>
  )
}

interface TipPayload { value?: unknown; name?: unknown; color?: string; dataKey?: unknown; payload?: Record<string, unknown> }
export interface TipProps {
  active?: boolean
  payload?: ReadonlyArray<TipPayload>
  label?: unknown
  /** Render the rows yourself from the data point. */
  render?: (point: Record<string, unknown>, payload: ReadonlyArray<TipPayload>) => ReactNode
  title?: (label: unknown, point: Record<string, unknown>) => ReactNode
}

/** Tooltip styled as a small card. Pass as `<Tooltip content={<ChartTip render={…} />} />`. */
export function ChartTip({ active, payload, label, render, title }: TipProps) {
  if (!active || !payload?.length) return null
  const point = (payload[0]?.payload ?? {}) as Record<string, unknown>
  return (
    <div className="card card--2" style={{ padding: '8px 12px', boxShadow: 'var(--shadow)', borderRadius: 12, minWidth: 110, pointerEvents: 'none' }}>
      <div className="tiny" style={{ marginBottom: 4, fontWeight: 700 }}>{title ? title(label, point) : dateTick(label)}</div>
      {render ? render(point, payload) : payload.map((p, i) => (
        <div key={i} className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color ?? C.pink, flex: 'none' }} />
          <span className="muted" style={{ fontWeight: 600 }}>{String(p.name ?? '')}</span>
          <span className="num" style={{ marginLeft: 'auto' }}>{typeof p.value === 'number' ? Math.round(p.value * 10) / 10 : String(p.value ?? '')}</span>
        </div>
      ))}
    </div>
  )
}

export const tooltipCursor = { stroke: 'rgba(255,255,255,0.18)', strokeDasharray: '3 3' } as const
