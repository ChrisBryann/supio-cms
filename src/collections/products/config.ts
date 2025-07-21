import { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  fields: [
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
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
}
