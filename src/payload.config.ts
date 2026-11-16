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
import { Partners } from './collections/partners/config'
import { Customers } from './collections/customers/config'
import { Seminars } from './collections/seminars/config'
import { Purchases } from './collections/purchases/config'
import { extraCorsHeaders, getAllowedOrigins, getServerUrl, isProduction } from './lib/env'
import { purchasesActiveUniqueIndex } from './db/purchases-active-unique'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // Production: SERVER_URL (falls back to the Vercel URL). The admin panel prefixes every API call with this.
  // Development: empty, so the admin panel uses relative URLs and works on http://localhost:3000 even when
  // SERVER_URL is an ngrok URL (the OAuth callbacks read SERVER_URL directly, see src/lib/env.ts).
  serverURL: isProduction ? getServerUrl() : '',
  // Cookies are only accepted from these origins (this server, FRONTEND_URL, and localhost in development).
  csrf: getAllowedOrigins(),
  // Same list; Payload sends Access-Control-Allow-Credentials: true for these origins.
  cors: { origins: getAllowedOrigins(), headers: extraCorsHeaders },
  cookiePrefix: process.env.COOKIE_PREFIX,
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
  collections: [Users, Media, Products, Blogs, Partners, Customers, Seminars, Purchases],
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
    afterSchemaInit: [purchasesActiveUniqueIndex],
    prodMigrations: process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' ? migrations : undefined,
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
    collectionSpecific: false, // disabling this because of postgres empty enum query error, see http://github.com/payloadcms/payload/discussions/13222
  },
  upload: {
    limits: {
      fileSize: 50000000, // set limit of upload to 50MB
    },
  },
})
