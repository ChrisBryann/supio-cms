/**
 * Video host module. ALL host-specific (Mux) code lives in this file.
 * To switch to Bunny Stream / Cloudflare Stream later, re-implement `getPlaybackCredentials`
 * here and keep its return shape; nothing else in the backend needs to change.
 *
 * Security: never log the signing key or the returned tokens.
 */
import Mux from '@mux/mux-node'
import type { Seminar } from '@/payload-types'

/** How long a signed token is valid. The play endpoint reports this as `expiresIn`. */
export const PLAYBACK_TOKEN_TTL_SECONDS = 600

export type PlaybackCredentials = {
  playbackId: string
  tokens: {
    playback: string
    thumbnail: string
    storyboard: string
  }
}

export class VideoNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VideoNotConfiguredError'
  }
}

let muxClient: Mux | null = null

/** No API token is needed: JWTs are signed locally with the signing key (no Mux API call per viewing). */
const getMux = () => {
  if (!muxClient) {
    muxClient = new Mux({
      tokenId: null,
      tokenSecret: null,
      jwtSigningKey: process.env.MUX_SIGNING_KEY_ID ?? null,
      jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE ?? null,
    })
  }
  return muxClient
}

/**
 * Signs short-lived playback, thumbnail and storyboard tokens for one seminar.
 * Call this ONLY after the caller has verified the customer may watch the seminar.
 */
export const getPlaybackCredentials = async (
  seminar: Pick<Seminar, 'muxPlaybackId'>,
): Promise<PlaybackCredentials> => {
  const playbackId = seminar.muxPlaybackId?.trim()
  if (!playbackId) throw new VideoNotConfiguredError('Seminar has no playback ID')
  if (!process.env.MUX_SIGNING_KEY_ID || !process.env.MUX_SIGNING_KEY_PRIVATE) {
    throw new VideoNotConfiguredError('Mux signing key is not configured')
  }

  const tokens = await getMux().jwt.signPlaybackId(playbackId, {
    type: ['video', 'thumbnail', 'storyboard'],
    expiration: `${PLAYBACK_TOKEN_TTL_SECONDS}s`,
  })

  const playback = tokens['playback-token']
  const thumbnail = tokens['thumbnail-token']
  const storyboard = tokens['storyboard-token']
  if (!playback || !thumbnail || !storyboard) {
    throw new Error('Failed to sign playback tokens')
  }

  return { playbackId, tokens: { playback, thumbnail, storyboard } }
}
