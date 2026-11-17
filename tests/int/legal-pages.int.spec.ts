// @vitest-environment node
/** Legal pages (privacy policy, terms). Runs only with TEST_DATABASE_URI, like the other DB suites. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Payload, SanitizedConfig } from 'payload'

const TEST_DB = process.env.TEST_DATABASE_URI
if (TEST_DB) {
  process.env.DATABASE_URI = TEST_DB
  process.env.PAYLOAD_SECRET ||= 'test-secret-for-integration-tests-only'
  process.env.FRONTEND_URL ||= 'http://localhost:3001'
}

const richText = (text: string) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr' as const,
        textFormat: 0,
        children: [{ type: 'text', text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 }],
      },
    ],
  },
})

/** A page shaped like the website prototype: flat section bodies made of blocks. */
const page = (overrides: { title: string; slug: string; text: string }) => ({
  title: overrides.title,
  slug: overrides.slug,
  lastUpdated: '2026-11-17T00:00:00.000Z',
  intro: richText(`Intro of ${overrides.title}.`),
  sections: [
    {
      heading: 'Data Pribadi yang Kami Kumpulkan',
      anchor: 'data-yang-dikumpulkan',
      body: [
        { blockType: 'subheading' as const, heading: 'Data yang Anda berikan secara langsung' },
        { blockType: 'text' as const, content: richText(overrides.text) },
        { blockType: 'subheading' as const, heading: 'Data dari penyedia layanan masuk' },
        { blockType: 'text' as const, content: richText('Email dan nama.') },
        { blockType: 'text' as const, content: richText('Paragraf penutup setelah subjudul.') },
      ],
    },
    {
      heading: 'Tujuan dan Dasar Pemrosesan',
      anchor: 'tujuan-dan-dasar',
      body: [
        {
          blockType: 'table' as const,
          columns: [{ label: 'Tujuan' }, { label: 'Dasar pemrosesan' }],
          rows: [{ cells: [{ text: 'Memproses pembelian' }, { text: 'Perjanjian' }] }],
        },
      ],
    },
    { heading: 'Hubungi Kami', anchor: 'kontak', body: [{ blockType: 'contactCard' as const }] },
  ],
})

