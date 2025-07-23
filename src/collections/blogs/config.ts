import { CollectionConfig } from 'payload'
import { author } from './access/author'
import { editor } from './access/editor'
import { admin } from './access/admin'

export const Blogs: CollectionConfig = {
  slug: 'blogs',
  access: {
    create: editor,
    read: author,
    update: editor,
    delete: admin,
  },
  admin: {
    useAsTitle: 'title',
    enableRichTextLink: true,
    hideAPIURL: process.env.NODE_ENV === 'production',
    defaultColumns: ['title', 'category', 'author', 'createdAt'],
    meta: {
      description: 'Blogs colllection',
    },
  },
  fields: [
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      defaultValue: ({ req }) => {
        if (req.user) return req.user.id
      },
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'category',
      type: 'text',
      required: true,
    },
    {
      name: 'blog_image',
      label: 'Cover Image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
  ],
  versions: {
    drafts: true,
  },
  hooks: {
    beforeOperation: [
      async ({ req, operation, collection }) => {
        if ((operation === 'create' || operation === 'update') && req.data && req.data.blog_image) {
          // find the image object in the media collection
          const blog_image_id = await req.payload.findByID({
            collection: 'media',
            id: req.data.blog_image as string,
          })
          if (blog_image_id) {
            // get the blogs folder in media collection
            const folder = await req.payload.find({
              collection: 'payload-folders',
              where: {
                name: {
                  equals: collection.slug.toLowerCase(),
                },
              },
            })
            if (folder && folder.docs[0]) {
              // move the blog_image into blogs folder
              await req.payload.update({
                collection: 'media',
                id: blog_image_id.id,
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
