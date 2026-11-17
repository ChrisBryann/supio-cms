/**
 * Best-effort fixed-window rate limiter kept in memory.
 *
 * Limitation: on Vercel each serverless instance has its own memory, so the limit is per
 * instance, not global. It still stops a single client hammering one warm instance. For a
 * hard global limit, swap this for a shared store (e.g. Upstash Redis / Vercel KV).
 */
type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export const rateLimit = (
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } => {
  const now = Date.now()

  // occasional cleanup so the map can't grow without bound
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  }

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  bucket.count += 1
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { allowed: true, retryAfterSeconds: 0 }
}

/** Test helper. */
export const resetRateLimits = () => buckets.clear()
