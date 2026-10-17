import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Button, Card, Input, Pill, Stepper } from '../../components/ui'
import { IconArrowDown, IconArrowUp, IconChevronDown, IconChevronLeft, IconPlus, IconSwap, IconX } from '../../components/ui/Icons'
import { ConfirmSheet, StepperBox } from '../../components/settings/Rows'
import { ExercisePicker } from '../../components/settings/ExercisePicker'
import { useProgram, useSettings } from '../../hooks/useSettings'
import { saveProgram } from '../../db/repo'
import { DEFAULT_PROGRAM } from '../../data/program'
import { getExercise } from '../../data/exercises'
import type { DayFocus, Program, ProgramDay, ProgramExercise } from '../../db/types'
import { haptic } from '../../lib/haptics'
import { uid } from '../../lib/ids'

const FOCUS: { value: DayFocus; label: string; tone: 'accent' | 'upper' | 'good' | 'gold' }[] = [
  { value: 'push', label: 'Push', tone: 'upper' }, { value: 'pull', label: 'Pull', tone: 'upper' }, { value: 'upper', label: 'Upper', tone: 'upper' },
  { value: 'glutes', label: 'Glutes', tone: 'accent' }, { value: 'power', label: 'Power', tone: 'gold' }, { value: 'rest', label: 'Rest', tone: 'good' },
]
const focusTone = (f: DayFocus) => FOCUS.find(x => x.value === f)?.tone ?? 'accent'
const focusLabel = (f: DayFocus) => FOCUS.find(x => x.value === f)?.label ?? f

const clone = (p: Program): Program => ({ version: p.version, days: p.days.map(d => ({ ...d, exercises: d.exercises.map(e => ({ ...e })) })) })
const stripId = (p: Program & { id?: string }): Program => { const { id: _id, ...rest } = p; return clone(rest) }
const move = <T,>(arr: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= arr.length) return arr
  const next = [...arr]; const [x] = next.splice(from, 1); next.splice(to, 0, x); return next
}
const invalidRows = (p: Program) => p.days.flatMap(d => d.exercises.filter(e => e.repMin > e.repMax).map(e => e.id))

