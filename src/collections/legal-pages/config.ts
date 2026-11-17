import { ValidationError } from 'payload'
import type { Access, Block, CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { FixedToolbarFeature, LinkFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { isStaff, staffAdmin, staffEditor } from '@/access/roles'
import { slugField, slugify } from '@/fields/slug'

/** Staff see drafts too; customers and the public see published pages only. */
const readLegalPages: Access = ({ req: { user } }) => {
  if (isStaff(user)) return true
  return { _status: { equals: 'published' } }
}

/**
 * Editor for legal text: paragraphs, bold/italic/underline, bullet and numbered lists, quotes,
 * alignment, and links (external, or internal to another legal page). No headings (sections and
 * Subheading blocks are the structure), no uploads, embeds or checklists.
 */
const legalTextEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter(
      (f) => !['heading', 'upload', 'relationship', 'checklist', 'link'].includes(f.key),
    ),
    LinkFeature({ enabledCollections: ['legal-pages'] }),
    FixedToolbarFeature(),
  ],
})

// ---------------------------------------------------------------------------------------------
// Blocks a section body is built from, in any order (matches the website's flat section layout).
// ---------------------------------------------------------------------------------------------

const TextBlock: Block = {
  slug: 'text',
  labels: { singular: 'Text', plural: 'Text' },
  fields: [{ name: 'content', type: 'richText', required: true, editor: legalTextEditor }],
}

const SubheadingBlock: Block = {
  slug: 'subheading',
  labels: { singular: 'Subheading', plural: 'Subheadings' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      admin: {
        placeholder: 'Data yang Anda berikan secara langsung',
        description: 'Lettered automatically on the website (a., b., c., …) in the order they appear in this section.',
      },
    },
  ],
}

const TableBlock: Block = {
  slug: 'table',
  labels: { singular: 'Table', plural: 'Tables' },
  fields: [
    {
      name: 'columns',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 6,
      labels: { singular: 'Column', plural: 'Columns' },
      admin: { description: 'Column headers, left to right, e.g. "Tujuan" and "Dasar pemrosesan".' },
      fields: [{ name: 'label', type: 'text', required: true }],
    },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Row', plural: 'Rows' },
      admin: { description: 'Each row needs one cell per column, in the same order.' },
      fields: [
        {
          name: 'cells',
          type: 'array',
          required: true,
          minRows: 1,
          labels: { singular: 'Cell', plural: 'Cells' },
          fields: [{ name: 'text', type: 'textarea', required: true }],
        },
      ],
    },
  ],
}

const ContactCardBlock: Block = {
  slug: 'contactCard',
  labels: { singular: 'Contact card', plural: 'Contact cards' },
  admin: {
    // No fields of its own: the website fills it from Website → Company info.
  },
  fields: [
    {
      name: 'note',
      type: 'ui',
      admin: {
        components: {
          Field: '/collections/legal-pages/components/ContactCardNote#ContactCardNote',
        },
      },
    },
  ],
}

// ---------------------------------------------------------------------------------------------

type BodyBlock = {
  blockType?: string
  columns?: unknown[] | null
  rows?: { cells?: unknown[] | null }[] | null
}
type Section = { heading?: string | null; anchor?: string | null; body?: BodyBlock[] | null }

/**
 * - Anchors: typed ones are normalised ("Hak Anda!" → "hak-anda"), empty ones come from the heading.
 *   All are made unique within the page (a repeat gets "-2", "-3", …).
 * - Tables: every row must have exactly one cell per column.
 */
const prepareSections: CollectionBeforeChangeHook = ({ data, req }) => {
  const sections = (data.sections ?? []) as Section[]
  const used = new Set<string>()
  const errors: { path: string; message: string }[] = []

  sections.forEach((section, s) => {
    const base = slugify(section.anchor?.trim() || section.heading || '') || 'bagian'
    let anchor = base
    for (let n = 2; used.has(anchor); n++) anchor = `${base}-${n}`
    used.add(anchor)
    section.anchor = anchor

    section.body?.forEach((block, b) => {
      if (block.blockType !== 'table') return
      const columnCount = block.columns?.length ?? 0
      block.rows?.forEach((row, r) => {
        const cellCount = row.cells?.length ?? 0
        if (cellCount !== columnCount) {
          errors.push({
            path: `sections.${s}.body.${b}.rows.${r}.cells`,
            message: `Section ${s + 1}, table row ${r + 1} has ${cellCount} cell(s) but the table has ${columnCount} column(s).`,
          })
        }
      })
    })
  })

  if (errors.length) throw new ValidationError({ collection: 'legal-pages', errors, req })
  return data
}

