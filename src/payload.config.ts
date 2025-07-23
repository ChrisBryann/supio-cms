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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  // serverURL: process.env.NEXT_PUBLIC_SERVER_URL || '',
  // csrf: [process.env.NEXT_PUBLIC_SERVER_URL || ''],
  // cors: {
  //   origins: [process.env.NEXT_PUBLIC_SERVER_URL || ''],
  // },
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
      // graphics: {
      //   Logo: '',
      //   Icon: '',
      // },
    },
    meta: {
      titleSuffix: ' | SCI Aesthetics CMS',
      title: 'Dashboard',
      description: 'Access SCI Aesthetics CMS dashboard.',
      // icons: [ // update this when you have the icon file
      //   {
      //     url: '',
      //     rel: 'icon',
      //   },
      // ],
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
  }),
  sharp,
  plugins: [
    payloadCloudPlugin(),
    // storage-adapter-placeholder
  ],
  folders: {
    collectionSpecific: false, // disabling this because of postgres empty enum query error, see https://github.com/payloadcms/payload/discussions/13222
  },
})
