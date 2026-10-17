import { useEffect, useMemo, useRef, useState } from 'react'
import { getExercise } from '../../data/exercises'
import type { MuscleGroup } from '../../db/types'
import { Figure, FLOOR_Y, CX } from './Figure'
import { frameFor, getAnimation, glowAt, poseAt } from './animations'

export interface ExerciseAnimationProps {
  exerciseId: string
  /** px; the component is square (unless `fluid`) */
  size?: number
  playing?: boolean
  /** show the muscle-highlight glow */
  highlight?: boolean
  className?: string
  /** Fade "START" / "END" captions in at the two ends of the rep. */
  showLabels?: boolean
  /** Playback speed multiplier (1 = real time). */
  speed?: number
  /** Stretch to the container width; `size` then becomes the height. */
  fluid?: boolean
  /** Freeze at a normalised time (0..1) – for previews/tests. */
  frozenT?: number
  /** Called every frame with the normalised time. */
  onTick?: (t: number) => void
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function ExerciseAnimation({ exerciseId, size = 160, playing = true, highlight = true, className = '', showLabels = false, speed = 1, fluid = false, frozenT, onTick }: ExerciseAnimationProps) {
  const ex = getExercise(exerciseId)
  const def = getAnimation(ex.animation)
  const hostRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [t, setT] = useState(frozenT ?? 0)
  const tRef = useRef(frozenT ?? 0)
  const tickRef = useRef(onTick)
  tickRef.current = onTick

  // Dev helper: /exercises/x?t=0.5 freezes the animation.
  const devT = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return undefined
    const v = new URLSearchParams(window.location.search).get('t')
    return v == null ? undefined : Math.max(0, Math.min(1, parseFloat(v)))
  }, [])
  const frozen = frozenT ?? devT

  // Pause when scrolled off-screen (battery).
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const active = playing && visible && frozen == null && !reduced()
  useEffect(() => {
    if (frozen != null) { tRef.current = frozen; setT(frozen); return }
    if (!active) return
    let raf = 0
    let last = performance.now()
    const dur = def.durationMs / Math.max(0.1, speed)
    // Small thumbnails don't need 60 fps.
    const minFrame = size < 120 ? 1000 / 24 : 0
    let acc = 0
    const tick = (now: number) => {
      const dt = now - last
      last = now
      acc += dt
      let cur = tRef.current + dt / dur
      if (def.loop === 'pingpong') { cur = cur % 2 } else { cur = cur % 1 }
      tRef.current = cur
      if (acc >= minFrame) {
        acc = 0
        const shown = def.loop === 'pingpong' ? (cur <= 1 ? cur : 2 - cur) : cur
        setT(shown)
        tickRef.current?.(shown)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, def, speed, size, frozen])

  const pose = poseAt(def, t)
  const glow = glowAt(def, t)
  const hl = useMemo(() => {
    if (!highlight) return {}
    const m: Partial<Record<MuscleGroup, number>> = {}
    for (const p of ex.primary) m[p] = 1
    for (const s of ex.secondary) m[s] = Math.max(m[s] ?? 0, 0.45)
    return m
  }, [ex, highlight])

  const lower = ex.goalTag === 'glutes' || ex.goalTag === 'legStrength' || ex.goalTag === 'power'
  const tint = lower ? 'var(--accent)' : 'var(--accent-2)'
  const bell = (x: number, c: number, w: number) => Math.max(0, 1 - Math.min(Math.abs(x - c), Math.abs(x - c + 1), Math.abs(x - c - 1)) / w)
  const startOp = bell(t, 0, 0.14)
  const endOp = bell(t, def.peak ?? 0.5, 0.14)
  // Fade through a discontinuous loop wrap (box jump).
  const wrapFade = def.snap ? Math.min(1, Math.min(t, 1 - t) / 0.04 + 0.15) : 1
  const lift = pose.lift ?? 0

  return (
    <div ref={hostRef} className={`exanim ${className}`} style={{ width: fluid ? '100%' : size, height: size, position: 'relative', borderRadius: 18, overflow: 'hidden', background: 'var(--surface-2)' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 55% at 50% 42%, ${lower ? 'rgba(255,77,125,0.16)' : 'rgba(139,108,255,0.16)'}, transparent 70%)` }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 90% 30% at 50% 100%, rgba(0,0,0,0.5), transparent 70%)' }} />
      <Figure
        pose={pose} view={def.view} highlight={hl} glow={glow} equipment={def.equipment} anchor={def.anchor} anchorY={def.anchorY} viewBox={frameFor(def)}
        style={{ width: '100%', height: '100%', opacity: wrapFade, transition: active ? undefined : 'opacity 0.2s' }}
      >
        <line x1={CX - 90} y1={FLOOR_Y + 0.5} x2={CX + 90} y2={FLOOR_Y + 0.5} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        <ellipse cx={CX} cy={FLOOR_Y + 3} rx={Math.max(14, 34 - lift * 0.4)} ry={4} fill="rgba(0,0,0,0.5)" opacity={Math.max(0.2, 0.6 - lift * 0.01)} style={{ filter: 'blur(2px)' }} />
      </Figure>
      {showLabels && (
        <>
          <span className="eyebrow" style={{ position: 'absolute', left: 12, bottom: 12, padding: '5px 10px', borderRadius: 999, background: 'rgba(8,8,13,0.6)', opacity: startOp, color: 'var(--text-2)', transition: 'opacity 0.15s', backdropFilter: 'blur(6px)' }}>{def.labels?.start ?? 'START'}</span>
          <span className="eyebrow" style={{ position: 'absolute', right: 12, bottom: 12, padding: '5px 10px', borderRadius: 999, background: 'rgba(8,8,13,0.6)', opacity: endOp, color: tint, transition: 'opacity 0.15s', backdropFilter: 'blur(6px)' }}>{def.labels?.end ?? 'END'}</span>
        </>
      )}
    </div>
  )
}

export default ExerciseAnimation
