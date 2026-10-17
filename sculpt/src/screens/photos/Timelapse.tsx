import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Pose } from '../../db/types'
import { Button, Empty, PageHeader, Pill, Segmented } from '../../components/ui'
import { IconCamera, IconPause, IconPlay, IconRotate, IconSkip } from '../../components/ui/Icons'
import { PoseSelector } from '../../components/photos/PoseSelector'
import { fmtDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { byPose, getLastPose, POSE_LABEL, useObjectUrls, usePhotos } from '../../lib/photos'
import { daysBetween } from '../../engine/schedule'
import '../../components/photos/photos.css'

type Speed = 'slow' | 'normal' | 'fast'
const SPEED_MS: Record<Speed, number> = { slow: 1200, normal: 600, fast: 300 }

export default function Timelapse() {
  const nav = useNavigate()
  const photos = usePhotos()
  const [pose, setPose] = useState<Pose>(getLastPose)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [i, setI] = useState(0)

  const frames = useMemo(() => (photos ? byPose(photos, pose) : []), [photos, pose])
  // Object URLs for every frame of the current pose (full-size blobs), created lazily per pose and revoked on change/unmount.
  const urls = useObjectUrls(frames.length >= 2 ? frames : undefined, 'blob')

  // Warm the decoder so crossfades don't stutter.
  useEffect(() => {
    const imgs = Object.values(urls).map(u => { const im = new Image(); im.src = u; return im })
    return () => imgs.forEach(im => { im.src = '' })
  }, [urls])

  useEffect(() => { setI(0); setPlaying(false) }, [pose])

  useEffect(() => {
    if (!playing || frames.length < 2) return
    const id = window.setInterval(() => {
      setI(cur => {
        if (cur + 1 < frames.length) return cur + 1
        if (loop) return 0
        setPlaying(false)
        return cur
      })
    }, SPEED_MS[speed])
    return () => clearInterval(id)
  }, [playing, speed, loop, frames.length])

  // Keep the previous frame fully opaque underneath while the next fades in – a true crossfade, no dip to background.
  const frame = frames[Math.min(i, frames.length - 1)] as (typeof frames)[number] | undefined
  const [stack, setStack] = useState<{ prev?: string; cur?: string }>({})
  useEffect(() => { if (frame) setStack(s => (s.cur === frame.id ? s : { prev: s.cur, cur: frame.id })) }, [frame])

  if (!photos) return <div className="page" />
  const prevUrl = stack.prev ? urls[stack.prev] : undefined
  const span = frames.length >= 2 ? daysBetween(frames[0].date, frames[frames.length - 1].date) : 0
  const fade = Math.min(0.45, SPEED_MS[speed] * 0.0006)

  return (
    <div className="page stack-lg">
      <PageHeader back="/photos" title="Timelapse" subtitle="Watch the change happen, one day at a time." />
      <PoseSelector value={pose} onChange={setPose} />

      {frames.length < 2 || !frame ? (
        <Empty icon={<IconCamera size={36} />} title={`Need at least two ${POSE_LABEL[pose].toLowerCase()} photos`}
          body={frames.length === 1 ? 'One down – take the next one and the timelapse comes alive.' : 'Shoot this pose on a few different days to play it back.'}
          action={<Button variant="primary" onClick={() => nav('/photos/capture')}><IconCamera size={18} /> Take a photo</Button>} />
      ) : (
        <>
          <div className="tl-frame">
            {prevUrl && <img src={prevUrl} alt="" aria-hidden />}
            <motion.img key={frame.id} src={urls[frame.id]} alt={`${POSE_LABEL[pose]} ${frame.date}`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: fade, ease: 'linear' }} />
            <div className="tl-frame__counter num">{i + 1} / {frames.length}</div>
            <div className="tl-frame__date">{fmtDate(frame.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <input className="ph-range ph-range--accent" type="range" min={0} max={frames.length - 1} step={1} value={i}
              onChange={e => { setPlaying(false); setI(Number(e.target.value)) }} aria-label="Scrub frames" />
            <div className="tl-ticks num"><span>{fmtDate(frames[0].date, { day: 'numeric', month: 'short' })}</span><span>{span} days</span><span>{fmtDate(frames[frames.length - 1].date, { day: 'numeric', month: 'short' })}</span></div>
          </div>

          <div className="tl-controls">
            <button className={`tl-ctl ${loop ? 'tl-ctl--on' : ''}`} onClick={() => { haptic.tap(); setLoop(l => !l) }} aria-pressed={loop} aria-label="Loop"><IconRotate /></button>
            <button className="tl-play" onClick={() => { haptic.tap(); if (!playing && i >= frames.length - 1) setI(0); setPlaying(p => !p) }} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <button className="tl-ctl" onClick={() => { haptic.tap(); setPlaying(false); setI(n => (n + 1) % frames.length) }} aria-label="Next frame"><IconSkip /></button>
          </div>

          <Segmented<Speed> value={speed} onChange={setSpeed} options={[{ value: 'slow', label: 'Slow · 1.2s' }, { value: 'normal', label: 'Normal · 0.6s' }, { value: 'fast', label: 'Fast · 0.3s' }]} />

          <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Pill><span className="num">{frames.length}</span> frames</Pill>
            <Pill tone="accent"><span className="num">{span}</span> days of work</Pill>
          </div>
        </>
      )}
    </div>
  )
}
