import { useEffect, useState } from 'react'
import { isoDate, scheduleFor, type ScheduleInfo } from '../engine/schedule'
import { useProgram, useSettings } from './useSettings'

/** Local ISO date that updates when the day rolls over. */
export function useTodayDate(): string {
  const [d, setD] = useState(isoDate())
  useEffect(() => {
    const id = setInterval(() => { const n = isoDate(); if (n !== d) setD(n) }, 30_000)
    const onVis = () => { const n = isoDate(); if (n !== d) setD(n) }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [d])
  return d
}

export function useSchedule(date?: string): (ScheduleInfo & { date: string }) | undefined {
  const today = useTodayDate()
  const settings = useSettings()
  const program = useProgram()
  const d = date ?? today
  if (!settings || !program) return undefined
  return { date: d, ...scheduleFor(d, settings, program) }
}
