import { useMemo } from 'react'
import type { MuscleGroup, View } from '../../db/types'
import { Figure } from './Figure'

export interface BodyMapProps {
  primary: MuscleGroup[]
  secondary?: MuscleGroup[]
  /** 'both' renders front + back side by side */
  view?: View | 'both'
  /** height in px */
  height?: number
  className?: string
}

const LOWER: Set<string> = new Set(['glutes', 'quads', 'hamstrings', 'adductors', 'abductors', 'calves'])
const NEUTRAL = { torsoLean: 0, hipFlex: 0, kneeFlex: 0, shoulderFlex: 0, elbowFlex: 0, shoulderAbd: 14, legAbd: 3 }
const CHART_BOX = '46 14 108 182'

export function BodyMap({ primary, secondary = [], view = 'both', height = 220, className = '' }: BodyMapProps) {
  const hl = useMemo(() => {
    const m: Partial<Record<MuscleGroup, number>> = {}
    for (const s of secondary) m[s] = 0.42
    for (const p of primary) m[p] = 1
    return m
  }, [primary, secondary])
  const lower = primary.some(p => LOWER.has(p))
  const tint = lower ? 'var(--accent)' : 'var(--accent-2)'
  const views: View[] = view === 'both' ? ['front', 'back'] : [view === 'side' ? 'side' : view]
  const figH = height - 26

  return (
    <div className={`bodymap ${className}`} style={{ height, position: 'relative', borderRadius: 16, background: 'var(--surface-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 40%, ${lower ? 'rgba(255,77,125,0.13)' : 'rgba(139,108,255,0.13)'}, transparent 70%)` }} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6, padding: '8px 8px 0', minHeight: 0 }}>
        {views.map(v => (
          <div key={v} style={{ position: 'relative', height: figH, flex: '0 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Figure pose={NEUTRAL} view={v} mode="chart" highlight={hl} glow={1} viewBox={v === 'side' ? '30 14 140 182' : CHART_BOX} className="bodymap__fig" style={{ height: figH - 14, width: 'auto' }} />
            <span className="tiny" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginTop: -2 }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 14, padding: '2px 0 8px', position: 'relative' }}>
        <span className="tiny row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: tint, boxShadow: `0 0 8px ${tint}` }} /> Primary</span>
        <span className="tiny row" style={{ gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: tint, opacity: 0.45 }} /> Secondary</span>
      </div>
      <style>{`.bodymap__fig [data-muscle]{transition:fill .3s}.bodymap__glow{animation:bmPulse 2.2s ease-in-out infinite}@keyframes bmPulse{0%,100%{opacity:.75}50%{opacity:1}}`}</style>
    </div>
  )
}

export default BodyMap
