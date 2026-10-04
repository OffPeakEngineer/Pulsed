import type {
  GroupNode,
  RectangleNode,
  SceneComponentMap,
  SceneNode,
} from '@versytl/scene'

export const SHIPKIT_PROGRESS_BAR_COMPONENT = '@versytl/shipkit/progress-bar' as const

export type ProgressBarBounds = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export type ProgressBarOptions = Readonly<{
  id: string
  bounds: ProgressBarBounds
  value: number
  trackColor?: string
  fillColor?: string
  borderColor?: string
  radius?: number
  zIndex?: number
  metadata?: GroupNode['metadata']
  components?: SceneComponentMap
}>

function rectangle(
  id: string,
  width: number,
  height: number,
  x: number,
  y: number,
  fill: string,
  radius: number,
  strokeColor?: string,
): RectangleNode {
  return {
    id,
    kind: 'rectangle',
    width,
    height,
    radius,
    fill: { color: fill },
    ...(strokeColor ? { stroke: { color: strokeColor, width: 1 } } : {}),
    transform: { x, y, rotation: 0 },
  }
}

/** Build a compact, renderer-neutral determinate progress bar. */
export function createProgressBarNode(options: ProgressBarOptions): GroupNode {
  const value = Math.min(1, Math.max(0, options.value))
  const radius = options.radius ?? options.bounds.height / 2
  const fillWidth = options.bounds.width * value
  const children: SceneNode[] = [rectangle(
    `${options.id}:track`,
    options.bounds.width,
    options.bounds.height,
    options.bounds.width / 2,
    options.bounds.height / 2,
    options.trackColor ?? '#ebe7e0',
    radius,
    options.borderColor,
  )]

  if (fillWidth > 0) {
    children.push(rectangle(
      `${options.id}:fill`,
      fillWidth,
      options.bounds.height,
      fillWidth / 2,
      options.bounds.height / 2,
      options.fillColor ?? '#6755d9',
      Math.min(radius, fillWidth / 2),
    ))
  }

  return {
    id: options.id,
    kind: 'group',
    transform: { x: options.bounds.x, y: options.bounds.y, rotation: 0 },
    zIndex: options.zIndex,
    metadata: options.metadata,
    components: {
      ...options.components,
      [SHIPKIT_PROGRESS_BAR_COMPONENT]: {
        version: 1,
        data: { value },
      },
    },
    children,
  }
}
