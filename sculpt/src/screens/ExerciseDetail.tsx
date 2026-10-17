import { useCallback, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, PageHeader, Pill, Segmented, Sheet } from '../components/ui'
import { IconChevronRight, IconPause, IconPlay, IconX } from '../components/ui/Icons'
import { EXERCISE_MAP, EQUIPMENT_LABELS, MUSCLE_LABELS, getExercise, swapCandidates } from '../data/exercises'
import { db } from '../db/schema'
import { resetCalibration } from '../db/repo'
import { useSettings } from '../hooks/useSettings'
import { formatCm, formatLoad } from '../engine/units'
import { fmtDate } from '../lib/format'
import { haptic } from '../lib/haptics'
import type { ExerciseDef, ExerciseState, GoalTag, HistoryPoint, MuscleGroup, Units } from '../db/types'
import { Figure } from '../components/anatomy/Figure'
import { getAnimation, glowAt, poseAt } from '../components/anatomy/animations'
import { ExerciseAnimation } from '../components/anatomy/ExerciseAnimation'
import { BodyMap } from '../components/anatomy/BodyMap'

const GOAL: Record<GoalTag, { label: string; tone: 'accent' | 'upper' | 'gold' | 'default' }> = {
  glutes: { label: '🍑 Glutes', tone: 'accent' },
  upper: { label: 'Upper body', tone: 'upper' },
  legStrength: { label: 'Leg strength', tone: 'default' },
  power: { label: '⚡ Power', tone: 'gold' },
}
const OUTCOME: Record<HistoryPoint['outcome'], { label: string; tone: 'good' | 'accent' | 'bad' | 'default' | 'gold' }> = {
  hitTop: { label: 'Hit the top – load goes up', tone: 'good' },
  inRange: { label: 'In range – chase one more rep', tone: 'default' },
  missedBottom: { label: 'Missed the bottom', tone: 'bad' },
  deload: { label: 'Deload week', tone: 'default' },
  power: { label: 'Explosive', tone: 'gold' },
}

function loadText(state: ExerciseState, units: Units): string {
  const v = state.currentLoad
  switch (state.loadMode) {
    case 'bodyweight': return 'Bodyweight'
    case 'assisted': return v == null ? '—' : `−${formatLoad(v, units)} assist`
    case 'added': return v == null ? '—' : `+${formatLoad(v, units)}`
    case 'height': return formatCm(v, units)
    default: return formatLoad(v, units)
  }
}

export default function ExerciseDetail() {
  const { id = '' } = useParams()
  const ex = EXERCISE_MAP[id] ?? getExercise('backSquat')
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('sheet')) return <DevSheet ex={ex} />
  return <Detail ex={ex} />
}

