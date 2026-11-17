import type { TextField } from 'payload'

export const slugify = (input: string) =>
  input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * A unique URL slug. Left empty, it is generated from `sourceField` (e.g. the title);
 * typed in, it is normalised to lowercase letters, numbers and dashes.
 */
export const slugField = ({
  sourceField = 'title',
  description,
}: { sourceField?: string; description: string }): TextField => ({
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  admin: { position: 'sidebar', description },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        const source = typeof value === 'string' && value.trim() ? value : data?.[sourceField]
        return typeof source === 'string' ? slugify(source) : value
      },
    ],
  },
  validate: (value: string | null | undefined) =>
    !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
      ? true
      : 'Use lowercase letters, numbers and dashes only.',
})
