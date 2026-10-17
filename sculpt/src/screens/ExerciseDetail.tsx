import { useParams } from 'react-router-dom'
import { PageHeader } from '../components/ui'
import { getExercise } from '../data/exercises'
import { Figure } from '../components/anatomy/Figure'
import { getAnimation, glowAt, poseAt } from '../components/anatomy/animations'
import { ExerciseAnimation } from '../components/anatomy/ExerciseAnimation'
import type { MuscleGroup } from '../db/types'

export default function ExerciseDetail() {
  const { id = '' } = useParams()
  const ex = getExercise(id)
  const sheet = import.meta.env.DEV && new URLSearchParams(window.location.search).get('sheet')
  if (sheet) {
    const def = getAnimation(ex.animation)
    const hl: Partial<Record<MuscleGroup, number>> = {}
    for (const p of ex.primary) hl[p] = 1
    for (const s of ex.secondary) hl[s] = Math.max(hl[s] ?? 0, 0.45)
    const ts = [0, 0.15, 0.3, 0.45, 0.6, 0.85]
    return (
      <div className="page" style={{ padding: 8 }}>
        <div className="small" style={{ marginBottom: 4 }}>{ex.name} · {def.view}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {ts.map(t => (
            <div key={t} style={{ background: 'var(--surface-2)', borderRadius: 12, position: 'relative' }}>
              <Figure pose={poseAt(def, t)} view={def.view} highlight={hl} glow={glowAt(def, t)} equipment={def.equipment} anchor={def.anchor} anchorY={def.anchorY} shadow style={{ width: '100%' }} />
              <span className="tiny" style={{ position: 'absolute', left: 6, top: 4 }}>t={t}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="page">
      <PageHeader back title={ex.name} />
      <ExerciseAnimation exerciseId={ex.id} size={320} fluid showLabels />
    </div>
  )
}
