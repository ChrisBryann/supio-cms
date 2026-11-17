// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toOrigin } from '@/lib/env'

describe('toOrigin (SERVER_URL / FRONTEND_URL normalisation)', () => {
  it.each([
    ['your-name.ngrok-free.app', 'https://your-name.ngrok-free.app'],
    ['https://cms.yoursite.com/', 'https://cms.yoursite.com'],
    ['  "https://cms.yoursite.com"  ', 'https://cms.yoursite.com'],
    ['localhost:3000', 'http://localhost:3000'],
    ['http://localhost:3001', 'http://localhost:3001'],
    ['127.0.0.1:3000', 'http://127.0.0.1:3000'],
  ])('%s → %s', (input, expected) => {
    expect(toOrigin('SERVER_URL', input)).toBe(expected)
  })

  it.each(['https://', 'ftp://cms.yoursite.com', 'https://exa mple.com'])('rejects %s with the variable name', (input) => {
    expect(() => toOrigin('SERVER_URL', input)).toThrow(/SERVER_URL/)
  })
})
