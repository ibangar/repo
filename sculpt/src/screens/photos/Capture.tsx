import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Photo, Pose } from '../../db/types'
import { Button, Card } from '../../components/ui'
import { IconCamera, IconCheck, IconEye, IconEyeOff, IconImage, IconLock, IconRotate, IconTimer, IconX } from '../../components/ui/Icons'
import { PoseSelector } from '../../components/photos/PoseSelector'
import { haptic } from '../../lib/haptics'
import { buildPhoto, decodeFile, getLastPose, latestOf, POSE_LABEL, POSES, savePhoto, useObjectUrl, usePhotos } from '../../lib/photos'
import { isoDate } from '../../engine/schedule'
import '../../components/photos/photos.css'

type Facing = 'user' | 'environment'
type Phase = 'idle' | 'starting' | 'live' | 'denied' | 'nocamera'
const TIMERS = [0, 3, 10] as const
type Timer = (typeof TIMERS)[number]

const GHOST_KEY = 'sculpt.photos.ghost'
const readGhost = (): { on: boolean; opacity: number } => {
  try { const v = JSON.parse(localStorage.getItem(GHOST_KEY) ?? ''); if (v && typeof v.on === 'boolean') return { on: v.on, opacity: Math.min(60, Math.max(0, Number(v.opacity) || 30)) } } catch { /* default */ }
  return { on: true, opacity: 30 }
}

