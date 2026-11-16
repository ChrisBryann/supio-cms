export const DEFAULT_NEXT = '/my-seminars'

/**
 * Only allow a relative path on the frontend, to prevent open redirects.
 * Accepts "/seminars/abc?x=1#y"; rejects "//evil.com", "/\\evil.com", "https://…", "javascript:…",
 * and anything with control characters or that is suspiciously long.
 */
export const safeNext = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_NEXT
  if (value.length === 0 || value.length > 512) return DEFAULT_NEXT
  if (!value.startsWith('/')) return DEFAULT_NEXT
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_NEXT
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return DEFAULT_NEXT

  // Final check: resolving against a dummy origin must stay on that origin.
  try {
    const resolved = new URL(value, 'https://frontend.invalid')
    if (resolved.origin !== 'https://frontend.invalid') return DEFAULT_NEXT
  } catch {
    return DEFAULT_NEXT
  }
  return value
}
