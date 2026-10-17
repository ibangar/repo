import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { completeSession, getActiveSession, prescribeCtx, saveSession } from '../../db/repo'
import type { LoadMode, ProgramExercise, SetLog, WorkoutSession } from '../../db/types'
import { rampUps, swapExercise } from '../../engine/prescription'
import { useProgram, useSettings } from '../../hooks/useSettings'
import { useTodayDate } from '../../hooks/useToday'
import { Button, Sheet } from '../../components/ui'
import { IconX } from '../../components/ui/Icons'
import { haptic } from '../../lib/haptics'
import { primeAudio } from '../../lib/sound'
import { ExerciseCard } from '../../components/workout/ExerciseCard'
import { WarmupSection } from '../../components/workout/WarmupSection'
import { RestBar } from '../../components/workout/RestBar'
import { useRestTimer } from '../../components/workout/useRestTimer'
import {
  countIncomplete, exerciseFor, firstCompoundIdx, groupExercises, mmss, modeSwitchNote, nextIncomplete, restsAfter, setKey, setsProgress,
} from '../../components/workout/helpers'
import '../../components/workout/workout.css'

function readWarmupChecks(id: string): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(`sculpt.wu.${id}`) ?? '[]') as string[]) } catch { return new Set() }
}

export default function Workout() {
  const nav = useNavigate()
  const settings = useSettings()
  const program = useProgram()
  const today = useTodayDate()
  const states = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const stateMap = useMemo(() => new Map((states ?? []).map(s => [s.exerciseId, s])), [states])

  const [session, setSession] = useState<WorkoutSession | null>(null)
  const sessionRef = useRef<WorkoutSession | null>(null)
  const dirtyRef = useRef(false)
  const saveTimer = useRef<number | undefined>(undefined)
  const [now, setNow] = useState(Date.now())
  const [exitOpen, setExitOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [wuChecked, setWuChecked] = useState<Set<string>>(new Set())
  const [wuOpen, setWuOpen] = useState<boolean | null>(null)
  const [scrollTick, setScrollTick] = useState(0)
  const rest = useRestTimer(session ? `sculpt.rest.${session.id}` : undefined)

  // ── Load the active session once; bounce home if there is none ──
  useEffect(() => {
    let alive = true
    getActiveSession().then(s => {
      if (!alive) return
      if (!s) { nav('/', { replace: true }); return }
      sessionRef.current = s
      setSession(s)
      setWuChecked(readWarmupChecks(s.id))
    })
    return () => { alive = false }
  }, [nav])

  // ── Persistence: debounce 300 ms, flush when the page hides / unmounts ──
  const flush = useCallback(() => {
    if (dirtyRef.current && sessionRef.current && sessionRef.current.status === 'active') {
      dirtyRef.current = false
      void saveSession(sessionRef.current)
    }
  }, [])
  const update = useCallback((fn: (s: WorkoutSession) => WorkoutSession) => {
    const cur = sessionRef.current
    if (!cur) return
    const next = fn(cur)
    sessionRef.current = next
    dirtyRef.current = true
    setSession(next)
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(flush, 300)
  }, [flush])
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      window.clearTimeout(saveTimer.current)
      flush()
    }
  }, [flush])

  // ── Elapsed clock ──
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])

  // ── Derived ──
  const groups = useMemo(() => (session ? groupExercises(session) : []), [session])
  const next = useMemo(() => (session ? nextIncomplete(session, groups) : null), [session, groups])
  const currentKey = next ? setKey(next.exIdx, next.setIdx) : null
  const progress = setsProgress(session)
  const anyDone = progress.done > 0
  const warmupExIdx = session ? firstCompoundIdx(session) : -1
  const rampEx = session && warmupExIdx >= 0 ? { exIdx: warmupExIdx, ex: session.exercises[warmupExIdx] } : null
  const warmupExpanded = wuOpen ?? !anyDone

  // Auto-scroll to the next set after a completion.
  useEffect(() => {
    if (!scrollTick) return
    const t = setTimeout(() => document.querySelector('[data-current]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => clearTimeout(t)
  }, [scrollTick])

  // ── Actions ──
  const toggleWarmupItem = (id: string) => {
    if (!session) return
    setWuChecked(prev => {
      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id)
      try { sessionStorage.setItem(`sculpt.wu.${session.id}`, JSON.stringify([...n])) } catch { /* ignore */ }
      return n
    })
  }
  const toggleWarmupSet = (exIdx: number, i: number) => update(s => {
    const ex = s.exercises[exIdx]
    const warmups = ex.warmups.map((w, j) => (j === i ? { ...w, done: !w.done, completedAt: !w.done ? Date.now() : undefined } : w))
    const exercises = [...s.exercises]; exercises[exIdx] = { ...ex, warmups }
    return { ...s, exercises }
  })

  const changeSet = (exIdx: number, setIdx: number, patch: Partial<SetLog>) => update(s => {
    const ex = s.exercises[exIdx]
    const prev = ex.sets[setIdx]
    let sets = ex.sets.map((x, j) => (j === setIdx ? { ...x, ...patch } : x))
    let warmups = ex.warmups
    // Calibration: entering a load on set 1 prefills the other (untouched) sets and computes ramp-ups for the first compound.
    if (ex.calibration && setIdx === 0 && patch.load !== undefined && patch.load !== prev.load) {
      sets = sets.map((x, j) => (j === 0 || x.done || (x.load != null && x.load !== prev.load) ? x : { ...x, load: patch.load ?? null }))
      if (settings && exIdx === firstCompoundIdx(s) && ex.loadMode === 'weight' && !ex.warmups.some(w => w.done)) {
        warmups = patch.load != null && patch.load > 0 ? rampUps(patch.load, exerciseFor(ex), settings.increments, settings.units, 'weight') : []
      }
    }
    const exercises = [...s.exercises]; exercises[exIdx] = { ...ex, sets, warmups }
    return { ...s, exercises }
  })

  const toggleSet = (exIdx: number, setIdx: number) => {
    const cur = sessionRef.current
    if (!cur) return
    const ex = cur.exercises[exIdx]
    const set = ex.sets[setIdx]
    const nowDone = !set.done
    primeAudio()
    update(s => {
      const e = s.exercises[exIdx]
      const sets = e.sets.map((x, j) => j !== setIdx ? x : {
        ...x, done: nowDone, completedAt: nowDone ? Date.now() : undefined, isPR: nowDone ? x.isPR : undefined,
        reps: nowDone && (x.reps == null) ? x.prescribedReps : x.reps,
        load: nowDone && x.load == null && x.prescribedLoad != null ? x.prescribedLoad : x.load,
      })
      const exercises = [...s.exercises]; exercises[exIdx] = { ...e, sets }
      return { ...s, exercises }
    })
    if (nowDone) {
      haptic.success()
      const remainingAfter = countIncomplete(cur) - 1
      if (restsAfter(cur, exIdx, groups) && remainingAfter > 0) rest.start(ex.restSec)
      setScrollTick(t => t + 1)
      if (wuOpen == null && !anyDone) setWuOpen(false)
    } else {
      haptic.tap()
    }
  }

  const changeMode = (exIdx: number, mode: LoadMode) => update(s => {
    const ex = s.exercises[exIdx]
    const resetLoad = mode === 'bodyweight' ? 0 : null
    const exercises = [...s.exercises]
    exercises[exIdx] = {
      ...ex, loadMode: mode, calibration: true, prescriptionNote: modeSwitchNote(mode, ex.repMax), warmups: [],
      sets: ex.sets.map(x => ({ ...x, load: resetLoad, prescribedLoad: resetLoad })),
    }
    return { ...s, exercises }
  })

  const doSwap = (exIdx: number, newId: string) => update(s => {
    if (!settings) return s
    const ex = s.exercises[exIdx]
    const pe: ProgramExercise = program?.days[s.dayIndex]?.exercises.find(x => x.id === ex.programExerciseId) ?? {
      id: ex.programExerciseId, exerciseId: ex.exerciseId, sets: ex.sets.filter(x => !x.side || x.side === 'L').length,
      repMin: ex.repMin, repMax: ex.repMax, restSec: ex.restSec, supersetGroup: ex.supersetGroup,
    }
    return swapExercise(s, ex.programExerciseId, newId, stateMap.get(newId), { ...prescribeCtx(settings), isDeload: s.isDeload }, pe)
  })

  const setSkipped = (exIdx: number, skipped: boolean) => update(s => {
    const exercises = [...s.exercises]; exercises[exIdx] = { ...s.exercises[exIdx], skipped }
    return { ...s, exercises }
  })

  const discard = async () => {
    const cur = sessionRef.current
    if (!cur) return
    dirtyRef.current = false
    const abandoned: WorkoutSession = { ...cur, status: 'abandoned', completedAt: Date.now() }
    sessionRef.current = abandoned
    await saveSession(abandoned)
    try { localStorage.removeItem(`sculpt.rest.${cur.id}`); sessionStorage.removeItem(`sculpt.wu.${cur.id}`) } catch { /* ignore */ }
    haptic.warn()
    nav('/', { replace: true })
  }

  const finish = async () => {
    const cur = sessionRef.current
    if (!cur || !settings || finishing) return
    setFinishing(true)
    setFinishOpen(false)
    window.clearTimeout(saveTimer.current)
    dirtyRef.current = false
    const res = await completeSession(cur, settings)
    sessionRef.current = res.session
    rest.skip()
    try { localStorage.removeItem(`sculpt.rest.${cur.id}`); sessionStorage.removeItem(`sculpt.wu.${cur.id}`) } catch { /* ignore */ }
    haptic.done()
    nav(`/workout/summary/${res.session.id}`, { replace: true, state: { notes: res.notes } })
  }

  if (!settings || !session) return <div className="page page--nonav" />

  const elapsed = Math.max(0, Math.floor((now - session.startedAt) / 1000))
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0
  const nextEx = next ? exerciseFor(session.exercises[next.exIdx]) : null
  const nextSet = next ? session.exercises[next.exIdx].sets[next.setIdx] : null
  const nextLabel = nextEx && nextSet ? `${nextEx.shortName} · ${nextSet.side ? `${nextSet.side} ` : ''}set ${nextSet.side ? Math.floor(next!.setIdx / 2) + 1 : next!.setIdx + 1}` : null
  const unfinished = countIncomplete(session)
  const upperDay = session.exercises.every(e => exerciseFor(e).goalTag === 'upper')

  return (
    <div className="page page--nonav" style={{ paddingBottom: rest.active ? 140 : undefined }}>
      {/* Sticky header */}
      <header className="wk-head">
        <div className="row-between">
          <div className="grow">
            <div className="eyebrow">Week {session.weekNumber}{session.isDeload ? ' · Deload' : ''}</div>
            <div className="row" style={{ gap: 8 }}>
              <h1 className="title" style={{ fontSize: 20 }}>{session.dayName}</h1>
            </div>
          </div>
          <div className="num" style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-0.02em' }}>{mmss(elapsed)}</div>
          <button className="wk-head__x" onClick={() => { haptic.tap(); setExitOpen(true) }} aria-label="Exit workout"><IconX size={20} /></button>
        </div>
        <div className="row mt-8" style={{ gap: 10 }}>
          <div className="progress grow"><div className={`progress__bar ${upperDay ? 'progress__bar--upper' : ''}`} style={{ width: `${pct}%` }} /></div>
          <span className="small num" style={{ fontWeight: 800 }}>{progress.done}/{progress.total}</span>
        </div>
        <div className="wk-head__next">
          {nextLabel ? <><span className="tiny" style={{ fontWeight: 800, letterSpacing: '0.08em' }}>NEXT UP</span> <b>{nextLabel}</b></>
            : <span className="good" style={{ fontWeight: 700 }}>All sets done – finish strong 🎉</span>}
        </div>
      </header>

      <div className="stack">
        <WarmupSection checked={wuChecked} onToggleItem={toggleWarmupItem} ramp={rampEx} onToggleWarmup={toggleWarmupSet}
          units={settings.units} expanded={warmupExpanded} onToggleExpanded={() => setWuOpen(!warmupExpanded)} />

        {groups.map(g => (
          <ExerciseCard key={g.key} session={session} group={g} settings={settings} today={today} currentKey={currentKey}
            onSetChange={changeSet} onToggleSet={toggleSet} onSwap={doSwap} onSkip={setSkipped} onModeChange={changeMode} />
        ))}

        <div className="stack mt-16" style={{ gap: 10 }}>
          <Button variant={upperDay ? 'upper' : 'primary'} size="lg" block disabled={!anyDone || finishing} pulse={anyDone && unfinished === 0}
            onClick={() => { primeAudio(); if (unfinished > 0) setFinishOpen(true); else void finish() }}>
            {finishing ? 'Saving…' : 'Mark workout complete'}
          </Button>
          {!anyDone && <p className="tiny center">Complete at least one set to finish.</p>}
        </div>
      </div>

      <RestBar timer={rest} label={nextEx?.shortName} />

      {/* Exit sheet */}
      <Sheet open={exitOpen} onClose={() => setExitOpen(false)} title="Leave the workout?">
        <div className="stack">
          <p className="body">Your progress is saved – you can come back and resume from Today.</p>
          <Button variant="primary" size="lg" block onClick={() => { setExitOpen(false); nav('/') }}>Keep going (back to Today)</Button>
          <Button variant="subtle" block onClick={() => setExitOpen(false)}>Stay here</Button>
          <Button variant="danger" block onClick={() => void discard()}>Discard workout</Button>
        </div>
      </Sheet>

      {/* Finish-with-unfinished-sets sheet */}
      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={`${unfinished} set${unfinished === 1 ? '' : 's'} left`}>
        <div className="stack">
          <p className="body">Finish now? Only completed sets count toward progression; untouched exercises stay as they are.</p>
          <Button variant="primary" size="lg" block onClick={() => void finish()}>Finish anyway</Button>
          <Button variant="subtle" block onClick={() => setFinishOpen(false)}>Keep lifting</Button>
        </div>
      </Sheet>
    </div>
  )
}
