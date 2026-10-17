import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { db } from '../../db/schema'
import type { ExerciseState } from '../../db/types'
import { EXERCISE_MAP } from '../../data/exercises'
import { formatLoad } from '../../engine/units'
import { useProgram, useSettings } from '../../hooks/useSettings'
import { useTodayDate } from '../../hooks/useToday'
import { AnimatedNumber, Card, PageHeader, Pill } from '../../components/ui'
import { IconBody, IconChevronRight, IconFlame, IconFork, IconCalendar, IconTrophy, IconZap } from '../../components/ui/Icons'
import { Heatmap } from '../../components/progress/Heatmap'
import { LiftChart } from '../../components/progress/LiftChart'
import { VolumeRows, GROUP_COLOR } from '../../components/progress/VolumeRows'
import { PRList } from '../../components/progress/PRList'
import { C } from '../../components/progress/chart'
import { haptic } from '../../lib/haptics'
import { fourWeekChange, heatmapCells, KEY_LIFTS, liftSeries, streakStats, VOLUME_GROUPS, weeklyVolume } from '../../lib/stats'

const SHORT_GROUP: Record<string, string> = { chest: 'Chest', delts: 'Delts', back: 'Back', arms: 'Arms', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hams' }

export default function Progress() {
  const settings = useSettings()
  const program = useProgram()
  const today = useTodayDate()
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').toArray(), [])
  const states = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const prs = useLiveQuery(() => db.prs.toArray(), [])

  if (!settings || !program || !sessions || !states || !prs) return <div className="page" />

  const units = settings.units
  const streak = streakStats(sessions, settings, program, today)
  const heat = heatmapCells(sessions, today, 12)
  const weeks = weeklyVolume(sessions, today, 8)
  const thisWeek = weeks[weeks.length - 1]
  const quadsLow = thisWeek.volume.quads < thisWeek.volume.glutes
  const weekComplete = (new Date().getDay() + 6) % 7 === 6 // Sunday

  return (
    <div className="page stack-lg">
      <PageHeader eyebrow={`${settings.name ? `${settings.name}'s` : 'Your'} numbers`} title="Progress" big right={
        streak.streak >= 3 ? <Pill tone="accent"><IconFlame size={14} /> {streak.streak}-day streak</Pill> : undefined
      } />

      <div className="chip-row" style={{ marginTop: -8 }}>
        <Link className="chip row" style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }} to="/progress/body"><IconBody size={16} /> Body</Link>
        <Link className="chip row" style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }} to="/progress/nutrition"><IconFork size={16} /> Nutrition</Link>
        <Link className="chip row" style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }} to="/progress/checkin"><IconCalendar size={16} /> 8–12 week check-in</Link>
      </div>

      <div className="stagger stack-lg">
        {/* ── Streak + heatmap ── */}
        <Card glow>
          <div className="grid-3" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="stat__v row" style={{ gap: 4, color: streak.streak > 0 ? 'var(--accent)' : undefined }}>
                <AnimatedNumber value={streak.streak} />
                {streak.streak > 0 && <IconFlame size={20} />}
              </div>
              <div className="stat__l">Day streak</div>
            </div>
            <div className="stat">
              <div className="stat__v"><AnimatedNumber value={streak.totalWorkouts} /></div>
              <div className="stat__l">Workouts</div>
            </div>
            <div className="stat">
              <div className="stat__v num">{streak.weekDone}<span className="muted" style={{ fontSize: 16 }}>/{streak.weekPlanned}</span></div>
              <div className="stat__l">This week</div>
            </div>
          </div>
          <Heatmap cells={heat} today={today} />
          <div className="row-between" style={{ marginTop: 10 }}>
            <span className="tiny">Last 12 weeks</span>
            <span className="row tiny" style={{ gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--surface-3)' }} /> rest / missed
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent)', marginLeft: 6 }} /> trained
            </span>
          </div>
        </Card>

        {/* ── e1RM ── */}
        <LiftCard states={states} units={units} today={today} />

        {/* ── Weekly volume ── */}
        <Card>
          <div style={{ marginBottom: 4 }}>
            <div className="eyebrow">Weekly volume</div>
            <div className="subtitle" style={{ marginTop: 2 }}>Per muscle group · 8 weeks</div>
            <div className="tiny" style={{ marginTop: 2 }}>sets × reps × load, in {units}. Week runs Mon–Sun.</div>
          </div>
          <div style={{ marginTop: 10 }}>
            <VolumeRows weeks={weeks} units={units} weekComplete={weekComplete} />
          </div>
          {quadsLow && (
            <div className="row tiny" style={{ marginTop: 10, gap: 6, color: 'var(--text-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLOR.quads }} /> Quads kept low on purpose – strong legs, not bigger legs.
            </div>
          )}
          <div className="divider" style={{ margin: '14px 0 10px' }} />
          <div className="eyebrow" style={{ marginBottom: 8 }}>Hard sets this week</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {VOLUME_GROUPS.map(g => (
              <div key={g} className="center" style={{ padding: '8px 2px', borderRadius: 10, background: g === 'glutes' ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                <div className="num" style={{ fontWeight: 900, fontSize: 18, color: g === 'glutes' ? 'var(--accent)' : undefined }}>{thisWeek.hardSets[g]}</div>
                <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{SHORT_GROUP[g]}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── PRs ── */}
        <Card>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div>
              <div className="eyebrow">PR history</div>
              <div className="subtitle row" style={{ marginTop: 2, gap: 6 }}><IconTrophy size={18} style={{ color: 'var(--gold)' }} /> {prs.length} personal record{prs.length === 1 ? '' : 's'}</div>
            </div>
          </div>
          <PRList prs={prs} />
        </Card>

        <Link to="/progress/checkin" className="card card--interactive row" style={{ display: 'flex' }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--accent-2-soft)', color: 'var(--accent-2)' }}><IconZap size={20} /></span>
          <span className="grow"><span style={{ display: 'block', fontWeight: 800 }}>8–12 week check-in</span><span className="small">Start vs now: photos, lifts, tape, weight</span></span>
          <IconChevronRight size={20} style={{ color: 'var(--muted)' }} />
        </Link>
      </div>
    </div>
  )
}

function LiftCard({ states, units, today }: { states: ExerciseState[]; units: 'kg' | 'lb'; today: string }) {
  const withHistory = useMemo(() => {
    const byId = new Map(states.map(s => [s.exerciseId, s]))
    const key = KEY_LIFTS.filter(id => (byId.get(id)?.history.length ?? 0) > 0)
    const rest = states.filter(s => s.history.length > 0 && !KEY_LIFTS.includes(s.exerciseId) && EXERCISE_MAP[s.exerciseId])
      .sort((a, b) => b.history.length - a.history.length).map(s => s.exerciseId)
    return [...key, ...rest].map(id => byId.get(id)!)
  }, [states])
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { if (!sel && withHistory.length) setSel(withHistory[0].exerciseId) }, [withHistory, sel])
  const state = withHistory.find(s => s.exerciseId === sel) ?? withHistory[0]

  if (!state) {
    return (
      <Card>
        <div className="eyebrow">Estimated 1RM</div>
        <p className="body mt-8">Finish a couple of sessions and your strength curves show up here.</p>
      </Card>
    )
  }
  const def = EXERCISE_MAP[state.exerciseId]
  const { points, isLoadOnly } = liftSeries(state)
  const best = points.length ? Math.max(...points.map(p => p.value)) : null
  const change = fourWeekChange(points, today)
  const glute = def.goalTag === 'glutes'
  const color = glute ? C.pink : def.goalTag === 'power' ? C.gold : C.violet
  const fmtVal = (v: number | null) => (v == null ? '—' : state.loadMode === 'height' ? `${Math.round(v)} cm` : formatLoad(v, units))
  const loadLabel = state.loadMode === 'height' ? 'Box height' : state.loadMode === 'bell' ? 'Bell' : state.loadMode === 'assisted' ? 'Assist' : state.loadMode === 'added' ? 'Added load' : 'Working load'

  return (
    <Card glow upper={!glute}>
      <div className="row-between">
        <div>
          <div className="eyebrow">{isLoadOnly ? (state.loadMode === 'height' ? 'Box height' : 'Bell weight') : 'Estimated 1RM'}</div>
          <div className="subtitle" style={{ marginTop: 2 }}>{def.name}</div>
        </div>
        {change != null && (
          <Pill tone={change > 0 ? 'good' : change < 0 ? 'bad' : 'default'}>{change > 0 ? '+' : ''}{change}% · 4 wk</Pill>
        )}
      </div>
      <div className="chip-row" style={{ margin: '12px 0 4px' }}>
        {withHistory.map(s => {
          const d = EXERCISE_MAP[s.exerciseId]
          const on = s.exerciseId === state.exerciseId
          return (
            <button key={s.exerciseId} className={`chip ${on ? (d.goalTag === 'glutes' ? 'chip--on' : 'chip--on-upper') : ''}`} onClick={() => { haptic.tap(); setSel(s.exerciseId) }}>{d.shortName}</button>
          )
        })}
      </div>
      <motion.div key={state.exerciseId} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {points.length >= 2 ? (
          <LiftChart points={points} units={units} loadMode={state.loadMode} color={color} />
        ) : (
          <p className="body" style={{ padding: '24px 0' }}>One session logged – a second point draws the line.</p>
        )}
      </motion.div>
      <div className="grid-3" style={{ marginTop: 8 }}>
        <div className="stat"><div className="stat__v num" style={{ fontSize: 20 }}>{fmtVal(state.currentLoad)}</div><div className="stat__l">{loadLabel}</div></div>
        <div className="stat"><div className="stat__v num" style={{ fontSize: 20, color: 'var(--gold)' }}>{fmtVal(best)}</div><div className="stat__l">{isLoadOnly ? 'Best' : 'Best e1RM'}</div></div>
        <div className="stat"><div className="stat__v num" style={{ fontSize: 20, color: change == null ? 'var(--muted)' : change >= 0 ? 'var(--good)' : 'var(--bad)' }}>{change == null ? '—' : `${change > 0 ? '+' : ''}${change}%`}</div><div className="stat__l">Last 4 weeks</div></div>
      </div>
    </Card>
  )
}
