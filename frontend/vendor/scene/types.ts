export const LEGACY_SCENE_VERSION = 1 as const
export const SCENE_VERSION = 2 as const

export type SceneId = string

export type JsonPrimitive = string | number | boolean | null
export type JsonArray = readonly JsonValue[]
export type JsonObject = Readonly<{ [key: string]: JsonValue }>
export type JsonValue = JsonPrimitive | JsonArray | JsonObject

/**
 * A component ID is an npm-style scoped package plus a component name, such as
 * `@versytl/scene/layer` or `@versytl/physics/body`.
 */
export type SceneComponentId = string

export type SceneComponent<TData = JsonValue> = Readonly<{
  version: number
  data: TData
}>

export type SceneComponentMap = Readonly<
  Record<SceneComponentId, SceneComponent>
>

export type SceneConnectorEndpoint =
  | Readonly<{
    kind: 'node'
    nodeId: SceneId
    pointId?: string
  }>
  | Readonly<{
    kind: 'point'
    x: number
    y: number
  }>

/**
 * Renderer-neutral topology. Provider components define what a connector
 * means and ordinary scene nodes provide its materialized visual views.
 */
export type SceneConnector = Readonly<{
  id: SceneId
  start: SceneConnectorEndpoint
  end: SceneConnectorEndpoint
  components?: SceneComponentMap
}>

export type Transform2D = Readonly<{
  x: number
  y: number
  rotation: number
  scaleX?: number
  scaleY?: number
}>

export type Paint = Readonly<{
  color: string
  opacity?: number
}>

export type Stroke = Paint & Readonly<{
  width: number
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'bevel' | 'miter' | 'round'
}>

export type SceneNodeBase = Readonly<{
  id: SceneId
  transform?: Transform2D
  zIndex?: number
  visible?: boolean
  opacity?: number
  clipId?: SceneId
  metadata?: Readonly<Record<string, string | number | boolean>>
  components?: SceneComponentMap
}>

export type GroupNode = SceneNodeBase & Readonly<{
  kind: 'group'
  children: readonly SceneNode[]
}>

export type RectangleNode = SceneNodeBase & Readonly<{
  kind: 'rectangle'
  width: number
  height: number
  radius?: number
  fill?: Paint
  stroke?: Stroke
}>

export type EllipseNode = SceneNodeBase & Readonly<{
  kind: 'ellipse'
  radiusX: number
  radiusY: number
  fill?: Paint
  stroke?: Stroke
}>

export type PathCommand =
  | Readonly<{ command: 'move'; x: number; y: number }>
  | Readonly<{ command: 'line'; x: number; y: number }>
  | Readonly<{ command: 'quadratic'; controlX: number; controlY: number; x: number; y: number }>
  | Readonly<{ command: 'cubic'; control1X: number; control1Y: number; control2X: number; control2Y: number; x: number; y: number }>
  | Readonly<{ command: 'close' }>

export type PathNode = SceneNodeBase & Readonly<{
  kind: 'path'
  commands: readonly PathCommand[]
  fill?: Paint
  stroke?: Stroke
}>

export type TextNode = SceneNodeBase & Readonly<{
  kind: 'text'
  text: string
  fontFamily?: string
  fontSize: number
  fontWeight?: number
  align?: 'start' | 'center' | 'end'
  baseline?: 'top' | 'middle' | 'alphabetic' | 'bottom'
  fill?: Paint
  stroke?: Stroke
}>

export type SceneNode = GroupNode | RectangleNode | EllipseNode | PathNode | TextNode

export type Scene = Readonly<{
  version: typeof SCENE_VERSION
  width: number
  height: number
  root: GroupNode
  connectors?: readonly SceneConnector[]
  components?: SceneComponentMap
}>

/** Version-one input accepted by the migration APIs. */
export type LegacyScene = Readonly<{
  version: typeof LEGACY_SCENE_VERSION
  width: number
  height: number
  root: GroupNode
}>

export type CreateSceneOptions = Readonly<{
  connectors?: readonly SceneConnector[]
  components?: SceneComponentMap
}>

export const SCENE_LAYER_COMPONENT = '@versytl/scene/layer' as const
export const SCENE_CANVAS_COMPONENT = '@versytl/scene/canvas' as const
export const SCENE_SNAP_POINTS_COMPONENT = '@versytl/scene/snap-points' as const
export const SCENE_PREFAB_COMPONENT = '@versytl/scene/prefab' as const
export const SCENE_CONNECTOR_VIEW_COMPONENT = '@versytl/scene/connector-view' as const

export type SceneLayerComponentData = Readonly<{
  name: string
  locked?: boolean
}>

export type SceneLayerComponent = SceneComponent<SceneLayerComponentData>

export type SceneCanvasComponentData =
  | Readonly<{ mode: 'infinite' }>
  | Readonly<{ mode: 'masked'; maskNodeId: SceneId }>

export type SceneCanvasComponent = SceneComponent<SceneCanvasComponentData>

export type ScenePrefabComponentData = Readonly<{
  id: SceneComponentId
  name: string
}>

export type ScenePrefabComponent = SceneComponent<ScenePrefabComponentData>

export type SceneSnapPoint = Readonly<{
  id: string
  x: number
  y: number
  role?: string
  normal?: Readonly<{
    x: number
    y: number
  }>
}>

export type SceneSnapPointsComponentData = Readonly<{
  points: readonly SceneSnapPoint[]
}>

export type SceneSnapPointsComponent = SceneComponent<SceneSnapPointsComponentData>

export type SceneConnectorViewComponentData = Readonly<{
  connectorId: SceneId
  role?: string
}>

export type SceneConnectorViewComponent = SceneComponent<SceneConnectorViewComponentData>

export type SceneValidationCode =
  | 'duplicate-connector-id'
  | 'duplicate-node-id'
  | 'invalid-component'
  | 'invalid-component-id'
  | 'invalid-connector'
  | 'invalid-connector-reference'
  | 'invalid-json'
  | 'invalid-node'
  | 'invalid-scene'
  | 'invalid-standard-component'
  | 'parse-error'
  | 'scene-cycle'
  | 'unsupported-version'

export type SceneRendererCapabilities = Readonly<{
  clipping: boolean
  text: boolean
  paths: boolean
  opacity: boolean
  metadata: boolean
}>

/** A renderer consumes the same immutable scene regardless of its target. */
export interface SceneRenderer<TTarget = unknown> {
  readonly id: string
  readonly capabilities: SceneRendererCapabilities
  render(scene: Scene, target: TTarget): void
}
