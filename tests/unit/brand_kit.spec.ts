import { test } from '@japa/runner'
import {
  BRAND_KITS,
  checkBrandSpelling,
  getBrandKit,
  validateBrandKit,
} from '../../shared/layout/brand.ts'

test.group('Brand kit (TPL-01)', () => {
  test('ships a published, immutable HumbleBee AI kit with a canonical name', ({ assert }) => {
    const kit = getBrandKit('humblebee', 1)!
    assert.equal(kit.name, 'HumbleBee AI')
    assert.equal(kit.status, 'published')
    assert.isTrue(Object.isFrozen(kit))
    assert.isTrue(Object.isFrozen(kit.palette))
    assert.throws(() => {
      ;(kit as { name: string }).name = 'Other'
    })
    assert.match(kit.palette.primary, /^#[0-9a-f]{6}$/i)
    assert.match(kit.palette.accent, /^#[0-9a-f]{6}$/i)
  })

  test('latest version resolves without a version; unknown kits are undefined', ({ assert }) => {
    assert.equal(getBrandKit('humblebee')!.version, Math.max(...BRAND_KITS.map((k) => k.version)))
    assert.isUndefined(getBrandKit('acme'))
    assert.isUndefined(getBrandKit('humblebee', 99))
  })

  test('the shipped kit validates with no errors', ({ assert }) => {
    assert.deepEqual(
      validateBrandKit(getBrandKit('humblebee')!).filter((f) => f.severity === 'error'),
      []
    )
  })

  test('missing logo, bad colours, variable fonts and unapproved status are findings', ({
    assert,
  }) => {
    const base = getBrandKit('humblebee')!
    const broken = {
      ...base,
      status: 'draft' as const,
      logo: undefined,
      palette: { ...base.palette, primary: 'navy' },
      fonts: [{ ...base.fonts[0], variable: true }],
    }
    const codes = validateBrandKit(broken).map((f) => f.code)
    assert.includeMembers(codes, [
      'logo_missing',
      'palette_invalid',
      'font_not_static',
      'kit_unapproved',
    ])
  })

  test('a published kit must name a contact field set and an approved logo asset id', ({
    assert,
  }) => {
    const base = getBrandKit('humblebee')!
    const codes = validateBrandKit({ ...base, contact: {} }).map((f) => f.code)
    assert.include(codes, 'contact_missing')
    // Asset references are registered ids, never remote URLs.
    const remote = validateBrandKit({
      ...base,
      logo: { assetId: 'https://evil.test/logo.png', kind: 'image' as const },
    })
    assert.include(
      remote.map((f) => f.code),
      'asset_not_registered'
    )
  })

  test('spelling check reports variants without rewriting text or touching other names', ({
    assert,
  }) => {
    const text =
      'Humblebee AI works with Humble Bee AI and HumbleBee AI. Humblebee Farms is separate.'
    const found = checkBrandSpelling(text, getBrandKit('humblebee')!)
    assert.deepEqual(
      found.map((f) => f.found),
      ['Humblebee AI', 'Humble Bee AI']
    )
    assert.isTrue(found.every((f) => f.canonical === 'HumbleBee AI'))
    assert.equal(found[0].from, 0)
    assert.equal(text.slice(found[1].from, found[1].to), 'Humble Bee AI')
  })
})
