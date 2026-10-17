import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { DEFAULT_SETTINGS } from '../../db/defaults'
import { exportJson, exportZip, importFile } from '../exportImport'

describe('export / import', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map(t => t.clear()))
    await db.settings.put({ ...DEFAULT_SETTINGS, name: 'Rich', onboarded: true })
    await db.bodyWeights.bulkPut([{ id: 'w1', date: '2026-10-01', kg: 75 }, { id: 'w2', date: '2026-10-08', kg: 74.6 }])
    await db.exerciseStates.put({ exerciseId: 'bbHipThrust', loadMode: 'weight', currentLoad: 100, targetReps: 8, calibrated: true, consecutiveMisses: 0, bestE1rm: 133, bestLoad: 100, history: [], updatedAt: 1 })
  })

  it('exports every table with the sculpt marker and no photo blobs', async () => {
    await db.photos.put({ id: 'p1', date: '2026-10-01', takenAt: 1, pose: 'front', blob: new Blob(['abc']), thumb: new Blob(['a']), width: 1, height: 1, mirrored: false })
    const b = await exportJson()
    expect(b.app).toBe('sculpt')
    expect(b.schema).toBe(1)
    expect(b.data.bodyWeights).toHaveLength(2)
    expect(b.data.settings?.name).toBe('Rich')
    expect(b.data.photos[0]).not.toHaveProperty('blob')
    expect(b.data.photos[0].blobBytes).toBe(3)
  })

  it('rejects files that are not sculpt backups', async () => {
    const f = new File([JSON.stringify({ app: 'other', schema: 1, data: {} })], 'x.json', { type: 'application/json' })
    await expect(importFile(f, 'merge')).rejects.toThrow(/Not a Sculpt backup/)
  })

  it('merges json and replaces with zip (photos re-attached)', async () => {
    await db.photos.put({ id: 'p1', date: '2026-10-01', takenAt: 1, pose: 'front', blob: new Blob(['abc']), thumb: new Blob(['a']), width: 1, height: 1, mirrored: false })
    const json = await exportJson()
    const zip = await exportZip()
    // wipe, then merge the JSON on top of a different weigh-in
    await Promise.all(db.tables.map(t => t.clear()))
    await db.bodyWeights.put({ id: 'w9', date: '2026-10-15', kg: 74 })
    const r = await importFile(new File([JSON.stringify(json)], 'b.json', { type: 'application/json' }), 'merge')
    expect(r.bodyWeights).toBe(2)
    expect(r.photosSkipped).toBe(1)
    expect(await db.bodyWeights.count()).toBe(3)
    expect(await db.photos.count()).toBe(0)
    // replace from zip
    const r2 = await importFile(new File([zip], 'b.zip', { type: 'application/zip' }), 'replace')
    expect(r2.mode).toBe('replace')
    expect(r2.photos).toBe(1)
    expect(await db.bodyWeights.count()).toBe(2)
    const p = await db.photos.get('p1')
    expect(p?.blob.size).toBe(3)
    expect((await db.settings.get('settings'))?.name).toBe('Rich')
  })
})
