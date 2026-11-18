import type { PayloadRequest } from 'payload'
import { getFrontendUrl } from './env'

/** Cache tags the website accepts at POST /api/revalidate (keep in sync with its lib/cache-tags.ts). */
export type FrontendCacheTag = 'seminars' | 'legal-pages' | 'company-info'

const TIMEOUT_MS = 5_000

/**
 * Tells the website to drop its cached copies of `tags`, so a published change shows up right away
 * instead of at the site's next periodic refresh. Needs REVALIDATE_SECRET (same value on both
 * sides) and FRONTEND_URL. Never throws: if the call fails the change still saves, and the site
 * picks it up at its next periodic refresh.
 */
export const revalidateFrontend = async (req: PayloadRequest, tags: FrontendCacheTag[]) => {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    req.payload.logger.warn({ tags }, 'REVALIDATE_SECRET is not set: website not revalidated')
    return
  }
  try {
    const res = await fetch(`${getFrontendUrl()}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      req.payload.logger.warn({ tags, status: res.status }, 'Website revalidation failed')
    }
  } catch (err) {
    req.payload.logger.warn({ tags, err }, 'Website revalidation failed')
  }
}
