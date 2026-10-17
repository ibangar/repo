import { describe, expect, it } from 'vitest'
import { applyProgression, emptyState, evaluateSets, type ProgressionContext } from '../progression'
import { prescribeExercise, rampUps, deloadSets } from '../prescription'
import { epley, loadForReps } from '../epley'
import { roundLoad, progressionJumpKg, smallestStepKg } from '../increments'
import { getExercise } from '../../data/exercises'
import type { ExerciseState, Increments, SessionExercise, SetLog } from '../../db/types'

const inc: Increments = { smallestPlateKg: 1.25, dumbbellStepKg: 2, cableStepKg: 2.5, kettlebellStepKg: 4, boxStepCm: 5 }
const ctx = (over: Partial<ProgressionContext> = {}): ProgressionContext => ({
  increments: inc, units: 'kg', bodyweightKg: 75, missDropPct: 7.5, isDeload: false, date: '2026-10-20', sessionId: 's1', ...over,
})

function sets(spec: [number, number, number][], extra: Partial<SetLog> = {}): SetLog[] {
  return spec.map(([load, reps, rir], i) => ({ index: i, prescribedLoad: load, prescribedReps: reps, load, reps, rir, done: true, ...extra }))
}
function ex(id: string, repMin: number, repMax: number, s: SetLog[], over: Partial<SessionExercise> = {}): SessionExercise {
  return { programExerciseId: 'p', exerciseId: id, loadMode: 'weight', repMin, repMax, restSec: 120, calibration: false, warmups: [], sets: s, ...over }
}

describe('epley', () => {
  it('matches the textbook formula', () => {
    expect(epley(100, 10)).toBeCloseTo(133.33, 1)
    expect(epley(100, 1)).toBe(100)
  })
  it('adds RIR to reps', () => {
    expect(epley(100, 8, 2)).toBeCloseTo(epley(100, 10))
  })
  it('inverts', () => {
    expect(loadForReps(epley(80, 8), 8)).toBeCloseTo(80)
  })
})

describe('rounding & increments', () => {
  const bench = getExercise('flatBbBench')
  const incline = getExercise('inclineDbPress')
  const hip = getExercise('bbHipThrust')
  it('rounds barbell loads to 2× smallest plate', () => {
    expect(roundLoad(61.1, bench, inc, 'kg')).toBe(60)
    expect(roundLoad(61.3, bench, inc, 'kg')).toBe(62.5)
  })
  it('rounds dumbbells to the dumbbell step', () => {
    expect(roundLoad(23, incline, inc, 'kg')).toBe(24)
    expect(roundLoad(22.9, incline, inc, 'kg')).toBe(22)
  })
  it('uses +2.5 upper / +5 lower in kg', () => {
    expect(progressionJumpKg(bench, inc, 'kg')).toBe(2.5)
    expect(progressionJumpKg(hip, inc, 'kg')).toBe(5)
  })
  it('uses +5 lb upper / +10 lb lower in lb', () => {
    expect(progressionJumpKg(bench, inc, 'lb')).toBeCloseTo(5 * 0.45359237)
    expect(progressionJumpKg(hip, inc, 'lb')).toBeCloseTo(10 * 0.45359237)
  })
  it('rounds in display units when in lb', () => {
    const lbInc: Increments = { ...inc, smallestPlateKg: 2.5 * 0.45359237 } // 2.5 lb plates → 5 lb jumps
    const kg = roundLoad(100 * 0.45359237 + 1, bench, lbInc, 'lb')
    expect(kg / 0.45359237).toBeCloseTo(100, 2)
  })
  it('smallest step for pull-up modes', () => {
    const pu = getExercise('pullUp')
    expect(smallestStepKg(pu, inc, 'added')).toBe(1.25)
    expect(smallestStepKg(pu, inc, 'assisted')).toBe(2.5)
  })
})

