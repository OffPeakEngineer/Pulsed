import { BridgeError } from "./errors.js";
/** Create an explicit, side-effect-free registry of adapters trusted by a host. */
export function createBridgeRegistry(initial = []) {
    const adapters = new Map();
    function key(id, version) {
        return `${id}@${version}`;
    }
    function register(adapter) {
        validateIdentity(adapter);
        const adapterKey = key(adapter.id, adapter.version);
        if (adapters.has(adapterKey)) {
            throw new BridgeError('adapter-conflict', `Bridge adapter ${adapterKey} is already registered`, {
                adapter: adapter.id,
                version: adapter.version,
            });
        }
        adapters.set(adapterKey, adapter);
        return () => {
            if (adapters.get(adapterKey) === adapter)
                adapters.delete(adapterKey);
        };
    }
    function source(id, version) {
        const adapter = adapters.get(key(id, version));
        if (!adapter) {
            throw new BridgeError('adapter-not-found', `No trusted Bridge source adapter is registered for ${id}@${version}`, {
                adapter: id,
                version,
            });
        }
        return adapter;
    }
    function capabilities() {
        return [...adapters.values()]
            .map(adapter => ({ kind: adapter.kind, id: adapter.id, version: adapter.version }))
            .sort((left, right) => left.id.localeCompare(right.id) || left.version - right.version);
    }
    for (const adapter of initial)
        register(adapter);
    return { register, source, capabilities };
}
function validateIdentity(adapter) {
    if (adapter.kind !== 'source' || !/^[a-z0-9][a-z0-9._/-]*$/.test(adapter.id) || !Number.isInteger(adapter.version) || adapter.version < 1) {
        throw new BridgeError('invalid-config', 'Bridge adapters require a stable lowercase ID and positive integer version');
    }
}
