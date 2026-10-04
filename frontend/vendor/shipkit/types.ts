export type SvgSunTrackerColorStop = {
  hour: number
  color: string
}

export type DashboardBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type DashboardWidgetFrame = {
  id: string
  bounds: DashboardBounds
  title: string
  eyebrow: string
}

export type DashboardTrendPoint = {
  label: string
  value: number
}

export type DashboardSystemItem = {
  label: string
  value: string
  status: 'ok' | 'idle' | 'warning' | string
}

export type RailroadStatus =
  | 'success'
  | 'failed'
  | 'running'
  | 'pending'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'unknown'

export type RailroadStop = {
  id: string
  label: string
  detail?: string
  status?: RailroadStatus | string
  lineIds?: readonly string[]
  position?: { x: number; y: number }
}

export type RailroadLine = {
  id: string
  label?: string
  color?: string
  stopIds: readonly string[]
}

export type RailroadOptions = {
  id: string
  bounds: DashboardBounds
  stops: readonly RailroadStop[]
  lines?: readonly RailroadLine[]
  orientation?: 'horizontal' | 'vertical'
  padding?: number
  lineWidth?: number
  stopRadius?: number
  showLabels?: boolean
  alternateLabels?: boolean
  showStops?: boolean
  cornerRadius?: number
}

export type SubwayRouteOptions = {
  cornerRadius?: number
  verticalDetour?: number
}
