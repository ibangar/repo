import { useEffect, useState, type ReactNode } from 'react'
import { Button, Card, Input, Sheet, Stepper } from '../ui'
import { IconChevronRight } from '../ui/Icons'
import { haptic } from '../../lib/haptics'

/** Titled group of rows. */
export function Group({ title, hint, children, className = '' }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`stack ${className}`} style={{ gap: 8 }}>
      <div style={{ padding: '0 4px' }}>
        <div className="eyebrow">{title}</div>
        {hint && <div className="small mt-8">{hint}</div>}
      </div>
      <Card style={{ paddingTop: 4, paddingBottom: 4 }}>{children}</Card>
    </section>
  )
}

export function Row({ label, hint, value, onClick, chevron, danger, children, top }: {
  label: string; hint?: string; value?: ReactNode; onClick?: () => void; chevron?: boolean; danger?: boolean; children?: ReactNode; top?: boolean
}) {
  const inner = (
    <>
      <div className="grow" style={top ? { alignSelf: 'flex-start', paddingTop: 10 } : undefined}>
        <div style={{ fontWeight: 700, color: danger ? 'var(--bad)' : undefined }}>{label}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
      {value != null && <div className="body num" style={{ fontWeight: 700, color: 'var(--text)' }}>{value}</div>}
      {children}
      {chevron && <IconChevronRight size={20} style={{ color: 'var(--muted)', flex: 'none' }} />}
    </>
  )
  if (onClick) {
    return (
      <button className="list-item" style={{ width: '100%', textAlign: 'left', color: 'inherit' }} onClick={() => { haptic.tap(); onClick() }}>{inner}</button>
    )
  }
  return <div className="list-item" style={top ? { alignItems: 'flex-start' } : undefined}>{inner}</div>
}

/** A row whose control sits on its own line (for wide controls such as Segmented). */
export function StackedRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

export function StepperRow({ label, hint, value, onChange, step, min, max, decimals, suffix, allowEmpty }: {
  label: string; hint?: string; value: number | null; onChange: (v: number | null) => void
  step?: number; min?: number; max?: number; decimals?: number; suffix?: string; allowEmpty?: boolean
}) {
  return (
    <div className="list-item" style={{ flexWrap: 'wrap' }}>
      <div className="grow" style={{ minWidth: 110 }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
      <StepperBox><Stepper value={value} onChange={onChange} step={step} min={min} max={max} decimals={decimals} suffix={suffix} allowEmpty={allowEmpty} /></StepperBox>
    </div>
  )
}

/**
 * The shared Stepper's input has a wide intrinsic width; a fixed-width grid
 * wrapper makes it shrink-to-fit (fill = stretch to the parent instead).
 */
export function StepperBox({ children, fill, width = 200 }: { children: ReactNode; fill?: boolean; width?: number }) {
  return <div style={{ display: 'grid', width: fill ? '100%' : width, flex: 'none', maxWidth: '100%' }}>{children}</div>
}

/** Text row committing on blur / Enter. */
export function TextRow({ label, hint, value, onCommit, placeholder, type = 'text', inputMode }: {
  label: string; hint?: string; value: string; onCommit: (v: string) => void; placeholder?: string; type?: string; inputMode?: 'text' | 'numeric' | 'decimal'
}) {
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])
  return (
    <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {hint && <div className="small">{hint}</div>}
      </div>
      <Input value={text} placeholder={placeholder} type={type} inputMode={inputMode}
        onChange={e => setText(e.target.value)}
        onBlur={() => { if (text !== value) onCommit(text) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
    </div>
  )
}

/** Confirmation bottom sheet. */
export function ConfirmSheet({ open, onClose, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, children }: {
  open: boolean; onClose: () => void; title: string; body?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; onConfirm: () => void; children?: ReactNode
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <p className="body" style={{ marginBottom: 16 }}>{body}</p>}
      {children}
      <div className="stack" style={{ marginTop: 8 }}>
        <Button block size="lg" variant={danger ? 'danger' : 'primary'} onClick={() => { if (danger) haptic.warn(); onConfirm() }}>{confirmLabel}</Button>
        <Button block variant="subtle" onClick={onClose}>{cancelLabel}</Button>
      </div>
    </Sheet>
  )
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_LABELS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Day-of-week picker (0 = Sunday). */
export function DayPicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="seg seg--accent" role="tablist" aria-label="Day of week">
      {DAY_LABELS.map((l, i) => (
        <button key={l} role="tab" aria-selected={i === value} className={`seg__item ${i === value ? 'seg__item--on' : ''}`} style={{ fontSize: 12, padding: 0 }}
          onClick={() => { haptic.tap(); onChange(i) }}>{l[0]}</button>
      ))}
    </div>
  )
}

export const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`
