import { CollectionConfig } from 'payload'
import { editor } from './access/editor'
import { viewer } from './access/viewer'
import { admin } from './access/admin'
import { ImageFolderClassifier } from '@/hooks/image-folder-classifier'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    create: editor,
    read: viewer,
    update: editor,
    delete: admin,
  },
  admin: {
    useAsTitle: 'name',
    hideAPIURL: process.env.NODE_ENV === 'production',
    defaultColumns: ['name', 'main_description', 'product_image', 'createdAt'],
    meta: {
      description: 'Products colllection',
    },
  },
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'main_description',
      label: 'Main Description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'additional_description',
      label: 'Additional Description',
      type: 'textarea',
    },
    {
      name: 'product_image',
      label: 'Product Image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
  hooks: {
    afterChange: [ImageFolderClassifier('product')],
  },
}
