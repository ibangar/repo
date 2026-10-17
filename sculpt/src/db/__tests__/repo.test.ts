import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../schema'
import { completeSession, getActiveSession, getProgram, getSettings, resetCalibration, saveSession, startSession, updateSettings } from '../repo'
import { scheduleFor } from '../../engine/schedule'
import type { WorkoutSession } from '../types'

async function reset() {
  await db.delete()
  await db.open()
}

function logAll(session: WorkoutSession, loadFor: (exerciseId: string) => number, reps: (ex: { repMin: number; repMax: number }) => number, rir = 2) {
  for (const ex of session.exercises) {
    for (const s of ex.sets) { s.load = loadFor(ex.exerciseId); s.reps = reps(ex); s.rir = rir; s.done = true; s.completedAt = Date.now() }
  }
}

describe('full loop: calibrate → progress → deload', () => {
  beforeEach(reset)

  it('week 1 is calibration, week 2 prescribes exact rounded loads, hitting the top bumps weight', async () => {
    const settings = await updateSettings({ onboarded: true, programStartDate: '2026-10-19', bodyweightKg: 78 })
    const program = await getProgram()
    const d1 = '2026-10-19'
    expect(scheduleFor(d1, settings, program).day.name).toBe('Push')

    const s1 = await startSession(d1, settings, program)
    expect(s1.exercises.every(e => e.calibration)).toBe(true)
    expect(s1.exercises[0].warmups).toHaveLength(0)
    expect(await getActiveSession()).toBeDefined()

    // Calibrate: incline DB 24 kg × 10 everywhere (top of 6–10) → should bump by dumbbell step (2 kg)
    logAll(s1, id => (id === 'inclineDbPress' ? 24 : id === 'flatBbBench' ? 60 : 10), ex => ex.repMax, 2)
    await saveSession(s1)
    const { session: done1, notes } = await completeSession(s1, settings)
    expect(done1.status).toBe('completed')
    expect(done1.summary!.setsDone).toBe(20)
    expect(done1.summary!.volumeKg).toBeGreaterThan(0)
    expect(done1.summary!.prs).toHaveLength(0) // calibration session: nothing to beat yet
    expect(notes.find(n => n.exerciseId === 'inclineDbPress')!.note).toMatch(/\+2 kg/)
    expect(await getActiveSession()).toBeUndefined()

    // Week 2, same day
    const s2 = await startSession('2026-10-26', settings, program)
    expect(s2.weekNumber).toBe(2)
    const inc = s2.exercises.find(e => e.exerciseId === 'inclineDbPress')!
    expect(inc.calibration).toBe(false)
    expect(inc.sets.every(s => s.prescribedLoad === 26 && s.prescribedReps === 6)).toBe(true)
    expect(inc.warmups.map(w => w.load)).toEqual([14, 20]) // 50% → 13 → 14 (2 kg DB step); 75% → 19.5 → 20
    expect(inc.lastTime!.sets).toHaveLength(4)
    expect(inc.lastTime!.sets[0]).toEqual({ load: 24, reps: 10, rir: 2 })
    const bench = s2.exercises.find(e => e.exerciseId === 'flatBbBench')!
    expect(bench.sets[0].prescribedLoad).toBe(62.5)
    expect(bench.warmups).toHaveLength(0) // not the first compound of the day

    // Week 2: in range → PR on e1RM since heavier
    logAll(s2, id => (id === 'inclineDbPress' ? 26 : id === 'flatBbBench' ? 62.5 : 12.5), ex => ex.repMin + 1, 2)
    const { session: done2 } = await completeSession(s2, settings)
    expect(done2.summary!.prs.some(p => p.exerciseId === 'inclineDbPress' && p.type === 'load')).toBe(true)
    const st = await db.exerciseStates.get('inclineDbPress')
    expect(st!.currentLoad).toBe(26)
    expect(st!.targetReps).toBe(8)
    expect(st!.history).toHaveLength(2)
  })

  it('deload week reduces sets and load without touching progression', async () => {
    const settings = await updateSettings({ onboarded: true, programStartDate: '2026-01-05', deloadEvery: 7 })
    const program = await getProgram()
    await db.exerciseStates.put({ exerciseId: 'bbHipThrust', loadMode: 'weight', currentLoad: 120, targetReps: 10, calibrated: true, consecutiveMisses: 0, bestE1rm: 160, bestLoad: 120, history: [], updatedAt: 0 })
    const deloadDate = '2026-02-17' // week 7, day 2 (glutes)
    const info = scheduleFor(deloadDate, settings, program)
    expect(info.weekNumber).toBe(7); expect(info.isDeload).toBe(true); expect(info.day.name).toMatch(/Glutes/)
    const s = await startSession(deloadDate, settings, program)
    const ht = s.exercises.find(e => e.exerciseId === 'bbHipThrust')!
    expect(ht.sets).toHaveLength(2) // 4 × 0.6 → 2
    expect(ht.sets[0].prescribedLoad).toBe(107.5) // 108 → nearest 2.5
    logAll(s, () => 107.5, ex => ex.repMax, 3)
    await completeSession(s, settings)
    const st = await db.exerciseStates.get('bbHipThrust')
    expect(st!.currentLoad).toBe(120)
    expect(st!.targetReps).toBe(10)
  })

  it('reset calibration puts an exercise back into calibration mode', async () => {
    const settings = await updateSettings({ onboarded: true, programStartDate: '2026-10-19' })
    const program = await getProgram()
    await db.exerciseStates.put({ exerciseId: 'flatBbBench', loadMode: 'weight', currentLoad: 80, targetReps: 8, calibrated: true, consecutiveMisses: 0, bestE1rm: 100, bestLoad: 80, history: [], updatedAt: 0 })
    await resetCalibration('flatBbBench')
    const s = await startSession('2026-10-26', settings, program)
    expect(s.exercises.find(e => e.exerciseId === 'flatBbBench')!.calibration).toBe(true)
  })

  it('startSession never creates a second active session', async () => {
    const settings = await updateSettings({ onboarded: true, programStartDate: '2026-10-19' })
    const program = await getProgram()
    const first = await startSession('2026-10-19', settings, program)
    const again = await startSession('2026-10-20', settings, program)
    expect(again.id).toBe(first.id)
    expect(await db.sessions.where('status').equals('active').count()).toBe(1)
    await completeSession(first, settings)
    const next = await startSession('2026-10-20', settings, program)
    expect(next.id).not.toBe(first.id)
    expect(next.dayIndex).toBe(1)
  })

  it('skipped exercises and unlogged sets are ignored on completion', async () => {
    const settings = await getSettings()
    const program = await getProgram()
    const s = await startSession('2026-10-19', settings, program)
    s.exercises[0].skipped = true
    s.exercises[1].sets[0] = { ...s.exercises[1].sets[0], load: 60, reps: 8, rir: 2, done: true }
    const { session } = await completeSession(s, settings)
    expect(session.summary!.setsDone).toBe(1)
    expect(await db.exerciseStates.get(s.exercises[0].exerciseId)).toBeUndefined()
    expect((await db.exerciseStates.get(s.exercises[1].exerciseId))!.currentLoad).toBe(60)
  })
})

describe('switchUnits', () => {
  beforeEach(reset)
  it('adopts lb increments and re-rounds stored loads to real plates', async () => {
    const { switchUnits } = await import('../repo')
    await db.exerciseStates.put({ exerciseId: 'flatBbBench', loadMode: 'weight', currentLoad: 60, targetReps: 8, calibrated: true, consecutiveMisses: 0, bestE1rm: 80, bestLoad: 60, history: [], updatedAt: 0 })
    const lbInc = { smallestPlateKg: 2.5 * 0.45359237, dumbbellStepKg: 5 * 0.45359237, cableStepKg: 5 * 0.45359237, kettlebellStepKg: 8 * 0.45359237, boxStepCm: 5.08 }
    await switchUnits('lb', lbInc)
    const s = await getSettings()
    expect(s.units).toBe('lb')
    const st = (await db.exerciseStates.get('flatBbBench'))!
    const lb = st.currentLoad! / 0.45359237
    expect(Math.abs(lb / 5 - Math.round(lb / 5))).toBeLessThan(1e-3) // multiple of 5 lb (kg stored to 3 dp)
    expect(lb).toBeCloseTo(130, 2) // 60 kg = 132.3 lb → 130
  })
})
