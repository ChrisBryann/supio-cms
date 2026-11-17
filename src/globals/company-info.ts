import type { GlobalConfig } from 'payload'
import { staffEditor } from '@/access/roles'

/**
 * Company details shown on the website: the legal entity under legal page titles and the
 * contact card in "Hubungi Kami" / "Layanan Pengaduan dan Kontak". Edit once, every page updates.
 */
export const CompanyInfo: GlobalConfig = {
  slug: 'company-info',
  label: 'Company Info',
  admin: {
    group: 'Website',
    description:
      'Company name, address and WhatsApp contact shown on legal pages (contact card and page header).',
  },
  access: {
    read: () => true,
    update: staffEditor,
  },
  fields: [
    {
      name: 'legalName',
      label: 'Legal company name',
      type: 'text',
      required: true,
      defaultValue: 'PT SUPIO COSMETICS INDONESIA',
    },
    {
      name: 'brandName',
      label: 'Brand name',
      type: 'text',
      defaultValue: 'SCI Aesthetics',
      admin: { description: 'Shown in brackets under the company name, e.g. "(SCI Aesthetics)".' },
    },
    {
      name: 'address',
      type: 'textarea',
      required: true,
      defaultValue:
        'Ciputra World Office Unit 1003, Jl. Mayjen Sungkono No.87 Lantai 10, Gn. Sari, Kec. Dukuhpakis, Surabaya, Jawa Timur 60224',
    },
    {
      type: 'row',
      fields: [
        {
          name: 'whatsappUrl',
          label: 'WhatsApp link',
          type: 'text',
          required: true,
          defaultValue: 'https://wa.me/62881082511298/',
          validate: (value: string | null | undefined) => {
            if (!value) return 'Required.'
            try {
              return new URL(value).protocol === 'https:' ? true : 'Must start with https://'
            } catch {
              return 'Must be a full link, e.g. https://wa.me/62…'
            }
          },
        },
        {
          name: 'whatsappLabel',
          label: 'WhatsApp link text',
          type: 'text',
          required: true,
          defaultValue: 'hubungi kami melalui WhatsApp resmi',
        },
      ],
    },
  ],
}
