import type { MuscleGroup, View } from '../../db/types'
/** STUB – replaced by the anatomy module. Keep this prop interface. */
export interface BodyMapProps {
  primary: MuscleGroup[]
  secondary?: MuscleGroup[]
  /** 'both' renders front + back side by side */
  view?: View | 'both'
  /** height in px */
  height?: number
  className?: string
}
export function BodyMap({ height = 220, className = '' }: BodyMapProps) {
  return <div className={className} style={{ height, borderRadius: 16, background: 'var(--surface-2)' }} />
}
export default BodyMap
