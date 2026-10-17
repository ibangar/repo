import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconChevronLeft, IconMinus, IconPlus } from './Icons'
import { haptic } from '../../lib/haptics'
import { useNavigate } from 'react-router-dom'

// ── Button ──
type Variant = 'primary' | 'upper' | 'ghost' | 'subtle' | 'danger' | 'good' | 'default'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; block?: boolean; size?: 'sm' | 'md' | 'lg'; icon?: boolean; pulse?: boolean
}
export function Button({ variant = 'default', block, size = 'md', icon, pulse, className = '', onClick, ...rest }: ButtonProps) {
  const cls = ['btn', variant !== 'default' && `btn--${variant}`, block && 'btn--block', size !== 'md' && `btn--${size}`, icon && 'btn--icon', pulse && 'btn--pulse', className].filter(Boolean).join(' ')
  return <button className={cls} onClick={e => { haptic.tap(); onClick?.(e) }} {...rest} />
}

// ── Card ──
export function Card({ children, className = '', glow, upper, onClick, style }: { children: ReactNode; className?: string; glow?: boolean; upper?: boolean; onClick?: () => void; style?: React.CSSProperties }) {
  const cls = ['card', glow && 'card--glow', upper && 'card--upper', onClick && 'card--interactive', className].filter(Boolean).join(' ')
  return <div className={cls} onClick={onClick} style={style} role={onClick ? 'button' : undefined}>{children}</div>
}

export function Pill({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: 'default' | 'accent' | 'upper' | 'good' | 'gold' | 'bad'; className?: string }) {
  return <span className={`pill ${tone !== 'default' ? `pill--${tone}` : ''} ${className}`}>{children}</span>
}

// ── Page header ──
export function PageHeader({ eyebrow, title, subtitle, back, right, big }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; back?: boolean | string; right?: ReactNode; big?: boolean }) {
  const nav = useNavigate()
  return (
    <header className="stack" style={{ gap: 6, marginBottom: 18 }}>
      {back && (
        <button className="row" style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 14, minHeight: 36, marginLeft: -6 }} onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
          <IconChevronLeft size={20} /> Back
        </button>
      )}
      <div className="row-between">
        <div className="grow">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 className={big ? 'title-lg' : 'title'} style={{ marginTop: eyebrow ? 4 : 0 }}>{title}</h1>
          {subtitle && <p className="body mt-8">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}

// ── Segmented ──
export function Segmented<T extends string>({ value, onChange, options, accent }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; accent?: boolean }) {
  return (
    <div className={`seg ${accent ? 'seg--accent' : ''}`} role="tablist">
      {options.map(o => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={`seg__item ${o.value === value ? 'seg__item--on' : ''}`} onClick={() => { haptic.tap(); onChange(o.value) }}>{o.label}</button>
      ))}
    </div>
  )
}

// ── Toggle ──
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button className={`toggle ${on ? 'toggle--on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => { haptic.tap(); onChange(!on) }}>
      <span className="toggle__knob" />
    </button>
  )
}

export function ToggleRow({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-item">
      <div className="grow"><div style={{ fontWeight: 700 }}>{label}</div>{hint && <div className="small">{hint}</div>}</div>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  )
}

// ── Stepper (numeric with +/−) ──
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, suffix, big, allowEmpty }: { value: number | null; onChange: (v: number | null) => void; step?: number; min?: number; max?: number; decimals?: number; suffix?: string; big?: boolean; allowEmpty?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(round(value, decimals))) }, [value, decimals])
  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'))
    if (Number.isNaN(n)) {
      if (allowEmpty) { onChange(null); return }
      // Not allowed to be empty: the value is unchanged, so re-show it instead of leaving the field blank.
      setText(value == null ? '' : String(round(value, decimals)))
      return
    }
    const next = clamp(round(n, decimals), min, max)
    // Normalise what's shown (clamped / rounded) even when the parent value doesn't change.
    setText(String(next))
    onChange(next)
  }
  const bump = (d: number) => { haptic.tap(); const base = value ?? 0; onChange(clamp(round(base + d, decimals), min, max)) }
  return (
    <div className="stepper" style={big ? { transform: 'scale(1.08)', transformOrigin: 'left' } : undefined}>
      <button className="stepper__btn" onClick={() => bump(-step)} aria-label="decrease"><IconMinus size={20} /></button>
      <input className="stepper__val num" inputMode="decimal" value={text}
        onFocus={e => { focused.current = true; e.target.select() }}
        onChange={e => setText(e.target.value)}
        onBlur={() => { focused.current = false; commit(text) }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
      {suffix && <span className="small" style={{ paddingRight: 8, marginLeft: -6 }}>{suffix}</span>}
      <button className="stepper__btn" onClick={() => bump(step)} aria-label="increase"><IconPlus size={20} /></button>
    </div>
  )
}
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n))

// ── Field ──
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="label">{label}</span>{children}{hint && <span className="tiny">{hint}</span>}</label>
}
export function Input(props: InputHTMLAttributes<HTMLInputElement> & { big?: boolean }) {
  const { big, className = '', ...rest } = props
  return <input className={`input ${big ? 'input--big' : ''} ${className}`} {...rest} />
}

// ── Bottom sheet ──
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet__grab" />
        {title && <h2 className="title" style={{ marginBottom: 14 }}>{title}</h2>}
        {children}
      </div>
    </>, document.body)
}

// ── Empty state ──
export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card center stack" style={{ padding: 32, alignItems: 'center' }}>
      {icon && <div style={{ color: 'var(--muted)' }}>{icon}</div>}
      <div className="subtitle">{title}</div>
      {body && <p className="body">{body}</p>}
      {action}
    </div>
  )
}

// ── Animated number ──
export function AnimatedNumber({ value, decimals = 0, duration = 700, className = '' }: { value: number; decimals?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration), e = 1 - Math.pow(1 - p, 3)
      setShown(a + (b - a) * e)
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={`num ${className}`}>{shown.toFixed(decimals)}</span>
}

// ── Progress ring ──
export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} style={{ transition: 'stroke-dashoffset 0.8s var(--ease-out)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  )
}

export function Spinner() {
  return <div className="breathe" style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--surface-3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
}
