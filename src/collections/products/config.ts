import { CollectionConfig } from 'payload'
import { editor } from './access/editor'
import { viewer } from './access/viewer'
import { admin } from './access/admin'

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
    beforeOperation: [
      async ({ req, operation, collection }) => {
        if (
          (operation === 'create' || operation === 'update') &&
          req.data &&
          req.data.product_image
        ) {
          // find the image object in the media collection
          const product_image_id = await req.payload.findByID({
            collection: 'media',
            id: req.data.product_image as string,
          })
          if (product_image_id) {
            // get the products folder in media collection

            const folder = await req.payload.find({
              collection: 'payload-folders',
              where: {
                name: {
                  equals: collection.slug.toLowerCase(),
                },
              },
            })
            if (folder && folder.docs[0]) {
              // move the product_image into products folder
              await req.payload.update({
                collection: 'media',
                id: product_image_id.id,
                data: {
                  folder: { id: folder.docs[0].id },
                },
              })
            }
          }
        }
      },
    ],
  },
}
