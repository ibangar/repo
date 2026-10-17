import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { getActiveSession, getStates, lastCompletedSessionPerExercise, prescribeCtx, saveSession, startSession, updateSettings } from '../db/repo'
import type { ExerciseState, Program, ProgramDay, Settings, WorkoutSession } from '../db/types'
import { getExercise } from '../data/exercises'
import { buildSession, deloadSets } from '../engine/prescription'
import { addDays, daysBetween, parseIso, scheduleFor, shiftForward, upcoming, type ScheduleInfo } from '../engine/schedule'
import { useProgram, useSettings } from '../hooks/useSettings'
import { useSchedule, useTodayDate } from '../hooks/useToday'
import { Button, Card, Pill, Sheet } from '../components/ui'
import { IconCamera, IconCheck, IconChevronRight, IconFlame, IconPlay, IconScale, IconX } from '../components/ui/Icons'
import { NutritionChecklist } from '../components/NutritionChecklist'
import { fmtDate, fmtMinutes, relativeDay } from '../lib/format'
import { haptic } from '../lib/haptics'
import { primeAudio } from '../lib/sound'
import { FOCUS_EMOJI, FOCUS_SHORT, estDurationSec, fmtModeLoad, focusTone, isGluteFocus, setsProgress } from '../components/workout/helpers'
import '../components/workout/workout.css'

// ── helpers ──────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours()
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const n = name.trim()
  return n ? `${g}, ${n}` : 'Hey'
}

/** Consecutive scheduled training days completed, counting back from today (rest days skipped). */
function streakCount(today: string, settings: Settings, program: Program, completed: Set<string>): number {
  let n = 0
  let d = today
  for (let i = 0; i < 400; i++) {
    if (daysBetween(settings.programStartDate, d) < 0) break
    const info = scheduleFor(d, settings, program)
    if (info.day.focus !== 'rest') {
      if (completed.has(d)) n++
      else if (d !== today) break
    }
    d = addDays(d, -1)
  }
  return n
}

// ── sub-components ───────────────────────────────────────────────────────────

function WeekStrip({ days, today, completed, inProgram }: { days: (ScheduleInfo & { date: string })[]; today: string; completed: Set<string>; inProgram: (date: string) => boolean }) {
  return (
    <div className="wk-week stagger">
      {days.map(d => {
        const isToday = d.date === today
        const done = completed.has(d.date)
        const before = !inProgram(d.date)
        const rest = d.day.focus === 'rest'
        const missed = !before && !rest && !done && d.date < today
        return (
          <div key={d.date} className={`wk-day ${isToday ? 'wk-day--today' : ''} ${rest || before ? 'wk-day--rest' : ''}`} aria-current={isToday ? 'date' : undefined}>
            <span className="wk-day__wd">{fmtDate(d.date, { weekday: 'short' }).slice(0, 2).toUpperCase()}</span>
            <span className={`wk-day__dot ${done ? 'wk-day__dot--done' : missed ? 'wk-day__dot--missed' : ''}`}>{done && <IconCheck size={12} />}</span>
            <span className="wk-day__name">{before ? '–' : FOCUS_SHORT[d.day.focus]}</span>
          </div>
        )
      })}
    </div>
  )
}

function Reminder({ icon, title, body, onOpen, onDismiss }: { icon: React.ReactNode; title: string; body: string; onOpen: () => void; onDismiss: () => void }) {
  return (
    <Card className="wk-remind" onClick={onOpen}>
      <span className="wk-remind__icon">{icon}</span>
      <span className="grow">
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        <div className="small">{body}</div>
      </span>
      <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
      <button className="wk-remind__x" aria-label="Dismiss for today" onClick={e => { e.stopPropagation(); haptic.tap(); onDismiss() }}><IconX size={18} /></button>
    </Card>
  )
}

// ── screen ───────────────────────────────────────────────────────────────────

