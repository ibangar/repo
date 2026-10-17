import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ExerciseDef, LoadMode, SessionExercise, SetLog, Settings, WorkoutSession } from '../../db/types'
import { EQUIPMENT_LABELS, swapCandidates } from '../../data/exercises'
import { Button, Card, Pill, Sheet } from '../ui'
import { IconChevronRight, IconInfo, IconRotate, IconSkip, IconSwap } from '../ui/Icons'
import { ExerciseAnimation } from '../anatomy/ExerciseAnimation'
import { relativeDay } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { describeMode, exerciseFor, fmtModeLoad, isPowerMode, orderedSets, setKey, type CardGroup } from './helpers'
import { SetRow } from './SetRow'

export interface ExerciseCardProps {
  session: WorkoutSession
  group: CardGroup
  settings: Settings
  today: string
  currentKey: string | null
  onSetChange: (exIdx: number, setIdx: number, patch: Partial<SetLog>) => void
  onToggleSet: (exIdx: number, setIdx: number) => void
  onSwap: (exIdx: number, newExerciseId: string) => void
  onSkip: (exIdx: number, skipped: boolean) => void
  onModeChange: (exIdx: number, mode: LoadMode) => void
}

function noteTone(ex: SessionExercise): string {
  if (ex.calibration) return 'ex-note'
  if (ex.prescriptionNote?.startsWith('Deload')) return 'ex-note ex-note--upper'
  return 'ex-note ex-note--gold'
}

function lastTimeLine(ex: SessionExercise, units: Settings['units'], today: string): string | null {
  if (!ex.lastTime || !ex.lastTime.sets.length) return null
  const parts = ex.lastTime.sets.map(s => `${fmtModeLoad(s.load, ex.loadMode, units, false)} × ${s.reps ?? '—'}${isPowerMode(ex.loadMode) ? '' : ` @${s.rir}`}`)
  return `Last: ${parts.join(', ')} · ${relativeDay(ex.lastTime.date, today).toLowerCase()}`
}

/** Header for one exercise: thumbnail, name, pills, menu. */
function ExerciseHead({ ex, def, exIdx, playing, small, letter, onMenu, onMode }: {
  ex: SessionExercise; def: ExerciseDef; exIdx: number; playing: boolean; small?: boolean; letter?: string
  onMenu: (exIdx: number) => void; onMode: (exIdx: number) => void
}) {
  const nav = useNavigate()
  const canSwitchMode = def.loadModes.length > 1
  return (
    <div className="ex-head">
      <div className={`ex-thumb ${small ? 'ex-thumb--sm' : ''}`}>
        <ExerciseAnimation exerciseId={ex.exerciseId} size={small ? 44 : 64} playing={playing} highlight={playing} />
      </div>
      <div className="grow">
        <button className="ex-title" onClick={() => { haptic.tap(); nav(`/exercises/${ex.exerciseId}`) }}>
          {letter && <span className="ex-ss-letter" style={{ marginRight: 6 }}>{letter}</span>}
          <span>{def.name}</span>
          <IconChevronRight size={16} style={{ color: 'var(--muted)' }} />
        </button>
        <div className="ex-pills">
          <Pill>{ex.repMin === ex.repMax ? `${ex.repMin} reps` : `${ex.repMin}–${ex.repMax} reps`}</Pill>
          <Pill>{ex.sets.length} sets</Pill>
          {canSwitchMode ? (
            <button onClick={() => { haptic.tap(); onMode(exIdx) }} aria-label="Change load mode">
              <Pill tone="upper" className="pill--tap">{describeMode(ex.loadMode).label} <IconRotate size={12} /></Pill>
            </button>
          ) : (ex.loadMode === 'height' || ex.loadMode === 'bell') ? <Pill tone="gold">{describeMode(ex.loadMode).label}</Pill> : null}
          {ex.calibration && <Pill tone="accent">calibrate</Pill>}
          {ex.swappedFrom && <Pill tone="upper">swapped</Pill>}
        </div>
      </div>
      <button className="wk-dots" onClick={() => { haptic.tap(); onMenu(exIdx) }} aria-label="Exercise options">…</button>
    </div>
  )
}

