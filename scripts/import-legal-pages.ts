/**
 * One-off import of the legal pages (privacy policy, terms) into the CMS as DRAFTS.
 *
 *   make import-legal          (asks which database first)
 *   pnpm payload run scripts/import-legal-pages.ts
 *
 * Reads scripts/data/legal-pages.json (extracted from the frontend prototype pages) and:
 * - creates each page as a draft (never published automatically, review it in the admin first),
 * - converts rich text with Payload's own HTML → Lexical converter,
 * - turns links to /privacy-policy and /terms into internal links to those legal pages,
 * - sets "Read also" (relatedPages) and the hand-picked section anchors,
 * - fills Website → Company info if it has never been saved.
 * Existing pages (same slug) are never overwritten: they are skipped.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { JSDOM } from 'jsdom'
import { getPayload, type RichTextField } from 'payload'
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import config from '../src/payload.config'

type BodyIn =
  | { type: 'text'; html: string }
  | { type: 'subheading'; heading: string }
  | { type: 'table'; columns: string[]; rows: string[][] }
  | { type: 'contactCard' }
type PageIn = {
  slug: string
  title: string
  lastUpdated: string
  introHtml: string
  sections: { heading: string; anchor: string; body: BodyIn[] }[]
  relatedSlugs: string[]
}
type DataIn = {
  companyInfo: { legalName: string; brandName: string; address: string; whatsappUrl: string; whatsappLabel: string }
  pages: PageIn[]
}

const dirname = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(path.join(dirname, 'data/legal-pages.json'), 'utf8')) as DataIn

type LexicalNode = { type?: string; children?: LexicalNode[]; fields?: Record<string, unknown> }
type EditorState = { root: LexicalNode }

/** Turns custom links to another legal page ("/terms") into internal links to that document. */
const linkLegalPages = (node: LexicalNode, idBySlug: Map<string, string>) => {
  if (node.type === 'link' && node.fields?.linkType === 'custom') {
    const slug = String(node.fields.url ?? '').replace(/^\/+|\/+$/g, '')
    const id = idBySlug.get(slug)
    if (id) {
      node.fields = { ...node.fields, linkType: 'internal', doc: { relationTo: 'legal-pages', value: id } }
      delete node.fields.url
    }
  }
  node.children?.forEach((child) => linkLegalPages(child, idBySlug))
}

const countTypes = (node: LexicalNode, counts: Record<string, number> = {}) => {
  if (node.type) counts[node.type] = (counts[node.type] ?? 0) + 1
  node.children?.forEach((c) => countTypes(c, counts))
  return counts
}

const run = async () => {
  const payload = await getPayload({ config })
  const dbUri = process.env.DATABASE_URI ?? ''
  payload.logger.info(`Importing legal pages into database host: ${dbUri.replace(/^[a-z]+:\/\/([^@]*@)?([^/:?]+).*$/, '$2')}`)

  // The exact editor config of the Legal pages rich text fields (same features, incl. internal links).
  const introField = payload.collections['legal-pages'].config.fields.find(
    (f) => 'name' in f && f.name === 'intro',
  ) as RichTextField
  const editorConfig = await editorConfigFactory.fromField({ field: introField })
  const toRichText = (html: string) =>
    convertHTMLToLexical({ editorConfig, html, JSDOM }) as unknown as EditorState

  const buildPage = (page: PageIn, idBySlug: Map<string, string>) => {
    const fix = (state: EditorState) => {
      linkLegalPages(state.root, idBySlug)
      return state
    }
    return {
      title: page.title,
      slug: page.slug,
      lastUpdated: page.lastUpdated,
      intro: page.introHtml ? fix(toRichText(page.introHtml)) : null,
      relatedPages: page.relatedSlugs.map((s) => idBySlug.get(s)).filter((id): id is string => Boolean(id)),
      sections: page.sections.map((section) => ({
        heading: section.heading,
        anchor: section.anchor,
        body: section.body.map((block) => {
          switch (block.type) {
            case 'text':
              return { blockType: 'text' as const, content: fix(toRichText(block.html)) }
            case 'subheading':
              return { blockType: 'subheading' as const, heading: block.heading }
            case 'table':
              return {
                blockType: 'table' as const,
                columns: block.columns.map((label) => ({ label })),
                rows: block.rows.map((cells) => ({ cells: cells.map((text) => ({ text })) })),
              }
            case 'contactCard':
              return { blockType: 'contactCard' as const }
          }
        }),
      })),
    }
  }

  // 1. Find existing pages; create the missing ones as drafts (links resolved in step 2).
  const idBySlug = new Map<string, string>()
  const created: string[] = []
  for (const page of data.pages) {
    const existing = await payload.find({
      collection: 'legal-pages',
      where: { slug: { equals: page.slug } },
      draft: true,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs[0]) {
      idBySlug.set(page.slug, existing.docs[0].id)
      payload.logger.warn(`Skipped "${page.title}" (/${page.slug}): a legal page with this slug already exists.`)
      continue
    }
    const doc = await payload.create({
      collection: 'legal-pages',
      data: { ...buildPage(page, idBySlug), _status: 'draft' } as never,
      draft: true,
      overrideAccess: true,
    })
    idBySlug.set(page.slug, doc.id)
    created.push(page.slug)
  }

  // 2. Now that every page has an ID: internal links + "Read also" on the pages we created.
  for (const page of data.pages.filter((p) => created.includes(p.slug))) {
    const pageData = buildPage(page, idBySlug)
    await payload.update({
      collection: 'legal-pages',
      id: idBySlug.get(page.slug)!,
      data: { ...pageData, _status: 'draft' } as never,
      draft: true,
      overrideAccess: true,
    })
    const counts = countTypes({
      children: [
        pageData.intro?.root ?? {},
        ...pageData.sections.flatMap((s) => s.body.map((b) => ('content' in b && b.content ? b.content.root : {}))),
      ],
    })
    payload.logger.info(
      `Created draft "${page.title}" (/${page.slug}): ${page.sections.length} sections, ` +
        `${counts.paragraph ?? 0} paragraphs, ${counts.list ?? 0} lists / ${counts.listitem ?? 0} items, ` +
        `${counts.link ?? 0} links, read also: ${pageData.relatedPages.length}`,
    )
  }

  // 3. Company info: fill it only if it has never been saved, so manual edits are never overwritten.
  const company = await payload.findGlobal({ slug: 'company-info', depth: 0, overrideAccess: true })
  if (!company.updatedAt) {
    await payload.updateGlobal({ slug: 'company-info', data: data.companyInfo, overrideAccess: true })
    payload.logger.info('Saved Website → Company info.')
  } else {
    payload.logger.info('Company info was already saved, left unchanged.')
  }

  payload.logger.info(
    created.length
      ? 'Done. Review the drafts in Website → Legal pages and click Publish when ready.'
      : 'Done. Nothing new to import.',
  )
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