export default function ProgramEditor() {
  const program = useProgram()
  const settings = useSettings()
  const nav = useNavigate()
  const [draft, setDraft] = useState<Program | null>(null)
  const [original, setOriginal] = useState<string>('')
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [openEx, setOpenEx] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ day: number; replace?: string } | null>(null)
  const [removeEx, setRemoveEx] = useState<{ day: number; id: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load once; later live updates are ignored while editing.
  useEffect(() => { if (program && !draft) { const p = stripId(program); setDraft(p); setOriginal(JSON.stringify(p)) } }, [program, draft])

  const dirty = useMemo(() => !!draft && JSON.stringify(draft) !== original, [draft, original])
  const invalid = useMemo(() => draft ? invalidRows(draft) : [], [draft])

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!draft || !settings) return <div className="page" />

  const update = (fn: (p: Program) => Program) => setDraft(d => (d ? fn(clone(d)) : d))
  const updateDay = (i: number, fn: (d: ProgramDay) => ProgramDay) => update(p => { p.days[i] = fn(p.days[i]); return p })
  const updateEx = (di: number, id: string, patch: Partial<ProgramExercise>) => updateDay(di, d => ({ ...d, exercises: d.exercises.map(e => (e.id === id ? { ...e, ...patch } : e)) }))

  const save = async () => {
    if (invalid.length) { haptic.warn(); return }
    const next = { ...draft, version: (draft.version ?? 1) + 1 }
    await saveProgram(next)
    setDraft(next); setOriginal(JSON.stringify(next))
    haptic.success(); setSaved(true); setTimeout(() => setSaved(false), 1600)
  }
  const back = () => { if (dirty) setConfirmLeave(true); else nav(-1) }

  const addExercise = (di: number, exerciseId: string) => {
    const def = getExercise(exerciseId)
    const ex: ProgramExercise = { id: uid(), exerciseId, sets: 3, repMin: 8, repMax: 12, restSec: def.restSec }
    updateDay(di, d => ({ ...d, exercises: [...d.exercises, ex] }))
    setOpenEx(ex.id)
  }

  return (
    <div className="page" style={{ paddingBottom: 'calc(var(--nav-h) + 110px + var(--safe-b))' }}>
      <header className="stack" style={{ gap: 6, marginBottom: 18 }}>
        <button className="row" style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 14, minHeight: 36, marginLeft: -6 }} onClick={back}><IconChevronLeft size={20} /> Settings</button>
        <div className="row-between">
          <div className="grow">
            <div className="eyebrow">Program · v{draft.version}</div>
            <h1 className="title" style={{ marginTop: 4 }}>Edit program</h1>
            <p className="body mt-8">Seven days in a rolling cycle. Tap a day to edit it; arrows reorder.</p>
          </div>
        </div>
      </header>

      <div className="stack stagger" style={{ gap: 10 }}>
        {draft.days.map((day, di) => {
          const open = openDay === di
          const bad = day.exercises.some(e => invalid.includes(e.id))
          return (
            <Card key={day.id} style={{ padding: 0, borderColor: open ? 'var(--line-strong)' : bad ? 'var(--bad)' : undefined }}>
              <div className="row" style={{ padding: '12px 10px 12px 16px', gap: 8 }}>
                <button className="grow row" style={{ textAlign: 'left', color: 'inherit', minHeight: 44, gap: 12 }} onClick={() => { haptic.tap(); setOpenDay(open ? null : di); setOpenEx(null) }} aria-expanded={open}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', fontWeight: 900, flex: 'none' }} className="num">{di + 1}</div>
                  <div className="grow">
                    <div style={{ fontWeight: 800 }}>{day.name || <span className="muted">Untitled day</span>}</div>
                    <div className="small">{day.focus === 'rest' && !day.exercises.length ? 'Rest day' : `${day.exercises.length} exercise${day.exercises.length === 1 ? '' : 's'}`}{bad ? ' · fix rep range' : ''}</div>
                  </div>
                  <Pill tone={focusTone(day.focus)}>{focusLabel(day.focus)}</Pill>
                  <IconChevronDown size={18} style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
                </button>
                <div className="stack" style={{ gap: 2 }}>
                  <ArrowBtn dir="up" disabled={di === 0} onClick={() => { update(p => ({ ...p, days: move(p.days, di, di - 1) })); setOpenDay(o => (o === di ? di - 1 : o)) }} />
                  <ArrowBtn dir="down" disabled={di === draft.days.length - 1} onClick={() => { update(p => ({ ...p, days: move(p.days, di, di + 1) })); setOpenDay(o => (o === di ? di + 1 : o)) }} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} style={{ overflow: 'hidden' }}>
                    <div className="stack" style={{ padding: '4px 16px 16px', gap: 12, borderTop: '1px solid var(--line)' }}>
                      <div className="grid-2" style={{ marginTop: 12 }}>
                        <label className="field"><span className="tiny">Name</span><Input value={day.name} onChange={e => updateDay(di, d => ({ ...d, name: e.target.value }))} /></label>
                        <label className="field"><span className="tiny">Subtitle</span><Input value={day.subtitle} onChange={e => updateDay(di, d => ({ ...d, subtitle: e.target.value }))} /></label>
                      </div>
                      <div>
                        <div className="tiny" style={{ marginBottom: 6 }}>Focus</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {FOCUS.map(f => (
                            <button key={f.value} className={`chip ${day.focus === f.value ? (f.tone === 'upper' ? 'chip--on-upper' : 'chip--on') : ''}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => { haptic.tap(); updateDay(di, d => ({ ...d, focus: f.value })) }}>{f.label}</button>
                          ))}
                        </div>
                      </div>

                      <div className="stack" style={{ gap: 8 }}>
                        {day.exercises.map((ex, ei) => {
                          const def = getExercise(ex.exerciseId)
                          const exOpen = openEx === ex.id
                          const isBad = ex.repMin > ex.repMax
                          return (
                            <div key={ex.id} style={{ background: 'var(--surface-2)', borderRadius: 12, border: `1px solid ${isBad ? 'var(--bad)' : exOpen ? 'var(--line-strong)' : 'transparent'}` }}>
                              <div className="row" style={{ padding: '6px 6px 6px 12px', gap: 6 }}>
                                <button className="grow" style={{ textAlign: 'left', color: 'inherit', minHeight: 44 }} onClick={() => { haptic.tap(); setOpenEx(exOpen ? null : ex.id) }} aria-expanded={exOpen}>
                                  <div style={{ fontWeight: 700, fontSize: 15 }}>{def.shortName}{ex.supersetGroup && <Pill tone="upper" className="num" > ⇄ {ex.supersetGroup}</Pill>}</div>
                                  <div className="small num">{ex.sets} × {ex.repMin}{ex.repMax !== ex.repMin ? `–${ex.repMax}` : ''} · rest {ex.restSec ?? def.restSec}s{isBad ? <span className="bad"> · min &gt; max</span> : ''}</div>
                                </button>
                                <ArrowBtn dir="up" disabled={ei === 0} onClick={() => updateDay(di, d => ({ ...d, exercises: move(d.exercises, ei, ei - 1) }))} />
                                <ArrowBtn dir="down" disabled={ei === day.exercises.length - 1} onClick={() => updateDay(di, d => ({ ...d, exercises: move(d.exercises, ei, ei + 1) }))} />
                              </div>
                              <AnimatePresence initial={false}>
                                {exOpen && (
                                  <motion.div key="ed" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                                    <div className="stack" style={{ padding: '4px 12px 12px', gap: 10 }}>
                                      <button className="row-between" style={{ width: '100%', color: 'inherit', background: 'var(--surface-3)', borderRadius: 10, padding: '10px 12px', minHeight: 48, textAlign: 'left' }} onClick={() => { haptic.tap(); setPicker({ day: di, replace: ex.id }) }}>
                                        <div className="grow"><div className="tiny">Exercise</div><div style={{ fontWeight: 700 }}>{def.name}</div></div>
                                        <IconSwap size={18} style={{ color: 'var(--accent)' }} />
                                      </button>
                                      <Row2 label="Sets"><Stepper value={ex.sets} min={1} max={8} onChange={v => { if (v != null) updateEx(di, ex.id, { sets: v }) }} /></Row2>
                                      <Row2 label="Reps min"><Stepper value={ex.repMin} min={1} max={30} onChange={v => { if (v != null) updateEx(di, ex.id, { repMin: v }) }} /></Row2>
                                      <Row2 label="Reps max" hint={isBad ? 'Must be ≥ min' : undefined}><Stepper value={ex.repMax} min={1} max={30} onChange={v => { if (v != null) updateEx(di, ex.id, { repMax: v }) }} /></Row2>
                                      <Row2 label="Rest" hint={`Default ${def.restSec}s`}><Stepper value={ex.restSec ?? def.restSec} min={0} max={300} step={15} suffix="s" onChange={v => { if (v != null) updateEx(di, ex.id, { restSec: v }) }} /></Row2>
                                      <div className="grid-2">
                                        <label className="field"><span className="tiny">Superset group</span><Input placeholder="e.g. arms" value={ex.supersetGroup ?? ''} onChange={e => updateEx(di, ex.id, { supersetGroup: e.target.value.trim() || undefined })} /></label>
                                        <label className="field"><span className="tiny">Note</span><Input placeholder="Each side…" value={ex.note ?? ''} onChange={e => updateEx(di, ex.id, { note: e.target.value || undefined })} /></label>
                                      </div>
                                      <Button variant="danger" size="sm" onClick={() => setRemoveEx({ day: di, id: ex.id })}><IconX size={16} /> Remove exercise</Button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                        <Button variant="ghost" block onClick={() => setPicker({ day: di })}><IconPlus size={18} /> Add exercise</Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )
        })}
      </div>

      <Button variant="subtle" block className="mt-24" onClick={() => setConfirmReset(true)}>Reset to default program</Button>

      {createPortal(<AnimatePresence>
        {(dirty || saved) && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(var(--nav-h) + var(--safe-b))', padding: '20px 16px 12px', background: 'linear-gradient(to top, var(--bg) 60%, transparent)', zIndex: 40 }}>
            <div style={{ maxWidth: 488, margin: '0 auto' }} className="row">
              <Button block size="lg" variant={saved ? 'good' : 'primary'} disabled={!!invalid.length && !saved} onClick={save}>
                {saved ? 'Saved ✓' : invalid.length ? `Fix ${invalid.length} rep range${invalid.length === 1 ? '' : 's'}` : 'Save program'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}

      <ExercisePicker open={!!picker} onClose={() => setPicker(null)} title={picker?.replace ? 'Swap exercise' : 'Add exercise'}
        selected={picker?.replace ? draft.days[picker.day].exercises.find(e => e.id === picker.replace)?.exerciseId : undefined}
        onPick={def => {
          if (!picker) return
          if (picker.replace) updateEx(picker.day, picker.replace, { exerciseId: def.id, restSec: def.restSec })
          else addExercise(picker.day, def.id)
          setPicker(null)
        }} />
      <ConfirmSheet open={!!removeEx} onClose={() => setRemoveEx(null)} danger title="Remove exercise?" confirmLabel="Remove"
        body={removeEx ? `${getExercise(draft.days[removeEx.day].exercises.find(e => e.id === removeEx.id)?.exerciseId ?? 'rdl').name} is removed from ${draft.days[removeEx.day].name}. Its history stays.` : ''}
        onConfirm={() => { if (removeEx) updateDay(removeEx.day, d => ({ ...d, exercises: d.exercises.filter(e => e.id !== removeEx.id) })); setRemoveEx(null) }} />
      <ConfirmSheet open={confirmReset} onClose={() => setConfirmReset(false)} danger title="Reset to default program?" confirmLabel="Reset"
        body="Every day goes back to the original Sculpt program. Your lift history is untouched. You still need to tap Save."
        onConfirm={() => { update(() => clone(DEFAULT_PROGRAM)); setConfirmReset(false); setOpenDay(null); haptic.warn() }} />
      <ConfirmSheet open={confirmLeave} onClose={() => setConfirmLeave(false)} danger title="Discard changes?" confirmLabel="Discard" cancelLabel="Keep editing"
        body="You have unsaved edits to the program." onConfirm={() => { setConfirmLeave(false); nav(-1) }} />
    </div>
  )
}

function ArrowBtn({ dir, disabled, onClick }: { dir: 'up' | 'down'; disabled?: boolean; onClick: () => void }) {
  return (
    <button aria-label={`Move ${dir}`} disabled={disabled} onClick={() => { haptic.tap(); onClick() }}
      style={{ width: 36, height: 30, display: 'grid', placeItems: 'center', color: disabled ? 'var(--surface-3)' : 'var(--text-2)', borderRadius: 8 }}>
      {dir === 'up' ? <IconArrowUp size={18} /> : <IconArrowDown size={18} />}
    </button>
  )
}

function Row2({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="row-between">
      <div><div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>{hint && <div className="tiny" style={{ color: hint.startsWith('Must') ? 'var(--bad)' : undefined }}>{hint}</div>}</div>
      <StepperBox width={176}>{children}</StepperBox>
    </div>
  )
}
