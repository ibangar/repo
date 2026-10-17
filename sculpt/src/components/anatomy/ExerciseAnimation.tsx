/** STUB – replaced by the anatomy module. Keep this prop interface. */
export interface ExerciseAnimationProps {
  exerciseId: string
  /** px; the component is square */
  size?: number
  playing?: boolean
  /** show the muscle-highlight glow */
  highlight?: boolean
  className?: string
}
export function ExerciseAnimation({ size = 160, className = '' }: ExerciseAnimationProps) {
  return <div className={className} style={{ width: size, height: size, borderRadius: 16, background: 'var(--surface-2)' }} />
}
export default ExerciseAnimation
