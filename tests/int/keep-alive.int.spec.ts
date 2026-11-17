// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/keep-alive/route'

const call = (authorization?: string) =>
  GET(
    new NextRequest('http://localhost:3000/keep-alive', {
      headers: authorization ? { Authorization: authorization } : {},
    }),
  )

describe('GET /keep-alive authorization', () => {
  const original = process.env.CRON_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = original
  })

  it('fails closed when CRON_SECRET is not set (no "Bearer undefined" bypass)', async () => {
    delete process.env.CRON_SECRET
    expect((await call('Bearer undefined')).status).toBe(401)
    expect((await call('Bearer ')).status).toBe(401)
    expect((await call()).status).toBe(401)
  })

  it('rejects a wrong or missing secret', async () => {
    process.env.CRON_SECRET = 'correct-secret-value'
    expect((await call('Bearer wrong-secret-value')).status).toBe(401)
    expect((await call('Bearer correct-secret-valu')).status).toBe(401)
    expect((await call('correct-secret-value')).status).toBe(401)
    expect((await call()).status).toBe(401)
  })
})
