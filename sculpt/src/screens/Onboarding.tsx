import { useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import { Button, Card, Input, Pill, Segmented, ToggleRow, Stepper } from '../components/ui'
import { IconChevronLeft, IconCheck, IconFlame, IconTrophy, IconZap, IconBody } from '../components/ui/Icons'
import { BodyweightStepper, HeightInput, IncrementFields, INCREMENT_DEFAULTS } from '../components/settings/BodyFields'
import { DayPicker, DAY_LABELS_LONG, fmtHour, StepperBox } from '../components/settings/Rows'
import { useProgram, useSettings, updateSettings } from '../hooks/useSettings'
import { DEFAULT_SETTINGS } from '../db/defaults'
import { DEFAULT_PROGRAM } from '../data/program'
import { EQUIPMENT_LABELS, getExercise } from '../data/exercises'
import { db } from '../db/schema'
import type { Equipment, ExerciseState, Increments, Program, Units } from '../db/types'
import { formatLoad, fromDisplay, toDisplay } from '../engine/units'
import { roundLoad } from '../engine/increments'
import { epley } from '../engine/epley'
import { addDays, isoDate, parseIso } from '../engine/schedule'
import { fmtDate } from '../lib/format'
import { haptic } from '../lib/haptics'
import { primeAudio, sound } from '../lib/sound'
import { uid } from '../lib/ids'

// ── Draft state ───────────────────────────────────────────────────────────────
interface LiftInput { weight: string; reps: string }
interface Draft {
  name: string; units: Units; bodyweightKg: number; heightCm: number; equipment: Equipment[]; increments: Increments; incrementsTouched: boolean
  lifts: Record<string, LiftInput>
  programStartDate: string; deloadEvery: number; weighInDay: number; weighInHour: number; mealTimes: [string, string]; trainsFasted: boolean; selfieReminder: boolean
}

const LIFT_IDS = ['bbHipThrust', 'backSquat', 'flatBbBench', 'inclineDbPress', 'trapBarDeadlift', 'rdl']
const STEPS = ['Welcome', 'You', 'Gym', 'Jumps', 'Lifts', 'Schedule', 'Ready'] as const
const EQUIPMENT_IDS = Object.keys(EQUIPMENT_LABELS) as Equipment[]

const initialDraft = (): Draft => ({
  name: '', units: DEFAULT_SETTINGS.units, bodyweightKg: DEFAULT_SETTINGS.bodyweightKg, heightCm: DEFAULT_SETTINGS.heightCm,
  equipment: [...DEFAULT_SETTINGS.equipment], increments: { ...DEFAULT_SETTINGS.increments }, incrementsTouched: false,
  lifts: Object.fromEntries(LIFT_IDS.map(id => [id, { weight: '', reps: '' }])),
  programStartDate: isoDate(), deloadEvery: DEFAULT_SETTINGS.deloadEvery, weighInDay: DEFAULT_SETTINGS.weighInDay, weighInHour: DEFAULT_SETTINGS.weighInHour,
  mealTimes: [...DEFAULT_SETTINGS.mealTimes] as [string, string], trainsFasted: DEFAULT_SETTINGS.trainsFasted, selfieReminder: DEFAULT_SETTINGS.selfieReminder,
})

const parseLift = (l: LiftInput) => {
  const w = parseFloat(l.weight.replace(',', '.')), r = parseInt(l.reps, 10)
  return w > 0 && r > 0 && r <= 30 ? { w, r } : null
}

/** Build pre-calibrated exercise states from the "known lifts" step. */
export function buildSeedStates(draft: Draft, program: Program): ExerciseState[] {
  const out: ExerciseState[] = []
  const programExercises = program.days.flatMap(d => d.exercises)
  for (const id of LIFT_IDS) {
    const p = parseLift(draft.lifts[id]); if (!p) continue
    const def = getExercise(id)
    const kg = fromDisplay(p.w, draft.units)
    const pe = programExercises.find(e => e.exerciseId === id)
    out.push({
      exerciseId: id, loadMode: def.defaultLoadMode, calibrated: true, consecutiveMisses: 0,
      currentLoad: roundLoad(kg, def, draft.increments, draft.units), targetReps: pe?.repMin ?? p.r,
      bestE1rm: epley(kg, p.r, 0), bestLoad: kg, history: [], updatedAt: Date.now(),
    })
  }
  return out
}

const nextMonday = (): string => {
  const d = parseIso(isoDate()); const dow = d.getDay()
  return addDays(isoDate(), dow === 1 ? 0 : (8 - dow) % 7)
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const settings = useSettings()
  const program = useProgram()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [saving, setSaving] = useState(false)
  const patch = (p: Partial<Draft>) => setDraft(d => ({ ...d, ...p }))

  const liftCount = useMemo(() => LIFT_IDS.filter(id => parseLift(draft.lifts[id])).length, [draft.lifts])

  if (!settings) return null

  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(Math.max(0, Math.min(STEPS.length - 1, n))); window.scrollTo({ top: 0 }) }
  const next = () => { haptic.tap(); primeAudio(); go(step + 1) }

  const finish = async () => {
    if (saving) return
    setSaving(true)
    try {
      const prog = program ?? DEFAULT_PROGRAM
      const states = buildSeedStates(draft, prog)
      if (states.length) await db.exerciseStates.bulkPut(states)
      const today = isoDate()
      const existing = await db.bodyWeights.where('date').equals(today).first()
      if (!existing) await db.bodyWeights.put({ id: uid(), date: today, kg: draft.bodyweightKg })
      await updateSettings({
        name: draft.name.trim(), units: draft.units, bodyweightKg: draft.bodyweightKg, heightCm: draft.heightCm, equipment: draft.equipment,
        increments: draft.increments, deloadEvery: draft.deloadEvery, weighInDay: draft.weighInDay, weighInHour: draft.weighInHour,
        mealTimes: draft.mealTimes, trainsFasted: draft.trainsFasted, selfieReminder: draft.selfieReminder,
        programStartDate: draft.programStartDate, blockStartDate: draft.programStartDate, scheduleOffset: 0, onboarded: true,
      })
      haptic.done(); sound.complete()
      nav('/', { replace: true })
    } finally { setSaving(false) }
  }

  const isLast = step === STEPS.length - 1
  const ctaLabel = isLast ? 'Let’s build' : step === 4 && liftCount === 0 ? 'Skip for now' : 'Continue'

  return (
    <MotionConfig reducedMotion="user">
      <div className="page page--nonav" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 120 }}>
        <header className="row-between" style={{ marginBottom: 18, minHeight: 36 }}>
          <button aria-label="Back" onClick={() => { haptic.tap(); go(step - 1) }} disabled={step === 0}
            style={{ color: 'var(--muted)', width: 36, height: 36, display: 'grid', placeItems: 'center', marginLeft: -6, opacity: step === 0 ? 0 : 1, transition: 'opacity 0.2s' }}>
            <IconChevronLeft size={22} />
          </button>
          <div className="row" style={{ gap: 6 }} aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <motion.span key={s} layout animate={{ width: i === step ? 22 : 7, background: i <= step ? 'var(--accent)' : 'var(--surface-3)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }} style={{ height: 7, borderRadius: 4, display: 'block' }} />
            ))}
          </div>
          <div className="tiny num" style={{ width: 36, textAlign: 'right' }}>{step + 1}/{STEPS.length}</div>
        </header>

        <div style={{ flex: 1, position: 'relative' }}>
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.9 }}>
              {step === 0 && <Welcome draft={draft} patch={patch} />}
              {step === 1 && <Body draft={draft} patch={patch} />}
              {step === 2 && <Gym draft={draft} patch={patch} />}
              {step === 3 && <Jumps draft={draft} patch={patch} />}
              {step === 4 && <Lifts draft={draft} patch={patch} program={program ?? DEFAULT_PROGRAM} />}
              {step === 5 && <Schedule draft={draft} patch={patch} />}
              {step === 6 && <Done draft={draft} liftCount={liftCount} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Portal: .page animates transform, which would otherwise become the containing block for position: fixed. */}
        {createPortal(
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '28px 16px calc(16px + var(--safe-b))', background: 'linear-gradient(to top, var(--bg) 55%, transparent)', zIndex: 20 }}>
            <div style={{ maxWidth: 488, margin: '0 auto' }}>
              <Button block size="lg" variant="primary" pulse={isLast} disabled={saving} onClick={isLast ? finish : next}>
                {saving ? 'Building…' : ctaLabel}{!isLast && <span aria-hidden>→</span>}
              </Button>
            </div>
          </div>, document.body)}
      </div>
    </MotionConfig>
  )
}

