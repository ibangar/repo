import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getExercise } from '../../data/exercises'
import { toDisplay } from '../../engine/units'
import { useSettings } from '../../hooks/useSettings'
import { AnimatedNumber, Button, Card, Empty, Pill } from '../../components/ui'
import { IconTrophy } from '../../components/ui/Icons'
import { fmtDuration } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { sound } from '../../lib/sound'
import { fmtModeLoad, isGluteFocus } from '../../components/workout/helpers'
import { useProgram } from '../../hooks/useSettings'
import '../../components/workout/workout.css'

const COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--gold)', 'var(--good)', 'var(--cyan)', '#fff']

function Confetti() {
  const parts = useMemo(() => Array.from({ length: 56 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.9, d: 2.4 + Math.random() * 1.8,
    color: COLORS[i % COLORS.length], drift: (Math.random() - 0.5) * 160, w: 6 + Math.random() * 6,
  })), [])
  return (
    <div className="confetti" aria-hidden>
      {parts.map((p, i) => (
        <span key={i} className="confetti__p" style={{ left: `${p.left}%`, background: p.color, width: p.w, height: p.w * 1.6, ['--d' as string]: `${p.d}s`, ['--delay' as string]: `${p.delay}s`, ['--drift' as string]: `${p.drift}px` }} />
      ))}
    </div>
  )
}

export default function WorkoutSummary() {
  const { id } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const settings = useSettings()
  const program = useProgram()
  const session = useLiveQuery(async () => (id ? (await db.sessions.get(id)) ?? null : null), [id])
  const statesArr = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const notes = (loc.state as { notes?: { exerciseId: string; note: string }[] } | null)?.notes
  const played = useRef(false)
  const [confetti, setConfetti] = useState(true)

  useEffect(() => {
    if (!session || played.current) return
    played.current = true
    sound.complete()
    haptic.done()
    if (session.summary?.prs.length) setTimeout(() => sound.pr(), 800)
  }, [session])
  useEffect(() => { const t = setTimeout(() => setConfetti(false), 5000); return () => clearTimeout(t) }, [])

  if (!settings || session === undefined) return <div className="page page--nonav" />
  if (!session) {
    return <div className="page page--nonav"><Empty title="Session not found" body="It may have been discarded." action={<Button onClick={() => nav('/')}>Back to Today</Button>} /></div>
  }

  const units = settings.units
  const sum = session.summary ?? { volumeKg: 0, setsDone: 0, durationSec: Math.round(((session.completedAt ?? Date.now()) - session.startedAt) / 1000), prs: [] }
  const states = new Map((statesArr ?? []).map(s => [s.exerciseId, s]))
  const focus = program?.days[session.dayIndex]?.focus
  const gluteDay = focus ? isGluteFocus(focus) : session.exercises.some(e => getExercise(e.exerciseId).goalTag === 'glutes')
  const upperDay = focus ? !isGluteFocus(focus) : !gluteDay
  const volume = Math.round(toDisplay(sum.volumeKg, units))

  const lines = session.exercises.filter(e => !e.skipped && e.sets.some(s => s.done)).map(ex => {
    const def = getExercise(ex.exerciseId)
    const fromState = states.get(ex.exerciseId)
    const note = notes?.find(n => n.exerciseId === ex.exerciseId)?.note
      ?? (fromState && (fromState.currentLoad != null || fromState.loadMode === 'bodyweight')
        ? `Next: ${fmtModeLoad(fromState.currentLoad, fromState.loadMode, units)} × ${fromState.targetReps ?? ex.repMin}`
        : 'Logged.')
    const done = ex.sets.filter(s => s.done)
    const best = done.reduce<typeof done[number] | null>((b, s) => (!b || (s.reps ?? 0) > (b.reps ?? 0) ? s : b), null)
    return { def, note, done: done.length, best, mode: ex.loadMode, pr: ex.sets.some(s => s.isPR) }
  })

  return (
    <div className="page page--nonav stack-lg">
      {confetti && <Confetti />}

      <div className="sum-hero stagger">
        <div className="sum-emoji">{gluteDay ? '🍑' : sum.prs.length ? '🏆' : '💪'}</div>
        <div className="eyebrow mt-16">{session.dayName} · Week {session.weekNumber}{session.isDeload ? ' · Deload' : ''}</div>
        <h1 className={`title-xl mt-8 ${gluteDay ? 'gradient-text' : 'gradient-text--upper'}`}>Workout done</h1>
        <p className="body mt-8">
          {sum.prs.length ? `${sum.prs.length} new PR${sum.prs.length > 1 ? 's' : ''}. That's how it's built.` : gluteDay ? 'Glutes fed. Recovery starts now – protein and a walk.' : 'Solid work. Eat your protein and recover.'}
        </p>
      </div>

      <div className="grid-3 stagger">
        <Card className="sum-stat">
          <div className="stat__v"><AnimatedNumber value={volume} duration={1100} /></div>
          <div className="stat__l">{units} volume</div>
        </Card>
        <Card className="sum-stat">
          <div className="stat__v"><AnimatedNumber value={sum.setsDone} duration={900} /></div>
          <div className="stat__l">sets done</div>
        </Card>
        <Card className="sum-stat">
          <div className="stat__v num pop">{fmtDuration(sum.durationSec)}</div>
          <div className="stat__l">duration</div>
        </Card>
      </div>

      {sum.prs.length > 0 && (
        <section className="stack rise" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 8 }}><IconTrophy size={18} style={{ color: 'var(--gold)' }} /><span className="eyebrow" style={{ color: 'var(--gold)' }}>Personal records</span></div>
          <div className="stack stagger" style={{ gap: 8 }}>
            {sum.prs.map(pr => (
              <div key={pr.id} className="sum-pr">
                <Pill tone="gold">{pr.type === 'e1rm' ? 'e1RM' : pr.type}</Pill>
                <span className="grow">{getExercise(pr.exerciseId).shortName} · {pr.detail}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="stack rise" style={{ gap: 8 }}>
        <div className="eyebrow">What's next</div>
        <Card>
          {lines.length === 0 && <p className="body">No sets were logged.</p>}
          {lines.map(l => (
            <div key={l.def.id} className="sum-next">
              <div className="grow">
                <div className="row" style={{ gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>{l.def.name}</span>
                  {l.pr && <Pill tone="gold">PR</Pill>}
                </div>
                <div className="small num mt-8" style={{ marginTop: 2 }}>
                  {l.done} set{l.done > 1 ? 's' : ''}{l.best ? ` · best ${fmtModeLoad(l.best.load, l.mode, units)} × ${l.best.reps ?? 0}` : ''}
                </div>
                <div className="small mt-8" style={{ marginTop: 4, color: upperDay ? 'var(--accent-2)' : 'var(--accent)', fontWeight: 600 }}>{l.note}</div>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <div className="stack" style={{ gap: 10 }}>
        <Button variant={gluteDay ? 'primary' : 'upper'} size="lg" block onClick={() => nav('/', { replace: true })}>Done</Button>
        <Button variant="subtle" block onClick={() => nav('/progress')}>View progress</Button>
      </div>
    </div>
  )
}