export default function Today() {
  const nav = useNavigate()
  const settings = useSettings()
  const program = useProgram()
  const today = useTodayDate()
  const sched = useSchedule()
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)

  const dow = (parseIso(today).getDay() + 6) % 7 // 0 = Monday
  const monday = addDays(today, -dow)
  const sunday = addDays(monday, 6)

  const active = useLiveQuery(() => db.sessions.where('status').equals('active').first(), [])
  const completedSessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), [])
  const statesArr = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const weighCount = useLiveQuery(() => db.bodyWeights.where('date').between(monday, sunday, true, true).count(), [monday, sunday])
  const photosToday = useLiveQuery(() => db.photos.where('date').equals(today).count(), [today])

  const completed = useMemo(() => new Set((completedSessions ?? []).map(s => s.date)), [completedSessions])
  const states = useMemo(() => new Map<string, ExerciseState>((statesArr ?? []).map(s => [s.exerciseId, s])), [statesArr])

  if (!settings || !program || !sched || completedSessions === undefined) return <div className="page" />

  const todayDay = sched.day
  const isRest = todayDay.focus === 'rest'
  // With a session in progress the hero describes THAT day, not necessarily today's.
  const day = (active ? program.days[active.dayIndex] : undefined) ?? todayDay
  const dayNo = active ? active.dayIndex + 1 : sched.dayIndex + 1
  const tone = focusTone(day.focus)
  const inProgram = (date: string) => daysBetween(settings.programStartDate, date) - settings.scheduleOffset >= 0
  const week = upcoming(monday, settings, program, 7)
  const streak = streakCount(today, settings, program, completed)
  const todayDone = completed.has(today)
  const dismissed = settings.dismissedPrompts ?? {}

  // Missed-day detection
  const yesterday = addDays(today, -1)
  const yInfo = scheduleFor(yesterday, settings, program)
  const missed = daysBetween(settings.programStartDate, yesterday) >= 0 && yInfo.day.focus !== 'rest' && !completed.has(yesterday)
    && yInfo.dayIndex !== sched.dayIndex && dismissed[`missed-${yesterday}`] == null && active?.date !== yesterday

  // Reminders
  const weighDue = parseIso(today).getDay() === settings.weighInDay && weighCount === 0 && dismissed.weighin !== today
  const selfieDue = settings.selfieReminder && photosToday === 0 && dismissed.selfie !== today

  const dismiss = (key: string) => void updateSettings({ dismissedPrompts: { ...dismissed, [key]: today } })

  const start = async () => {
    if (busy) return
    setBusy(true); primeAudio(); haptic.success()
    try {
      if (!active) await startSession(today, settings, program)
      nav('/workout')
    } finally { setBusy(false) }
  }

  const startDay = async (dayIndex: number) => {
    if (busy) return
    setBusy(true); primeAudio(); haptic.success()
    try {
      // The live query may still be loading – never create a second active session.
      if (await getActiveSession()) { setPickOpen(false); nav('/workout'); return }
      const d = program.days[dayIndex]
      const st = await getStates()
      const last = await lastCompletedSessionPerExercise(d.exercises.map(e => e.exerciseId))
      const s = buildSession({ day: d, dayIndex, weekNumber: sched.weekNumber, isDeload: sched.isDeload, date: today, states: st, lastSessions: last, ctx: prescribeCtx(settings) })
      await saveSession(s)
      setPickOpen(false)
      nav('/workout')
    } finally { setBusy(false) }
  }

  const shift = async () => {
    haptic.success()
    await updateSettings({ ...shiftForward(settings), dismissedPrompts: { ...dismissed, [`missed-${yesterday}`]: today } })
    setMenuOpen(false)
  }

  const discardActive = async () => {
    if (!active) return
    const a: WorkoutSession = { ...active, status: 'abandoned', completedAt: Date.now() }
    await saveSession(a)
    setMenuOpen(false)
  }

  const progress = setsProgress(active)
  const trainingDays = program.days.map((d, i) => ({ d, i })).filter(x => x.d.focus !== 'rest')

  return (
    <div className="page stack-lg">
      {/* Greeting */}
      <header className="stack" style={{ gap: 6 }}>
        <div className="row-between">
          <div className="eyebrow">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          {streak > 0 && <span className="wk-streak pop"><IconFlame size={14} /> {streak} day streak</span>}
        </div>
        <h1 className="title-lg">{greeting(settings.name)}</h1>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <Pill>Week {sched.weekNumber}</Pill>
          {sched.isCalibrationWeek && <Pill tone="accent">Calibration week</Pill>}
          {sched.isDeload && <Pill tone="upper">Deload week</Pill>}
          {!sched.isDeload && !sched.isCalibrationWeek && sched.weeksToDeload <= 1 && <Pill>Deload next week</Pill>}
        </div>
      </header>

      {(sched.isCalibrationWeek || sched.isDeload) && (
        <Card className="rise" style={{ padding: '12px 14px' }} upper={sched.isDeload} glow>
          <div className="small" style={{ color: 'var(--text-2)' }}>
            {sched.isDeload
              ? 'Deload week: fewer sets, 10% lighter. Move well and recover – you grow this week.'
              : 'Calibration week: pick weights that leave 2 reps in the tank. The app takes it from there.'}
          </div>
        </Card>
      )}

      {/* Missed day */}
      {missed && (
        <Card className="rise" glow>
          <div className="eyebrow accent">Missed session</div>
          <div className="subtitle mt-8">You missed {yInfo.day.name} yesterday</div>
          <p className="body mt-8">Shift the whole schedule by a day and do it today, or let it go and stay on track.</p>
          <div className="grid-2 mt-16">
            <Button variant="primary" onClick={() => void shift()}>Shift → today</Button>
            <Button variant="subtle" onClick={() => { haptic.tap(); dismiss(`missed-${yesterday}`) }}>Skip it</Button>
          </div>
        </Card>
      )}

      {/* Hero */}
      {isRest && !active ? (
        <Card className={`wk-hero wk-hero--rest rise`}>
          <div className="wk-hero__grad" />
          <div className="row-between">
            <div className="eyebrow" style={{ color: 'var(--good)' }}>Day {sched.dayIndex + 1} · Rest</div>
            <button className="wk-dots" onClick={() => { haptic.tap(); setMenuOpen(true) }} aria-label="More options">…</button>
          </div>
          <h2 className="title-lg mt-8">Recovery day 🌿</h2>
          <p className="body mt-8">Walk, stretch, hit your protein. Muscle is built between sessions – today counts.</p>
          <Button variant="ghost" block className="mt-16" onClick={() => { haptic.tap(); setPickOpen(true) }}>Train anyway → pick a day</Button>
        </Card>
      ) : (
        <Card className={`wk-hero wk-hero--${tone} rise`} glow upper={tone === 'upper'}>
          <div className="wk-hero__grad" />
          <div className="row-between">
            <div className="eyebrow" style={{ color: tone === 'upper' ? 'var(--accent-2)' : tone === 'power' ? 'var(--gold)' : 'var(--accent)' }}>
              Day {dayNo} · {FOCUS_SHORT[day.focus]} {FOCUS_EMOJI[day.focus]}
            </div>
            <button className="wk-dots" onClick={() => { haptic.tap(); setMenuOpen(true) }} aria-label="More options">…</button>
          </div>
          <h2 className="title-lg mt-8">{active ? active.dayName : day.name}</h2>
          <p className="body mt-8">{day.subtitle}</p>
          <div className="row mt-8" style={{ gap: 6, flexWrap: 'wrap' }}>
            {isGluteFocus(day.focus) && <Pill tone="accent">🍑 Glute day</Pill>}
            <Pill>{day.exercises.length} exercises</Pill>
            <Pill>≈ {fmtMinutes(estDurationSec(day, sched.isDeload))}</Pill>
            {todayDone && <Pill tone="good"><IconCheck size={12} /> done today</Pill>}
          </div>

          {active && (active.dayId !== todayDay.id || active.date !== today) && (
            <p className="small mt-8">In progress since {relativeDay(active.date, today).toLowerCase()}{active.dayId !== todayDay.id ? ` · today's plan is ${todayDay.name}` : ''}.</p>
          )}

          <div className="wk-hero__list">
            {(active ? active.exercises : null)?.map((ex, i) => {
              const def = getExercise(ex.exerciseId)
              const done = ex.sets.filter(s => s.done).length
              return (
                <div key={ex.programExerciseId} className="wk-hero__ex">
                  <span className="wk-hero__idx">{i + 1}</span>
                  <span className="grow">
                    <div className="wk-hero__name">{def.name}</div>
                    <div className="wk-hero__meta">{ex.skipped ? 'skipped' : `${done}/${ex.sets.length} sets · ${ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`} reps`}</div>
                  </span>
                  <span className="wk-hero__load num">{ex.calibration && ex.sets[0]?.load == null ? <Pill tone="accent">calibrate</Pill> : fmtModeLoad(ex.sets[0]?.load ?? ex.sets[0]?.prescribedLoad, ex.loadMode, settings.units)}</span>
                </div>
              )
            }) ?? day.exercises.map((pe, i) => {
              const def = getExercise(pe.exerciseId)
              const st = states.get(pe.exerciseId)
              const sets = sched.isDeload ? deloadSets(pe.sets) : pe.sets
              const calibrated = st?.calibrated && (st.currentLoad != null || st.loadMode === 'bodyweight')
              return (
                <div key={pe.id} className="wk-hero__ex">
                  <span className="wk-hero__idx">{i + 1}</span>
                  <span className="grow">
                    <div className="wk-hero__name">{def.name}</div>
                    <div className="wk-hero__meta">{sets} × {pe.repMin === pe.repMax ? pe.repMin : `${pe.repMin}–${pe.repMax}`}{def.unilateral ? ' each side' : ''}{pe.supersetGroup ? ' · superset' : ''}</div>
                  </span>
                  <span className="wk-hero__load num">{calibrated ? fmtModeLoad(st!.currentLoad, st!.loadMode, settings.units) : <Pill tone="accent">calibrate</Pill>}</span>
                </div>
              )
            })}
          </div>

          <div className="mt-16">
            <Button variant={tone === 'upper' ? 'upper' : 'primary'} size="lg" block pulse disabled={busy} onClick={() => void start()}>
              <IconPlay size={20} />
              {active ? `Resume workout · ${progress.done}/${progress.total} sets` : todayDone ? 'Train again' : 'Start workout'}
            </Button>
            {active && progress.total > 0 && (
              <div className="progress mt-8"><div className={`progress__bar ${tone === 'upper' ? 'progress__bar--upper' : ''}`} style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
            )}
          </div>
        </Card>
      )}

      {/* Week strip */}
      <section className="stack" style={{ gap: 8 }}>
        <div className="row-between">
          <div className="eyebrow">This week</div>
          <span className="tiny">{week.filter(d => completed.has(d.date)).length}/{week.filter(d => inProgram(d.date) && d.day.focus !== 'rest').length} sessions</span>
        </div>
        <WeekStrip days={week} today={today} completed={completed} inProgram={inProgram} />
      </section>

      {/* Reminders */}
      <section className="stack">
        {weighDue && (
          <Reminder icon={<IconScale size={20} />} title="Weekly weigh-in due" body="Same time, same conditions. One number a week is all the trend needs."
            onOpen={() => { haptic.tap(); nav('/progress/body') }} onDismiss={() => dismiss('weighin')} />
        )}
        {selfieDue && (
          <Reminder icon={<IconCamera size={20} />} title="Daily progress selfie" body="Front, side, back – 20 seconds. Future you will thank you."
            onOpen={() => { haptic.tap(); nav('/photos/capture') }} onDismiss={() => dismiss('selfie')} />
        )}
        <NutritionChecklist date={today} compact />
      </section>

      {/* "…" menu */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Schedule">
        <div className="stack" style={{ gap: 0 }}>
          <button className="opt" onClick={() => void shift()}>
            <span className="grow"><div style={{ fontWeight: 700 }}>Shift schedule forward a day</div><div className="small">Today becomes {yInfo.day.name}; everything moves one day later.</div></span>
            <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
          </button>
          <button className="opt" onClick={() => { setMenuOpen(false); setPickOpen(true) }}>
            <span className="grow"><div style={{ fontWeight: 700 }}>Train a different day</div><div className="small">Pick any of the 5 training days for today only.</div></span>
            <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
          </button>
          {active && (
            <button className="opt opt--danger" onClick={() => void discardActive()}>
              <span className="grow"><div style={{ fontWeight: 700 }}>Discard active workout</div><div className="small">{active.dayName} · {progress.done}/{progress.total} sets logged</div></span>
            </button>
          )}
        </div>
      </Sheet>

      {/* Pick-a-day sheet */}
      <Sheet open={pickOpen} onClose={() => setPickOpen(false)} title="Which day?">
        {active ? (
          <div className="stack">
            <p className="body">You already have a workout in progress. Resume it or discard it first.</p>
            <Button variant="primary" block onClick={() => nav('/workout')}>Resume {active.dayName}</Button>
          </div>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {trainingDays.map(({ d, i }: { d: ProgramDay; i: number }) => (
              <button key={d.id} className="opt" disabled={busy} onClick={() => void startDay(i)}>
                <span className="opt__icon">{FOCUS_EMOJI[d.focus]}</span>
                <span className="grow">
                  <div style={{ fontWeight: 700 }}>Day {i + 1} · {d.name}</div>
                  <div className="small">{d.subtitle} · {d.exercises.length} exercises</div>
                </span>
                <IconChevronRight size={18} style={{ color: 'var(--muted)' }} />
              </button>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  )
}