describe('evaluateSets', () => {
  it('flags all-top with RIR ≥ 1', () => {
    const o = evaluateSets(ex('flatBbBench', 6, 10, sets([[60, 10, 2], [60, 10, 1], [60, 10, 2]])), 75)
    expect(o.allHitTop).toBe(true)
    expect(o.anyMissedBottom).toBe(false)
    expect(o.workingLoad).toBe(60)
    expect(o.volumeKg).toBe(1800)
  })
  it('does not count RIR 0 as ready to progress', () => {
    const o = evaluateSets(ex('flatBbBench', 6, 10, sets([[60, 10, 2], [60, 10, 0]])), 75)
    expect(o.allHitTop).toBe(false)
  })
  it('uses bodyweight + added for pull-ups', () => {
    const o = evaluateSets(ex('pullUp', 6, 10, sets([[5, 8, 2]]), { loadMode: 'added' }), 75)
    expect(o.bestE1rm).toBeCloseTo(epley(80, 8, 2))
    expect(o.volumeKg).toBe(640)
  })
  it('uses bodyweight − assist for assisted pull-ups', () => {
    const o = evaluateSets(ex('pullUp', 6, 10, sets([[20, 8, 2]]), { loadMode: 'assisted' }), 75)
    expect(o.bestE1rm).toBeCloseTo(epley(55, 8, 2))
  })
})

describe('double progression', () => {
  const bench = getExercise('flatBbBench')
  it('calibration session sets the working weight and calibrates', () => {
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[60, 8, 2], [60, 8, 2], [60, 7, 2]])), undefined, ctx())
    expect(r.state.calibrated).toBe(true)
    expect(r.state.currentLoad).toBe(60)
    expect(r.state.targetReps).toBe(8) // min reps 7 + 1
    expect(r.state.bestE1rm).toBeCloseTo(epley(60, 8, 2))
    expect(r.outcome).toBe('inRange')
  })
  it('top of range on all sets at RIR 1-2 → +2.5 kg for upper compounds', () => {
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[60, 10, 2], [60, 10, 1], [60, 10, 2]])), undefined, ctx())
    expect(r.state.currentLoad).toBe(62.5)
    expect(r.outcome).toBe('hitTop')
    expect(r.state.targetReps).toBe(6)
  })
  it('top of range → +5 kg for hip thrust / squat / deadlift', () => {
    for (const id of ['bbHipThrust', 'backSquat', 'trapBarDeadlift', 'rdl']) {
      const d = getExercise(id)
      const r = applyProgression(d, ex(id, 8, 12, sets([[100, 12, 2], [100, 12, 2]])), undefined, ctx())
      expect(r.state.currentLoad).toBe(105)
    }
  })
  it('top of range → smallest dumbbell jump for dumbbells', () => {
    const d = getExercise('inclineDbPress')
    const r = applyProgression(d, ex('inclineDbPress', 6, 10, sets([[24, 10, 2], [24, 10, 2], [24, 10, 1], [24, 10, 2]])), undefined, ctx())
    expect(r.state.currentLoad).toBe(26)
  })
  it('top of range → smallest cable step for isolation', () => {
    const d = getExercise('cableFly')
    const r = applyProgression(d, ex('cableFly', 12, 15, sets([[15, 15, 2], [15, 15, 2], [15, 15, 2]])), undefined, ctx())
    expect(r.state.currentLoad).toBe(17.5)
  })
  it('within range → same weight, aim +1 rep', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 62.5, targetReps: 6 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[62.5, 8, 2], [62.5, 7, 2], [62.5, 6, 1]])), prev, ctx())
    expect(r.state.currentLoad).toBe(62.5)
    expect(r.state.targetReps).toBe(7)
    expect(r.outcome).toBe('inRange')
  })
  it('one miss → same weight, counter 1', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 62.5, targetReps: 6 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[62.5, 6, 1], [62.5, 5, 0], [62.5, 5, 0]])), prev, ctx())
    expect(r.state.currentLoad).toBe(62.5)
    expect(r.state.consecutiveMisses).toBe(1)
    expect(r.outcome).toBe('missedBottom')
  })
  it('two misses in a row → drop 5–10% and reset counter', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 80, targetReps: 6, consecutiveMisses: 1 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[80, 6, 1], [80, 5, 0], [80, 4, 0]])), prev, ctx())
    expect(r.state.currentLoad).toBe(75) // 80 × 0.925 = 74 → rounds to 75
    expect(r.state.currentLoad).toBeGreaterThanOrEqual(72)
    expect(r.state.currentLoad).toBeLessThanOrEqual(76)
    expect(r.state.consecutiveMisses).toBe(0)
  })
  it('a drop always actually drops at least one step', () => {
    const d = getExercise('cableFly')
    const prev: ExerciseState = { ...emptyState('cableFly', 'weight'), calibrated: true, currentLoad: 10, targetReps: 12, consecutiveMisses: 1 }
    const r = applyProgression(d, ex('cableFly', 12, 15, sets([[10, 10, 0], [10, 9, 0]])), prev, ctx())
    expect(r.state.currentLoad).toBe(7.5)
  })
  it('a hit resets the miss counter', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 60, targetReps: 6, consecutiveMisses: 1 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[60, 8, 2]])), prev, ctx())
    expect(r.state.consecutiveMisses).toBe(0)
  })
  it('deload sessions never change the prescription', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 80, targetReps: 7, consecutiveMisses: 1 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[72.5, 10, 3], [72.5, 10, 3]])), prev, ctx({ isDeload: true }))
    expect(r.state.currentLoad).toBe(80)
    expect(r.state.targetReps).toBe(7)
    expect(r.state.consecutiveMisses).toBe(1)
    expect(r.outcome).toBe('deload')
  })
  it('tracks best e1RM across sessions', () => {
    const prev: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 60, targetReps: 6, bestE1rm: 90 }
    const r = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[60, 8, 2]])), prev, ctx())
    expect(r.state.bestE1rm).toBe(90)
    const r2 = applyProgression(bench, ex('flatBbBench', 6, 10, sets([[70, 10, 2]])), prev, ctx())
    expect(r2.state.bestE1rm).toBeCloseTo(epley(70, 10, 2))
  })
})