export function ExerciseCard(p: ExerciseCardProps) {
  const { session, group, settings, today, currentKey } = p
  const nav = useNavigate()
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [swapFor, setSwapFor] = useState<number | null>(null)
  const [modeFor, setModeFor] = useState<number | null>(null)

  const exs = group.exIdxs.map(i => ({ exIdx: i, ex: session.exercises[i], def: exerciseFor(session.exercises[i]) }))
  const allSkipped = exs.every(e => e.ex.skipped)
  const isCurrent = (exIdx: number) => currentKey != null && currentKey.startsWith(`${exIdx}:`)
  const rows = orderedSets(session, group)

  const letterOf = (exIdx: number) => String.fromCharCode(65 + group.exIdxs.indexOf(exIdx))
  const labelFor = (exIdx: number, set: SetLog, setIdx: number) => {
    const base = set.side ?? String(setIdx + 1)
    return group.superset ? `${letterOf(exIdx)}${set.side ? `${Math.floor(setIdx / 2) + 1}${set.side}` : setIdx + 1}` : base
  }
  const lastFor = (ex: SessionExercise, setIdx: number) => ex.lastTime?.sets[setIdx] ?? ex.lastTime?.sets[0]

  if (allSkipped) {
    return (
      <Card className="ex-card ex-card--skipped">
        <div className="row-between">
          <div className="grow">
            <div className="small" style={{ fontWeight: 700 }}>Skipped</div>
            <div className="subtitle">{exs.map(e => e.def.name).join(' + ')}</div>
          </div>
          <Button size="sm" variant="subtle" onClick={() => exs.forEach(e => p.onSkip(e.exIdx, false))}>Undo</Button>
        </div>
      </Card>
    )
  }

  const menuEx = menuFor != null ? session.exercises[menuFor] : null
  const swapEx = swapFor != null ? session.exercises[swapFor] : null
  const modeEx = modeFor != null ? session.exercises[modeFor] : null
  const candidates = swapEx ? swapCandidates(swapEx.exerciseId, new Set(settings.equipment)) : []

  return (
    <Card className="ex-card" glow={exs.some(e => isCurrent(e.exIdx))} upper={exs.every(e => e.def.goalTag === 'upper')}>
      {group.superset ? (
        <div className="ex-ss-head">
          <div className="row-between">
            <div className="row" style={{ gap: 8 }}>
              <Pill tone="upper">Superset</Pill>
              <span className="small">Alternate A and B · rest after B</span>
            </div>
          </div>
          {exs.filter(e => !e.ex.skipped).map(e => (
            <div key={e.exIdx}>
              <ExerciseHead ex={e.ex} def={e.def} exIdx={e.exIdx} playing={isCurrent(e.exIdx)} small letter={letterOf(e.exIdx)} onMenu={setMenuFor} onMode={setModeFor} />
              {e.ex.prescriptionNote && <div className={noteTone(e.ex)}>{e.ex.prescriptionNote}</div>}
              {lastTimeLine(e.ex, settings.units, today) && <div className="ex-last num">{lastTimeLine(e.ex, settings.units, today)}</div>}
            </div>
          ))}
        </div>
      ) : (
        <>
          <ExerciseHead ex={exs[0].ex} def={exs[0].def} exIdx={exs[0].exIdx} playing={isCurrent(exs[0].exIdx)} onMenu={setMenuFor} onMode={setModeFor} />
          {exs[0].ex.prescriptionNote && <div className={noteTone(exs[0].ex)}>{exs[0].ex.prescriptionNote}</div>}
          {lastTimeLine(exs[0].ex, settings.units, today) && <div className="ex-last num">{lastTimeLine(exs[0].ex, settings.units, today)}</div>}
        </>
      )}

      <div className="ex-sets">
        {rows.map(r => {
          const ex = session.exercises[r.exIdx]
          const set = ex.sets[r.setIdx]
          const key = setKey(r.exIdx, r.setIdx)
          return (
            <SetRow key={key} set={set} ex={ex} def={exerciseFor(ex)} units={settings.units} increments={settings.increments}
              label={labelFor(r.exIdx, set, r.setIdx)} current={currentKey === key} last={lastFor(ex, r.setIdx)}
              onChange={patch => p.onSetChange(r.exIdx, r.setIdx, patch)} onToggle={() => p.onToggleSet(r.exIdx, r.setIdx)} />
          )
        })}
      </div>

      {/* "…" menu */}
      <Sheet open={menuEx != null} onClose={() => setMenuFor(null)} title={menuEx ? exerciseFor(menuEx).name : ''}>
        {menuEx && menuFor != null && (
          <div className="stack" style={{ gap: 0 }}>
            <button className="opt" onClick={() => { setMenuFor(null); setSwapFor(menuFor) }}>
              <span className="opt__icon"><IconSwap size={20} /></span>
              <span className="grow"><div style={{ fontWeight: 700 }}>Swap exercise</div><div className="small">Same movement pattern, different tool</div></span>
            </button>
            <button className="opt" onClick={() => { haptic.tap(); p.onSkip(menuFor, true); setMenuFor(null) }}>
              <span className="opt__icon"><IconSkip size={20} /></span>
              <span className="grow"><div style={{ fontWeight: 700 }}>Skip today</div><div className="small">Progression untouched – you can undo</div></span>
            </button>
            <button className="opt" onClick={() => { setMenuFor(null); nav(`/exercises/${menuEx.exerciseId}`) }}>
              <span className="opt__icon"><IconInfo size={20} /></span>
              <span className="grow"><div style={{ fontWeight: 700 }}>View details</div><div className="small">Cues, mistakes, animation</div></span>
            </button>
          </div>
        )}
      </Sheet>

      {/* Swap sheet */}
      <Sheet open={swapEx != null} onClose={() => setSwapFor(null)} title="Swap for…">
        {swapEx && swapFor != null && (
          candidates.length === 0 ? <p className="body">No alternatives with your equipment for this movement.</p> : (
            <div className="stack" style={{ gap: 0 }}>
              {candidates.map(c => (
                <button key={c.id} className="opt" onClick={() => { haptic.success(); p.onSwap(swapFor, c.id); setSwapFor(null) }}>
                  <span className="ex-thumb ex-thumb--sm"><ExerciseAnimation exerciseId={c.id} size={44} /></span>
                  <span className="grow">
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div className="small">{c.equipment.map(e => EQUIPMENT_LABELS[e] ?? e).join(' · ')}</div>
                  </span>
                  <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
                </button>
              ))}
            </div>
          )
        )}
      </Sheet>

      {/* Load-mode sheet */}
      <Sheet open={modeEx != null} onClose={() => setModeFor(null)} title="How are you loading it?">
        {modeEx && modeFor != null && (
          <div className="stack" style={{ gap: 0 }}>
            {exerciseFor(modeEx).loadModes.map(m => {
              const d = describeMode(m)
              const on = modeEx.loadMode === m
              return (
                <button key={m} className="opt" onClick={() => { haptic.tap(); if (!on) p.onModeChange(modeFor, m); setModeFor(null) }}>
                  <span className="grow"><div style={{ fontWeight: 700 }}>{d.label}</div><div className="small">{d.hint}</div></span>
                  {on && <Pill tone="accent">current</Pill>}
                </button>
              )
            })}
            <p className="tiny mt-8">Switching clears the loads on today's sets so you can re-enter them.</p>
          </div>
        )}
      </Sheet>
    </Card>
  )
}
