import type { Program, ProgramDay, Settings } from '../db/types'

export const DAY_MS = 86_400_000

/** Local YYYY-MM-DD for a Date. */
export function isoDate(d: Date = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso); d.setDate(d.getDate() + n); return isoDate(d)
}

/** Whole days from a → b (local). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / DAY_MS)
}

export interface ScheduleInfo {
  /** 0–6 index into program.days */
  dayIndex: number
  day: ProgramDay
  /** 1-based training week. */
  weekNumber: number
  isDeload: boolean
  /** Week 1 = calibration. */
  isCalibrationWeek: boolean
  /** Days until the next deload week starts (0 = this week). */
  weeksToDeload: number
}

/**
 * Which program day falls on `date`. The schedule is a rolling 7-day cycle from
 * programStartDate, shifted forward by scheduleOffset days (missed-day handling).
 */
export function scheduleFor(date: string, settings: Pick<Settings, 'programStartDate' | 'scheduleOffset' | 'deloadEvery'>, program: Program): ScheduleInfo {
  const raw = daysBetween(settings.programStartDate, date) - settings.scheduleOffset
  const n = Math.max(0, raw)
  const dayIndex = ((n % 7) + 7) % 7
  const weekNumber = Math.floor(n / 7) + 1
  const every = Math.min(8, Math.max(6, settings.deloadEvery || 7))
  const isDeload = weekNumber % every === 0
  const weeksToDeload = isDeload ? 0 : every - (weekNumber % every)
  return { dayIndex, day: program.days[dayIndex], weekNumber, isDeload, isCalibrationWeek: weekNumber === 1, weeksToDeload }
}

/** Shift the whole schedule forward by one day (you missed today – do it tomorrow). */
export function shiftForward(settings: Settings, days = 1): Settings {
  return { ...settings, scheduleOffset: settings.scheduleOffset + days }
}

/** Upcoming days for the Today screen's week strip. */
export function upcoming(startDate: string, settings: Settings, program: Program, count = 7): (ScheduleInfo & { date: string })[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(startDate, i)
    return { date, ...scheduleFor(date, settings, program) }
  })
}
