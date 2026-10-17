import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, Card, PageHeader, Pill, Segmented } from '../../components/ui'
import { IconDownload, IconImage, IconInfo, IconUpload } from '../../components/ui/Icons'
import { ConfirmSheet } from '../../components/settings/Rows'
import { db } from '../../db/schema'
import { useSettings } from '../../hooks/useSettings'
import {
  backupFilename, canShareFiles, downloadBlob, exportJson, exportZip, formatBytes, importFile, photoFootprint,
  requestPersistence, shareBlob, storageInfo, type ImportMode, type ImportReport, type StorageInfo,
} from '../../lib/exportImport'
import { haptic } from '../../lib/haptics'
import { sound } from '../../lib/sound'

type Busy = null | 'json' | 'zip' | 'import'

export default function DataScreen() {
  const settings = useSettings()
  const [busy, setBusy] = useState<Busy>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [mode, setMode] = useState<ImportMode>('merge')
  const [pending, setPending] = useState<File | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [persistMsg, setPersistMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const share = canShareFiles()

  const photos = useLiveQuery(() => photoFootprint(), [])
  const counts = useLiveQuery(async () => ({
    sessions: await db.sessions.count(), prs: await db.prs.count(), weights: await db.bodyWeights.count(), measurements: await db.measurements.count(), nutrition: await db.nutrition.count(),
  }), [])

  const refreshStorage = () => { void storageInfo().then(setStorage) }
  useEffect(() => { refreshStorage() }, [])

  if (!settings) return <div className="page" />

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return
    setBusy(kind); setError(null); setProgress('')
    try { await fn() } catch (e) { setError((e as Error).message || String(e)); haptic.warn() } finally { setBusy(null); setProgress('') }
  }

  const exportAs = (ext: 'json' | 'zip', how: 'download' | 'share') => run(ext, async () => {
    setProgress(ext === 'zip' ? 'Packing photos…' : 'Collecting data…')
    const blob = ext === 'json'
      ? new Blob([JSON.stringify(await exportJson(), null, 1)], { type: 'application/json' })
      : await exportZip(pct => setProgress(`Packing… ${Math.round(pct)}%`))
    const name = backupFilename(ext)
    if (how === 'share') await shareBlob(blob, name); else downloadBlob(blob, name)
    haptic.success()
  })

  const onPick = (f: File | undefined) => {
    if (!f) return
    setReport(null); setError(null)
    if (mode === 'replace') setPending(f); else void doImport(f)
  }
  const doImport = (f: File) => run('import', async () => {
    const r = await importFile(f, mode, setProgress)
    setReport(r); haptic.done(); sound.complete()
    refreshStorage()
    setTimeout(() => { window.location.href = import.meta.env.BASE_URL + (import.meta.env.VITE_TARGET === 'artifact' ? '#/' : '') }, 2200)
  })

  const persist = async () => {
    const ok = await requestPersistence()
    setPersistMsg(ok ? 'Granted – the browser will try not to evict Sculpt.' : 'Not granted. On iOS this is decided by Safari; install to the Home Screen and open the app regularly.')
    refreshStorage()
  }

  const usagePct = storage && storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0

  return (
    <div className="page">
      <PageHeader back="/settings" eyebrow="Data" title="Backup & restore" subtitle="Everything lives in this browser's storage. Export regularly – especially before updating iOS." />
      <div className="stack-lg stagger">
        <Card>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <IconDownload size={22} style={{ color: 'var(--accent-2)' }} />
            <div className="grow"><div className="subtitle">Export JSON</div><div className="small">Settings, program, sessions, PRs, weigh-ins, measurements, nutrition. Photo info without the images.</div></div>
          </div>
          {counts && <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            <Pill>{counts.sessions} sessions</Pill><Pill>{counts.prs} PRs</Pill><Pill>{counts.weights} weigh-ins</Pill><Pill>{counts.measurements} measurements</Pill><Pill>{counts.nutrition} nutrition days</Pill>
          </div>}
          <div className="row">
            <Button variant="upper" className="grow" disabled={!!busy} onClick={() => exportAs('json', 'download')}>{busy === 'json' ? progress || 'Working…' : 'Download .json'}</Button>
            {share && <Button variant="ghost" disabled={!!busy} onClick={() => exportAs('json', 'share')}>Share…</Button>}
          </div>
        </Card>

        <Card glow>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <IconImage size={22} style={{ color: 'var(--accent)' }} />
            <div className="grow"><div className="subtitle">Full backup with photos</div><div className="small">A .zip with the JSON plus every progress photo and thumbnail.</div></div>
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 12 }}>
            <Pill tone="accent">{photos?.count ?? 0} photos</Pill><Pill>≈ {formatBytes(photos?.bytes ?? 0)}</Pill>
          </div>
          <div className="row">
            <Button variant="primary" className="grow" disabled={!!busy} onClick={() => exportAs('zip', 'download')}>{busy === 'zip' ? progress || 'Packing…' : 'Download .zip'}</Button>
            {share && <Button variant="ghost" disabled={!!busy} onClick={() => exportAs('zip', 'share')}>Share…</Button>}
          </div>
          {share && <div className="tiny mt-8">Share… lets you AirDrop the file or save it straight into Files / iCloud Drive.</div>}
        </Card>

        <Card>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <IconUpload size={22} style={{ color: 'var(--good)' }} />
            <div className="grow"><div className="subtitle">Import</div><div className="small">Accepts a .json or .zip made by Sculpt. Photos are re-attached from the zip.</div></div>
          </div>
          <Segmented value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge' }, { value: 'replace', label: 'Replace everything' }]} />
          <div className="tiny mt-8">{mode === 'merge' ? 'Records with the same id are overwritten; everything else is kept.' : 'All tables on this device are cleared first, then the backup is written.'}</div>
          <input ref={fileRef} type="file" accept=".json,.zip,application/json,application/zip,application/x-zip-compressed" style={{ display: 'none' }}
            onChange={e => { onPick(e.target.files?.[0]); e.target.value = '' }} />
          <Button variant="good" block className="mt-16" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'import' ? progress || 'Importing…' : 'Choose backup file'}</Button>
          {busy === 'import' && <div className="progress mt-8"><div className="progress__bar shimmer" style={{ width: '100%' }} /></div>}
          {error && <div className="small mt-8" style={{ color: 'var(--bad)' }}>{error}</div>}
          {report && (
            <div className="mt-16 pop" style={{ background: 'var(--good-soft)', borderRadius: 12, padding: 12 }}>
              <div style={{ fontWeight: 800, color: 'var(--good)' }}>Imported ({report.mode})</div>
              <div className="small" style={{ color: 'var(--text-2)' }}>
                {report.sessions} sessions · {report.exerciseStates} exercise states · {report.prs} PRs · {report.bodyWeights} weigh-ins · {report.measurements} measurements · {report.nutrition} nutrition days · {report.photos} photos
                {report.photosSkipped ? ` (${report.photosSkipped} photo records had no image data)` : ''}{report.settings ? ' · settings' : ''}{report.program ? ' · program' : ''}
              </div>
              <div className="tiny mt-8">Reloading…</div>
            </div>
          )}
        </Card>

        <Card>
          <div className="row" style={{ gap: 12, marginBottom: 12 }}>
            <IconInfo size={22} style={{ color: 'var(--gold)' }} />
            <div className="grow"><div className="subtitle">Storage</div><div className="small">What this browser has set aside for Sculpt.</div></div>
          </div>
          {storage?.supported ? (
            <>
              <div className="row-between"><span className="small">Used</span><span className="num" style={{ fontWeight: 800 }}>{formatBytes(storage.usage)} <span className="small">of {formatBytes(storage.quota)}</span></span></div>
              <div className="progress mt-8"><div className="progress__bar" style={{ width: `${Math.max(1, usagePct)}%`, background: 'var(--grad-power)' }} /></div>
            </>
          ) : <div className="small">Storage estimates aren’t available in this browser.</div>}
          <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <Pill>{photos?.count ?? 0} photos · {formatBytes(photos?.bytes ?? 0)}</Pill>
            <Pill tone={storage?.persisted ? 'good' : 'gold'}>{storage?.persisted ? 'Persistent' : 'Best-effort storage'}</Pill>
          </div>
          <p className="small mt-16">
            iOS may evict a web app’s data if you haven’t opened it for a few weeks, and clearing Safari history can wipe it too. Persistent storage lowers the risk but is not a promise – export a full backup regularly.
          </p>
          {!storage?.persisted && <Button variant="subtle" block className="mt-16" onClick={persist}>Request persistent storage</Button>}
          {persistMsg && <div className="small mt-8" style={{ color: 'var(--text-2)' }}>{persistMsg}</div>}
        </Card>
      </div>

      <ConfirmSheet open={!!pending} onClose={() => setPending(null)} danger title="Replace everything?" confirmLabel="Erase and import"
        body={<>All data currently on this device is deleted, then <b>{pending?.name}</b> is restored. Export first if you’re not sure.</>}
        onConfirm={() => { const f = pending; setPending(null); if (f) void doImport(f) }} />
    </div>
  )
}
