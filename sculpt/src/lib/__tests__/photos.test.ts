import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { groupByMonth, photoStreak } from '../photos'
import { hashPasscode, isValidPasscode, verifyAgainst } from '../passcode'
import type { Photo } from '../../db/types'

const blob = new Blob(['x'])
const photo = (date: string, pose: Photo['pose'] = 'front', hour = 9): Photo => {
  const [y, m, d] = date.split('-').map(Number)
  return { id: `${pose}-${date}-${hour}`, date, takenAt: new Date(y, m - 1, d, hour).getTime(), pose, blob, thumb: blob, width: 1, height: 1, mirrored: false }
}

describe('groupByMonth', () => {
  it('groups newest month first, newest photo first within a month', () => {
    const g = groupByMonth([photo('2026-09-30'), photo('2026-10-02'), photo('2026-10-17'), photo('2026-10-17', 'side', 18)])
    expect(g.map(x => x.key)).toEqual(['2026-10', '2026-09'])
    expect(g[0].photos.map(p => p.id)).toEqual(['side-2026-10-17-18', 'front-2026-10-17-9', 'front-2026-10-02-9'])
  })
})

describe('photoStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(photoStreak([photo('2026-10-17'), photo('2026-10-16', 'back'), photo('2026-10-15'), photo('2026-10-12')], '2026-10-17')).toBe(3)
  })
  it('still counts when today is not shot yet (ends yesterday)', () => {
    expect(photoStreak([photo('2026-10-16'), photo('2026-10-15')], '2026-10-17')).toBe(2)
  })
  it('is zero after a gap', () => {
    expect(photoStreak([photo('2026-10-14')], '2026-10-17')).toBe(0)
    expect(photoStreak([], '2026-10-17')).toBe(0)
  })
})

describe('passcode hashing', () => {
  it('stores salt:hex and verifies only the right code', async () => {
    const stored = await hashPasscode('4821')
    const [salt, hex] = stored.split(':')
    expect(salt).toHaveLength(32)
    expect(hex).toMatch(/^[0-9a-f]{64}$/)
    expect(stored).not.toContain('4821')
    expect(await verifyAgainst('4821', stored)).toBe(true)
    expect(await verifyAgainst('4822', stored)).toBe(false)
    expect(await verifyAgainst('4821', undefined)).toBe(false)
    expect(await verifyAgainst('4821', 'garbage')).toBe(false)
  })
  it('salts differ per call', async () => {
    expect((await hashPasscode('1234')).split(':')[0]).not.toBe((await hashPasscode('1234')).split(':')[0])
  })
  it('validates 4–6 digits', () => {
    expect(isValidPasscode('1234')).toBe(true)
    expect(isValidPasscode('123456')).toBe(true)
    expect(isValidPasscode('123')).toBe(false)
    expect(isValidPasscode('1234567')).toBe(false)
    expect(isValidPasscode('12a4')).toBe(false)
  })
})
