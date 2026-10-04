import { BridgeError } from './errors.ts'
import type { BridgeAdapterCapability, BridgeSourceAdapter } from './types.ts'

export type BridgeRegistry = Readonly<{
  register: (adapter: BridgeSourceAdapter) => () => void
  source: (id: string, version: number) => BridgeSourceAdapter
  capabilities: () => readonly BridgeAdapterCapability[]
}>

/** Create an explicit, side-effect-free registry of adapters trusted by a host. */
export function createBridgeRegistry(initial: readonly BridgeSourceAdapter[] = []): BridgeRegistry {
  const adapters = new Map<string, BridgeSourceAdapter>()

  function key(id: string, version: number) {
    return `${id}@${version}`
  }

  function register(adapter: BridgeSourceAdapter) {
    validateIdentity(adapter)
    const adapterKey = key(adapter.id, adapter.version)
    if (adapters.has(adapterKey)) {
      throw new BridgeError('adapter-conflict', `Bridge adapter ${adapterKey} is already registered`, {
        adapter: adapter.id,
        version: adapter.version,
      })
    }
    adapters.set(adapterKey, adapter)
    return () => {
      if (adapters.get(adapterKey) === adapter) adapters.delete(adapterKey)
    }
  }

  function source(id: string, version: number) {
    const adapter = adapters.get(key(id, version))
    if (!adapter) {
      throw new BridgeError('adapter-not-found', `No trusted Bridge source adapter is registered for ${id}@${version}`, {
        adapter: id,
        version,
      })
    }
    return adapter
  }

  function capabilities(): readonly BridgeAdapterCapability[] {
    return [...adapters.values()]
      .map(adapter => ({ kind: adapter.kind, id: adapter.id, version: adapter.version }))
      .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version)
  }

  for (const adapter of initial) register(adapter)
  return { register, source, capabilities }
}

function validateIdentity(adapter: BridgeSourceAdapter) {
  if (adapter.kind !== 'source' || !/^[a-z0-9][a-z0-9._/-]*$/.test(adapter.id) || !Number.isInteger(adapter.version) || adapter.version < 1) {
    throw new BridgeError('invalid-config', 'Bridge adapters require a stable lowercase ID and positive integer version')
  }
}
