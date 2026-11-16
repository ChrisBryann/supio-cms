// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEFAULT_NEXT, safeNext } from '@/endpoints/oauth/safe-next'

describe('safeNext (open-redirect guard)', () => {
  it.each(['/seminars/some-slug', '/my-seminars', '/seminars/a?x=1#y', '/'])('keeps %s', (value) => {
    expect(safeNext(value)).toBe(value)
  })

  it.each([
    '//evil.com',
    '//evil.com/path',
    '/\\evil.com',
    'https://evil.com',
    'http:/evil.com',
    'javascript:alert(1)',
    'seminars/relative',
    '',
    '/a\nb',
    '/a\\b',
    `/${'a'.repeat(600)}`,
    null,
    undefined,
    42,
  ])('rejects %s', (value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT)
  })
})
