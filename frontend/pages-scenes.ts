import { createCardNode } from './vendor/shipkit/cardScene.js'
import { createRadialGaugeNode, createLevelIndicatorNode } from './vendor/shipkit/dashboardScene.js'
import { createScene } from './vendor/scene/scene.js'
import { sceneFromSvg, sceneToSvg, escapeXml } from './vendor/scene/svg.js'
import { stringifyScene } from './vendor/scene/serialization.js'
import type { GroupNode, SceneNode } from './vendor/scene/types.js'
import { parseStasisSvg, serializeStasisDocument, updateStasisDocument } from './vendor/stasis/index.js'
import type { StasisPage, StasisPageMetadata } from './vendor/stasis/index.js'
import type { PulsedNode, PulsedSnapshot } from './pulsed-source.js'
import { cpuHistoryDocument } from './charts.js'
import { coreBars, coreBarAttributes } from './core-charts.js'

export type PageColors = { accent: string; peak: string; surface: string; border: string; text: string; muted: string }
export type PageContext = { snapshot: PulsedSnapshot; selected: string; nodes: PulsedNode[]; windowMs: number; width: number; colors: PageColors; density?: string; theme?: 'dark' | 'light'; historyMode?: 'cores' | 'summary'; coreStart?: number; coreLimit?: number }
const ids = ['overview', 'node', 'history'] as const

function text(id: string, value: string, x: number, y: number, colors: PageColors, size = 13): SceneNode {
  return { id, kind: 'text', text: value, fontSize: size, fill: { color: colors.text }, transform: { x, y, rotation: 0 }, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }
}
function compactName(name: string): string { return name.length > 28 ? name.slice(0, 26) + '…' : name }
function frame(id: string, title: string, width: number, height: number, colors: PageColors, children: SceneNode[] = []): GroupNode {
  return createCardNode({ id, title, bounds: { x: 0, y: 0, width, height }, children, shadow: false,
    theme: { surface: colors.surface, border: colors.border, title: colors.text, eyebrow: colors.muted, menu: colors.muted } })
}
function document(root: GroupNode, width: number, height: number, metadata: StasisPageMetadata, title: string, description: string, names: Record<string, string> = {}): string {
  let svg = sceneToSvg(createScene(width, height, root), { nodeAttributes: node => names[node.id] ? {
    role: 'button', tabindex: 0, 'aria-label': `Inspect ${names[node.id]}`, 'data-pulsed-node': names[node.id],
  } : coreBarAttributes(node) })
  svg = svg.replace(/<svg\b[^>]*>/, opening => `${opening}\n<title>${escapeXml(title)}</title>\n<desc>${escapeXml(description)}</desc>`)
  return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), { metadata }))
}

export function authoredPage(id: typeof ids[number]): string {
  const colors: PageColors = { accent: '#65d5ef', peak: '#facc15', surface: '#0d1d27', border: '#29414f', text: '#f1f6f7', muted: '#9bb0bc' }
  const label = { overview: 'Overview', node: 'Node detail', history: 'CPU history' }[id]
  const provider = `@pulsed/dashboard/${id}`
  return document({ id: `pulsed-${id}`, kind: 'group', children: [frame('fallback', 'Waiting for a peer snapshot', 960, 160, colors, [
    text('fallback-note', 'Readings appear when this peer is reachable. The classic dashboard remains available.', 18, 88, colors),
  ])], components: { [provider]: { version: 1, data: {} } } }, 960, 160, {
    schemaVersion: 1, id, label, order: ids.indexOf(id), eyebrow: 'Cluster',
    site: { name: 'Pulsed', product: 'The pulse of your cluster', homeUrl: '#overview', description: 'Peer-local cluster monitoring with CPU observation history.', footer: 'Pulsed · live cluster observations', accent: colors.accent, background: '#071019' },
    source: { type: 'pulsed', resource: id, endpoint: '/api/v1/snapshot', refreshMs: 2000 },
  }, label, 'Waiting for live Pulsed data. No synthetic metrics are shown.')
}

