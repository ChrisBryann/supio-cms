import type { Access, CollectionConfig, FieldAccess } from 'payload'
import { isCustomer, isStaff, staffAdmin, staffEditor } from '@/access/roles'
import { preventDuplicateActivePurchase } from './hooks/prevent-duplicate'
import { setPurchaseTitle } from './hooks/set-title'

/** Staff see all purchases; a customer sees only their own; the public sees nothing. */
const readPurchases: Access = ({ req: { user } }) => {
  if (isStaff(user)) return true
  if (user && isCustomer(user)) return { customer: { equals: user.id } }
  return false
}

const staffOnlyField: FieldAccess = ({ req: { user } }) => isStaff(user)
const nobody: FieldAccess = () => false // filled in by hooks only

export const Purchases: CollectionConfig = {
  slug: 'purchases',
  labels: { singular: 'Purchase', plural: 'Purchases' },
  defaultSort: '-createdAt',
  admin: {
    useAsTitle: 'title',
    group: 'Seminars',
    defaultColumns: ['customerEmail', 'seminar', 'status', 'createdAt'],
    listSearchableFields: ['customerEmail', 'paymentReference', 'title'],
    description:
      'Each purchase gives one customer lifetime access to one seminar. To refund, set the status to "revoked" instead of deleting, so you keep a record.',
    hideAPIURL: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
  },
  access: {
    create: staffEditor,
    read: readPurchases,
    update: staffEditor,
    delete: staffAdmin,
  },
  hooks: {
    beforeChange: [preventDuplicateActivePurchase, setPurchaseTitle],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      admin: { hidden: true },
      access: { create: nobody, update: nobody },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      index: true,
      admin: {
        description: 'Start typing the customer’s email. Not in the list? Create the customer first.',
      },
    },
    {
      name: 'customerEmail',
      label: 'Customer email',
      type: 'email',
      index: true,
      admin: { readOnly: true, hidden: true },
      access: { create: nobody, update: nobody },
    },
    {
      name: 'seminar',
      type: 'relationship',
      relationTo: 'seminars',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Revoked', value: 'revoked' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Set to "revoked" after a refund. The customer loses access immediately.',
      },
    },
    {
      name: 'paymentReference',
      label: 'Payment reference',
      type: 'text',
      index: true,
      admin: { description: 'Payment / order ID from the external payment platform.' },
    },
    {
      name: 'notes',
      type: 'textarea',
      access: { read: staffOnlyField },
      admin: { description: 'Internal notes. Never shown to the customer.' },
    },
  ],
}
