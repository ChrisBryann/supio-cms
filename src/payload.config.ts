// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { FixedToolbarFeature, lexicalEditor, LinkFeature } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { Users } from './collections/users/config'
import { Media } from './collections/media/config'
import { Products } from './collections/products/config'
import { Blogs } from './collections/blogs/config'
import { en } from '@payloadcms/translations/languages/en'
import { ko } from '@payloadcms/translations/languages/ko'

import { resendAdapter } from '@payloadcms/email-resend'

import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: `https://${process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL : process.env.NEXT_PUBLIC_VERCEL_URL}`,
  csrf: [
    `https://${process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL : process.env.NEXT_PUBLIC_VERCEL_URL}`,
  ],
  cors: [
    `https://${process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL : process.env.NEXT_PUBLIC_VERCEL_URL}`,
    process.env.NEXT_PUBLIC_FRONTEND_URL || '',
  ],
  routes: {
    admin: '/', // make admin route point to base path because we don't need the frontend
  },
  email: resendAdapter({
    defaultFromAddress: 'admin@cms.sci-aesthetics.com',
    defaultFromName: 'SCI Aesthetics CMS',
    apiKey: process.env.RESEND_API_KEY || '',
  }),
  i18n: {
    fallbackLanguage: 'en',
    supportedLanguages: { en, ko },
  },
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      // beforeLogin: [],
      graphics: {
        Logo: { path: '/components/Logo#Logo', exportName: 'Logo' },
        // Icon: { path: '/components/Icon#Icon', exportName: 'Icon' },
      },
    },
    meta: {
      titleSuffix: ' | SCI Aesthetics CMS',
      title: 'Dashboard',
      description: 'Access SCI Aesthetics CMS dashboard.',
      defaultOGImageType: 'static',
      icons: [
        // update this when you have the icon file
        {
          url: 'favicon.ico',
          sizes: '32x32',
          type: 'image/ico',
          rel: 'icon',
        },
      ],
    },
  },
  collections: [Users, Media, Products, Blogs],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, FixedToolbarFeature()],
  }),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    idType: 'uuid',
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
    vercelBlobStorage({
      enabled: true,
      collections: {
        media: true,
      },
      token:
        process.env.NEXT_PUBLIC_VERCEL_ENV === 'production'
          ? process.env.BLOB_READ_WRITE_TOKEN
          : process.env.BLOB_DEV_READ_WRITE_TOKEN,
    }),
  ],
  folders: {
    collectionSpecific: false, // disabling this because of postgres empty enum query error, see https://github.com/payloadcms/payload/discussions/13222
  },
})
