'use client'
import { useRowLabel } from '@payloadcms/ui'

/** Admin row label for a legal page section, numbered like on the website: "1. Definisi". */
export const SectionRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ heading?: string }>()
  const n = (rowNumber ?? 0) + 1
  return <span>{`${n}. ${data?.heading || 'New section'}`}</span>
}