const slide = {
  enter: (d: number) => ({ x: d * 70, opacity: 0, filter: 'blur(4px)' }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (d: number) => ({ x: d * -70, opacity: 0, filter: 'blur(4px)' }),
}

type StepProps = { draft: Draft; patch: (p: Partial<Draft>) => void }

function StepHead({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body?: ReactNode }) {
  return (
    <div className="stack" style={{ gap: 8, marginBottom: 20 }}>
      <div className="eyebrow">{eyebrow}</div>
      <h1 className="title-lg">{title}</h1>
      {body && <p className="body">{body}</p>}
    </div>
  )
}

// ── 1 Welcome ─────────────────────────────────────────────────────────────────
const GOALS = [
  { icon: <IconBody size={22} />, title: 'Upper body size', body: 'Upper chest, side delts and arms. Build the frame.', tone: 'upper' as const },
  { icon: <span style={{ fontSize: 22, lineHeight: 1 }}>🍑</span>, title: 'Glutes: fuller, firmer, rounder', body: 'The hero goal. Heavy hip thrusts, every week, celebrated.', tone: 'accent' as const },
  { icon: <IconFlame size={22} />, title: 'Legs strong, not big', body: 'Heavy and low-rep. Strength without quad volume.', tone: 'gold' as const },
  { icon: <IconZap size={22} />, title: 'Stay lean', body: 'Eat at maintenance, recomp. The chocolate is part of the plan.', tone: 'good' as const },
]
const toneColor: Record<string, string> = { upper: 'var(--accent-2)', accent: 'var(--accent)', gold: 'var(--gold)', good: 'var(--good)' }

function Welcome({ draft, patch }: StepProps) {
  return (
    <div className="stack-lg">
      <div>
        <div className="eyebrow">Welcome to</div>
        <h1 className="title-xl gradient-text pop" style={{ marginTop: 6, paddingBottom: 4 }}>Sculpt.</h1>
        <p className="body mt-8">A coach that lives on your phone. No account, no cloud – just you, the bar and four goals.</p>
      </div>
      <div className="stack stagger" style={{ gap: 10 }}>
        {GOALS.map(g => (
          <Card key={g.title} glow={g.tone === 'accent'} style={{ padding: 14 }}>
            <div className="row" style={{ gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: toneColor[g.tone], flex: 'none' }}>{g.icon}</div>
              <div className="grow">
                <div style={{ fontWeight: 800 }}>{g.title}</div>
                <div className="small">{g.body}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <label className="field">
        <span className="label">What should I call you?</span>
        <Input big placeholder="Your name" autoComplete="given-name" value={draft.name} onChange={e => patch({ name: e.target.value })} />
      </label>
    </div>
  )
}

// ── 2 Body ────────────────────────────────────────────────────────────────────
function Body({ draft, patch }: StepProps) {
  const setUnits = (units: Units) => patch({ units, increments: draft.incrementsTouched ? draft.increments : { ...INCREMENT_DEFAULTS[units] } })
  return (
    <div className="stack-lg">
      <StepHead eyebrow="About you" title="Units & body" body="Weights are stored in kilograms behind the scenes; this only changes what you see." />
      <Card>
        <div className="label" style={{ marginBottom: 10 }}>Units</div>
        <Segmented accent value={draft.units} onChange={setUnits} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
      </Card>
      <Card className="stack" style={{ gap: 18 }}>
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Bodyweight</div>
          <BodyweightStepper fill kg={draft.bodyweightKg} units={draft.units} onChange={kg => patch({ bodyweightKg: kg })} />
          <div className="tiny mt-8">Used for protein targets and bodyweight exercises. You’ll weigh in weekly.</div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Height</div>
          <HeightInput fill cm={draft.heightCm} units={draft.units} onChange={cm => patch({ heightCm: cm })} />
        </div>
      </Card>
    </div>
  )
}

// ── 3 Gym ─────────────────────────────────────────────────────────────────────
function Gym({ draft, patch }: StepProps) {
  const toggle = (id: Equipment) => {
    haptic.tap()
    patch({ equipment: draft.equipment.includes(id) ? draft.equipment.filter(e => e !== id) : [...draft.equipment, id] })
  }
  return (
    <div className="stack-lg">
      <StepHead eyebrow="Your gym" title="What can you use?" body="Swaps and alternatives only suggest exercises you can actually do." />
      <div className="row-between">
        <span className="small">{draft.equipment.length} of {EQUIPMENT_IDS.length} selected</span>
        <button className="small" style={{ color: 'var(--accent)', fontWeight: 700, minHeight: 36 }} onClick={() => { haptic.tap(); patch({ equipment: draft.equipment.length === EQUIPMENT_IDS.length ? [] : [...EQUIPMENT_IDS] }) }}>
          {draft.equipment.length === EQUIPMENT_IDS.length ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="stagger" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {EQUIPMENT_IDS.map(id => {
          const on = draft.equipment.includes(id)
          return (
            <motion.button key={id} whileTap={{ scale: 0.94 }} className={`chip ${on ? 'chip--on' : ''}`} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => toggle(id)} aria-pressed={on}>
              {on && <IconCheck size={14} />}{EQUIPMENT_LABELS[id]}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── 4 Jumps ───────────────────────────────────────────────────────────────────
function Jumps({ draft, patch }: StepProps) {
  const lb = draft.units === 'lb'
  return (
    <div className="stack-lg">
      <StepHead eyebrow="Loading" title="Smallest jumps" body={<>Progression only ever asks for jumps you can make. <b>Bar jumps are 2× the plate</b> – one on each side – so a {lb ? '2.5 lb' : '1.25 kg'} plate means {lb ? '5 lb' : '2.5 kg'} on the bar.</>} />
      <Card style={{ paddingTop: 4, paddingBottom: 4 }}>
        <IncrementFields inc={draft.increments} units={draft.units} onChange={inc => patch({ increments: inc, incrementsTouched: true })} />
      </Card>
      <div className="small">Upper-body compounds go up {lb ? '5 lb' : '2.5 kg'}, lower-body compounds {lb ? '10 lb' : '5 kg'}; everything else moves by the smallest jump above.</div>
    </div>
  )
}

// ── 5 Lifts ───────────────────────────────────────────────────────────────────
function Lifts({ draft, patch, program }: StepProps & { program: Program }) {
  const programExercises = program.days.flatMap(d => d.exercises)
  const setLift = (id: string, p: Partial<LiftInput>) => patch({ lifts: { ...draft.lifts, [id]: { ...draft.lifts[id], ...p } } })
  return (
    <div className="stack-lg">
      <StepHead eyebrow="Optional" title="Numbers you know" body="Done any of these recently? Enter weight × reps and we skip calibration for that lift. Leave the rest blank." />
      <Card glow style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <IconTrophy size={20} style={{ color: 'var(--accent)', flex: 'none' }} />
          <div className="small" style={{ color: 'var(--text-2)' }}><b>Week 1 is a calibration week</b> for everything you leave blank: you pick the weight, the app learns from it, then progression takes over.</div>
        </div>
      </Card>
      <div className="stack stagger" style={{ gap: 10 }}>
        {LIFT_IDS.map(id => {
          const def = getExercise(id)
          const pe = programExercises.find(e => e.exerciseId === id)
          const l = draft.lifts[id]
          const p = parseLift(l)
          const e1 = p ? epley(fromDisplay(p.w, draft.units), p.r) : null
          return (
            <Card key={id} style={{ padding: 14, borderColor: p ? 'var(--accent)' : undefined }}>
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="grow">
                  <div style={{ fontWeight: 800 }}>{def.name}</div>
                  <div className="small">{pe ? `Program: ${pe.sets} × ${pe.repMin}${pe.repMax !== pe.repMin ? `–${pe.repMax}` : ''}` : def.shortName}</div>
                </div>
                {e1 != null ? <Pill tone="accent">e1RM {formatLoad(e1, draft.units)}</Pill> : <Pill>Calibrate</Pill>}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Input inputMode="decimal" placeholder={draft.units === 'kg' ? '80' : '175'} aria-label={`${def.name} weight`} value={l.weight} onChange={e => setLift(id, { weight: e.target.value })} style={{ textAlign: 'center', fontWeight: 800 }} />
                <span className="small" style={{ flex: 'none' }}>{draft.units} ×</span>
                <Input inputMode="numeric" placeholder="8" aria-label={`${def.name} reps`} value={l.reps} onChange={e => setLift(id, { reps: e.target.value })} style={{ textAlign: 'center', fontWeight: 800, maxWidth: 90 }} />
                <span className="small" style={{ flex: 'none' }}>reps</span>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ── 6 Schedule ────────────────────────────────────────────────────────────────
function Schedule({ draft, patch }: StepProps) {
  const setMeal = (i: 0 | 1, v: string) => { const m: [string, string] = [...draft.mealTimes]; m[i] = v; patch({ mealTimes: m }) }
  return (
    <div className="stack-lg">
      <StepHead eyebrow="Rhythm" title="Your week" body="A rolling 7-day cycle: Push, Glutes + Leg Strength, Pull + Arms, Rest, Upper, Glutes + Power, Rest." />
      <Card className="stack" style={{ gap: 10 }}>
        <div className="label">Which day is Day 1?</div>
        <input type="date" className="input" value={draft.programStartDate} onChange={e => { if (e.target.value) patch({ programStartDate: e.target.value }) }} />
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" variant={draft.programStartDate === isoDate() ? 'primary' : 'ghost'} onClick={() => patch({ programStartDate: isoDate() })}>Today</Button>
          <Button size="sm" variant={draft.programStartDate === nextMonday() && draft.programStartDate !== isoDate() ? 'primary' : 'ghost'} onClick={() => patch({ programStartDate: nextMonday() })}>Start Monday</Button>
          <span className="small grow" style={{ textAlign: 'right' }}>{fmtDate(draft.programStartDate)}</span>
        </div>
      </Card>
      <Card className="stack" style={{ gap: 10 }}>
        <div className="label">Deload every</div>
        <Segmented accent value={String(draft.deloadEvery)} onChange={v => patch({ deloadEvery: Number(v) })} options={[6, 7, 8].map(n => ({ value: String(n), label: `${n} weeks` }))} />
        <div className="tiny">A lighter week lets joints and the nervous system catch up. 7 is the sweet spot for most.</div>
      </Card>
      <Card className="stack" style={{ gap: 10 }}>
        <div className="label">Weekly weigh-in</div>
        <DayPicker value={draft.weighInDay} onChange={d => patch({ weighInDay: d })} />
        <div className="row-between">
          <div className="small">{DAY_LABELS_LONG[draft.weighInDay]} at {fmtHour(draft.weighInHour)}{draft.weighInHour < 15 ? ' · before Meal 1' : ''}</div>
          <StepperBox width={176}><Stepper value={draft.weighInHour} min={0} max={23} step={1} suffix=":00" onChange={v => { if (v != null) patch({ weighInHour: v }) }} /></StepperBox>
        </div>
      </Card>
      <Card className="stack" style={{ gap: 10 }}>
        <div className="label">Meal times</div>
        <div className="grid-2">
          <label className="field"><span className="tiny">Meal 1</span><input type="time" className="input" value={draft.mealTimes[0]} onChange={e => setMeal(0, e.target.value)} /></label>
          <label className="field"><span className="tiny">Meal 2</span><input type="time" className="input" value={draft.mealTimes[1]} onChange={e => setMeal(1, e.target.value)} /></label>
        </div>
        <ToggleRow label="I train fasted" hint="Workouts land before Meal 1" on={draft.trainsFasted} onChange={v => patch({ trainsFasted: v })} />
        <ToggleRow label="Progress-photo reminder" hint="Nudge for a selfie on weigh-in day" on={draft.selfieReminder} onChange={v => patch({ selfieReminder: v })} />
      </Card>
    </div>
  )
}

// ── 7 Done ────────────────────────────────────────────────────────────────────
function Done({ draft, liftCount }: { draft: Draft; liftCount: number }) {
  const name = draft.name.trim()
  const items = [
    { l: 'Units', v: draft.units },
    { l: 'Bodyweight', v: `${Math.round(toDisplay(draft.bodyweightKg, draft.units) * 10) / 10} ${draft.units}` },
    { l: 'Equipment', v: `${draft.equipment.length} items` },
    { l: 'Day 1', v: fmtDate(draft.programStartDate) },
    { l: 'Deload', v: `every ${draft.deloadEvery} wk` },
    { l: 'Weigh-in', v: `${DAY_LABELS_LONG[draft.weighInDay].slice(0, 3)} ${fmtHour(draft.weighInHour)}` },
    { l: 'Pre-seeded lifts', v: liftCount ? `${liftCount} of ${LIFT_IDS.length}` : 'calibrating all' },
    { l: 'Meals', v: `${draft.mealTimes[0]} · ${draft.mealTimes[1]}` },
  ]
  return (
    <div className="stack-lg">
      <div className="center" style={{ paddingTop: 12 }}>
        <motion.div initial={{ scale: 0.4, rotate: -16, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }} style={{ fontSize: 72, lineHeight: 1 }} aria-hidden>🍑</motion.div>
        <motion.h1 className="title-xl gradient-text" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 22 }} style={{ marginTop: 16, paddingBottom: 6 }}>
          {name ? `Let’s build, ${name}.` : 'Let’s build.'}
        </motion.h1>
        <motion.p className="body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ marginTop: 10 }}>
          Your first week starts {draft.programStartDate === isoDate() ? 'today' : fmtDate(draft.programStartDate)}. Week 1 calibrates, then every session gets a little heavier.
        </motion.p>
      </div>
      <Card glow>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Your setup</div>
        <div className="stagger" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map(it => (
            <div key={it.l} style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '10px 12px' }}>
              <div className="tiny">{it.l}</div>
              <div style={{ fontWeight: 800, fontSize: 15 }} className="num">{it.v}</div>
            </div>
          ))}
        </div>
      </Card>
      <p className="small center">You can change any of this later in Settings.</p>
    </div>
  )
}
