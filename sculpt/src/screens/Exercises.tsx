import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Input, PageHeader, Pill } from '../components/ui'
import { IconChevronRight, IconDumbbell } from '../components/ui/Icons'
import { EXERCISES, EQUIPMENT_LABELS, MUSCLE_LABELS } from '../data/exercises'
import { useProgram } from '../hooks/useSettings'
import { haptic } from '../lib/haptics'
import type { ExerciseDef, GoalTag, ProgramDay } from '../db/types'
import { ExerciseAnimation } from '../components/anatomy/ExerciseAnimation'

type GoalFilter = 'all' | GoalTag
const GOALS: { value: GoalFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'glutes', label: '🍑 Glutes' }, { value: 'upper', label: 'Upper' }, { value: 'legStrength', label: 'Leg strength' }, { value: 'power', label: 'Power' },
]
const FOCUS_TONE: Record<ProgramDay['focus'], 'accent' | 'upper' | 'gold' | 'good' | 'default'> = { glutes: 'accent', power: 'gold', push: 'upper', pull: 'upper', upper: 'upper', rest: 'good' }

export default function Exercises() {
  const program = useProgram()
  const [q, setQ] = useState('')
  const [goal, setGoal] = useState<GoalFilter>('all')
  const [day, setDay] = useState<string>('all')

  const days = useMemo(() => (program?.days ?? []).map((d, i) => ({ ...d, index: i })).filter(d => d.exercises.length > 0), [program])
  const inProgram = useMemo(() => new Set(days.flatMap(d => d.exercises.map(e => e.exerciseId))), [days])

  const matches = (e: ExerciseDef) => {
    if (goal !== 'all' && e.goalTag !== goal) return false
    if (!q.trim()) return true
    const hay = `${e.name} ${e.shortName} ${e.primary.map(m => MUSCLE_LABELS[m]).join(' ')} ${e.equipment.map(x => EQUIPMENT_LABELS[x]).join(' ')}`.toLowerCase()
    return q.toLowerCase().split(/\s+/).every(w => hay.includes(w))
  }

  if (!program) return <div className="page" />

  const groups = days
    .filter(d => day === 'all' || d.id === day)
    .map(d => ({ day: d, items: d.exercises.map(pe => EXERCISES.find(e => e.id === pe.exerciseId)).filter((e): e is ExerciseDef => !!e && matches(e)) }))
    .filter(g => g.items.length > 0)
  const alternatives = day === 'all' ? EXERCISES.filter(e => !inProgram.has(e.id) && matches(e)) : []
  const total = groups.reduce((n, g) => n + g.items.length, 0) + alternatives.length

  return (
    <div className="page stack-lg">
      <PageHeader eyebrow="Library" title="Exercises" subtitle={`${EXERCISES.length} moves, every one animated. Tap for cues, mistakes and your numbers.`} />

      <div className="stack">
        <Input type="search" placeholder="Search moves, muscles, equipment…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chip-row">
          {GOALS.map(g => (
            <button key={g.value} className={`chip ${goal === g.value ? (g.value === 'upper' ? 'chip--on-upper' : 'chip--on') : ''}`} onClick={() => { haptic.tap(); setGoal(g.value) }}>{g.label}</button>
          ))}
        </div>
        <div className="chip-row">
          <button className={`chip ${day === 'all' ? 'chip--on' : ''}`} onClick={() => { haptic.tap(); setDay('all') }}>Every day</button>
          {days.map(d => (
            <button key={d.id} className={`chip ${day === d.id ? 'chip--on' : ''}`} onClick={() => { haptic.tap(); setDay(d.id) }}>Day {d.index + 1} · {d.name}</button>
          ))}
        </div>
      </div>

      {total === 0 && <Empty icon={<IconDumbbell size={28} />} title="Nothing matches" body="Try a different word or clear the filters." />}

      {groups.map(g => (
        <section key={g.day.id} className="stack" style={{ gap: 6 }}>
          <div className="row-between" style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg)', padding: '10px 0 6px', marginTop: -6 }}>
            <div>
              <div className="eyebrow">Day {g.day.index + 1}</div>
              <h2 className="subtitle">{g.day.name}</h2>
            </div>
            <Pill tone={FOCUS_TONE[g.day.focus]}>{g.items.length} moves</Pill>
          </div>
          <div className="stagger">
            {g.items.map(e => <Row key={e.id} ex={e} />)}
          </div>
        </section>
      ))}

      {alternatives.length > 0 && (
        <section className="stack" style={{ gap: 6 }}>
          <div className="row-between" style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg)', padding: '10px 0 6px', marginTop: -6 }}>
            <div>
              <div className="eyebrow">Not in your program</div>
              <h2 className="subtitle">Alternatives</h2>
            </div>
            <Pill>{alternatives.length} moves</Pill>
          </div>
          <div className="stagger">
            {alternatives.map(e => <Row key={e.id} ex={e} />)}
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ ex }: { ex: ExerciseDef }) {
  const lower = ex.goalTag !== 'upper'
  return (
    <Link to={`/exercises/${ex.id}`} className="card card--interactive row" style={{ padding: 10, marginBottom: 8, gap: 12 }} onClick={() => haptic.tap()}>
      <ExerciseAnimation exerciseId={ex.id} size={72} playing highlight />
      <div className="grow stack" style={{ gap: 4 }}>
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15 }}>{ex.name}</div>
        <div className="small" style={{ color: lower ? 'var(--accent)' : 'var(--accent-2)', fontWeight: 600 }}>{ex.primary.map(m => MUSCLE_LABELS[m]).join(' · ')}</div>
        <div className="row" style={{ gap: 6 }}>
          <Pill>{EQUIPMENT_LABELS[ex.equipment[0]]}</Pill>
          {ex.unilateral && <Pill>Each side</Pill>}
        </div>
      </div>
      <IconChevronRight size={22} />
    </Link>
  )
}
