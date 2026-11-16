// @vitest-environment node
import { getPayload, Payload } from 'payload'

import { describe, it, beforeAll, expect } from 'vitest'

// Only runs against an explicit test database (see tests/int/seminars.int.spec.ts).
const TEST_DB = process.env.TEST_DATABASE_URI
if (TEST_DB) {
  process.env.DATABASE_URI = TEST_DB
  process.env.PAYLOAD_SECRET ||= 'test-secret-for-integration-tests-only'
}

let payload: Payload

describe.skipIf(!TEST_DB)('API', () => {
  beforeAll(async () => {
    const payloadConfig = await (await import('@/payload.config')).default
    payload = await getPayload({ config: payloadConfig })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
    })
    expect(users).toBeDefined()
  })
})
