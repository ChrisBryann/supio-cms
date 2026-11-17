import type { PayloadRequest } from 'payload'

/**
 * The viewer's IP as seen by this server.
 * On Vercel, `x-real-ip` / the first `x-forwarded-for` entry are set by Vercel's edge
 * (client-supplied values are overwritten), so they are trustworthy there.
 * Note: if a server (e.g. the Next.js frontend) calls us on the viewer's behalf, this is
 * that server's IP, which is why the play endpoint should be called from the browser.
 */
export const getRequestIp = (req: PayloadRequest): string | null => {
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || null
}
