import { db } from './schema'
import { DEFAULT_SETTINGS } from './defaults'
import { DEFAULT_PROGRAM } from '../data/program'
import { getExercise } from '../data/exercises'
import type { ExerciseState, PR, Program, SessionExercise, Settings, WorkoutSession } from './types'
import { buildSession, type PrescribeContext } from '../engine/prescription'
import { applyProgression, evaluateSets } from '../engine/progression'
import { detectPRs } from '../engine/prs'
import { scheduleFor } from '../engine/schedule'
import { roundLoad } from '../engine/increments'
import type { Increments, Units } from './types'

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings')
  if (s) return { ...DEFAULT_SETTINGS, ...s, increments: { ...DEFAULT_SETTINGS.increments, ...s.increments } }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

/** Read-merge-write inside one transaction so overlapping patches never clobber each other. */
export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const cur = await getSettings()
    const next = { ...cur, ...patch, id: 'settings' as const }
    await db.settings.put(next)
    return next
  })
}

export async function getProgram(): Promise<Program> {
  const p = await db.program.get('program')
  if (p) return p
  await db.program.put({ id: 'program', ...DEFAULT_PROGRAM })
  return DEFAULT_PROGRAM
}

export async function saveProgram(p: Program) {
  await db.program.put({ id: 'program', ...p })
}

export async function getStates(): Promise<Map<string, ExerciseState>> {
  const all = await db.exerciseStates.toArray()
  return new Map(all.map(s => [s.exerciseId, s]))
}

export async function lastCompletedSessionPerExercise(exerciseIds: string[]): Promise<Map<string, WorkoutSession>> {
  const out = new Map<string, WorkoutSession>()
  const sessions = await db.sessions.where('status').equals('completed').reverse().sortBy('date')
  for (const id of exerciseIds) {
    const s = sessions.find(ss => ss.exercises.some(e => e.exerciseId === id && !e.skipped && e.sets.some(x => x.done)))
    if (s) out.set(id, s)
  }
  return out
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('active').first()
}

export function prescribeCtx(settings: Settings): Omit<PrescribeContext, 'isDeload'> {
  return { increments: settings.increments, units: settings.units, bodyweightKg: settings.bodyweightKg }
}

/**
 * Create (and persist) today's session from the program + schedule.
 * If a session is already in progress it is returned instead – two 'active'
 * rows would leave an orphan that Today keeps offering to "resume" forever.
 */
export async function startSession(date: string, settings: Settings, program: Program): Promise<WorkoutSession> {
  const existing = await getActiveSession()
  if (existing) return existing
  const info = scheduleFor(date, settings, program)
  const states = await getStates()
  const lastSessions = await lastCompletedSessionPerExercise(info.day.exercises.map(e => e.exerciseId))
  const session = buildSession({ day: info.day, dayIndex: info.dayIndex, weekNumber: info.weekNumber, isDeload: info.isDeload, date, states, lastSessions, ctx: prescribeCtx(settings) })
  await db.sessions.put(session)
  return session
}

export async function saveSession(session: WorkoutSession) {
  await db.sessions.put(session)
}

export interface CompletionResult {
  session: WorkoutSession
  notes: { exerciseId: string; note: string }[]
}

/** Finish a session: progression for every exercise, PRs, summary. */
export async function completeSession(session: WorkoutSession, settings: Settings): Promise<CompletionResult> {
  const states = await getStates()
  const prs: PR[] = []
  const notes: { exerciseId: string; note: string }[] = []
  let volumeKg = 0
  let setsDone = 0
  const completedAt = Date.now()
  const nextStates: ExerciseState[] = []

  for (const ex of session.exercises) {
    if (ex.skipped) continue
    const done = ex.sets.filter(s => s.done && !s.isWarmup && (s.reps ?? 0) > 0)
    if (done.length === 0) continue
    const def = getExercise(ex.exerciseId)
    const prev = states.get(ex.exerciseId)
    const o = evaluateSets(ex, session.bodyweightKg)
    volumeKg += o.volumeKg
    setsDone += done.length
    const found = detectPRs(session, ex, prev, settings.units)
    prs.push(...found)
    for (const s of ex.sets) if (found.length && s === o.bestSet) s.isPR = true
    const res = applyProgression(def, ex, prev, {
      increments: settings.increments, units: settings.units, bodyweightKg: session.bodyweightKg,
      missDropPct: settings.missDropPct, isDeload: session.isDeload, date: session.date, sessionId: session.id,
    })
    nextStates.push(res.state)
    notes.push({ exerciseId: ex.exerciseId, note: res.note })
  }

  const finished: WorkoutSession = {
    ...session, status: 'completed', completedAt,
    summary: { volumeKg: Math.round(volumeKg), setsDone, durationSec: Math.round((completedAt - session.startedAt) / 1000), prs },
  }
  await db.transaction('rw', [db.sessions, db.exerciseStates, db.prs], async () => {
    await db.sessions.put(finished)
    if (nextStates.length) await db.exerciseStates.bulkPut(nextStates)
    if (prs.length) await db.prs.bulkPut(prs)
  })
  return { session: finished, notes }
}

/** Wipe progression history for one exercise so it re-enters calibration. */
export async function resetCalibration(exerciseId: string) {
  await db.exerciseStates.delete(exerciseId)
}

export function exerciseLoadLabel(ex: SessionExercise): string {
  switch (ex.loadMode) {
    case 'height': return 'Box height'
    case 'bell': return 'Bell'
    case 'assisted': return 'Assist'
    case 'added': return 'Added'
    case 'bodyweight': return 'Bodyweight'
    default: return 'Weight'
  }
}

/**
 * Switch display units. Increments are adopted from the new unit's defaults
 * (unless `increments` is given) and every stored working load is re-rounded
 * so prescriptions land on real plates in the new unit.
 */
export async function switchUnits(units: Units, increments: Increments): Promise<void> {
  await updateSettings({ units, increments })
  const states = await db.exerciseStates.toArray()
  const next = states.map(st => {
    if (st.currentLoad == null || st.loadMode === 'height' || st.loadMode === 'bodyweight') return st
    const def = getExercise(st.exerciseId)
    return { ...st, currentLoad: roundLoad(st.currentLoad, def, increments, units, st.loadMode) }
  })
  if (next.length) await db.exerciseStates.bulkPut(next)
}