/**
 * Privacy policy, terms of service and any other legal page the website shows. Structure matches
 * the website: "Legal" → title → "Terakhir diperbarui: <date> · <Company info legal name>" →
 * table of contents (from section headings) → intro → numbered sections (each a sequence of
 * Text / Subheading / Table / Contact card blocks) → "Baca juga" links.
 * Drafts let staff prepare a new version and publish it in one step; past versions stay in the
 * Versions tab.
 */
export const LegalPages: CollectionConfig = {
  slug: 'legal-pages',
  labels: { singular: 'Legal page', plural: 'Legal pages' },
  admin: {
    useAsTitle: 'title',
    group: 'Website',
    defaultColumns: ['title', 'slug', 'lastUpdated', '_status', 'updatedAt'],
    description:
      'Privacy policy, terms of service and other legal pages shown on the website. Use the slugs "privacy-policy" and "terms" for those two pages. Company name and contact details come from Website → Company info.',
    hideAPIURL: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
  },
  access: {
    create: staffEditor,
    read: readLegalPages,
    update: staffEditor,
    delete: staffAdmin,
  },
  versions: {
    drafts: true,
    maxPerDoc: 50,
  },
  hooks: {
    beforeChange: [prepareSections],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { placeholder: 'Kebijakan Privasi' },
    },
    slugField({
      description:
        'Used in the website URL, e.g. /privacy-policy. Use "privacy-policy" and "terms" for those two pages.',
    }),
    {
      name: 'lastUpdated',
      label: 'Last updated',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        position: 'sidebar',
        description:
          'Shown under the title as "Terakhir diperbarui". Change it when the content changes meaningfully.',
        date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
      },
    },
    {
      name: 'metaDescription',
      label: 'Meta description',
      type: 'textarea',
      admin: {
        position: 'sidebar',
        description: 'Optional. Short description for search engines and link previews (about 150 characters).',
      },
    },
    {
      name: 'relatedPages',
      label: 'Read also ("Baca juga")',
      type: 'relationship',
      relationTo: 'legal-pages',
      hasMany: true,
      filterOptions: ({ id }) => (id ? { id: { not_equals: id } } : true),
      admin: {
        position: 'sidebar',
        description: 'Linked at the bottom of the page, e.g. the terms page links to the privacy policy.',
      },
    },
    {
      name: 'intro',
      type: 'richText',
      editor: legalTextEditor,
      admin: {
        description: 'Opening paragraphs above section 1. You can link to the other legal page here.',
      },
    },
    {
      name: 'sections',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Section', plural: 'Sections' },
      admin: {
        description:
          'Numbered automatically in this order (1., 2., 3., …). Drag to reorder. The table of contents is built from these headings.',
        initCollapsed: true,
        components: {
          RowLabel: '/collections/legal-pages/components/SectionRowLabel#SectionRowLabel',
        },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'heading',
              type: 'text',
              required: true,
              admin: { placeholder: 'Watermark pada Seminar', width: '65%' },
            },
            {
              name: 'anchor',
              type: 'text',
              admin: {
                placeholder: 'watermark',
                width: '35%',
                description:
                  'Link name for the table of contents (yoursite.com/privacy-policy#watermark). Leave empty to use the heading. Changing it breaks existing links to this section.',
              },
            },
          ],
        },
        {
          name: 'body',
          type: 'blocks',
          required: true,
          minRows: 1,
          labels: { singular: 'Content block', plural: 'Content blocks' },
          admin: {
            description:
              'Shown in this order. Text for paragraphs and lists; Subheading for "a.", "b."; Table; Contact card for the company contact details.',
          },
          blocks: [TextBlock, SubheadingBlock, TableBlock, ContactCardBlock],
        },
      ],
    },
  ],
}
