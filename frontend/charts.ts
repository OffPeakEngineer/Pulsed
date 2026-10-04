import { createTrendChartNode } from './vendor/shipkit/dashboardScene.js'
import { createProgressBarNode } from './vendor/shipkit/progressScene.js'
import { createScene } from './vendor/scene/scene.js'
import { escapeXml, sceneToSvg } from './vendor/scene/svg.js'
import { parseStasisSvg, updateStasisDocument, serializeStasisDocument } from './vendor/stasis/index.js'
import type { GroupNode, PathCommand, SceneNode, TextNode } from './vendor/scene/types.js'
import type { Observation } from './types.js'

type ChartOptions = {
  name: string; servingNode: string; points: Observation[]; end: number
  windowMs: number; width: number; theme: 'dark' | 'light'
  colors: { accent: string; peak: string; surface: string; border: string; text: string; muted: string }
}

// Shipkit owns the chart frame/axes; Pulsed supplies true timestamp geometry and
// disconnected paths. Its default trend factory spaces points by sample index.
export function observationCommands(points: Observation[], key: 'average' | 'peak', start: number, end: number): PathCommand[] {
  let previous: Observation | undefined
  return points.filter(point => point.at >= start && point.at <= end).map(point => {
    const gap = !previous || point.at - previous.at > previous.ttlSeconds * 1000
    previous = point
    return {
      command: gap ? 'move' : 'line',
      x: 38 + (point.at - start) / Math.max(1, end - start) * 484,
      y: 172 - point[key] / 100 * 126,
    }
  })
}

export function cpuHistoryDocument(options: ChartOptions): string {
  const id = 'pulsed-cpu-history'
  const width = Math.max(320, Math.min(1000, options.width))
  const height = Math.max(240, width * 0.36)
  const start = options.end - options.windowMs
  const points = options.points.filter(point => point.at >= start && point.at <= options.end)
  const card = createTrendChartNode({
    id, bounds: { x: 0, y: 0, width, height },
    title: 'CPU usage over time', eyebrow: 'OBSERVED ON THIS PEER',
    values: [], min: 0, max: 100, unit: '%', accent: options.colors.accent,
  })
  function adapt(node: SceneNode): SceneNode {
    if (node.kind === 'group' && node.id === `${id}:content`) {
      // Maintain legible axes on narrow screens; the inspector has its own
      // selected-node heading and legend in accessible HTML.
      const chartWidth = 560
      const scale = (width - 20) / chartWidth
      const children = node.children.filter(child => child.id !== `${id}:latest`).map(adapt)
      for (const [key, color] of [['peak', options.colors.peak], ['average', options.colors.accent]] as const) {
        children.push({
          id: `${id}:${key}`, kind: 'path', commands: observationCommands(points, key, start, options.end),
          stroke: { color, width: 2.5, lineCap: 'round', lineJoin: 'round' },
        })
        for (const [index, point] of points.entries()) {
          children.push({
            id: `${id}:${key}:sample:${index}`, kind: 'ellipse', radiusX: 2, radiusY: 2,
            transform: { x: 38 + (point.at - start) / options.windowMs * 484, y: 172 - point[key] / 100 * 126, rotation: 0 },
            fill: { color },
          })
        }
      }
      const label = (suffix: string, text: string, x: number, align: TextNode['align']): TextNode => ({
        id: `${id}:${suffix}`, kind: 'text', text, fontSize: 13, align,
        transform: { x, y: 202, rotation: 0 }, fill: { color: options.colors.muted },
      })
      children.push(label('start', `${Math.round(options.windowMs / 60000)}m ago`, 38, 'start'), label('end', 'Snapshot', 522, 'end'))
      return { ...node, transform: { x: 10, y: 58, rotation: 0, scaleX: scale, scaleY: (height - 64) / 220 }, children }
    }
    if (node.kind === 'group') return { ...node, children: node.children.filter(child => child.id !== `${id}:menu`).map(adapt) }
    if (node.kind === 'rectangle') return { ...node, fill: { color: options.colors.surface }, stroke: node.stroke ? { ...node.stroke, color: options.colors.border } : undefined }
    if (node.kind === 'text') return { ...node, fill: { color: node.id.includes(':title') ? options.colors.text : options.colors.muted }, fontSize: node.id.includes(':axis:') ? 13 : node.fontSize }
    if (node.kind === 'path' && node.id.includes(':grid:')) return { ...node, stroke: { ...node.stroke!, color: options.colors.border } }
    return node
  }
  const root: GroupNode = {
    id: 'pulsed-history-root', kind: 'group', children: [adapt(card)],
    components: {
      '@pulsed/telemetry/cpu-history': {
        version: 1,
        data: { node: options.name, servingNode: options.servingNode, start, end: options.end, points, units: 'percent', retention: 'peer-local, process memory' },
      },
    },
  }
  const description = `${points.length} observed CPU readings on ${options.servingNode}. Mean and peak logical CPU, 0 to 100 percent. Gaps longer than heartbeat TTL are disconnected.`
  // Insert application text through a callback: JavaScript replacement-string
  // tokens such as "$&" in a node name must remain literal XML text.
  const svg = sceneToSvg(createScene(width, height, root)).replace(/<svg\b[^>]*>/, opening =>
    `${opening}\n<title>${escapeXml(options.name + ' CPU history')}</title>\n<desc>${escapeXml(description)}</desc>`)
  return serializeStasisDocument(updateStasisDocument(parseStasisSvg(svg), {
    metadata: {
      schemaVersion: 1, id: 'pulsed-cpu-history', label: 'CPU history', eyebrow: 'Pulsed',
      source: { type: 'pulsed', resource: 'cpu-history', refreshMs: 2000 },
    },
  }))
}

export function memoryMeter(value: number, colors: { accent: string; border: string }): string {
  return sceneToSvg(createScene(300, 10, {
    id: 'memory-meter-root', kind: 'group', children: [createProgressBarNode({
      id: 'pulsed-memory-meter', bounds: { x: 0, y: 0, width: 300, height: 10 },
      value: value / 100, fillColor: colors.accent, trackColor: colors.border,
    })],
  }))
}
