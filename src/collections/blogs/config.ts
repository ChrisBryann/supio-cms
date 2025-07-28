import { CollectionConfig } from 'payload'
import { author } from './access/author'
import { editor } from './access/editor'
import { admin } from './access/admin'
import { ImageFolderClassifier } from '@/hooks/image-folder-classifier'
import { RichTextImageFolderClassifier } from '@/hooks/rich-text-image-folder-classifier'

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
    hideAPIURL: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production',
    defaultColumns: ['title', 'overview', 'tags', 'author', 'createdAt'],
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
      index: true,
    },
    {
      name: 'overview',
      type: 'textarea',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'tags',
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
    afterChange: [ImageFolderClassifier('blog'), RichTextImageFolderClassifier('content')],
  },
}
