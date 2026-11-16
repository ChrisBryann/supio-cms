import { randomInt } from 'crypto'

// Crockford-style alphabet: no I, L, O, U, 0 or 1, so the code is easy to read off a video frame.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
const LENGTH = 8 // 30^8 ≈ 6.5e11 combinations; the unique index catches the (negligible) collision case

/** e.g. "SP-7K3F9QXM" */
export const generateWatermarkCode = (): string => {
  let code = ''
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return `SP-${code}`
}
