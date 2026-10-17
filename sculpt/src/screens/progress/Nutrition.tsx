import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { db } from '../../db/schema'
import { useSettings, updateSettings } from '../../hooks/useSettings'
import { useTodayDate } from '../../hooks/useToday'
import { proteinTargets, CHOCOLATE } from '../../engine/nutrition'
import { isStalled, maintenanceEstimate, weeklyWeights, weightTrend } from '../../engine/trends'
import { addDays } from '../../engine/schedule'
import { EXERCISE_MAP } from '../../data/exercises'
import { AnimatedNumber, Button, Card, Input, PageHeader, Pill, Stepper } from '../../components/ui'
import { IconFork, IconInfo, IconX, IconZap } from '../../components/ui/Icons'
import { EatingTimeline } from '../../components/progress/EatingTimeline'
import { NutritionChecklist } from '../../components/NutritionChecklist'
import { haptic } from '../../lib/haptics'
import { mondayOf, STALL_LIFTS } from '../../lib/stats'

export default function Nutrition() {
  const settings = useSettings()
  const today = useTodayDate()
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), [])
  const states = useLiveQuery(() => db.exerciseStates.toArray(), [])
  const recentDays = useLiveQuery(() => db.nutrition.where('date').between(addDays(today, -7), today, true, true).toArray(), [today])

  if (!settings || !weights || !states || !recentDays) return <div className="page" />
  const units = settings.units

  const targets = proteinTargets(settings.bodyweightKg, settings.proteinPerKg)
  const wt = weightTrend(weeklyWeights(weights))
  const maint = maintenanceEstimate(settings.bodyweightKg, settings.typicalIntakeKcal, wt.slopeKgPerWeek)

  // ── fasted-training stall prompt ──
  const stalled = STALL_LIFTS.map(id => states.find(s => s.exerciseId === id)).filter((s): s is NonNullable<typeof s> => !!s && isStalled(s, today))
  const fastedWeek = recentDays.length ? recentDays.every(d => d.trainedFasted) : settings.trainsFasted
  const stallKey = `stall-${mondayOf(today)}`
  const showStall = stalled.length >= 2 && fastedWeek && !settings.dismissedPrompts[stallKey]

  return (
    <div className="page stack-lg">
      <PageHeader back="/progress" eyebrow="Nutrition" title="Fuel the recomp" />

      <div className="stagger stack-lg">
        <AnimatePresence>
          {showStall && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <Card upper glow>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none', background: 'var(--accent-2-soft)', color: 'var(--accent-2)' }}><IconZap size={20} /></span>
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>Stalled while training fasted</div>
                    <p className="body" style={{ marginTop: 4 }}>Your main lifts have stalled 3+ weeks while training fasted. Try moving training closer to Meal 1, or add 20–30 g protein 60 min before.</p>
                    <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                      {stalled.map(s => <Pill key={s.exerciseId} tone="upper">{EXERCISE_MAP[s.exerciseId]?.shortName ?? s.exerciseId}</Pill>)}
                    </div>
                  </div>
                  <button aria-label="Dismiss" style={{ color: 'var(--muted)', minWidth: 36, minHeight: 36, display: 'grid', placeItems: 'center' }}
                    onClick={() => { haptic.tap(); void updateSettings({ dismissedPrompts: { ...settings.dismissedPrompts, [stallKey]: today } }) }}><IconX size={18} /></button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Protein ── */}
        <Card glow upper>
          <div className="eyebrow">Protein target</div>
          <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
            <AnimatedNumber value={targets.dailyG} className="title-xl gradient-text--upper" />
            <span className="subtitle muted">g / day</span>
          </div>
          <div className="small" style={{ marginTop: 4 }}>Range {targets.rangeLowG}–{targets.rangeHighG} g · {targets.perKg.toFixed(1)} g per kg of {settings.bodyweightKg} kg</div>
          <div className="grid-2" style={{ marginTop: 14 }}>
            {[0, 1].map(i => (
              <div key={i} style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)' }}>
                <div className="row tiny" style={{ gap: 6 }}><IconFork size={12} /> Meal {i + 1} · {settings.mealTimes[i]}</div>
                <div className="num" style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{targets.perMealG} <span className="small">g</span></div>
              </div>
            ))}
          </div>
          <div className="row-between" style={{ marginTop: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Multiplier</div>
              <div className="tiny">1.6 lean floor · 2.2 upper end</div>
            </div>
            <Stepper value={settings.proteinPerKg} step={0.1} decimals={1} min={1.6} max={2.2} suffix="g/kg" onChange={v => { if (v != null) void updateSettings({ proteinPerKg: v }) }} />
          </div>
          <div className="row tiny" style={{ marginTop: 10, gap: 6 }}><IconInfo size={12} /> Recalculates automatically when you log a new weight.</div>
        </Card>

        {/* ── Eating pattern ── */}
        <Card>
          <div className="eyebrow">Eating pattern</div>
          <div className="subtitle" style={{ margin: '2px 0 12px' }}>Fast, train, two meals, chocolate</div>
          <EatingTimeline mealTimes={settings.mealTimes} />
          <div className="row" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--gold-soft)', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20, lineHeight: 1.2 }}>🍫</span>
            <p className="body" style={{ color: 'var(--text)' }}><b>{CHOCOLATE.label}</b> after dinner is in the plan. Enjoy it. <span className="small">≈ {CHOCOLATE.kcal} kcal, already counted.</span></p>
          </div>
        </Card>

        {/* ── Checklist ── */}
        <NutritionChecklist date={today} />

        {/* ── Maintenance ── */}
        <MaintenanceCard kcal={maint.kcal} basis={maint.basis} dailyBalance={maint.dailyBalance} typical={settings.typicalIntakeKcal} units={units} weeks={weeklyWeights(weights).length} />
      </div>
    </div>
  )
}

