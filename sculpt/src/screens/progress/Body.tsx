import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { db } from '../../db/schema'
import type { Measurement } from '../../db/types'
import { useSettings, updateSettings } from '../../hooks/useSettings'
import { useTodayDate } from '../../hooks/useToday'
import { trendLine, weeklyWeights, weightTrend, MEASURE_KEYS, MEASURE_LABELS, type MeasureKey } from '../../engine/trends'
import { CM_PER_IN, fromDisplay, toDisplay } from '../../engine/units'
import { daysBetween } from '../../engine/schedule'
import { AnimatedNumber, Button, Card, Field, PageHeader, Pill, Sheet, Stepper } from '../../components/ui'
import { IconPlus, IconScale, IconArrowUp, IconArrowDown, IconMinus } from '../../components/ui/Icons'
import { WeightChart } from '../../components/progress/WeightChart'
import { GoalsCard, fmtLen } from '../../components/progress/GoalsCard'
import { fmtDate, relativeDay } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { uid } from '../../lib/ids'
import { DAY_NAMES, goalRows, weighInStatus } from '../../lib/stats'

export default function Body() {
  const settings = useSettings()
  const today = useTodayDate()
  const weights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), [])
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').reverse().toArray(), [])
  const [logOpen, setLogOpen] = useState(false)
  const [measureOpen, setMeasureOpen] = useState(false)

  if (!settings || !weights || !measurements) return <div className="page" />
  const units = settings.units
  const lenUnit = units === 'kg' ? 'cm' : 'in'

  const last = weights[weights.length - 1]
  const currentKg = last?.kg ?? settings.bodyweightKg
  const weekly = weeklyWeights(weights).slice(-16)
  const trend = trendLine(weekly.map(w => ({ kg: w.avgKg })))
  const wt = weightTrend(weeklyWeights(weights))
  const status = weighInStatus(settings, weights, today)
  const prevWeek = weekly.length >= 2 ? weekly[weekly.length - 2].avgKg : null
  const weekDelta = prevWeek != null ? Math.round(toDisplay(weekly[weekly.length - 1].avgKg - prevWeek, units) * 10) / 10 : null

  const latestM = measurements[0]
  const firstM = measurements[measurements.length - 1]
  const rows = goalRows(firstM, latestM)
  const measureDue = !latestM || daysBetween(latestM.date, today) > 14

  return (
    <div className="page stack-lg">
      <PageHeader back="/progress" eyebrow="Body" title="Weight & tape" />

      <div className="stagger stack-lg">
        {/* ── Weigh-in ── */}
        <Card glow>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <div className="eyebrow">Weekly weigh-in</div>
              <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <AnimatedNumber value={toDisplay(currentKg, units)} decimals={1} className="title-xl" />
                <span className="subtitle muted">{units}</span>
              </div>
              <div className="small" style={{ marginTop: 4 }}>
                {last ? `Logged ${loggedWhen(last.date, today)}` : 'No weigh-ins yet'}
                {weekDelta != null && <div className="num" style={{ color: Math.abs(weekDelta) < 0.2 ? 'var(--muted)' : 'var(--text-2)' }}>{weekDelta > 0 ? '+' : ''}{weekDelta} {units} vs last week's average</div>}
              </div>
            </div>
            <Button variant="primary" size="sm" style={{ whiteSpace: 'nowrap', flex: 'none' }} onClick={() => setLogOpen(true)}><IconPlus size={16} /> Log weight</Button>
          </div>
          <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {status.doneThisWeek
              ? <Pill tone="good">This week's weigh-in done · next {fmtDate(status.nextDate, { weekday: 'short', day: 'numeric', month: 'short' })}</Pill>
              : status.dueToday ? <Pill tone="accent"><IconScale size={13} /> Weigh-in due today, {String(settings.weighInHour).padStart(2, '0')}:00</Pill>
              : status.overdue ? <Pill tone="gold"><IconScale size={13} /> Weigh-in due – was {DAY_NAMES[settings.weighInDay]}</Pill>
              : <Pill><IconScale size={13} /> Next weigh-in {DAY_NAMES[settings.weighInDay]} {String(settings.weighInHour).padStart(2, '0')}:00</Pill>}
          </div>
          {weekly.length >= 2 ? (
            <div style={{ marginTop: 12 }}>
              <WeightChart weekly={weekly} trend={trend} units={units} />
              <div className="row tiny" style={{ gap: 12, marginTop: 4, justifyContent: 'center' }}>
                <span className="row" style={{ gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent)' }} /> weekly average</span>
                <span className="row" style={{ gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent-2)' }} /> trend</span>
              </div>
            </div>
          ) : <p className="body" style={{ marginTop: 12 }}>Two weeks of weigh-ins draw the trend line.</p>}
        </Card>

        {/* ── Lean-recomp alert ── */}
        <AnimatePresence>
          {wt.alert && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card style={{ borderColor: wt.alert === 'trimPortions' ? 'rgba(255,181,71,0.35)' : 'rgba(139,108,255,0.35)' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none', background: wt.alert === 'trimPortions' ? 'var(--gold-soft)' : 'var(--accent-2-soft)', color: wt.alert === 'trimPortions' ? 'var(--gold)' : 'var(--accent-2)' }}>
                    {wt.alert === 'trimPortions' ? <IconArrowUp size={20} /> : <IconArrowDown size={20} />}
                  </span>
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>{wt.alert === 'trimPortions' ? 'Trending up 3 weeks running' : 'Trending down 3 weeks straight'}</div>
                    <p className="body" style={{ marginTop: 4 }}>
                      {wt.alert === 'trimPortions'
                        ? "Weight has trended up 3 weeks running. Trim portions a touch – you're recomping, not bulking."
                        : 'Down 3 weeks straight – eat a little more so the glutes have something to grow with.'}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Goals ── */}
        <Card>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div>
              <div className="eyebrow">Goals</div>
              <div className="subtitle" style={{ marginTop: 2 }}>{measurements.length >= 2 ? `First tape → latest (${measurements.length} entries)` : 'Tape measurements'}</div>
            </div>
            {measureDue && <Pill tone="accent">Next measure due</Pill>}
          </div>
          {measurements.length >= 2
            ? <GoalsCard rows={rows} units={units} />
            : <p className="body" style={{ margin: '8px 0 4px' }}>Measure every 2–4 weeks. Two entries and the arrows appear: glutes/hips up, chest/shoulders/arm up, waist steady, thigh roughly the same.</p>}
        </Card>

        {/* ── Measurements list ── */}
        <Card>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div className="eyebrow">Tape measurements</div>
            <Button size="sm" variant="upper" onClick={() => setMeasureOpen(true)}><IconPlus size={16} /> Measure</Button>
          </div>
          {measurements.length === 0 && <p className="body" style={{ margin: '8px 0 4px' }}>Relaxed, same time of day, tape snug not tight.</p>}
          {measurements.map((m, i) => <MeasurementRow key={m.id} m={m} prev={measurements[i + 1]} units={units} />)}
        </Card>
      </div>

      <LogWeightSheet open={logOpen} onClose={() => setLogOpen(false)} units={units} defaultKg={currentKg} today={today} />
      <MeasureSheet open={measureOpen} onClose={() => setMeasureOpen(false)} units={units} lenUnit={lenUnit} last={latestM} today={today} />
    </div>
  )
}

function loggedWhen(iso: string, today: string): string {
  const r = relativeDay(iso, today)
  return r === 'Today' || r === 'Yesterday' ? r.toLowerCase() : r
}

function MeasurementRow({ m, prev, units }: { m: Measurement; prev?: Measurement; units: 'kg' | 'lb' }) {
  const [open, setOpen] = useState(false)
  const keys = MEASURE_KEYS.filter(k => m[k] != null)
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <button className="row-between" style={{ width: '100%', textAlign: 'left', minHeight: 36 }} onClick={() => { haptic.tap(); setOpen(o => !o) }}>
        <span style={{ fontWeight: 800 }}>{fmtDate(m.date)}</span>
        <span className="small num">
          {m.hips != null && <span style={{ color: 'var(--accent)', fontWeight: 700 }}>hips {fmtLen(m.hips, units)}</span>}
          {m.waist != null && <span style={{ marginLeft: 10 }}>waist {fmtLen(m.waist, units)}</span>}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, paddingBottom: 4 }}>
              {keys.map(k => {
                const d = prev?.[k] != null ? Math.round((m[k]! - prev[k]!) * 10) / 10 : null
                const Arrow = d == null || Math.abs(d) < 0.3 ? IconMinus : d > 0 ? IconArrowUp : IconArrowDown
                return (
                  <div key={k} style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2)' }}>
                    <div className="tiny">{MEASURE_LABELS[k]}</div>
                    <div className="num" style={{ fontWeight: 800, fontSize: 15 }}>{fmtLen(m[k]!, units)}</div>
                    {d != null && <div className="tiny row num" style={{ gap: 2 }}><Arrow size={10} /> {Math.abs(d)}</div>}
                  </div>
                )
              })}
            </div>
            {m.note && <div className="small">{m.note}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LogWeightSheet({ open, onClose, units, defaultKg, today }: { open: boolean; onClose: () => void; units: 'kg' | 'lb'; defaultKg: number; today: string }) {
  const [val, setVal] = useState<number | null>(null)
  const shown = val ?? Math.round(toDisplay(defaultKg, units) * 10) / 10
  const save = async () => {
    const kg = Math.round(fromDisplay(shown, units) * 100) / 100
    const existing = await db.bodyWeights.where('date').equals(today).first()
    await db.bodyWeights.put({ id: existing?.id ?? uid(), date: today, kg })
    await updateSettings({ bodyweightKg: kg })
    haptic.success()
    setVal(null)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Log weight">
      <div className="stack-lg">
        <p className="body">Same scale, same time, after the bathroom. Protein targets recalculate from this number.</p>
        <Field label={`Weight (${units})`}>
          <Stepper value={shown} onChange={v => setVal(v ?? shown)} step={0.1} decimals={1} min={30} max={300} suffix={units} />
        </Field>
        <Button variant="primary" size="lg" block onClick={save}>Save {shown.toFixed(1)} {units}</Button>
      </div>
    </Sheet>
  )
}

function MeasureSheet({ open, onClose, units, lenUnit, last, today }: { open: boolean; onClose: () => void; units: 'kg' | 'lb'; lenUnit: string; last?: Measurement; today: string }) {
  const toLen = (cm: number | undefined) => (cm == null ? null : Math.round((units === 'kg' ? cm : cm / CM_PER_IN) * 10) / 10)
  const initial = useMemo(() => Object.fromEntries(MEASURE_KEYS.map(k => [k, toLen(last?.[k])])) as Record<MeasureKey, number | null>, [last, units]) // eslint-disable-line react-hooks/exhaustive-deps
  const [vals, setVals] = useState<Record<MeasureKey, number | null> | null>(null)
  const cur = vals ?? initial
  const any = MEASURE_KEYS.some(k => cur[k] != null)
  const save = async () => {
    const m: Measurement = { id: uid(), date: today }
    for (const k of MEASURE_KEYS) {
      const v = cur[k]
      if (v != null) m[k] = Math.round((units === 'kg' ? v : v * CM_PER_IN) * 10) / 10
    }
    await db.measurements.put(m)
    haptic.success()
    setVals(null)
    onClose()
  }
  const step = units === 'kg' ? 0.5 : 0.25
  return (
    <Sheet open={open} onClose={onClose} title="Tape measurements">
      <div className="stack">
        <p className="body">Relaxed, not flexed. Hips at the fullest point of the glutes – that's the one we're growing.</p>
        {MEASURE_KEYS.map(k => (
          <Field key={k} label={`${MEASURE_LABELS[k]} (${lenUnit})`}>
            <Stepper value={cur[k]} allowEmpty onChange={v => setVals({ ...cur, [k]: v })} step={step} decimals={units === 'kg' ? 1 : 2} min={10} max={units === 'kg' ? 200 : 80} suffix={lenUnit} />
          </Field>
        ))}
        <Button variant="primary" size="lg" block disabled={!any} onClick={save} className="mt-8">Save measurements</Button>
      </div>
    </Sheet>
  )
}