type Provider = { version: number; render: (page: StasisPage, context: PageContext) => string }
// Application-owned, explicit registrations. Document metadata never imports
// modules or chooses network locations. Unknown providers retain the authored SVG.
export const pageProviders: ReadonlyMap<string, Provider> = new Map([
  ['@pulsed/dashboard/overview', { version: 1, render: (page: StasisPage, context: PageContext) => {
    const { nodes, colors } = context, width = Math.max(300, context.width)
    const compact = context.density === 'compact'
    const minimum = compact ? 300 : 340
    const columns = Math.max(1, Math.min(compact ? 4 : 3, Math.floor((width + 14) / (minimum + 14))))
    const gap = compact ? 8 : 14, cardWidth = (width - gap * (columns - 1)) / columns
    const columnHeights = Array.from({ length: columns }, () => 0)
    const names: Record<string, string> = {}
    const cards = nodes.map((node, index) => {
      const id = `overview-node-${index}`
      names[id] = node.name
      const cpu = node.cpu.average, memory = node.memory.percent
      const bars = coreBars(`${id}-cores`, node.cpu.cores || [], cardWidth - 36, colors, false, context.theme)
      const barsHeight = node.cpu.cores ? bars.height : 22
      const cardHeight = 162 + barsHeight
      const column = index % columns, y = columnHeights[column]!
      columnHeights[column] = y + cardHeight + gap
      const content: SceneNode[] = [
        text(`${id}-status`, node.updatedAt ? `${node.state === 'fresh' ? 'online' : node.state} · ${Math.round(node.ageSeconds)}s ago` : 'offline · no heartbeat', 18, 56, colors, 12),
        text(`${id}-cpu`, cpu === null ? 'CPU unavailable' : `CPU ${cpu.toFixed(1)}% · peak ${node.cpu.peak?.toFixed(1)}%`, 18, 81, colors),
        text(`${id}-count`, `${node.cpu.count} logical CPUs`, 18, 104, colors),
        text(`${id}-memory`, memory === null ? 'Memory unavailable' : `Memory ${memory.toFixed(1)}%`, 18, 142 + barsHeight, colors),
      ]
      if (node.cpu.cores) content.push({ ...bars.root, transform: { x: 18, y: 114, rotation: 0 } })
      else content.push(text(`${id}-cores-pending`, cpu === null ? 'Core readings unavailable' : 'Loading core bars…', 18, 125, colors, 12))
      const card = frame(id, compactName(node.name), cardWidth, cardHeight, colors, content)
      return { ...card, transform: { x: column * (cardWidth + gap), y, rotation: 0 } }
    })
    const height = Math.max(184, ...columnHeights.map(height => height - gap))
    return document({ id: 'overview-root', kind: 'group', children: cards }, width, height, page.metadata, 'Cluster overview', `${nodes.length} displayed nodes. Activate a node to inspect its metrics.`, names)
  } }],
  ['@pulsed/dashboard/node', { version: 1, render: (page: StasisPage, context: PageContext) => {
    const node = context.snapshot.nodes.find(node => node.name === context.selected)
    const { colors } = context, width = Math.max(300, Math.min(1100, context.width))
    const columns = width >= 660 ? 2 : 1, gap = 16, cardWidth = (width - gap * (columns - 1)) / columns
    const height = 300, widgets: GroupNode[] = []
    const cpu = node?.cpu.average, memory = node?.memory.percent
    widgets.push(cpu == null ? frame('node-cpu', 'CPU unavailable', cardWidth, height, colors) : createRadialGaugeNode({
      id: 'node-cpu', bounds: { x: 0, y: 0, width: cardWidth, height }, title: 'Average CPU', eyebrow: `${node!.cpu.count} LOGICAL CPUS`, value: cpu, min: 0, max: 100, unit: '%', accent: colors.accent, warningAt: 80,
    }))
    widgets.push(memory == null ? frame('node-memory', 'Memory unavailable', cardWidth, height, colors) : createLevelIndicatorNode({
      id: 'node-memory', bounds: { x: 0, y: 0, width: cardWidth, height }, title: 'Memory usage', eyebrow: 'OBSERVED USAGE', value: memory, max: 100, unit: '%', accent: colors.accent, detail: node!.memory.label,
    }))
    function recolor(node: SceneNode): SceneNode {
      if (node.kind === 'group') return { ...node, children: node.children.filter(child => !child.id.endsWith(':menu')).map(recolor) }
      if (node.kind === 'rectangle') return { ...node, fill: { color: node.id.endsWith(':fill') ? colors.accent : colors.surface }, stroke: node.stroke ? { ...node.stroke, color: colors.border } : undefined }
      if (node.kind === 'text') return { ...node, fill: { color: /:(unit)$/.test(node.id) ? colors.accent : /:(eyebrow|detail|tick-label:\d+)$/.test(node.id) ? colors.muted : colors.text } }
      return node
    }
    const children = widgets.map((widget, index) => ({ ...recolor(widget), transform: { x: index % columns * (cardWidth + gap), y: Math.floor(index / columns) * (height + gap), rotation: 0 } })) as GroupNode[]
    return document({ id: 'node-root', kind: 'group', children }, width, columns === 1 ? height * 2 + gap : height, page.metadata, `${node?.name || 'Unknown node'} metrics`, 'Current CPU and memory usage. Unavailable readings are not zero.')
  } }],
  ['@pulsed/dashboard/history', { version: 1, render: (page: StasisPage, context: PageContext) => {
    const svg = cpuHistoryDocument({ name: context.selected || 'Choose a node', servingNode: context.snapshot.servingNode,
      points: context.snapshot.history[context.selected] || [], end: context.snapshot.generatedAt, windowMs: context.windowMs, width: context.width,
      theme: context.theme || 'dark', colors: context.colors, mode: context.historyMode, coreStart: context.coreStart, coreLimit: context.coreLimit })
    return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), { metadata: page.metadata }))
  } }],
])