describe('bodyweight / assisted / added modes', () => {
  const pu = getExercise('pullUp')
  it('bodyweight hitting top → switches to added weight', () => {
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[0, 10, 2], [0, 10, 2], [0, 10, 1], [0, 10, 2]]), { loadMode: 'bodyweight' }), undefined, ctx())
    expect(r.state.loadMode).toBe('added')
    expect(r.state.currentLoad).toBe(1.25)
  })
  it('added hitting top → more added weight', () => {
    const prev: ExerciseState = { ...emptyState('pullUp', 'added'), calibrated: true, currentLoad: 5 }
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[5, 10, 2], [5, 10, 2]]), { loadMode: 'added' }), prev, ctx())
    expect(r.state.currentLoad).toBe(6.25)
  })
  it('assisted hitting top → less assistance', () => {
    const prev: ExerciseState = { ...emptyState('pullUp', 'assisted'), calibrated: true, currentLoad: 20 }
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[20, 10, 2], [20, 10, 2]]), { loadMode: 'assisted' }), prev, ctx())
    expect(r.state.loadMode).toBe('assisted')
    expect(r.state.currentLoad).toBe(17.5)
  })
  it('assisted reaching zero → bodyweight', () => {
    const prev: ExerciseState = { ...emptyState('pullUp', 'assisted'), calibrated: true, currentLoad: 2.5 }
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[2.5, 10, 2]]), { loadMode: 'assisted' }), prev, ctx())
    expect(r.state.loadMode).toBe('bodyweight')
    expect(r.state.currentLoad).toBe(0)
  })
  it('bodyweight missing twice → assisted', () => {
    const prev: ExerciseState = { ...emptyState('pullUp', 'bodyweight'), calibrated: true, currentLoad: 0, consecutiveMisses: 1 }
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[0, 4, 0], [0, 3, 0]]), { loadMode: 'bodyweight' }), prev, ctx())
    expect(r.state.loadMode).toBe('assisted')
    expect(r.state.currentLoad).toBeGreaterThan(0)
  })
  it('added missing twice drops added load, falling back to bodyweight when tiny', () => {
    const prev: ExerciseState = { ...emptyState('pullUp', 'added'), calibrated: true, currentLoad: 2.5, consecutiveMisses: 1 }
    const r = applyProgression(pu, ex('pullUp', 6, 10, sets([[2.5, 4, 0]]), { loadMode: 'added' }), prev, ctx())
    expect(r.state.loadMode).toBe('bodyweight')
    const prev2: ExerciseState = { ...emptyState('pullUp', 'added'), calibrated: true, currentLoad: 20, consecutiveMisses: 1 }
    const r2 = applyProgression(pu, ex('pullUp', 6, 10, sets([[20, 4, 0]]), { loadMode: 'added' }), prev2, ctx())
    expect(r2.state.loadMode).toBe('added')
    expect(r2.state.currentLoad).toBe(18.75)
  })
})

