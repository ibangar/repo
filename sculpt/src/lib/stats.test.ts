import { describe, expect, it } from 'vitest'
import type { ExerciseState, Settings, WorkoutSession } from '../db/types'
import { DEFAULT_SETTINGS } from '../db/defaults'
import { DEFAULT_PROGRAM } from '../data/program'
import {
  blockWeek, checkinVerdict, eatingTimeline, fourWeekChange, goalRows, heatmapCells, lastWeekStarts, liftComparison, liftSeries,
  mondayOf, streakStats, weeklyVolume, weighInStatus,
} from './stats'

const settings: Settings = { ...DEFAULT_SETTINGS, programStartDate: '2026-08-10', blockStartDate: '2026-08-10' }
// 2026-08-10 is a Monday → dayIndex 0 (Push) on Mondays, rest (d4) on Thursdays, rest (d7) on Sundays.

function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s-${date}`, date, dayId: 'd2', dayName: 'Glutes', dayIndex: 1, weekNumber: 1, isDeload: false, status: 'completed',
    startedAt: 0, completedAt: 1, bodyweightKg: 75, exercises: [], ...over,
  }
}

describe('weeks', () => {
  it('finds Monday', () => {
    expect(mondayOf('2026-10-17')).toBe('2026-10-12')
    expect(mondayOf('2026-10-12')).toBe('2026-10-12')
    expect(mondayOf('2026-10-18')).toBe('2026-10-12')
  })
  it('lists week starts oldest first', () => {
    expect(lastWeekStarts('2026-10-17', 3)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
  })
})

describe('streakStats', () => {
  it('counts consecutive training days and skips rest days', () => {
    // Mon 12, Tue 13, Wed 14 trained; Thu 15 rest; Fri 16 trained; today Sat 17 not yet done
    const sessions = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16'].map(d => session(d))
    const s = streakStats(sessions, settings, DEFAULT_PROGRAM, '2026-10-17')
    expect(s.streak).toBe(4)
    expect(s.totalWorkouts).toBe(4)
    expect(s.weekDone).toBe(4)
    expect(s.weekPlanned).toBe(5)
  })
  it('breaks on a missed training day', () => {
    const sessions = ['2026-10-12', '2026-10-14', '2026-10-16'].map(d => session(d))
    // Fri 16 ✓, Thu 15 rest (skipped), Wed 14 ✓, Tue 13 missed → 2
    expect(streakStats(sessions, settings, DEFAULT_PROGRAM, '2026-10-17').streak).toBe(2)
  })
  it('ignores abandoned sessions', () => {
    const sessions = [session('2026-10-16', { status: 'abandoned' })]
    expect(streakStats(sessions, settings, DEFAULT_PROGRAM, '2026-10-17').totalWorkouts).toBe(0)
  })
})

describe('heatmapCells', () => {
  it('builds 7 × N cells ending this week', () => {
    const cells = heatmapCells([session('2026-10-13')], '2026-10-17', 12)
    expect(cells.length).toBe(12)
    expect(cells[11].length).toBe(7)
    expect(cells[11][0].date).toBe('2026-10-12')
    expect(cells[11][1].count).toBe(1)
    expect(cells[11][6].future).toBe(true)
  })
})

describe('weeklyVolume', () => {
  it('sums reps × effective load into every volume group', () => {
    const s = session('2026-10-13', {
      exercises: [
        { programExerciseId: 'p', exerciseId: 'rdl', loadMode: 'weight', repMin: 6, repMax: 8, restSec: 120, calibration: false, warmups: [], sets: [
          { index: 0, prescribedLoad: 100, prescribedReps: 8, load: 100, reps: 8, rir: 2, done: true },
          { index: 1, prescribedLoad: 100, prescribedReps: 8, load: 100, reps: 7, rir: 1, done: true },
          { index: 2, prescribedLoad: 100, prescribedReps: 8, load: 100, reps: null, rir: 0, done: false },
        ] },
        { programExerciseId: 'q', exerciseId: 'boxJump', loadMode: 'height', repMin: 3, repMax: 3, restSec: 120, calibration: false, warmups: [], sets: [
          { index: 0, prescribedLoad: 60, prescribedReps: 3, load: 60, reps: 3, rir: 0, done: true },
        ] },
        { programExerciseId: 'r', exerciseId: 'pullUp', loadMode: 'added', repMin: 6, repMax: 10, restSec: 120, calibration: false, warmups: [], sets: [
          { index: 0, prescribedLoad: 10, prescribedReps: 8, load: 10, reps: 8, rir: 1, done: true },
        ] },
      ],
    })
    const weeks = weeklyVolume([s], '2026-10-17', 2)
    expect(weeks.length).toBe(2)
    const w = weeks[1]
    expect(w.weekStart).toBe('2026-10-12')
    expect(w.volume.hamstrings).toBe(1500)
    expect(w.volume.glutes).toBe(1500)
    expect(w.hardSets.glutes).toBe(2)
    expect(w.volume.quads).toBe(0) // box jumps skipped
    expect(w.volume.back).toBe((75 + 10) * 8)
    expect(w.volume.arms).toBe((75 + 10) * 8)
    expect(weeks[0].volume.glutes).toBe(0)
  })
})

const state = (history: { date: string; e1rm: number | null; load: number }[], over: Partial<ExerciseState> = {}): ExerciseState => ({
  exerciseId: 'bbHipThrust', loadMode: 'weight', currentLoad: 120, targetReps: 8, calibrated: true, consecutiveMisses: 0,
  bestE1rm: 150, bestLoad: 120, updatedAt: 0,
  history: history.map(h => ({ ...h, sessionId: 's', loadMode: 'weight' as const, bestReps: 8, bestRir: 2, outcome: 'inRange' as const, volumeKg: 0 })),
  ...over,
})

describe('liftSeries / fourWeekChange', () => {
  it('drops nulls and flags the best once', () => {
    const { points } = liftSeries(state([{ date: '2026-09-01', e1rm: 140, load: 110 }, { date: '2026-09-08', e1rm: null, load: 110 }, { date: '2026-09-15', e1rm: 150, load: 120 }, { date: '2026-09-22', e1rm: 150, load: 120 }]))
    expect(points.length).toBe(3)
    expect(points.filter(p => p.isBest).length).toBe(1)
    expect(points[1].isBest).toBe(true)
  })
  it('uses load for power lifts', () => {
    const { points, isLoadOnly } = liftSeries(state([{ date: '2026-09-01', e1rm: null, load: 60 }], { loadMode: 'height' }))
    expect(isLoadOnly).toBe(true)
    expect(points[0].value).toBe(60)
  })
  it('computes change vs ≥4 weeks ago', () => {
    const { points } = liftSeries(state([{ date: '2026-09-01', e1rm: 100, load: 1 }, { date: '2026-09-15', e1rm: 105, load: 1 }, { date: '2026-10-15', e1rm: 110, load: 1 }]))
    expect(fourWeekChange(points, '2026-10-17')).toBe(4.8) // vs 105 (last point ≤ 28 days before)
    expect(fourWeekChange(points.slice(0, 1), '2026-10-17')).toBeNull()
  })
})

describe('weighInStatus', () => {
  it('knows when the weekly weigh-in is due', () => {
    const s = { weighInDay: 1 } // Monday
    expect(weighInStatus(s, [], '2026-10-17')).toMatchObject({ nextDate: '2026-10-12', doneThisWeek: false, overdue: true })
    expect(weighInStatus(s, [{ id: 'w', date: '2026-10-12', kg: 80 }], '2026-10-17')).toMatchObject({ nextDate: '2026-10-19', doneThisWeek: true, overdue: false })
    expect(weighInStatus({ weighInDay: 6 }, [], '2026-10-17')).toMatchObject({ nextDate: '2026-10-17', dueToday: true })
  })
})

describe('check-in helpers', () => {
  it('week of block', () => {
    expect(blockWeek('2026-10-17', '2026-10-17')).toBe(1)
    expect(blockWeek('2026-08-10', '2026-10-17')).toBe(10)
  })
  it('compares start vs best since block start', () => {
    const c = liftComparison(state([{ date: '2026-08-01', e1rm: 120, load: 1 }, { date: '2026-08-12', e1rm: 130, load: 1 }, { date: '2026-09-12', e1rm: 145, load: 1 }, { date: '2026-10-12', e1rm: 140, load: 1 }]), '2026-08-10')
    expect(c).toMatchObject({ start: 130, now: 145 })
    expect(c!.deltaPct).toBeCloseTo(11.5, 1)
    expect(liftComparison(undefined, '2026-08-10')).toBeNull()
  })
  it('writes a friendly verdict', () => {
    const goals = goalRows({ id: 'a', date: '2026-08-10', hips: 100, waist: 80 }, { id: 'b', date: '2026-10-10', hips: 102, waist: 80.5 })
    const text = checkinVerdict({ lifts: [{ exerciseId: 'bbHipThrust', start: 130, now: 145.6, deltaPct: 12, isLoadOnly: false }], goals, weightStartKg: 80, weightNowKg: 80.3, weeks: 10, units: 'kg' })
    expect(text).toContain('Hip thrust +12%')
    expect(text).toContain('hips +2 cm')
    expect(text).toContain('waist steady')
    expect(text).toContain('recomp is working')
  })
})

describe('eatingTimeline', () => {
  it('covers 24 h with meals and the treat', () => {
    const segs = eatingTimeline(['15:45', '18:30'])
    expect(segs[0].startH).toBe(0)
    expect(segs[segs.length - 1].endH).toBe(24)
    expect(segs.filter(s => s.kind === 'meal').length).toBe(2)
    expect(segs.some(s => s.kind === 'treat')).toBe(true)
    for (let i = 1; i < segs.length; i++) expect(segs[i].startH).toBeCloseTo(segs[i - 1].endH)
  })
})