export function hydratePage(page: StasisPage, context: PageContext): { svg: string; supported: boolean } {
  const components = sceneFromSvg(page.svg).root.components || {}
  for (const [id, component] of Object.entries(components)) {
    const provider = pageProviders.get(id)
    if (provider && component.version === provider.version) {
      const svg = provider.render(page, context)
      const original = sceneFromSvg(svg)
      const scene = { ...original, root: { ...original.root, components: { ...original.root.components, [id]: component } } }
      // Change only canonical metadata; preserve the interactive SVG attributes.
      const hydrated = svg.replace(/<metadata\b[^>]*id="versytl-scene"[^>]*>[\s\S]*?<\/metadata>/,
        () => `<metadata id="versytl-scene">${escapeXml(stringifyScene(scene, 0))}</metadata>`)
      return { svg: serializeStasisDocument(parseStasisSvg(hydrated)), supported: true }
    }
  }
  return { svg: page.svg, supported: false }
}

export function nodePageWithCoreBars(svg: string, node: PulsedNode, colors: PageColors, theme: 'dark' | 'light'): string {
  if (!node.cpu.cores) return svg
  const saved = parseStasisSvg(svg), scene = sceneFromSvg(svg)
  const bars = coreBars('export-logical-cpus', node.cpu.cores, scene.width - 36, colors, true, theme)
  const root: GroupNode = { ...scene.root, children: [...scene.root.children,
    text('export-core-count', `${node.cpu.count} logical CPUs · one bar per CPU, 0–100%`, 18, scene.height + 30, colors, 15),
    { ...bars.root, transform: { x: 18, y: scene.height + 46, rotation: 0 } },
  ] }
  return document(root, scene.width, scene.height + 46 + bars.height, saved.metadata, `${node.name} metrics`, 'Current CPU, memory, and individual logical CPU usage.')
}
