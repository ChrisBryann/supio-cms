/** A relationship value can arrive as an ID or as a populated document. */
export const relationId = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id)
  return null
}
