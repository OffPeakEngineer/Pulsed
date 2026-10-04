export const STASIS_SCHEMA_VERSION = 1 as const

export type StasisStatus = 'success' | 'failed' | 'running' | 'pending' | 'canceled' | 'skipped' | 'manual' | 'unknown'

export type StasisSource = {
  type: 'go-getter' | (string & {})
  label?: string
  resource?: string
  endpoint?: string
  refreshMs?: number
}

export type StasisSite = {
  name: string
  product: string
  description: string
  homeUrl?: string
  footer: string
  accent: string
  background: string
}

export type StasisPageMetadata = {
  schemaVersion?: typeof STASIS_SCHEMA_VERSION
  id?: string
  label?: string
  eyebrow?: string
  order?: number
  site?: Partial<StasisSite>
  source?: StasisSource
  sources?: Record<string, StasisSource>
  [key: string]: unknown
}

export type StasisBindingTarget = 'text' | 'status' | 'href'
export type StasisBinding = { target: StasisBindingTarget, path: string, sourceId: string }

export type StasisDocument = {
  svg: string
  metadata: StasisPageMetadata
  title: string
  description: string
  bindings: StasisBinding[]
  metadataIds: string[]
}

export type StasisPage = {
  id: string
  label: string
  eyebrow: string
  title: string
  description: string
  order: number
  file: string
  svg: string
  metadata: StasisPageMetadata
}

export type StasisManifest = { directory: string, site: StasisSite, pages: StasisPage[] }

const metadataPattern = /<metadata\b([^>]*)>([\s\S]*?)<\/metadata>/gi
const activeContentPattern = /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*javascript:/i

export function parseStasisSvg(svg: string): StasisDocument {
  assertSafeStasisSvg(svg)
  const metadata = parsePageMetadata(svg)
  validateMetadata(metadata)
  return {
    svg,
    metadata,
    title: textElement(svg, 'title'),
    description: textElement(svg, 'desc'),
    bindings: collectStasisBindings(svg),
    metadataIds: collectMetadataIds(svg),
  }
}

export function serializeStasisDocument(document: StasisDocument): string {
  assertSafeStasisSvg(document.svg)
  validateMetadata(document.metadata)
  return writeStasisPageMetadata(document.svg, document.metadata)
}

export function updateStasisDocument(
  document: StasisDocument,
  update: { metadata?: Partial<StasisPageMetadata>, title?: string, description?: string },
): StasisDocument {
  const metadata = mergeDefined(document.metadata, update.metadata ?? {})
  let svg = writeStasisPageMetadata(document.svg, metadata)
  if (update.title !== undefined) svg = writeTextElement(svg, 'title', update.title)
  if (update.description !== undefined) svg = writeTextElement(svg, 'desc', update.description)
  return parseStasisSvg(svg)
}

export function writeStasisPageMetadata(svg: string, metadata: StasisPageMetadata): string {
  validateMetadata(metadata)
  const content = encodeXml(canonicalJson(metadata))
  let found = false
  metadataPattern.lastIndex = 0
  const updated = svg.replace(metadataPattern, (element, attributes: string) => {
    if (!/\bid=["']stasis-page["']/i.test(attributes)) return element
    found = true
    return `<metadata${attributes}>${content}</metadata>`
  })
  if (found) return updated
  const element = `<metadata id="stasis-page">${content}</metadata>`
  const desc = /<desc\b[^>]*>[\s\S]*?<\/desc>/i
  if (desc.test(updated)) return updated.replace(desc, match => `${match}\n  ${element}`)
  const title = /<title\b[^>]*>[\s\S]*?<\/title>/i
  if (title.test(updated)) return updated.replace(title, match => `${match}\n  ${element}`)
  return updated.replace(/<svg\b([^>]*)>/i, `<svg$1>\n  ${element}`)
}

export function collectStasisBindings(svg: string): StasisBinding[] {
  const bindings: StasisBinding[] = []
  const pattern = /\bdata-stasis-(bind|status|href)\s*=\s*["']([^"']+)["']/gi
  for (const match of svg.matchAll(pattern)) {
    const target = match[1] === 'bind' ? 'text' : match[1] as StasisBindingTarget
    bindings.push({ target, path: decodeXml(match[2] ?? ''), sourceId: 'default' })
  }
  return bindings
}

export function assertSafeStasisSvg(svg: string): void {
  if (!/<svg\b/i.test(svg)) throw new Error('Stasis document is not an SVG')
  if (activeContentPattern.test(svg)) throw new Error('Stasis document contains active SVG content')
}

export function validateMetadata(metadata: StasisPageMetadata): void {
  if (metadata.schemaVersion !== undefined && metadata.schemaVersion !== STASIS_SCHEMA_VERSION) {
    throw new Error(`Unsupported Stasis schema version: ${String(metadata.schemaVersion)}`)
  }
  const sources = { ...(metadata.source ? { default: metadata.source } : {}), ...metadata.sources }
  for (const [id, source] of Object.entries(sources)) {
    if (!source.type) throw new Error(`Stasis source ${id} is missing an adapter type`)
    if (source.endpoint && !isSafeEndpoint(source.endpoint)) throw new Error(`Stasis source ${id} must use a relative endpoint`)
    if (source.refreshMs !== undefined && (!Number.isFinite(source.refreshMs) || source.refreshMs < 1_000)) {
      throw new Error(`Stasis source ${id} refreshMs must be at least 1000`)
    }
  }
}

function parsePageMetadata(svg: string): StasisPageMetadata {
  metadataPattern.lastIndex = 0
  for (const match of svg.matchAll(metadataPattern)) {
    if (!/\bid=["']stasis-page["']/i.test(match[1] ?? '')) continue
    const value = decodeXml(match[2]?.trim() ?? '')
    if (!value) return {}
    try {
      return JSON.parse(value) as StasisPageMetadata
    }
    catch (error) {
      throw new Error(`Invalid stasis-page metadata: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return {}
}

function collectMetadataIds(svg: string): string[] {
  const ids: string[] = []
  metadataPattern.lastIndex = 0
  for (const match of svg.matchAll(metadataPattern)) {
    const id = /\bid=["']([^"']+)["']/i.exec(match[1] ?? '')?.[1]
    if (id) ids.push(id)
  }
  return ids
}

function writeTextElement(svg: string, tag: 'title' | 'desc', value: string): string {
  const encoded = encodeXml(value)
  const pattern = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'i')
  if (pattern.test(svg)) return svg.replace(pattern, `<${tag}>${encoded}</${tag}>`)
  return svg.replace(/<svg\b([^>]*)>/i, `<svg$1>\n  <${tag}>${encoded}</${tag}>`)
}

function textElement(svg: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(svg)
  return match?.[1] ? decodeXml(match[1].replace(/<[^>]+>/g, '').trim()) : ''
}

function mergeDefined<T extends Record<string, unknown>>(base: T, update: Partial<T>): T {
  return { ...base, ...Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined)) }
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value))
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalValue(child)]))
}

function isSafeEndpoint(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !/[\u0000-\u001f]/.test(value)
}

function encodeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