describe.skipIf(!TEST_DB)('legal pages', () => {
  let payload: Payload
  let config: SanitizedConfig
  const run = Date.now().toString(36)
  let staffToken: string
  let customerToken: string

  const api = async (path: string, opts: { method?: string; token?: string; body?: unknown } = {}) => {
    const { handleEndpoints } = await import('payload')
    const headers = new Headers()
    if (opts.token) headers.set('Authorization', `JWT ${opts.token}`)
    if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
    return handleEndpoints({
      config,
      request: new Request(`http://localhost:3000${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      }),
    })
  }

  const tokenFor = async (collection: 'users' | 'customers', doc: { id: string; email: string }) => {
    const { getFieldsToSign, jwtSign } = await import('payload')
    const { token } = await jwtSign({
      fieldsToSign: getFieldsToSign({
        collectionConfig: payload.collections[collection].config,
        email: doc.email,
        user: { ...doc, collection } as never,
      }),
      secret: payload.secret,
      tokenExpiration: 3600,
    })
    return token
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    config = await (await import('@/payload.config')).default
    payload = await getPayload({ config })
    const editor = await payload.db.create({
      collection: 'users',
      data: { email: `legal-editor-${run}@example.com`, first_name: 'Legal', last_name: 'Editor', roles: ['editor', 'viewer'] },
    })
    staffToken = await tokenFor('users', { id: String(editor.id), email: editor.email as string })
    const customer = await payload.create({
      collection: 'customers',
      data: { email: `legal-customer-${run}@example.com` },
      overrideAccess: true,
    })
    customerToken = await tokenFor('customers', customer)
  }, 120_000)

  afterAll(async () => {
    if (!payload) return
    await payload.delete({ collection: 'legal-pages', where: { slug: { like: run } }, overrideAccess: true })
    await payload.delete({ collection: 'customers', where: { email: { like: run } }, overrideAccess: true })
    await payload.db.deleteMany({ collection: 'users', where: { email: { like: run } } })
  })

  it('the public gets a published page with the prototype structure: blocks, anchors, related pages', async () => {
    const terms = await payload.create({
      collection: 'legal-pages',
      data: { ...page({ title: 'Syarat dan Ketentuan', slug: `terms-rel-${run}`, text: 'x' }), _status: 'published' },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'legal-pages',
      data: {
        ...page({ title: 'Kebijakan Privasi', slug: `privacy-policy-${run}`, text: 'Kami mengumpulkan email Anda.' }),
        relatedPages: [terms.id],
        _status: 'published',
      },
      overrideAccess: true,
    })
    const res = await api(`/api/legal-pages?where[slug][equals]=privacy-policy-${run}&depth=1`)
    expect(res.status).toBe(200)
    const { docs } = await res.json()
    expect(docs).toHaveLength(1)
    const doc = docs[0]
    expect(doc).toMatchObject({ title: 'Kebijakan Privasi', lastUpdated: '2026-11-17T00:00:00.000Z', _status: 'published' })
    expect(JSON.stringify(doc.intro)).toContain('Intro of Kebijakan Privasi.')

    // sections keep the hand-picked anchors
    expect(doc.sections.map((s: { heading: string; anchor: string }) => [s.heading, s.anchor])).toEqual([
      ['Data Pribadi yang Kami Kumpulkan', 'data-yang-dikumpulkan'],
      ['Tujuan dan Dasar Pemrosesan', 'tujuan-dan-dasar'],
      ['Hubungi Kami', 'kontak'],
    ])
    // flat body, in order, including a paragraph after the last subheading
    expect(doc.sections[0].body.map((b: { blockType: string }) => b.blockType)).toEqual([
      'subheading', 'text', 'subheading', 'text', 'text',
    ])
    expect(doc.sections[0].body[0].heading).toBe('Data yang Anda berikan secara langsung')
    expect(JSON.stringify(doc.sections[0].body[1].content)).toContain('Kami mengumpulkan email Anda.')
    const table = doc.sections[1].body[0]
    expect(table.blockType).toBe('table')
    expect(table.columns.map((c: { label: string }) => c.label)).toEqual(['Tujuan', 'Dasar pemrosesan'])
    expect(table.rows[0].cells.map((c: { text: string }) => c.text)).toEqual(['Memproses pembelian', 'Perjanjian'])
    expect(doc.sections[2].body[0].blockType).toBe('contactCard')
    // "Baca juga"
    expect(doc.relatedPages.map((r: { slug: string; title: string }) => [r.slug, r.title])).toEqual([
      [`terms-rel-${run}`, 'Syarat dan Ketentuan'],
    ])
  })

  it('anchors: typed ones are normalised, empty ones come from the heading, repeats get a suffix', async () => {
    const created = await payload.create({
      collection: 'legal-pages',
      data: {
        title: 'Dupes',
        slug: `dupes-${run}`,
        lastUpdated: new Date().toISOString(),
        sections: [
          { heading: 'Hak Anda sebagai Subjek Data', anchor: '  Hak Anda! ', body: [{ blockType: 'text', content: richText('a') }] },
          { heading: 'Lain-lain', body: [{ blockType: 'text', content: richText('b') }] },
          { heading: 'Lain-lain', body: [{ blockType: 'text', content: richText('c') }] },
          { heading: '!!!', body: [{ blockType: 'text', content: richText('d') }] },
        ],
      },
      overrideAccess: true,
    })
    expect(created.sections.map((s) => s.anchor)).toEqual(['hak-anda', 'lain-lain', 'lain-lain-2', 'bagian'])
  })

  it('a table row with the wrong number of cells is rejected with a clear message', async () => {
    const res = await api('/api/legal-pages', {
      method: 'POST',
      token: staffToken,
      body: {
        title: 'Broken table',
        slug: `broken-${run}`,
        lastUpdated: new Date().toISOString(),
        sections: [
          {
            heading: 'Tabel',
            body: [
              {
                blockType: 'table',
                columns: [{ label: 'A' }, { label: 'B' }],
                rows: [{ cells: [{ text: 'only one' }] }],
              },
            ],
          },
        ],
      },
    })
    expect(res.status).toBe(400)
    expect(JSON.stringify(await res.json())).toContain('table row 1 has 1 cell(s) but the table has 2 column(s)')
  })

  it('company info is public to read, staff-only to change, and pre-filled', async () => {
    const res = await api('/api/globals/company-info')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      legalName: 'PT SUPIO COSMETICS INDONESIA',
      brandName: 'SCI Aesthetics',
      whatsappUrl: 'https://wa.me/62881082511298/',
      whatsappLabel: 'hubungi kami melalui WhatsApp resmi',
    })
    expect((await api('/api/globals/company-info', { method: 'POST', token: customerToken, body: { legalName: 'Hacked' } })).status).toBe(403)
    expect((await api('/api/globals/company-info', { method: 'POST', body: { legalName: 'Hacked' } })).status).toBe(403)
    const ok = await api('/api/globals/company-info', { method: 'POST', token: staffToken, body: { brandName: 'SCI Aesthetics' } })
    expect(ok.status).toBe(200)
  })

  it('a page that was never published is invisible to the public and to customers', async () => {
    await payload.create({
      collection: 'legal-pages',
      data: { ...page({ title: 'Refund Policy', slug: `refund-${run}`, text: 'draft text' }), _status: 'draft' },
      overrideAccess: true,
      draft: true,
    })
    for (const token of [undefined, customerToken]) {
      const { docs } = await (await api(`/api/legal-pages?where[slug][equals]=refund-${run}`, { token })).json()
      expect(docs).toHaveLength(0)
      const asDraft = await (await api(`/api/legal-pages?where[slug][equals]=refund-${run}&draft=true`, { token })).json()
      expect(asDraft.docs ?? []).toHaveLength(0)
    }
  })

  it('an unpublished edit to a live page stays hidden until it is published', async () => {
    const live = await payload.create({
      collection: 'legal-pages',
      data: { ...page({ title: 'Syarat dan Ketentuan', slug: `terms-${run}`, text: 'Version one.' }), _status: 'published' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'legal-pages',
      id: live.id,
      data: { sections: [{ heading: 'Definisi', body: [{ blockType: 'text', content: richText('Version two, not yet approved.') }] }] },
      draft: true,
      overrideAccess: true,
    })

    const publicText = JSON.stringify(await (await api(`/api/legal-pages?where[slug][equals]=terms-${run}`)).json())
    expect(publicText).toContain('Version one.')
    expect(publicText).not.toContain('Version two')
    const sneaky = JSON.stringify(await (await api(`/api/legal-pages?where[slug][equals]=terms-${run}&draft=true`)).json())
    expect(sneaky).not.toContain('Version two')

    const staffDraft = JSON.stringify(await (await api(`/api/legal-pages/${live.id}?draft=true`, { token: staffToken })).json())
    expect(staffDraft).toContain('Version two, not yet approved.')
  })

  it('only staff can create or edit legal pages; a page needs at least one section', async () => {
    const body = { ...page({ title: 'Cookie Policy', slug: '', text: 'x' }) }
    expect((await api('/api/legal-pages', { method: 'POST', body })).status).toBe(403)
    expect((await api('/api/legal-pages', { method: 'POST', token: customerToken, body })).status).toBe(403)

    const noSections = await api('/api/legal-pages', { method: 'POST', token: staffToken, body: { ...body, sections: [] } })
    expect(noSections.status).toBe(400)

    const created = await api('/api/legal-pages', { method: 'POST', token: staffToken, body })
    expect(created.status).toBe(201)
    expect((await created.json()).doc.slug).toBe('cookie-policy')
    await payload.delete({ collection: 'legal-pages', where: { slug: { equals: 'cookie-policy' } }, overrideAccess: true })
  })
})
