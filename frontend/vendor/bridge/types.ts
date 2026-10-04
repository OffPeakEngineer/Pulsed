export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type BridgeAdapterReference = Readonly<{
  id: string
  version: number
}>

/** Serializable source declaration suitable for embedding in model metadata. */
export type BridgeSourceDescriptor = Readonly<{
  id: string
  adapter: BridgeAdapterReference
  config: JsonValue
  refreshMs?: number
}>

export type BridgeIssue = Readonly<{
  code: string
  message: string
  scope?: string
  recoverable: boolean
}>

export type BridgeFreshness = 'fresh' | 'stale'

export type BridgeReadResult<TData> = Readonly<{
  data: TData
  observedAt: string
  freshness: BridgeFreshness
  issues: readonly BridgeIssue[]
}>

export type BridgeReadContext = Readonly<{
  fetch: typeof globalThis.fetch
  now: () => Date
  signal?: AbortSignal
}>

/**
 * A source adapter turns declarative JSON configuration into normalized model
 * data. Hosts own scheduling, trust policy, caching, and adapter registration.
 */
export interface BridgeSourceAdapter<TData = unknown> {
  readonly kind: 'source'
  readonly id: string
  readonly version: number
  read(config: unknown, context: BridgeReadContext): Promise<BridgeReadResult<TData>>
}

export type BridgeAdapterCapability = Readonly<{
  kind: 'source'
  id: string
  version: number
}>
