import { describe, expect, it } from 'vitest'
import { scheduleFor, shiftForward, addDays, daysBetween } from '../schedule'
import { DEFAULT_PROGRAM } from '../../data/program'
import { DEFAULT_SETTINGS } from '../../db/defaults'
import { weeklyWeights, weightTrend, maintenanceEstimate, isStalled, measurementVerdict } from '../trends'
import { proteinTargets } from '../nutrition'
import type { ExerciseState } from '../../db/types'

const s = { ...DEFAULT_SETTINGS, programStartDate: '2026-10-19', scheduleOffset: 0, deloadEvery: 7 }

describe('schedule', () => {
  it('maps dates to program days in a rolling 7-day cycle', () => {
    expect(scheduleFor('2026-10-19', s, DEFAULT_PROGRAM).day.name).toBe('Push')
    expect(scheduleFor('2026-10-20', s, DEFAULT_PROGRAM).day.name).toBe('Glutes + Leg Strength')
    expect(scheduleFor('2026-10-22', s, DEFAULT_PROGRAM).day.focus).toBe('rest')
    expect(scheduleFor('2026-10-26', s, DEFAULT_PROGRAM)).toMatchObject({ dayIndex: 0, weekNumber: 2, isCalibrationWeek: false })
  })
  it('week 1 is calibration', () => {
    expect(scheduleFor('2026-10-21', s, DEFAULT_PROGRAM).isCalibrationWeek).toBe(true)
  })
  it('deload every 7th week by default, configurable 6–8', () => {
    expect(scheduleFor(addDays('2026-10-19', 7 * 6), s, DEFAULT_PROGRAM).isDeload).toBe(true) // week 7
    expect(scheduleFor(addDays('2026-10-19', 7 * 5), s, DEFAULT_PROGRAM).isDeload).toBe(false)
    expect(scheduleFor(addDays('2026-10-19', 7 * 5), { ...s, deloadEvery: 6 }, DEFAULT_PROGRAM).isDeload).toBe(true)
    expect(scheduleFor(addDays('2026-10-19', 7 * 7), { ...s, deloadEvery: 8 }, DEFAULT_PROGRAM).isDeload).toBe(true)
    expect(scheduleFor(addDays('2026-10-19', 7 * 7), { ...s, deloadEvery: 20 }, DEFAULT_PROGRAM).isDeload).toBe(true) // clamps to 8
  })
  it('shifting forward moves today to the missed day', () => {
    const shifted = shiftForward(s)
    expect(scheduleFor('2026-10-20', shifted, DEFAULT_PROGRAM).day.name).toBe('Push')
    expect(scheduleFor('2026-10-21', shifted, DEFAULT_PROGRAM).day.name).toBe('Glutes + Leg Strength')
  })
  it('dates before the start clamp to day 1', () => {
    expect(scheduleFor('2026-10-01', s, DEFAULT_PROGRAM).dayIndex).toBe(0)
  })
  it('date helpers', () => {
    expect(daysBetween('2026-10-19', '2026-10-26')).toBe(7)
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })
})

describe('trends', () => {
  it('weekly averages and 3-week up trend → trim portions', () => {
    const w = weeklyWeights([
      { id: '1', date: '2026-09-07', kg: 75 }, { id: '2', date: '2026-09-14', kg: 75.4 },
      { id: '3', date: '2026-09-21', kg: 75.8 }, { id: '4', date: '2026-09-28', kg: 76.2 },
    ])
    expect(w).toHaveLength(4)
    const t = weightTrend(w)
    expect(t.direction).toBe('up'); expect(t.streak).toBe(3); expect(t.alert).toBe('trimPortions')
    expect(t.slopeKgPerWeek).toBeCloseTo(0.4)
  })
  it('3-week down → eat more; 2-week → no alert', () => {
    const down = weeklyWeights([75, 74.6, 74.2, 73.8].map((kg, i) => ({ id: String(i), date: `2026-09-${7 + i * 7}`, kg })))
    expect(weightTrend(down).alert).toBe('eatMore')
    const two = weeklyWeights([75, 74.6, 74.2].map((kg, i) => ({ id: String(i), date: `2026-09-${7 + i * 7}`, kg })))
    expect(weightTrend(two).alert).toBeNull()
  })
  it('flat weeks break the streak', () => {
    const w = weeklyWeights([75, 75.5, 75.5, 76].map((kg, i) => ({ id: String(i), date: `2026-09-${7 + i * 7}`, kg })))
    expect(weightTrend(w).streak).toBe(1)
  })
  it('maintenance estimate', () => {
    expect(maintenanceEstimate(75, undefined, 0).kcal).toBe(2330)
    const m = maintenanceEstimate(75, 2500, 0.2)
    expect(m.basis).toBe('trend'); expect(m.dailyBalance).toBe(220); expect(m.kcal).toBe(2280)
  })
  it('stall detection needs 3 sessions in the window with no e1RM improvement', () => {
    const mk = (date: string, e1rm: number) => ({ date, sessionId: 'x', loadMode: 'weight' as const, load: 60, bestReps: 8, bestRir: 2, e1rm, outcome: 'inRange' as const, volumeKg: 0 })
    const st: ExerciseState = { exerciseId: 'a', loadMode: 'weight', currentLoad: 60, targetReps: 8, calibrated: true, consecutiveMisses: 0, bestE1rm: 80, bestLoad: 60, updatedAt: 0,
      history: [mk('2026-09-20', 80), mk('2026-09-27', 80), mk('2026-10-04', 80), mk('2026-10-11', 80)] }
    expect(isStalled(st, '2026-10-15')).toBe(true)
    st.history.push(mk('2026-10-14', 83))
    expect(isStalled(st, '2026-10-15')).toBe(false)
  })
  it('measurement verdicts follow the goals', () => {
    expect(measurementVerdict('hips', 2)).toBe('good')
    expect(measurementVerdict('thigh', 0.5)).toBe('good')
    expect(measurementVerdict('thigh', 3)).toBe('watch')
    expect(measurementVerdict('waist', -1)).toBe('good')
    expect(measurementVerdict('waist', 2)).toBe('watch')
  })
})

describe('nutrition', () => {
  it('protein targets 1.6–2.2 g/kg, half per meal', () => {
    const p = proteinTargets(75, 1.8)
    expect(p.dailyG).toBe(135); expect(p.perMealG).toBe(68); expect(p.rangeLowG).toBe(120); expect(p.rangeHighG).toBe(165)
    expect(proteinTargets(75, 3).perKg).toBe(2.2)
  })
})