export default function Capture() {
  const nav = useNavigate()
  const photos = usePhotos()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [facing, setFacing] = useState<Facing>('user')
  const [pose, setPose] = useState<Pose>(getLastPose)
  const [ghost, setGhost] = useState(readGhost)
  const [timer, setTimer] = useState<Timer>(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const [review, setReview] = useState<Photo | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ next?: Pose } | null>(null)

  const ghostPhoto = photos ? latestOf(photos, pose) : undefined
  const ghostUrl = useObjectUrl(ghost.on ? ghostPhoto?.blob : undefined)
  const reviewUrl = useObjectUrl(review?.blob)
  const mirror = facing === 'user'

  useEffect(() => { try { localStorage.setItem(GHOST_KEY, JSON.stringify(ghost)) } catch { /* ignore */ } }, [ghost])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const start = useCallback(async (f: Facing) => {
    stop()
    setPhase('starting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('no camera', 'NotFoundError')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: f, width: { ideal: 1080 }, height: { ideal: 1920 } } })
      streamRef.current = stream
      const v = videoRef.current
      if (!v) { stream.getTracks().forEach(t => t.stop()); return }
      v.srcObject = stream
      await v.play().catch(() => { /* autoplay attr will handle it */ })
      setPhase('live')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError' ? 'denied' : 'nocamera')
    }
  }, [stop])

  useEffect(() => () => stop(), [stop])
  // Pause the camera while the app is backgrounded.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'hidden' && phase === 'live') { stop(); setPhase('idle') } }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [phase, stop])

  const flip = () => { const f: Facing = facing === 'user' ? 'environment' : 'user'; setFacing(f); if (phase === 'live' || phase === 'starting') void start(f) }

  const capture = useCallback(async () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    setFlash(true); haptic.success()
    window.setTimeout(() => setFlash(false), 450)
    setBusy(true)
    try { setReview(await buildPhoto(v, v.videoWidth, v.videoHeight, pose, mirror)) }
    finally { setBusy(false) }
  }, [pose, mirror])

  const shutter = () => {
    if (countdown !== null) { setCountdown(null); return } // cancel
    if (timer === 0) { void capture(); return }
    haptic.tap(); setCountdown(timer)
  }
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) { setCountdown(null); void capture(); return }
    const id = window.setTimeout(() => { haptic.tap(); setCountdown(c => (c === null ? null : c - 1)) }, 1000)
    return () => clearTimeout(id)
  }, [countdown, capture])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      const d = await decodeFile(file)
      try { setReview(await buildPhoto(d.src, d.width, d.height, pose, false)) } finally { d.release() }
    } catch { /* unreadable file – ignore */ }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const keep = async () => {
    if (!review) return
    await savePhoto(review)
    haptic.done()
    const today = isoDate()
    const done = new Set((photos ?? []).filter(p => p.date === today).map(p => p.pose)); done.add(review.pose)
    const next = POSES.find(p => !done.has(p))
    setReview(null)
    setToast({ next })
    window.setTimeout(() => setToast(null), 3200)
  }

  const cycleTimer = () => { haptic.tap(); setTimer(t => TIMERS[(TIMERS.indexOf(t) + 1) % TIMERS.length]) }
  const changePose = (p: Pose) => { setPose(p); if (review) setReview({ ...review, pose: p }) }

  return (
    <div className={`cap ${mirror ? 'cap--mirror' : ''}`}>
      <div className="cap__stage">
        <video ref={videoRef} className="cap__video" playsInline muted autoPlay style={{ opacity: phase === 'live' ? 1 : 0 }} />
        {phase === 'live' && ghost.on && ghostUrl && <img className="cap__ghost" src={ghostUrl} alt="" style={{ opacity: ghost.opacity / 100 }} />}
        {phase === 'live' && <Grid />}
      </div>

      {(phase === 'idle' || phase === 'starting' || phase === 'denied' || phase === 'nocamera') && (
        <div className="cap__idle">
          {phase === 'denied' || phase === 'nocamera' ? (
            <Card glow style={{ maxWidth: 340, textAlign: 'left' }}>
              <div className="stack">
                <div className="row"><IconCamera size={22} style={{ color: 'var(--accent)' }} /><div className="subtitle">{phase === 'denied' ? 'Camera access is off' : 'No camera found'}</div></div>
                <p className="body">{phase === 'denied'
                  ? 'Allow camera access for Sculpt in your browser or phone settings, then try again. Or add a photo from your library.'
                  : 'This device has no usable camera. You can still add progress photos from your library.'}</p>
                <Button variant="primary" block onClick={() => void start(facing)}><IconRotate size={18} /> Try again</Button>
                <Button variant="subtle" block onClick={() => fileRef.current?.click()}><IconImage size={18} /> Upload from library</Button>
              </div>
            </Card>
          ) : (
            <>
              <motion.div className="cap__idle-ring" animate={phase === 'starting' ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 1.2 }}><IconCamera /></motion.div>
              <div className="stack" style={{ gap: 6 }}>
                <h1 className="title-lg">{phase === 'starting' ? 'Opening camera…' : 'Progress shot'}</h1>
                <p className="body">Same spot, same light. Front, side, back.</p>
              </div>
              <div style={{ width: '100%', maxWidth: 320 }}><PoseSelector value={pose} onChange={changePose} /></div>
              <Button variant="primary" size="lg" block style={{ maxWidth: 320 }} pulse disabled={phase === 'starting'} onClick={() => void start(facing)}><IconCamera size={22} /> Open camera</Button>
              <Button variant="ghost" block style={{ maxWidth: 320 }} onClick={() => fileRef.current?.click()}><IconImage size={18} /> Upload from library</Button>
              <span className="ph-privacy"><IconLock /> Never leaves this phone</span>
            </>
          )}
        </div>
      )}

      <div className="cap__top">
        <button className="ph-iconbtn" onClick={() => { haptic.tap(); nav('/photos') }} aria-label="Close"><IconX /></button>
        {phase === 'live' && <PoseSelector value={pose} onChange={changePose} accent={false} />}
        {phase === 'live' && (
          <button className={`cap__chip ${timer ? 'cap__chip--on' : ''}`} onClick={cycleTimer} aria-label={`Timer ${timer} seconds`}><IconTimer /> {timer ? `${timer}s` : 'Off'}</button>
        )}
      </div>

      {phase === 'live' && (
        <div className="cap__bottom">
          <div className="cap__tools">
            <button className={`cap__chip ${ghost.on ? 'cap__chip--on' : ''}`} onClick={() => { haptic.tap(); setGhost(g => ({ ...g, on: !g.on })) }} aria-pressed={ghost.on}>
              {ghost.on ? <IconEye /> : <IconEyeOff />} Ghost{ghost.on && ghostPhoto ? ` ${ghost.opacity}%` : ''}
            </button>
            {ghost.on && ghostPhoto && (
              <input className="ph-range ph-range--light grow" type="range" min={0} max={60} step={5} value={ghost.opacity}
                onChange={e => setGhost(g => ({ ...g, opacity: Number(e.target.value) }))} aria-label="Ghost opacity" />
            )}
            {ghost.on && !ghostPhoto && <span className="small" style={{ color: 'rgba(255,255,255,0.6)' }}>No {POSE_LABEL[pose].toLowerCase()} photo yet to align to</span>}
          </div>
          <div className="cap__row">
            <button className="cap__side" onClick={() => { haptic.tap(); fileRef.current?.click() }} aria-label="Upload from library"><IconImage /></button>
            <button className={`cap__shutter ${countdown !== null ? 'cap__shutter--armed' : ''}`} onClick={shutter} disabled={busy} aria-label={countdown !== null ? 'Cancel' : 'Take photo'} />
            <button className="cap__side" onClick={() => { haptic.tap(); flip() }} aria-label="Flip camera"><IconRotate /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {countdown !== null && countdown > 0 && (
          <div className="cap__count">
            <motion.div key={countdown} className="cap__digit num" initial={{ scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}>
              {countdown}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {flash && <div className="cap__flash" />}

      <AnimatePresence>
        {toast && (
          <motion.div className="cap__toast" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}>
            <IconCheck size={16} /> Saved
            {toast.next && <button onClick={() => { changePose(toast.next!); setToast(null) }}>Next: {POSE_LABEL[toast.next]} →</button>}
          </motion.div>
        )}
      </AnimatePresence>

      {review && (
        <div className="cap__review">
          {reviewUrl && <img src={reviewUrl} alt="Review" />}
          <div className="cap__top" style={{ justifyContent: 'center' }}><span className="cap__chip">{review.width}×{review.height} · {POSE_LABEL[review.pose]}</span></div>
          <div className="cap__review-foot">
            <PoseSelector value={review.pose} onChange={changePose} accent={false} />
            <div className="row" style={{ gap: 10 }}>
              <Button variant="subtle" block size="lg" onClick={() => setReview(null)}><IconRotate size={20} /> Retake</Button>
              <Button variant="primary" block size="lg" onClick={() => void keep()}><IconCheck size={22} /> Keep</Button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void onFile(e.target.files?.[0])} />
    </div>
  )
}

/** Rule-of-thirds grid + a brighter centre line. */
function Grid() {
  return (
    <svg className="cap__grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <g stroke="rgba(255,255,255,0.28)" strokeWidth={0.3} vectorEffect="non-scaling-stroke">
        <line x1="33.33" y1="0" x2="33.33" y2="100" /><line x1="66.66" y1="0" x2="66.66" y2="100" />
        <line x1="0" y1="33.33" x2="100" y2="33.33" /><line x1="0" y1="66.66" x2="100" y2="66.66" />
      </g>
      <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,77,125,0.8)" strokeWidth={0.4} strokeDasharray="1.5 1.5" />
    </svg>
  )
}