function MaintenanceCard({ kcal, basis, dailyBalance, typical, weeks }: { kcal: number; basis: 'heuristic' | 'trend'; dailyBalance: number; typical?: number; units: 'kg' | 'lb'; weeks: number }) {
  const [text, setText] = useState(typical ? String(typical) : '')
  useEffect(() => { setText(typical ? String(typical) : '') }, [typical])
  const commit = () => {
    const n = parseInt(text, 10)
    if (!text.trim()) { void updateSettings({ typicalIntakeKcal: undefined }); return }
    if (Number.isNaN(n) || n < 800) return
    haptic.tap()
    void updateSettings({ typicalIntakeKcal: n })
  }
  const balanceText = Math.abs(dailyBalance) < 40
    ? 'Your weight trend is flat – you are eating at maintenance.'
    : `Your trend suggests ≈ ${dailyBalance > 0 ? '+' : '−'}${Math.abs(dailyBalance)} kcal/day ${dailyBalance > 0 ? 'over' : 'under'} maintenance.`
  return (
    <Card>
      <div className="row-between">
        <div className="eyebrow">Maintenance calories</div>
        <Pill>{basis === 'trend' ? 'adjusted from your weight trend' : 'rule of thumb'}</Pill>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <AnimatedNumber value={kcal} className="title-lg" />
        <span className="subtitle muted">kcal / day</span>
      </div>
      <p className="small" style={{ marginTop: 4 }}>
        {basis === 'heuristic'
          ? 'Roughly 31 kcal per kg for someone lifting most days. Tell me what you typically eat and I\'ll refine it from your weigh-ins.'
          : weeks >= 4 ? balanceText : `${balanceText} A few more weeks of weigh-ins will sharpen this.`}
      </p>
      <div className="mt-16">
        <label className="field">
          <span className="label">What you typically eat (kcal/day) <span className="tiny">optional</span></span>
          <div className="row">
            <Input inputMode="numeric" placeholder="e.g. 2400" value={text} onChange={e => setText(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            <Button variant="subtle" onClick={commit}>Save</Button>
          </div>
        </label>
      </div>
    </Card>
  )
}
