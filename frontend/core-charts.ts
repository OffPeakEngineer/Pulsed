import { createScene } from './vendor/scene/scene.js'
import { sceneToSvg, escapeXml } from './vendor/scene/svg.js'
import type { GroupNode, SceneNode } from './vendor/scene/types.js'
import type { Observation } from './types.js'

export function latestCoreUsage(points: Observation[], core: number): number {
  for (let i = points.length - 1; i >= 0; i--) {
    const value = points[i]!.cores?.[core]
    if (value !== undefined) return value
  }
  return 0
}

// Hue identifies a logical CPU; saturation reflects its most recent activity.
// There are no uniquely distinguishable colors for hundreds of CPUs, so labels
// and group selection remain available alongside the all-core view.
export function coreColor(index: number, usage: number, theme: 'dark' | 'light' = 'dark'): string {
  if (usage <= 1) return theme === 'dark' ? '#46505b' : '#65707c'
  const saturation = Math.round(Math.min(100, usage) * 0.85)
  const lightness = theme === 'dark' ? Math.round(31 + Math.min(100, usage) * 0.31) : 38
  return `hsl(${Math.round(index * 137.508 % 360)} ${saturation}% ${lightness}%)`
}

type Colors = { border: string; text: string }
export function coreBars(id: string, cores: { index: number; percent: number }[], width: number, colors: Colors, labels = false, theme: 'dark' | 'light' = 'dark'): { root: GroupNode; height: number } {
  const columns = Math.max(1, Math.floor(width / (labels ? 56 : 7)))
  const cell = width / columns, rowHeight = labels ? 76 : 14, barHeight = labels ? 40 : 11
  const children: SceneNode[] = cores.map((core, position) => {
    const x = position % columns * cell, y = Math.floor(position / columns) * rowHeight
    const barWidth = labels ? Math.min(28, cell - 10) : Math.max(2, cell - 2)
    const usageHeight = barHeight * core.percent / 100
    const rect = (suffix: string, height: number, bottom: number, color: string): SceneNode => ({
      id: `${id}-cpu-${core.index}-${suffix}`, kind: 'rectangle', width: barWidth, height, radius: 1,
      transform: { x: cell / 2, y: bottom - height / 2, rotation: 0 }, fill: { color },
    })
    const bars = [rect('track', barHeight, barHeight, colors.border)]
    if (usageHeight > 0) bars.push(rect('fill', usageHeight, barHeight, coreColor(core.index, core.percent, theme)))
    if (labels) {
      for (const [text, offset] of [[`CPU ${core.index}`, 54], [`${core.percent.toFixed(1)}%`, 69]] as const) {
        bars.push({ id: `${id}-cpu-${core.index}-label-${offset}`, kind: 'text', text, fontSize: 11, align: 'center', fill: { color: colors.text }, transform: { x: cell / 2, y: offset, rotation: 0 } })
      }
    }
    return { id: `${id}-cpu-${core.index}`, kind: 'group', children: bars, transform: { x, y, rotation: 0 }, metadata: { core: core.index, percent: core.percent } }
  })
  return { root: { id, kind: 'group', children, components: { '@pulsed/telemetry/core-bars': { version: 1, data: { cores, units: 'percent' } } } }, height: Math.max(rowHeight, Math.ceil(cores.length / columns) * rowHeight) }
}

export function coreBarAttributes(node: SceneNode): Record<string, string | number> | undefined {
  if (node.metadata?.core === undefined) return undefined
  return { 'data-core': String(node.metadata.core), 'aria-label': `CPU ${node.metadata.core}: ${node.metadata.percent}%`, role: 'img' }
}

export function coreBarsDocument(name: string, cores: { index: number; percent: number }[], width: number, colors: Colors, theme: 'dark' | 'light'): string {
  const chart = coreBars('logical-cpus', cores, Math.max(280, width), colors, true, theme)
  return sceneToSvg(createScene(Math.max(280, width), chart.height, chart.root), { nodeAttributes: coreBarAttributes }).replace(/<svg\b[^>]*>/, opening => `${opening}<title>${escapeXml(name)}: ${cores.length} logical CPUs</title><desc>One bar per logical CPU, on a fixed 0 to 100 percent scale.</desc>`)
}
