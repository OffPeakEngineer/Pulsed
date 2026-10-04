import { childrenInPaintOrder } from './scene.js'
import { parseScene, stringifyScene } from './serialization.js'
import type { Paint, PathCommand, Scene, SceneNode, Stroke, Transform2D } from './types.js'

export type SceneSvgAttributeValue = string | number | boolean | undefined

export type SceneSvgExportOptions = Readonly<{
  /** Trusted SVG definitions placed inside one top-level `<defs>` element. */
  definitions?: readonly string[]
  /** Renderer-specific attributes, such as marker references, for a scene node. */
  nodeAttributes?: (
    node: SceneNode,
  ) => Readonly<Record<string, SceneSvgAttributeValue>> | undefined
}>

/** Serialize a validated scene as a standalone SVG with an embedded scene document. */
export function sceneToSvg(scene: Scene, options: SceneSvgExportOptions = {}): string {
  const metadata = escapeXml(stringifyScene(scene, 0))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="${scene.width}" height="${scene.height}">`,
    `  <metadata id="versytl-scene">${metadata}</metadata>`,
    ...definitionsMarkup(options.definitions),
    nodeMarkup(scene.root, 1, options),
    '</svg>',
  ].join('\n')
}

/** Read the canonical scene metadata from a standalone SVG document. */
export function sceneFromSvg(source: string): Scene {
  if (!/<svg(?:\s|>)/i.test(source) || !/<\/svg\s*>/i.test(source)) {
    throw new TypeError('The source is not a complete SVG document')
  }
  const metadata = source.match(
    /<metadata\b[^>]*\bid=(?:"versytl-scene"|'versytl-scene')[^>]*>([\s\S]*?)<\/metadata\s*>/i,
  )?.[1]
  if (metadata === undefined) throw new TypeError('The SVG does not contain versytl-scene metadata')
  return parseScene(unescapeXml(metadata))
}

function nodeMarkup(node: SceneNode, depth: number, options: SceneSvgExportOptions): string {
  if (node.visible === false) return ''
  const indent = '  '.repeat(depth)
  const common = `${transformAttribute(node.transform)}${opacityAttribute(node.opacity)} data-scene-id="${escapeXml(node.id)}"${extensionAttributes(node, options)}`
  if (node.kind === 'group') {
    const children = childrenInPaintOrder(node).map(child => nodeMarkup(child, depth + 1, options)).filter(Boolean)
    return [`${indent}<g id="${escapeXml(node.id)}"${common}>`, ...children, `${indent}</g>`].join('\n')
  }
  const paint = paintAttributes(node.fill, node.stroke)
  if (node.kind === 'rectangle') {
    return `${indent}<rect id="${escapeXml(node.id)}" x="${-node.width / 2}" y="${-node.height / 2}" width="${node.width}" height="${node.height}"${node.radius === undefined ? '' : ` rx="${node.radius}"`}${common}${paint}/>`
  }
  if (node.kind === 'ellipse') {
    return `${indent}<ellipse id="${escapeXml(node.id)}" cx="0" cy="0" rx="${node.radiusX}" ry="${node.radiusY}"${common}${paint}/>`
  }
  if (node.kind === 'path') {
    return `${indent}<path id="${escapeXml(node.id)}" d="${pathValue(node.commands)}"${common}${paint}/>`
  }
  return `${indent}<text id="${escapeXml(node.id)}" x="0" y="0"${common}${paint}${node.fontFamily ? ` font-family="${escapeXml(node.fontFamily)}"` : ''} font-size="${node.fontSize}"${node.fontWeight === undefined ? '' : ` font-weight="${node.fontWeight}"`}${node.align ? ` text-anchor="${node.align === 'center' ? 'middle' : node.align}"` : ''}${node.baseline ? ` dominant-baseline="${node.baseline === 'middle' ? 'central' : node.baseline}"` : ''}>${escapeXml(node.text)}</text>`
}

function definitionsMarkup(definitions: readonly string[] | undefined): string[] {
  if (!definitions?.length) return []
  return [
    '  <defs>',
    ...definitions.flatMap(definition => definition.split('\n').map(line => `    ${line}`)),
    '  </defs>',
  ]
}

const reservedNodeAttributes = new Set([
  'id', 'transform', 'opacity', 'data-scene-id',
  'fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width',
  'stroke-linecap', 'stroke-linejoin',
  'x', 'y', 'width', 'height', 'rx', 'cx', 'cy', 'd',
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
])

function extensionAttributes(node: SceneNode, options: SceneSvgExportOptions): string {
  const attributes = options.nodeAttributes?.(node)
  if (!attributes) return ''
  return Object.entries(attributes).map(([name, value]) => {
    if (value === undefined) return ''
    if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(name)) {
      throw new TypeError(`Invalid SVG attribute name: ${name}`)
    }
    if (reservedNodeAttributes.has(name)) {
      throw new TypeError(`SVG export extensions cannot replace the built-in ${name} attribute`)
    }
    return ` ${name}="${escapeXml(String(value))}"`
  }).join('')
}

function transformAttribute(transform: Transform2D | undefined) {
  if (!transform) return ''
  const values = [`translate(${transform.x} ${transform.y})`]
  if (transform.rotation) values.push(`rotate(${transform.rotation})`)
  if (transform.scaleX !== undefined || transform.scaleY !== undefined) {
    values.push(`scale(${transform.scaleX ?? 1} ${transform.scaleY ?? 1})`)
  }
  return ` transform="${values.join(' ')}"`
}

function opacityAttribute(opacity: number | undefined) {
  return opacity === undefined ? '' : ` opacity="${opacity}"`
}

function paintAttributes(fill: Paint | undefined, stroke: Stroke | undefined) {
  return [
    ` fill="${escapeXml(fill?.color ?? 'none')}"`,
    fill?.opacity === undefined ? '' : ` fill-opacity="${fill.opacity}"`,
    ` stroke="${escapeXml(stroke?.color ?? 'none')}"`,
    stroke?.opacity === undefined ? '' : ` stroke-opacity="${stroke.opacity}"`,
    stroke?.width === undefined ? '' : ` stroke-width="${stroke.width}"`,
    stroke?.lineCap ? ` stroke-linecap="${stroke.lineCap}"` : '',
    stroke?.lineJoin ? ` stroke-linejoin="${stroke.lineJoin}"` : '',
  ].join('')
}

function pathValue(commands: readonly PathCommand[]) {
  return commands.map((entry) => {
    if (entry.command === 'move') return `M ${entry.x} ${entry.y}`
    if (entry.command === 'line') return `L ${entry.x} ${entry.y}`
    if (entry.command === 'quadratic') return `Q ${entry.controlX} ${entry.controlY} ${entry.x} ${entry.y}`
    if (entry.command === 'cubic') return `C ${entry.control1X} ${entry.control1Y} ${entry.control2X} ${entry.control2Y} ${entry.x} ${entry.y}`
    return 'Z'
  }).join(' ')
}

export function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function unescapeXml(value: string) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}
