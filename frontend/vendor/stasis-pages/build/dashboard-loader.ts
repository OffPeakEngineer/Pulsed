import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, relative, resolve } from 'node:path'
import type { StasisManifest, StasisPage, StasisPageMetadata, StasisSite } from '../app/types/stasis'
import { parseStasisSvg } from '../packages/stasis/src/index'

const defaultSite: StasisSite = {
  name: 'Stasis Pages',
  product: 'Status dashboards',
  description: 'Configuration-driven SVG status dashboards.',
  footer: 'Stasis Pages',
  accent: '#9ee7cb',
  background: '#070b0e',
}

export function loadDashboardDirectory(rootDirectory: string, requestedDirectory: string): StasisManifest {
  const directory = resolve(rootDirectory, requestedDirectory)
  if (!existsSync(directory) || !statSync(directory).isDirectory()) {
    throw new Error(`STASIS_PAGES_DIR does not resolve to a directory: ${requestedDirectory}`)
  }

  const files = readdirSync(directory)
    .filter(file => file.toLowerCase().endsWith('.svg'))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  if (!files.length) throw new Error(`No SVG dashboard pages found in ${requestedDirectory}`)

  const pages = files.map((file, index) => loadPage(directory, file, index))
    .sort((left, right) => left.order - right.order || left.file.localeCompare(right.file))
  const configuredSite = pages.find(page => page.metadata.site)?.metadata.site ?? {}

  return {
    directory: relative(rootDirectory, directory) || '.',
    site: { ...defaultSite, ...configuredSite },
    pages,
  }
}

function loadPage(directory: string, file: string, index: number): StasisPage {
  const source = readFileSync(resolve(directory, file), 'utf8')
  let document
  try {
    document = parseStasisSvg(source)
  }
  catch (error) {
    throw new Error(`Invalid Stasis SVG ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const metadata = document.metadata
  const fallback = basename(file, '.svg').replace(/^\d+[-_]?/, '').replace(/[-_]+/g, ' ')
  const title = document.title || titleCase(fallback)
  const description = document.description || `${title} dashboard`
  return {
    id: metadata.id || slug(fallback),
    label: metadata.label || title,
    eyebrow: metadata.eyebrow || 'Dashboard',
    order: metadata.order ?? index,
    title,
    description,
    file,
    svg: document.svg.replace(/^\s*<\?xml[^>]*>\s*/i, ''),
    metadata,
  }
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dashboard'
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, letter => letter.toUpperCase())
}
