import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'motion/react'
import { db } from '../db/schema'
import type { NutritionDay } from '../db/types'
import { useSettings } from '../hooks/useSettings'
import { haptic } from '../lib/haptics'
import { IconCheck, IconDrop, IconFork, IconMoon, IconZap } from './ui/Icons'
import { Toggle } from './ui'

type CheckKey = 'meal1Protein' | 'meal2Protein' | 'water' | 'sleep' | 'chocolate'

const ITEMS: { key: CheckKey; label: string; hint: string; icon: ReactNode; optional?: boolean }[] = [
  { key: 'meal1Protein', label: 'Meal 1 protein', hint: 'Half the daily target', icon: <IconFork size={18} /> },
  { key: 'meal2Protein', label: 'Meal 2 protein', hint: 'The other half', icon: <IconFork size={18} /> },
  { key: 'water', label: 'Water', hint: 'Sipped through the fast', icon: <IconDrop size={18} /> },
  { key: 'sleep', label: 'Sleep 7–9 h', hint: 'Where the muscle is built', icon: <IconMoon size={18} /> },
  { key: 'chocolate', label: "Tony's", hint: 'Half a bar after dinner – part of the plan', icon: <span style={{ fontSize: 16 }}>🍫</span>, optional: true },
]
const CORE: CheckKey[] = ['meal1Protein', 'meal2Protein', 'water', 'sleep']

const CELEBRATIONS = [
  'All four hit. The glutes thank you.',
  'Nutrition nailed – that\'s how a recomp is built.',
  'Clean sweep. Enjoy the Tony\'s.',
  'Every box ticked. Tomorrow\'s session will feel it.',
]

export function NutritionChecklist({ date, compact }: { date: string; compact?: boolean }) {
  const settings = useSettings()
  const row = useLiveQuery(() => db.nutrition.get(date), [date])
  const [justPopped, setJustPopped] = useState<CheckKey | null>(null)
  const [allDoneShown, setAllDoneShown] = useState(false)

  const day: NutritionDay = {
    date, meal1Protein: false, meal2Protein: false, water: false, sleep: false, chocolate: false,
    trainedFasted: settings?.trainsFasted ?? true,
    ...row,
  }
  const coreDone = CORE.filter(k => day[k]).length
  const allDone = coreDone === CORE.length

  useEffect(() => { if (allDone && !allDoneShown) setAllDoneShown(true); if (!allDone) setAllDoneShown(false) }, [allDone, allDoneShown])

  const toggle = async (key: CheckKey) => {
    const next = { ...day, [key]: !day[key] }
    if (next[key]) { haptic.success(); setJustPopped(key); setTimeout(() => setJustPopped(null), 500) } else haptic.tap()
    await db.nutrition.put(next)
    const nowAll = CORE.every(k => next[k])
    if (nowAll && !allDone) setTimeout(() => haptic.done(), 150)
  }
  const setFasted = async (v: boolean) => { await db.nutrition.put({ ...day, trainedFasted: v }) }

  if (!settings) return null

  const celebration = CELEBRATIONS[date.split('-').reduce((a, b) => a + Number(b), 0) % CELEBRATIONS.length]

  if (compact) {
    return (
      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 6 }}>
          {ITEMS.map(it => {
            const on = day[it.key]
            return (
              <button key={it.key} onClick={() => toggle(it.key)} aria-pressed={on} aria-label={it.label}
                className={justPopped === it.key ? 'pop' : ''}
                style={{
                  width: 52, height: 52, borderRadius: '50%', display: 'grid', placeItems: 'center', position: 'relative',
                  background: on ? (it.optional ? 'var(--grad-power)' : 'var(--grad-upper)') : 'var(--surface-2)',
                  border: on ? 'none' : `1.5px ${it.optional ? 'dashed' : 'solid'} var(--line-strong)`, color: on ? '#fff' : 'var(--muted)',
                  boxShadow: on ? '0 6px 18px rgba(139,108,255,0.3)' : undefined, transition: 'background 0.2s, color 0.2s',
                }}>
                {on && !it.optional ? <IconCheck size={22} /> : it.icon}
              </button>
            )
          })}
        </div>
        <div className="row-between" style={{ marginTop: 10 }}>
          <span className="tiny">{allDone ? celebration : `${coreDone}/4 nutrition checks`}</span>
          {day.trainedFasted && <span className="pill pill--upper" style={{ fontSize: 10, padding: '2px 8px' }}><IconZap size={11} /> fasted</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 6 }}>
        <div>
          <div className="eyebrow">Daily checklist</div>
          <div className="subtitle" style={{ marginTop: 2 }}>{coreDone}/4 done</div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {CORE.map(k => <span key={k} style={{ width: 8, height: 8, borderRadius: 4, background: day[k] ? 'var(--accent-2)' : 'var(--surface-3)', transition: 'background 0.2s' }} />)}
        </div>
      </div>
      <div className="stagger">
        {ITEMS.map(it => {
          const on = day[it.key]
          return (
            <button key={it.key} className="list-item" onClick={() => toggle(it.key)} aria-pressed={on} style={{ width: '100%', textAlign: 'left', minHeight: 60 }}>
              <span className={justPopped === it.key ? 'pop' : ''} style={{
                width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', flex: 'none',
                background: on ? (it.optional ? 'var(--grad-power)' : 'var(--grad-upper)') : 'var(--surface-2)',
                border: on ? 'none' : `1.5px ${it.optional ? 'dashed' : 'solid'} var(--line-strong)`, color: on ? '#fff' : 'var(--muted)', transition: 'background 0.2s',
              }}>{on && !it.optional ? <IconCheck size={20} /> : it.icon}</span>
              <span className="grow">
                <span style={{ display: 'block', fontWeight: 700, opacity: on ? 0.8 : 1 }}>{it.label}{it.optional && <span className="tiny" style={{ marginLeft: 6 }}>optional</span>}</span>
                <span className="small" style={{ display: 'block' }}>{it.hint}</span>
              </span>
            </button>
          )
        })}
        <div className="list-item">
          <span style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--surface-2)', color: day.trainedFasted ? 'var(--accent-2)' : 'var(--muted)', flex: 'none' }}><IconZap size={18} /></span>
          <div className="grow"><div style={{ fontWeight: 700 }}>Trained fasted today</div><div className="small">Helps spot stalls linked to fasted sessions</div></div>
          <Toggle on={day.trainedFasted} onChange={setFasted} label="Trained fasted today" />
        </div>
      </div>
      <AnimatePresence>
        {allDone && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} className="row" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--good-soft)', color: 'var(--good)', fontWeight: 700, fontSize: 14 }}>
            <IconCheck size={16} /> {celebration}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default NutritionChecklist