describe('power lifts', () => {
  it('box jumps progress only when every set was explosive', () => {
    const bj = getExercise('boxJump')
    const all = applyProgression(bj, ex('boxJump', 3, 3, sets([[60, 3, 2], [60, 3, 2], [60, 3, 2], [60, 3, 2]], { explosive: true }), { loadMode: 'height' }), undefined, ctx())
    expect(all.state.currentLoad).toBe(65)
    const some = sets([[60, 3, 2], [60, 3, 2], [60, 3, 2], [60, 3, 2]], { explosive: true })
    some[2].explosive = false
    const r = applyProgression(bj, ex('boxJump', 3, 3, some, { loadMode: 'height' }), undefined, ctx())
    expect(r.state.currentLoad).toBe(60)
  })
  it('kettlebell swings move to the next bell', () => {
    const kb = getExercise('kbSwing')
    const r = applyProgression(kb, ex('kbSwing', 15, 15, sets([[16, 15, 2], [16, 15, 2], [16, 15, 2]], { explosive: true }), { loadMode: 'bell' }), undefined, ctx())
    expect(r.state.currentLoad).toBe(20)
    expect(r.state.bestE1rm).toBeNull()
  })
})

describe('prescription', () => {
  const pe = { id: 'd1e2', exerciseId: 'flatBbBench', sets: 3, repMin: 6, repMax: 10 }
  const pctx = { increments: inc, units: 'kg' as const, bodyweightKg: 75, isDeload: false }
  it('calibration when there is no state', () => {
    const se = prescribeExercise(pe, undefined, pctx, { firstCompound: true })
    expect(se.calibration).toBe(true)
    expect(se.sets).toHaveLength(3)
    expect(se.sets[0].prescribedLoad).toBeNull()
    expect(se.warmups).toHaveLength(0)
  })
  it('prescribes exact loads and ramp-ups once calibrated', () => {
    const st: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 80, targetReps: 7 }
    const se = prescribeExercise(pe, st, pctx, { firstCompound: true })
    expect(se.calibration).toBe(false)
    expect(se.sets.every(s => s.prescribedLoad === 80 && s.prescribedReps === 7)).toBe(true)
    expect(se.warmups.map(w => [w.load, w.reps])).toEqual([[40, 8], [60, 4]])
  })
  it('deload: ~40% fewer sets, 10% lighter', () => {
    const st: ExerciseState = { ...emptyState('flatBbBench', 'weight'), calibrated: true, currentLoad: 80, targetReps: 9 }
    const se = prescribeExercise({ ...pe, sets: 4 }, st, { ...pctx, isDeload: true })
    expect(se.sets).toHaveLength(2)
    expect(se.sets[0].prescribedLoad).toBe(72.5)
    expect(se.sets[0].prescribedReps).toBe(6)
    expect(deloadSets(3)).toBe(2)
    expect(deloadSets(2)).toBe(1)
  })
  it('unilateral exercises get L/R sets', () => {
    const se = prescribeExercise({ id: 'x', exerciseId: 'bulgarianSplitSquat', sets: 3, repMin: 8, repMax: 8 }, undefined, pctx)
    expect(se.sets).toHaveLength(6)
    expect(se.sets.map(s => s.side)).toEqual(['L', 'R', 'L', 'R', 'L', 'R'])
  })
  it('ramp-ups skip duplicates / zero', () => {
    expect(rampUps(10, getExercise('flatBbBench'), inc, 'kg')).toHaveLength(2)
    expect(rampUps(2.5, getExercise('flatBbBench'), inc, 'kg')).toHaveLength(0)
  })
})