function Detail({ ex }: { ex: ExerciseDef }) {
  const settings = useSettings()
  const state = useLiveQuery(() => db.exerciseStates.get(ex.id), [ex.id])
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<'0.5' | '1'>('1')
  const [confirm, setConfirm] = useState(false)
  const goal = GOAL[ex.goalTag]
  const swaps = useMemo(() => swapCandidates(ex.id, settings ? new Set(settings.equipment) : undefined), [ex.id, settings])
  const lower = ex.goalTag !== 'upper'
  const last = state?.history[state.history.length - 1]

  const doReset = useCallback(async () => {
    await resetCalibration(ex.id)
    haptic.success()
    setConfirm(false)
  }, [ex.id])

  if (!settings) return <div className="page" />

  return (
    <div className="page stack-lg">
      <PageHeader back="/exercises" eyebrow={ex.pattern.replace(/([A-Z])/g, ' $1').trim()} title={ex.name} right={<Pill tone={goal.tone}>{goal.label}</Pill>} />

      <div className="stack rise">
        <ExerciseAnimation exerciseId={ex.id} size={320} fluid playing={playing} speed={speed === '1' ? 1 : 0.5} showLabels />
        <div className="row-between">
          <div className="row">
            <Button icon variant={lower ? 'primary' : 'upper'} aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)}>
              {playing ? <IconPause size={22} /> : <IconPlay size={22} />}
            </Button>
            <span className="small">{playing ? 'Playing' : 'Paused'} · {Math.round(getAnimation(ex.animation).durationMs / (speed === '1' ? 1000 : 500) * 10) / 10}s per rep</span>
          </div>
          <div style={{ width: 130 }}>
            <Segmented value={speed} onChange={setSpeed} options={[{ value: '0.5', label: '0.5×' }, { value: '1', label: '1×' }]} />
          </div>
        </div>
      </div>

      <p className="body rise" style={{ fontSize: 16, lineHeight: 1.5 }}>{ex.description}</p>

      <section className="stack">
        <h2 className="subtitle">Form cues</h2>
        <Card className="stack stagger" style={{ gap: 10 }}>
          {ex.cues.map((c, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <span className="num" style={{ width: 26, height: 26, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: lower ? 'var(--accent-soft)' : 'var(--accent-2-soft)', color: lower ? 'var(--accent)' : 'var(--accent-2)' }}>{i + 1}</span>
              <span style={{ fontSize: 15, lineHeight: 1.4, paddingTop: 3 }}>{c}</span>
            </div>
          ))}
        </Card>
      </section>

      <section className="stack">
        <h2 className="subtitle">Common mistakes</h2>
        <Card className="stack stagger" style={{ gap: 10 }}>
          {ex.mistakes.map((m, i) => (
            <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--bad-soft)', color: 'var(--bad)' }}><IconX size={14} /></span>
              <span className="body" style={{ lineHeight: 1.4, paddingTop: 3 }}>{m}</span>
            </div>
          ))}
        </Card>
      </section>

      <section className="stack">
        <h2 className="subtitle">Muscles worked</h2>
        <BodyMap primary={ex.primary} secondary={ex.secondary} view="both" height={250} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {ex.primary.map(m => <Pill key={m} tone={lower ? 'accent' : 'upper'}>{MUSCLE_LABELS[m]}</Pill>)}
          {ex.secondary.map(m => <Pill key={m}>{MUSCLE_LABELS[m]}</Pill>)}
        </div>
      </section>

      <section className="stack">
        <h2 className="subtitle">Your numbers</h2>
        <Card glow={lower} upper={!lower} className="stack">
          {state ? (
            <>
              <div className="grid-3">
                <div className="stat"><span className="stat__v num">{loadText(state, settings.units)}</span><span className="stat__l">Next load</span></div>
                <div className="stat"><span className="stat__v num">{state.bestE1rm != null ? formatLoad(state.bestE1rm, settings.units, false) : '—'}</span><span className="stat__l">Best e1RM {state.bestE1rm != null && settings.units}</span></div>
                <div className="stat"><span className="stat__v num">{state.history.length}</span><span className="stat__l">Sessions</span></div>
              </div>
              {last && (
                <div className="row-between" style={{ paddingTop: 4 }}>
                  <span className="small">Last time · {fmtDate(last.date)}</span>
                  <Pill tone={OUTCOME[last.outcome].tone}>{OUTCOME[last.outcome].label}</Pill>
                </div>
              )}
              {!state.calibrated && <p className="small">Still calibrating – pick a weight you can hit the top of the range with next session.</p>}
              <Button variant="subtle" block onClick={() => setConfirm(true)}>Reset calibration</Button>
            </>
          ) : (
            <p className="body">No history yet. Your first session calibrates the starting load.</p>
          )}
        </Card>
      </section>

      {swaps.length > 0 && (
        <section className="stack">
          <h2 className="subtitle">Swap options</h2>
          <Card className="stagger" style={{ padding: '4px 16px' }}>
            {swaps.map(s => (
              <Link key={s.id} to={`/exercises/${s.id}`} className="list-item" onClick={() => haptic.tap()}>
                <ExerciseAnimation exerciseId={s.id} size={56} playing={false} frozenT={getAnimation(s.animation).peak ?? 0.5} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div className="small">{s.equipment.map(e => EQUIPMENT_LABELS[e]).join(' · ')}</div>
                </div>
                <IconChevronRight size={20} />
              </Link>
            ))}
          </Card>
        </section>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Reset calibration?">
        <p className="body" style={{ marginBottom: 16 }}>This wipes the progression history for {ex.shortName}. Next session you'll pick the starting weight again. PRs are kept.</p>
        <div className="stack">
          <Button variant="danger" block size="lg" onClick={doReset}>Reset {ex.shortName}</Button>
          <Button variant="ghost" block onClick={() => setConfirm(false)}>Keep my numbers</Button>
        </div>
      </Sheet>
    </div>
  )
}

/** Dev-only contact sheet: /exercises/<id>?sheet=1&ids=a,b,c */
function DevSheet({ ex }: { ex: ExerciseDef }) {
  const ids = (new URLSearchParams(window.location.search).get('ids') ?? ex.id).split(',')
  const ts = [0, 0.2, 0.35, 0.47]
  return (
    <div className="page" style={{ padding: 6 }}>
      {ids.map(eid => {
        const e = getExercise(eid)
        const def = getAnimation(e.animation)
        const hl: Partial<Record<MuscleGroup, number>> = {}
        for (const p of e.primary) hl[p] = 1
        for (const s of e.secondary) hl[s] = Math.max(hl[s] ?? 0, 0.45)
        return (
          <div key={eid} style={{ marginBottom: 6 }}>
            <div className="tiny" style={{ marginBottom: 2 }}>{e.name} · {def.view} · {e.animation}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {ts.map(t => (
                <div key={t} style={{ background: 'var(--surface-2)', borderRadius: 8 }}>
                  <Figure pose={poseAt(def, t)} view={def.view} highlight={hl} glow={glowAt(def, t)} equipment={def.equipment} anchor={def.anchor} anchorY={def.anchorY} shadow style={{ width: '100%' }} />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
